import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, MapPin, Calendar, Ruler, Weight, ArrowLeftRight, Activity, Plus } from 'lucide-react';
import { playersApi } from '../services/api';
import { Spinner, ErrorState } from '../components/ui/Loading';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import clsx from 'clsx';

export default function Player() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [seasonsAvailable, setSeasonsAvailable] = useState([]);
  const [season, setSeason] = useState(null);
  const [playerData, setPlayerData] = useState(null);
  const [transfers, setTransfers] = useState([]);
  const [sidelined, setSidelined] = useState([]);
  const [career, setCareer] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingCareer, setLoadingCareer] = useState(false);
  const [error, setError] = useState(null);

  // Étape 1 : liste des saisons jouées par ce joueur (saison par défaut = max).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await playersApi.getSeasons(id);
        const list = (r?.response || []).filter((y) => Number.isInteger(y)).sort((a, b) => b - a);
        if (cancelled) return;
        if (list.length > 0) {
          setSeasonsAvailable(list);
          setSeason(list[0]);
        } else {
          const now = new Date();
          const fallback = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
          setSeasonsAvailable([fallback]);
          setSeason(fallback);
        }
      } catch {
        const now = new Date();
        const fallback = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
        if (cancelled) return;
        setSeasonsAvailable([fallback]);
        setSeason(fallback);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  // Étape 2 : profil + stats de la saison + trophées + transferts + blessures.
  useEffect(() => {
    if (!season) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [p, tr, sl] = await Promise.allSettled([
          playersApi.getById(id, season),
          playersApi.getTransfers(id),
          playersApi.getSidelined(id),
        ]);
        if (cancelled) return;
        if (p.status === 'fulfilled') setPlayerData(p.value?.response?.[0] || null);
        if (tr.status === 'fulfilled') setTransfers(tr.value?.response || []);
        if (sl.status === 'fulfilled') setSidelined(sl.value?.response || []);
        if (p.status === 'rejected') setError(p.reason?.message || 'Erreur chargement joueur');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, season]);

  // Étape 3 (lazy) : charge la carrière complète au 1er affichage de la
  // section. Évite ~10 calls API si le user ne descend pas jusque-là.
  const loadCareerIfNeeded = async () => {
    if (career.length > 0 || loadingCareer) return;
    setLoadingCareer(true);
    try {
      const r = await playersApi.getCareer(id);
      setCareer(r?.response || []);
    } finally {
      setLoadingCareer(false);
    }
  };

  if (loading && !playerData) return (
    <div className="flex justify-center items-center h-64"><Spinner /></div>
  );
  if (error && !playerData) return <ErrorState message={error} />;
  if (!playerData) return <ErrorState message="Joueur introuvable" />;

  const { player } = playerData;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-6 overflow-x-hidden">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-white/40 hover:text-white/70 text-sm transition-colors w-fit">
        <ArrowLeft className="w-4 h-4" /> Retour
      </button>

      <PlayerHeader player={player} statistics={playerData.statistics || []} />

      <SeasonPicker
        seasons={seasonsAvailable}
        selected={season}
        onSelect={setSeason}
        loading={loading}
      />

      <CareerSection career={career} loading={loadingCareer} onLoad={loadCareerIfNeeded} />

      <RecentMatches playerId={id} season={season} />

      <TransfersTable transfers={transfers} />

      <SidelinedTable sidelined={sidelined} />
    </motion.div>
  );
}

// Traduction des libellés de poste API-Football.
const POSITION_FR = {
  Attacker: 'Attaquant',
  Midfielder: 'Milieu',
  Defender: 'Défenseur',
  Goalkeeper: 'Gardien',
};

function PlayerHeader({ player, statistics }) {
  // L'équipe principale est généralement la 1ère entrée des stats (championnat).
  // Pour le poste, idem : on prend celui de l'équipe principale.
  const mainStat = statistics[0];
  const team = mainStat?.team;
  const positionFr = POSITION_FR[mainStat?.games?.position] || mainStat?.games?.position;
  const birthDateFr = player.birth?.date
    ? format(parseISO(player.birth.date), 'dd.MM.yyyy', { locale: fr })
    : null;

  return (
    <div className="glass-card p-5">
      <div className="flex items-center gap-4">
        {/* Photo joueur */}
        <img
          src={player.photo}
          alt={player.name}
          className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg object-cover flex-shrink-0 bg-dark-700"
          onError={(e) => { e.target.style.display = 'none'; }}
        />

        {/* Bloc central : nom + poste + infos */}
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-2xl sm:text-3xl text-white tracking-wide leading-tight truncate">
            {player.firstname} {player.lastname}
          </h1>
          <div className="mt-2 space-y-1 text-sm">
            {(positionFr || team) && (
              <p className="text-white/80 font-heading">
                {positionFr && <span className="font-semibold">{positionFr}</span>}
                {team && (
                  <>
                    {positionFr && ' '}
                    <Link to={`/team/${team.id}`} className="text-brand-300 hover:text-brand-200 transition-colors">
                      ({team.name})
                    </Link>
                  </>
                )}
              </p>
            )}
            {(player.age != null || birthDateFr) && (
              <p className="text-white/70 font-heading">
                <span className="font-semibold text-white/45">Âge :</span>{' '}
                {player.age ?? '—'}{birthDateFr && ` (${birthDateFr})`}
              </p>
            )}
            {player.nationality && (
              <p className="text-white/70 font-heading flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-white/45 flex-shrink-0" /> {player.nationality}
              </p>
            )}
            {(player.height || player.weight) && (
              <p className="text-white/55 font-heading text-xs flex gap-3">
                {player.height && <span className="flex items-center gap-1"><Ruler className="w-3 h-3" /> {player.height}</span>}
                {player.weight && <span className="flex items-center gap-1"><Weight className="w-3 h-3" /> {player.weight}</span>}
              </p>
            )}
          </div>
        </div>

        {/* Logo équipe à droite (cliquable vers la fiche équipe) */}
        {team?.logo && (
          <Link to={`/team/${team.id}`} className="flex-shrink-0 hover:scale-105 transition-transform">
            <img
              src={team.logo}
              alt={team.name}
              className="w-16 h-16 sm:w-20 sm:h-20 object-contain"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </Link>
        )}
      </div>
    </div>
  );
}

function SeasonPicker({ seasons, selected, onSelect, loading }) {
  if (seasons.length === 0) return null;
  return (
    <div>
      <p className="text-xs text-white/40 uppercase tracking-wider font-heading font-semibold mb-2">Saison</p>
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {seasons.map((y) => (
          <button
            key={y}
            onClick={() => onSelect(y)}
            disabled={loading}
            className={clsx(
              'px-3 py-1.5 rounded-xl text-xs font-heading font-semibold border transition-all whitespace-nowrap',
              selected === y
                ? 'bg-brand-500/15 border-brand-500/40 text-brand-300'
                : 'border-white/[0.08] text-white/35 hover:text-white/60',
              loading && 'opacity-50',
            )}
          >
            {y}/{(y + 1).toString().slice(-2)}
          </button>
        ))}
      </div>
    </div>
  );
}

// Bucket de compétition pour les onglets de carrière. League type=League =
// championnat ; Cup en country=World = international ; Cup ailleurs =
// coupe nationale. National team détecté via "World" + league type=Cup
// avec mots-clés Nations/World Cup/Friendlies/Euro etc.
function competitionBucket(row) {
  const lname = (row.league?.name || '').toLowerCase();
  const country = row.league?.country || '';
  const type = row.league?.type || '';
  const isNational = /nations league|world cup|euro |afcon|copa america|qualif|friendlies|amistosos|kirin cup|asian cup|cosafa/i.test(lname);
  if (isNational) return 'national';
  if (country === 'World') return 'international';
  if (type === 'Cup') return 'cup';
  return 'league';
}

const CAREER_TABS = [
  { id: 'league', label: 'Championnat' },
  { id: 'cup', label: 'Coupes nationales' },
  { id: 'international', label: 'Coupes internationales' },
  { id: 'national', label: 'Équipe nationale' },
];

function CareerSection({ career, loading, onLoad }) {
  const [tab, setTab] = useState('league');
  const [hasOpened, setHasOpened] = useState(false);

  useEffect(() => {
    if (hasOpened && career.length === 0 && !loading) {
      onLoad();
    }
  }, [hasOpened, career.length, loading, onLoad]);

  const filtered = useMemo(
    () => career.filter((r) => competitionBucket(r) === tab),
    [career, tab],
  );

  const totals = useMemo(() => {
    const acc = { games: 0, goals: 0, assists: 0, yellow: 0, red: 0 };
    filtered.forEach((r) => {
      acc.games += r.games?.appearences || 0;
      acc.goals += r.goals?.total || 0;
      acc.assists += r.goals?.assists || 0;
      acc.yellow += r.cards?.yellow || 0;
      acc.red += r.cards?.red || 0;
    });
    return acc;
  }, [filtered]);

  return (
    <div className="glass-card overflow-hidden">
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between gap-2">
        <h2 className="font-heading font-bold text-white text-lg">Carrière</h2>
        {!hasOpened && career.length === 0 && (
          <button
            onClick={() => setHasOpened(true)}
            className="flex items-center gap-1.5 text-xs font-heading font-semibold text-brand-300 hover:text-brand-200 border border-brand-500/30 hover:border-brand-500/60 rounded-lg px-3 py-1.5 transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> Charger
          </button>
        )}
      </div>

      {hasOpened && (
        <>
          <div className="flex gap-1 px-3 pt-3 overflow-x-auto no-scrollbar">
            {CAREER_TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-xs font-heading font-semibold whitespace-nowrap transition-all border-b-2',
                  tab === t.id
                    ? 'text-brand-300 border-brand-400'
                    : 'text-white/40 border-transparent hover:text-white/70',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="p-3 overflow-x-auto">
            {loading && career.length === 0 ? (
              <div className="py-8 text-center text-white/40 text-sm">Chargement de la carrière…</div>
            ) : filtered.length === 0 ? (
              <div className="py-6 text-center text-white/40 text-sm">Aucune donnée dans cette catégorie.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] text-white/40 uppercase tracking-wider border-b border-white/5">
                    <th className="text-left px-2 py-2">Saison</th>
                    <th className="text-left px-2 py-2">Équipe</th>
                    <th className="text-left px-2 py-2 hidden sm:table-cell">Compétition</th>
                    <th className="text-center px-1.5 py-2">⌀</th>
                    <th className="text-center px-1.5 py-2">MJ</th>
                    <th className="text-center px-1.5 py-2">⚽</th>
                    <th className="text-center px-1.5 py-2">PD</th>
                    <th className="text-center px-1.5 py-2 text-yellow-500/70">🟨</th>
                    <th className="text-center px-1.5 py-2 text-red-500/70">🟥</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => {
                    const rating = r.games?.rating ? parseFloat(r.games.rating) : null;
                    return (
                      <tr key={`${r.season}-${r.team?.id}-${r.league?.id}-${i}`} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                        <td className="px-2 py-2 text-white/55 font-mono text-xs whitespace-nowrap">{r.season}/{(r.season + 1).toString().slice(-2)}</td>
                        <td className="px-2 py-2">
                          <Link to={`/team/${r.team?.id}`} className="flex items-center gap-2 group">
                            {r.team?.logo && <img src={r.team.logo} alt="" className="w-4 h-4 object-contain flex-shrink-0" onError={(e) => e.target.style.display = 'none'} />}
                            <span className="text-white/85 font-heading font-semibold text-xs truncate group-hover:text-brand-400">{r.team?.name}</span>
                          </Link>
                        </td>
                        <td className="px-2 py-2 hidden sm:table-cell">
                          <span className="text-white/55 text-xs truncate">{r.league?.name}</span>
                        </td>
                        <td className="px-1.5 py-2 text-center">
                          {rating != null ? (
                            <span className={clsx(
                              'inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-bold tabular-nums',
                              rating >= 7.5 ? 'bg-brand-500/30 text-brand-200'
                                : rating >= 7 ? 'bg-brand-500/15 text-brand-300'
                                : rating >= 6.5 ? 'bg-orange-500/15 text-orange-300'
                                : 'bg-red-500/15 text-red-300',
                            )}>{rating.toFixed(1)}</span>
                          ) : <span className="text-white/20">—</span>}
                        </td>
                        <td className="px-1.5 py-2 text-center text-white text-xs font-mono">{r.games?.appearences ?? '—'}</td>
                        <td className="px-1.5 py-2 text-center text-xs font-mono">
                          <span className={r.goals?.total > 0 ? 'text-brand-400 font-bold' : 'text-white/50'}>{r.goals?.total ?? 0}</span>
                        </td>
                        <td className="px-1.5 py-2 text-center text-xs font-mono">
                          <span className={r.goals?.assists > 0 ? 'text-brand-400 font-bold' : 'text-white/50'}>{r.goals?.assists ?? 0}</span>
                        </td>
                        <td className="px-1.5 py-2 text-center text-yellow-400/80 text-xs font-mono">{r.cards?.yellow ?? 0}</td>
                        <td className="px-1.5 py-2 text-center text-red-400/80 text-xs font-mono">{r.cards?.red ?? 0}</td>
                      </tr>
                    );
                  })}
                  {/* Ligne TOTAL */}
                  <tr className="border-t border-white/15 bg-white/[0.03]">
                    <td colSpan={3} className="px-2 py-2 text-[10px] text-white/40 uppercase tracking-wider font-heading font-bold">Total</td>
                    <td className="px-1.5 py-2"></td>
                    <td className="px-1.5 py-2 text-center text-white text-xs font-mono font-bold">{totals.games}</td>
                    <td className="px-1.5 py-2 text-center text-brand-400 text-xs font-mono font-bold">{totals.goals}</td>
                    <td className="px-1.5 py-2 text-center text-brand-400 text-xs font-mono font-bold">{totals.assists}</td>
                    <td className="px-1.5 py-2 text-center text-yellow-400/80 text-xs font-mono font-bold">{totals.yellow}</td>
                    <td className="px-1.5 py-2 text-center text-red-400/80 text-xs font-mono font-bold">{totals.red}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Lazy : ne charge les 15 derniers matchs qu'au clic du bouton, pour
// économiser ~20 appels API quand l'utilisateur ne descend pas jusque-là.
function RecentMatches({ playerId, season }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    // Reset si on change de saison
    setMatches([]);
    setOpened(false);
  }, [season]);

  const load = async () => {
    if (loading) return;
    setOpened(true);
    setLoading(true);
    try {
      const r = await playersApi.getRecentMatches(playerId, season, 15);
      setMatches(r?.response || []);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card overflow-hidden">
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between gap-2">
        <h2 className="font-heading font-bold text-white text-lg">Derniers matchs</h2>
        {!opened && (
          <button
            onClick={load}
            className="flex items-center gap-1.5 text-xs font-heading font-semibold text-brand-300 hover:text-brand-200 border border-brand-500/30 hover:border-brand-500/60 rounded-lg px-3 py-1.5 transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> Charger les 15 derniers
          </button>
        )}
      </div>

      {opened && (
        <div className="p-3 overflow-x-auto">
          {loading ? (
            <div className="py-8 text-center text-white/40 text-sm">Récupération des stats match par match…</div>
          ) : matches.length === 0 ? (
            <div className="py-6 text-center text-white/40 text-sm">Aucun match récent.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] text-white/40 uppercase tracking-wider border-b border-white/5">
                  <th className="text-left px-2 py-2">Date</th>
                  <th className="text-left px-2 py-2">Match</th>
                  <th className="text-center px-1.5 py-2">⌀</th>
                  <th className="text-center px-1.5 py-2">Min</th>
                  <th className="text-center px-1.5 py-2">⚽</th>
                  <th className="text-center px-1.5 py-2">PD</th>
                  <th className="text-center px-1.5 py-2 text-yellow-500/70">🟨</th>
                  <th className="text-center px-1.5 py-2 text-red-500/70">🟥</th>
                  <th className="text-center px-1.5 py-2">Rés</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((m, i) => {
                  const f = m.fixture;
                  const s = m.stats || {};
                  const rating = s.games?.rating ? parseFloat(s.games.rating) : null;
                  const hg = f.goals?.home, ag = f.goals?.away;
                  const isHome = s.team?.id === f.teams?.home?.id; // imprécis sans tag, mais pas critique
                  const playerTeamId = s.team?.id;
                  // Détermine W/D/L du POV de l'équipe du joueur
                  let result = '—', resultColor = 'text-white/30';
                  if (Number.isFinite(hg) && Number.isFinite(ag) && playerTeamId) {
                    if (hg === ag) { result = 'N'; resultColor = 'bg-yellow-500/15 text-yellow-300'; }
                    else if ((playerTeamId === f.teams?.home?.id && hg > ag) || (playerTeamId === f.teams?.away?.id && ag > hg)) {
                      result = 'V'; resultColor = 'bg-brand-500/30 text-brand-200';
                    } else {
                      result = 'D'; resultColor = 'bg-red-500/20 text-red-300';
                    }
                  }
                  return (
                    <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                      <td className="px-2 py-2 text-white/55 font-mono text-[11px] whitespace-nowrap">
                        {f.fixture?.date ? format(parseISO(f.fixture.date), 'dd.MM.yy', { locale: fr }) : '—'}
                      </td>
                      <td className="px-2 py-2">
                        <Link to={`/match/${f.fixture?.id}`} className="block group">
                          <div className="flex items-center gap-1.5 text-xs">
                            {f.teams?.home?.logo && <img src={f.teams.home.logo} alt="" className="w-4 h-4 object-contain flex-shrink-0" />}
                            <span className="text-white/70 truncate max-w-[80px]">{f.teams?.home?.name}</span>
                            <span className="text-white font-mono font-bold tabular-nums">{hg ?? '–'}-{ag ?? '–'}</span>
                            {f.teams?.away?.logo && <img src={f.teams.away.logo} alt="" className="w-4 h-4 object-contain flex-shrink-0" />}
                            <span className="text-white/70 truncate max-w-[80px]">{f.teams?.away?.name}</span>
                          </div>
                        </Link>
                      </td>
                      <td className="px-1.5 py-2 text-center">
                        {rating != null ? (
                          <span className={clsx(
                            'inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-bold tabular-nums',
                            rating >= 7.5 ? 'bg-brand-500/30 text-brand-200'
                              : rating >= 7 ? 'bg-brand-500/15 text-brand-300'
                              : rating >= 6.5 ? 'bg-orange-500/15 text-orange-300'
                              : 'bg-red-500/15 text-red-300',
                          )}>{rating.toFixed(1)}</span>
                        ) : <span className="text-white/20">—</span>}
                      </td>
                      <td className="px-1.5 py-2 text-center text-white/60 text-xs font-mono">{s.games?.minutes ?? '—'}</td>
                      <td className="px-1.5 py-2 text-center text-xs font-mono">
                        <span className={s.goals?.total > 0 ? 'text-brand-400 font-bold' : 'text-white/50'}>{s.goals?.total ?? 0}</span>
                      </td>
                      <td className="px-1.5 py-2 text-center text-xs font-mono">
                        <span className={s.goals?.assists > 0 ? 'text-brand-400 font-bold' : 'text-white/50'}>{s.goals?.assists ?? 0}</span>
                      </td>
                      <td className="px-1.5 py-2 text-center text-yellow-400/80 text-xs font-mono">{s.cards?.yellow ?? 0}</td>
                      <td className="px-1.5 py-2 text-center text-red-400/80 text-xs font-mono">{s.cards?.red ?? 0}</td>
                      <td className="px-1.5 py-2 text-center">
                        <span className={clsx('inline-block w-6 py-0.5 rounded text-[10px] font-mono font-bold', resultColor)}>{result}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function TransfersTable({ transfers }) {
  const allTransfers = (transfers || []).flatMap((t) => t.transfers || []);
  if (allTransfers.length === 0) return null;
  return (
    <div className="glass-card overflow-hidden">
      <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
        <ArrowLeftRight className="w-4 h-4 text-white/60" />
        <h2 className="font-heading font-bold text-white text-lg">Transferts</h2>
        <span className="text-xs text-white/40 ml-auto font-mono">{allTransfers.length}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] text-white/40 uppercase tracking-wider border-b border-white/5">
              <th className="text-left px-3 py-2">Date</th>
              <th className="text-left px-3 py-2">De</th>
              <th className="text-left px-3 py-2">Type</th>
              <th className="text-left px-3 py-2">Vers</th>
            </tr>
          </thead>
          <tbody>
            {allTransfers.map((tr, i) => (
              <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                <td className="px-3 py-2.5 text-white/55 font-mono text-xs whitespace-nowrap">
                  {tr.date ? format(parseISO(tr.date), 'dd.MM.yyyy', { locale: fr }) : '—'}
                </td>
                <td className="px-3 py-2.5">
                  {tr.teams?.out ? (
                    <Link to={`/team/${tr.teams.out.id}`} className="flex items-center gap-2 group">
                      {tr.teams.out.logo && <img src={tr.teams.out.logo} alt="" className="w-4 h-4 object-contain" />}
                      <span className="text-white/80 font-heading font-semibold text-xs group-hover:text-brand-400">{tr.teams.out.name}</span>
                    </Link>
                  ) : <span className="text-white/30">—</span>}
                </td>
                <td className="px-3 py-2.5">
                  <span className="text-[10px] uppercase tracking-wider font-mono text-brand-300 px-2 py-0.5 rounded bg-brand-500/10 whitespace-nowrap">
                    → {translateTransferType(tr.type)}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  {tr.teams?.in ? (
                    <Link to={`/team/${tr.teams.in.id}`} className="flex items-center gap-2 group">
                      {tr.teams.in.logo && <img src={tr.teams.in.logo} alt="" className="w-4 h-4 object-contain" />}
                      <span className="text-white font-heading font-semibold text-xs group-hover:text-brand-400">{tr.teams.in.name}</span>
                    </Link>
                  ) : <span className="text-white/30">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function translateTransferType(t) {
  const s = (t || '').toLowerCase();
  if (s.includes('loan return') || s.includes('end of loan')) return 'Retour de prêt';
  if (s.includes('loan')) return 'Prêt';
  if (s.includes('free')) return 'Libre';
  if (/[€$£]/.test(t)) return t; // montant déjà formaté
  if (s === 'n/a' || !s) return 'Transfert';
  return t;
}

function SidelinedTable({ sidelined }) {
  if (!sidelined.length) return null;
  // Trie par date de début descendante (plus récent en haut)
  const sorted = [...sidelined].sort((a, b) => new Date(b.start || 0) - new Date(a.start || 0));
  return (
    <div className="glass-card overflow-hidden">
      <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
        <Activity className="w-4 h-4 text-red-400/70" />
        <h2 className="font-heading font-bold text-white text-lg">Historique des absences</h2>
        <span className="text-xs text-white/40 ml-auto font-mono">{sorted.length}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] text-white/40 uppercase tracking-wider border-b border-white/5">
              <th className="text-left px-3 py-2">Du</th>
              <th className="text-left px-3 py-2">Au</th>
              <th className="text-left px-3 py-2">Cause</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s, i) => (
              <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                <td className="px-3 py-2.5 text-white/55 font-mono text-xs whitespace-nowrap">
                  {s.start ? format(parseISO(s.start), 'dd.MM.yyyy', { locale: fr }) : '—'}
                </td>
                <td className="px-3 py-2.5 text-white/55 font-mono text-xs whitespace-nowrap">
                  {s.end ? format(parseISO(s.end), 'dd.MM.yyyy', { locale: fr }) : '—'}
                </td>
                <td className="px-3 py-2.5">
                  <span className="text-xs text-red-300/90 font-heading font-semibold uppercase tracking-wider">
                    + {translateSidelinedType(s.type)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function translateSidelinedType(t) {
  const map = {
    'Knock': 'Coup',
    'Illness': 'Malade',
    'Muscle Injury': 'Lésion musculaire',
    'Thigh Injury': 'Blessure à la cuisse',
    'Hamstring': 'Blessure aux ischios',
    'Ankle Injury': 'Blessure à la cheville',
    'Knee Injury': 'Blessure au genou',
    'Back Injury': 'Blessure au dos',
    'Lower back injury': 'Blessure bas du dos',
    'Calf Injury': 'Blessure au mollet',
    'Groin Injury': 'Blessure à l\'aine',
    'Head Injury': 'Blessure à la tête',
    'Foot Injury': 'Blessure au pied',
    'Hip Injury': 'Blessure à la hanche',
    'Shoulder Injury': 'Blessure à l\'épaule',
    'Lack of Match Fitness': 'Manque de condition',
    'Injury': 'Blessure',
    'Suspended': 'Suspendu',
  };
  return map[t] || t || '—';
}

