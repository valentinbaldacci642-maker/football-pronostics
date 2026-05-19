const express = require('express');
const router = express.Router();
const api = require('../services/apiFootball');
const cache = require('../utils/cache');
const logger = require('../utils/logger');

router.get('/', async (req, res, next) => {
  try {
    const { date, league, season, team, live, status, from, to, round, ids, last, next, timezone } = req.query;
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
    if (timezone) params.timezone = timezone;

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
    const { league, timezone } = req.query;
    // When a client-supplied timezone is provided, use the date *in that
    // zone* so a Paris user querying at 00:30 doesn't get yesterday's UTC
    // date — they expect "today" to mean today in their wall-clock.
    const today = todayInZone(timezone);
    // No season param — let API auto-detect; sending season restricts free plan
    const data = await api.getFixturesByDate(today, league, null, timezone);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/tomorrow', async (req, res, next) => {
  try {
    const { league, timezone } = req.query;
    const tomorrow = todayInZone(timezone, 1);
    const data = await api.getFixturesByDate(tomorrow, league, null, timezone);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * Returns the local-date string (YYYY-MM-DD) in the given IANA timezone,
 * optionally offset by `deltaDays`. Falls back to UTC date if zone is
 * missing or invalid.
 */
function todayInZone(zone, deltaDays = 0) {
  const now = new Date(Date.now() + deltaDays * 86400000);
  if (!zone) return now.toISOString().split('T')[0];
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(now);
    const y = parts.find((p) => p.type === 'year').value;
    const m = parts.find((p) => p.type === 'month').value;
    const d = parts.find((p) => p.type === 'day').value;
    return `${y}-${m}-${d}`;
  } catch (_) {
    return now.toISOString().split('T')[0];
  }
}

router.get('/:id', async (req, res) => {
  try {
    if (req.query.fresh === '1') {
      cache.del(cache.buildKey('api', '/fixtures', JSON.stringify({ id: req.params.id })));
    }
    res.json(await api.getFixtureById(req.params.id));
  } catch (err) {
    // Au lieu de renvoyer 500 (qui casse le frontend), on log et retourne
    // une réponse vide → le frontend affiche 'match introuvable' / charge
    // dégradé au lieu d'une page d'erreur.
    // Strip CRLF + truncate so a crafted ?id=...%0A[FAKE LINE] can't
    // forge log entries that confuse log review or external aggregators.
    const safeId = String(req.params.id).replace(/[\r\n]/g, '_').slice(0, 50);
    logger.error(`getFixtureById(${safeId}) failed: ${err?.message}`);
    res.json({ response: [], results: 0, paging: {}, errors: {} });
  }
});

// ?fresh=1 evicts the 20-min fixture cache before fetching. Used by the
// frontend during live-match polling so the displayed minute/score/events
// actually advance instead of being frozen at first-load value.
router.get('/:id/statistics', async (req, res, next) => {
  try {
    if (req.query.fresh === '1') {
      cache.del(cache.buildKey('api', '/fixtures/statistics', JSON.stringify({ fixture: req.params.id })));
    }
    res.json(await api.getFixtureStatistics(req.params.id));
  } catch (err) {
    next(err);
  }
});

router.get('/:id/events', async (req, res, next) => {
  try {
    if (req.query.fresh === '1') {
      cache.del(cache.buildKey('api', '/fixtures/events', JSON.stringify({ fixture: req.params.id })));
    }
    res.json(await api.getFixtureEvents(req.params.id));
  } catch (err) {
    next(err);
  }
});

router.get('/:id/lineups', async (req, res, next) => {
  try {
    if (req.query.fresh === '1') {
      cache.del(cache.buildKey('api', '/fixtures/lineups', JSON.stringify({ fixture: req.params.id })));
    }
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
