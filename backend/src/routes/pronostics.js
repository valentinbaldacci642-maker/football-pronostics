const express = require('express');
const router = express.Router();
const pronosticsService = require('../services/pronosticsService');

router.get('/today', async (req, res, next) => {
  try {
    const data = await pronosticsService.getBestPronostics();
    res.json({ data, count: data.length });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
