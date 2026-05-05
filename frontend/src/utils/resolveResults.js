import { fixturesApi } from '../services/api';

const FINISHED_STATUSES = ['FT', 'AET', 'PEN'];
const MAX_LOOKUPS = 30;
const MAX_AGE_DAYS = 14;

/**
 * Try to resolve unresolved entries from the past N days by querying the API
 * for each fixture's final status. Calls onResolve(fixtureId, hg, ag) for any
 * match that's now finished.
 *
 * Returns { checked, resolved } counts.
 */
export async function resolveFinishedMatches(entries, onResolve) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - MAX_AGE_DAYS);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  const todayStr = new Date().toISOString().split('T')[0];

  const candidates = entries
    .filter((e) => !e.result && e.fixtureId && e.date && e.date >= cutoffStr && e.date <= todayStr)
    .slice(0, MAX_LOOKUPS);

  if (candidates.length === 0) return { checked: 0, resolved: 0 };

  const results = await Promise.allSettled(
    candidates.map((e) => fixturesApi.getById(e.fixtureId).then((res) => ({ entry: e, raw: res })))
  );

  let resolved = 0;
  results.forEach((r) => {
    if (r.status !== 'fulfilled') return;
    const { entry, raw } = r.value;
    const fixture = raw?.response?.[0] || raw?.data?.response?.[0];
    const status = fixture?.fixture?.status?.short;
    const hg = fixture?.goals?.home;
    const ag = fixture?.goals?.away;
    if (FINISHED_STATUSES.includes(status) && Number.isFinite(hg) && Number.isFinite(ag)) {
      onResolve(entry.fixtureId, hg, ag);
      resolved += 1;
    }
  });

  return { checked: candidates.length, resolved };
}
