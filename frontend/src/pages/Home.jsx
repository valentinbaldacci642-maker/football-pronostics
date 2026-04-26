import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Target, TrendingUp, Zap, RefreshCw, Shield, Trophy, ChevronRight,
} from 'lucide-react';
import { pronosticsApi } from '../services/api';
import { formatTime } from '../utils/format';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import clsx from 'clsx';

function getConfidenceConfig(score) {
  if (score >= 70) return {
    label: 'Haute confiance',
    color: 'text-green-400',
    barClass: 'bg-gradient-to-r from-green-500 to-emerald-400',
    badgeClass: 'bg-green-500/15 text-green-400 border-green-500/25',
  };
  if (score >= 55) return {
    label: 'Confiance moyenne',
    color: 'text-amber-400',
    barClass: 'bg-gradient-to-r from-amber-500 to-yellow-400',
    badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  };
  return {
    label: 'Confiance limitée',
    color: 'text-white/40',
    barClass: 'bg-white/20',
    badgeClass: 'bg-white/5 text-white/40 border-white/10',
  };
}

function PronosticCard({ pronostic, featured = false, index = 0 }) {
  const { fixture: fix, analysis, confidence, pick } = pronostic;
  const home = fix.teams?.home;
  const away = fix.teams?.away;
  const league = fix.league;
  const matchTime = formatTime(fix.fixture?.date);

  // Use consensusProbs (odds + model average) when available, fall back to model only
  const probs = analysis?.consensusProbs || analysis?.predictions?.probabilities;
  const homeProb = probs?.home || 0;
  const drawProb = probs?.draw || 0;
  const awayProb = probs?.away || 0;

  const conf = getConfidenceConfig(confidence);
  const fixtureId = fix.fixture?.id;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.35 }}
      className={clsx(
        'glass-card flex flex-col gap-4 relative overflow-hidden',
        featured
          ? 'p-5 border border-brand-500/25 shadow-[0_0_40px_-8px_rgba(99,102,241,0.15)]'
          : 'p-4',
      )}
    >
      {/* Featured badge */}
      {featured && (
        <div className="absolute top-0 right-0">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500 text-white text-xs font-black rounded-bl-xl">
            <Zap className="w-3 h-3" />
            TOP PRONOSTIC
          </div>
        </div>
      )}

      {/* League + time */}
      <div className="flex items-center justify-between pr-24">
        <div className="flex items-center gap-2 min-w-0">
          {league?.logo && (
            <img src={league.logo} alt="" className="w-4 h-4 object-contain flex-shrink-0" />
          )}
          <span className="text-xs text-white/40 truncate">{league?.name}</span>
          {league?.round && (
            <span className="text-xs text-white/20 hidden sm:block truncate">· {league.round}</span>
          )}
        </div>
        <span className="text-xs font-mono text-white/60 bg-dark-700 px-2 py-0.5 rounded flex-shrink-0">
          {matchTime}
        </span>
      </div>

      {/* Teams */}
      <div className="flex items-center gap-3">
        {/* Home */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className={clsx(
            'bg-dark-700 rounded-xl flex items-center justify-center p-1.5 flex-shrink-0',
            featured ? 'w-11 h-11' : 'w-9 h-9'
          )}>
            <img
              src={home?.logo}
              alt={home?.name}
              className="w-full h-full object-contain"
              onError={(e) => { e.target.style.opacity = '0'; }}
            />
          </div>
          <span className={clsx('font-bold text-white truncate', featured ? 'text-base' : 'text-sm')}>
            {home?.name}
          </span>
        </div>

        <span className="text-xs text-white/20 font-bold flex-shrink-0">VS</span>

        {/* Away */}
        <div className="flex items-center gap-2 flex-1 min-w-0 flex-row-reverse">
          <div className={clsx(
            'bg-dark-700 rounded-xl flex items-center justify-center p-1.5 flex-shrink-0',
            featured ? 'w-11 h-11' : 'w-9 h-9'
          )}>
            <img
              src={away?.logo}
              alt={away?.name}
              className="w-full h-full object-contain"
              onError={(e) => { e.target.style.opacity = '0'; }}
            />
          </div>
          <span className={clsx('font-bold text-white truncate text-right', featured ? 'text-base' : 'text-sm')}>
            {away?.name}
          </span>
        </div>
      </div>

      {/* Probability tri-bar */}
      {(homeProb > 0 || drawProb > 0 || awayProb > 0) && (
        <div>
          <div className="flex justify-between text-xs text-white/25 mb-1.5">
            <span className="font-mono">{homeProb.toFixed(0)}%</span>
            <span className="text-white/20">Nul {drawProb.toFixed(0)}%</span>
            <span className="font-mono">{awayProb.toFixed(0)}%</span>
          </div>
          <div className="flex h-1.5 rounded-full overflow-hidden gap-0.5">
            <div
              className="bg-brand-500/70 rounded-full transition-all"
              style={{ width: `${homeProb}%` }}
            />
            <div
              className="bg-amber-500/50 rounded-full transition-all"
              style={{ width: `${drawProb}%` }}
            />
            <div className="bg-blue-500/70 rounded-full flex-1" />
          </div>
        </div>
      )}

      {/* Pick recommendation */}
      {pick && (
        <div className={clsx(
          'flex items-center gap-3 p-3 rounded-xl border',
          pick.isValue
            ? 'bg-[#f59e0b08] border-[#f59e0b30]'
            : 'bg-dark-700/60 border-white/5'
        )}>
          <div className={clsx(
            'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
            pick.isValue ? 'bg-amber-500/15' : 'bg-brand-500/15'
          )}>
            {pick.isValue
              ? <TrendingUp className="w-4 h-4 text-amber-400" />
              : <Target className="w-4 h-4 text-brand-400" />
            }
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs text-white/30">{pick.market}</span>
              {pick.isValue && pick.edge && (
                <span className="text-xs font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded-full leading-none">
                  VALUE +{pick.edge.toFixed(1)}%
                </span>
              )}
            </div>
            <p className="text-sm font-bold text-white truncate">{pick.selectionLabel}</p>
          </div>
          <div className="text-right flex-shrink-0">
            {pick.odd != null && (
              <p className={clsx('text-base font-black leading-none', pick.isValue ? 'text-amber-400' : 'text-brand-400')}>
                @{pick.odd.toFixed(2)}
              </p>
            )}
            {pick.probability != null && (
              <p className="text-xs text-white/30 mt-0.5">{pick.probability.toFixed(0)}%</p>
            )}
          </div>
        </div>
      )}

      {/* Confidence index */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/30 flex items-center gap-1.5">
            <Shield className="w-3 h-3" />
            Indice de confiance
          </span>
          <span className={clsx(
            'text-xs font-bold px-2 py-0.5 rounded-full border',
            conf.badgeClass
          )}>
            {confidence}/100 · {conf.label}
          </span>
        </div>
        <div className="h-1.5 bg-dark-600 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${confidence}%` }}
            transition={{ duration: 0.9, ease: 'easeOut', delay: index * 0.07 + 0.25 }}
            className={clsx('h-full rounded-full', conf.barClass)}
          />
        </div>
      </div>

      {/* CTA */}
      <Link
        to={`/match/${fixtureId}`}
        className="flex items-center justify-center gap-1 text-xs text-white/30 hover:text-brand-400 transition-colors pt-1 border-t border-white/5 -mb-1"
      >
        Voir l'analyse complète
        <ChevronRight className="w-3 h-3" />
      </Link>
    </motion.div>
  );
}

function PronosticSkeleton({ wide = false }) {
  return (
    <div className={clsx('glass-card p-4 space-y-4 animate-pulse', wide && 'md:col-span-2')}>
      <div className="flex justify-between">
        <div className="h-3 w-28 bg-white/5 rounded" />
        <div className="h-3 w-10 bg-white/5 rounded" />
      </div>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-white/5 flex-shrink-0" />
        <div className="h-4 flex-1 bg-white/5 rounded" />
        <div className="h-3 w-5 bg-white/5 rounded" />
        <div className="h-4 flex-1 bg-white/5 rounded" />
        <div className="w-9 h-9 rounded-xl bg-white/5 flex-shrink-0" />
      </div>
      <div className="h-1.5 bg-white/5 rounded-full" />
      <div className="h-[52px] bg-white/5 rounded-xl" />
      <div className="space-y-1.5">
        <div className="flex justify-between">
          <div className="h-3 w-24 bg-white/5 rounded" />
          <div className="h-3 w-28 bg-white/5 rounded" />
        </div>
        <div className="h-1.5 bg-white/5 rounded-full" />
      </div>
    </div>
  );
}

export default function Home() {
  const [pronostics, setPronostics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await pronosticsApi.getBestToday();
      setPronostics(res?.data || []);
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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 max-w-4xl mx-auto"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-brand-gradient flex items-center justify-center shadow-glow flex-shrink-0">
              <Zap className="w-4.5 h-4.5 w-[18px] h-[18px] text-white" />
            </div>
            <h1 className="text-2xl font-black text-white">Meilleurs Pronostics</h1>
          </div>
          <p className="text-sm text-white/40 ml-12">
            {format(new Date(), "EEEE d MMMM yyyy", { locale: fr })} · Indice de confiance réel
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="btn-ghost !px-2.5 !py-2 flex items-center gap-2"
        >
          <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} />
          <span className="text-xs hidden sm:block">Actualiser</span>
        </button>
      </div>

      {/* Stats row */}
      {!loading && pronostics.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-3"
        >
          {[
            { label: 'Pronostics', value: pronostics.length, color: 'text-white', icon: Target },
            { label: 'Haute confiance', value: highConf, color: 'text-green-400', icon: Shield },
            { label: 'Value bets', value: valueBets, color: 'text-amber-400', icon: TrendingUp },
            { label: 'Conf. moyenne', value: `${avgConf}/100`, color: 'text-brand-400', icon: Trophy },
          ].map(({ label, value, color, icon: Icon }) => (
            <div key={label} className="glass-card px-3 py-3 flex items-center gap-3">
              <Icon className={clsx('w-4 h-4 flex-shrink-0', color)} />
              <div className="min-w-0">
                <p className={clsx('text-lg font-black tabular-nums leading-none', color)}>{value}</p>
                <p className="text-xs text-white/30 mt-0.5 truncate">{label}</p>
              </div>
            </div>
          ))}
        </motion.div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PronosticSkeleton wide />
          <PronosticSkeleton wide />
          <PronosticSkeleton />
          <PronosticSkeleton />
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="glass-card p-8 text-center space-y-3">
          <p className="text-4xl">⚠️</p>
          <p className="text-white/60 font-semibold">Erreur de chargement</p>
          <p className="text-white/30 text-sm">{error}</p>
          <button
            onClick={load}
            className="mt-4 px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Réessayer
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && pronostics.length === 0 && (
        <div className="glass-card p-10 text-center space-y-4">
          <p className="text-5xl">🔮</p>
          <p className="text-white/60 font-bold text-lg">Aucun pronostic disponible</p>
          <p className="text-white/30 text-sm max-w-sm mx-auto">
            Aucun match à venir dans les ligues prioritaires, ou quota API épuisé pour aujourd'hui.
          </p>
          <Link
            to="/matchs"
            className="inline-flex items-center gap-2 px-5 py-2 bg-dark-700 hover:bg-dark-600 text-white/70 hover:text-white text-sm font-medium rounded-xl border border-white/10 transition-all mt-2"
          >
            Voir tous les matchs du jour
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* Pronostics list */}
      {!loading && !error && pronostics.length > 0 && (
        <>
          {/* Methodology note */}
          <div className="px-4 py-2.5 rounded-xl bg-dark-700/50 border border-white/5">
            <p className="text-xs text-white/25">
              <span className="text-white/45 font-medium">Méthode :</span>{' '}
              Indice calculé sur 6 critères — probabilité dominante, écart entre outcomes, accord modèle Poisson vs bookmakers, qualité du marché (overround), forme récente de l'équipe favorite, historique face-à-face.
            </p>
          </div>

          {/* Featured card — full width */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <PronosticCard pronostic={pronostics[0]} featured index={0} />
            </div>

            {/* Remaining cards — 2-col grid */}
            {pronostics.slice(1).map((p, i) => (
              <PronosticCard
                key={p.fixture.fixture.id}
                pronostic={p}
                index={i + 1}
              />
            ))}
          </div>

          {/* Footer link */}
          <div className="text-center pt-2">
            <Link
              to="/matchs"
              className="inline-flex items-center gap-2 text-sm text-white/30 hover:text-white/60 transition-colors"
            >
              Voir tous les matchs du jour
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </>
      )}
    </motion.div>
  );
}
