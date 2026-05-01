const express = require('express');
const router = express.Router();
const api = require('../services/apiFootball');

router.get('/search', async (req, res, next) => {
  try {
    res.json(await api.searchTeams(req.query.name));
  } catch (err) { next(err); }
});

router.get('/:id/squad', async (req, res, next) => {
  try {
    res.json(await api.getTeamSquad(req.params.id));
  } catch (err) { next(err); }
});

router.get('/:id/injuries', async (req, res, next) => {
  try {
    const { season } = req.query;
    res.json(await api.getTeamInjuries(req.params.id, season));
  } catch (err) { next(err); }
});

router.get('/:id/transfers', async (req, res, next) => {
  try {
    res.json(await api.getTransfers(req.params.id));
  } catch (err) { next(err); }
});

router.get('/:id/statistics', async (req, res, next) => {
  try {
    const { season, league } = req.query;
    res.json(await api.getTeamStatistics(req.params.id, season, league));
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    res.json(await api.getTeam(req.params.id));
  } catch (err) { next(err); }
});

module.exports = router;
