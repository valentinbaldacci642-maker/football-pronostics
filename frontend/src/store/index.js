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
 *   - 'conservative': only pick value bets with edge ≥ 9% (fewer, higher quality)
 *   - 'standard'    : only pick value bets with edge ≥ 7% (recommended — laisse
 *                     marge pour la perte d'edge sur Unibet.fr vs consensus)
 *   - 'aggressive'  : show all pronostics including non-value picks (more volume)
 */
export const EDGE_MODE_THRESHOLD = {
  conservative: 9,
  standard: 7,
  aggressive: 0, // 0 = no edge requirement, show all pronos
};

export const useBankrollStore = create(
  persist(
    (set, get) => ({
      initialBankroll: 0,
      kellyFraction: 0.25,
      edgeMode: 'standard',
      unibetOnly: false,
      setInitialBankroll: (amount) => set({ initialBankroll: Math.max(0, parseFloat(amount) || 0) }),
      setKellyFraction: (frac) => set({ kellyFraction: Math.max(0, Math.min(1, parseFloat(frac) || 0)) }),
      setEdgeMode: (mode) => set({
        edgeMode: ['conservative', 'standard', 'aggressive'].includes(mode) ? mode : 'standard',
      }),
      setUnibetOnly: (on) => set({ unibetOnly: !!on }),
      reset: () => set({ initialBankroll: 0, kellyFraction: 0.25, edgeMode: 'standard', unibetOnly: false }),
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
              // Full kickoff ISO datetime — used for display (formatMatchDate
              // shows 'Aujourd'hui 19:00' / 'Demain 19:00' / '12 mai · 19:00').
              // `date` stays a YYYY-MM-DD save-day stamp because resolveResults
              // and the export CSV depend on that string format.
              matchDate: p.fixture?.fixture?.date || null,
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

      // One-shot manual import: replace the settled history with a hardcoded
      // list of bets read off the bookmaker's app, keeping any currently
      // pending entries untouched. Used to reconcile a corrupted historique
      // when bets were entered with wrong odds / missed results / etc.
      seedUnibetBets: () => {
        const SEED_BETS = [
          // ── Wolfsburg vs Bayern Munich (0-1) — 3 paris ───────────────
          { home: 'VfL Wolfsburg', away: 'Bayern München', league: 'Bundesliga',
            matchDate: '2026-05-09T18:30:00+02:00', finalScore: '0-1',
            bets: [
              { market: 'O/U 2.5', selection: 'Under 2.5', odd: 3.20, mise: 0.11, result: 'win' },
              { market: '1X2',      selection: '1',         odd: 4.80, mise: 0.14, result: 'loss' },
              { market: '1X2',      selection: 'X',         odd: 4.90, mise: 0.15, result: 'loss' },
            ] },

          // ── Manchester City vs Brentford (3-0) ────────────────────────
          { home: 'Manchester City', away: 'Brentford', league: 'Premier League',
            matchDate: '2026-05-07T20:30:00+02:00', finalScore: '3-0',
            bets: [
              { market: 'O/U 2.5', selection: 'Under 2.5', odd: 2.80, mise: 0.14, result: 'loss' },
            ] },

          // ── Hoffenheim vs Werder Bremen ──────────────────────────────
          { home: 'Hoffenheim', away: 'Werder Bremen', league: 'Bundesliga',
            matchDate: '2026-05-07T20:30:00+02:00',
            bets: [
              { market: '1X2', selection: 'X', odd: 4.90, mise: 0.13, result: 'loss' },
            ] },

          // ── RB Leipzig vs FC St. Pauli ────────────────────────────────
          { home: 'RB Leipzig', away: 'FC St. Pauli', league: 'Bundesliga',
            matchDate: '2026-05-07T20:30:00+02:00',
            bets: [
              { market: '1X2', selection: 'X', odd: 5.80, mise: 0.20, result: 'loss' },
            ] },

          // ── Stuttgart vs Leverkusen ───────────────────────────────────
          { home: 'Stuttgart', away: 'Bayer Leverkusen', league: 'Bundesliga',
            matchDate: '2026-05-07T20:30:00+02:00',
            bets: [
              { market: 'O/U 2.5', selection: 'Under 2.5', odd: 2.90, mise: 0.10, result: 'loss' },
            ] },

          // ── Gwangju FC vs Gangwon FC ─────────────────────────────────
          { home: 'Gwangju FC', away: 'Gangwon FC', league: 'K League 1',
            matchDate: '2026-05-08T12:00:00+02:00',
            bets: [
              { market: '1X2', selection: 'X', odd: 4.15, mise: 0.10, result: 'win' },
            ] },

          // ── Lens vs Nantes ────────────────────────────────────────────
          { home: 'Lens', away: 'Nantes', league: 'Ligue 1',
            matchDate: '2026-05-07T20:45:00+02:00',
            bets: [
              { market: '1X2', selection: 'X', odd: 5.10, mise: 0.20, result: 'loss' },
            ] },

          // ── Dortmund vs Eintracht Frankfurt ───────────────────────────
          { home: 'Borussia Dortmund', away: 'Eintracht Frankfurt', league: 'Bundesliga',
            matchDate: '2026-05-08T20:30:00+02:00',
            bets: [
              { market: '1X2',      selection: 'X',         odd: 4.80, mise: 0.16, result: 'loss' },
              { market: 'O/U 2.5', selection: 'Under 2.5', odd: 2.80, mise: 0.11, result: 'loss' },
            ] },

          // ── Paderborn vs Karlsruhe (2-2) ──────────────────────────────
          { home: 'SC Paderborn 07', away: 'Karlsruher SC', league: '2. Bundesliga',
            matchDate: '2026-05-08T18:30:00+02:00', finalScore: '2-2',
            bets: [
              { market: '1X2', selection: 'X', odd: 4.90, mise: 0.13, result: 'win' },
            ] },

          // ── FK RFS vs FK Liepaja ──────────────────────────────────────
          { home: 'FK RFS', away: 'FK Liepaja', league: 'Virsliga',
            matchDate: '2026-05-08T19:00:00+02:00',
            bets: [
              { market: '1X2', selection: 'X', odd: 5.10, mise: 0.14, result: 'loss' },
            ] },

          // ── CA Platense vs CA Penarol ────────────────────────────────
          { home: 'CA Platense', away: 'CA Penarol', league: 'CONMEBOL Libertadores',
            matchDate: '2026-05-08T02:00:00+02:00',
            bets: [
              { market: 'O/U 2.5', selection: 'Over 2.5', odd: 2.80, mise: 0.10, result: 'loss' },
              // Cashout: rentré 0.49€ sur 0.54€ → simulé en 'win' avec actualOdd
              // ajustée pour que mise * actualOdd = retour cashout.
              { market: 'O/U 2.5 (cashout)', selection: 'Plus 2.5', odd: 0.49 / 0.54, mise: 0.54, result: 'win' },
            ] },

          // ── Bayern Munich vs Paris SG ────────────────────────────────
          { home: 'Bayern München', away: 'Paris Saint Germain', league: 'UEFA Champions League',
            matchDate: '2026-05-06T21:00:00+02:00',
            bets: [
              { market: 'O/U 2.5', selection: 'Under 2.5', odd: 3.75, mise: 0.17, result: 'win' },
              { market: 'BTTS',     selection: 'Non',         odd: 3.25, mise: 0.18, result: 'loss' },
            ] },

          // ── Al Ahli SC vs Al Fateh ───────────────────────────────────
          { home: 'Al Ahli SC', away: 'Al Fateh', league: 'Saudi Pro League',
            matchDate: '2026-05-06T18:00:00+02:00',
            bets: [
              { market: '1X2',      selection: 'X',         odd: 6.10, mise: 0.24, result: 'loss' },
              { market: 'O/U 2.5', selection: 'Over 2.5', odd: 1.38, mise: 0.30, result: 'win' },
              // Cashout: rentré 0.20€ sur 0.22€
              { market: '1X2 (cashout)', selection: 'X', odd: 0.20 / 0.22, mise: 0.22, result: 'win' },
            ] },
        ];

        // Keep only entries that have at least one pending stake (entry-level
        // OR per-bet) so we don't wipe a currently-active wager. Settled
        // entries are dropped before re-seeding to avoid duplicates.
        const pending = get().entries.filter((e) => {
          const entryPending = Number.isFinite(e.mise) && e.mise > 0 && !e.result;
          const betsPending = Object.values(e.bets || {}).some(
            (b) => Number.isFinite(b.mise) && b.mise > 0 && !b.result
          );
          return entryPending || betsPending;
        });

        let synthFid = -1_000_000;
        const seeded = SEED_BETS.map((m) => {
          const entryBets = {};
          m.bets.forEach((b) => {
            entryBets[`${b.market}::${b.selection}`] = {
              mise: b.mise,
              actualOdd: b.odd,
              modelOdd: b.odd,
              sources: ['shin'],
              result: b.result,
            };
          });
          return {
            fixtureId: synthFid--,
            date: m.matchDate.split('T')[0],
            matchDate: m.matchDate,
            savedAt: m.matchDate,
            homeTeam: m.home,
            awayTeam: m.away,
            league: m.league,
            bets: entryBets,
            result: null,
            finalScore: m.finalScore || null,
            mise: null,
          };
        });

        set({ entries: [...seeded, ...pending] });
      },

      // One-shot patch: fill `matchDate` on existing entries that don't have
      // it (i.e. saved before that field was added). Triggered once at app
      // startup so the historique can show real kickoff dates for old bets.
      // Self-throttled (4/sec) to stay well under the backend rate limiter
      // and silently skips fixtures the API no longer knows.
      backfillMatchDates: async () => {
        const targets = get().entries.filter((e) => !e.matchDate && e.fixtureId);
        if (targets.length === 0) return;
        const { fixturesApi } = await import('../services/api');
        for (const e of targets) {
          try {
            const res = await fixturesApi.getById(e.fixtureId);
            const matchDate = res?.response?.[0]?.fixture?.date;
            if (matchDate) {
              set((s) => ({
                entries: s.entries.map((x) => (x.fixtureId === e.fixtureId ? { ...x, matchDate } : x)),
              }));
            }
          } catch {
            // Fixture no longer in API (purged after season ends, etc.) —
            // leave matchDate null, the row simply won't show a date.
          }
          // eslint-disable-next-line no-await-in-loop
          await new Promise((r) => setTimeout(r, 250));
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
      setBetMise: (fixtureId, betKey, amount, sources, modelOdd) => set((s) => ({
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
            // Capture the system-suggested odd at save time so the historique
            // can show @cote + gains potentiels even when the user skipped
            // entering "Ma cote". Only overwrite if a positive number was
            // supplied — never wipe a previously stored value.
            ...(Number.isFinite(modelOdd) && modelOdd > 0 ? { modelOdd } : {}),
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
        // Walk every entry and count ONLY user-placed bets (not auto-tracked
        // pronos). A bet = top-level mise > 0 OR any per-VB mise > 0.
        // Each per-bet stake also counts as a separate unit so pari multiple
        // sur le même match comptent pour 2 dans Total/Wins/etc.
        const all = get().entries;
        let total = 0;
        let settled = 0;
        let wins = 0;
        let roiSum = 0;
        for (const e of all) {
          // Entry-level pick
          if (Number.isFinite(e.mise) && e.mise > 0) {
            total += 1;
            if (e.result === 'win') {
              settled += 1; wins += 1;
              roiSum += (parseFloat(e.actualOdd || e.odd || 1) - 1);
            } else if (e.result === 'loss') {
              settled += 1;
              roiSum -= 1;
            }
          }
          // Per-VB stakes (each one a separate bet)
          for (const bet of Object.values(e.bets || {})) {
            if (!Number.isFinite(bet.mise) || bet.mise <= 0) continue;
            total += 1;
            if (bet.result === 'win') {
              settled += 1; wins += 1;
              roiSum += (parseFloat(bet.actualOdd || 1) - 1);
            } else if (bet.result === 'loss') {
              settled += 1;
              roiSum -= 1;
            }
          }
        }
        const rate = settled > 0 ? Math.round((wins / settled) * 100) : null;
        return {
          total,
          settled,
          wins,
          losses: settled - wins,
          rate,
          roi: settled > 0 ? parseFloat((roiSum / settled * 100).toFixed(1)) : null,
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
              // Fallback: actualOdd (user-entered "Ma cote") OR modelOdd
              // (system-suggested at save time). Without modelOdd fallback,
              // a winning per-VB bet where user skipped "Ma cote" was counted
              // as push (return = stake, profit = 0) → bankroll sous-évaluée.
              totalMise += bet.mise;
              totalReturn += bet.mise * parseFloat(bet.actualOdd || bet.modelOdd || 1);
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
