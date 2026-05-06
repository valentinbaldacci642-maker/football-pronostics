import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Calendar, BarChart2, Clock, ChevronRight } from 'lucide-react';
import { leaguesApi, fixturesApi } from '../services/api';
import { ErrorState } from '../components/ui/Loading';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

const WC_LEAGUE = 1;
const WC_SEASON = 2026;

const STATUS_LABELS = {
  NS: { label: 'À venir', color: 'text-white/40' },
  '1H': { label: 'En cours', color: 'text-red-400' },
  HT: { label: 'Mi-temps', color: 'text-amber-400' },
  '2H': { label: 'En cours', color: 'text-red-400' },
  FT: { label: 'Terminé', color: 'text-white/30' },
  AET: { label: 'Ap. prol.', color: 'text-white/30' },
  PEN: { label: 'Tirs au but', color: 'text-white/30' },
};

export default function WorldCup() {
  const [tab, setTab] = useState('calendrier');

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <span className="text-3xl">🏆</span>
        <div>
          <h1 className="font-display text-4xl text-white tracking-wide leading-none">Coupe du <span className="text-gold-400">Monde 2026</span></h1>
          <p className="text-sm text-white/35 font-heading font-medium mt-1">USA · Canada · Mexique · 48 équipes</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('calendrier')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
            tab === 'calendrier'
              ? 'bg-brand-500/20 border-brand-500/40 text-brand-300'
              : 'border-white/10 text-white/40 hover:text-white/70'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Calendrier
        </button>
        <button
          onClick={() => setTab('classements')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
            tab === 'classements'
              ? 'bg-brand-500/20 border-brand-500/40 text-brand-300'
              : 'border-white/10 text-white/40 hover:text-white/70'
          }`}
        >
          <BarChart2 className="w-4 h-4" />
          Classements
        </button>
      </div>

      <AnimatePresence mode="wait">
        {tab === 'calendrier' ? (
          <motion.div key="cal" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <CalendrierTab />
          </motion.div>
        ) : (
          <motion.div key="cls" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <ClassementsTab />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function CalendrierTab() {
  const [fixtures, setFixtures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fixturesApi.getByLeagueSeason(WC_LEAGUE, WC_SEASON);
        setFixtures(data?.response || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const now = new Date();
  const filtered = filter === 'all' ? fixtures
    : filter === 'upcoming' ? fixtures.filter(f => new Date(f.fixture.date) >= now)
    : fixtures.filter(f => f.fixture.status.short === 'FT');

  // Group by date
  const grouped = filtered.reduce((acc, f) => {
    const day = f.fixture.date?.split('T')[0] || 'unknown';
    if (!acc[day]) acc[day] = [];
    acc[day].push(f);
    return acc;
  }, {});

  const sortedDays = Object.keys(grouped).sort();

  if (loading) return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="glass-card p-4 animate-pulse h-20 bg-white/3" />
      ))}
    </div>
  );

  if (error) return <ErrorState message={error} />;

  if (fixtures.length === 0) return (
    <div className="glass-card p-12 text-center">
      <p className="text-4xl mb-3">⏳</p>
      <p className="text-white/60 font-semibold">Calendrier non encore disponible</p>
      <p className="text-white/30 text-sm mt-1">Le calendrier de la Coupe du Monde 2026 sera publié prochainement</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex gap-2">
        {[['all', 'Tous'], ['upcoming', 'À venir'], ['played', 'Joués']].map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFilter(val)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
              filter === val ? 'bg-brand-500/20 border-brand-500/40 text-brand-300' : 'border-white/10 text-white/40 hover:text-white/60'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {sortedDays.map((day) => (
        <div key={day}>
          <p className="text-xs font-bold text-white/30 uppercase tracking-wider mb-2 px-1">
            {format(parseISO(day), 'EEEE d MMMM yyyy', { locale: fr })}
          </p>
          <div className="space-y-2">
            {grouped[day].map((f) => (
              <FixtureRow key={f.fixture.id} fixture={f} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function FixtureRow({ fixture }) {
  const { fixture: fix, teams, goals, league } = fixture;
  const status = STATUS_LABELS[fix.status.short] || { label: fix.status.short, color: 'text-white/40' };
  const isLive = ['1H', 'HT', '2H', 'ET', 'BT'].includes(fix.status.short);
  const isFinished = fix.status.short === 'FT';

  return (
    <Link to={`/match/${fix.id}`}>
      <motion.div
        whileHover={{ x: 2 }}
        className="glass-card px-3 py-3 flex flex-col gap-2 hover:border-white/10 transition-all"
      >
        {/* Top row: round + status/time */}
        <div className="flex items-center justify-between gap-2 text-xs">
          <p className="text-white/25 truncate min-w-0 flex-1">{league?.round}</p>
          {!isFinished && !isLive && (
            <span className="flex items-center gap-1 text-white/50 flex-shrink-0">
              <Clock className="w-3 h-3" />
              {format(parseISO(fix.date), 'HH:mm')}
            </span>
          )}
          <span className={`text-[10px] font-medium flex-shrink-0 ${isLive ? 'text-red-400 animate-pulse' : status.color}`}>
            {isLive ? `${fix.status.elapsed}'` : status.label}
          </span>
        </div>

        {/* Match row: home — score — away */}
        <div className="flex items-center gap-2 min-w-0 w-full overflow-hidden">
          {/* Home */}
          <div className="flex-1 flex items-center gap-2 justify-end min-w-0 overflow-hidden">
            <span className="text-sm font-semibold text-white/80 text-right truncate min-w-0 flex-1">{teams.home.name}</span>
            <img src={teams.home.logo} alt="" className="w-6 h-6 object-contain flex-shrink-0" onError={e => e.target.style.display='none'} />
          </div>

          {/* Score */}
          <div className="w-14 flex-shrink-0 flex items-center justify-center">
            {isFinished || isLive ? (
              <span className="font-black text-white text-lg tabular-nums">
                {goals.home ?? 0} - {goals.away ?? 0}
              </span>
            ) : (
              <span className="text-white/30 text-sm font-mono">vs</span>
            )}
          </div>

          {/* Away */}
          <div className="flex-1 flex items-center gap-2 min-w-0 overflow-hidden">
            <img src={teams.away.logo} alt="" className="w-6 h-6 object-contain flex-shrink-0" onError={e => e.target.style.display='none'} />
            <span className="text-sm font-semibold text-white/80 truncate min-w-0 flex-1">{teams.away.name}</span>
          </div>

          <ChevronRight className="w-4 h-4 text-white/20 flex-shrink-0" />
        </div>
      </motion.div>
    </Link>
  );
}

function ClassementsTab() {
  const [standings, setStandings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await leaguesApi.getStandings(WC_LEAGUE, WC_SEASON);
        const groups = data?.response?.[0]?.league?.standings;
        setStandings(groups || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="glass-card p-4 animate-pulse h-40 bg-white/3" />
      ))}
    </div>
  );

  if (error) return <ErrorState message={error} />;

  if (!standings || standings.length === 0) return (
    <div className="glass-card p-12 text-center">
      <p className="text-4xl mb-3">⏳</p>
      <p className="text-white/60 font-semibold">Classements non encore disponibles</p>
      <p className="text-white/30 text-sm mt-1">Les groupes seront affichés dès le début de la compétition</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {standings.map((group, gi) => (
        <div key={gi} className="glass-card overflow-hidden">
          {group[0]?.group && (
            <div className="px-4 py-2.5 border-b border-white/5 bg-white/3">
              <p className="text-xs font-bold text-white/60 uppercase tracking-wider">{group[0].group}</p>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-fixed">
              <colgroup>
                <col className="w-8" />
                <col />
                <col className="w-10" />
                <col className="w-10" />
                <col className="w-10" />
                <col className="w-10" />
                <col className="w-12 hidden sm:table-column" />
                <col className="w-12" />
              </colgroup>
              <thead>
                <tr className="border-b border-white/5 text-xs text-white/30">
                  <th className="text-center py-2 font-medium">#</th>
                  <th className="text-left pl-2 py-2 font-medium">Équipe</th>
                  <th className="text-center py-2 font-medium">MJ</th>
                  <th className="text-center py-2 font-medium">V</th>
                  <th className="text-center py-2 font-medium">N</th>
                  <th className="text-center py-2 font-medium">D</th>
                  <th className="text-center py-2 font-medium hidden sm:table-cell">Diff</th>
                  <th className="text-center py-2 font-bold">Pts</th>
                </tr>
              </thead>
              <tbody>
                {group.map((row) => {
                  const desc = (row.description || '').toLowerCase();
                  let accentColor = 'border-l-transparent';
                  if (desc.includes('qualif') || desc.includes('round of')) accentColor = 'border-l-green-500';
                  else if (desc.includes('elimin')) accentColor = 'border-l-red-500';
                  return (
                    // border-l-2 always present (transparent fallback) so rows
                    // without an accent don't shift 2px relative to those that do.
                    <tr key={row.team.id} className={`border-b border-white/3 border-l-2 ${accentColor} hover:bg-white/3 transition-colors`}>
                      <td className="text-center py-3 text-white/40 text-xs font-medium tabular-nums">{row.rank}</td>
                      <td className="pl-2 py-3 overflow-hidden">
                        <div className="flex items-center gap-2 min-w-0">
                          <img src={row.team.logo} alt="" className="w-5 h-5 object-contain flex-shrink-0" onError={e => e.target.style.display='none'} />
                          <span className="font-medium text-white/90 truncate min-w-0 flex-1">{row.team.name}</span>
                        </div>
                      </td>
                      <td className="text-center py-3 text-white/50 tabular-nums">{row.all.played}</td>
                      <td className="text-center py-3 text-green-400 tabular-nums">{row.all.win}</td>
                      <td className="text-center py-3 text-white/40 tabular-nums">{row.all.draw}</td>
                      <td className="text-center py-3 text-red-400 tabular-nums">{row.all.lose}</td>
                      <td className={`text-center py-3 hidden sm:table-cell font-medium tabular-nums ${row.goalsDiff > 0 ? 'text-green-400' : row.goalsDiff < 0 ? 'text-red-400' : 'text-white/40'}`}>
                        {row.goalsDiff > 0 ? `+${row.goalsDiff}` : row.goalsDiff}
                      </td>
                      <td className="text-center py-3 font-black text-white tabular-nums">{row.points}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
