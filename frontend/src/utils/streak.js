/**
 * Detect a streak from the last_5 form data exposed by the analysis service.
 * form is an array of { result: 'W'|'D'|'L', win, draw, loss } in chronological
 * order (oldest first), so we reverse to inspect the most recent matches first.
 *
 * Returns { type: 'win'|'loss'|'draw'|'mixed', length, label, intensity }
 *   intensity: 'hot' (≥4 wins), 'cold' (≥4 losses), 'streak' (3-W/L), 'mild' (2)
 */
export function detectStreak(form) {
  if (!form?.length) return null;
  const recent = [...form].reverse();
  const first = recent[0]?.result;
  if (!first) return null;

  let length = 1;
  for (let i = 1; i < recent.length; i++) {
    if (recent[i]?.result === first) length++;
    else break;
  }

  if (length < 2) return null;

  const map = { W: 'win', D: 'draw', L: 'loss' };
  const type = map[first] || 'mixed';

  let intensity = 'mild';
  if (type === 'win' && length >= 4) intensity = 'hot';
  else if (type === 'loss' && length >= 4) intensity = 'cold';
  else if (length >= 3) intensity = 'streak';

  const label =
    type === 'win'  ? `🔥 ${length} victoires de suite` :
    type === 'loss' ? `❄️ ${length} défaites de suite` :
    type === 'draw' ? `🟡 ${length} nuls de suite` :
    `${length} matchs identiques`;

  return { type, length, label, intensity };
}

/**
 * Detect both teams' streaks from a predictionAnalysis-shaped object.
 * Returns { home: streak|null, away: streak|null }
 */
export function detectStreaksForFixture(predAnalysis) {
  return {
    home: detectStreak(predAnalysis?.form?.home),
    away: detectStreak(predAnalysis?.form?.away),
  };
}
