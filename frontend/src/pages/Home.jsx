import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Target, TrendingUp, RefreshCw, Shield, Trophy, ChevronRight, BookOpen, Star, Flame } from 'lucide-react';
import { pronosticsApi } from '../services/api';
import { formatTime } from '../utils/format';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import clsx from 'clsx';
import { useHistoryStore, useFavoritesStore, useBankrollStore } from '../store';
import { kellyStake } from '../utils/kelly';

function getConfidenceConfig(score) {
  if (score >= 70) return {
    label: 'Haute',
    color: 'text-brand-400',
    barClass: 'bg-gradient-to-r from-brand-500 to-brand-400',
    badgeClass: 'bg-brand-500/15 text-brand-400 border-brand-500/25',
  };
  if (score >= 55) return {
    label: 'Moyenne',
    color: 'text-gold-400',
    barClass: 'bg-gradient-to-r from-gold-500 to-gold-400',
    badgeClass: 'bg-gold-500/15 text-gold-400 border-gold-500/25',
  };
  return {
    label: 'Limitée',
    color: 'text-white/35',
    barClass: 'bg-white/15',
    badgeClass: 'bg-white/5 text-white/35 border-white/10',
  };
}

function PronosticCard({ pronostic, featured = false, index = 0 }) {
  const { fixture: fix, analysis, confidence, pick } = pronostic;
  const home = fix.teams?.home;
  const away = fix.teams?.away;
  const league = fix.league;
  const matchTime = formatTime(fix.fixture?.date);
  const probs = analysis?.consensusProbs || analysis?.predictions?.probabilities || analysis?.odds?.matchWinner?.fairProbs;
  const homeProb = probs?.home || 0;
  const drawProb = probs?.draw || 0;
  const awayProb = probs?.away || 0;
  const conf = getConfidenceConfig(confidence);
  const fixtureId = fix.fixture?.id;
  const { toggle, isFavorite } = useFavoritesStore();
  const isFav = isFavorite(fixtureId);
  const { initialBankroll, kellyFraction: kFrac } = useBankrollStore();
  const suggestedStake = pick?.isValue && pick?.odd && pick?.probability
    ? kellyStake(pick.probability, pick.odd, initialBankroll, kFrac)
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.2), duration: 0.28, ease: 'easeOut' }}
      className={clsx(
        'football-card card-accent flex flex-col gap-4 cursor-pointer',
        featured ? 'p-5 border-brand-500/20' : 'p-4',
      )}
    >
      {/* Featured badge */}
      {featured && (
        <div className="absolute top-0 right-0">
          <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-display tracking-widest text-dark-900 rounded-bl-xl"
            style={{ background: 'linear-gradient(135deg, #22c55e, #15803d)' }}>
            ★ TOP PRONO
          </div>
        </div>
      )}

      {/* League + time */}
      <div className="flex items-center justify-between pl-3">
        <div className="flex items-center gap-2 min-w-0">
          {league?.logo && <img src={league.logo} alt="" className="w-3.5 h-3.5 object-contain flex-shrink-0 opacity-70" />}
          <span className="text-xs text-white/35 font-heading truncate">{league?.name}</span>
          {league?.round && <span className="text-xs text-white/15 hidden sm:block">· {league.round}</span>}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-xs font-mono text-white/50 bg-dark-700/80 px-2 py-0.5 rounded-lg">
            {matchTime}
          </span>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(fixtureId); }}
            className={clsx('p-1 rounded-lg transition-all', isFav ? 'text-gold-400' : 'text-white/15 hover:text-white/50')}
          >
            <Star className="w-3.5 h-3.5" fill={isFav ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>

      {/* Teams matchup */}
      <div className="flex items-center gap-3 pl-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className={clsx('bg-dark-700/80 rounded-xl flex items-center justify-center p-1.5 flex-shrink-0', featured ? 'w-11 h-11' : 'w-9 h-9')}>
            <img src={home?.logo} alt={home?.name} className="w-full h-full object-contain" onError={(e) => { e.target.style.opacity = '0'; }} />
          </div>
          <span className={clsx('font-heading font-bold text-white truncate', featured ? 'text-base' : 'text-sm')}>{home?.name}</span>
        </div>

        <span className="matchup-vs flex-shrink-0 text-sm">VS</span>

        <div className="flex items-center gap-2 flex-1 min-w-0 flex-row-reverse">
          <div className={clsx('bg-dark-700/80 rounded-xl flex items-center justify-center p-1.5 flex-shrink-0', featured ? 'w-11 h-11' : 'w-9 h-9')}>
            <img src={away?.logo} alt={away?.name} className="w-full h-full object-contain" onError={(e) => { e.target.style.opacity = '0'; }} />
          </div>
          <span className={clsx('font-heading font-bold text-white truncate text-right', featured ? 'text-base' : 'text-sm')}>{away?.name}</span>
        </div>
      </div>

      {/* Probability bar */}
      {(homeProb > 0 || drawProb > 0 || awayProb > 0) && (
        <div className="pl-3">
          <div className="flex justify-between text-xs text-white/20 mb-1.5 font-mono">
            <span>{homeProb.toFixed(0)}%</span>
            <span className="text-white/15">Nul {drawProb.toFixed(0)}%</span>
            <span>{awayProb.toFixed(0)}%</span>
          </div>
          <div className="flex h-1 rounded-full overflow-hidden gap-px">
            <motion.div
              className="rounded-l-full"
              style={{ background: 'linear-gradient(90deg, #22c55e, #4ade80)', width: `${homeProb}%` }}
              initial={{ width: 0 }}
              animate={{ width: `${homeProb}%` }}
              transition={{ delay: Math.min(index * 0.04 + 0.15, 0.35), duration: 0.6, ease: 'easeOut' }}
            />
            <motion.div
              className="bg-gold-500/60"
              style={{ width: `${drawProb}%` }}
              initial={{ width: 0 }}
              animate={{ width: `${drawProb}%` }}
              transition={{ delay: Math.min(index * 0.04 + 0.2, 0.4), duration: 0.6, ease: 'easeOut' }}
            />
            <div className="rounded-r-full flex-1 bg-info/40" />
          </div>
        </div>
      )}

      {/* Pick */}
      {pick && (
        <div className={clsx(
          'flex items-center gap-3 p-3 rounded-xl border pl-3',
          pick.isValue ? 'bg-gold-500/[0.06] border-gold-500/20' : 'bg-dark-700/40 border-white/[0.05]'
        )}>
          <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', pick.isValue ? 'bg-gold-500/15' : 'bg-brand-500/15')}>
            {pick.isValue ? <TrendingUp className="w-4 h-4 text-gold-400" /> : <Target className="w-4 h-4 text-brand-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs text-white/25 font-heading">{pick.market}</span>
              {pick.isValue && pick.edge && (
                <span className="text-xs font-display tracking-wider text-gold-400 bg-gold-400/10 px-1.5 py-0.5 rounded leading-none">
                  VALUE +{pick.edge.toFixed(1)}%
                </span>
              )}
            </div>
            <p className="text-sm font-heading font-bold text-white truncate">{pick.selectionLabel}</p>
          </div>
          <div className="text-right flex-shrink-0">
            {pick.odd != null && (
              <p className={clsx('text-lg font-display leading-none tracking-wider', pick.isValue ? 'text-gold-400' : 'text-brand-400')}>
                @{pick.odd.toFixed(2)}
              </p>
            )}
            {pick.probability != null && (
              <p className="text-xs text-white/25 font-mono mt-0.5">{pick.probability.toFixed(0)}%</p>
            )}
          </div>
        </div>
      )}

      {/* Kelly stake suggestion (only on value bets) */}
      {suggestedStake > 0 && (
        <div className="flex items-center justify-between gap-2 pl-3 pr-1 -mt-2">
          <span className="text-[11px] text-white/30 font-heading">
            Mise suggérée · ¼ Kelly
          </span>
          <span className="text-xs font-display tracking-wider text-gold-400/90">
            {suggestedStake.toFixed(0)} €
          </span>
        </div>
      )}

      {/* Confidence */}
      <div className="space-y-1.5 pl-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/25 flex items-center gap-1.5 font-heading">
            <Shield className="w-3 h-3" /> Confiance
          </span>
          <span className={clsx('text-xs font-display tracking-wider px-2 py-0.5 rounded-full border', conf.badgeClass)}>
            {confidence}/100 · {conf.label}
          </span>
        </div>
        <div className="h-1 bg-dark-700 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${confidence}%` }}
            transition={{ duration: 0.7, ease: 'easeOut', delay: Math.min(index * 0.04 + 0.2, 0.4) }}
            className={clsx('h-full rounded-full', conf.barClass)}
          />
        </div>
      </div>

      {/* CTA */}
      <Link
        to={`/match/${fixtureId}`}
        className="flex items-center justify-center gap-1 text-xs text-white/25 hover:text-brand-400 transition-colors pt-1 border-t border-white/[0.05]"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="font-heading font-semibold tracking-wide">Analyse complète</span>
        <ChevronRight className="w-3 h-3" />
      </Link>
    </motion.div>
  );
}

function Skeleton() {
  return (
    <div className="football-card p-4 space-y-4">
      <div className="flex justify-between pl-3">
        <div className="h-3 w-28 skeleton rounded" />
        <div className="h-3 w-10 skeleton rounded" />
      </div>
      <div className="flex items-center gap-3 pl-3">
        <div className="w-9 h-9 rounded-xl skeleton flex-shrink-0" />
        <div className="h-4 flex-1 skeleton rounded" />
        <div className="h-3 w-6 skeleton rounded" />
        <div className="h-4 flex-1 skeleton rounded" />
        <div className="w-9 h-9 rounded-xl skeleton flex-shrink-0" />
      </div>
      <div className="h-1 skeleton rounded-full mx-3" />
      <div className="h-14 skeleton rounded-xl mx-3" />
      <div className="space-y-1.5 mx-3">
        <div className="flex justify-between">
          <div className="h-3 w-20 skeleton rounded" />
          <div className="h-3 w-24 skeleton rounded" />
        </div>
        <div className="h-1 skeleton rounded-full" />
      </div>
    </div>
  );
}

export default function Home() {
  const [pronostics, setPronostics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [valueOnly, setValueOnly] = useState(false);
  const { getStats, savePronostics } = useHistoryStore();
  const histStats = getStats();

  const load = async ({ force = false } = {}) => {
    setLoading(true);
    setError(null);
    try {
      const res = await pronosticsApi.getBestToday({ force });
      const data = res?.data || [];
      setPronostics(data);
      if (data.length > 0) savePronostics(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const highConf = pronostics.filter((p) => p.confidence >= 70).length;
  const valueBets = pronostics.filter((p) => p.pick?.isValue).length;
  const avgConf = pronostics.length > 0
    ? Math.round(pronostics.reduce((s, p) => s + p.confidence, 0) / pronostics.length)
    : 0;
  const isLowConfidenceFallback = pronostics.length > 0 && pronostics.every((p) => p.confidence < 45);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl text-white tracking-wide leading-none mb-1">
            Meilleur <span className="text-gradient-neon">Prono du Jour</span>
          </h1>
          <p className="text-sm text-white/35 font-heading font-medium">
            {format(new Date(), "EEEE d MMMM yyyy", { locale: fr })} · Analyse IA + données en direct
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {histStats.settled > 0 && (
            <Link
              to="/history"
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/[0.08] bg-dark-800/80 hover:border-brand-500/30 transition-all group"
            >
              <BookOpen className="w-3.5 h-3.5 text-white/25 group-hover:text-brand-400 transition-colors" />
              <div className="text-right">
                <p className={clsx('font-display text-lg leading-none tracking-wider', histStats.rate >= 55 ? 'text-brand-400' : 'text-gold-400')}>
                  {histStats.rate}%
                </p>
                <p className="text-[10px] text-white/20 font-mono">{histStats.settled} pronos</p>
              </div>
            </Link>
          )}
          <button
            onClick={() => load({ force: true })}
            disabled={loading}
            className="btn-ghost !px-2.5 !py-2 flex items-center gap-2"
          >
            <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} />
            <span className="text-xs hidden sm:block font-heading font-semibold tracking-wide">Actualiser</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      {!loading && pronostics.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-2.5"
        >
          {[
            { label: 'Pronostics', value: pronostics.length, color: 'text-white', icon: Target },
            { label: 'Haute conf.', value: highConf, color: 'text-brand-400', icon: Shield },
            { label: 'Value bets', value: valueBets, color: 'text-gold-400', icon: TrendingUp },
            { label: 'Conf. moy.', value: avgConf, color: 'text-info', icon: Trophy },
          ].map(({ label, value, color, icon: Icon }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.05 + i * 0.04 }}
              className="glass-card px-3.5 py-3 flex items-center gap-3"
            >
              <Icon className={clsx('w-4 h-4 flex-shrink-0', color)} />
              <div className="min-w-0">
                <p className={clsx('stat-number text-xl leading-none', color)}>{value}</p>
                <p className="text-[11px] text-white/25 font-heading font-medium mt-0.5">{label}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Loading */}
      {loading && <Skeleton />}

      {/* Error */}
      {!loading && error && (
        <div className="glass-card p-10 text-center space-y-3">
          <div className="text-5xl font-display text-danger/60">ERR</div>
          <p className="text-white/50 font-heading font-semibold text-lg">{error}</p>
          <button onClick={load} className="btn-primary mt-2">Réessayer</button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && pronostics.length === 0 && (
        <div className="glass-card p-12 text-center space-y-4">
          <div className="text-6xl font-display text-white/10 tracking-widest">0 PRONOSTICS</div>
          <p className="text-white/40 font-heading font-semibold">Aucun match disponible pour aujourd'hui</p>
          <Link to="/matchs" className="inline-flex items-center gap-2 btn-ghost mt-2">
            Voir les matchs <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* Pronostics */}
      {!loading && !error && pronostics.length > 0 && (
        <>
          {isLowConfidenceFallback ? (
            <div className="px-3.5 py-2.5 rounded-xl bg-gold-500/[0.06] border border-gold-500/20">
              <p className="text-xs text-gold-400/70 font-heading leading-relaxed">
                <span className="text-gold-400 font-semibold">Données limitées aujourd'hui —</span>{' '}
                Aucun pronostic à haute confiance disponible. Voici les meilleures opportunités du jour à titre indicatif.
              </p>
            </div>
          ) : (
            <div className="px-3.5 py-2.5 rounded-xl bg-dark-800/60 border border-white/[0.04]">
              <p className="text-xs text-white/20 font-heading leading-relaxed">
                <span className="text-white/40 font-semibold">Méthode :</span>{' '}
                Indice calculé sur 6 critères — probabilité dominante, écart entre outcomes, accord modèle Poisson vs bookmakers, qualité overround, forme récente, historique H2H.
              </p>
            </div>
          )}

          <PronosticCard pronostic={pronostics[0]} featured index={0} />

          {pronostics.length > 1 && (
            <>
              <div className="flex items-center justify-between gap-3 pt-2">
                <h2 className="text-sm font-heading font-bold text-white/60 tracking-wide">Autres pronostics du jour</h2>
                <div className="flex gap-1 p-0.5 bg-dark-800 rounded-lg border border-white/5">
                  <button
                    onClick={() => setValueOnly(false)}
                    className={clsx(
                      'flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-heading font-semibold transition-all',
                      !valueOnly ? 'bg-dark-700 text-white' : 'text-white/30 hover:text-white/60'
                    )}
                  >
                    Tous
                  </button>
                  <button
                    onClick={() => setValueOnly(true)}
                    className={clsx(
                      'flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-heading font-semibold transition-all',
                      valueOnly ? 'bg-gold-500/20 text-gold-400' : 'text-white/30 hover:text-white/60'
                    )}
                  >
                    <Flame className="w-3 h-3" /> Value bets
                  </button>
                </div>
              </div>

              {(() => {
                const others = pronostics.slice(1);
                const filtered = valueOnly ? others.filter((p) => p.pick?.isValue) : others;
                if (filtered.length === 0) {
                  return (
                    <div className="text-center text-xs text-white/30 py-4 font-heading">
                      Aucun value bet supplémentaire détecté aujourd'hui
                    </div>
                  );
                }
                return (
                  <div className="space-y-3">
                    {filtered.map((p, i) => (
                      <Link key={p.fixture?.fixture?.id || i} to={`/match/${p.fixture?.fixture?.id}`} className="block">
                        <PronosticCard pronostic={p} index={i + 1} />
                      </Link>
                    ))}
                  </div>
                );
              })()}
            </>
          )}
        </>
      )}
    </div>
  );
}
