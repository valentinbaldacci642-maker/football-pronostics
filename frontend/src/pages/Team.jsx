import { useState, useEffect, Fragment } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, AlertTriangle, ArrowLeftRight, ArrowLeft, MapPin, Calendar, Trophy, Star, BarChart2, Clock, RefreshCw } from 'lucide-react';
import { teamsApi, fixturesApi } from '../services/api';
import { Spinner, ErrorState } from '../components/ui/Loading';
import { useFavoriteTeamsStore } from '../store';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

const POSITION_ORDER = { G: 1, D: 2, M: 3, F: 4 };
const POSITION_LABELS = { G: 'Gardiens', D: 'Défenseurs', M: 'Milieux', F: 'Attaquants' };
const POSITION_COLORS = { G: 'text-amber-400 bg-amber-500/10', D: 'text-blue-400 bg-blue-500/10', M: 'text-green-400 bg-green-500/10', F: 'text-red-400 bg-red-500/10' };

export default function Team() {
  const { id } = useParams();
  const [tab, setTab] = useState('effectif');
  const [teamData, setTeamData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { toggleTeam, isTeamFavorite } = useFavoriteTeamsStore();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await teamsApi.getById(id);
        setTeamData(data?.response?.[0] || null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading) return (
    <div className="flex justify-center items-center h-64"><Spinner /></div>
  );
  if (error) return <ErrorState message={error} />;
  if (!teamData) return <ErrorState message="Équipe introuvable" />;

  const { team, venue } = teamData;
  const isFav = isTeamFavorite(team.id);
  const tabs = [
    { key: 'effectif',   label: 'Effectif',   icon: Users },
    { key: 'resultats',  label: 'Résultats',  icon: BarChart2 },
    { key: 'calendrier', label: 'Calendrier', icon: Clock },
    { key: 'blessures',  label: 'Blessures',  icon: AlertTriangle },
    { key: 'transferts', label: 'Transferts', icon: ArrowLeftRight },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-6 overflow-x-hidden">
      {/* Back */}
      <Link to="/leagues" className="flex items-center gap-2 text-white/40 hover:text-white/70 text-sm transition-colors w-fit">
        <ArrowLeft className="w-4 h-4" />
        Retour
      </Link>

      {/* Header */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-5">
          <img src={team.logo} alt={team.name} className="w-20 h-20 object-contain flex-shrink-0" onError={e => e.target.style.display='none'} />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <h1 className="font-display text-2xl sm:text-3xl md:text-4xl text-white tracking-wide leading-tight truncate flex-1 min-w-0">{team.name}</h1>
              <button
                onClick={() => toggleTeam({ id: team.id, name: team.name, logo: team.logo, country: team.country })}
                className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all ${isFav ? 'bg-gold-500/20 text-gold-400' : 'bg-dark-700/60 text-white/25 hover:text-gold-400 hover:bg-gold-500/10'}`}
              >
                <Star className={`w-4 h-4 ${isFav ? 'fill-gold-400' : ''}`} />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-white/50">
              {team.country && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> {team.country}
                </span>
              )}
              {team.founded && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> Fondé en {team.founded}
                </span>
              )}
              {team.national && (
                <span className="flex items-center gap-1.5 text-brand-400">
                  <Trophy className="w-3.5 h-3.5" /> Équipe nationale
                </span>
              )}
            </div>
            {venue?.name && (
              <p className="text-xs text-white/30 mt-1.5">{venue.name}{venue.city ? ` · ${venue.city}` : ''}{venue.capacity ? ` · ${Number(venue.capacity).toLocaleString('fr')} places` : ''}</p>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
              tab === key ? 'bg-brand-500/20 border-brand-500/40 text-brand-300' : 'border-white/10 text-white/40 hover:text-white/70'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === 'effectif' && (
          <motion.div key="effectif" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <SquadTab teamId={id} />
          </motion.div>
        )}
        {tab === 'resultats' && (
          <motion.div key="resultats" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <ResultsTab teamId={id} />
          </motion.div>
        )}
        {tab === 'calendrier' && (
          <motion.div key="calendrier" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <CalendrierTab teamId={id} />
          </motion.div>
        )}
        {tab === 'blessures' && (
          <motion.div key="blessures" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <InjuriesTab teamId={id} />
          </motion.div>
        )}
        {tab === 'transferts' && (
          <motion.div key="transferts" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <TransfersTab teamId={id} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function SquadTab({ teamId }) {
  const [squad, setSquad] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await teamsApi.getSquad(teamId);
        setSquad(data?.response?.[0]?.players || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [teamId]);

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (error) return <ErrorState message={error} />;
  if (!squad.length) return <Empty emoji="👥" text="Effectif non disponible" />;

  const grouped = squad.reduce((acc, p) => {
    const pos = p.position?.[0]?.toUpperCase() || 'M';
    if (!acc[pos]) acc[pos] = [];
    acc[pos].push(p);
    return acc;
  }, {});

  const sortedPositions = Object.keys(grouped).sort((a, b) => (POSITION_ORDER[a] || 9) - (POSITION_ORDER[b] || 9));

  return (
    <div className="space-y-4">
      {sortedPositions.map((pos) => (
        <div key={pos} className="glass-card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-white/5 bg-white/3">
            <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${POSITION_COLORS[pos] || 'text-white/50 bg-white/5'}`}>
              {POSITION_LABELS[pos] || pos}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 divide-y divide-white/3 sm:divide-y-0">
            {grouped[pos].map((player) => (
              <Link to={`/player/${player.id}`} key={player.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors sm:border-b sm:border-white/3 group">
                <div className="w-10 h-10 rounded-full bg-dark-700 overflow-hidden flex-shrink-0">
                  <img src={player.photo} alt={player.name} className="w-full h-full object-cover" onError={e => e.target.style.display='none'} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white/90 truncate group-hover:text-brand-400 transition-colors">{player.name}</p>
                  <p className="text-xs text-white/30">{player.age ? `${player.age} ans` : ''}{player.number ? ` · #${player.number}` : ''}</p>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-md flex-shrink-0 ${POSITION_COLORS[pos] || 'text-white/50 bg-white/5'}`}>
                  {pos}
                </span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// European football season convention: a 'season' starts mid-year. API-Football
// uses the calendar year of the season's START. So 2025/2026 → season=2025.
// July+ → season = current year, Jan-June → season = previous year.
function getCurrentSeason() {
  const now = new Date();
  return now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
}

const FINISHED_STATUSES = ['FT', 'AET', 'PEN'];
const UPCOMING_STATUSES = ['NS', 'TBD'];

// Section header shown between groups of consecutive matches in the same
// competition. Inserted whenever the league changes vs the previous match
// in the date-sorted list.
function CompetitionDivider({ league }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-dark-700/40 border-y border-white/[0.06]">
      {league?.logo && (
        <img src={league.logo} alt="" className="w-4 h-4 object-contain flex-shrink-0" onError={(e) => { e.target.style.display = 'none'; }} />
      )}
      <span className="text-[11px] font-heading font-bold tracking-wide text-white/55 uppercase">
        {league?.name || 'Compétition'}
      </span>
      {league?.country && (
        <span className="text-[10px] text-white/25 font-mono">· {league.country}</span>
      )}
    </div>
  );
}

function ResultsTab({ teamId }) {
  const [fixtures, setFixtures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        // All season fixtures (across competitions). Filter to played matches client-side.
        const data = await fixturesApi.getByTeam(teamId, { season: getCurrentSeason() });
        const list = (data?.response || [])
          .filter((f) => FINISHED_STATUSES.includes(f.fixture?.status?.short))
          .sort((a, b) => new Date(b.fixture.date) - new Date(a.fixture.date));
        setFixtures(list);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [teamId]);

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (error) return <ErrorState message={error} />;
  if (!fixtures.length) return <Empty emoji="📊" text="Aucun résultat disponible" />;

  return (
    <div className="glass-card overflow-hidden">
      {fixtures.map((item, idx) => {
        const { fixture, teams, goals, league } = item;
        const isHome = teams.home.id === Number(teamId);
        const myGoals = isHome ? goals?.home : goals?.away;
        const theirGoals = isHome ? goals?.away : goals?.home;
        const isWin = myGoals != null && theirGoals != null && myGoals > theirGoals;
        const isLoss = myGoals != null && theirGoals != null && myGoals < theirGoals;
        const isDraw = myGoals != null && theirGoals != null && myGoals === theirGoals;
        const resultLabel = isWin ? 'V' : isDraw ? 'N' : isLoss ? 'D' : '?';
        const resultColor = isWin
          ? 'bg-brand-500/20 text-brand-400'
          : isDraw
          ? 'bg-white/10 text-white/50'
          : isLoss
          ? 'bg-red-500/20 text-red-400'
          : 'bg-white/5 text-white/30';

        // Insert a competition divider when the league changes vs. the previous match
        const prevLeagueId = idx > 0 ? fixtures[idx - 1].league?.id : null;
        const showDivider = idx === 0 || prevLeagueId !== league?.id;

        return (
          <Fragment key={fixture.id}>
            {showDivider && <CompetitionDivider league={league} />}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.05] last:border-b-0">
              <span className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-display font-bold flex-shrink-0 ${resultColor}`}>
                {resultLabel}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <img src={teams.home.logo} alt="" className="w-4 h-4 object-contain flex-shrink-0" onError={e => e.target.style.display='none'} />
                    <span className={`text-sm font-semibold truncate max-w-[80px] sm:max-w-[120px] ${teams.home.id === Number(teamId) ? 'text-white/90' : 'text-white/50'}`}>
                      {teams.home.name}
                    </span>
                  </div>
                  <span className="text-sm font-display font-bold text-white flex-shrink-0">
                    {goals?.home ?? '-'} – {goals?.away ?? '-'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-sm font-semibold truncate max-w-[80px] sm:max-w-[120px] ${teams.away.id === Number(teamId) ? 'text-white/90' : 'text-white/50'}`}>
                      {teams.away.name}
                    </span>
                    <img src={teams.away.logo} alt="" className="w-4 h-4 object-contain flex-shrink-0" onError={e => e.target.style.display='none'} />
                  </div>
                </div>
                <p className="text-xs text-white/25 mt-0.5">
                  {format(parseISO(fixture.date), 'd MMM yyyy', { locale: fr })}
                </p>
              </div>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}

function CalendrierTab({ teamId }) {
  const [fixtures, setFixtures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        // All season fixtures (across competitions). Filter to upcoming client-side.
        const data = await fixturesApi.getByTeam(teamId, { season: getCurrentSeason() });
        const list = (data?.response || [])
          .filter((f) => UPCOMING_STATUSES.includes(f.fixture?.status?.short))
          .sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));
        setFixtures(list);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [teamId]);

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (error) return <ErrorState message={error} />;
  if (!fixtures.length) return <Empty emoji="📅" text="Aucun match à venir" />;

  return (
    <div className="glass-card overflow-hidden">
      {fixtures.map((item, idx) => {
        const { fixture, teams, league } = item;
        const isHome = teams.home.id === Number(teamId);
        const opponent = isHome ? teams.away : teams.home;

        // Insert a competition divider when the league changes vs. the previous match
        const prevLeagueId = idx > 0 ? fixtures[idx - 1].league?.id : null;
        const showDivider = idx === 0 || prevLeagueId !== league?.id;

        return (
          <Fragment key={fixture.id}>
            {showDivider && <CompetitionDivider league={league} />}
            <div className="flex items-center gap-4 px-4 py-3 border-b border-white/[0.05] last:border-b-0">
              <div className="w-10 h-10 rounded-xl bg-dark-700 p-1.5 flex-shrink-0 flex items-center justify-center">
                <img src={opponent.logo} alt={opponent.name} className="w-full h-full object-contain" onError={e => e.target.style.display='none'} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white/90 truncate">
                  <span className="text-white/35 text-xs font-normal mr-1.5">{isHome ? 'vs' : '@'}</span>
                  {opponent.name}
                </p>
                <p className="text-xs text-white/30 mt-0.5">
                  {format(parseISO(fixture.date), "EEE d MMM · HH'h'mm", { locale: fr })}
                </p>
              </div>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}

function InjuriesTab({ teamId }) {
  const [injuries, setInjuries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await teamsApi.getInjuries(teamId, 2025);
        setInjuries(data?.response || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [teamId]);

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (error) return <ErrorState message={error} />;
  if (!injuries.length) return <Empty emoji="✅" text="Aucune blessure enregistrée" sub="Tous les joueurs sont disponibles" />;

  const unique = injuries.reduce((acc, item) => {
    const pid = item.player?.id;
    if (pid && !acc.find(x => x.player?.id === pid)) acc.push(item);
    return acc;
  }, []);

  return (
    <div className="glass-card divide-y divide-white/5">
      {unique.map((item, i) => {
        const { player, fixture } = item;
        const type = (player.type || '').toLowerCase();
        const isMissing = type.includes('miss') || type.includes('absent');
        return (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <div className="w-10 h-10 rounded-full bg-dark-700 overflow-hidden flex-shrink-0">
              <img src={player.photo} alt={player.name} className="w-full h-full object-cover" onError={e => e.target.style.display='none'} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white/90">{player.name}</p>
              <p className="text-xs text-white/40">{player.reason || player.type || 'Blessure'}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <span className={`text-xs font-bold px-2 py-1 rounded-lg ${isMissing ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                {isMissing ? 'Absent' : 'Incertain'}
              </span>
              {fixture?.date && (
                <p className="text-xs text-white/25 mt-0.5">{format(parseISO(fixture.date), 'd MMM', { locale: fr })}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TransfersTab({ teamId }) {
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Auto-poll every 3 minutes while the tab is mounted, plus an initial load.
  // Manual refresh button forces a backend cache bust via ?force=1.
  useEffect(() => {
    let cancelled = false;
    const load = async ({ force = false } = {}) => {
      if (force) setRefreshing(true); else setLoading(true);
      try {
        const data = await teamsApi.getTransfers(teamId, { force });
        if (cancelled) return;
        setTransfers(data?.response || []);
        setLastFetch(new Date());
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };
    load();
    const interval = setInterval(() => load({ force: false }), 180000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [teamId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const data = await teamsApi.getTransfers(teamId, { force: true });
      setTransfers(data?.response || []);
      setLastFetch(new Date());
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setRefreshing(false);
    }
  };

  const formatLastFetch = () => {
    if (!lastFetch) return '';
    const diff = Math.round((Date.now() - lastFetch.getTime()) / 1000);
    if (diff < 60) return `il y a ${diff}s`;
    if (diff < 3600) return `il y a ${Math.round(diff / 60)} min`;
    return `il y a ${Math.round(diff / 3600)} h`;
  };

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (error) return <ErrorState message={error} />;

  // API-Football occasionally returns malformed dates like '290715' or '010711'
  // (truncated/legacy format) for very old transfers. Parsing these via new Date()
  // yields year 290715 / 10711 which then ranks first in a desc sort, masking the
  // actual recent transfers. Require strict YYYY-MM-DD before including.
  const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
  const recent = transfers
    .flatMap(t => (t.transfers || []).map(tr => ({ player: t.player, ...tr })))
    .filter(t => t.date && ISO_DATE.test(t.date))
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 30);

  const refreshHeader = (
    <div className="flex items-center justify-between mb-3">
      <div className="text-xs text-white/30 font-heading">
        {recent.length > 0 && lastFetch && (
          <>Dernière mise à jour : <span className="text-white/50">{formatLastFetch()}</span></>
        )}
      </div>
      <button
        onClick={handleRefresh}
        disabled={refreshing}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-brand-500/30 text-xs font-heading font-semibold text-brand-400 hover:bg-brand-500/10 transition-all disabled:opacity-50"
      >
        <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
        {refreshing ? 'Actualisation...' : 'Actualiser'}
      </button>
    </div>
  );

  if (!recent.length) return (
    <div>
      {refreshHeader}
      <Empty emoji="↔️" text="Aucun transfert disponible" />
    </div>
  );

  return (
    <div>
      {refreshHeader}
      <div className="glass-card divide-y divide-white/5">
      {recent.map((tr, i) => {
        const isIn = tr.teams?.in?.id === Number(teamId);
        const otherTeam = isIn ? tr.teams?.out : tr.teams?.in;
        const fee = tr.type;
        const isFree = (fee || '').toLowerCase().includes('free') || (fee || '').toLowerCase().includes('gratuit');
        const isLoan = (fee || '').toLowerCase().includes('loan') || (fee || '').toLowerCase().includes('prêt');
        return (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <div className="w-10 h-10 rounded-full bg-dark-700 overflow-hidden flex-shrink-0">
              <img src={tr.player?.photo} alt={tr.player?.name} className="w-full h-full object-cover" onError={e => e.target.style.display='none'} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white/90 truncate">{tr.player?.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`text-xs font-bold ${isIn ? 'text-green-400' : 'text-red-400'}`}>
                  {isIn ? '↙ Arrivée' : '↗ Départ'}
                </span>
                {otherTeam?.name && (
                  <span className="text-xs text-white/30">· {otherTeam.name}</span>
                )}
              </div>
            </div>
            <div className="text-right flex-shrink-0 space-y-0.5">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                isFree ? 'bg-white/10 text-white/50' :
                isLoan ? 'bg-blue-500/20 text-blue-400' :
                fee ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 text-white/30'
              }`}>
                {isFree ? 'Gratuit' : isLoan ? 'Prêt' : fee || '?'}
              </span>
              {tr.date && (
                <p className="text-xs text-white/25">{format(parseISO(tr.date), 'MMM yyyy', { locale: fr })}</p>
              )}
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}

function Empty({ emoji, text, sub }) {
  return (
    <div className="glass-card p-12 text-center">
      <p className="text-4xl mb-3">{emoji}</p>
      <p className="text-white/60 font-semibold">{text}</p>
      {sub && <p className="text-white/30 text-sm mt-1">{sub}</p>}
    </div>
  );
}
