const express = require('express');
const router = express.Router();
const scorerService = require('../services/scorerService');
const logger = require('../utils/logger');

router.get('/:fixtureId', async (req, res, next) => {
  try {
    const { fixtureId } = req.params;
    const data = await scorerService.buildScorerPredictions(fixtureId);
    if (!data) return res.status(404).json({ error: 'Fixture not found' });
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
