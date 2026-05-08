const express = require('express');
const router = express.Router();
const api = require('../services/apiFootball');
const cache = require('../utils/cache');
const logger = require('../utils/logger');

router.get('/', async (req, res, next) => {
  try {
    const { date, league, season, team, live, status, from, to, round, ids, last, next } = req.query;
    const params = {};

    if (live === 'true' || live === 'all') return res.json(await api.getLiveFixtures());
    if (date) params.date = date;
    if (league) params.league = parseInt(league);
    if (season) params.season = parseInt(season);
    if (team) params.team = parseInt(team);
    if (status) params.status = status;
    if (from) params.from = from;
    if (to) params.to = to;
    if (round) params.round = round;
    if (ids) params.ids = ids;
    if (last) params.last = parseInt(last);
    if (next) params.next = parseInt(next);

    const data = await api.getFixtures(params);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/live', async (req, res, next) => {
  try {
    res.json(await api.getLiveFixtures());
  } catch (err) {
    next(err);
  }
});

router.get('/today', async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { league } = req.query;
    // No season param — let API auto-detect; sending season restricts free plan
    const data = await api.getFixturesByDate(today, league, null);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/tomorrow', async (req, res, next) => {
  try {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const { league } = req.query;
    const data = await api.getFixturesByDate(tomorrow, league, null);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    // ?fresh=1 bypasses the 20min cache — used by the bet resolver when it
    // needs an authoritative finished/not status. Without it, a stale 'live'
    // entry from earlier in the match could block resolution for up to 20min
    // after the match has actually concluded.
    if (req.query.fresh === '1') {
      cache.del(cache.buildKey('api', '/fixtures', JSON.stringify({ id: req.params.id })));
    }
    res.json(await api.getFixtureById(req.params.id));
  } catch (err) {
    next(err);
  }
});

router.get('/:id/statistics', async (req, res, next) => {
  try {
    res.json(await api.getFixtureStatistics(req.params.id));
  } catch (err) {
    next(err);
  }
});

router.get('/:id/events', async (req, res, next) => {
  try {
    res.json(await api.getFixtureEvents(req.params.id));
  } catch (err) {
    next(err);
  }
});

router.get('/:id/lineups', async (req, res, next) => {
  try {
    res.json(await api.getFixtureLineups(req.params.id));
  } catch (err) {
    next(err);
  }
});

router.get('/h2h/:team1/:team2', async (req, res, next) => {
  try {
    const { team1, team2 } = req.params;
    const { last } = req.query;
    res.json(await api.getH2H(`${team1}-${team2}`, last || 10));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
