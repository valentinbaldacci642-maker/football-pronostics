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

function registerToken(token, platform = 'unknown') {
  if (!token || typeof token !== 'string') return false;
  tokens.set(token, { platform, registeredAt: Date.now() });
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
// minEdge is expressed in percentage POINTS (e.g. 5 means 5%), matching
// analysisService.js where `edge = trueProbPct - impliedPct` (both in %).
async function scanAndNotify({ minEdge = 5, date = null, dryRun = false } = {}) {
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

async function sendNewVbsNotification(newVbs) {
  const messaging = getMessaging();
  if (!messaging) {
    logger.warn(`scanAndNotify: ${newVbs.length} new VBs but FCM not configured — skipping send`);
    return 0;
  }
  const recipients = listTokens();
  if (recipients.length === 0) return 0;

  // One notification per scan (not per VB) so the user doesn't get spammed
  // with 12 banners when a fresh batch lands. Title = count, body = top match.
  const top = newVbs[0];
  const edgePct = top.edge != null ? `${top.edge.toFixed(1)}%` : '';
  const title = newVbs.length === 1
    ? `Nouveau value bet ${edgePct}`
    : `${newVbs.length} nouveaux value bets`;
  const body = newVbs.length === 1
    ? `${top.homeTeam} vs ${top.awayTeam} — ${top.selection} @ ${top.odd != null ? top.odd.toFixed(2) : '?'}`
    : `Top: ${top.homeTeam} vs ${top.awayTeam} — ${top.selection} (${edgePct})`;

  // FCM caps multicast at 500 tokens — fine for our single-user app, but
  // chunk anyway for safety.
  const CHUNK = 450;
  let sent = 0;
  const invalidTokens = [];

  for (let i = 0; i < recipients.length; i += CHUNK) {
    const slice = recipients.slice(i, i + CHUNK);
    try {
      // Public URL to the app icon — shown as the large image in the
      // notification body. The small icon (status bar) comes from the
      // AndroidManifest meta-data `default_notification_icon`.
      const iconUrl = process.env.NOTIFICATION_ICON_URL
        || 'https://pronos-foufous-app.vercel.app/pwa-512x512.png';

      const resp = await messaging.sendEachForMulticast({
        tokens: slice,
        notification: { title, body, imageUrl: iconUrl },
        data: {
          type: 'new_vbs',
          count: String(newVbs.length),
          fixtureId: String(top.fixtureId),
        },
        android: {
          priority: 'high',
          notification: {
            channelId: 'value_bets',
            sound: 'default',
            imageUrl: iconUrl,
          },
        },
      });
      sent += resp.successCount;
      resp.responses.forEach((r, idx) => {
        if (!r.success) {
          const code = r.error?.code || '';
          // Token is permanently invalid → drop it
          if (code === 'messaging/registration-token-not-registered'
              || code === 'messaging/invalid-registration-token') {
            invalidTokens.push(slice[idx]);
          }
        }
      });
    } catch (e) {
      logger.error('FCM multicast failed: ' + e.message);
    }
  }

  // Prune dead tokens so we don't keep retrying them
  for (const t of invalidTokens) tokens.delete(t);
  if (invalidTokens.length > 0) {
    logger.info(`Pruned ${invalidTokens.length} stale FCM tokens`);
  }

  logger.info(`Notif sent: ${sent}/${recipients.length} tokens for ${newVbs.length} new VBs`);
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
