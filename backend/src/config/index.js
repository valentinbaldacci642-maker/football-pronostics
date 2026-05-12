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
    // 5% min edge sur le consensus Shin. Plus permissif que 6% → capture
    // plus de VBs marginaux. À l'utilisateur de vérifier que l'edge tient
    // chez Unibet/Winamax via l'input "Ma cote" (les cotes locales sont
    // ~7% tighter que le consensus).
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
