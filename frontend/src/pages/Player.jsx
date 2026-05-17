import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, MapPin, Calendar, Trophy, Ruler, Weight, Shirt, ArrowLeftRight } from 'lucide-react';
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
  const [trophies, setTrophies] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Étape 1 : récupère la liste des saisons jouées par ce joueur. On en
  // déduit la saison par défaut (la plus récente). Si pas de réponse, on
  // tombe sur l'année courante calculée à partir de aujourd'hui.
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
      } catch (e) {
        // En cas d'erreur on tombe sur l'année courante quand même
        const now = new Date();
        const fallback = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
        if (cancelled) return;
        setSeasonsAvailable([fallback]);
        setSeason(fallback);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  // Étape 2 : profil + stats de la saison sélectionnée + trophées +
  // transferts. On parallélise pour réduire le temps de chargement.
  useEffect(() => {
    if (!season) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [p, t, tr] = await Promise.allSettled([
          playersApi.getById(id, season),
          playersApi.getTrophies(id),
          playersApi.getTransfers(id),
        ]);
        if (cancelled) return;
        if (p.status === 'fulfilled') setPlayerData(p.value?.response?.[0] || null);
        if (t.status === 'fulfilled') setTrophies(t.value?.response || []);
        if (tr.status === 'fulfilled') setTransfers(tr.value?.response || []);
        if (p.status === 'rejected') setError(p.reason?.message || 'Erreur chargement joueur');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, season]);

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

      <PlayerHeader player={player} />

      <SeasonPicker
        seasons={seasonsAvailable}
        selected={season}
        onSelect={setSeason}
        loading={loading}
      />

      <StatisticsGrid statistics={playerData.statistics || []} />

      <TransfersList transfers={transfers} />

      <TrophiesList trophies={trophies} />
    </motion.div>
  );
}

function PlayerHeader({ player }) {
  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-5">
        <img
          src={player.photo}
          alt={player.name}
          className="w-24 h-24 rounded-full object-cover flex-shrink-0 border-2 border-white/10"
          onError={(e) => { e.target.style.display = 'none'; }}
        />
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-3xl md:text-4xl text-white tracking-wide leading-tight truncate">
            {player.firstname} {player.lastname}
          </h1>
          {player.nationality && (
            <p className="text-sm text-white/55 font-heading mt-1 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> {player.nationality}
              {player.age != null && <span className="text-white/35">· {player.age} ans</span>}
            </p>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-white/50 font-mono">
            {player.birth?.date && (
              <span className="flex items-center gap-1.5"><Calendar className="w-3 h-3" /> Né le {format(parseISO(player.birth.date), 'd MMM yyyy', { locale: fr })}{player.birth.place && ` · ${player.birth.place}`}</span>
            )}
            {player.height && <span className="flex items-center gap-1.5"><Ruler className="w-3 h-3" /> {player.height}</span>}
            {player.weight && <span className="flex items-center gap-1.5"><Weight className="w-3 h-3" /> {player.weight}</span>}
          </div>
        </div>
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

// Affiche les stats agrégées par compétition pour la saison choisie.
// API-Football renvoie un tableau `statistics` avec une entrée par
// {team, league}. Si un joueur a joué dans plusieurs clubs/compets dans
// la saison, on aura plusieurs entrées.
function StatisticsGrid({ statistics }) {
  if (!statistics.length) {
    return (
      <div className="glass-card p-6 text-center text-white/40 text-sm">
        Aucune statistique pour cette saison.
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <p className="text-xs text-white/40 uppercase tracking-wider font-heading font-semibold">
        Statistiques · {statistics.length} compétition{statistics.length > 1 ? 's' : ''}
      </p>
      {statistics.map((s, i) => (
        <div key={i} className="glass-card p-4">
          <div className="flex items-center gap-3 mb-4">
            {s.team?.logo && <img src={s.team.logo} alt="" className="w-8 h-8 object-contain" />}
            <div className="flex-1 min-w-0">
              <Link to={`/team/${s.team?.id}`} className="font-heading font-bold text-white text-base hover:text-brand-400 transition-colors truncate block">
                {s.team?.name}
              </Link>
              <p className="text-xs text-white/45 truncate flex items-center gap-1.5">
                {s.league?.logo && <img src={s.league.logo} alt="" className="w-3.5 h-3.5 object-contain" />}
                {s.league?.name} · {s.league?.country}
              </p>
            </div>
            {s.games?.position && (
              <span className="text-[10px] uppercase tracking-wider font-mono text-white/40 px-2 py-1 rounded bg-white/[0.05]">
                {s.games.position}
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            <Stat label="Matchs" value={s.games?.appearences} />
            <Stat label="Titulaire" value={s.games?.lineups} />
            <Stat label="Minutes" value={s.games?.minutes} />
            <Stat label="Note moy." value={s.games?.rating ? parseFloat(s.games.rating).toFixed(2) : null} accent={s.games?.rating ? parseFloat(s.games.rating) >= 7 ? 'brand' : null : null} />

            <Stat label="Buts" value={s.goals?.total} accent={s.goals?.total > 0 ? 'brand' : null} />
            <Stat label="Passes déc." value={s.goals?.assists} accent={s.goals?.assists > 0 ? 'brand' : null} />
            <Stat label="Tirs" value={s.shots?.total} />
            <Stat label="Tirs cadrés" value={s.shots?.on} />

            <Stat label="Passes" value={s.passes?.total} />
            <Stat label="% passes" value={s.passes?.accuracy != null ? `${s.passes.accuracy}%` : null} />
            <Stat label="Passes clés" value={s.passes?.key} />
            <Stat label="Dribbles ✓" value={s.dribbles?.success} />

            <Stat label="Tacles" value={s.tackles?.total} />
            <Stat label="Duels gag." value={s.duels?.won} />
            <Stat label="Fautes faites" value={s.fouls?.committed} />
            <Stat label="Fautes subies" value={s.fouls?.drawn} />

            <Stat label="🟨 Jaunes" value={s.cards?.yellow} accent={s.cards?.yellow > 5 ? 'orange' : null} />
            <Stat label="🟥 Rouges" value={s.cards?.red} accent={s.cards?.red > 0 ? 'danger' : null} />
            <Stat label="Penaltys" value={s.penalty?.scored != null ? `${s.penalty.scored}/${(s.penalty.scored || 0) + (s.penalty.missed || 0)}` : null} />
            <Stat label="Buts encaissés" value={s.goals?.conceded} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value, accent }) {
  const display = value === 0 || value ? value : '—';
  const color = accent === 'brand' ? 'text-brand-400'
    : accent === 'orange' ? 'text-orange-400'
    : accent === 'danger' ? 'text-danger'
    : 'text-white';
  return (
    <div className="rounded-lg bg-dark-800/60 px-2.5 py-2">
      <p className={`text-base font-display font-bold tabular-nums leading-none ${color}`}>{display}</p>
      <p className="text-[10px] text-white/35 font-heading mt-1 truncate uppercase tracking-wider">{label}</p>
    </div>
  );
}

function TransfersList({ transfers }) {
  if (!transfers.length) return null;
  // API renvoie 1 entrée par joueur avec un tableau `transfers` chronologique
  // descendant. On l'aplatit et on affiche en timeline.
  const allTransfers = transfers.flatMap((t) => t.transfers || []);
  if (allTransfers.length === 0) return null;
  return (
    <div>
      <p className="text-xs text-white/40 uppercase tracking-wider font-heading font-semibold mb-2 flex items-center gap-1.5">
        <ArrowLeftRight className="w-3.5 h-3.5" /> Carrière · {allTransfers.length} transfert{allTransfers.length > 1 ? 's' : ''}
      </p>
      <div className="glass-card divide-y divide-white/[0.05]">
        {allTransfers.map((tr, i) => (
          <div key={i} className="px-4 py-3 flex items-center gap-3 text-sm">
            <span className="text-xs text-white/45 font-mono tabular-nums min-w-[80px]">
              {tr.date ? format(parseISO(tr.date), 'MMM yyyy', { locale: fr }) : '—'}
            </span>
            <div className="flex-1 flex items-center gap-2 min-w-0">
              {tr.teams?.out?.logo && <img src={tr.teams.out.logo} alt="" className="w-5 h-5 object-contain flex-shrink-0" />}
              <Link to={`/team/${tr.teams?.out?.id}`} className="text-white/60 hover:text-brand-400 truncate text-xs">{tr.teams?.out?.name}</Link>
              <ArrowLeftRight className="w-3 h-3 text-white/30 flex-shrink-0" />
              {tr.teams?.in?.logo && <img src={tr.teams.in.logo} alt="" className="w-5 h-5 object-contain flex-shrink-0" />}
              <Link to={`/team/${tr.teams?.in?.id}`} className="text-white font-heading font-semibold hover:text-brand-400 truncate text-xs">{tr.teams?.in?.name}</Link>
            </div>
            {tr.type && (
              <span className="text-[10px] uppercase tracking-wider font-mono text-white/40 px-2 py-0.5 rounded bg-white/[0.05] whitespace-nowrap">
                {translateTransferType(tr.type)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function translateTransferType(t) {
  const s = (t || '').toLowerCase();
  if (s.includes('loan')) return 'Prêt';
  if (s.includes('free')) return 'Libre';
  if (s.includes('n/a')) return t;
  // Si la valeur ressemble à un montant (€/$) on la laisse telle quelle
  if (/[€$£]/.test(t)) return t;
  return t;
}

function TrophiesList({ trophies }) {
  if (!trophies.length) return null;
  // Groupe par compétition pour réduire le bruit
  const grouped = trophies.reduce((acc, t) => {
    const key = `${t.league}__${t.country}`;
    if (!acc[key]) acc[key] = { league: t.league, country: t.country, entries: [] };
    acc[key].entries.push(t);
    return acc;
  }, {});
  const list = Object.values(grouped).sort((a, b) => b.entries.length - a.entries.length);

  return (
    <div>
      <p className="text-xs text-white/40 uppercase tracking-wider font-heading font-semibold mb-2 flex items-center gap-1.5">
        <Trophy className="w-3.5 h-3.5" /> Palmarès · {trophies.length} trophée{trophies.length > 1 ? 's' : ''}
      </p>
      <div className="glass-card divide-y divide-white/[0.05]">
        {list.map((g, i) => (
          <div key={i} className="px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-heading font-bold text-white truncate">{g.league}</p>
              <span className="text-xs text-white/45">{g.country}</span>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {g.entries.map((e, j) => (
                <span
                  key={j}
                  className={clsx(
                    'text-[10px] font-mono px-1.5 py-0.5 rounded border',
                    (e.place || '').toLowerCase().includes('winner')
                      ? 'bg-gold-500/15 border-gold-500/40 text-gold-300'
                      : 'bg-white/[0.05] border-white/15 text-white/50',
                  )}
                >
                  {e.season} {(e.place || '').toLowerCase().includes('winner') ? '🏆' : ''}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
