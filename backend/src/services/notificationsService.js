const { getMessaging } = require('./firebaseAdmin');
const pronosticsService = require('./pronosticsService');
const logger = require('../utils/logger');

// In-memory state. Render free tier stays warm via UptimeRobot ping so
// these maps survive across requests. A deploy / crash resets them →
// at worst the next scan re-notifies one batch of already-known VBs.
// Frontend re-registers its token on every app launch, so token loss
// after a restart self-heals quickly.
const tokens = new Map();          // token → { platform, registeredAt }
const notifiedVbKeys = new Set();  // "fixtureId::market::selection"
let lastScanAt = 0;
let lastSentCount = 0;

// Hard cap to bound memory against unauthenticated spam. Real users are
// in the low double digits; 10k leaves plenty of headroom while making a
// flood attack non-trivial. When full, oldest entries are evicted (LRU-ish
// since Map preserves insertion order and we re-set on each call).
const MAX_TOKENS = 10_000;
const ALLOWED_PLATFORMS = new Set(['android', 'ios', 'web', 'unknown']);

function registerToken(token, platform = 'unknown') {
  if (!token || typeof token !== 'string') return false;
  // FCM registration tokens are ~140-260 chars. Reject anything outside
  // a sane range so an attacker can't fill memory with megabyte tokens.
  if (token.length < 100 || token.length > 512) return false;
  const safePlatform = ALLOWED_PLATFORMS.has(platform) ? platform : 'unknown';
  if (tokens.size >= MAX_TOKENS && !tokens.has(token)) {
    const oldest = tokens.keys().next().value;
    if (oldest) tokens.delete(oldest);
  }
  tokens.set(token, { platform: safePlatform, registeredAt: Date.now() });
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

function getStatus() {
  return {
    tokenCount: tokens.size,
    notifiedKeysCount: notifiedVbKeys.size,
    lastScanAt,
    lastSentCount,
    fcmConfigured: getMessaging() != null,
  };
}

function resetNotifiedKeys() {
  notifiedVbKeys.clear();
}

module.exports = {
  registerToken,
  unregisterToken,
  scanAndNotify,
  getStatus,
  resetNotifiedKeys,
};
