import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Zap, Clock, RefreshCw, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import MatchCard from '../components/match/MatchCard';
import { SkeletonCard, EmptyState, ErrorState } from '../components/ui/Loading';
import { fixturesApi } from '../services/api';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import clsx from 'clsx';

const PRIORITY_LEAGUE_IDS = [39, 140, 78, 135, 61, 2, 3, 848, 88, 94, 253, 71, 128];

// Format helper: compare ISO date strings ('YYYY-MM-DD') directly to avoid
// any local-vs-UTC offset issues from new Date()/.toISOString() round-trips.
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
  // Build a local-anchored Date for the format() call so the day name matches the ISO date
  const [y, m, d] = iso.split('-').map(Number);
  return format(new Date(y, m - 1, d), 'EEEE d MMM', { locale: fr });
}

function shiftDate(iso, deltaDays) {
  // Build the date in UTC so the round-trip via toISOString() doesn't shift
  // by the user's local-vs-UTC offset (e.g. Paris UTC+1/+2 was making
  // shiftDate('2026-05-05', +1) return '2026-05-05').
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return date.toISOString().slice(0, 10);
}

const LEAGUE_FILTERS = [
  { id: null, name: 'Toutes', flag: null },
  { id: 39, name: 'Premier League', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { id: 140, name: 'La Liga', flag: '🇪🇸' },
  { id: 78, name: 'Bundesliga', flag: '🇩🇪' },
  { id: 135, name: 'Serie A', flag: '🇮🇹' },
  { id: 61, name: 'Ligue 1', flag: '🇫🇷' },
  { id: 2, name: 'Champions League', flag: '🏆' },
  { id: 3, name: 'Europa League', flag: '🟠' },
  { id: 848, name: 'Conference League', flag: '🌍' },
  { id: 40, name: 'Championship', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { id: 62, name: 'Ligue 2', flag: '🇫🇷' },
];

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
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-3 w-full group"
      >
        {league?.logo ? (
          <img src={league.logo} alt="" className="w-5 h-5 object-contain" />
        ) : (
          <div className="w-5 h-5 rounded bg-dark-600 text-[10px] text-white/30 flex items-center justify-center">⚽</div>
        )}
        <span className={clsx('text-sm font-heading font-bold tracking-wide', isPriority ? 'text-white/80' : 'text-white/45')}>
          {league?.name}
        </span>
        {league?.country && (
          <span className="text-xs text-white/25">{league.country}</span>
        )}
        <div className="flex-1 border-t border-white/5" />
        <span className="text-xs text-white/30 mr-1">{matches.length} match{matches.length > 1 ? 's' : ''}</span>
        {expanded
          ? <ChevronUp className="w-3.5 h-3.5 text-white/20" />
          : <ChevronDown className="w-3.5 h-3.5 text-white/20" />
        }
      </button>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((fixture) => (
          <MatchCard key={fixture.fixture.id} fixture={fixture} />
        ))}
      </div>

      {!expanded && matches.length > 3 && (
        <button
          onClick={() => setExpanded(true)}
          className="text-xs text-white/30 hover:text-white/60 transition-colors w-full text-center py-1"
        >
          + {matches.length - 3} match{matches.length - 3 > 1 ? 's' : ''} de plus
        </button>
      )}
    </motion.div>
  );
}

export default function Matchs() {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState('date'); // 'date' or 'live'
  // Use the user's local date for the initial selection — toISOString() would
  // give UTC date which may be off by 1 day (e.g. 23:30 Paris time = next day UTC).
  const [selectedDate, setSelectedDate] = useState(() => localIso(new Date()));
  const [selectedLeague, setSelectedLeague] = useState(null);
  const [allFixtures, setAllFixtures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [liveCount, setLiveCount] = useState(0);

  const leagueParam = searchParams.get('league');
  useEffect(() => {
    if (leagueParam) setSelectedLeague(parseInt(leagueParam));
  }, [leagueParam]);

  const fixtures = selectedLeague
    ? allFixtures.filter((f) => f.league?.id === selectedLeague)
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

  useEffect(() => {
    fetchFixtures();
  }, [fetchFixtures]);

  useEffect(() => {
    if (mode !== 'live') return;
    const interval = setInterval(fetchFixtures, 90000);
    return () => clearInterval(interval);
  }, [mode, fetchFixtures]);

  const grouped = groupByLeague(fixtures);

  const totalMatches = fixtures.length;
  const liveMatches = fixtures.filter((f) => {
    const s = f.fixture?.status?.short;
    return ['1H', '2H', 'ET', 'BT', 'P'].includes(s);
  }).length;
  const scheduledMatches = fixtures.filter((f) => f.fixture?.status?.short === 'NS').length;
  const finishedMatches = fixtures.filter((f) => ['FT', 'AET', 'PEN'].includes(f.fixture?.status?.short)).length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-5 max-w-5xl xl:max-w-7xl mx-auto"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-4xl text-white tracking-wide leading-none">Tous les <span className="text-brand-400">matchs</span></h1>
          <p className="text-sm text-white/35 font-heading font-medium mt-1 capitalize">
            {mode === 'live'
              ? 'Tous les matchs en direct'
              : format(new Date(selectedDate + 'T00:00:00'), "EEEE d MMMM yyyy", { locale: fr })}
          </p>
        </div>
        <button onClick={fetchFixtures} className="btn-ghost !px-2.5 !py-2 flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          <span className="text-xs hidden sm:block">Actualiser</span>
        </button>
      </div>

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

      {/* Date navigator: ◀ [date · clickable picker] ▶ */}
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
            <span className="font-heading font-semibold tracking-wide capitalize">
              {formatDayLabel(selectedDate)}
            </span>
            <span className="text-xs text-white/30 font-mono hidden sm:inline">
              {format(new Date(selectedDate + 'T00:00:00'), 'd MMM', { locale: fr })}
            </span>
            {/* Native date picker overlaid for tap, fully transparent */}
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

        {/* En direct toggle, on its own line below the date row */}
        <button
          onClick={() => setMode('live')}
          className={clsx(
            'flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-heading font-semibold border transition-all',
            mode === 'live'
              ? 'bg-red-500/15 border-red-500/40 text-red-300 shadow-inset-glow'
              : 'bg-dark-800 border-white/[0.08] text-white/50 hover:text-white hover:border-white/15'
          )}
        >
          <span className={clsx(
            'w-2 h-2 rounded-full',
            liveCount > 0 ? 'bg-red-500 animate-live-dot' : 'bg-white/20'
          )} />
          <Zap className="w-3.5 h-3.5" />
          <span>En direct</span>
          {liveCount > 0 && (
            <span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full font-mono">{liveCount}</span>
          )}
        </button>
      </div>

      {/* League filter */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {LEAGUE_FILTERS.map((league) => (
          <button
            key={league.id ?? 'all'}
            onClick={() => setSelectedLeague(league.id)}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all whitespace-nowrap',
              selectedLeague === league.id
                ? 'bg-brand-500/20 border-brand-500/40 text-brand-300'
                : 'border-white/5 text-white/40 hover:text-white/70 hover:bg-white/5'
            )}
          >
            {league.flag && <span>{league.flag}</span>}
            {league.name}
          </button>
        ))}
      </div>

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
          subtitle={selectedLeague ? "Aucun match pour cette ligue" : "Essayez une autre date"}
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
  );
}
