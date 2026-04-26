import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useFixturesStore = create((set, get) => ({
  fixtures: [],
  liveFixtures: [],
  selectedDate: new Date().toISOString().split('T')[0],
  selectedLeague: null,
  viewMode: 'today',
  isLoading: false,
  error: null,

  setFixtures: (fixtures) => set({ fixtures }),
  setLiveFixtures: (liveFixtures) => set({ liveFixtures }),
  setSelectedDate: (date) => set({ selectedDate: date }),
  setSelectedLeague: (league) => set({ selectedLeague: league }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}));

export const useFavoritesStore = create(
  persist(
    (set, get) => ({
      favorites: [],
      toggle: (fixtureId) => {
        const current = get().favorites;
        const exists = current.includes(fixtureId);
        set({ favorites: exists ? current.filter((id) => id !== fixtureId) : [...current, fixtureId] });
      },
      isFavorite: (fixtureId) => get().favorites.includes(fixtureId),
      clear: () => set({ favorites: [] }),
    }),
    { name: 'pronostats-favorites' }
  )
);

export const useLeaguesStore = create(
  persist(
    (set) => ({
      topLeagues: [],
      pinnedLeagues: [39, 140, 78, 135, 61],
      setTopLeagues: (leagues) => set({ topLeagues: leagues }),
      pinLeague: (id) => set((s) => ({ pinnedLeagues: s.pinnedLeagues.includes(id) ? s.pinnedLeagues.filter((l) => l !== id) : [...s.pinnedLeagues, id] })),
    }),
    { name: 'pronostats-leagues' }
  )
);

export const useUIStore = create((set) => ({
  sidebarOpen: false,
  searchQuery: '',
  activeTab: 'today',
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
