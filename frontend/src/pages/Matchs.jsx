import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, Zap, RefreshCw, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  BarChart2, List, Trophy, X, History,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import MatchRow from '../components/match/MatchRow';
import CountriesSidebar from '../components/match/CountriesSidebar';
import StandingsView from '../components/leagues/StandingsView';
import { EmptyState, ErrorState } from '../components/ui/Loading';
import { fixturesApi } from '../services/api';
import { useLivePolling, isLiveStatus } from '../hooks/useLivePolling';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import clsx from 'clsx';

// Priority order for the daily list — index 0 = top of the page. International
// trophies (World Cup, Euro…) come first since they're rare and matter to
// everyone; then European club competitions; then top 5 domestic; then major
// national cups; then second-tier European; then the rest. Anything not in
// this list is sorted by match count below (smaller leagues at the bottom).
const PRIORITY_LEAGUE_IDS = [
  // International national-team trophies — when they happen, they're the headline
  1,    // FIFA World Cup
  4,    // UEFA Euro Championship
  9,    // Copa America
  10,   // Friendlies (international)
  5,    // UEFA Nations League
  29,   // World Cup - Qualification (Europe)
  32,   // World Cup - Qualification (Asia)
  31,   // World Cup - Qualification (South America)
  33,   // World Cup - Qualification (Africa)
  34,   // World Cup - Qualification (CONCACAF)

  // European club competitions
  2,    // UEFA Champions League
  3,    // UEFA Europa League
  848,  // UEFA Conference League
  531,  // UEFA Super Cup

  // Top 5 European domestic leagues
  39,   // Premier League
  140,  // La Liga
  78,   // Bundesliga
  135,  // Serie A
  61,   // Ligue 1

  // Major national cups
  45,   // FA Cup
  143,  // Copa del Rey
  137,  // Coppa Italia
  81,   // DFB Pokal
  66,   // Coupe de France
  48,   // EFL Cup

  // Second tier
  40,   // Championship (England)
  62,   // Ligue 2
  79,   // 2. Bundesliga
  136,  // Serie B
  141,  // La Liga 2

  // Other top European leagues
  88,   // Eredivisie
  94,   // Primeira Liga
  144,  // Jupiler Pro League (Belgium)
  203,  // Süper Lig (Turkey)
  179,  // Scottish Premiership

  // South American club + national leagues
  13,   // Copa Libertadores
  11,   // Copa Sudamericana
  71,   // Brasileirão Série A
  128,  // Argentine Liga Profesional

  // Other notable
  253,  // MLS
  307,  // Saudi Pro League
  262,  // Liga MX
];

function localIso(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function formatDayLabel(iso) {
  const todayIso = localIso(new Date());
  const tmw = new Date(); tmw.setDate(tmw.getDate() + 1);
  const tomorrowIso = localIso(tmw);
  const yest = new Date(); yest.setDate(yest.getDate() - 1);
  const yesterdayIso = localIso(yest);
  if (iso === todayIso) return "Aujourd'hui";
  if (iso === tomorrowIso) return 'Demain';
  if (iso === yesterdayIso) return 'Hier';
  const [y, m, d] = iso.split('-').map(Number);
  return format(new Date(y, m - 1, d), 'EEEE d MMM', { locale: fr });
}

function shiftDate(iso, deltaDays) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return date.toISOString().slice(0, 10);
}

// API-Football round labels are inconsistent (English, mixed casing,
// different formats for league vs cup). Translate the common shapes to
// short French labels and pass through anything we don't recognise.
function formatRoundLabel(round) {
  if (!round) return '';
  const m1 = round.match(/^Regular Season\s*-\s*(\d+)$/i);
  if (m1) return `Journée ${m1[1]}`;
  const m2 = round.match(/^Group Stage\s*-\s*(\d+)$/i);
  if (m2) return `Journée ${m2[1]} (poules)`;
  const map = {
    'Round of 16': '1/8 de finale',
    'Round of 32': '1/16 de finale',
    'Quarter-finals': 'Quarts',
    'Quarter Finals': 'Quarts',
    'Semi-finals': 'Demies',
    'Semi Finals': 'Demies',
    'Final': 'Finale',
    '3rd Place Final': '3e place',
    'Preliminary Round': 'Tour préliminaire',
  };
  return map[round] || round;
}

// Extract a numeric ordering hint from a round label. Returns null for
// cup rounds and other non-numbered formats (sort falls back to date).
function roundNumber(round) {
  if (!round) return null;
  const m = round.match(/^(?:Regular Season|Group Stage|1st Round|2nd Round|Playoffs?)\s*-\s*(\d+)$/i);
  return m ? parseInt(m[1], 10) : null;
}

// Bucket fixtures by their league.round. Order:
//   1) If every round in the set has a numeric component (Regular Season - N
//      style), sort by that number — avoids postponed-match shuffle where
//      a 'Journée 30' replay kicks off after 'Journée 34'.
//   2) Otherwise fall back to earliest kickoff in each round (cups,
//      mixed-format datasets).
function groupByRound(fixtures) {
  const map = new Map();
  for (const f of fixtures) {
    const round = f.league?.round || '—';
    if (!map.has(round)) map.set(round, []);
    map.get(round).push(f);
  }
  const arr = Array.from(map.entries()).map(([round, matches]) => {
    matches.sort((a, b) => new Date(a.fixture?.date) - new Date(b.fixture?.date));
    const minDate = matches[0]?.fixture?.date ? new Date(matches[0].fixture.date).getTime() : 0;
    return { round, matches, minDate, num: roundNumber(round) };
  });
  const allNumbered = arr.length > 0 && arr.every((g) => g.num != null);
  arr.sort((a, b) => allNumbered ? a.num - b.num : a.minDate - b.minDate);
  return arr;
}

function groupByLeague(fixtures) {
  const map = {};
  fixtures.forEach((f) => {
    const lid = f.league?.id;
    if (!map[lid]) map[lid] = { league: f.league, matches: [] };
    map[lid].matches.push(f);
  });
  return Object.values(map).sort((a, b) => {
    const pa = PRIORITY_LEAGUE_IDS.indexOf(a.league?.id);
    const pb = PRIORITY_LEAGUE_IDS.indexOf(b.league?.id);
    if (pa !== -1 && pb !== -1) return pa - pb;
    if (pa !== -1) return -1;
    if (pb !== -1) return 1;
    return b.matches.length - a.matches.length;
  });
}

function LeagueGroup({ league, matches, defaultExpanded = false }) {
  // Flashscore-style list: the league acts as a section header with its
  // own collapsible block of rows underneath. Defaults to expanded so the
  // user doesn't have to click each league to see the matches.
  const [expanded, setExpanded] = useState(defaultExpanded);
  const isPriority = PRIORITY_LEAGUE_IDS.includes(league?.id);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="football-card overflow-hidden"
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2.5 w-full px-4 py-2.5 bg-white/[0.03] hover:bg-white/[0.05] transition-colors border-b border-white/[0.04]"
      >
        {league?.logo ? (
          <img src={league.logo} alt="" className="w-4 h-4 object-contain flex-shrink-0" />
        ) : (
          <div className="w-4 h-4 rounded bg-dark-600 text-[10px] text-white/30 flex items-center justify-center flex-shrink-0">⚽</div>
        )}
        {league?.country && <span className="text-[11px] text-white/35 font-heading font-semibold uppercase tracking-wider truncate">{league.country}:</span>}
        <span className={clsx('text-xs font-heading font-bold tracking-wide truncate', isPriority ? 'text-white/90' : 'text-white/65')}>
          {league?.name}
        </span>
        <div className="flex-1" />
        <span className="text-[10px] text-white/30 font-mono">{matches.length}</span>
        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-white/30" /> : <ChevronDown className="w-3.5 h-3.5 text-white/30" />}
      </button>

      {expanded && (
        <div>
          {matches.map((fixture) => (
            <MatchRow key={fixture.fixture.id} fixture={fixture} />
          ))}
        </div>
      )}
    </motion.div>
  );
}

export default function Matchs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const mode = searchParams.get('mode') === 'live' ? 'live' : 'date';
  const setMode = (next) => {
    const sp = new URLSearchParams(searchParams);
    if (next === 'live') sp.set('mode', 'live');
    else sp.delete('mode');
    setSearchParams(sp, { replace: true });
  };
  const rawTab = searchParams.get('tab');
  const tabParam = ['classements', 'calendrier', 'resultats'].includes(rawTab) ? rawTab : 'matchs';
  const setTab = (next) => {
    const sp = new URLSearchParams(searchParams);
    if (next && next !== 'matchs') sp.set('tab', next);
    else sp.delete('tab');
    setSearchParams(sp, { replace: true });
  };

  const [selectedDate, setSelectedDate] = useState(() => localIso(new Date()));
  // selectedLeague is now an OBJECT { id, name, logo, season } so we can pass it
  // straight to the StandingsView's forcedLeague prop. Read leagueParam (id only)
  // from URL for back-compat with deep links from older versions.
  const [selectedLeague, setSelectedLeague] = useState(null);
  const [allFixtures, setAllFixtures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [liveCount, setLiveCount] = useState(0);
  const [sidebarOpenMobile, setSidebarOpenMobile] = useState(false);
  // Round navigator state, used by Calendrier / Résultats to page one
  // round at a time (Journée 35 → 36 etc). null = falls back to the most
  // recent round for résultats, the earliest upcoming for calendrier.
  const [selectedRound, setSelectedRound] = useState(null);
  const dateInputRef = useRef(null);

  // On desktop, clicking a transparent <input type="date"> overlay does
  // not reliably trigger the native picker — Chrome/Edge need an explicit
  // showPicker() call. We call it on label click as a fallback so the
  // user can click the visible label text to open the picker. On mobile
  // the native overlay already works, so showPicker() is just a no-op
  // after the input gains focus.
  const openDatePicker = () => {
    const el = dateInputRef.current;
    if (!el) return;
    try {
      if (typeof el.showPicker === 'function') el.showPicker();
      else el.focus();
    } catch (_) {
      // Older browsers: showPicker may throw if not user-initiated. The
      // overlay handles the click fallback path.
    }
  };

  const leagueParam = searchParams.get('league');
  useEffect(() => {
    if (leagueParam && !selectedLeague) {
      // Minimal stub so the filter applies; StandingsView will gracefully
      // show the picker if user switches to Classements without enough info.
      setSelectedLeague({ id: parseInt(leagueParam), name: '', logo: null, season: new Date().getFullYear() - 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueParam]);

  const selectedLeagueId = selectedLeague?.id ?? null;
  // Reset the round selection whenever the source dataset changes, so the
  // navigator doesn't get stuck on a round that no longer exists after
  // switching league or tab.
  useEffect(() => { setSelectedRound(null); }, [selectedLeagueId, tabParam]);

  // Build {round, matches[], minDate} groups from the loaded fixtures —
  // only meaningful on Calendrier / Résultats (one league, multiple rounds).
  const roundsEnabled = tabParam === 'calendrier' || tabParam === 'resultats';
  const roundGroups = useMemo(
    () => (roundsEnabled ? groupByRound(allFixtures) : []),
    [allFixtures, roundsEnabled]
  );
  // Default round: most recent for Résultats, earliest upcoming for Calendrier.
  // We derive on each render so a stale selectedRound (after a tab switch
  // before the reset effect has fired) doesn't break the navigator.
  const defaultRound = roundGroups.length
    ? (tabParam === 'resultats'
        ? roundGroups[roundGroups.length - 1].round
        : roundGroups[0].round)
    : null;
  const currentRound = selectedRound && roundGroups.some((g) => g.round === selectedRound)
    ? selectedRound
    : defaultRound;
  const currentRoundIdx = roundGroups.findIndex((g) => g.round === currentRound);
  const canPrevRound = currentRoundIdx > 0;
  const canNextRound = currentRoundIdx >= 0 && currentRoundIdx < roundGroups.length - 1;

  // Display either every match (Matchs tab) or only the selected round's
  // matches (Calendrier / Résultats).
  const fixtures = roundsEnabled && currentRound
    ? (roundGroups[currentRoundIdx]?.matches || [])
    : allFixtures;

  const fetchFixtures = useCallback(async () => {
    // Classements tab doesn't use fetchFixtures — StandingsView handles its
    // own data. Calendrier and Résultats only make sense with a league.
    if (tabParam === 'classements') return;
    if ((tabParam === 'calendrier' || tabParam === 'resultats') && !selectedLeagueId) {
      setAllFixtures([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let result;
      if ((tabParam === 'calendrier' || tabParam === 'resultats') && selectedLeagueId) {
        // Fetch the full season's fixtures so the round navigator can
        // page through every Journée, not just the last/next 50 matches.
        // We filter to upcoming vs past client-side below.
        const season = selectedLeague?.season || (new Date().getFullYear() - 1);
        result = await fixturesApi.getByLeagueSeason(selectedLeagueId, season);
      } else if (mode === 'live') {
        result = await fixturesApi.getLive();
      } else if (selectedLeagueId) {
        // Matchs tab + league filter → next 50 upcoming. Keeps the
        // "click league = see real schedule" UX even when staying on Matchs.
        result = await fixturesApi.getUpcomingByLeague(selectedLeagueId, 50);
      } else {
        result = await fixturesApi.getByDate(selectedDate);
      }
      let all = result?.response || [];

      // Calendrier = remaining (NS, scheduled, postponed). Résultats =
      // already-played (FT, AET, PEN, etc.). Live/HT matches show in both
      // since they're 'currently happening' — useful on both views.
      if (tabParam === 'calendrier' && selectedLeagueId) {
        all = all.filter((f) => {
          const s = f.fixture?.status?.short;
          return s === 'NS' || s === 'TBD' || s === 'PST' || isLiveStatus(s);
        });
      } else if (tabParam === 'resultats' && selectedLeagueId) {
        all = all.filter((f) => {
          const s = f.fixture?.status?.short;
          return ['FT', 'AET', 'PEN', 'AWD', 'WO'].includes(s) || isLiveStatus(s);
        });
      }
      setAllFixtures(all);
      if (mode === 'live') setLiveCount(all.length);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [mode, selectedDate, selectedLeagueId, tabParam, selectedLeague?.season]);

  useEffect(() => { fetchFixtures(); }, [fetchFixtures]);

  const liveMatches = fixtures.filter((f) => isLiveStatus(f.fixture?.status?.short)).length;
  useLivePolling(liveMatches > 0, fetchFixtures, 30000);

  const grouped = groupByLeague(fixtures);
  const totalMatches = fixtures.length;
  const scheduledMatches = fixtures.filter((f) => f.fixture?.status?.short === 'NS').length;
  const finishedMatches = fixtures.filter((f) => ['FT', 'AET', 'PEN'].includes(f.fixture?.status?.short)).length;

  // When a league is picked, also enrich its name from the loaded fixtures
  // so the filter chip shows a real label even if the sidebar passed a stub.
  // Picking a league while on the date-based Matchs tab feels intent-mismatched
  // (you wanted to see THAT league's schedule, not today's) — auto-switch to
  // Calendrier so the next-50 upcoming fixtures show immediately.
  const pickLeague = (league) => {
    if (!league) { setSelectedLeague(null); return; }
    const found = allFixtures.find((f) => f.league?.id === league.id)?.league;
    setSelectedLeague({
      id: league.id,
      name: league.name || found?.name || `Ligue ${league.id}`,
      logo: league.logo || found?.logo || null,
      flag: league.flag || null,
      season: league.season || found?.season || (new Date().getFullYear() - 1),
    });
    if (tabParam === 'matchs') setTab('calendrier');
    setSidebarOpenMobile(false);
  };

  const sidebar = (
    <CountriesSidebar
      selectedLeagueId={selectedLeagueId}
      onPickLeague={pickLeague}
      onClearFilter={() => setSelectedLeague(null)}
    />
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-7xl mx-auto">
      <div className="flex gap-6">
        {/* Main content (left) */}
        <div className="flex-1 min-w-0 space-y-5">
          {/* Header + tabs */}
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="font-display text-4xl text-white tracking-wide leading-none">
                {tabParam === 'classements' ? <>Ligues & <span className="text-brand-400">classements</span></>
                  : tabParam === 'calendrier' ? <>Calendrier <span className="text-brand-400">à venir</span></>
                  : tabParam === 'resultats' ? <>Résultats <span className="text-brand-400">récents</span></>
                  : <>Tous les <span className="text-brand-400">matchs</span></>}
              </h1>
              <p className="text-sm text-white/35 font-heading font-medium mt-1 capitalize">
                {tabParam === 'classements'
                  ? 'Classements et buteurs'
                  : tabParam === 'calendrier'
                    ? selectedLeague ? `Prochains matchs · ${selectedLeague.name || ''}` : 'Sélectionne une ligue dans la sidebar'
                  : tabParam === 'resultats'
                    ? selectedLeague ? `Derniers résultats · ${selectedLeague.name || ''}` : 'Sélectionne une ligue dans la sidebar'
                  : mode === 'live'
                    ? 'Tous les matchs en direct'
                    : selectedLeague
                      ? `Matchs à venir · ${selectedLeague.name || 'Ligue sélectionnée'}`
                      : format(new Date(selectedDate + 'T00:00:00'), "EEEE d MMMM yyyy", { locale: fr })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {tabParam === 'matchs' && (
                <button onClick={fetchFixtures} className="btn-ghost !px-2.5 !py-2 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" />
                  <span className="text-xs hidden sm:block">Actualiser</span>
                </button>
              )}
              <button
                onClick={() => setSidebarOpenMobile(true)}
                className="lg:hidden btn-ghost !px-2.5 !py-2 flex items-center gap-2"
                title="Pays & ligues"
              >
                <Trophy className="w-4 h-4" />
                <span className="text-xs">Pays</span>
              </button>
            </div>
          </div>

          {/* Tabs — horizontally scrollable on mobile so Calendrier/Résultats
              don't push Classements off-screen on narrow widths. */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {[
              { id: 'matchs',      label: 'Matchs',      Icon: List },
              { id: 'calendrier',  label: 'Calendrier',  Icon: Calendar },
              { id: 'resultats',   label: 'Résultats',   Icon: History },
              { id: 'classements', label: 'Classements', Icon: BarChart2 },
            ].map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all whitespace-nowrap flex-shrink-0',
                  tabParam === id
                    ? 'bg-brand-500/20 border-brand-500/40 text-brand-300'
                    : 'border-white/10 text-white/40 hover:text-white/70'
                )}
              >
                <Icon className="w-4 h-4" />{label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {tabParam === 'classements' ? (
              <motion.div
                key="classements"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                {/* When a league is preselected via the sidebar, jump straight
                    to its standings. Empty stub → show the picker. */}
                <StandingsView
                  forcedLeague={selectedLeague && selectedLeague.name ? selectedLeague : null}
                />
              </motion.div>
            ) : (
              <motion.div
                key="matchs"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-5"
              >
                {/* Stats bar */}
                {!loading && fixtures.length > 0 && (
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: 'Total', value: totalMatches, color: 'text-white' },
                      { label: 'En direct', value: liveMatches, color: 'text-red-400' },
                      { label: 'À venir', value: scheduledMatches, color: 'text-brand-400' },
                      { label: 'Terminés', value: finishedMatches, color: 'text-white/30' },
                    ].map((s) => (
                      <div key={s.label} className="glass-card px-3 py-2.5 text-center">
                        <p className={`stat-number text-xl tabular-nums ${s.color}`}>{s.value}</p>
                        <p className="text-[11px] text-white/25 font-heading font-medium">{s.label}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Date navigator — only relevant on the date-based Matchs
                    tab when no league filter is active. Calendrier/Résultats
                    use next/last-N fetches so the date picker doesn't apply. */}
                {!selectedLeague && tabParam === 'matchs' && (
                <div className="flex flex-col gap-2">
                  <div className={clsx(
                    'flex items-stretch gap-1 p-1 bg-dark-800 rounded-xl border transition-colors',
                    mode === 'date' ? 'border-brand-500/30' : 'border-white/[0.08]'
                  )}>
                    <button
                      onClick={() => { setMode('date'); setSelectedDate(shiftDate(selectedDate, -1)); }}
                      className="flex items-center justify-center w-10 rounded-lg text-white/50 hover:text-white hover:bg-dark-700 transition-all"
                      title="Jour précédent"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={openDatePicker}
                      className={clsx(
                        'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all relative',
                        mode === 'date' ? 'bg-dark-700 text-white shadow-inset-glow' : 'text-white/50 hover:text-white/80'
                      )}
                    >
                      <Calendar className="w-4 h-4" />
                      <span className="font-heading font-semibold tracking-wide capitalize">{formatDayLabel(selectedDate)}</span>
                      <span className="text-xs text-white/30 font-mono hidden sm:inline">
                        {format(new Date(selectedDate + 'T00:00:00'), 'd MMM', { locale: fr })}
                      </span>
                      {/* The actual <input type="date"> is overlaid invisibly so
                          the OS-level picker still attaches to the same hit area.
                          On desktop the button onClick → showPicker() handles
                          the case where browsers don't react to overlay clicks. */}
                      <input
                        ref={dateInputRef}
                        type="date"
                        value={selectedDate}
                        onChange={(e) => { setMode('date'); setSelectedDate(e.target.value); }}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        tabIndex={-1}
                        aria-hidden="true"
                      />
                    </button>
                    <button
                      onClick={() => { setMode('date'); setSelectedDate(shiftDate(selectedDate, 1)); }}
                      className="flex items-center justify-center w-10 rounded-lg text-white/50 hover:text-white hover:bg-dark-700 transition-all"
                      title="Jour suivant"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>

                  <button
                    onClick={() => setMode(mode === 'live' ? 'date' : 'live')}
                    className={clsx(
                      'flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-heading font-semibold border transition-all',
                      mode === 'live'
                        ? 'bg-red-500/15 border-red-500/40 text-red-300 shadow-inset-glow'
                        : 'bg-dark-800 border-white/[0.08] text-white/50 hover:text-white hover:border-white/15'
                    )}
                  >
                    <span className={clsx('w-2 h-2 rounded-full', liveCount > 0 ? 'bg-red-500 animate-live-dot' : 'bg-white/20')} />
                    <Zap className="w-3.5 h-3.5" />
                    <span>En direct</span>
                    {liveCount > 0 && <span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full font-mono">{liveCount}</span>}
                  </button>
                </div>
                )}

                {/* Active league filter chip */}
                {selectedLeague && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-brand-500/10 border border-brand-500/30 rounded-xl">
                    {selectedLeague.logo
                      ? <img src={selectedLeague.logo} alt="" className="w-4 h-4 object-contain" />
                      : selectedLeague.flag
                        ? <span className="text-sm">{selectedLeague.flag}</span>
                        : <Trophy className="w-3.5 h-3.5 text-brand-300" />}
                    <span className="text-xs font-heading font-semibold text-brand-200 flex-1 truncate">
                      Filtré sur : {selectedLeague.name}
                    </span>
                    <button
                      onClick={() => setSelectedLeague(null)}
                      className="p-1 rounded hover:bg-brand-500/20 text-brand-300"
                      title="Effacer le filtre"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Round navigator (Calendrier / Résultats only). Hidden when
                    the dataset only has one round — no point in left/right
                    arrows if there's nothing to navigate to. */}
                {roundsEnabled && selectedLeague && roundGroups.length > 1 && (
                  <div className="flex items-stretch gap-1 p-1 bg-dark-800 rounded-xl border border-white/[0.08]">
                    <button
                      onClick={() => canPrevRound && setSelectedRound(roundGroups[currentRoundIdx - 1].round)}
                      disabled={!canPrevRound}
                      className="flex items-center justify-center w-10 rounded-lg text-white/50 hover:text-white hover:bg-dark-700 disabled:text-white/15 disabled:hover:bg-transparent transition-all"
                      title="Journée précédente"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-white">
                      <span className="font-heading font-semibold tracking-wide">
                        {formatRoundLabel(currentRound) || 'Journée'}
                      </span>
                      {currentRoundIdx >= 0 && (
                        <span className="text-xs text-white/30 font-mono">
                          {currentRoundIdx + 1}/{roundGroups.length}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => canNextRound && setSelectedRound(roundGroups[currentRoundIdx + 1].round)}
                      disabled={!canNextRound}
                      className="flex items-center justify-center w-10 rounded-lg text-white/50 hover:text-white hover:bg-dark-700 disabled:text-white/15 disabled:hover:bg-transparent transition-all"
                      title="Journée suivante"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                )}

                {/* Empty state: Calendrier/Résultats need a league filter.
                    Direct the user to the right sidebar / mobile drawer. */}
                {(tabParam === 'calendrier' || tabParam === 'resultats') && !selectedLeague ? (
                  <EmptyState
                    title="Sélectionne une ligue"
                    subtitle={tabParam === 'calendrier'
                      ? 'Le calendrier affiche les prochains matchs d’une ligue ou compétition. Choisis-en une dans la liste à droite.'
                      : 'Les résultats affichent les derniers matchs d’une ligue ou compétition. Choisis-en une dans la liste à droite.'}
                    icon={tabParam === 'calendrier' ? '📅' : '🏁'}
                  />
                ) : loading ? (
                  <div className="space-y-3">
                    {[...Array(4)].map((_, gi) => (
                      <div key={gi} className="football-card overflow-hidden">
                        <div className="h-9 bg-white/[0.04] border-b border-white/[0.04]" />
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className="h-14 border-b border-white/[0.03] animate-pulse" />
                        ))}
                      </div>
                    ))}
                  </div>
                ) : error ? (
                  <ErrorState message={error} onRetry={fetchFixtures} />
                ) : fixtures.length === 0 ? (
                  <EmptyState
                    title="Aucun match trouvé"
                    subtitle={selectedLeague ? "Aucun match pour cette ligue à cette date" : "Essayez une autre date"}
                    icon="⚽"
                  />
                ) : (
                  <div className="space-y-3">
                    {grouped.map(({ league, matches }) => (
                      <LeagueGroup
                        key={league?.id}
                        league={league}
                        matches={matches}
                        defaultExpanded={true}
                      />
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sidebar (right, desktop only) */}
        <div className="hidden lg:block w-72 flex-shrink-0">
          <div className="sticky top-24">
            {sidebar}
          </div>
        </div>
      </div>

      {/* Mobile sidebar drawer */}
      <AnimatePresence>
        {sidebarOpenMobile && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              onClick={() => setSidebarOpenMobile(false)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
              className="lg:hidden fixed inset-y-0 right-0 z-50 w-80 max-w-[90vw] bg-dark-900 border-l border-white/10 p-4 overflow-y-auto"
              style={{ paddingTop: 'calc(80px + env(safe-area-inset-top, 0px))', paddingBottom: 'calc(7rem + env(safe-area-inset-bottom, 0px))' }}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-heading font-bold text-white/80">Pays & ligues</span>
                <button onClick={() => setSidebarOpenMobile(false)} className="p-1.5 rounded-lg hover:bg-white/[0.05]">
                  <X className="w-4 h-4 text-white/60" />
                </button>
              </div>
              {sidebar}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
