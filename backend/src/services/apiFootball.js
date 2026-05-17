const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');
const cache = require('../utils/cache');

/**
 * Outbound rate limiter for API-Football. Two safeguards:
 *  1) Sliding-window cap (max 280 / 60s) — backstop matching their per-min quota.
 *  2) Minimum gap between consecutive requests (240ms) — prevents bursts that
 *     would technically fit the 60s window but exceed their per-second tolerance.
 *
 * Cache hits bypass the limiter (no API call → no quota consumed). On a hot
 * cache the limiter is invisible; on a cold burst (e.g. opening MatchDetail
 * fires 7 calls), each request is paced ~240ms apart, capping us at ~4 req/s
 * sustained — well below the 300/min ceiling without bursting.
 */
class OutboundRateLimiter {
  constructor(maxPerMinute = 280, minGapMs = 240) {
    this.max = maxPerMinute;
    this.windowMs = 60_000;
    this.minGapMs = minGapMs;
    this.timestamps = [];   // monotonic timestamps of recent calls
    this.queue = [];        // pending acquire() resolvers, FIFO
    this.processing = false;
  }

  acquire() {
    return new Promise((resolve) => {
      this.queue.push(resolve);
      this._tick();
    });
  }

  _tick() {
    if (this.processing) return;
    this.processing = true;
    queueMicrotask(() => this._drain());
  }

  _drain() {
    this.processing = false;
    if (this.queue.length === 0) return;
    const now = Date.now();
    const cutoff = now - this.windowMs;
    while (this.timestamps.length && this.timestamps[0] <= cutoff) {
      this.timestamps.shift();
    }

    // Check minimum gap from last request
    const lastTs = this.timestamps.length ? this.timestamps[this.timestamps.length - 1] : 0;
    const gapWait = lastTs ? Math.max(0, (lastTs + this.minGapMs) - now) : 0;

    if (this.timestamps.length < this.max && gapWait === 0) {
      this.timestamps.push(now);
      const resolve = this.queue.shift();
      resolve();
      if (this.queue.length > 0) this._tick();
      return;
    }

    // Either window full or gap not elapsed — wait for the relevant condition
    const windowWait = this.timestamps.length >= this.max
      ? (this.timestamps[0] + this.windowMs) - now + 5
      : 0;
    const waitMs = Math.max(gapWait, windowWait, 10);
    setTimeout(() => this._drain(), waitMs);
  }
}

class ApiFootballService {
  constructor() {
    this.quotaRemaining = null;
    this.quotaLimit = 100;
    // When the API rejects us with a rate-limit error, remember the timestamp
    // so we can short-circuit subsequent calls instead of hammering and burning
    // through the per-minute window. Window is API-Football's 60s rolling.
    this.rateLimitedUntil = 0;
    // Outbound throttle: 420 req/min + 150ms gap = ~6.6 req/s sustained.
    // API-Football Ultra plan: 450 req/min ceiling, so 420 leaves a ~7%
    // safety margin. Tightened to speed up the 14-day "Actualiser tout"
    // bulk refresh. Cache hits skip this entirely.
    this.limiter = new OutboundRateLimiter(420, 150);

    this.client = axios.create({
      baseURL: config.api.baseUrl,
      timeout: config.api.timeout,
      headers: {
        'x-apisports-key': config.api.key,
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.request.use((req) => {
      logger.debug(`→ API Request: ${req.method?.toUpperCase()} ${req.url} ${JSON.stringify(req.params || {})}`);
      return req;
    });

    this.client.interceptors.response.use(
      (res) => {
        const remaining = res.headers['x-ratelimit-requests-remaining'];
        const limit = res.headers['x-ratelimit-requests-limit'];
        // Per-minute (or per-second) burst limit headers, when API exposes them
        this.minuteLimit = res.headers['x-ratelimit-limit'];
        this.minuteRemaining = res.headers['x-ratelimit-remaining'];
        if (remaining !== undefined) {
          this.quotaRemaining = parseInt(remaining);
          if (limit) this.quotaLimit = parseInt(limit);
          logger.info(`API Quota: ${remaining}/${limit || '?'} jour · ${this.minuteRemaining ?? '?'}/${this.minuteLimit ?? '?'} min`);
          if (this.quotaRemaining < 10) {
            logger.warn(`⚠️  Quota critique: ${remaining} requêtes restantes aujourd'hui!`);
          }
        }
        return res;
      },
      (err) => {
        logger.error(`✗ API Error: ${err.response?.status} ${err.message}`);
        throw err;
      }
    );
  }

  getQuotaInfo() {
    return {
      day: {
        remaining: this.quotaRemaining,
        limit: this.quotaLimit,
        used: this.quotaRemaining !== null ? this.quotaLimit - this.quotaRemaining : null,
      },
      minute: {
        remaining: this.minuteRemaining ? parseInt(this.minuteRemaining) : null,
        limit: this.minuteLimit ? parseInt(this.minuteLimit) : null,
      },
      rateLimitedUntil: this.rateLimitedUntil > Date.now() ? this.rateLimitedUntil : null,
    };
  }

  async request(endpoint, params = {}, ttl) {
    const cacheKey = cache.buildKey('api', endpoint, JSON.stringify(params));
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    // Short-circuit during a known rate-limit window to avoid burning more
    // requests against an API that's already saying no. The 60s window is
    // a conservative match for API-Football's per-minute limit.
    if (this.rateLimitedUntil > Date.now()) {
      const err = new Error('API rate limit hit, retry in a few seconds');
      err.code = 'RATE_LIMITED';
      err.retryAfterMs = this.rateLimitedUntil - Date.now();
      throw err;
    }

    // Block until the outbound limiter has headroom (stays under 295/min).
    // Most calls pass through immediately; only bursts beyond the budget
    // pay the queue cost.
    await this.limiter.acquire();

    const { data } = await this.client.get(endpoint, { params });

    const errors = data.errors || {};
    const hasErrors = errors && Object.keys(errors).length > 0;
    const isRateLimit = !!errors.rateLimit;
    if (hasErrors) {
      logger.warn(`API returned errors for ${endpoint}:`, errors);
    }
    if (isRateLimit) {
      // Block further requests for 30s — half the API window — to give the
      // upstream limit a chance to recover before we try again.
      this.rateLimitedUntil = Date.now() + 30_000;
      const err = new Error('API rate limit hit, retry in a few seconds');
      err.code = 'RATE_LIMITED';
      err.retryAfterMs = 30_000;
      throw err;
    }

    const result = {
      response: data.response || [],
      results: data.results || 0,
      paging: data.paging || {},
      errors,
    };

    // Don't cache empty / errored responses (especially rate-limit ones).
    // Otherwise a single rate-limit hit poisons the cache for hours and a
    // legitimate team / fixture appears 'introuvable' until cache expiry.
    const isEmpty = !data.response || (Array.isArray(data.response) && data.response.length === 0);
    if (!hasErrors && !isEmpty) {
      cache.set(cacheKey, result, ttl || config.cache.ttl);
    }
    return result;
  }

  // ─── Fixtures ─────────────────────────────────────────────────────────────
  async getFixtures(params) {
    return this.request('/fixtures', params, config.cache.ttlFixtures);
  }

  async getLiveFixtures() {
    return this.request('/fixtures', { live: 'all' }, config.cache.ttlLive);
  }

  async getFixtureById(id) {
    return this.request('/fixtures', { id }, config.cache.ttlFixtures);
  }

  async getFixturesByDate(date, league, season, timezone) {
    const params = { date };
    if (league) params.league = league;
    if (season) params.season = season;
    // Without a timezone, API-Football groups matches by UTC date — a
    // kickoff at 22:00 UTC on day D is listed under D, but in Paris it's
    // already 00:00 of D+1, so the user sees it under the wrong day in
    // their app. Passing timezone makes API-Football group correctly.
    if (timezone) params.timezone = timezone;
    return this.request('/fixtures', params, config.cache.ttlFixtures);
  }

  async getH2H(h2h, last = 10) {
    return this.request('/fixtures/headtohead', { h2h, last }, config.cache.ttlTeams);
  }

  async getFixtureStatistics(fixtureId) {
    return this.request('/fixtures/statistics', { fixture: fixtureId }, config.cache.ttlFixtures);
  }

  async getFixtureEvents(fixtureId) {
    return this.request('/fixtures/events', { fixture: fixtureId }, config.cache.ttlFixtures);
  }

  async getFixtureLineups(fixtureId) {
    return this.request('/fixtures/lineups', { fixture: fixtureId }, config.cache.ttlFixtures);
  }

  // ─── Predictions ──────────────────────────────────────────────────────────
  async getPredictions(fixtureId) {
    return this.request('/predictions', { fixture: fixtureId }, config.cache.ttlFixtures);
  }

  // ─── Odds ─────────────────────────────────────────────────────────────────
  async getOdds(params) {
    return this.request('/odds', params, config.cache.ttlOdds);
  }

  async getOddsByFixture(fixtureId) {
    return this.request('/odds', { fixture: fixtureId }, config.cache.ttlOdds);
  }

  async getOddsLive(fixtureId) {
    return this.request('/odds/live', fixtureId ? { fixture: fixtureId } : {}, config.cache.ttlLive);
  }

  async getBookmakers() {
    return this.request('/odds/bookmakers', {}, config.cache.ttlLeagues);
  }

  async getOddsBets() {
    return this.request('/odds/bets', {}, config.cache.ttlLeagues);
  }

  // ─── Teams ────────────────────────────────────────────────────────────────
  async getTeam(teamId) {
    return this.request('/teams', { id: teamId }, config.cache.ttlTeams);
  }

  async searchTeams(name) {
    return this.request('/teams', { search: name }, config.cache.ttlTeams);
  }

  async getTeamStatistics(teamId, season, leagueId) {
    return this.request('/teams/statistics', {
      team: teamId, season, league: leagueId,
    }, config.cache.ttlTeams);
  }

  async getTeamSeasons(teamId) {
    return this.request('/teams/seasons', { team: teamId }, config.cache.ttlTeams);
  }

  // ─── Leagues ──────────────────────────────────────────────────────────────
  async getLeagues(params = {}) {
    return this.request('/leagues', params, config.cache.ttlLeagues);
  }

  async getLeagueById(id) {
    return this.request('/leagues', { id }, config.cache.ttlLeagues);
  }

  async getTopLeagues() {
    const topIds = [39, 140, 78, 135, 61, 2, 3, 1];
    const results = await Promise.allSettled(topIds.map((id) => this.getLeagueById(id)));
    return results
      .filter((r) => r.status === 'fulfilled' && r.value.response.length > 0)
      .map((r) => r.value.response[0]);
  }

  // ─── Standings ────────────────────────────────────────────────────────────
  async getStandings(leagueId, season) {
    return this.request('/standings', { league: leagueId, season }, config.cache.ttlTeams);
  }

  // ─── Players ──────────────────────────────────────────────────────────────
  async getTopScorers(leagueId, season) {
    return this.request('/players/topscorers', { league: leagueId, season }, config.cache.ttlTeams);
  }

  async getPlayer(playerId, season) {
    return this.request('/players', { id: playerId, season }, config.cache.ttlTeams);
  }

  async searchPlayers(name) {
    return this.request('/players', { search: name }, config.cache.ttlTeams);
  }

  // Liste des saisons jouées par un joueur (utile pour afficher un picker
  // dans la fiche joueur). Cache long (1 jour) car ça change rarement.
  async getPlayerSeasons(playerId) {
    return this.request('/players/seasons', { player: playerId }, config.cache.ttlLeagues);
  }

  async getPlayerTrophies(playerId) {
    return this.request('/trophies', { player: playerId }, config.cache.ttlTeams);
  }

  async getPlayerTransfers(playerId) {
    return this.request('/transfers', { player: playerId }, config.cache.ttlTeams);
  }

  // Historique blessures / absences (suspensions, manque de condition, etc.).
  async getPlayerSidelined(playerId) {
    return this.request('/sidelined', { player: playerId }, config.cache.ttlTeams);
  }

  // Stats par match du joueur pour la saison donnée. Récupère les
  // statistiques détaillées (note, minutes, buts, passes, cartons) pour
  // chaque match joué par le joueur au sein d'une équipe sur cette saison.
  async getFixturePlayers(fixtureId) {
    return this.request('/fixtures/players', { fixture: fixtureId }, config.cache.ttlFixtures);
  }

  // ─── Squad ────────────────────────────────────────────────────────────────
  async getTeamSquad(teamId) {
    return this.request('/players/squads', { team: teamId }, config.cache.ttlTeams);
  }

  // ─── Injuries ─────────────────────────────────────────────────────────────
  async getInjuries(fixtureId) {
    return this.request('/injuries', { fixture: fixtureId }, config.cache.ttlFixtures);
  }

  async getTeamInjuries(teamId, season = 2024) {
    return this.request('/injuries', { team: teamId, season }, config.cache.ttlTeams);
  }

  // ─── Transfers ────────────────────────────────────────────────────────────
  async getTransfers(teamId) {
    return this.request('/transfers', { team: teamId }, config.cache.ttlTransfers);
  }
  getQuota() {
    return {
      remaining: this.quotaRemaining,
      limit: this.quotaLimit,
      used: this.quotaRemaining !== null ? this.quotaLimit - this.quotaRemaining : null,
      percentUsed: this.quotaRemaining !== null
        ? Math.round(((this.quotaLimit - this.quotaRemaining) / this.quotaLimit) * 100)
        : null,
    };
  }
}

module.exports = new ApiFootballService();
