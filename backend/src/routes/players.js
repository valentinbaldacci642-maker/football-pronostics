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

// Matchs joués par le joueur.
// - Si `?season=YYYY` fourni : seulement cette saison.
// - Sinon : TOUTES les saisons connues du joueur (peut prendre 30-60s
//   au 1er appel à cause du volume d'appels API ; le cache 2h fait que
//   les visites suivantes sont quasi-instantanées).
// Limite plafonnée à 500 matchs pour éviter un cas pathologique.
router.get('/:id/recent-matches', async (req, res, next) => {
  try {
    const playerId = parseInt(req.params.id);
    const hardCap = Math.min(parseInt(req.query.limit) || 500, 500);

    // Détermine la liste des saisons à charger
    let seasons = [];
    if (req.query.season) {
      seasons = [parseInt(req.query.season)];
    } else {
      const seasonsRes = await api.getPlayerSeasons(playerId);
      seasons = (seasonsRes?.response || []).filter((y) => Number.isInteger(y)).sort((a, b) => b - a);
    }
    if (seasons.length === 0) return res.json({ response: [] });

    // Pour chaque saison, on récupère les équipes du joueur puis les
    // fixtures de chaque équipe sur la saison.
    const allFixtures = [];
    for (const season of seasons) {
      // eslint-disable-next-line no-await-in-loop
      const playerData = await api.getPlayer(playerId, season);
      const stats = playerData?.response?.[0]?.statistics || [];
      const teamIds = [...new Set(stats.map((s) => s.team?.id).filter(Boolean))];
      if (teamIds.length === 0) continue;

      // eslint-disable-next-line no-await-in-loop
      const fixturesResults = await Promise.allSettled(
        // pas de paramètre `last` → toutes les fixtures de l'équipe sur la saison
        teamIds.map((tid) => api.getFixtures({ team: tid, season })),
      );
      fixturesResults.forEach((r) => {
        if (r.status === 'fulfilled') {
          (r.value?.response || []).forEach((f) => allFixtures.push(f));
        }
      });
    }

    // Dédoublonne (un même match peut apparaître pour 2 équipes du
    // joueur si transferred mid-season), trie desc, plafonne.
    const seen = new Set();
    const unique = [];
    allFixtures
      .sort((a, b) => new Date(b.fixture.date) - new Date(a.fixture.date))
      .forEach((f) => {
        const fid = f.fixture?.id;
        if (!fid || seen.has(fid)) return;
        seen.add(fid);
        unique.push(f);
      });
    const limited = unique.slice(0, hardCap);

    // Pour chaque fixture, on extrait les stats du joueur via
    // /fixtures/players. Parallélisé par lots de 5 pour ne pas saturer
    // le throttler upstream.
    const out = [];
    for (let i = 0; i < limited.length; i += 5) {
      const slice = limited.slice(i, i + 5);
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
