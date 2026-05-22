const express = require('express');
const router = express.Router();
const weather = require('../services/weatherService');
const logger = require('../utils/logger');

// Météo-France vigilance for a point (proxies MeteoAlarm, which has no CORS).
// GET /weather/vigilance?lat=..&lon=..  (or ?dep=Nom)
router.get('/vigilance', async (req, res) => {
  try {
    let dep = typeof req.query.dep === 'string' && req.query.dep.trim() ? req.query.dep.trim() : null;
    if (!dep) {
      const lat = parseFloat(req.query.lat);
      const lon = parseFloat(req.query.lon);
      if (Number.isFinite(lat) && Number.isFinite(lon)) dep = await weather.reverseDept(lat, lon);
    }
    if (!dep) return res.json({ department: null, warnings: [] });
    const warnings = await weather.getVigilance(dep);
    res.json({ department: dep, warnings });
  } catch (e) {
    logger.warn('vigilance failed: ' + (e?.message || e));
    res.json({ department: null, warnings: [] }); // fail-soft: never break the UI
  }
});

module.exports = router;
