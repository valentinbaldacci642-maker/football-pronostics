import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Search, Trophy, ChevronRight, BarChart2, Award } from 'lucide-react';
import { leaguesApi, playersApi } from '../../services/api';
import { SkeletonCard, EmptyState, ErrorState } from '../ui/Loading';

const TOP5_EU_LEAGUES = [
  { id: 39,  name: 'Premier League',    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', season: 2025 },
  { id: 140, name: 'La Liga',           flag: '🇪🇸', season: 2025 },
  { id: 78,  name: 'Bundesliga',        flag: '🇩🇪', season: 2025 },
  { id: 135, name: 'Serie A',           flag: '🇮🇹', season: 2025 },
  { id: 61,  name: 'Ligue 1',           flag: '🇫🇷', season: 2025 },
];

function FormDots({ form }) {
  if (!form) return null;
  return (
    <div className="flex gap-1 justify-center">
      {form.slice(-5).split('').map((c, i) => (
        <span
          key={i}
          className={`w-5 h-5 rounded-sm flex items-center justify-center text-[11px] font-bold leading-none ${
            c === 'W' ? 'bg-brand-500/30 text-brand-300 border border-brand-500/40' :
            c === 'D' ? 'bg-white/10 text-white/70 border border-white/20' :
            c === 'L' ? 'bg-danger/30 text-red-300 border border-danger/40' :
                        'bg-white/5 text-white/40'
          }`}
        >
          {c}
        </span>
      ))}
    </div>
  );
}

function getQualifBucket(desc) {
  const d = (desc || '').toLowerCase();
  if (!d) return null;
  if (d.includes('relegation')) {
    if (d.includes('playoff') || d.includes('play off') || d.includes('play-off')) return 'reldown';
    return 'relegated';
  }
  if (d.includes('champions league')) return d.includes('qualif') ? 'uclQ' : 'ucl';
  if (d.includes('europa league'))   return d.includes('qualif') ? 'uelQ' : 'uel';
  if (d.includes('conference'))      return d.includes('qualif') ? 'confQ' : 'conf';
  if (d.includes('promotion'))       return 'promo';
  return null;
}

const BUCKET_STYLES = {
  ucl:       { border: 'border-l-green-500',   dot: 'bg-green-500',   label: 'LDC' },
  uclQ:      { border: 'border-l-teal-400',    dot: 'bg-teal-400',    label: 'Barrage LDC' },
  uel:       { border: 'border-l-yellow-400',  dot: 'bg-yellow-400',  label: 'Europa' },
  uelQ:      { border: 'border-l-rose-400',    dot: 'bg-rose-400',    label: 'Barrage Europa' },
  conf:      { border: 'border-l-blue-500',    dot: 'bg-blue-500',    label: 'Conference' },
  confQ:     { border: 'border-l-violet-400',  dot: 'bg-violet-400',  label: 'Barrage Conf.' },
  promo:     { border: 'border-l-lime-400',    dot: 'bg-lime-400',    label: 'Promotion' },
  reldown:   { border: 'border-l-orange-500',  dot: 'bg-orange-500',  label: 'Barrage maintien' },
  relegated: { border: 'border-l-red-500',     dot: 'bg-red-500',     label: 'Relégation' },
};

function StandingsGroup({ group, viewMode = 'all' }) {
  const groupName = group[0]?.group;
  const stats = (row) => viewMode === 'home' ? row.home : viewMode === 'away' ? row.away : row.all;
  const presentBuckets = Array.from(new Set(group.map((r) => getQualifBucket(r.description)).filter(Boolean)));

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
              const bucket = getQualifBucket(row.description);
              const accentColor = bucket ? `border-l-[5px] ${BUCKET_STYLES[bucket].border}` : '';
              const s = stats(row);
              return (
                <tr key={row.team.id} className={`border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors ${accentColor}`}
                    title={bucket ? BUCKET_STYLES[bucket].label : undefined}>
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
                  <td className="px-1.5 py-2.5 hidden lg:table-cell"><FormDots form={row.form} /></td>
                  <td className="px-4 py-2.5 text-center font-display text-base text-white">{row.points}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {presentBuckets.length > 0 && (
        <div className="px-4 py-4 border-t border-white/[0.04] flex gap-x-6 gap-y-3 flex-wrap">
          {presentBuckets.map((bucket) => {
            const s = BUCKET_STYLES[bucket];
            return (
              <div key={bucket} className="flex items-center gap-2.5">
                <span className={`w-4 h-4 rounded ${s.dot}`} />
                <span className="text-base text-white font-heading font-bold">{s.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TopScorersTable({ scorers }) {
  const maxGoals = scorers[0]?.statistics?.[0]?.goals?.total || 1;
  return (
    <div className="glass-card overflow-hidden">
      <div className="px-4 py-3 border-b border-white/[0.05] flex items-center gap-2">
        <Award className="w-4 h-4 text-gold-400" />
        <span className="text-sm font-heading font-semibold text-white/70">Top Buteurs</span>
      </div>
      <div className="divide-y divide-white/[0.04]">
        {scorers.slice(0, 15).map((entry, i) => {
          const player = entry.player;
          const stats = entry.statistics?.[0];
          const goals = stats?.goals?.total || 0;
          const assists = stats?.goals?.assists || 0;
          const team = stats?.team;
          const pct = Math.round((goals / maxGoals) * 100);
          return (
            <Link to={`/player/${player.id}`} key={player.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors group">
              <span className={`w-5 text-center font-mono text-xs flex-shrink-0 ${i === 0 ? 'text-gold-400 font-bold' : i === 1 ? 'text-white/50' : i === 2 ? 'text-amber-600/80' : 'text-white/20'}`}>{i + 1}</span>
              <img src={player.photo} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0 bg-dark-700"
                onError={(e) => { e.target.src = 'https://media.api-sports.io/football/players/0.png'; }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-heading font-semibold text-white/85 truncate group-hover:text-brand-400 transition-colors">{player.name}</span>
                  {team?.logo && <img src={team.logo} alt="" className="w-4 h-4 object-contain flex-shrink-0" onError={(e) => e.target.style.display = 'none'} />}
                </div>
                <div className="mt-1 h-1 bg-white/[0.07] rounded-full overflow-hidden w-full">
                  <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 text-right">
                <div><span className="text-base font-display text-white">{goals}</span><span className="text-[10px] text-white/30 font-heading ml-0.5">buts</span></div>
                {assists > 0 && <div><span className="text-sm font-mono text-gold-400/70">{assists}</span><span className="text-[10px] text-white/25 font-heading ml-0.5">pss</span></div>}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function StandingsLeagueCard({ league, onPick, featured = false }) {
  return (
    <motion.button
      whileHover={{ y: -2 }}
      onClick={onPick}
      type="button"
      className={`glass-card p-4 flex items-center gap-3 cursor-pointer hover:border-brand-500/30 transition-all text-left w-full ${
        featured ? 'border-brand-500/15' : ''
      }`}
    >
      <div className="w-11 h-11 rounded-xl bg-dark-700 flex items-center justify-center p-1.5 flex-shrink-0 text-2xl">
        {league.logo ? (
          <img src={league.logo} alt={league.name} className="w-full h-full object-contain" onError={(e) => e.target.style.display = 'none'} />
        ) : (
          <span>{league.flag}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-semibold truncate ${featured ? 'text-white' : 'text-white/80'}`}>{league.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {league.countryFlag && <img src={league.countryFlag} alt="" className="w-3.5 h-2.5 object-cover rounded-sm" />}
          {league.countryName && <span className="text-xs text-white/30">{league.countryName}</span>}
          <span className="text-xs text-white/20">Saison {league.season}</span>
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-white/20 flex-shrink-0" />
    </motion.button>
  );
}

function StandingsPicker({ onPick, initialLeague = null }) {
  const [showAll, setShowAll] = useState(false);
  const [allLeagues, setAllLeagues] = useState(null);
  const [loadingAll, setLoadingAll] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!showAll || allLeagues) return;
    setLoadingAll(true);
    const minSeason = new Date().getFullYear() - 1;
    leaguesApi.getAll({ current: 'true', type: 'league' })
      .then((data) => {
        const list = (data?.response || [])
          .map((l) => {
            const currentSeason = l.seasons?.find((s) => s.current);
            if (!currentSeason || !currentSeason.coverage?.standings) return null;
            if (typeof currentSeason.year === 'number' && currentSeason.year < minSeason) return null;
            return {
              id: l.league?.id,
              name: l.league?.name,
              logo: l.league?.logo,
              countryName: l.country?.name,
              countryFlag: l.country?.flag,
              flag: l.country?.flag ? null : '🌍',
              season: currentSeason.year,
            };
          })
          .filter(Boolean)
          .filter((l) => !TOP5_EU_LEAGUES.some((t) => t.id === l.id));
        setAllLeagues(list);
      })
      .catch(() => setAllLeagues([]))
      .finally(() => setLoadingAll(false));
  }, [showAll, allLeagues]);

  const filtered = !search ? (allLeagues || []) : (allLeagues || []).filter(
    (l) => l.name?.toLowerCase().includes(search.toLowerCase())
        || l.countryName?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="w-4 h-4 text-gold-400" />
          <h2 className="text-sm font-bold text-white/80">Top 5 ligues européennes</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TOP5_EU_LEAGUES.map((league) => (
            <StandingsLeagueCard key={league.id} league={league} onPick={() => onPick(league)} featured />
          ))}
        </div>
      </div>

      {!showAll ? (
        <button
          onClick={() => setShowAll(true)}
          className="w-full glass-card p-4 flex items-center justify-center gap-2 cursor-pointer hover:border-brand-500/30 transition-all text-sm font-heading font-semibold text-white/60 hover:text-white"
        >
          <span>Voir toutes les compétitions</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-white/60">Autres compétitions</h2>
            <button onClick={() => setShowAll(false)} className="text-xs text-white/35 hover:text-white/60 font-heading">Réduire</button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher une ligue ou un pays..."
              className="w-full bg-dark-800 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-brand-500/50" />
          </div>
          {loadingAll ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(9)].map((_, i) => <div key={i} className="glass-card p-4 h-16 skeleton" />)}
            </div>
          ) : (
            <>
              <p className="text-xs text-white/30 font-heading">{filtered.length} compétitions</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((league) => (
                  <StandingsLeagueCard key={league.id} league={league} onPick={() => onPick(league)} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Full standings view. Either renders a league picker (no league selected)
 * or the standings + scorers tabs for a chosen league. Optionally accepts
 * a `forcedLeague` prop so the parent (Matchs page) can pre-select a league
 * picked from the sidebar.
 */
export default function StandingsView({ forcedLeague = null }) {
  const [selected, setSelected] = useState(forcedLeague);
  const [subTab, setSubTab] = useState('classement');
  const [standings, setStandings] = useState(null);
  const [scorers, setScorers] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('all');

  useEffect(() => {
    setSelected(forcedLeague);
  }, [forcedLeague]);

  useEffect(() => {
    if (!selected) return;
    if (subTab === 'classement') {
      setLoading(true); setError(null); setStandings(null);
      leaguesApi.getStandings(selected.id, selected.season)
        .then((data) => {
          const groups = data?.response?.[0]?.league?.standings;
          setStandings(groups || []);
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    } else {
      setLoading(true); setError(null); setScorers(null);
      playersApi.getTopScorers(selected.id, selected.season)
        .then((data) => setScorers(data?.response || []))
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [selected, subTab]);

  if (!selected) return <StandingsPicker onPick={setSelected} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => setSelected(null)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-heading font-semibold border border-white/[0.08] text-white/50 hover:text-white/80 hover:border-white/20 transition-all">
          <ChevronRight className="w-3.5 h-3.5 rotate-180" />
          Toutes les compétitions
        </button>
        <div className="flex items-center gap-2">
          {selected.logo
            ? <img src={selected.logo} alt="" className="w-5 h-5 object-contain" onError={(e) => e.target.style.display = 'none'} />
            : <span className="text-lg">{selected.flag}</span>}
          <span className="text-sm font-heading font-bold text-white">{selected.name}</span>
        </div>
      </div>

      <div className="flex gap-1 p-1 bg-dark-800 rounded-xl w-fit">
        <button onClick={() => setSubTab('classement')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-heading font-semibold transition-all ${subTab === 'classement' ? 'bg-dark-700 text-white' : 'text-white/35 hover:text-white/60'}`}>
          <BarChart2 className="w-3.5 h-3.5" />Classement
        </button>
        <button onClick={() => setSubTab('buteurs')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-heading font-semibold transition-all ${subTab === 'buteurs' ? 'bg-dark-700 text-white' : 'text-white/35 hover:text-white/60'}`}>
          <Award className="w-3.5 h-3.5" />Buteurs
        </button>
      </div>

      {subTab === 'classement' && (
        <>
          <div className="flex gap-1 p-1 bg-dark-800 rounded-xl w-fit">
            {[['all', 'Global'], ['home', 'Domicile'], ['away', 'Extérieur']].map(([mode, label]) => (
              <button key={mode} onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 rounded-lg text-xs font-heading font-semibold transition-all ${viewMode === mode ? 'bg-dark-700 text-white' : 'text-white/35 hover:text-white/60'}`}>
                {label}
              </button>
            ))}
          </div>
          {loading ? (
            <div className="glass-card p-6 space-y-2">{[...Array(12)].map((_, i) => <div key={i} className="h-9 skeleton rounded-lg" />)}</div>
          ) : error ? (
            <ErrorState message={error} />
          ) : standings && standings.length > 0 ? (
            <div className="space-y-6">{standings.map((group, gi) => <StandingsGroup key={gi} group={group} viewMode={viewMode} />)}</div>
          ) : standings && standings.length === 0 ? (
            <EmptyState title="Classement non disponible" icon="📊" />
          ) : null}
        </>
      )}

      {subTab === 'buteurs' && (
        <>
          {loading ? (
            <div className="glass-card p-6 space-y-3">{[...Array(10)].map((_, i) => <div key={i} className="h-14 skeleton rounded-xl" />)}</div>
          ) : error ? (
            <ErrorState message={error} />
          ) : scorers && scorers.length > 0 ? (
            <TopScorersTable scorers={scorers} />
          ) : scorers && scorers.length === 0 ? (
            <EmptyState title="Aucun buteur disponible" icon="⚽" />
          ) : null}
        </>
      )}
    </div>
  );
}
