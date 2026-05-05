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

    // Fetch full-season team stats so xG / Poisson uses season averages, not last_5
    const homeId = fixture?.teams?.home?.id;
    const awayId = fixture?.teams?.away?.id;
    const leagueId = fixture?.league?.id;
    const season = fixture?.league?.season;
    let teamStats = null;
    let lineupContext = null;
    if (homeId && awayId && leagueId && season) {
      const [homeStatsData, awayStatsData, lineupsData, scorersData] = await Promise.allSettled([
        api.getTeamStatistics(homeId, season, leagueId),
        api.getTeamStatistics(awayId, season, leagueId),
        api.getFixtureLineups(fixtureId),
        api.getTopScorers(leagueId, season),
      ]);
      const extract = (s) => {
        if (s.status !== 'fulfilled') return null;
        const r = s.value.response;
        if (Array.isArray(r)) return r[0] || null;
        return r && typeof r === 'object' ? r : null;
      };
      teamStats = { home: extract(homeStatsData), away: extract(awayStatsData) };

      // Lineup-aware xG adjustment: same logic as pronosticsService
      const lineups = lineupsData?.status === 'fulfilled' ? (lineupsData.value.response || []) : [];
      const topScorers = scorersData?.status === 'fulfilled' ? (scorersData.value.response || []) : [];
      const pronosticsService = require('../services/pronosticsService');
      lineupContext = pronosticsService._computeLineupContext(lineups, topScorers, homeId, awayId);
    }

    const oddsAnalysis = oddsRaw ? analysisService.analyzeFixtureOdds(oddsRaw) : null;
    const predAnalysis = predRaw ? analysisService.analyzePredictions(predRaw, teamStats, lineupContext) : null;

    const full = analysisService.buildFullAnalysis(oddsAnalysis, predAnalysis, fixture);

    res.json({ data: full, fixtureId });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
