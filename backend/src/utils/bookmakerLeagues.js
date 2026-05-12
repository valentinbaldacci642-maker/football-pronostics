// Liste des ligues API-Football couvertes par Unibet.fr ET/OU Winamax.fr.
// Dupliquée depuis frontend/src/utils/{unibet,winamax}Leagues.js — à garder
// en sync si l'utilisateur ajoute/retire des ligues. Le scan ne traite que
// les fixtures dont la ligue est dans ces sets, ce qui économise des appels
// API sur les compétitions que l'utilisateur ne peut de toute façon pas
// parier (Unibet et Winamax sont les 2 bookmakers utilisés).

const UNIBET_LEAGUE_IDS = new Set([
  // UEFA / international
  2, 3, 848, 525, 5, 1, 32, 29, 31, 30, 34, 33,
  // France
  61, 62, 66,
  // Angleterre
  39, 40, 45,
  // Espagne
  140, 141,
  // Allemagne
  78, 79, 81,
  // Italie
  135, 136, 137,
  // Portugal
  94, 95, 96,
  // Pays-Bas
  88,
  // Belgique
  144,
  // Suisse, Autriche
  207, 218,
  // Ecosse
  179, 181,
  // Scandinavie
  119, 103, 113, 244, 164,
  // Europe centrale / est
  106, 345, 283, 271, 273, 332, 373, 210, 286, 333, 172, 315,
  // Europe sud / autres
  197, 203, 165, 329, 327, 365, 362, 261, 357, 408,
  // Amériques
  13, 11, 71, 73, 128, 130, 265, 239, 242, 284, 262, 253,
  // Moyen-Orient / Afrique
  307, 383, 186, 200,
  // Asie / Océanie
  98, 292, 169, 188, 419,
]);

const WINAMAX_LEAGUE_IDS = new Set([
  // UEFA / international (pas de UECL 848)
  2, 3, 525, 5, 1, 32, 29, 31, 30, 34, 33,
  // France
  61, 62, 66,
  // Angleterre
  39, 40, 45,
  // Espagne
  140, 141,
  // Allemagne
  78, 79, 81,
  // Italie
  135, 136, 137,
  // Portugal
  94, 95, 96,
  // Pays-Bas
  88,
  // Belgique (Jupiler + Cup)
  144, 147,
  // Suisse, Autriche
  207, 218,
  // Ecosse (pas de Cup 181)
  179,
  // Scandinavie
  119, 103, 113, 244, 164,
  // Europe centrale / est (pas de Magyar Kupa 273)
  106, 345, 283, 271, 332, 373, 210, 286, 333, 172, 315,
  // Europe sud / autres (pas de Luxembourg 261)
  197, 203, 165, 329, 327, 365, 362, 357, 408,
  // Amériques (pas de Copa do Brasil 73 ni Copa Argentina 130)
  13, 11, 71, 128, 265, 239, 242, 284, 262, 253,
  // Afrique / Moyen-Orient (ajout South Africa 288, pas de Maroc 200)
  288, 186, 307, 383,
  // Asie / Océanie (pas d'Azerbaïdjan 419)
  98, 292, 169, 188,
]);

// Union — ligues à scanner. Une ligue est couverte si elle est dans au moins
// un des deux books.
const COVERED_LEAGUE_IDS = new Set([
  ...UNIBET_LEAGUE_IDS,
  ...WINAMAX_LEAGUE_IDS,
]);

module.exports = {
  UNIBET_LEAGUE_IDS,
  WINAMAX_LEAGUE_IDS,
  COVERED_LEAGUE_IDS,
};
