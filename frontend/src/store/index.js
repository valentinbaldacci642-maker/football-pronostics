import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Grade a single bet against a final score. Returns 'win' | 'loss' | 'push'
 * or null when we don't know how to grade the selection (so we don't mark
 * an unresolved bet as a loss by mistake).
 *
 * Selection formats supported:
 *   1X2: '1', 'X' (or 'x'), '2', 'home', 'draw', 'away'
 *   O/U: 'Over 2.5', 'Under 1.5', etc.
 *   BTTS: 'Oui', 'Non', 'yes', 'no'
 */
function gradeBet(market, selection, homeGoals, awayGoals) {
  const sel = (selection || '').trim().toLowerCase();
  if (!sel) return null;
  const total = homeGoals + awayGoals;
  const m = (market || '').toLowerCase();

  // 1X2
  if (sel === '1' || sel === 'home' || (m === '1x2' && sel === 'home')) {
    return homeGoals > awayGoals ? 'win' : 'loss';
  }
  if (sel === 'x' || sel === 'draw') {
    return homeGoals === awayGoals ? 'win' : 'loss';
  }
  if (sel === '2' || sel === 'away') {
    return awayGoals > homeGoals ? 'win' : 'loss';
  }

  // Over/Under (e.g. 'Over 2.5', 'Under 1.5')
  if (sel.startsWith('over')) {
    const line = parseFloat(sel.replace(/[^0-9.]/g, ''));
    if (Number.isFinite(line)) {
      if (total > line) return 'win';
      if (total === line) return 'push';
      return 'loss';
    }
  }
  if (sel.startsWith('under')) {
    const line = parseFloat(sel.replace(/[^0-9.]/g, ''));
    if (Number.isFinite(line)) {
      if (total < line) return 'win';
      if (total === line) return 'push';
      return 'loss';
    }
  }

  // BTTS
  if (sel === 'oui' || sel === 'yes') return (homeGoals > 0 && awayGoals > 0) ? 'win' : 'loss';
  if (sel === 'non' || sel === 'no')  return (homeGoals === 0 || awayGoals === 0) ? 'win' : 'loss';

  return null;
}

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
        const fid = Number(fixtureId);
        const current = get().favorites;
        const exists = current.includes(fid);
        set({ favorites: exists ? current.filter((id) => id !== fid) : [...current, fid] });
      },
      isFavorite: (fixtureId) => get().favorites.includes(Number(fixtureId)),
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
          .map((p) => {
            // Find the value bet that matches the pick (if pick is a VB) so we
            // can preserve its detection sources (shin / poisson / lineup) for
            // display in the historique. Lookup by market + selection.
            const allVBs = p.analysis?.odds?.valueBets || [];
            const matchingVB = allVBs.find(
              (v) => v.market === p.pick?.market && v.selection === p.pick?.selection,
            );
            return {
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
              pickMarket: p.pick?.market,
              pickSources: matchingVB?.sources || (p.pick?.isValue ? ['shin'] : []),
              odd: p.pick?.odd,
              confidence: p.confidence,
              result: null,
              finalScore: null,
              mise: null,
            };
          });
        if (newEntries.length > 0) {
          set((s) => ({ entries: [...newEntries, ...s.entries].slice(0, 500) }));
        }
      },

      resolveResult: (fixtureId, homeGoals, awayGoals) => set((s) => ({
        entries: s.entries.map((e) => {
          if (e.fixtureId !== fixtureId) return e;
          let next = e;

          // Entry-level pick (the "main" prono on the Pronos page)
          if (!e.result) {
            const graded = gradeBet(null, e.pick, homeGoals, awayGoals);
            if (graded) {
              next = { ...next, result: graded, finalScore: `${homeGoals}-${awayGoals}` };
            }
          }

          // Per-VB stakes (the value bets staked on /value-bets)
          if (e.bets) {
            let bets = e.bets;
            let changed = false;
            for (const [betKey, bet] of Object.entries(e.bets)) {
              if (bet.result) continue;
              const [market, selection] = betKey.split('::');
              const graded = gradeBet(market, selection, homeGoals, awayGoals);
              if (graded) {
                bets = { ...bets, [betKey]: { ...bet, result: graded } };
                changed = true;
              }
            }
            if (changed) {
              next = { ...next, bets, finalScore: next.finalScore || `${homeGoals}-${awayGoals}` };
            }
          }

          return next;
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

      // Per-value-bet tracking: a single match can have multiple distinct VBs
      // (e.g. Under 2.5 + BTTS No on the same fixture). Stakes for each VB
      // live under entries[i].bets[betKey] where betKey = "market::selection".
      // Optional `sources` arg captures the detection sources of the VB at
      // save time (shin / poisson / lineup) so the historique can show them.
      setBetMise: (fixtureId, betKey, amount, sources) => set((s) => ({
        entries: s.entries.map((e) => {
          if (e.fixtureId !== fixtureId) return e;
          const next = parseFloat(amount);
          const bets = { ...(e.bets || {}) };
          const cur = bets[betKey] || {};
          bets[betKey] = {
            ...cur,
            mise: amount === '' || !Number.isFinite(next) ? null : next,
            // Only overwrite sources if a non-empty array was supplied
            ...(Array.isArray(sources) && sources.length ? { sources } : {}),
          };
          return { ...e, bets };
        }),
      })),

      setBetActualOdd: (fixtureId, betKey, value) => set((s) => ({
        entries: s.entries.map((e) => {
          if (e.fixtureId !== fixtureId) return e;
          const next = parseFloat(value);
          const bets = { ...(e.bets || {}) };
          const cur = bets[betKey] || {};
          bets[betKey] = { ...cur, actualOdd: value === '' || !Number.isFinite(next) ? null : next };
          return { ...e, bets };
        }),
      })),

      setNote: (fixtureId, note) => set((s) => ({
        entries: s.entries.map((e) =>
          e.fixtureId === fixtureId ? { ...e, note: note || null } : e
        ),
      })),

      setClosingOdd: (fixtureId, value) => set((s) => ({
        entries: s.entries.map((e) =>
          e.fixtureId === fixtureId ? { ...e, closingOdd: value === '' ? null : parseFloat(value) || null } : e
        ),
      })),

      clearAll: () => set({ entries: [] }),

      // Surgical reset: keeps every entry the user has actually staked on
      // (top-level mise OR any per-bet mise) so the bankroll P&L remains
      // intact. Used by the 'Réinitialiser ces stats' button so the
      // Total/Réussite/Gagnés/ROI counters reset without touching real bets.
      clearUnstakedEntries: () => set((s) => ({
        entries: s.entries.filter((e) => {
          if (Number.isFinite(e.mise) && e.mise > 0) return true;
          const perBetStaked = Object.values(e.bets || {}).some(
            (b) => Number.isFinite(b.mise) && b.mise > 0,
          );
          return perBetStaked;
        }),
      })),

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
        const all = get().entries;

        // Walk each entry and accumulate stats over the entry-level pick AND
        // every per-bet stake. A pending bet is one with a mise > 0 and no
        // result yet — its stake counts as "cash committed at the bookie".
        let totalMise = 0;
        let totalReturn = 0;
        let pendingCommitted = 0;
        let settledCount = 0;
        let pendingCount = 0;

        for (const e of all) {
          // Entry-level
          if (Number.isFinite(e.mise) && e.mise > 0) {
            if (e.result === 'win') {
              totalMise += e.mise;
              totalReturn += e.mise * parseFloat(e.actualOdd || e.odd || 1);
              settledCount++;
            } else if (e.result === 'loss') {
              totalMise += e.mise;
              settledCount++;
            } else if (e.result === 'push') {
              totalMise += e.mise;
              totalReturn += e.mise; // stake returned
              settledCount++;
            } else {
              pendingCommitted += e.mise;
              pendingCount++;
            }
          }
          // Per-bet stakes
          for (const bet of Object.values(e.bets || {})) {
            if (!Number.isFinite(bet.mise) || bet.mise <= 0) continue;
            if (bet.result === 'win') {
              totalMise += bet.mise;
              totalReturn += bet.mise * parseFloat(bet.actualOdd || 1);
              settledCount++;
            } else if (bet.result === 'loss') {
              totalMise += bet.mise;
              settledCount++;
            } else if (bet.result === 'push') {
              totalMise += bet.mise;
              totalReturn += bet.mise;
              settledCount++;
            } else {
              pendingCommitted += bet.mise;
              pendingCount++;
            }
          }
        }
        const pnl = totalReturn - totalMise;

        const roi = totalMise > 0 ? parseFloat((pnl / totalMise * 100).toFixed(1)) : null;
        return {
          totalMise,
          totalReturn,
          pnl,
          roi,
          count: settledCount,
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
