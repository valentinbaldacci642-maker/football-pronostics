const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');
const cache = require('../utils/cache');

class ApiFootballService {
  constructor() {
    this.quotaRemaining = null;
    this.quotaLimit = 100;

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
        if (remaining !== undefined) {
          this.quotaRemaining = parseInt(remaining);
          if (limit) this.quotaLimit = parseInt(limit);
          logger.info(`API Quota: ${remaining}/${limit || '?'} restants`);
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

  async request(endpoint, params = {}, ttl) {
    const cacheKey = cache.buildKey('api', endpoint, JSON.stringify(params));
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const { data } = await this.client.get(endpoint, { params });

    if (data.errors && Object.keys(data.errors).length > 0) {
      logger.warn(`API returned errors for ${endpoint}:`, data.errors);
    }

    const result = {
      response: data.response || [],
      results: data.results || 0,
      paging: data.paging || {},
      errors: data.errors || {},
    };

    cache.set(cacheKey, result, ttl || config.cache.ttl);
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

  async getFixturesByDate(date, league, season) {
    const params = { date };
    if (league) params.league = league;
    if (season) params.season = season;
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
