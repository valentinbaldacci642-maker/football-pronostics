const express = require('express');
const router = express.Router();
const notifications = require('../services/notificationsService');
const logger = require('../utils/logger');
const adminAuth = require('../middleware/adminAuth');

// Fail-closed: secret must be set, comparison is constant-time. UptimeRobot
// free tier needs query-string auth (no custom headers), so allowQueryKey.
const authScan = adminAuth({ allowQueryKey: true });

router.post('/register', (req, res) => {
  const { token, platform, favoriteTeams } = req.body || {};
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'token is required' });
  }
  const ok = notifications.registerToken(token, platform, favoriteTeams);
  res.json({ ok, status: notifications.getStatus() });
});

router.post('/unregister', (req, res) => {
  const { token } = req.body || {};
  if (!token) return res.status(400).json({ error: 'token is required' });
  const removed = notifications.unregisterToken(token);
  res.json({ removed });
});

router.get('/status', (req, res) => {
  res.json(notifications.getStatus());
});

// GET so UptimeRobot can hit it (free tier only does GET easily). The
// shared secret is the only auth. minEdge can be tuned per call.
router.get('/scan-new-vbs', authScan, async (req, res) => {
  try {
    // minEdge in percentage points (e.g. 6 = 6%). Default 6.
    const minEdge = Number.isFinite(parseFloat(req.query.minEdge))
      ? parseFloat(req.query.minEdge)
      : 6;
    const dryRun = req.query.dry === '1';
    const date = typeof req.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
      ? req.query.date
      : null;
    const result = await notifications.scanAndNotify({ minEdge, date, dryRun });

    // Piggyback the favorite-team 'plays today' scan on the same UptimeRobot
    // tick. It's cheap (one cached fixtures-by-date call) and self-dedups
    // per day, so running it every 5 min only ever sends one notif per
    // favorite team per day. Failures here must not break the VB scan.
    let favorites = null;
    try {
      favorites = await notifications.scanFavoriteTeamsToday({ dryRun });
    } catch (favErr) {
      logger.warn('favorite-teams scan failed: ' + (favErr?.message || favErr));
    }

    res.json({ ...result, favorites });
  } catch (e) {
    logger.error('scan-new-vbs failed: ' + (e?.stack || e?.message || e));
    res.status(500).json({ error: 'Scan failed', message: e?.message });
  }
});

// Standalone favorite-team scan — handy for manual testing / a dedicated
// UptimeRobot monitor. ?force=1 ignores the daytime hour gate.
router.get('/scan-favorite-teams', authScan, async (req, res) => {
  try {
    const dryRun = req.query.dry === '1';
    const ignoreHourGate = req.query.force === '1';
    const date = typeof req.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
      ? req.query.date
      : null;
    const result = await notifications.scanFavoriteTeamsToday({ date, dryRun, ignoreHourGate });
    res.json(result);
  } catch (e) {
    logger.error('scan-favorite-teams failed: ' + (e?.stack || e?.message || e));
    res.status(500).json({ error: 'Scan failed', message: e?.message });
  }
});

// Manual reset for the "already-notified" set — useful when testing or
// after an algorithm tweak that should re-evaluate everything. Available
// in both GET (easier to hit from a browser) and POST.
const handleReset = (req, res) => {
  notifications.resetNotifiedKeys();
  res.json({ ok: true, status: notifications.getStatus() });
};
router.get('/reset-state', authScan, handleReset);
router.post('/reset-state', authScan, handleReset);

module.exports = router;
