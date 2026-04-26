import { useState, useEffect } from 'react';
import { analysisApi, oddsApi, scorersApi } from '../services/api';

export function usePredictions(fixtureId) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!fixtureId) return;
    const fetch = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await analysisApi.getFullAnalysis(fixtureId);
        setAnalysis(result?.data || null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [fixtureId]);

  return { analysis, loading, error };
}

export function useOdds(fixtureId) {
  const [odds, setOdds] = useState(null);
  const [oddsAnalysis, setOddsAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!fixtureId) return;
    const fetch = async () => {
      setLoading(true);
      try {
        const result = await oddsApi.getByFixture(fixtureId);
        setOdds(result?.response?.[0] || null);
        setOddsAnalysis(result?.analysis || null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [fixtureId]);

  return { odds, oddsAnalysis, loading, error };
}

export function useScorers(fixtureId) {
  const [scorers, setScorers] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!fixtureId) return;
    setLoading(true);
    scorersApi.getByFixture(fixtureId)
      .then((res) => setScorers(res?.data || null))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [fixtureId]);

  return { scorers, loading, error };
}
