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
    // Critère = ESPÉRANCE DE GAIN : EV = prob_juste × cote − 1.
    //
    // L'ancien seuil `minEdge: 6` comparait un écart en POINTS
    // (prob_juste − prob_implicite). Mesuré sur 120 matchs / 360 issues,
    // cet écart plafonne à 0,99 point : le seuil était six fois au-dessus
    // du maximum atteignable, donc structurellement infranchissable. Il ne
    // passait avant que parce que la formule de Shin était fausse et
    // gonflait les outsiders jusqu'à +8,9 points (d'où les -26% de ROI
    // sur 51 paris, reproduits à -28,5% en backtest).
    //
    // 2% d'EV = seuil réaliste sur un marché liquide : ~1 à 3 détections
    // par jour. Les garde-fous de cote restent inchangés.
    minEV: 2,
    minProb: 25,
    minOdds: 1.4,
    maxOdds: 10.0,
  },
  analysis: {
    confidenceThreshold: 65,
    // EV à partir de laquelle un value bet est qualifié de "fort".
    // Échelle EV (max observé ~3,6%), pas l'ancienne échelle en points.
    strongValueThreshold: 4,
  },
};
