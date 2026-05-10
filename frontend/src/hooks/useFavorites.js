import { useFavoritesStore } from '../store';
import { fixturesApi } from '../services/api';
import { useState, useEffect, useCallback } from 'react';
import { useLivePolling, isLiveStatus } from './useLivePolling';

export function useFavorites() {
  const { favorites, toggle, isFavorite, clear } = useFavoritesStore();
  const [fixtureData, setFixtureData] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadFavoriteFixtures = useCallback(async ({ fresh = false } = {}) => {
    if (favorites.length === 0) { setFixtureData([]); return; }
    if (!fresh) setLoading(true);
    try {
      // fresh=true bypasses backend cache so the 30s live polling sees real
      // status changes (1H → HT → 2H → FT) instead of stale snapshots.
      const results = await Promise.allSettled(
        favorites.map((id) => fixturesApi.getById(id, { fresh })),
      );
      const loaded = results
        .filter((r) => r.status === 'fulfilled' && r.value?.response?.[0])
        .map((r) => r.value.response[0]);
      setFixtureData(loaded);
    } catch (err) {
      console.error('Error loading favorites:', err);
    } finally {
      if (!fresh) setLoading(false);
    }
  }, [favorites]);

  useEffect(() => {
    loadFavoriteFixtures();
  }, [favorites.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh every 30s when at least one favorite is live so scores
  // tick without the user reopening the page.
  const hasLive = fixtureData.some((f) => isLiveStatus(f.fixture?.status?.short));
  useLivePolling(hasLive, () => loadFavoriteFixtures({ fresh: true }), 30000);

  return { favorites, fixtureData, loading, toggle, isFavorite, clear };
}
