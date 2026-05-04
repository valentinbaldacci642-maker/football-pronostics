const config = require('../config');

/**
 * Convert bookmaker odds to raw implied probability (%)
 */
const oddsToImpliedProb = (odd) => {
  if (!odd || odd <= 0) return 0;
  return (1 / odd) * 100;
};

/**
 * Remove bookmaker margin using Shin method (most accurate)
 * Returns fair probabilities without the overround
 */
const removeMarginShin = (odds) => {
  const valid = odds.filter((o) => o > 0);
  if (valid.length === 0) return [];

  const implied = valid.map((o) => 1 / o);
  const total = implied.reduce((a, b) => a + b, 0);
  const margin = total - 1;

  // Shin z-parameter estimation
  const z = Math.sqrt(margin / (margin + valid.length));

  const fairs = implied.map((p) => {
    return (Math.sqrt(z * z + 4 * (1 - z) * p) - z) / (2 * (1 - z));
  });
  const fairSum = fairs.reduce((a, b) => a + b, 0);
  if (fairSum === 0) return fairs.map(() => 0);
  return fairs.map((f) => Math.min(Math.max((f / fairSum) * 100, 0), 100));
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
 * Detect value bet: true probability > implied probability by threshold
 */
const detectValueBet = (trueProb, bookOdd) => {
  if (!bookOdd || bookOdd <= 0) return null;
  const impliedProb = oddsToImpliedProb(bookOdd);
  const edge = trueProb - impliedProb;
  const isValue = edge >= config.valueBet.minEdge
    && trueProb >= config.valueBet.minProb
    && bookOdd >= config.valueBet.minOdds
    && bookOdd <= config.valueBet.maxOdds;

  return {
    isValue,
    edge: parseFloat(edge.toFixed(2)),
    impliedProb: parseFloat(impliedProb.toFixed(2)),
    trueProb: parseFloat(trueProb.toFixed(2)),
    strength: edge >= config.analysis.strongValueThreshold ? 'strong' : edge >= config.valueBet.minEdge ? 'moderate' : 'weak',
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
 * Poisson distribution for goal scoring
 */
const poisson = (lambda, k) => {
  let result = Math.exp(-lambda);
  for (let i = 0; i < k; i++) result *= lambda / (i + 1);
  return result;
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
};
