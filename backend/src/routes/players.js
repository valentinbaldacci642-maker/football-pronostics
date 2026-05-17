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

router.get('/:id/sidelined', async (req, res, next) => {
  try {
    res.json(await api.getPlayerSidelined(req.params.id));
  } catch (err) { next(err); }
});

// Carrière : appelle getPlayer pour chaque saison et combine les résultats.
// Bornée à 12 saisons max pour ne pas exploser le quota. Chaque saison
// individuelle est cachée (ttlTeams = 2h) côté apiFootball, donc seul le
// 1er chargement est lent — les suivants sont quasi-instantanés.
router.get('/:id/career', async (req, res, next) => {
  try {
    const playerId = req.params.id;
    const seasonsRes = await api.getPlayerSeasons(playerId);
    const seasons = (seasonsRes?.response || [])
      .filter((y) => Number.isInteger(y))
      .sort((a, b) => b - a)
      .slice(0, 12);
    if (seasons.length === 0) return res.json({ response: [], seasons: [] });
    const results = await Promise.allSettled(seasons.map((y) => api.getPlayer(playerId, y)));
    const career = [];
    results.forEach((r, i) => {
      if (r.status !== 'fulfilled') return;
      const p = r.value?.response?.[0];
      if (!p?.statistics) return;
      p.statistics.forEach((s) => career.push({ season: seasons[i], ...s }));
    });
    res.json({ response: career, seasons });
  } catch (err) { next(err); }
});

// Derniers matchs joués par le joueur pour la saison donnée.
// Stratégie : on récupère les équipes du joueur sur la saison, puis
// pour chaque équipe on liste les ~limit derniers matchs et on extrait
// les stats du joueur via /fixtures/players. Bornée à 20 matchs.
router.get('/:id/recent-matches', async (req, res, next) => {
  try {
    const playerId = parseInt(req.params.id);
    const season = parseInt(req.query.season) || new Date().getFullYear();
    const limit = Math.min(parseInt(req.query.limit) || 15, 20);

    const playerData = await api.getPlayer(playerId, season);
    const stats = playerData?.response?.[0]?.statistics || [];
    const teamIds = [...new Set(stats.map((s) => s.team?.id).filter(Boolean))];
    if (teamIds.length === 0) return res.json({ response: [] });

    // On collecte les fixtures de toutes ses équipes saison, on trie
    // descendant par date, et on prend les `limit` plus récents.
    const fixturesResults = await Promise.allSettled(
      teamIds.map((tid) => api.getFixtures({ team: tid, season, last: limit })),
    );
    const allFixtures = [];
    fixturesResults.forEach((r) => {
      if (r.status === 'fulfilled') {
        (r.value?.response || []).forEach((f) => allFixtures.push(f));
      }
    });
    allFixtures.sort((a, b) => new Date(b.fixture.date) - new Date(a.fixture.date));
    const recent = allFixtures.slice(0, limit);

    // Pour chaque fixture, on extrait les stats du joueur. On parallélise
    // mais on limite à 5 simultanés pour rester gentil avec le throttler.
    const out = [];
    for (let i = 0; i < recent.length; i += 5) {
      const slice = recent.slice(i, i + 5);
      // eslint-disable-next-line no-await-in-loop
      const chunk = await Promise.allSettled(slice.map((f) => api.getFixturePlayers(f.fixture.id)));
      chunk.forEach((r, j) => {
        const fixture = slice[j];
        if (r.status !== 'fulfilled') {
          out.push({ fixture, stats: null });
          return;
        }
        const teams = r.value?.response || [];
        let pStats = null;
        for (const t of teams) {
          const found = (t.players || []).find((p) => p.player?.id === playerId);
          if (found) { pStats = found.statistics?.[0] || null; break; }
        }
        out.push({ fixture, stats: pStats });
      });
    }
    res.json({ response: out });
  } catch (err) { next(err); }
});

module.exports = router;
