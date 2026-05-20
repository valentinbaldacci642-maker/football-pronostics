const { getMessaging } = require('./firebaseAdmin');
const pronosticsService = require('./pronosticsService');
const apiFootball = require('./apiFootball');
const logger = require('../utils/logger');

// In-memory state. Render free tier stays warm via UptimeRobot ping so
// these maps survive across requests. A deploy / crash resets them →
// at worst the next scan re-notifies one batch of already-known VBs.
// Frontend re-registers its token on every app launch, so token loss
// after a restart self-heals quickly.
const tokens = new Map();          // token → { platform, registeredAt, favoriteTeams: number[] }
const notifiedVbKeys = new Set();  // "fixtureId::market::selection"
// "token::date::teamId" — favorite-team 'plays today' notifs, date-scoped so
// keys naturally reset each day. Cleared wholesale when the date rolls over.
const notifiedFavKeys = new Set();
let lastFavScanDate = null;
let lastScanAt = 0;
let lastSentCount = 0;

// Hard cap to bound memory against unauthenticated spam. Real users are
// in the low double digits; 10k leaves plenty of headroom while making a
// flood attack non-trivial. When full, oldest entries are evicted (LRU-ish
// since Map preserves insertion order and we re-set on each call).
const MAX_TOKENS = 10_000;
const ALLOWED_PLATFORMS = new Set(['android', 'ios', 'web', 'unknown']);

// Sanitize the client-supplied favorite team list: numbers only, deduped,
// capped so a token can't store an unbounded array.
function sanitizeFavoriteTeams(input) {
  if (!Array.isArray(input)) return [];
  const ids = [];
  for (const v of input) {
    const n = typeof v === 'number' ? v : parseInt(v, 10);
    if (Number.isInteger(n) && n > 0 && !ids.includes(n)) ids.push(n);
    if (ids.length >= 100) break;
  }
  return ids;
}

function registerToken(token, platform = 'unknown', favoriteTeams = []) {
  if (!token || typeof token !== 'string') return false;
  // FCM registration tokens are ~140-260 chars. Reject anything outside
  // a sane range so an attacker can't fill memory with megabyte tokens.
  if (token.length < 100 || token.length > 512) return false;
  const safePlatform = ALLOWED_PLATFORMS.has(platform) ? platform : 'unknown';
  if (tokens.size >= MAX_TOKENS && !tokens.has(token)) {
    const oldest = tokens.keys().next().value;
    if (oldest) tokens.delete(oldest);
  }
  tokens.set(token, {
    platform: safePlatform,
    registeredAt: Date.now(),
    favoriteTeams: sanitizeFavoriteTeams(favoriteTeams),
  });
  return true;
}

function unregisterToken(token) {
  return tokens.delete(token);
}

function listTokens() {
  return Array.from(tokens.keys());
}

function buildVbKey(fixtureId, market, selection) {
  return `${fixtureId}::${market}::${selection}`;
}

/**
 * Extract every VB across all pronostics, normalised. Pulled out so we
 * can diff "new since last scan" from a flat list keyed by VB identity.
 */
function extractVbs(pronostics) {
  const out = [];
  for (const p of pronostics) {
    const fixtureId = p.fixture?.fixture?.id;
    if (!fixtureId) continue;
    const vbs = p.analysis?.odds?.valueBets || [];
    for (const vb of vbs) {
      if (!vb?.market || !vb?.selection) continue;
      out.push({
        key: buildVbKey(fixtureId, vb.market, vb.selection),
        fixtureId,
        homeTeam: p.fixture.teams?.home?.name || '',
        awayTeam: p.fixture.teams?.away?.name || '',
        leagueName: p.fixture.league?.name || '',
        market: vb.market,
        selection: vb.selection,
        edge: typeof vb.edge === 'number' ? vb.edge : null,
        odd: typeof vb.odd === 'number' ? vb.odd : null,
        kickoff: p.fixture.fixture?.date || null,
      });
    }
  }
  return out;
}

/**
 * Find newly appeared VBs since last scan and notify all registered
 * tokens. `minEdge` filters out low-edge VBs (default 7%). Returns a
 * summary used by the route handler / by UptimeRobot's response log.
 */
// minEdge is expressed in percentage POINTS (e.g. 6 means 6%), matching
// analysisService.js where `edge = trueProbPct - impliedPct` (both in %).
async function scanAndNotify({ minEdge = 6, date = null, dryRun = false } = {}) {
  lastScanAt = Date.now();

  const pronostics = await pronosticsService.getBestPronostics(false, date);
  const allVbs = extractVbs(pronostics);
  const qualifyingVbs = allVbs.filter((v) => v.edge != null && v.edge >= minEdge);

  // Diff: only VBs we haven't notified yet this run cycle
  const newVbs = qualifyingVbs.filter((v) => !notifiedVbKeys.has(v.key));

  if (dryRun) {
    return {
      scannedAt: lastScanAt,
      totalVbs: allVbs.length,
      qualifyingVbs: qualifyingVbs.length,
      newVbs: newVbs.length,
      newVbsPreview: newVbs.slice(0, 5).map((v) => ({
        key: v.key, edge: v.edge, label: `${v.homeTeam} vs ${v.awayTeam} — ${v.selection}`,
      })),
      tokenCount: tokens.size,
      sent: 0,
      dryRun: true,
    };
  }

  if (newVbs.length === 0) {
    return { scannedAt: lastScanAt, totalVbs: allVbs.length, qualifyingVbs: qualifyingVbs.length, newVbs: 0, tokenCount: tokens.size, sent: 0 };
  }

  // Mark notified BEFORE sending so a slow send doesn't cause a re-scan
  // to re-notify the same keys. Acceptable trade-off: a network failure
  // means the user silently misses the notif — UptimeRobot will retry
  // on the next tick, but with these keys already marked. We accept
  // missing a notif over spamming duplicates.
  for (const v of newVbs) notifiedVbKeys.add(v.key);

  const sent = await sendNewVbsNotification(newVbs);
  lastSentCount = sent;
  return {
    scannedAt: lastScanAt,
    totalVbs: allVbs.length,
    qualifyingVbs: qualifyingVbs.length,
    newVbs: newVbs.length,
    tokenCount: tokens.size,
    sent,
  };
}

// French day labels for compact relative formatting
const DAYS_FR = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
const MONTHS_FR = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];

/**
 * Format kickoff ISO string into a compact French label.
 *   - Today  → "Aujourd'hui 21:00"
 *   - Tomorrow → "Demain 18:30"
 *   - Otherwise → "sam 16 nov 20:00"
 */
function formatKickoff(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const startOfDay = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(d) - startOfDay(now)) / 86400000);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const time = `${hh}:${mm}`;
  if (dayDiff === 0) return `Aujourd'hui ${time}`;
  if (dayDiff === 1) return `Demain ${time}`;
  if (dayDiff === -1) return `Hier ${time}`;
  return `${DAYS_FR[d.getDay()]} ${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${time}`;
}

async function sendNewVbsNotification(newVbs) {
  const messaging = getMessaging();
  if (!messaging) {
    logger.warn(`scanAndNotify: ${newVbs.length} new VBs but FCM not configured — skipping send`);
    return 0;
  }
  const recipients = listTokens();
  if (recipients.length === 0) return 0;

  // One notification PER VB so the user sees each match individually
  // (date + teams + market) instead of an opaque "21 new VBs" summary.
  // Android stacks them under one group thanks to the shared `tag` prefix
  // and channel, so the notification shade stays tidy.
  const iconUrl = process.env.NOTIFICATION_ICON_URL
    || 'https://pronos-foufous-app.vercel.app/pwa-512x512.png';

  let sent = 0;
  const invalidTokens = [];

  for (const vb of newVbs) {
    const edgePct = vb.edge != null ? `${vb.edge.toFixed(1)}%` : '';
    const oddStr = vb.odd != null ? `@ ${vb.odd.toFixed(2)}` : '';
    const kickoffStr = formatKickoff(vb.kickoff);
    const title = `${vb.homeTeam} vs ${vb.awayTeam}`;
    // Body packs the match-time, pick, odd, edge so the lock-screen
    // preview tells the user everything they need to decide.
    const bodyParts = [];
    if (kickoffStr) bodyParts.push(kickoffStr);
    bodyParts.push(`${vb.selection} ${oddStr}`.trim());
    if (edgePct) bodyParts.push(`edge ${edgePct}`);
    const body = bodyParts.join(' · ');

    // Stable tag per VB → prevents duplicates if FCM redelivers, and
    // groups all VB notifs on Android under the same notification stack.
    const tag = `vb_${vb.fixtureId}_${vb.market}_${vb.selection}`.replace(/[^a-zA-Z0-9_]/g, '_');

    // FCM caps multicast at 500 tokens — chunk for safety.
    const CHUNK = 450;
    for (let i = 0; i < recipients.length; i += CHUNK) {
      const slice = recipients.slice(i, i + CHUNK);
      try {
        const resp = await messaging.sendEachForMulticast({
          tokens: slice,
          notification: { title, body, imageUrl: iconUrl },
          data: {
            type: 'new_vb',
            fixtureId: String(vb.fixtureId),
            market: vb.market,
            selection: vb.selection,
          },
          android: {
            priority: 'high',
            collapseKey: tag,
            notification: {
              channelId: 'value_bets',
              sound: 'default',
              imageUrl: iconUrl,
              tag,
              notificationCount: 1,
            },
          },
        });
        sent += resp.successCount;
        resp.responses.forEach((r, idx) => {
          if (!r.success) {
            const code = r.error?.code || '';
            if (code === 'messaging/registration-token-not-registered'
                || code === 'messaging/invalid-registration-token') {
              invalidTokens.push(slice[idx]);
            }
          }
        });
      } catch (e) {
        logger.error(`FCM multicast failed for VB ${vb.key}: ${e.message}`);
      }
    }
  }

  // Prune dead tokens so we don't keep retrying them
  for (const t of invalidTokens) tokens.delete(t);
  if (invalidTokens.length > 0) {
    logger.info(`Pruned ${invalidTokens.length} stale FCM tokens`);
  }

  logger.info(`Notifs sent: ${sent} deliveries for ${newVbs.length} new VBs (${recipients.length} tokens)`);
  return sent;
}

// ─── Favorite-team kickoff-reminder notifications ───────────────────────────

// Lead time before kickoff at which we fire the reminder. Runs 24/7 (incl.
// night matches) since the user explicitly wants those. The 5-min scan
// cadence means the notif lands within ~5 min of the 2h-before mark.
const FAV_LEAD_MS = 2 * 60 * 60 * 1000; // 2 hours

function dateInParis(offsetDays = 0) {
  try {
    const d = new Date(Date.now() + offsetDays * 86400000);
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(d);
  } catch (_) {
    const d = new Date(Date.now() + offsetDays * 86400000);
    return d.toISOString().split('T')[0];
  }
}

async function sendFavoriteTeamNotification(token, favTeam, fixture) {
  const messaging = getMessaging();
  if (!messaging) return false;
  const home = fixture.teams?.home;
  const away = fixture.teams?.away;
  const kickoff = formatKickoff(fixture.fixture?.date);
  // Fires ~2h before kickoff but worded as 'joue aujourd'hui' per user pref.
  const title = `${favTeam.name} joue aujourd'hui ⚽`;
  const bodyParts = [`${home?.name} vs ${away?.name}`];
  if (kickoff) bodyParts.push(kickoff);
  if (fixture.league?.name) bodyParts.push(fixture.league.name);
  const body = bodyParts.join(' · ');
  const iconUrl = process.env.NOTIFICATION_ICON_URL
    || 'https://pronos-foufous-app.vercel.app/pwa-512x512.png';

  try {
    await messaging.send({
      token,
      notification: { title, body },
      data: {
        type: 'fav_team_kickoff',
        fixtureId: String(fixture.fixture?.id),
        teamId: String(favTeam.id),
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'favorite_teams',
          sound: 'default',
          imageUrl: iconUrl,
          tag: `favteam_${fixture.fixture?.id}_${favTeam.id}`,
        },
      },
    });
    return true;
  } catch (e) {
    const code = e?.code || '';
    if (code === 'messaging/registration-token-not-registered'
        || code === 'messaging/invalid-registration-token') {
      tokens.delete(token);
    }
    logger.warn(`favorite-team notif failed: ${e.message}`);
    return false;
  }
}

/**
 * Notify each token ~2h before a favorited team's match kicks off. Runs
 * 24/7 (night matches included). Fetches today + tomorrow fixtures so a
 * match just after midnight is still caught by the 2h window. One notif
 * per (token, fixture, team); the dedup set resets daily (already-started
 * matches can't re-enter the future window, so the reset is safe).
 */
async function scanFavoriteTeamsToday({ dryRun = false } = {}) {
  const today = dateInParis(0);

  // Reset the dedup set when the Paris date rolls over to bound its growth.
  if (lastFavScanDate !== today) {
    notifiedFavKeys.clear();
    lastFavScanDate = today;
  }

  const anyFavorites = Array.from(tokens.values()).some((m) => (m.favoriteTeams || []).length > 0);
  if (!anyFavorites) {
    return { tokensWithFavs: 0, matchesInWindow: 0, sent: 0 };
  }

  // Today + tomorrow covers any kickoff within the next 2h, including ones
  // that fall on the next calendar day near midnight. Both calls are cached.
  const [d1, d2] = await Promise.all([
    apiFootball.getFixturesByDate(dateInParis(0)),
    apiFootball.getFixturesByDate(dateInParis(1)),
  ]);
  const fixtures = [...(d1?.response || []), ...(d2?.response || [])];

  const now = Date.now();
  const SCHEDULED = new Set(['NS', 'TBD', 'PST']);
  // Index team → earliest upcoming (still-scheduled, future) fixture.
  const teamUpcoming = new Map();
  for (const f of fixtures) {
    const ts = new Date(f.fixture?.date).getTime();
    if (!Number.isFinite(ts) || ts <= now) continue;
    if (f.fixture?.status?.short && !SCHEDULED.has(f.fixture.status.short)) continue;
    for (const side of ['home', 'away']) {
      const id = f.teams?.[side]?.id;
      if (!id) continue;
      const cur = teamUpcoming.get(id);
      if (!cur || ts < new Date(cur.fixture.date).getTime()) teamUpcoming.set(id, f);
    }
  }

  let sent = 0;
  let matchesInWindow = 0;
  let tokensWithFavs = 0;

  for (const [token, meta] of tokens) {
    const favs = meta.favoriteTeams || [];
    if (favs.length === 0) continue;
    tokensWithFavs++;
    for (const teamId of favs) {
      const fixture = teamUpcoming.get(teamId);
      if (!fixture) continue;
      const ts = new Date(fixture.fixture.date).getTime();
      const untilKickoff = ts - now;
      // Fire only inside the lead window: between now and 2h before kickoff.
      if (untilKickoff <= 0 || untilKickoff > FAV_LEAD_MS) continue;
      matchesInWindow++;
      const key = `${token}::${fixture.fixture.id}::${teamId}`;
      if (notifiedFavKeys.has(key)) continue;
      if (dryRun) continue;
      const home = fixture.teams?.home;
      const away = fixture.teams?.away;
      const favTeam = home?.id === teamId ? home : away;
      const ok = await sendFavoriteTeamNotification(token, favTeam, fixture);
      if (ok) {
        notifiedFavKeys.add(key);
        sent++;
      }
    }
  }

  return { date: today, tokensWithFavs, matchesInWindow, sent, dryRun };
}

function getStatus() {
  return {
    tokenCount: tokens.size,
    notifiedKeysCount: notifiedVbKeys.size,
    notifiedFavKeysCount: notifiedFavKeys.size,
    lastScanAt,
    lastSentCount,
    fcmConfigured: getMessaging() != null,
  };
}

function resetNotifiedKeys() {
  notifiedVbKeys.clear();
  notifiedFavKeys.clear();
  lastFavScanDate = null;
}

module.exports = {
  registerToken,
  unregisterToken,
  scanAndNotify,
  scanFavoriteTeamsToday,
  getStatus,
  resetNotifiedKeys,
};
