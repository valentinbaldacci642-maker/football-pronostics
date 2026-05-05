/**
 * Format a Kelly stake amount with adaptive precision so small stakes (typical
 * with low bankrolls) don't get rounded to zero in the UI.
 * Examples:
 *   formatStake(22.34)  → '22 €'
 *   formatStake(2.22)   → '2.2 €'
 *   formatStake(0.44)   → '0.44 €'
 *   formatStake(0.05)   → '0.05 €'
 */
export function formatStake(value) {
  if (!Number.isFinite(value) || value <= 0) return '0 €';
  if (value >= 10) return `${value.toFixed(0)} €`;
  if (value >= 1) return `${value.toFixed(1)} €`;
  return `${value.toFixed(2)} €`;
}
