import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Zap, Clock, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import MatchCard from '../components/match/MatchCard';
import { SkeletonCard, EmptyState, ErrorState } from '../components/ui/Loading';
import { fixturesApi } from '../services/api';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import clsx from 'clsx';

const TABS = [
  { id: 'today', label: "Aujourd'hui", icon: Clock },
  { id: 'live', label: 'En direct', icon: Zap },
  { id: 'tomorrow', label: 'Demain', icon: Calendar },
];

const PRIORITY_LEAGUE_IDS = [39, 140, 78, 135, 61, 2, 3, 88, 94, 253, 71, 128];

const LEAGUE_FILTERS = [
  { id: null, name: 'Toutes', flag: null },
  { id: 39, name: 'Premier League', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { id: 140, name: 'La Liga', flag: '🇪🇸' },
  { id: 78, name: 'Bundesliga', flag: '🇩🇪' },
  { id: 135, name: 'Serie A', flag: '🇮🇹' },
  { id: 61, name: 'Ligue 1', flag: '🇫🇷' },
  { id: 2, name: 'Champions League', flag: '🏆' },
  { id: 3, name: 'Europa League', flag: '🟠' },
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
        <span className={clsx('text-sm font-bold', isPriority ? 'text-white/90' : 'text-white/60')}>
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
  const [activeTab, setActiveTab] = useState('today');
  const [selectedLeague, setSelectedLeague] = useState(null);
  const [allFixtures, setAllFixtures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [customDate, setCustomDate] = useState(null);
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
      let result;
      if (activeTab === 'live') {
        result = await fixturesApi.getLive();
      } else if (activeTab === 'tomorrow') {
        result = await fixturesApi.getTomorrow();
      } else if (activeTab === 'custom' && customDate) {
        result = await fixturesApi.getByDate(customDate);
      } else {
        result = await fixturesApi.getToday();
      }

      const all = result?.response || [];
      setAllFixtures(all);
      if (activeTab === 'live') setLiveCount(all.length);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [activeTab, customDate]);

  useEffect(() => {
    fetchFixtures();
  }, [fetchFixtures]);

  useEffect(() => {
    if (activeTab !== 'live') return;
    const interval = setInterval(fetchFixtures, 90000);
    return () => clearInterval(interval);
  }, [activeTab, fetchFixtures]);

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
      className="space-y-5 max-w-5xl mx-auto"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Matchs du Jour</h1>
          <p className="text-sm text-white/40 mt-0.5">
            {format(new Date(), "EEEE d MMMM yyyy", { locale: fr })}
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
              <p className={`text-lg font-black tabular-nums ${s.color}`}>{s.value}</p>
              <p className="text-xs text-white/30">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs + date picker */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1 p-1 bg-dark-800 rounded-xl">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap',
                activeTab === id ? 'bg-dark-700 text-white' : 'text-white/40 hover:text-white/70'
              )}
            >
              {id === 'live' && (
                <span className={clsx(
                  'w-1.5 h-1.5 rounded-full',
                  liveCount > 0 ? 'bg-red-500 animate-live-dot' : 'bg-white/20'
                )} />
              )}
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
              {id === 'live' && liveCount > 0 && (
                <span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full font-mono">{liveCount}</span>
              )}
            </button>
          ))}
        </div>

        <input
          type="date"
          value={customDate || ''}
          onChange={(e) => { setCustomDate(e.target.value); setActiveTab('custom'); }}
          className="bg-dark-800 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500/50 transition-colors"
        />
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
