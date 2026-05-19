const express = require('express');
const router = express.Router();
const notifications = require('../services/notificationsService');
const logger = require('../utils/logger');
const adminAuth = require('../middleware/adminAuth');

// Fail-closed: secret must be set, comparison is constant-time. UptimeRobot
// free tier needs query-string auth (no custom headers), so allowQueryKey.
const authScan = adminAuth({ allowQueryKey: true });

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
    // minEdge in percentage points (e.g. 6 = 6%). Default 6.
    const minEdge = Number.isFinite(parseFloat(req.query.minEdge))
      ? parseFloat(req.query.minEdge)
      : 6;
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
