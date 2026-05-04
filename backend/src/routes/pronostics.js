const express = require('express');
const router = express.Router();
const pronosticsService = require('../services/pronosticsService');

router.get('/today', async (req, res, next) => {
  try {
    const force = req.query.force === '1';
    const data = await pronosticsService.getBestPronostics(force);
    res.json({ data, count: data.length });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
