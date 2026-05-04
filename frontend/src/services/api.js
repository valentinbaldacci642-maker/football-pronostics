import axios from 'axios';

// In production (Netlify), VITE_API_URL points to the Render backend.
// In local dev, falls back to /api (proxied by Vite to localhost:5000).
const BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

const api = axios.create({
  baseURL: BASE,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const message = err.response?.data?.error || err.message || 'API error';
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
};

export const teamsApi = {
  getById: (id) => api.get(`/teams/${id}`),
  search: (name) => api.get('/teams/search', { params: { name } }),
  getStatistics: (id, season, league) => api.get(`/teams/${id}/statistics`, { params: { season, league } }),
  getSquad: (id) => api.get(`/teams/${id}/squad`),
  getInjuries: (id, season) => api.get(`/teams/${id}/injuries`, { params: { season } }),
  getTransfers: (id) => api.get(`/teams/${id}/transfers`),
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
  getBestToday: () => api.get('/pronostics/today'),
};

export const newsApi = {
  getLatest: () => api.get('/news'),
};

export default api;
