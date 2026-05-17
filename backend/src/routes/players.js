const express = require('express');
const router = express.Router();
const api = require('../services/apiFootball');

router.get('/search', async (req, res, next) => {
  try {
    res.json(await api.searchPlayers(req.query.name));
  } catch (err) { next(err); }
});

router.get('/topscorers', async (req, res, next) => {
  try {
    const { league, season } = req.query;
    res.json(await api.getTopScorers(league || 39, season || 2024));
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    res.json(await api.getPlayer(req.params.id, req.query.season || 2025));
  } catch (err) { next(err); }
});

router.get('/:id/seasons', async (req, res, next) => {
  try {
    res.json(await api.getPlayerSeasons(req.params.id));
  } catch (err) { next(err); }
});

router.get('/:id/trophies', async (req, res, next) => {
  try {
    res.json(await api.getPlayerTrophies(req.params.id));
  } catch (err) { next(err); }
});

router.get('/:id/transfers', async (req, res, next) => {
  try {
    res.json(await api.getPlayerTransfers(req.params.id));
  } catch (err) { next(err); }
});

module.exports = router;
