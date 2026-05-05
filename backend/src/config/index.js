module.exports = {
  api: {
    baseUrl: process.env.API_FOOTBALL_BASE_URL || 'https://v3.football.api-sports.io',
    key: process.env.API_FOOTBALL_KEY,
    timeout: 15000,
  },
  cache: {
    ttl: parseInt(process.env.CACHE_TTL) || 300,
    maxKeys: parseInt(process.env.CACHE_MAX_KEYS) || 500,
    ttlLive: 60,
    ttlOdds: 300,
    ttlFixtures: 600,
    ttlTeams: 7200,
    ttlTransfers: 180,
    ttlLeagues: 86400,
  },
  valueBet: {
    minEdge: 5,
    minProb: 25,
    minOdds: 1.4,
    maxOdds: 10.0,
  },
  analysis: {
    confidenceThreshold: 65,
    strongValueThreshold: 10,
  },
};
