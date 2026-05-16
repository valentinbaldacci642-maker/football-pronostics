import { useState, useEffect, useCallback } from 'react';
import { fixturesApi } from '../services/api';
import { useLivePolling, isLiveStatus } from './useLivePolling';

export function useFixtures({ date, league, mode = 'today' } = {}) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let result;
      if (mode === 'live') result = await fixturesApi.getLive();
      else if (mode === 'tomorrow') result = await fixturesApi.getTomorrow(league);
      else if (mode === 'date' && date) result = await fixturesApi.getByDate(date, league);
      else result = await fixturesApi.getToday(league);
      setData(result?.response || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [date, league, mode]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  useEffect(() => {
    if (mode !== 'live') return;
    const interval = setInterval(fetch, 30000);
    return () => clearInterval(interval);
  }, [mode, fetch]);

  return { data, loading, error, refetch: fetch };
}

export function useFixtureDetail(id) {
  const [fixture, setFixture] = useState(null);
  const [stats, setStats] = useState(null);
  const [events, setEvents] = useState([]);
  const [lineups, setLineups] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // refresh re-runs the fetch sequence without flipping `loading` so the
  // 30s live-polling tick doesn't blank the UI on each refresh. The initial
  // load (effect below) does set loading=true. `fresh` evicts the backend
  // 20-min cache — set when polling a live match so the displayed minute /
  // score / events actually advance.
  const refresh = useCallback(async ({ withLoading = false, fresh = false } = {}) => {
    if (!id) return;
    if (withLoading) {
      setLoading(true);
      setError(null);
    }

    // Fetch the main fixture with up to 3 retries. Le backend Render free
    // tier subit des cold starts (30-60s après inactivité) qui font remonter
    // soit un timeout, soit une réponse vide gracieuse. On retry pour gérer
    // ces deux cas — pendant que l'instance se réveille en arrière-plan.
    const fetchFixture = async () => {
      const tryOnce = async () => {
        try {
          const res = await fixturesApi.getById(id, { fresh });
          return { ok: true, data: res?.response?.[0] };
        } catch (err) {
          return { ok: false, error: err.message, code: err.code };
        }
      };
      const delays = [0, 2000, 4000]; // immédiat, +2s, +4s
      for (let i = 0; i < delays.length; i++) {
        if (delays[i] > 0) await new Promise((r) => setTimeout(r, delays[i]));
        const r = await tryOnce();
        // Succès SI on a une vraie fixture data.
        if (r.ok && r.data) return r;
        // Pas la peine de retry si rate-limited persistant après 4s.
        if (r.code === 'RATE_LIMITED' && i === delays.length - 1) return r;
      }
      return { ok: false, error: 'Match introuvable après plusieurs essais' };
    };

    const fixResult = await fetchFixture();
    if (!fixResult.ok) {
      setError(fixResult.error);
      setFixture(null);
    } else if (!fixResult.data) {
      setError('Match introuvable côté API');
      setFixture(null);
    } else {
      setFixture(fixResult.data);
      // Secondary calls — failures here are non-fatal, just leave the
      // panels empty rather than blocking the whole page.
      const [st, ev, lu] = await Promise.allSettled([
        fixturesApi.getStatistics(id, { fresh }),
        fixturesApi.getEvents(id, { fresh }),
        fixturesApi.getLineups(id, { fresh }),
      ]);
      if (st.status === 'fulfilled') setStats(st.value?.response);
      if (ev.status === 'fulfilled') setEvents(ev.value?.response || []);
      if (lu.status === 'fulfilled') setLineups(lu.value?.response);
    }
    if (withLoading) setLoading(false);
  }, [id]);

  // Wrapper passed to useLivePolling — always bypasses cache so the live
  // tick actually picks up new data instead of re-rendering stale cached
  // values for the entire 20-min ttlFixtures window.
  const refreshLive = useCallback(() => refresh({ fresh: true }), [refresh]);

  useEffect(() => {
    if (!id) return undefined;
    let cancelled = false;
    (async () => {
      await refresh({ withLoading: true });
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, [id, refresh]);

  // Auto-refresh every 30s while this match is live so score / events /
  // stats stay fresh without the user manually reloading the page.
  // Use refreshLive (fresh=true) to bypass the backend 20-min cache.
  const isLive = isLiveStatus(fixture?.fixture?.status?.short);
  useLivePolling(isLive, refreshLive, 30000);

  return { fixture, stats, events, lineups, loading, error, refresh };
}
