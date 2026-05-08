// API-Football league IDs for the competitions covered by Unibet France.
// Source: Unibet.fr Football competition list (captured by user).
// Used by the "Unibet only" toggle on the Value Bets page to hide VBs on
// matches that aren't bookable on Unibet.fr.
//
// If a VB doesn't show up while you know Unibet covers it, the league ID
// here is probably wrong / missing — log it and add it.
export const UNIBET_LEAGUE_IDS = new Set([
  // UEFA / international
  2,    // UEFA Champions League
  3,    // UEFA Europa League
  848,  // UEFA Europa Conference League
  525,  // UEFA Women's Champions League (LDC F)
  5,    // UEFA Nations League (LDN)
  1,    // FIFA World Cup (Coupe du Monde 2026)
  32,   // World Cup - Qualification Europe
  29,   // World Cup - Qualification CONMEBOL
  31,   // World Cup - Qualification Asia
  30,   // World Cup - Qualification Africa
  34,   // World Cup - Qualification CONCACAF
  33,   // World Cup - Qualification Oceania

  // France
  61, 62, 66,            // Ligue 1, Ligue 2, Coupe de France

  // Angleterre
  39, 40, 45,            // Premier League, Championship, FA Cup

  // Espagne
  140, 141,              // LaLiga, LaLiga 2

  // Allemagne
  78, 79, 81,            // Bundesliga, 2. Bundesliga, DFB-Pokal

  // Italie
  135, 136, 137,         // Serie A, Serie B, Coppa Italia

  // Portugal
  94, 95, 96,            // Primeira Liga, Liga Portugal 2, Taça de Portugal

  // Pays-Bas
  88,                    // Eredivisie

  // Belgique
  144,                   // Jupiler Pro League

  // Suisse
  207,                   // Super League

  // Autriche
  218,                   // Bundesliga

  // Ecosse
  179, 181,              // Premiership, Scottish Cup

  // Scandinavie
  119,                   // Superligaen (DK)
  103,                   // Eliteserien (NO)
  113,                   // Allsvenskan (SE)
  244,                   // Veikkausliiga (FI)
  164,                   // Úrvalsdeild (IS)

  // Europe centrale / est
  106,                   // Ekstraklasa (PL)
  345,                   // Czech First League (CZ)
  283,                   // Liga I (RO)
  271, 273,              // NB I + Magyar Kupa (HU)
  332,                   // Slovak Super Liga
  373,                   // Slovenian PrvaLiga
  210,                   // HNL (HR)
  286,                   // Serbian Super Liga
  333,                   // Ukrainian Premier League
  172,                   // First League (BG)
  315,                   // Premijer Liga BiH

  // Europe sud / autres
  197,                   // Greek Super League
  203,                   // Süper Lig (TR)
  165,                   // Cypriot 1. Division
  329,                   // Erovnuli Liga (GE)
  327,                   // Meistriliiga (EE)
  365,                   // Virslīga (LV)
  362,                   // A Lyga (LT)
  261,                   // BGL Ligue (LU)
  357,                   // Premier Division (IE)
  408,                   // Premiership (NIR)

  // Amériques
  13,                    // CONMEBOL Libertadores
  11,                    // CONMEBOL Sudamericana
  71, 73,                // Brasileirão Série A, Copa do Brasil
  128, 130,              // Liga Profesional Argentina, Copa Argentina
  265,                   // Primera División (CL)
  239,                   // Primera A (CO)
  242,                   // LigaPro (EC)
  284,                   // Primera División (PY)
  262,                   // Liga MX
  253,                   // MLS

  // Moyen-Orient / Afrique
  307,                   // Saudi Pro League
  383,                   // Israeli Premier League
  186,                   // Algeria Ligue 1
  200,                   // Botola Pro (MA)

  // Asie / Océanie
  98,                    // J1 League (JP)
  292,                   // K League 1 (KR)
  169,                   // Chinese Super League
  188,                   // A-League (AU)
  419,                   // Premier League (AZ)
]);

export function isUnibetLeague(leagueId) {
  return UNIBET_LEAGUE_IDS.has(leagueId);
}
