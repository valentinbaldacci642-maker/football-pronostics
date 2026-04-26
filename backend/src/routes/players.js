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
    res.json(await api.getPlayer(req.params.id, req.query.season || 2024));
  } catch (err) { next(err); }
});

module.exports = router;
