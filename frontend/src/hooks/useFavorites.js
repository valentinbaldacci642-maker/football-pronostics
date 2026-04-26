import { useFavoritesStore } from '../store';
import { fixturesApi } from '../services/api';
import { useState, useEffect } from 'react';

export function useFavorites() {
  const { favorites, toggle, isFavorite, clear } = useFavoritesStore();
  const [fixtureData, setFixtureData] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadFavoriteFixtures = async () => {
    if (favorites.length === 0) { setFixtureData([]); return; }
    setLoading(true);
    try {
      const results = await Promise.allSettled(
        favorites.map((id) => fixturesApi.getById(id))
      );
      const loaded = results
        .filter((r) => r.status === 'fulfilled' && r.value?.response?.[0])
        .map((r) => r.value.response[0]);
      setFixtureData(loaded);
    } catch (err) {
      console.error('Error loading favorites:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFavoriteFixtures();
  }, [favorites.join(',')]);

  return { favorites, fixtureData, loading, toggle, isFavorite, clear };
}
