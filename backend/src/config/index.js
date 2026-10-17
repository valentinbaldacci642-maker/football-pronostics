module.exports = {
  api: {
    baseUrl: process.env.API_FOOTBALL_BASE_URL || 'https://v3.football.api-sports.io',
    key: process.env.API_FOOTBALL_KEY,
    timeout: 15000,
  },
  // TTL recalibrés pour le plan Ultra (75 000 req/jour au lieu des 100 du
  // plan gratuit, qui dictaient les anciennes valeurs très conservatrices).
  cache: {
    ttl: parseInt(process.env.CACHE_TTL) || 300,        // default 5 min
    maxKeys: parseInt(process.env.CACHE_MAX_KEYS) || 1000,
    ttlLive: 15,                                          // 15 s — le front sonde toutes les 30 s : jamais de cache périmé
    ttlOdds: 180,                                         // 3 min — les cotes bougent lentement, mais 15 min masquait les dérives
    ttlFixtures: 300,                                     // 5 min — métadonnées stables, 20 min retardait les reports/annulations
    ttlTeams: 7200,                                       // 2 h — profils d'équipe, inchangé
    ttlTransfers: 600,                                    // 10 min, inchangé
    ttlLeagues: 86400,                                    // 24 h, inchangé
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
