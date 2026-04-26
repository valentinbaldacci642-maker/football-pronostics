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
    const fetch = async () => {
      setLoading(true);
      try {
        const [fix, st, ev, lu] = await Promise.allSettled([
          fixturesApi.getById(id),
          fixturesApi.getStatistics(id),
          fixturesApi.getEvents(id),
          fixturesApi.getLineups(id),
        ]);
        if (fix.status === 'fulfilled') setFixture(fix.value?.response?.[0]);
        if (st.status === 'fulfilled') setStats(st.value?.response);
        if (ev.status === 'fulfilled') setEvents(ev.value?.response || []);
        if (lu.status === 'fulfilled') setLineups(lu.value?.response);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [id]);

  return { fixture, stats, events, lineups, loading, error };
}
