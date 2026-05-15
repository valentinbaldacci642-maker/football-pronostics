const express = require('express');
const router = express.Router();
const notifications = require('../services/notificationsService');
const logger = require('../utils/logger');

// Shared secret protects the scan endpoint from public spam. UptimeRobot
// passes it via query param (?key=…) since the free tier doesn't support
// custom headers. Set NOTIFICATIONS_SCAN_SECRET on Render.
function authScan(req, res, next) {
  const expected = process.env.NOTIFICATIONS_SCAN_SECRET;
  if (!expected) {
    // Pas de secret configuré → on accepte (mode dev / pas encore set up).
    // En prod le secret DOIT être défini.
    return next();
  }
  const provided = req.query.key || req.headers['x-scan-key'];
  if (provided !== expected) return res.status(401).json({ error: 'Invalid scan key' });
  return next();
}

router.post('/register', (req, res) => {
  const { token, platform } = req.body || {};
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'token is required' });
  }
  const ok = notifications.registerToken(token, platform);
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
    // minEdge in percentage points (e.g. 7 = 7%). Default 7.
    const minEdge = Number.isFinite(parseFloat(req.query.minEdge))
      ? parseFloat(req.query.minEdge)
      : 7;
    const dryRun = req.query.dry === '1';
    const date = typeof req.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
      ? req.query.date
      : null;
    const result = await notifications.scanAndNotify({ minEdge, date, dryRun });
    res.json(result);
  } catch (e) {
    logger.error('scan-new-vbs failed: ' + (e?.stack || e?.message || e));
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
