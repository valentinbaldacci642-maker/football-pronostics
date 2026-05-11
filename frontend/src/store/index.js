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
 *   - 'standard'    : only pick value bets with edge ≥ 6% (recommended — laisse
 *                     marge pour la perte d'edge sur Unibet.fr vs consensus)
 *   - 'aggressive'  : show all pronostics including non-value picks (more volume)
 */
export const EDGE_MODE_THRESHOLD = {
  conservative: 8,
  standard: 6,
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

      // One-shot manual import (v3): tous les paris des screenshots Unibet
      // en historique terminé. Cashouts: result='cashout' avec cashoutReturn.
      // Aucun pari pending : tout est settled, donc pas de risque que le
      // backfill matche le mauvais fixture (cf bug Benfica/Braga U23).
      seedUnibetBets: () => {
        const SEED = [
          // Benfica vs Braga — Primeira Liga — 11/05 FT 2-2 → X win
          { home: 'Benfica', away: 'Sporting Braga', league: 'Liga Portugal',
            matchDate: '2026-05-11T21:15:00+02:00', finalScore: '2-2',
            bets: [{ market: '1X2', selection: 'X', odd: 4.45, mise: 0.13, result: 'win' }] },

          // Rennes vs Paris FC — Ligue 1 — 10/05 — cashout + loss
          { home: 'Rennes', away: 'Paris FC', league: 'Ligue 1',
            matchDate: '2026-05-10T21:00:00+02:00', finalScore: '2-1',
            bets: [
              { market: '1X2 Live', selection: '2', odd: 5.20, mise: 0.16, result: 'cashout', cashoutReturn: 0.12 },
              { market: '1X2',      selection: '2', odd: 5.20, mise: 0.16, result: 'loss' },
            ] },

          // Paris SG vs Brest — Ligue 1 — 10/05
          { home: 'Paris Saint Germain', away: 'Brest', league: 'Ligue 1',
            matchDate: '2026-05-10T20:45:00+02:00', finalScore: '1-0',
            bets: [{ market: 'O/U 2.5', selection: 'Under 2.5', odd: 3.00, mise: 0.13, result: 'win' }] },

          // FC Barcelona vs Real Madrid — LaLiga — 10/05
          { home: 'FC Barcelona', away: 'Real Madrid', league: 'LaLiga',
            matchDate: '2026-05-10T21:00:00+02:00',
            bets: [{ market: 'O/U 2.5', selection: 'Under 2.5', odd: 3.40, mise: 0.16, result: 'win' }] },

          // Real Oviedo vs Getafe — LaLiga — 10/05
          { home: 'Real Oviedo', away: 'Getafe', league: 'LaLiga',
            matchDate: '2026-05-10T18:30:00+02:00',
            bets: [{ market: 'O/U 2.5', selection: 'Over 2.5', odd: 3.25, mise: 0.29, result: 'loss' }] },

          // Twente vs Sparta Rotterdam — Eredivisie — 10/05
          { home: 'Twente', away: 'Sparta Rotterdam', league: 'Eredivisie',
            matchDate: '2026-05-10T16:45:00+02:00',
            bets: [{ market: '1X2', selection: 'X', odd: 4.95, mise: 0.14, result: 'loss' }] },

          // GOAhead Eagles vs PSV — Eredivisie — 10/05
          { home: 'GOAhead Eagles', away: 'PSV Eindhoven', league: 'Eredivisie',
            matchDate: '2026-05-10T16:45:00+02:00',
            bets: [{ market: 'O/U 2.5', selection: 'Under 2.5', odd: 3.00, mise: 0.10, result: 'loss' }] },

          // Hellas Verona vs Como — Serie A — 10/05
          { home: 'Hellas Verona', away: 'Como', league: 'Serie A',
            matchDate: '2026-05-10T12:30:00+02:00',
            bets: [{ market: '1X2', selection: 'X', odd: 4.50, mise: 0.14, result: 'loss' }] },

          // Lecce vs Juventus Turin — Serie A — 09/05
          { home: 'Lecce', away: 'Juventus', league: 'Serie A',
            matchDate: '2026-05-09T20:45:00+02:00',
            bets: [{ market: '1X2', selection: 'X', odd: 4.50, mise: 0.15, result: 'loss' }] },

          // Chicago Fire vs NY Red Bulls — MLS — 09/05
          { home: 'Chicago Fire', away: 'NY Red Bulls', league: 'MLS',
            matchDate: '2026-05-09T20:30:00+02:00',
            bets: [{ market: '1X2', selection: '2', odd: 4.75, mise: 0.11, result: 'win' }] },

          // Reims vs Pau — Ligue 2 — 09/05
          { home: 'Reims', away: 'Pau', league: 'Ligue 2',
            matchDate: '2026-05-09T20:00:00+02:00',
            bets: [{ market: '1X2', selection: 'X', odd: 4.90, mise: 0.14, result: 'loss' }] },

          // St Etienne vs Amiens — Ligue 2 — 09/05
          { home: 'Saint Etienne', away: 'Amiens', league: 'Ligue 2',
            matchDate: '2026-05-09T20:00:00+02:00',
            bets: [{ market: 'O/U 2.5', selection: 'Under 2.5', odd: 2.90, mise: 0.10, result: 'loss' }] },

          // Wolfsburg vs Bayern Munich — Bundesliga — 09/05 — 3 paris
          { home: 'VfL Wolfsburg', away: 'Bayern München', league: 'Bundesliga',
            matchDate: '2026-05-09T18:30:00+02:00',
            bets: [
              { market: '1X2',      selection: '1',         odd: 4.80, mise: 0.14, result: 'loss' },
              { market: 'O/U 2.5', selection: 'Under 2.5', odd: 3.20, mise: 0.11, result: 'win' },
              { market: '1X2',      selection: 'X',         odd: 4.90, mise: 0.15, result: 'loss' },
            ] },

          // Manchester City vs Brentford — Premier League — 09/05
          { home: 'Manchester City', away: 'Brentford', league: 'Premier League',
            matchDate: '2026-05-09T18:30:00+02:00',
            bets: [{ market: 'O/U 2.5', selection: 'Under 2.5', odd: 2.80, mise: 0.14, result: 'loss' }] },

          // Hoffenheim vs Werder Bremen — Bundesliga — 09/05
          { home: 'Hoffenheim', away: 'Werder Bremen', league: 'Bundesliga',
            matchDate: '2026-05-09T15:30:00+02:00',
            bets: [{ market: '1X2', selection: 'X', odd: 4.90, mise: 0.13, result: 'loss' }] },

          // RB Leipzig vs FC St. Pauli — Bundesliga — 09/05
          { home: 'RB Leipzig', away: 'FC St. Pauli', league: 'Bundesliga',
            matchDate: '2026-05-09T15:30:00+02:00',
            bets: [{ market: '1X2', selection: 'X', odd: 5.80, mise: 0.20, result: 'loss' }] },

          // Stuttgart vs Leverkusen — Bundesliga — 09/05
          { home: 'Stuttgart', away: 'Bayer Leverkusen', league: 'Bundesliga',
            matchDate: '2026-05-09T15:30:00+02:00',
            bets: [{ market: 'O/U 2.5', selection: 'Under 2.5', odd: 2.90, mise: 0.10, result: 'loss' }] },

          // Gwangju FC vs Gangwon FC — K League — 09/05
          { home: 'Gwangju FC', away: 'Gangwon FC', league: 'K League 1',
            matchDate: '2026-05-09T09:30:00+02:00',
            bets: [{ market: '1X2', selection: 'X', odd: 4.15, mise: 0.10, result: 'win' }] },

          // Lens vs Nantes — Ligue 1 — 08/05
          { home: 'Lens', away: 'Nantes', league: 'Ligue 1',
            matchDate: '2026-05-08T20:45:00+02:00',
            bets: [{ market: '1X2', selection: 'X', odd: 5.10, mise: 0.20, result: 'loss' }] },

          // Dortmund vs Eintracht Frankfurt — Bundesliga — 08/05
          { home: 'Borussia Dortmund', away: 'Eintracht Frankfurt', league: 'Bundesliga',
            matchDate: '2026-05-08T20:30:00+02:00',
            bets: [
              { market: '1X2',      selection: 'X',         odd: 4.80, mise: 0.16, result: 'loss' },
              { market: 'O/U 2.5', selection: 'Under 2.5', odd: 2.80, mise: 0.11, result: 'loss' },
            ] },

          // Paderborn vs Karlsruhe — Bundesliga 2 — 08/05
          { home: 'SC Paderborn 07', away: 'Karlsruher SC', league: '2. Bundesliga',
            matchDate: '2026-05-08T18:30:00+02:00',
            bets: [{ market: '1X2', selection: 'X', odd: 4.90, mise: 0.13, result: 'win' }] },

          // FK RFS vs FK Liepaja — Virsliga — 08/05
          { home: 'FK RFS', away: 'FK Liepaja', league: 'Virsliga',
            matchDate: '2026-05-08T18:00:00+02:00',
            bets: [{ market: '1X2', selection: 'X', odd: 5.10, mise: 0.14, result: 'loss' }] },

          // CA Platense vs CA Penarol — Libertadores — 08/05
          { home: 'CA Platense', away: 'CA Penarol', league: 'CONMEBOL Libertadores',
            matchDate: '2026-05-08T02:00:00+02:00',
            bets: [
              { market: 'O/U 2.5',     selection: 'Over 2.5', odd: 2.80, mise: 0.10, result: 'loss' },
              { market: 'O/U Platense', selection: 'Over 2.5', odd: 4.80, mise: 0.54, result: 'cashout', cashoutReturn: 0.49 },
            ] },

          // Bayern Munich vs Paris SG — UCL — 06/05
          { home: 'Bayern München', away: 'Paris Saint Germain', league: 'UEFA Champions League',
            matchDate: '2026-05-06T21:00:00+02:00',
            bets: [
              { market: 'O/U 2.5', selection: 'Under 2.5', odd: 3.75, mise: 0.17, result: 'win' },
              { market: 'BTTS',     selection: 'Non',         odd: 3.25, mise: 0.18, result: 'loss' },
            ] },

          // Al Ahli SC vs Al Fateh — Saudi Pro — 06/05
          { home: 'Al Ahli SC', away: 'Al Fateh', league: 'Saudi Pro League',
            matchDate: '2026-05-06T20:00:00+02:00',
            bets: [
              { market: '1X2',      selection: 'X',         odd: 6.10, mise: 0.24, result: 'loss' },
              { market: 'O/U 2.5', selection: 'Over 2.5', odd: 1.38, mise: 0.30, result: 'win' },
              { market: '1X2 (cashout)', selection: 'X', odd: 5.50, mise: 0.22, result: 'cashout', cashoutReturn: 0.20 },
            ] },
        ];

        let synthFid = -3_000_000;
        const seeded = SEED.map((m) => {
          const entryBets = {};
          m.bets.forEach((b) => {
            entryBets[`${b.market}::${b.selection}`] = {
              mise: b.mise,
              actualOdd: b.odd,
              modelOdd: b.odd,
              sources: ['shin'],
              ...(b.result ? { result: b.result } : {}),
              ...(b.cashoutReturn !== undefined ? { cashoutReturn: b.cashoutReturn } : {}),
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

        set({ entries: seeded });
      },

      // One-shot patch: re-link entries with synthetic / negative fixtureId
      // to a real API fixture by matching team names against /fixtures?date=.
      // Used after a manual seed (the import-Unibet button) so the resolver
      // can actually grade the seeded pending bets when their match ends.
      // Settled entries with synthetic IDs are left alone — no point re-
      // linking them, their result is already known.
      backfillSyntheticFixtureIds: async () => {
        const targets = get().entries.filter((e) => {
          if (e.fixtureId > 0) return false;
          // Only re-link entries that still have at least one unresolved
          // staked bet — otherwise it's a settled seed, leave it alone.
          const hasUnresolvedStake = (Number.isFinite(e.mise) && e.mise > 0 && !e.result)
            || Object.values(e.bets || {}).some((b) => Number.isFinite(b.mise) && b.mise > 0 && !b.result);
          if (!hasUnresolvedStake) return false;
          if (!e.matchDate) return false;
          return true;
        });
        if (targets.length === 0) return;
        const { fixturesApi } = await import('../services/api');

        // Cache of fixtures-by-date queries so multiple targets on the same
        // day only cost one API hit.
        const fixturesByDate = new Map();
        // Normalisation : enlève accents, espaces, ponctuation, ET tous les
        // suffixes/préfixes de catégories d'âge ou réserves (U23, U21, U19,
        // II, 'b' final…). Sans ça, 'Benfica' matche 'Benfica U23' et le
        // résolveur grade le mauvais match (U23 fini en pénos pendant que
        // le senior est encore au 17ᵉ — bug réel observé sur Benfica/Braga).
        const norm = (s) => (s || '')
          .toLowerCase()
          .normalize('NFD').replace(/[̀-ͯ]/g, '')
          .replace(/\bu\s?\d{2}\b/g, '')   // U23, U21, U19, U17…
          .replace(/\b(reserve|reserves|youth|junior|jr)\b/g, '')
          .replace(/[^a-z0-9]/g, '');
        // Strict equality après normalisation — pas de includes() qui faisait
        // matcher 'benfica' avec 'benficab' (B team) ou 'benficareserves'.
        const teamMatches = (a, b) => {
          const na = norm(a); const nb = norm(b);
          return na.length >= 3 && na === nb;
        };
        // Categories à exclure quand le seed n'a pas spécifié — protège
        // contre le matching accidentel d'un match de réserve.
        const isReserveOrYouthLeague = (name) => {
          const n = (name || '').toLowerCase();
          return /\b(u23|u21|u19|u17|youth|reserve|junior|primavera|sub-?\d+|revel[aâ]?[cç][aã]o)\b/.test(n)
            || / ii\b/.test(n) || / b\b/.test(n);
        };

        for (const e of targets) {
          const day = e.matchDate.split('T')[0];
          try {
            if (!fixturesByDate.has(day)) {
              const res = await fixturesApi.getByDate(day);
              fixturesByDate.set(day, res?.response || []);
            }
            const list = fixturesByDate.get(day).filter(
              (f) => !isReserveOrYouthLeague(f.league?.name),
            );
            const real = list.find(
              (f) => teamMatches(f.teams?.home?.name, e.homeTeam) && teamMatches(f.teams?.away?.name, e.awayTeam),
            );
            if (real) {
              const realId = real.fixture?.id;
              const realDate = real.fixture?.date;
              const oldId = e.fixtureId;
              set((s) => ({
                entries: s.entries.map((x) => (x.fixtureId === oldId
                  ? { ...x, fixtureId: realId, matchDate: realDate || x.matchDate }
                  : x)),
              }));
            }
          } catch {
            // ignore — try the next one
          }
          // eslint-disable-next-line no-await-in-loop
          await new Promise((r) => setTimeout(r, 250));
        }
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

      // Closing odd for a per-VB bet — the odd available just before kickoff.
      // Comparing actualOdd to closingOdd gives Closing Line Value (CLV) which
      // is the gold-standard proof of edge: positive CLV on average means the
      // user systematically gets better-than-market prices, i.e. has a real
      // edge regardless of short-term win/loss variance.
      setBetClosingOdd: (fixtureId, betKey, value) => set((s) => ({
        entries: s.entries.map((e) => {
          if (e.fixtureId !== fixtureId) return e;
          const next = parseFloat(value);
          const bets = { ...(e.bets || {}) };
          const cur = bets[betKey] || {};
          bets[betKey] = {
            ...cur,
            closingOdd: value === '' || !Number.isFinite(next) || next <= 0 ? null : next,
          };
          return { ...e, bets };
        }),
      })),

      // Aggregate CLV stats — average CLV across all per-VB bets that have
      // BOTH an actualOdd (or fallback modelOdd) AND a closingOdd. Result is
      // in % (e.g. +2.4 means user got 2.4% better odds than the closing line
      // on average, which is consistent with a +EV strategy).
      getCLVStats: () => {
        let totalClv = 0;
        let count = 0;
        let positive = 0;
        for (const e of get().entries) {
          for (const bet of Object.values(e.bets || {})) {
            if (!Number.isFinite(bet.mise) || bet.mise <= 0) continue;
            const got = parseFloat(bet.actualOdd || bet.modelOdd || 0);
            const close = parseFloat(bet.closingOdd || 0);
            if (!got || !close) continue;
            const clv = ((got / close) - 1) * 100;
            totalClv += clv;
            count += 1;
            if (clv >= 0) positive += 1;
          }
        }
        return {
          count,
          positive,
          avg: count > 0 ? totalClv / count : null,
        };
      },

      // Mark a per-VB bet as cashed out. `cashoutReturn` is the actual amount
      // returned by the bookmaker (in €). The PnL is then cashoutReturn - mise
      // and may be positive or negative.
      setBetCashout: (fixtureId, betKey, cashoutReturn) => set((s) => ({
        entries: s.entries.map((e) => {
          if (e.fixtureId !== fixtureId) return e;
          const v = parseFloat(cashoutReturn);
          if (!Number.isFinite(v) || v < 0) return e;
          const bets = { ...(e.bets || {}) };
          const cur = bets[betKey] || {};
          bets[betKey] = { ...cur, result: 'cashout', cashoutReturn: v };
          return { ...e, bets };
        }),
      })),

      // Undo a cashout (or any result) on a per-VB bet, putting it back into
      // the pending pool. Used when the user clicked the wrong button.
      clearBetResult: (fixtureId, betKey) => set((s) => ({
        entries: s.entries.map((e) => {
          if (e.fixtureId !== fixtureId) return e;
          const bets = { ...(e.bets || {}) };
          const cur = bets[betKey] || {};
          const { result, cashoutReturn, ...rest } = cur;
          bets[betKey] = rest;
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
            } else if (bet.result === 'cashout') {
              // Cashout: l'utilisateur a cash-out à un montant donné.
              // totalReturn = cashoutReturn (ce que le bookmaker a payé).
              // Le PnL = cashoutReturn - mise, peut être positif ou négatif.
              totalMise += bet.mise;
              totalReturn += Number.isFinite(bet.cashoutReturn) ? bet.cashoutReturn : 0;
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
