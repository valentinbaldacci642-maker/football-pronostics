import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Search, Trophy, ChevronRight, BarChart2, List } from 'lucide-react';
import { leaguesApi } from '../services/api';
import { SkeletonCard, EmptyState, ErrorState } from '../components/ui/Loading';

const TOP_LEAGUES_IDS = [39, 140, 78, 135, 61, 2, 3, 1, 94, 88];

const STANDINGS_LEAGUES = [
  { id: 39,  name: 'Premier League',    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', season: 2024 },
  { id: 140, name: 'La Liga',           flag: '🇪🇸', season: 2024 },
  { id: 78,  name: 'Bundesliga',        flag: '🇩🇪', season: 2024 },
  { id: 135, name: 'Serie A',           flag: '🇮🇹', season: 2024 },
  { id: 61,  name: 'Ligue 1',           flag: '🇫🇷', season: 2024 },
  { id: 2,   name: 'Champions League',  flag: '🏆', season: 2024 },
];

export default function Leagues() {
  const [tab, setTab] = useState('competitions');

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-4xl text-white tracking-wide leading-none">Ligues & <span className="text-brand-400">Compétitions</span></h1>
        <p className="text-sm text-white/35 font-heading font-medium mt-1">Classements & calendriers</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('competitions')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
            tab === 'competitions'
              ? 'bg-brand-500/20 border-brand-500/40 text-brand-300'
              : 'border-white/10 text-white/40 hover:text-white/70'
          }`}
        >
          <List className="w-4 h-4" />
          Compétitions
        </button>
        <button
          onClick={() => setTab('standings')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
            tab === 'standings'
              ? 'bg-brand-500/20 border-brand-500/40 text-brand-300'
              : 'border-white/10 text-white/40 hover:text-white/70'
          }`}
        >
          <BarChart2 className="w-4 h-4" />
          Classements
        </button>
      </div>

      <AnimatePresence mode="wait">
        {tab === 'competitions' ? (
          <motion.div key="competitions" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <CompetitionsTab />
          </motion.div>
        ) : (
          <motion.div key="standings" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <StandingsTab />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function CompetitionsTab() {
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('League');

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const data = await leaguesApi.getAll({ current: true });
        setLeagues(data?.response || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const filtered = leagues.filter((l) => {
    const matchSearch = !search || l.league?.name?.toLowerCase().includes(search.toLowerCase())
      || l.country?.name?.toLowerCase().includes(search.toLowerCase());
    const matchType = !selectedType || l.league?.type === selectedType;
    return matchSearch && matchType;
  });

  const topLeagues = leagues.filter((l) => TOP_LEAGUES_IDS.includes(l.league?.id));
  const otherLeagues = filtered.filter((l) => !TOP_LEAGUES_IDS.includes(l.league?.id));

  return (
    <div className="space-y-6">
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une ligue..."
            className="w-full bg-dark-800 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-brand-500/50"
          />
        </div>
        {['League', 'Cup'].map((type) => (
          <button
            key={type}
            onClick={() => setSelectedType(selectedType === type ? null : type)}
            className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
              selectedType === type ? 'bg-brand-500/20 border-brand-500/40 text-brand-300' : 'border-white/10 text-white/40 hover:text-white/70'
            }`}
          >
            {type === 'League' ? 'Ligues' : 'Coupes'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(9)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        <div className="space-y-8">
          {topLeagues.length > 0 && !search && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="w-4 h-4 text-gold-400" />
                <h2 className="text-sm font-bold text-white/80">Compétitions majeures</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {topLeagues.map((item) => <LeagueCard key={item.league.id} item={item} featured />)}
              </div>
            </div>
          )}
          {otherLeagues.length > 0 && (
            <div>
              {!search && <h2 className="text-sm font-bold text-white/40 mb-4">Autres compétitions</h2>}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {otherLeagues.slice(0, 30).map((item) => <LeagueCard key={item.league.id} item={item} />)}
              </div>
            </div>
          )}
          {filtered.length === 0 && <EmptyState title="Aucune ligue trouvée" icon="🏆" />}
        </div>
      )}
    </div>
  );
}

function StandingsTab() {
  const [selected, setSelected] = useState(STANDINGS_LEAGUES[0]);
  const [standings, setStandings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('all'); // 'all' | 'home' | 'away'

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      setStandings(null);
      try {
        const data = await leaguesApi.getStandings(selected.id, selected.season);
        const groups = data?.response?.[0]?.league?.standings;
        setStandings(groups || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [selected]);

  return (
    <div className="space-y-4">
      {/* League selector */}
      <div className="flex gap-2 flex-wrap">
        {STANDINGS_LEAGUES.map((league) => (
          <button
            key={league.id}
            onClick={() => setSelected(league)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-heading font-semibold border transition-all ${
              selected.id === league.id
                ? 'bg-brand-500/15 border-brand-500/35 text-brand-400'
                : 'border-white/[0.08] text-white/35 hover:text-white/60'
            }`}
          >
            <span>{league.flag}</span>
            <span className="hidden sm:inline">{league.name}</span>
          </button>
        ))}
      </div>

      {/* View mode: All / Home / Away */}
      <div className="flex gap-1 p-1 bg-dark-800 rounded-xl w-fit">
        {[['all', 'Global'], ['home', 'Domicile'], ['away', 'Extérieur']].map(([mode, label]) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`px-3 py-1.5 rounded-lg text-xs font-heading font-semibold transition-all ${
              viewMode === mode ? 'bg-dark-700 text-white' : 'text-white/35 hover:text-white/60'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="glass-card p-6 space-y-2">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="h-9 skeleton rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} />
      ) : standings && standings.length > 0 ? (
        <div className="space-y-6">
          {standings.map((group, gi) => (
            <StandingsGroup key={gi} group={group} leagueId={selected.id} viewMode={viewMode} />
          ))}
        </div>
      ) : standings && standings.length === 0 ? (
        <EmptyState title="Classement non disponible" icon="📊" />
      ) : null}
    </div>
  );
}

function FormDots({ form }) {
  if (!form) return null;
  return (
    <div className="flex gap-0.5">
      {form.slice(-5).split('').map((c, i) => (
        <span key={i} className={`w-4 h-4 rounded-sm flex items-center justify-center text-[9px] font-display ${
          c === 'W' ? 'bg-brand-500/25 text-brand-400' :
          c === 'D' ? 'bg-white/10 text-white/40' :
                      'bg-danger/25 text-danger'
        }`}>{c}</span>
      ))}
    </div>
  );
}

function StandingsGroup({ group, leagueId, viewMode = 'all' }) {
  const groupName = group[0]?.group;
  const stats = (row) => viewMode === 'home' ? row.home : viewMode === 'away' ? row.away : row.all;

  return (
    <div className="glass-card overflow-hidden">
      {groupName && (
        <div className="px-4 py-2.5 border-b border-white/[0.05]">
          <p className="text-xs font-heading font-semibold text-white/35 uppercase tracking-wider">{groupName}</p>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.05] text-xs text-white/25 font-heading font-semibold">
              <th className="text-left px-4 py-2.5 w-8">#</th>
              <th className="text-left px-2 py-2.5">Équipe</th>
              <th className="text-center px-1.5 py-2.5">MJ</th>
              <th className="text-center px-1.5 py-2.5 text-brand-400/60">V</th>
              <th className="text-center px-1.5 py-2.5">N</th>
              <th className="text-center px-1.5 py-2.5 text-danger/60">D</th>
              <th className="text-center px-1.5 py-2.5 hidden md:table-cell">BP</th>
              <th className="text-center px-1.5 py-2.5 hidden md:table-cell">BC</th>
              <th className="text-center px-1.5 py-2.5 hidden sm:table-cell">Diff</th>
              <th className="text-center px-1.5 py-2.5 hidden lg:table-cell">Forme</th>
              <th className="text-center px-4 py-2.5 text-white/60">Pts</th>
            </tr>
          </thead>
          <tbody>
            {group.map((row) => {
              const desc = row.description?.toLowerCase() || '';
              const s = stats(row);
              let accentColor = '';
              if (desc.includes('champions league') || desc.includes('promotion') || desc.includes('qualification')) accentColor = 'border-l-2 border-l-brand-500';
              else if (desc.includes('europa') || desc.includes('playoff')) accentColor = 'border-l-2 border-l-gold-500';
              else if (desc.includes('relegat') || desc.includes('descente')) accentColor = 'border-l-2 border-l-danger';

              return (
                <tr key={row.team.id} className={`border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors ${accentColor}`}>
                  <td className="px-4 py-2.5 text-white/30 font-mono text-xs">{row.rank}</td>
                  <td className="px-2 py-2.5">
                    <Link to={`/team/${row.team.id}`} className="flex items-center gap-2 group">
                      <img src={row.team.logo} alt="" className="w-5 h-5 object-contain flex-shrink-0" onError={(e) => e.target.style.display = 'none'} />
                      <span className="font-heading font-semibold text-white/80 truncate max-w-[100px] sm:max-w-[160px] group-hover:text-brand-400 transition-colors">{row.team.name}</span>
                    </Link>
                  </td>
                  <td className="px-1.5 py-2.5 text-center text-white/40 font-mono text-xs">{s?.played ?? row.all.played}</td>
                  <td className="px-1.5 py-2.5 text-center text-brand-400 font-mono text-xs">{s?.win ?? row.all.win}</td>
                  <td className="px-1.5 py-2.5 text-center text-white/35 font-mono text-xs">{s?.draw ?? row.all.draw}</td>
                  <td className="px-1.5 py-2.5 text-center text-danger font-mono text-xs">{s?.lose ?? row.all.lose}</td>
                  <td className="px-1.5 py-2.5 text-center text-white/40 font-mono text-xs hidden md:table-cell">{s?.goals?.for ?? row.all.goals.for}</td>
                  <td className="px-1.5 py-2.5 text-center text-white/40 font-mono text-xs hidden md:table-cell">{s?.goals?.against ?? row.all.goals.against}</td>
                  <td className={`px-1.5 py-2.5 text-center font-mono text-xs hidden sm:table-cell ${row.goalsDiff > 0 ? 'text-brand-400' : row.goalsDiff < 0 ? 'text-danger' : 'text-white/30'}`}>
                    {row.goalsDiff > 0 ? `+${row.goalsDiff}` : row.goalsDiff}
                  </td>
                  <td className="px-1.5 py-2.5 hidden lg:table-cell">
                    <FormDots form={row.form} />
                  </td>
                  <td className="px-4 py-2.5 text-center font-display text-base text-white">{row.points}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* Legend */}
      <div className="px-4 py-2 border-t border-white/[0.04] flex gap-4 flex-wrap">
        {[
          { color: 'bg-brand-500', label: 'Champions League' },
          { color: 'bg-gold-500', label: 'Europa League' },
          { color: 'bg-danger', label: 'Relégation' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-sm ${color}`} />
            <span className="text-[10px] text-white/25 font-heading">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LeagueCard({ item, featured = false }) {
  const { league, country, seasons } = item;
  const currentSeason = seasons?.find((s) => s.current);

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className={`glass-card p-4 flex items-center gap-3 cursor-pointer hover:border-white/10 transition-all ${featured ? 'border-brand-500/15' : ''}`}
    >
      <Link to={`/matchs?league=${league.id}`} className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-11 h-11 rounded-xl bg-dark-700 flex items-center justify-center p-1.5 flex-shrink-0">
          <img src={league.logo} alt={league.name} className="w-full h-full object-contain"
            onError={(e) => e.target.style.display = 'none'} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`font-semibold truncate ${featured ? 'text-white' : 'text-white/80'}`}>{league.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {country?.flag && <img src={country.flag} alt="" className="w-3.5 h-2.5 object-cover rounded-sm" />}
            <span className="text-xs text-white/30">{country?.name}</span>
            {currentSeason && <span className="text-xs text-white/20">{currentSeason.year}</span>}
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-white/20 flex-shrink-0" />
      </Link>
    </motion.div>
  );
}
