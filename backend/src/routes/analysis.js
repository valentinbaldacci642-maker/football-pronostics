const express = require('express');
const router = express.Router();
const api = require('../services/apiFootball');
const analysisService = require('../services/analysisService');

router.get('/fixture/:fixtureId', async (req, res, next) => {
  try {
    const { fixtureId } = req.params;

    const [fixtureData, oddsData, predData] = await Promise.allSettled([
      api.getFixtureById(fixtureId),
      api.getOddsByFixture(fixtureId),
      api.getPredictions(fixtureId),
    ]);

    const fixture = fixtureData.status === 'fulfilled' ? fixtureData.value.response?.[0] : null;
    const oddsRaw = oddsData.status === 'fulfilled' ? oddsData.value.response?.[0] : null;
    const predRaw = predData.status === 'fulfilled' ? predData.value.response?.[0] : null;

    const oddsAnalysis = oddsRaw ? analysisService.analyzeFixtureOdds(oddsRaw) : null;
    const predAnalysis = predRaw ? analysisService.analyzePredictions(predRaw) : null;

    const full = analysisService.buildFullAnalysis(oddsAnalysis, predAnalysis, fixture);

    res.json({ data: full, fixtureId });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
