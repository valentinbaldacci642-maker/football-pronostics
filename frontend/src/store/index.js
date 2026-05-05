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

export const useFavoriteTeamsStore = create(
  persist(
    (set, get) => ({
      favoriteTeams: [],
      toggleTeam: (team) => {
        const current = get().favoriteTeams;
        const exists = current.some((t) => t.id === team.id);
        set({ favoriteTeams: exists ? current.filter((t) => t.id !== team.id) : [...current, team] });
      },
      isTeamFavorite: (teamId) => get().favoriteTeams.some((t) => t.id === teamId),
      clearTeams: () => set({ favoriteTeams: [] }),
    }),
    { name: 'pronostats-favorite-teams' }
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

/**
 * Bankroll & Kelly criterion settings.
 *
 * Kelly fraction defaults to 0.25 (quarter Kelly) — standard recommendation
 * to dampen variance vs full Kelly which is mathematically optimal but very volatile.
 *
 * edgeMode:
 *   - 'conservative': only pick value bets with edge ≥ 8% (fewer, higher quality)
 *   - 'standard'    : only pick value bets with edge ≥ 5% (recommended)
 *   - 'aggressive'  : show all pronostics including non-value picks (more volume)
 */
export const EDGE_MODE_THRESHOLD = {
  conservative: 8,
  standard: 5,
  aggressive: 0, // 0 = no edge requirement, show all pronos
};

export const useBankrollStore = create(
  persist(
    (set, get) => ({
      initialBankroll: 0,
      kellyFraction: 0.25,
      edgeMode: 'standard',
      setInitialBankroll: (amount) => set({ initialBankroll: Math.max(0, parseFloat(amount) || 0) }),
      setKellyFraction: (frac) => set({ kellyFraction: Math.max(0, Math.min(1, parseFloat(frac) || 0)) }),
      setEdgeMode: (mode) => set({
        edgeMode: ['conservative', 'standard', 'aggressive'].includes(mode) ? mode : 'standard',
      }),
      reset: () => set({ initialBankroll: 0, kellyFraction: 0.25, edgeMode: 'standard' }),
    }),
    { name: 'pronostats-bankroll-v1' }
  )
);

export const useBetsStore = create(
  persist(
    (set, get) => ({
      bets: [],

      addBet: (bet) => set((s) => ({
        bets: [{ ...bet, id: Date.now(), createdAt: new Date().toISOString(), resultat: 'attente' }, ...s.bets],
      })),

      updateResultat: (id, resultat) => set((s) => ({
        bets: s.bets.map((b) => b.id === id ? { ...b, resultat } : b),
      })),

      deleteBet: (id) => set((s) => ({ bets: s.bets.filter((b) => b.id !== id) })),

      getStats: () => {
        const bets = get().bets;
        const settled = bets.filter((b) => b.resultat !== 'attente');
        const wins = bets.filter((b) => b.resultat === 'gagne');
        const totalMise = settled.reduce((s, b) => s + b.mise, 0);
        const totalGagne = wins.reduce((s, b) => s + b.gainPotentiel, 0);
        const pnl = totalGagne - totalMise;
        const roi = totalMise > 0 ? parseFloat((pnl / totalMise * 100).toFixed(1)) : null;
        const taux = settled.length > 0 ? Math.round((wins.length / settled.length) * 100) : null;
        return { totalMise, totalGagne, pnl, roi, taux, wins: wins.length, losses: settled.length - wins.length, settled: settled.length, total: bets.length };
      },
    }),
    { name: 'pronostats-bets-v1' }
  )
);

export const useHistoryStore = create(
  persist(
    (set, get) => ({
      entries: [],

      savePronostics: (pronostics) => {
        const today = new Date().toISOString().split('T')[0];
        const existing = get().entries.map((e) => e.fixtureId);
        const newEntries = pronostics
          .filter((p) => !existing.includes(p.fixture?.fixture?.id))
          .map((p) => ({
            fixtureId: p.fixture?.fixture?.id,
            date: today,
            savedAt: new Date().toISOString(),
            homeTeam: p.fixture?.teams?.home?.name,
            awayTeam: p.fixture?.teams?.away?.name,
            homeLogo: p.fixture?.teams?.home?.logo,
            awayLogo: p.fixture?.teams?.away?.logo,
            league: p.fixture?.league?.name,
            leagueLogo: p.fixture?.league?.logo,
            pick: p.pick?.selection,
            pickLabel: p.pick?.selectionLabel,
            odd: p.pick?.odd,
            confidence: p.confidence,
            result: null,
            finalScore: null,
            mise: null,
          }));
        if (newEntries.length > 0) {
          set((s) => ({ entries: [...newEntries, ...s.entries].slice(0, 500) }));
        }
      },

      resolveResult: (fixtureId, homeGoals, awayGoals) => set((s) => ({
        entries: s.entries.map((e) => {
          if (e.fixtureId !== fixtureId || e.result) return e;
          const pick = (e.pick || '').toLowerCase();
          let result = 'loss';
          if (pick === 'home' && homeGoals > awayGoals) result = 'win';
          else if (pick === 'draw' && homeGoals === awayGoals) result = 'win';
          else if (pick === 'away' && awayGoals > homeGoals) result = 'win';
          else if (pick.includes('over') && (homeGoals + awayGoals) > parseFloat(pick.replace(/[^0-9.]/g, ''))) result = 'win';
          else if (pick.includes('under') && (homeGoals + awayGoals) < parseFloat(pick.replace(/[^0-9.]/g, ''))) result = 'win';
          return { ...e, result, finalScore: `${homeGoals}-${awayGoals}` };
        }),
      })),

      setMise: (fixtureId, amount) => set((s) => ({
        entries: s.entries.map((e) =>
          e.fixtureId === fixtureId ? { ...e, mise: amount === '' ? null : parseFloat(amount) || null } : e
        ),
      })),

      setActualOdd: (fixtureId, value) => set((s) => ({
        entries: s.entries.map((e) =>
          e.fixtureId === fixtureId ? { ...e, actualOdd: value === '' ? null : parseFloat(value) || null } : e
        ),
      })),

      setNote: (fixtureId, note) => set((s) => ({
        entries: s.entries.map((e) =>
          e.fixtureId === fixtureId ? { ...e, note: note || null } : e
        ),
      })),

      clearAll: () => set({ entries: [] }),

      getStats: () => {
        const settled = get().entries.filter((e) => e.result === 'win' || e.result === 'loss');
        const wins = settled.filter((e) => e.result === 'win').length;
        const rate = settled.length > 0 ? Math.round((wins / settled.length) * 100) : null;
        // Use actualOdd (user-entered real bookie odd) when present; fall back to system odd
        const roi = settled.reduce((acc, e) => {
          if (e.result === 'win') return acc + (parseFloat(e.actualOdd || e.odd || 1) - 1);
          return acc - 1;
        }, 0);
        return {
          total: get().entries.length,
          settled: settled.length,
          wins,
          losses: settled.length - wins,
          rate,
          roi: settled.length > 0 ? parseFloat((roi / settled.length * 100).toFixed(1)) : null,
        };
      },

      getBankrollStats: () => {
        const bets = get().entries.filter((e) => e.mise > 0);
        const settled = bets.filter((e) => e.result);
        const pending = bets.filter((e) => !e.result);

        const totalMise = settled.reduce((s, e) => s + e.mise, 0);
        const totalReturn = settled.reduce((s, e) => {
          if (e.result === 'win') return s + e.mise * parseFloat(e.actualOdd || e.odd || 1);
          return s;
        }, 0);
        const pnl = totalReturn - totalMise;

        // Cash committed in pending bets (sitting with the bookie, not in your pocket)
        const pendingCommitted = pending.reduce((s, e) => s + e.mise, 0);
        const pendingCount = pending.length;

        const roi = totalMise > 0 ? parseFloat((pnl / totalMise * 100).toFixed(1)) : null;
        return {
          totalMise,
          totalReturn,
          pnl,
          roi,
          count: settled.length,
          pendingCommitted,
          pendingCount,
        };
      },

      getBankrollCurve: () => {
        const settled = get().entries
          .filter((e) => e.result && e.mise > 0)
          .sort((a, b) => new Date(a.savedAt) - new Date(b.savedAt));
        let running = 0;
        return settled.map((e, i) => {
          const pnl = e.result === 'win'
            ? e.mise * (parseFloat(e.actualOdd || e.odd || 1) - 1)
            : -e.mise;
          running += pnl;
          return {
            n: i + 1,
            label: `${e.homeTeam?.split(' ')[0]} vs ${e.awayTeam?.split(' ')[0]}`,
            pnl: parseFloat(pnl.toFixed(2)),
            running: parseFloat(running.toFixed(2)),
            result: e.result,
          };
        });
      },
    }),
    { name: 'pronostats-history-v2' }
  )
);
