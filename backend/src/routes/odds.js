const express = require('express');
const router = express.Router();
const api = require('../services/apiFootball');
const analysisService = require('../services/analysisService');

router.get('/', async (req, res, next) => {
  try {
    const { fixture, league, season, date, bookmaker, bet } = req.query;
    const params = {};
    if (fixture) params.fixture = parseInt(fixture);
    if (league) params.league = parseInt(league);
    if (season) params.season = parseInt(season);
    if (date) params.date = date;
    if (bookmaker) params.bookmaker = parseInt(bookmaker);
    if (bet) params.bet = parseInt(bet);

    const data = await api.getOdds(params);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/fixture/:fixtureId', async (req, res, next) => {
  try {
    const { fixtureId } = req.params;
    const data = await api.getOddsByFixture(fixtureId);
    const oddsData = data.response?.[0];

    if (!oddsData) return res.json({ response: [], results: 0, analysis: null });

    const analysis = analysisService.analyzeFixtureOdds(oddsData);
    res.json({ response: data.response, results: data.results, analysis });
  } catch (err) {
    next(err);
  }
});

router.get('/live', async (req, res, next) => {
  try {
    const { fixture } = req.query;
    res.json(await api.getOddsLive(fixture));
  } catch (err) {
    next(err);
  }
});

router.get('/bookmakers', async (req, res, next) => {
  try {
    res.json(await api.getBookmakers());
  } catch (err) {
    next(err);
  }
});

router.get('/bets', async (req, res, next) => {
  try {
    res.json(await api.getOddsBets());
  } catch (err) {
    next(err);
  }
});

module.exports = router;
