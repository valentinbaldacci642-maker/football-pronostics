const express = require('express');
const router = express.Router();
const api = require('../services/apiFootball');

router.get('/top', async (req, res, next) => {
  try {
    const leagues = await api.getTopLeagues();
    res.json({ response: leagues, results: leagues.length });
  } catch (err) { next(err); }
});

router.get('/standings', async (req, res, next) => {
  try {
    const { league, season } = req.query;
    res.json(await api.getStandings(league, season));
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    res.json(await api.getLeagueById(req.params.id));
  } catch (err) { next(err); }
});

router.get('/', async (req, res, next) => {
  try {
    const { country, name, code, season, current } = req.query;
    const params = {};
    if (country) params.country = country;
    if (name) params.name = name;
    if (code) params.code = code;
    if (season) params.season = parseInt(season);
    if (current) params.current = current;
    res.json(await api.getLeagues(params));
  } catch (err) { next(err); }
});

module.exports = router;
