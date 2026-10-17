/**
 * Saison en cours au sens API-Football.
 *
 * Une saison européenne porte l'année de son DÉMARRAGE : la saison
 * 2026-2027 s'appelle « 2026 ». Elle commence en juillet/août.
 *
 *   août-déc 2026   → saison 2026 (l'année en cours)
 *   janv-juin 2027  → saison 2026 (l'année précédente)
 *
 * Le seuil est juillet (getMonth() >= 6) pour couvrir les matchs de
 * pré-saison qui tombent avant la première journée officielle.
 *
 * Même formule que celle déjà utilisée dans Team.jsx et Player.jsx —
 * centralisée ici pour éviter les divergences : CountriesSidebar et
 * Matchs utilisaient `getFullYear() - 1` en dur, ce qui renvoyait la
 * saison précédente d'août à décembre et affichait donc un calendrier
 * vide (tous les matchs de la saison passée sont déjà joués).
 */
export function currentSeason(now = new Date()) {
  return now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
}
