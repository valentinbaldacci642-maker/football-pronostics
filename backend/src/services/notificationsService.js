const axios = require('axios');
const { getMessaging } = require('./firebaseAdmin');
const pronosticsService = require('./pronosticsService');
const apiFootball = require('./apiFootball');
const weatherService = require('./weatherService');
const tokenStore = require('./tokenStore');
const logger = require('../utils/logger');

// In-memory state. Render free tier stays warm via UptimeRobot ping so
// these maps survive across requests. A deploy / crash resets them →
// at worst the next scan re-notifies one batch of already-known VBs.
// Frontend re-registers its token on every app launch, so token loss
// after a restart self-heals quickly.
const tokens = new Map();          // token → { platform, registeredAt, favoriteTeams: number[] }

// Rehydrate tokens from durable storage (Supabase) on boot so a Render
// restart/deploy no longer wipes everyone's notifications.
if (tokenStore.enabled) {
  tokenStore.loadAll().then((rows) => {
    let n = 0;
    for (const r of rows) { if (r?.token && r?.data) { tokens.set(r.token, r.data); n += 1; } }
    if (n) logger.info(`Rehydrated ${n} push token(s) from Supabase`);
  }).catch(() => {});
}

const notifiedVbKeys = new Set();  // "fixtureId::market::selection"
// "token::date::teamId" — favorite-team 'plays today' notifs, date-scoped so
// keys naturally reset each day. Cleared wholesale when the date rolls over.
const notifiedFavKeys = new Set();
let lastFavScanDate = null;
// Weather alert dedup — one rain/storm alert per favorite city per type per
// Paris day. Reset when the date rolls over.
const notifiedWeatherKeys = new Set();
let lastWeatherScanDate = null;
// Vigilance state: normDept → last seen level (1=vert..4=rouge). We notify on a
// CHANGE of level. First observation of a dept is baseline-silent (so a restart
// doesn't spam). reverseDept results are cached by rounded coords.
const vigilanceState = new Map();
const deptCache = new Map();
// Earthquake scan: remember the last quake time we processed + already-notified
// quake ids (bounded) so we never double-notify. Wiped on restart (at worst we
// re-evaluate the last few minutes, dedup by id still holds within a run).
let lastSeismeTime = 0;
const notifiedQuakeKeys = new Set();
// Bet-result dedup — one settled notif per (token, fixture, betKey). Reset daily.
const notifiedBetResultKeys = new Set();
let lastBetResultDate = null;
// Live match state for kickoff / goal / final notifs, only for fixtures a
// token cares about. fixtureId → { status, gh, ga }. Wiped on restart →
// at worst one live event is missed right after a deploy.
const liveState = new Map();
let lastScanAt = 0;
let lastSentCount = 0;

// Hard cap to bound memory against unauthenticated spam. Real users are
// in the low double digits; 10k leaves plenty of headroom while making a
// flood attack non-trivial. When full, oldest entries are evicted (LRU-ish
// since Map preserves insertion order and we re-set on each call).
const MAX_TOKENS = 10_000;
const ALLOWED_PLATFORMS = new Set(['android', 'ios', 'web', 'unknown']);

// Per-token notification preferences. Any key absent → treated as enabled,
// so a stale client that doesn't send prefs keeps getting everything.
const NOTIF_PREF_KEYS = ['vb', 'favTeam', 'favMatch', 'favMatchKickoff', 'goal', 'final', 'kickoff', 'favTeamVb', 'weather', 'vigilance', 'seisme', 'betResult'];

// Grade a bet pick against a final score → 'win' | 'loss' | 'push' | null.
// Mirror of the frontend gradeBet so settled-bet notifs match the app's verdict.
function gradeBet(market, selection, hg, ag) {
  const sel = (selection || '').trim().toLowerCase();
  if (!sel) return null;
  const total = hg + ag;
  if (sel === '1' || sel === 'home') return hg > ag ? 'win' : 'loss';
  if (sel === 'x' || sel === 'draw') return hg === ag ? 'win' : 'loss';
  if (sel === '2' || sel === 'away') return ag > hg ? 'win' : 'loss';
  if (sel.startsWith('over')) {
    const line = parseFloat(sel.replace(/[^0-9.]/g, ''));
    if (Number.isFinite(line)) return total > line ? 'win' : (total === line ? 'push' : 'loss');
  }
  if (sel.startsWith('under')) {
    const line = parseFloat(sel.replace(/[^0-9.]/g, ''));
    if (Number.isFinite(line)) return total < line ? 'win' : (total === line ? 'push' : 'loss');
  }
  if (sel === 'oui' || sel === 'yes') return (hg > 0 && ag > 0) ? 'win' : 'loss';
  if (sel === 'non' || sel === 'no') return (hg === 0 || ag === 0) ? 'win' : 'loss';
  return null;
}

// Sanitize the client's staked pending bets: [{ fixtureId, market, selection,
// home, away }], capped. Used to notify when each bet settles.
function sanitizePendingBets(input) {
  if (!Array.isArray(input)) return [];
  const out = [];
  for (const b of input) {
    if (!b || typeof b !== 'object') continue;
    const fixtureId = typeof b.fixtureId === 'number' ? b.fixtureId : parseInt(b.fixtureId, 10);
    if (!Number.isInteger(fixtureId) || fixtureId <= 0) continue;
    const selection = typeof b.selection === 'string' ? b.selection.slice(0, 40) : '';
    if (!selection) continue;
    out.push({
      fixtureId,
      market: typeof b.market === 'string' ? b.market.slice(0, 40) : '',
      selection,
      home: typeof b.home === 'string' ? b.home.slice(0, 60) : '',
      away: typeof b.away === 'string' ? b.away.slice(0, 60) : '',
    });
    if (out.length >= 100) break;
  }
  return out;
}

function sanitizeNotifPrefs(input) {
  const out = {};
  if (input && typeof input === 'object') {
    for (const k of NOTIF_PREF_KEYS) {
      if (k in input) out[k] = input[k] !== false;
    }
  }
  return out;
}

// Default-on: only false when explicitly disabled by the client.
function prefOn(token, key) {
  const meta = tokens.get(token);
  return !meta || !meta.notifPrefs || meta.notifPrefs[key] !== false;
}

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

// Favorite weather cities: [{ name, lat, lon }], capped, coords validated.
function sanitizeFavoriteCities(input) {
  if (!Array.isArray(input)) return [];
  const out = [];
  const seen = new Set();
  for (const c of input) {
    if (!c || typeof c !== 'object') continue;
    const lat = Number(c.lat);
    const lon = Number(c.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;
    const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const name = typeof c.name === 'string' ? c.name.slice(0, 80) : '';
    out.push({ name, lat, lon });
    if (out.length >= 20) break;
  }
  return out;
}

// Earthquake notif settings: { minMag, zoneLat, zoneLon, zoneRadius } — global
// alerts above minMag + optional proximity alerts within zoneRadius km.
function sanitizeSeisme(input) {
  if (!input || typeof input !== 'object') return null;
  const num = (v, def, min, max) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : def;
  };
  const lat = parseFloat(input.zoneLat);
  const lon = parseFloat(input.zoneLon);
  const hasZone = Number.isFinite(lat) && Number.isFinite(lon);
  return {
    minMag: num(input.minMag, 5, 1, 9),
    zoneLat: hasZone ? lat : null,
    zoneLon: hasZone ? lon : null,
    zoneRadius: hasZone ? num(input.zoneRadius, 300, 10, 3000) : 0,
  };
}

function registerToken(token, platform = 'unknown', favoriteTeams = [], favoriteMatches = [], notifPrefs = null, favoriteCities = null, pendingBets = null, seismeSettings = null) {
  if (!token || typeof token !== 'string') return false;
  // FCM registration tokens are ~140-260 chars. Reject anything outside
  // a sane range so an attacker can't fill memory with megabyte tokens.
  if (token.length < 100 || token.length > 512) return false;
  const safePlatform = ALLOWED_PLATFORMS.has(platform) ? platform : 'unknown';
  if (tokens.size >= MAX_TOKENS && !tokens.has(token)) {
    const oldest = tokens.keys().next().value;
    if (oldest) tokens.delete(oldest);
  }
  // Preserve existing prefs/cities/bets if the client didn't send any this call.
  // MERGE prefs (don't replace) so a partial update — e.g. the embedded
  // SeismoTrack page setting only `seisme` — doesn't wipe football/weather prefs.
  const prev = tokens.get(token);
  const prefs = { ...(prev?.notifPrefs || {}), ...(notifPrefs != null ? sanitizeNotifPrefs(notifPrefs) : {}) };
  const cities = favoriteCities != null ? sanitizeFavoriteCities(favoriteCities) : (prev?.favoriteCities || []);
  const bets = pendingBets != null ? sanitizePendingBets(pendingBets) : (prev?.pendingBets || []);
  const seisme = seismeSettings != null ? sanitizeSeisme(seismeSettings) : (prev?.seisme || null);
  tokens.set(token, {
    platform: safePlatform,
    registeredAt: Date.now(),
    favoriteTeams: sanitizeFavoriteTeams(favoriteTeams),
    favoriteMatches: sanitizeFavoriteTeams(favoriteMatches), // same shape: positive int IDs
    notifPrefs: prefs,
    favoriteCities: cities,
    pendingBets: bets,
    seisme,
  });
  tokenStore.save(token, tokens.get(token)).catch(() => {});
  return true;
}

// Lightweight registration used by the embedded SeismoTrack page. Accepts its
// native format ({notifM4, notifMinMag, radius, cityLat, cityLon}) and MERGES
// the seisme settings into the token without clobbering football/weather prefs.
function registerSeisme(token, platform = 'android', opts = {}) {
  if (!token || typeof token !== 'string' || token.length < 100 || token.length > 512) return false;
  const safePlatform = ALLOWED_PLATFORMS.has(platform) ? platform : 'unknown';
  const prev = tokens.get(token);
  if (!prev && tokens.size >= MAX_TOKENS) {
    const oldest = tokens.keys().next().value;
    if (oldest) tokens.delete(oldest);
  }
  const seisme = sanitizeSeisme({
    minMag: opts.notifMinMag,
    zoneLat: opts.cityLat,
    zoneLon: opts.cityLon,
    zoneRadius: opts.radius,
  });
  const wantSeisme = !!opts.notifM4 || (seisme.zoneRadius > 0 && seisme.zoneLat != null);
  tokens.set(token, {
    platform: safePlatform,
    registeredAt: Date.now(),
    favoriteTeams: prev?.favoriteTeams || [],
    favoriteMatches: prev?.favoriteMatches || [],
    notifPrefs: { ...(prev?.notifPrefs || {}), seisme: wantSeisme },
    favoriteCities: prev?.favoriteCities || [],
    pendingBets: prev?.pendingBets || [],
    seisme,
  });
  tokenStore.save(token, tokens.get(token)).catch(() => {});
  return true;
}

function unregisterToken(token) {
  tokenStore.remove(token).catch(() => {});
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
        homeTeamId: p.fixture.teams?.home?.id || null,
        awayTeamId: p.fixture.teams?.away?.id || null,
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
  // Targeted highlight: if a new VB involves a token's favorited team, send
  // that token an extra '💰 Value bet sur <équipe>' alert. Piggybacks on
  // the already-deduped newVbs list, so no separate dedup is needed.
  const favVbSent = await notifyFavoriteTeamVbs(newVbs);
  lastSentCount = sent;
  return {
    scannedAt: lastScanAt,
    totalVbs: allVbs.length,
    qualifyingVbs: qualifyingVbs.length,
    newVbs: newVbs.length,
    tokenCount: tokens.size,
    sent,
    favVbSent,
  };
}

// For each new VB, notify tokens that favorited either team with a
// personal '💰 Value bet sur <équipe>' alert.
async function notifyFavoriteTeamVbs(newVbs) {
  if (!getMessaging()) return 0;
  // teamId → Set<token>
  const teamToTokens = new Map();
  for (const [token, meta] of tokens) {
    if (!prefOn(token, 'favTeamVb')) continue;
    for (const tid of (meta.favoriteTeams || [])) {
      if (!teamToTokens.has(tid)) teamToTokens.set(tid, new Set());
      teamToTokens.get(tid).add(token);
    }
  }
  if (teamToTokens.size === 0) return 0;

  let sent = 0;
  for (const vb of newVbs) {
    for (const teamId of [vb.homeTeamId, vb.awayTeamId]) {
      if (!teamId) continue;
      const recipients = teamToTokens.get(teamId);
      if (!recipients || recipients.size === 0) continue;
      const favName = teamId === vb.homeTeamId ? vb.homeTeam : vb.awayTeam;
      const edgeStr = vb.edge != null ? ` (edge ${vb.edge.toFixed(1)}%)` : '';
      const oddStr = vb.odd != null ? ` @ ${vb.odd.toFixed(2)}` : '';
      sent += await notifyTokens(recipients, {
        title: `💰 Value bet sur ${favName}`,
        body: `${vb.homeTeam} vs ${vb.awayTeam} · ${vb.selection}${oddStr}${edgeStr}`,
        type: 'fav_team_vb',
        fixtureId: vb.fixtureId,
        tag: `favvb_${vb.fixtureId}_${vb.market}_${vb.selection}`.replace(/[^a-zA-Z0-9_]/g, '_'),
      });
    }
  }
  return sent;
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
  // Only tokens that haven't disabled generic value-bet notifs.
  const recipients = listTokens().filter((t) => prefOn(t, 'vb'));
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
  for (const t of invalidTokens) { tokens.delete(t); tokenStore.remove(t).catch(() => {}); }
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
const FAV_LEAD_MS = 2 * 60 * 60 * 1000;       // teams: 2h before kickoff
const FAV_MATCH_LEAD_MS = 15 * 60 * 1000;     // matches: 15 min before kickoff

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
  const title = `${favTeam.name} joue aujourd'hui`;
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
      tokenStore.remove(token).catch(() => {});
    }
    logger.warn(`favorite-team notif failed: ${e.message}`);
    return false;
  }
}

async function sendFavoriteMatchNotification(token, fixture) {
  const messaging = getMessaging();
  if (!messaging) return false;
  const home = fixture.teams?.home;
  const away = fixture.teams?.away;
  const title = 'Ton match commence dans 15 min !';
  const body = `${home?.name} vs ${away?.name}`;
  const iconUrl = process.env.NOTIFICATION_ICON_URL
    || 'https://pronos-foufous-app.vercel.app/pwa-512x512.png';

  try {
    await messaging.send({
      token,
      notification: { title, body },
      data: {
        type: 'fav_match_kickoff',
        fixtureId: String(fixture.fixture?.id),
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'favorite_teams',
          sound: 'default',
          imageUrl: iconUrl,
          tag: `favmatch_${fixture.fixture?.id}`,
        },
      },
    });
    return true;
  } catch (e) {
    const code = e?.code || '';
    if (code === 'messaging/registration-token-not-registered'
        || code === 'messaging/invalid-registration-token') {
      tokens.delete(token);
      tokenStore.remove(token).catch(() => {});
    }
    logger.warn(`favorite-match notif failed: ${e.message}`);
    return false;
  }
}

/**
 * Notify each token ~2h before a favorited team's match kicks off (24/7),
 * and ~15 min before a favorited *match* kicks off. Fetches today +
 * tomorrow fixtures (cached) so kickoffs just past midnight are still
 * caught. One notif per (token, fixture); the dedup set resets daily
 * (already-started matches can't re-enter the future window).
 */
async function scanFavoriteTeamsToday({ dryRun = false } = {}) {
  const today = dateInParis(0);

  // Reset the dedup set when the Paris date rolls over to bound its growth.
  if (lastFavScanDate !== today) {
    notifiedFavKeys.clear();
    lastFavScanDate = today;
  }

  const anyFavorites = Array.from(tokens.values()).some(
    (m) => (m.favoriteTeams || []).length > 0 || (m.favoriteMatches || []).length > 0
  );
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
  // Index team → earliest upcoming fixture, and fixtureId → fixture, from
  // the same scheduled-future pool. teamUpcoming powers the 2h team
  // reminder; fixtureById powers the 15-min favorited-match reminder.
  const teamUpcoming = new Map();
  const fixtureById = new Map();
  for (const f of fixtures) {
    const ts = new Date(f.fixture?.date).getTime();
    if (!Number.isFinite(ts) || ts <= now) continue;
    if (f.fixture?.status?.short && !SCHEDULED.has(f.fixture.status.short)) continue;
    if (f.fixture?.id) fixtureById.set(f.fixture.id, f);
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
    const favTeams = meta.favoriteTeams || [];
    const favMatches = meta.favoriteMatches || [];
    if (favTeams.length === 0 && favMatches.length === 0) continue;
    tokensWithFavs++;

    // ── Favorite teams: 2h before kickoff ──
    if (prefOn(token, 'favTeam')) for (const teamId of favTeams) {
      const fixture = teamUpcoming.get(teamId);
      if (!fixture) continue;
      const untilKickoff = new Date(fixture.fixture.date).getTime() - now;
      if (untilKickoff <= 0 || untilKickoff > FAV_LEAD_MS) continue;
      matchesInWindow++;
      const key = `team::${token}::${fixture.fixture.id}::${teamId}`;
      if (notifiedFavKeys.has(key)) continue;
      if (dryRun) continue;
      const home = fixture.teams?.home;
      const away = fixture.teams?.away;
      const favTeam = home?.id === teamId ? home : away;
      if (await sendFavoriteTeamNotification(token, favTeam, fixture)) {
        notifiedFavKeys.add(key);
        sent++;
      }
    }

    // ── Favorite matches: 15 min before kickoff ──
    if (prefOn(token, 'favMatch')) for (const fixtureId of favMatches) {
      const fixture = fixtureById.get(fixtureId);
      if (!fixture) continue;
      const untilKickoff = new Date(fixture.fixture.date).getTime() - now;
      if (untilKickoff <= 0 || untilKickoff > FAV_MATCH_LEAD_MS) continue;
      matchesInWindow++;
      const key = `match::${token}::${fixtureId}`;
      if (notifiedFavKeys.has(key)) continue;
      if (dryRun) continue;
      if (await sendFavoriteMatchNotification(token, fixture)) {
        notifiedFavKeys.add(key);
        sent++;
      }
    }
  }

  return { date: today, tokensWithFavs, matchesInWindow, sent, dryRun };
}

// ─── Live notifications: kickoff / goal / final result ──────────────────────

// Send a single push to a set of tokens. Prunes dead tokens. Returns count.
async function notifyTokens(recipients, { title, body, type, fixtureId, tag, channelId = 'favorite_teams' }) {
  const messaging = getMessaging();
  if (!messaging) return 0;
  const iconUrl = process.env.NOTIFICATION_ICON_URL
    || 'https://pronos-foufous-app.vercel.app/pwa-512x512.png';
  let sent = 0;
  for (const token of recipients) {
    try {
      await messaging.send({
        token,
        notification: { title, body },
        data: { type, fixtureId: String(fixtureId ?? '') },
        android: {
          priority: 'high',
          notification: { channelId, sound: 'default', imageUrl: iconUrl, tag },
        },
      });
      sent++;
    } catch (e) {
      const code = e?.code || '';
      if (code === 'messaging/registration-token-not-registered'
          || code === 'messaging/invalid-registration-token') {
        tokens.delete(token);
        tokenStore.remove(token).catch(() => {});
      }
    }
  }
  return sent;
}

const LIVE_STATUSES = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE', 'SUSP', 'INT']);
const FINAL_STATUSES = new Set(['FT', 'AET', 'PEN']);

/**
 * Detect kickoff / goals / final results for fixtures involving a favorited
 * team or match, and push to the relevant tokens. Diffs against liveState
 * so it only fires on transitions. Runs on every UptimeRobot tick (~5 min
 * latency on live events — the free-tier ceiling).
 */
async function scanLiveFavorites({ dryRun = false } = {}) {
  // Reverse indexes: which tokens care about each team / match.
  const teamToTokens = new Map();
  const matchToTokens = new Map();
  for (const [token, meta] of tokens) {
    for (const tid of (meta.favoriteTeams || [])) {
      if (!teamToTokens.has(tid)) teamToTokens.set(tid, new Set());
      teamToTokens.get(tid).add(token);
    }
    for (const fid of (meta.favoriteMatches || [])) {
      if (!matchToTokens.has(fid)) matchToTokens.set(fid, new Set());
      matchToTokens.get(fid).add(token);
    }
  }
  if (teamToTokens.size === 0 && matchToTokens.size === 0) {
    return { events: 0, sent: 0 };
  }

  // Live fixtures (freshest) + today's (covers finals + not-yet-started).
  const [liveData, todayData] = await Promise.all([
    apiFootball.getLiveFixtures(),
    apiFootball.getFixturesByDate(dateInParis(0)),
  ]);
  const byId = new Map();
  for (const f of (todayData?.response || [])) if (f.fixture?.id) byId.set(f.fixture.id, f);
  for (const f of (liveData?.response || [])) if (f.fixture?.id) byId.set(f.fixture.id, f); // live wins

  let events = 0;
  let sent = 0;

  for (const [fid, f] of byId) {
    const h = f.teams?.home;
    const a = f.teams?.away;
    // Split team-followers vs match-followers: kickoff for a *favorited match*
    // has its own 'favMatchKickoff' toggle (separate from the 15-min 'favMatch'
    // reminder), while kickoff for a *favorited team* uses the 'kickoff' toggle.
    const teamRecipients = new Set([
      ...(teamToTokens.get(h?.id) || []),
      ...(teamToTokens.get(a?.id) || []),
    ]);
    const matchRecipients = new Set(matchToTokens.get(fid) || []);
    const recipients = new Set([...teamRecipients, ...matchRecipients]);
    if (recipients.size === 0) continue;

    const status = f.fixture?.status?.short;
    const gh = f.goals?.home ?? 0;
    const ga = f.goals?.away ?? 0;
    const prev = liveState.get(fid);
    const score = `${h?.name} ${gh} - ${ga} ${a?.name}`;

    // Per-event recipient filtering by preference.
    const forPref = (key) => [...recipients].filter((t) => prefOn(t, key));

    // Kickoff: was scheduled, now live. Recipients = team-followers with the
    // 'kickoff' pref OR match-followers with the 'favMatchKickoff' pref.
    if (prev && (prev.status === 'NS' || prev.status === 'TBD') && LIVE_STATUSES.has(status)) {
      const ko = new Set();
      for (const t of teamRecipients) if (prefOn(t, 'kickoff')) ko.add(t);
      for (const t of matchRecipients) if (prefOn(t, 'favMatchKickoff')) ko.add(t);
      events++;
      if (!dryRun && ko.size) {
        sent += await notifyTokens([...ko], {
          title: "C'est parti !",
          body: `${h?.name} vs ${a?.name}`,
          type: 'live_kickoff', fixtureId: fid, tag: `kickoff_${fid}`,
        });
      }
    } else if (prev && LIVE_STATUSES.has(prev.status) && LIVE_STATUSES.has(status)
               && (gh + ga) > (prev.gh + prev.ga)) {
      // Goal: total score increased while live.
      const r = forPref('goal');
      events++;
      if (!dryRun && r.length) {
        sent += await notifyTokens(r, {
          title: `⚽ But ! ${gh} - ${ga}`,
          body: score,
          type: 'live_goal', fixtureId: fid, tag: `goal_${fid}_${gh}_${ga}`,
        });
      }
    }

    // Final: was not finished, now finished.
    if (prev && !FINAL_STATUSES.has(prev.status) && FINAL_STATUSES.has(status)) {
      const r = forPref('final');
      events++;
      if (!dryRun && r.length) {
        sent += await notifyTokens(r, {
          title: `Terminé · ${gh} - ${ga}`,
          body: score,
          type: 'live_final', fixtureId: fid, tag: `final_${fid}`,
        });
      }
    }

    liveState.set(fid, { status, gh, ga });
  }

  // Bound liveState growth: drop entries for fixtures that are now final
  // (no further transitions expected).
  for (const [fid, st] of liveState) {
    if (FINAL_STATUSES.has(st.status) && !byId.has(fid)) liveState.delete(fid);
  }

  return { events, sent, dryRun };
}

// ─── Weather alerts: rain / storm coming for a favorite city ────────────────

const WEATHER_LOOKAHEAD_MS = 3 * 60 * 60 * 1000; // alert if rain/storm within 3h
const WEATHER_RAIN_MM = 0.5;                      // min mm/h to count as rain
const WEATHER_RAIN_PROB = 50;                     // min % probability

/**
 * For each favorite city across all tokens (that enabled weather notifs),
 * check the next ~3h of Open-Meteo precipitation. Fire a single rain or
 * storm alert per city per type per Paris day. Cities are deduped across
 * tokens so each location is fetched once.
 */
async function scanWeatherAndNotify({ dryRun = false } = {}) {
  const today = dateInParis(0);
  if (lastWeatherScanDate !== today) {
    notifiedWeatherKeys.clear();
    lastWeatherScanDate = today;
  }

  // cityKey → { name, lat, lon, recipients: Set<token> }
  const cities = new Map();
  for (const [token, meta] of tokens) {
    if (!prefOn(token, 'weather')) continue;
    for (const c of (meta.favoriteCities || [])) {
      const key = `${c.lat.toFixed(2)},${c.lon.toFixed(2)}`;
      if (!cities.has(key)) cities.set(key, { name: c.name, lat: c.lat, lon: c.lon, recipients: new Set() });
      cities.get(key).recipients.add(token);
    }
  }
  if (cities.size === 0) return { cities: 0, alerts: 0, sent: 0 };

  const now = Date.now();
  let alerts = 0;
  let sent = 0;

  for (const [key, city] of cities) {
    let outlook;
    try {
      outlook = await weatherService.getOutlook(city.lat, city.lon);
    } catch (e) {
      logger.warn(`weather outlook failed for ${city.name}: ${e.message}`);
      continue;
    }
    const h = outlook?.hourly;
    if (!h?.time) continue;

    let maxPrecip = 0;
    let maxProb = 0;
    let storm = false;
    for (let i = 0; i < h.time.length; i++) {
      const ts = new Date(h.time[i]).getTime();
      if (ts < now || ts > now + WEATHER_LOOKAHEAD_MS) continue;
      maxPrecip = Math.max(maxPrecip, h.precipitation?.[i] ?? 0);
      maxProb = Math.max(maxProb, h.precipitation_probability?.[i] ?? 0);
      if ((h.weather_code?.[i] ?? 0) >= 95) storm = true;
    }

    const rain = maxPrecip >= WEATHER_RAIN_MM && maxProb >= WEATHER_RAIN_PROB;
    if (!storm && !rain) continue;

    const type = storm ? 'storm' : 'rain';
    const dkey = `${key}::${type}::${today}`;
    if (notifiedWeatherKeys.has(dkey)) continue;
    alerts++;
    if (dryRun) continue;

    const title = storm ? `⛈️ Orage à ${city.name}` : `🌧️ Pluie à ${city.name}`;
    const body = storm
      ? 'Orage prévu dans les 3 prochaines heures — sois prudent.'
      : `Pluie prévue dans les 3 prochaines heures · ${maxProb}% · jusqu'à ${maxPrecip.toFixed(1)} mm/h.`;
    const n = await notifyTokens(city.recipients, {
      title,
      body,
      type: `weather_${type}`,
      tag: `weather_${type}_${key}`.replace(/[^a-zA-Z0-9_]/g, '_'),
      channelId: 'weather_alerts',
    });
    if (n > 0) notifiedWeatherKeys.add(dkey);
    sent += n;
  }

  return { cities: cities.size, alerts, sent, dryRun };
}

// ─── Vigilance Météo-France: notify on a level CHANGE for a favorite city ────

/**
 * For each favorite city (tokens with 'vigilance' pref), resolve its French
 * department and compare the current Météo-France vigilance level to the last
 * seen one. Notify only when it CHANGES (e.g. vert→jaune, jaune→orange, or back
 * to vert). First observation of a dept is baseline-silent to avoid spamming on
 * restart. One feed fetch covers all favorite cities.
 */
async function scanVigilanceAndNotify({ dryRun = false } = {}) {
  // Gather favorite cities for tokens that enabled vigilance notifs.
  const cityList = [];
  for (const [token, meta] of tokens) {
    if (!prefOn(token, 'vigilance')) continue;
    for (const c of (meta.favoriteCities || [])) cityList.push({ ...c, token });
  }
  if (cityList.length === 0) return { depts: 0, changes: 0, sent: 0 };

  let vigMap;
  try {
    vigMap = await weatherService.getActiveVigilanceMap();
  } catch (e) {
    logger.warn('vigilance map failed: ' + (e?.message || e));
    return { depts: 0, changes: 0, sent: 0 };
  }

  // Group recipients by department (resolved from coords, cached).
  const deptInfo = new Map(); // normDept → { label, name, recipients:Set }
  for (const c of cityList) {
    const ck = `${c.lat.toFixed(2)},${c.lon.toFixed(2)}`;
    let dep = deptCache.get(ck);
    if (dep === undefined) {
      try { dep = await weatherService.reverseDept(c.lat, c.lon); } catch { dep = null; }
      deptCache.set(ck, dep);
    }
    if (!dep) continue;
    const nd = weatherService.normDept(dep);
    if (!deptInfo.has(nd)) deptInfo.set(nd, { label: dep, name: c.name, recipients: new Set() });
    deptInfo.get(nd).recipients.add(c.token);
  }

  let changes = 0;
  let sent = 0;
  for (const [nd, info] of deptInfo) {
    const warnings = vigMap.get(nd) || [];
    const level = warnings.length ? warnings[0].level : 1; // 1 = vert (aucune)
    const prev = vigilanceState.get(nd);
    vigilanceState.set(nd, level);
    if (prev === undefined || prev === level) continue; // baseline or no change
    changes++;
    if (dryRun) continue;

    let title; let body;
    if (level >= 2) {
      const top = warnings[0];
      title = `${top.icon} Vigilance ${top.levelLabel} · ${info.label}`;
      body = `${warnings.map((w) => `${w.icon} ${w.type}`).join(', ')} — ${info.name}`;
    } else {
      title = `✅ Vigilance levée · ${info.label}`;
      body = `Retour au vert — ${info.name}`;
    }
    sent += await notifyTokens(info.recipients, {
      title,
      body,
      type: 'weather_vigilance',
      tag: `vigilance_${nd}`.replace(/[^a-zA-Z0-9_]/g, '_'),
      channelId: 'weather_alerts',
    });
  }

  return { depts: deptInfo.size, changes, sent, dryRun };
}

// ─── Earthquake alerts (SeismoTrack) : USGS poll + FCM push ─────────────────

const SEISME_ZONE_FLOOR = 2.5; // min magnitude for proximity (zone) alerts
const USGS_QUERY = 'https://earthquake.usgs.gov/fdsnws/event/1/query';

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Poll USGS for new earthquakes and FCM-push to tokens with 'seisme' on:
 *  - global: magnitude ≥ the token's minMag
 *  - zone:   within zoneRadius km of the token's location (mag ≥ floor)
 * Server-side FCM (like weather) — reliable, unlike the old background-runner.
 * First run after restart is baseline-silent (records the time, no history spam).
 */
async function scanSeismeAndNotify({ dryRun = false } = {}) {
  const recipients = [];
  for (const [token, meta] of tokens) {
    if (!prefOn(token, 'seisme')) continue;
    recipients.push({ token, s: meta.seisme || { minMag: 5, zoneLat: null, zoneLon: null, zoneRadius: 0 } });
  }
  if (recipients.length === 0) return { quakes: 0, sent: 0 };

  const now = Date.now();
  if (lastSeismeTime === 0) { lastSeismeTime = now; return { quakes: 0, sent: 0, baseline: true }; }

  const startTime = new Date(Math.max(lastSeismeTime, now - 30 * 60 * 1000)).toISOString();
  let features = [];
  try {
    const { data } = await axios.get(USGS_QUERY, {
      params: { format: 'geojson', starttime: startTime, minmagnitude: 1, orderby: 'time' },
      timeout: 10000,
    });
    features = data?.features || [];
  } catch (e) {
    logger.warn('seisme fetch failed: ' + (e?.message || e));
    return { quakes: 0, sent: 0 };
  }

  const fresh = features.filter((f) => (f.properties?.time || 0) > lastSeismeTime);
  lastSeismeTime = now;
  if (fresh.length === 0) return { quakes: 0, sent: 0 };

  let sent = 0;
  for (const f of fresh) {
    const p = f.properties || {};
    const c = f.geometry?.coordinates || [];
    const mag = p.mag;
    if (mag == null) continue;
    const place = p.place || 'Lieu inconnu';
    const depth = c[2];
    const lat = c[1];
    const lon = c[0];
    const tsunami = p.tsunami === 1 ? ' ⚠️ TSUNAMI' : '';
    const qid = f.id;

    for (const { token, s } of recipients) {
      let proximityKm = null;
      let hit = false;
      if (mag >= s.minMag) {
        hit = true;
      } else if (s.zoneRadius > 0 && s.zoneLat != null && mag >= SEISME_ZONE_FLOOR
                 && Number.isFinite(lat) && Number.isFinite(lon)) {
        const dist = haversineKm(s.zoneLat, s.zoneLon, lat, lon);
        if (dist <= s.zoneRadius) { hit = true; proximityKm = Math.round(dist); }
      }
      if (!hit) continue;
      const dkey = `${token}::${qid}`;
      if (notifiedQuakeKeys.has(dkey)) continue;
      if (dryRun) { notifiedQuakeKeys.add(dkey); sent++; continue; }

      const title = proximityKm != null
        ? `📍 Séisme à proximité · M${mag.toFixed(1)}${tsunami}`
        : `🌍 Séisme · M${mag.toFixed(1)}${tsunami}`;
      const body = `${proximityKm != null ? `À ${proximityKm} km · ` : ''}${place} — Prof. ${depth != null ? Math.round(depth) : '?'} km`;
      const n = await notifyTokens([token], {
        title, body, type: 'seisme', tag: `seisme_${qid}`, channelId: 'weather_alerts',
      });
      if (n > 0) { notifiedQuakeKeys.add(dkey); sent++; }
    }
  }
  if (notifiedQuakeKeys.size > 5000) notifiedQuakeKeys.clear();
  return { quakes: fresh.length, sent, dryRun };
}

// ─── Bet-result notifications: notify when a user's staked bet settles ──────

/**
 * For each token's staked pending bets, check the fixture's final result and
 * notify "Pari gagné/perdu" once it's over. One notif per (token, fixture,
 * bet); dedup resets daily. Fetches today + yesterday fixtures (cached).
 */
async function scanBetResults({ dryRun = false } = {}) {
  const today = dateInParis(0);
  if (lastBetResultDate !== today) {
    notifiedBetResultKeys.clear();
    lastBetResultDate = today;
  }

  const anyBets = Array.from(tokens.values()).some((m) => (m.pendingBets || []).length > 0);
  if (!anyBets) return { tokensWithBets: 0, settled: 0, sent: 0 };

  const [d0, d1] = await Promise.all([
    apiFootball.getFixturesByDate(dateInParis(0)),
    apiFootball.getFixturesByDate(dateInParis(-1)),
  ]);
  const byId = new Map();
  for (const f of [...(d1?.response || []), ...(d0?.response || [])]) {
    if (f.fixture?.id) byId.set(f.fixture.id, f);
  }

  let sent = 0;
  let settled = 0;
  let tokensWithBets = 0;

  for (const [token, meta] of tokens) {
    const bets = meta.pendingBets || [];
    if (bets.length === 0) continue;
    tokensWithBets++;
    if (!prefOn(token, 'betResult')) continue;

    for (const bet of bets) {
      const f = byId.get(bet.fixtureId);
      if (!f) continue;
      const status = f.fixture?.status?.short;
      if (!FINAL_STATUSES.has(status)) continue;
      const hg = f.goals?.home;
      const ag = f.goals?.away;
      if (!Number.isFinite(hg) || !Number.isFinite(ag)) continue;
      const verdict = gradeBet(bet.market, bet.selection, hg, ag);
      if (!verdict) continue;
      settled++;
      const key = `${token}::${bet.fixtureId}::${bet.market}::${bet.selection}`;
      if (notifiedBetResultKeys.has(key)) continue;
      if (dryRun) continue;
      const home = bet.home || f.teams?.home?.name || '';
      const away = bet.away || f.teams?.away?.name || '';
      const emoji = verdict === 'win' ? '✅' : verdict === 'push' ? '↩️' : '❌';
      const verdictTxt = verdict === 'win' ? 'Pari gagné' : verdict === 'push' ? 'Pari remboursé' : 'Pari perdu';
      const n = await notifyTokens([token], {
        title: `${emoji} ${verdictTxt}`,
        body: `${home} ${hg}-${ag} ${away} · ${bet.selection}`,
        type: `bet_${verdict}`,
        fixtureId: bet.fixtureId,
        tag: `betres_${bet.fixtureId}_${bet.market}_${bet.selection}`.replace(/[^a-zA-Z0-9_]/g, '_'),
      });
      if (n > 0) notifiedBetResultKeys.add(key);
      sent += n;
    }
  }

  return { tokensWithBets, settled, sent, dryRun };
}

function getStatus() {
  return {
    tokenCount: tokens.size,
    notifiedKeysCount: notifiedVbKeys.size,
    notifiedFavKeysCount: notifiedFavKeys.size,
    lastScanAt,
    lastSentCount,
    fcmConfigured: getMessaging() != null,
    tokenPersist: tokenStore.enabled, // true => SUPABASE_URL + key chargés sur le serveur
  };
}

function resetNotifiedKeys() {
  notifiedVbKeys.clear();
  notifiedFavKeys.clear();
  notifiedWeatherKeys.clear();
  notifiedBetResultKeys.clear();
  liveState.clear();
  lastFavScanDate = null;
  lastWeatherScanDate = null;
  lastBetResultDate = null;
}

module.exports = {
  registerToken,
  unregisterToken,
  scanAndNotify,
  scanFavoriteTeamsToday,
  scanLiveFavorites,
  scanWeatherAndNotify,
  scanVigilanceAndNotify,
  scanSeismeAndNotify,
  registerSeisme,
  scanBetResults,
  getStatus,
  resetNotifiedKeys,
};
