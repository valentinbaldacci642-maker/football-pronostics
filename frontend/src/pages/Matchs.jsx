import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, Zap, RefreshCw, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  BarChart2, List, Trophy, X,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import MatchCard from '../components/match/MatchCard';
import CountriesSidebar from '../components/match/CountriesSidebar';
import StandingsView from '../components/leagues/StandingsView';
import { SkeletonCard, EmptyState, ErrorState } from '../components/ui/Loading';
import { fixturesApi } from '../services/api';
import { useLivePolling, isLiveStatus } from '../hooks/useLivePolling';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import clsx from 'clsx';

const PRIORITY_LEAGUE_IDS = [39, 140, 78, 135, 61, 2, 3, 848, 88, 94, 253, 71, 128];

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
  const [expanded, setExpanded] = useState(defaultExpanded);
  const isPriority = PRIORITY_LEAGUE_IDS.includes(league?.id);
  const visible = expanded ? matches : matches.slice(0, 3);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      <button onClick={() => setExpanded((v) => !v)} className="flex items-center gap-3 w-full group">
        {league?.logo ? (
          <img src={league.logo} alt="" className="w-5 h-5 object-contain" />
        ) : (
          <div className="w-5 h-5 rounded bg-dark-600 text-[10px] text-white/30 flex items-center justify-center">⚽</div>
        )}
        <span className={clsx('text-sm font-heading font-bold tracking-wide', isPriority ? 'text-white/80' : 'text-white/45')}>
          {league?.name}
        </span>
        {league?.country && <span className="text-xs text-white/25">{league.country}</span>}
        <div className="flex-1 border-t border-white/5" />
        <span className="text-xs text-white/30 mr-1">{matches.length} match{matches.length > 1 ? 's' : ''}</span>
        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-white/20" /> : <ChevronDown className="w-3.5 h-3.5 text-white/20" />}
      </button>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((fixture) => <MatchCard key={fixture.fixture.id} fixture={fixture} />)}
      </div>
      {!expanded && matches.length > 3 && (
        <button onClick={() => setExpanded(true)} className="text-xs text-white/30 hover:text-white/60 transition-colors w-full text-center py-1">
          + {matches.length - 3} match{matches.length - 3 > 1 ? 's' : ''} de plus
        </button>
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
  const tabParam = searchParams.get('tab') === 'classements' ? 'classements' : 'matchs';
  const setTab = (next) => {
    const sp = new URLSearchParams(searchParams);
    if (next === 'classements') sp.set('tab', 'classements');
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
  const fixtures = selectedLeagueId
    ? allFixtures.filter((f) => f.league?.id === selectedLeagueId)
    : allFixtures;

  const fetchFixtures = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = mode === 'live'
        ? await fixturesApi.getLive()
        : await fixturesApi.getByDate(selectedDate);
      const all = result?.response || [];
      setAllFixtures(all);
      if (mode === 'live') setLiveCount(all.length);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [mode, selectedDate]);

  useEffect(() => { fetchFixtures(); }, [fetchFixtures]);

  const liveMatches = fixtures.filter((f) => isLiveStatus(f.fixture?.status?.short)).length;
  useLivePolling(liveMatches > 0, fetchFixtures, 30000);

  const grouped = groupByLeague(fixtures);
  const totalMatches = fixtures.length;
  const scheduledMatches = fixtures.filter((f) => f.fixture?.status?.short === 'NS').length;
  const finishedMatches = fixtures.filter((f) => ['FT', 'AET', 'PEN'].includes(f.fixture?.status?.short)).length;

  // When a league is picked, also enrich its name from the loaded fixtures
  // so the filter chip shows a real label even if the sidebar passed a stub.
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
                {tabParam === 'classements' ? <>Ligues & <span className="text-brand-400">classements</span></> : <>Tous les <span className="text-brand-400">matchs</span></>}
              </h1>
              <p className="text-sm text-white/35 font-heading font-medium mt-1 capitalize">
                {tabParam === 'classements'
                  ? 'Classements et buteurs'
                  : mode === 'live'
                    ? 'Tous les matchs en direct'
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

          {/* Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setTab('matchs')}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all',
                tabParam === 'matchs'
                  ? 'bg-brand-500/20 border-brand-500/40 text-brand-300'
                  : 'border-white/10 text-white/40 hover:text-white/70'
              )}
            >
              <List className="w-4 h-4" />Matchs
            </button>
            <button
              onClick={() => setTab('classements')}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all',
                tabParam === 'classements'
                  ? 'bg-brand-500/20 border-brand-500/40 text-brand-300'
                  : 'border-white/10 text-white/40 hover:text-white/70'
              )}
            >
              <BarChart2 className="w-4 h-4" />Classements
            </button>
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

                {/* Date navigator */}
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
                    <label className={clsx(
                      'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all relative',
                      mode === 'date' ? 'bg-dark-700 text-white shadow-inset-glow' : 'text-white/50 hover:text-white/80'
                    )}>
                      <Calendar className="w-4 h-4" />
                      <span className="font-heading font-semibold tracking-wide capitalize">{formatDayLabel(selectedDate)}</span>
                      <span className="text-xs text-white/30 font-mono hidden sm:inline">
                        {format(new Date(selectedDate + 'T00:00:00'), 'd MMM', { locale: fr })}
                      </span>
                      <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => { setMode('date'); setSelectedDate(e.target.value); }}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                    </label>
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

                {/* Content */}
                {loading ? (
                  <div className="space-y-6">
                    {[...Array(3)].map((_, gi) => (
                      <div key={gi} className="space-y-3">
                        <div className="h-5 w-40 bg-white/5 rounded animate-pulse" />
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
                        </div>
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
                  <div className="space-y-6">
                    {grouped.map(({ league, matches }, idx) => (
                      <LeagueGroup
                        key={league?.id}
                        league={league}
                        matches={matches}
                        defaultExpanded={idx < 3 || PRIORITY_LEAGUE_IDS.includes(league?.id)}
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
