const express = require('express');
const router = express.Router();
const api = require('../services/apiFootball');
const analysisService = require('../services/analysisService');

router.get('/:fixtureId', async (req, res, next) => {
  try {
    const { fixtureId } = req.params;
    const data = await api.getPredictions(fixtureId);
    const prediction = data.response?.[0];

    if (!prediction) return res.json({ response: [], results: 0 });

    const analyzed = analysisService.analyzePredictions(prediction);
    res.json({ response: [{ ...prediction, analysis: analyzed }], results: 1 });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
