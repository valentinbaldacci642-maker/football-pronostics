const express = require('express');
const router = express.Router();
const pronosticsService = require('../services/pronosticsService');

router.get('/today', async (req, res, next) => {
  try {
    const force = req.query.force === '1';
    // Optional ?date=YYYY-MM-DD lets the client request a future day's pronostics.
    // Defaults to today when absent.
    const date = typeof req.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
      ? req.query.date
      : null;
    const timezone = typeof req.query.timezone === 'string' ? req.query.timezone : null;
    const data = await pronosticsService.getBestPronostics(force, date, timezone);
    // Marker so we can verify which backend version is live by inspecting
    // the response. Increment when changing the scan algorithm.
    res.json({
      data,
      count: data.length,
      date: date || new Date().toISOString().split('T')[0],
      engine: 'lite-scan-v13-classic-pick',
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
