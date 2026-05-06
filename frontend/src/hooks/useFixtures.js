import { useState, useEffect, useCallback } from 'react';
import { fixturesApi } from '../services/api';

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

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    // Fetch the main fixture with one automatic retry. If the backend is
    // momentarily rate-limited we'd otherwise show "Match introuvable" while
    // the fixture actually exists — wait briefly and try again.
    const fetchFixture = async () => {
      try {
        const res = await fixturesApi.getById(id);
        return { ok: true, data: res?.response?.[0] };
      } catch (err) {
        if (err.code === 'RATE_LIMITED') {
          await new Promise((r) => setTimeout(r, 1500));
          try {
            const res = await fixturesApi.getById(id);
            return { ok: true, data: res?.response?.[0] };
          } catch (err2) {
            return { ok: false, error: err2.message };
          }
        }
        return { ok: false, error: err.message };
      }
    };

    const run = async () => {
      setLoading(true);
      setError(null);
      const fixResult = await fetchFixture();
      if (cancelled) return;

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
          fixturesApi.getStatistics(id),
          fixturesApi.getEvents(id),
          fixturesApi.getLineups(id),
        ]);
        if (cancelled) return;
        if (st.status === 'fulfilled') setStats(st.value?.response);
        if (ev.status === 'fulfilled') setEvents(ev.value?.response || []);
        if (lu.status === 'fulfilled') setLineups(lu.value?.response);
      }
      setLoading(false);
    };

    run();
    return () => { cancelled = true; };
  }, [id]);

  return { fixture, stats, events, lineups, loading, error };
}
