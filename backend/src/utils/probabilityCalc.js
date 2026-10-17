const config = require('../config');

/**
 * Convert bookmaker odds to raw implied probability (%)
 */
const oddsToImpliedProb = (odd) => {
  if (!odd || odd <= 0) return 0;
  return (1 / odd) * 100;
};

/**
 * Remove bookmaker margin using the Shin (1992) method.
 * Returns fair probabilities (%) without the overround.
 *
 * Formule canonique, pour π_i = 1/cote_i et Π = Σ π_i :
 *
 *   p_i = [ √(z² + 4(1−z)·π_i²/Π) − z ] / (2(1−z))
 *
 * Deux points essentiels, tous deux faux dans la version précédente :
 *   • le terme est π_i²/Π, PAS π_i. Sans le carré, la transformation
 *     compresse tout vers la moyenne : elle écrasait les favoris (1.12 →
 *     67% au lieu de 87%) et gonflait les outsiders (21.0 → 12% au lieu
 *     de 3,5%), soit l'inverse exact de la correction favori-outsider
 *     que Shin est censé appliquer.
 *   • z se résout numériquement pour que Σ p_i = 1. L'ancienne estimation
 *     fermée √(marge/(marge+n)) ne vérifiait pas cette contrainte, d'où
 *     une renormalisation a posteriori qui masquait la dérive.
 *
 * Mesuré sur 337 matchs joués (1011 issues) : Brier 0.1945 → 0.1842,
 * et l'écart de calibration passe de 18 points à moins de 3.
 */
const removeMarginShin = (odds) => {
  const valid = odds.filter((o) => o > 0);
  if (valid.length < 2) return valid.map(() => 0);

  const pi = valid.map((o) => 1 / o);
  const booksum = pi.reduce((a, b) => a + b, 0);

  // Pas de marge (ou arbitrage) : Shin n'a rien à retirer.
  if (booksum <= 1) return pi.map((p) => Math.min(Math.max(p * 100, 0), 100));

  const fairAt = (z) => pi.map((p) => (Math.sqrt(z * z + 4 * (1 - z) * (p * p) / booksum) - z) / (2 * (1 - z)));

  // Σ p_i décroît quand z croît → dichotomie sur [0, 0.5].
  let lo = 1e-9;
  let hi = 0.5;
  for (let i = 0; i < 100; i += 1) {
    const mid = (lo + hi) / 2;
    if (fairAt(mid).reduce((a, b) => a + b, 0) > 1) lo = mid;
    else hi = mid;
  }

  return fairAt((lo + hi) / 2).map((f) => Math.min(Math.max(f * 100, 0), 100));
};

/**
 * Simple margin removal (power method)
 */
const removeMarginSimple = (odds) => {
  const implied = odds.map((o) => (o > 0 ? 1 / o : 0));
  const total = implied.reduce((a, b) => a + b, 0);
  if (total === 0) return odds.map(() => 0);
  return implied.map((p) => (p / total) * 100);
};

/**
 * Calculate overround / margin for a set of odds
 */
const calculateOverround = (odds) => {
  const total = odds.reduce((sum, o) => (o > 0 ? sum + 1 / o : sum), 0);
  return ((total - 1) * 100).toFixed(2);
};

/**
 * Détecte un value bet à partir de l'ESPÉRANCE DE GAIN.
 *
 *   EV = prob_juste × cote − 1     (en %, ex. +2,5%)
 *
 * `edge` porte désormais cette EV — c'est ce que l'UI affiche partout
 * sous la forme "+X%", ce qui rend enfin le libellé exact. L'ancien
 * écart en points reste exposé sous `edgePoints` pour le diagnostic.
 *
 * Pourquoi pas l'écart en points : il plafonne à ~1 point sur un marché
 * réel (les bookmakers sont très alignés), alors que l'EV du même pari
 * vaut +3%. Les deux grandeurs n'ont pas la même échelle, et le seuil
 * historique de 6 confondait les deux.
 */
const detectValueBet = (trueProb, bookOdd) => {
  if (!bookOdd || bookOdd <= 0) return null;
  const impliedProb = oddsToImpliedProb(bookOdd);
  const ev = ((trueProb / 100) * bookOdd - 1) * 100;
  const edgePoints = trueProb - impliedProb;

  const isValue = ev >= config.valueBet.minEV
    && trueProb >= config.valueBet.minProb
    && bookOdd >= config.valueBet.minOdds
    && bookOdd <= config.valueBet.maxOdds;

  return {
    isValue,
    edge: parseFloat(ev.toFixed(2)),
    edgePoints: parseFloat(edgePoints.toFixed(2)),
    impliedProb: parseFloat(impliedProb.toFixed(2)),
    trueProb: parseFloat(trueProb.toFixed(2)),
    strength: ev >= config.analysis.strongValueThreshold ? 'strong' : ev >= config.valueBet.minEV ? 'moderate' : 'weak',
  };
};

/**
 * Kelly Criterion for optimal bet fraction
 */
const kellyCriterion = (prob, odd, fraction = 0.25) => {
  if (!prob || !odd) return 0;
  const p = prob / 100;
  const q = 1 - p;
  const b = odd - 1;
  const kelly = ((b * p - q) / b) * fraction * 100;
  return Math.max(0, parseFloat(kelly.toFixed(2)));
};

/**
 * Convert Asian Handicap odds to probabilities
 */
const handicapToProbability = (homeOdd, awayOdd) => {
  const probs = removeMarginSimple([homeOdd, awayOdd]);
  return { home: probs[0], away: probs[1] };
};

/**
 * Calculate BTTS probability from individual team scoring probs
 */
const calcBTTSProbability = (homeScoreProb, awayScoreProb) => {
  return (homeScoreProb / 100) * (awayScoreProb / 100) * 100;
};

/**
 * Poisson distribution for goal scoring (PMF — probability of exactly k events)
 */
const poisson = (lambda, k) => {
  let result = Math.exp(-lambda);
  for (let i = 0; i < k; i++) result *= lambda / (i + 1);
  return result;
};

/**
 * Cumulative Poisson distribution: P(X ≤ k) for parameter lambda.
 * Used for Over/Under markets — e.g. P(total goals ≤ 2) for Under 2.5.
 */
const poissonCDF = (lambda, k) => {
  let sum = 0;
  for (let i = 0; i <= k; i++) sum += poisson(lambda, i);
  return sum;
};

/**
 * Probability that BOTH teams score at least once, given each team's xG.
 * Assumes scoring is independent between the two teams (standard simplification).
 */
const bttsYesProbability = (homeXG, awayXG) => {
  const pHomeScore = 1 - Math.exp(-homeXG);
  const pAwayScore = 1 - Math.exp(-awayXG);
  return pHomeScore * pAwayScore;
};

/**
 * Generate score probability matrix using Poisson
 */
const generateScoreMatrix = (homeGoals, awayGoals, maxGoals = 5) => {
  const matrix = [];
  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      const prob = poisson(homeGoals, h) * poisson(awayGoals, a) * 100;
      matrix.push({ home: h, away: a, prob: parseFloat(prob.toFixed(3)) });
    }
  }
  return matrix.sort((a, b) => b.prob - a.prob);
};

/**
 * Determine confidence level from probability
 */
const getConfidenceLevel = (prob) => {
  if (prob >= 75) return { level: 'very-high', label: 'Très fiable', color: '#22c55e' };
  if (prob >= 60) return { level: 'high', label: 'Fiable', color: '#84cc16' };
  if (prob >= 50) return { level: 'medium', label: 'Modéré', color: '#f59e0b' };
  if (prob >= 35) return { level: 'low', label: 'Risqué', color: '#f97316' };
  return { level: 'very-low', label: 'Très risqué', color: '#ef4444' };
};

module.exports = {
  oddsToImpliedProb,
  removeMarginShin,
  removeMarginSimple,
  calculateOverround,
  detectValueBet,
  kellyCriterion,
  handicapToProbability,
  calcBTTSProbability,
  generateScoreMatrix,
  getConfidenceLevel,
  poisson,
  poissonCDF,
  bttsYesProbability,
};
