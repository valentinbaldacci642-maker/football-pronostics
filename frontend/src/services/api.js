import axios from 'axios';

// In production (Netlify), VITE_API_URL points to the Render backend.
// In local dev, falls back to /api (proxied by Vite to localhost:5000).
const BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

const api = axios.create({
  baseURL: BASE,
  // Long timeout to accommodate /pronostics/today on heavy days (50+ matches
  // means 100+ batched API calls server-side, ~20-30s in worst case).
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
});

// Global rate-limit state — exposes a single source of truth that any
// component can subscribe to for a live countdown banner. The error message
// returned on a rejected request is just informational; the live UI ticks
// off the actual remaining seconds via setInterval driven by this module.
let rateLimitedUntil = 0;
const rateLimitListeners = new Set();
function notifyRateLimit() {
  rateLimitListeners.forEach((cb) => { try { cb(rateLimitedUntil); } catch {} });
}
export function subscribeRateLimit(cb) {
  rateLimitListeners.add(cb);
  cb(rateLimitedUntil);
  return () => rateLimitListeners.delete(cb);
}
export function getRateLimitedUntil() { return rateLimitedUntil; }

// Short-circuit outgoing requests while we're known to be rate-limited.
// Without this, every page navigation fires fresh API calls that all hit
// the backend simultaneously, each one returns a fresh 429 with
// retryAfterMs=30s, and the deadline keeps getting pushed forward — the
// counter visibly 'restarts' at 30s every time the user changes page.
api.interceptors.request.use((config) => {
  if (rateLimitedUntil > Date.now()) {
    const e = new Error(`Trop de requêtes en peu de temps · réessaie dans ${Math.ceil((rateLimitedUntil - Date.now()) / 1000)} s`);
    e.code = 'RATE_LIMITED';
    e.config = config;
    return Promise.reject(e);
  }
  return config;
});

api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    // Already rejected by the request interceptor — pass through unchanged
    // (don't double-update the global rateLimitedUntil with a 'fresh' 30s
    // window when the lockout is already in flight).
    if (err.code === 'RATE_LIMITED' && !err.response) return Promise.reject(err);
    const status = err.response?.status;
    const data = err.response?.data;
    // Surface API rate-limit errors with a friendly French message
    if (status === 429 || data?.code === 'RATE_LIMITED') {
      const retryMs = Math.max(1000, data?.retryAfterMs || 30000);
      const newUntil = Date.now() + retryMs;
      // Don't let concurrent 429s push the deadline forward repeatedly —
      // keep the maximum we've seen so the timer reflects the true wait.
      if (newUntil > rateLimitedUntil) {
        rateLimitedUntil = newUntil;
        notifyRateLimit();
      }
      const retrySec = Math.ceil(retryMs / 1000);
      const friendly = `Trop de requêtes en peu de temps · réessaie dans ${retrySec} s`;
      const e = new Error(friendly);
      e.code = 'RATE_LIMITED';
      console.warn('[API Rate Limit]', err.config?.url);
      return Promise.reject(e);
    }
    const message = data?.error || err.message || 'API error';
    console.error('[API Error]', message, err.config?.url);
    return Promise.reject(new Error(message));
  }
);

export const fixturesApi = {
  getToday: (league) => api.get('/fixtures/today', { params: { league } }),
  getTomorrow: (league) => api.get('/fixtures/tomorrow', { params: { league } }),
  getLive: () => api.get('/fixtures/live'),
  getById: (id) => api.get(`/fixtures/${id}`),
  getByDate: (date, league) => api.get('/fixtures', { params: { date, league } }),
  getByTeam: (teamId, { last, next, season } = {}) => api.get('/fixtures', { params: { team: teamId, last, next, season } }),
  getStatistics: (id) => api.get(`/fixtures/${id}/statistics`),
  getEvents: (id) => api.get(`/fixtures/${id}/events`),
  getLineups: (id) => api.get(`/fixtures/${id}/lineups`),
  getH2H: (t1, t2) => api.get(`/fixtures/h2h/${t1}/${t2}`, { params: { last: 10 } }),
};

export const predictionsApi = {
  getByFixture: (id) => api.get(`/predictions/${id}`),
};

export const oddsApi = {
  getByFixture: (id) => api.get(`/odds/fixture/${id}`),
  getBookmakers: () => api.get('/odds/bookmakers'),
  getLive: (fixtureId) => api.get('/odds/live', { params: fixtureId ? { fixture: fixtureId } : {} }),
};

export const teamsApi = {
  getById: (id) => api.get(`/teams/${id}`),
  search: (name) => api.get('/teams/search', { params: { name } }),
  getStatistics: (id, season, league) => api.get(`/teams/${id}/statistics`, { params: { season, league } }),
  getSquad: (id) => api.get(`/teams/${id}/squad`),
  getInjuries: (id, season) => api.get(`/teams/${id}/injuries`, { params: { season } }),
  getTransfers: (id, { force = false } = {}) =>
    api.get(`/teams/${id}/transfers`, { params: force ? { force: 1 } : {} }),
};

export const leaguesApi = {
  getTop: () => api.get('/leagues/top'),
  getById: (id) => api.get(`/leagues/${id}`),
  getStandings: (league, season) => api.get('/leagues/standings', { params: { league, season } }),
  getAll: (params) => api.get('/leagues', { params }),
};

export const playersApi = {
  getTopScorers: (league, season) => api.get('/players/topscorers', { params: { league, season } }),
  search: (name) => api.get('/players/search', { params: { name } }),
};

export const analysisApi = {
  getFullAnalysis: (fixtureId) => api.get(`/analysis/fixture/${fixtureId}`),
};

export const scorersApi = {
  getByFixture: (fixtureId) => api.get(`/scorers/${fixtureId}`),
};

export const pronosticsApi = {
  getBestToday: ({ force = false, date = null } = {}) => {
    const params = {};
    if (force) params.force = 1;
    if (date) params.date = date;
    return api.get('/pronostics/today', { params });
  },
};

export const newsApi = {
  getLatest: () => api.get('/news'),
};

export default api;
