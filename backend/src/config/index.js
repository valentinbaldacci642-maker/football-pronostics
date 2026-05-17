module.exports = {
  api: {
    baseUrl: process.env.API_FOOTBALL_BASE_URL || 'https://v3.football.api-sports.io',
    key: process.env.API_FOOTBALL_KEY,
    timeout: 15000,
  },
  cache: {
    ttl: parseInt(process.env.CACHE_TTL) || 600,        // default 10 min
    maxKeys: parseInt(process.env.CACHE_MAX_KEYS) || 1000,
    ttlLive: 60,                                          // 1 min live data
    ttlOdds: 900,                                         // 15 min — odds drift slowly
    ttlFixtures: 1200,                                    // 20 min — fixture metadata stable
    ttlTeams: 7200,                                       // 2 h — team profiles
    ttlTransfers: 600,                                    // 10 min
    ttlLeagues: 86400,                                    // 24 h
  },
  valueBet: {
    // 6% min edge sur le consensus Shin. Choisi après expérience pratique :
    // un seuil 5% laissait passer trop de bruit (-26% ROI sur 51 paris) ;
    // 6% filtre les edges marginaux qui rétrécissent souvent chez Unibet/
    // Winamax où les cotes sont ~7% plus serrées que le consensus.
    minEdge: 6,
    minProb: 25,
    minOdds: 1.4,
    maxOdds: 10.0,
  },
  analysis: {
    confidenceThreshold: 65,
    strongValueThreshold: 10,
  },
};
