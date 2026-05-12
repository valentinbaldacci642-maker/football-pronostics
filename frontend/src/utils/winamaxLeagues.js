// API-Football league IDs for the competitions covered by Winamax France.
// Source: Winamax.fr Football competition list (captured by user).
// Used by the "Winamax only" toggle on the Value Bets page to hide VBs on
// matches that aren't bookable on Winamax.fr.
//
// Differences vs Unibet : Winamax ne propose pas UEFA Conference League,
// EFL Cup, Coupes nationales d'Argentine/Brésil, Scottish Cup, Hungarian
// Cup, Luxembourg, Maroc, Azerbaïdjan. En revanche couvre Afrique du Sud.
export const WINAMAX_LEAGUE_IDS = new Set([
  // UEFA / international
  2,    // UEFA Champions League
  3,    // UEFA Europa League
  525,  // UEFA Women's Champions League
  5,    // UEFA Nations League
  1,    // FIFA World Cup 2026
  32,   // WC Qualification Europe
  29,   // WC Qualification CONMEBOL
  31,   // WC Qualification Asia
  30,   // WC Qualification Africa
  34,   // WC Qualification CONCACAF
  33,   // WC Qualification Oceania

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
  88,                    // Eredivisie (+ PO Accession dans la même catégorie)

  // Belgique
  144,                   // Jupiler Pro League

  // Suisse
  207,

  // Autriche
  218,

  // Écosse
  179,                   // Premiership (+ playoffs accession dans la même)

  // Scandinavie
  119, 103, 113, 244, 164,

  // Europe centrale / est
  106, 345, 283, 271, 332, 373, 210, 286, 333, 172, 315,

  // Europe sud / autres
  197, 203, 165, 329, 327, 365, 362, 357, 408,

  // Amériques
  13, 11,                // Libertadores, Sudamericana
  71,                    // Brasileirão Série A
  128,                   // Argentina Liga Profesional
  265, 239, 242, 284,    // Chili / Colombie / Équateur / Paraguay
  262, 253,              // Mexique / MLS

  // Afrique / Moyen-Orient
  288,                   // South Africa PSL Premiership
  186,                   // Algeria Ligue 1
  307,                   // Saudi Pro League
  383,                   // Israeli Premier League

  // Asie / Océanie
  98, 292, 169, 188,     // Japon J1 / Corée K1 / Chine SL / Australie A-League
]);

export function isWinamaxLeague(leagueId) {
  return WINAMAX_LEAGUE_IDS.has(leagueId);
}
