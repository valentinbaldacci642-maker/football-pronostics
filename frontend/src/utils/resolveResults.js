import { fixturesApi } from '../services/api';

const FINISHED_STATUSES = ['FT', 'AET', 'PEN'];
const MAX_LOOKUPS = 100;
const MAX_AGE_DAYS = 14;
const MIN_AGE_MINUTES = 90; // matches need ~90 min of play before finishing
const REQUEST_GAP_MS = 200;

/**
 * Resolve unresolved bets from the past N days by querying each fixture's
 * final status. Sequential with a small gap so we don't burst the upstream
 * rate limit; only checks bets old enough that the match could plausibly be
 * over (savedAt + 90min). Calls onResolve(fixtureId, hg, ag) for finished
 * matches.
 */
export async function resolveFinishedMatches(entries, onResolve) {
  const now = Date.now();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - MAX_AGE_DAYS);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  const todayStr = new Date(now).toISOString().split('T')[0];
  const minAgeMs = MIN_AGE_MINUTES * 60_000;

  const candidates = entries
    .filter((e) => {
      if (e.result || !e.fixtureId || !e.date) return false;
      if (e.date < cutoffStr || e.date > todayStr) return false;
      // Skip bets too fresh — match not over yet, no point hitting the API
      const saved = e.savedAt ? new Date(e.savedAt).getTime() : 0;
      if (saved && now - saved < minAgeMs) return false;
      return true;
    })
    .slice(0, MAX_LOOKUPS);

  if (candidates.length === 0) return { checked: 0, resolved: 0 };

  let resolved = 0;
  // Sequential with a small gap — keeps us well under the upstream
  // 295-req/min ceiling even if other parts of the app are also calling.
  for (const entry of candidates) {
    try {
      // fresh=1 bypasses the 20min backend cache — needed because a fixture
      // pulled mid-match (e.g. live polling on Matchs page) could otherwise
      // sit in cache as still-live for up to 20 min after the real FT.
      const raw = await fixturesApi.getById(entry.fixtureId, { fresh: true });
      const fixture = raw?.response?.[0] || raw?.data?.response?.[0];
      const status = fixture?.fixture?.status?.short;
      const hg = fixture?.goals?.home;
      const ag = fixture?.goals?.away;
      if (FINISHED_STATUSES.includes(status) && Number.isFinite(hg) && Number.isFinite(ag)) {
        onResolve(entry.fixtureId, hg, ag);
        resolved += 1;
      }
    } catch {
      // Single-call failure is fine — try the next one
    }
    await new Promise((r) => setTimeout(r, REQUEST_GAP_MS));
  }

  return { checked: candidates.length, resolved };
}
