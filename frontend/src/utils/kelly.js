/**
 * Kelly Criterion — fraction of bankroll to wager on a value bet.
 *
 * Kelly% = (p * (b - 1) - (1 - p)) / (b - 1)
 *   where p = true win probability (0-1)
 *         b = decimal odds
 *
 * Returns 0 when there is no edge (Kelly would be negative).
 *
 * @param {number} probPercent  - true probability in % (e.g. 60 for 60%)
 * @param {number} decimalOdd   - decimal odds (e.g. 2.10)
 * @returns {number} Kelly fraction of bankroll (0-1)
 */
export function kellyFraction(probPercent, decimalOdd) {
  if (!Number.isFinite(probPercent) || !Number.isFinite(decimalOdd)) return 0;
  if (decimalOdd <= 1) return 0;
  const p = probPercent / 100;
  const b = decimalOdd - 1;
  const k = (p * b - (1 - p)) / b;
  return Math.max(0, k);
}

/**
 * Suggested stake in € given a bankroll and Kelly fraction multiplier.
 * Most pros use ¼ Kelly (multiplier=0.25) to reduce variance.
 *
 * @param {number} probPercent
 * @param {number} decimalOdd
 * @param {number} bankroll       - current bankroll in €
 * @param {number} fractionMult   - Kelly multiplier (0.25 = quarter Kelly)
 * @param {number} [maxFraction]  - safety cap on bankroll % per bet
 * @returns {number} stake in €, rounded to 1 decimal
 */
export function kellyStake(probPercent, decimalOdd, bankroll, fractionMult = 0.25, maxFraction = 0.1) {
  const k = kellyFraction(probPercent, decimalOdd) * fractionMult;
  const capped = Math.min(k, maxFraction);
  return Math.max(0, parseFloat((bankroll * capped).toFixed(2)));
}
