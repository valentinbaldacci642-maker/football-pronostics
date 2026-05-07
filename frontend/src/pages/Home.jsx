import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Target, TrendingUp, RefreshCw, Shield, Trophy, ChevronRight, BookOpen, Star, Save, Flame } from 'lucide-react';
import { pronosticsApi, getRateLimitedUntil } from '../services/api';
import { formatTime } from '../utils/format';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import clsx from 'clsx';
import { useHistoryStore, useFavoritesStore, useBankrollStore, EDGE_MODE_THRESHOLD } from '../store';
import { kellyStake } from '../utils/kelly';
import { formatStake } from '../utils/formatStake';
import { detectStreaksForFixture } from '../utils/streak';

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
  const { setMise, setActualOdd, entries, getBankrollStats } = useHistoryStore();
  // Kelly resizes itself against the LIVE bankroll = the cash you actually have.
  // Live = initial + settled P&L − pending stakes (cash currently with bookie).
  const _bk = getBankrollStats();
  const liveBankroll = initialBankroll + (_bk.pnl || 0) - (_bk.pendingCommitted || 0);

  const streaks = detectStreaksForFixture(analysis?.predictions);
  const allValueBets = analysis?.odds?.valueBets || [];
  const otherValueBets = allValueBets.filter(
    (v) => !(v.market === pick?.market && v.selection === pick?.selection)
  );

  // The "best bet to actually play" — highest-edge value bet across main pick
  // and secondary markets. Used to show the Kelly stake suggestion near the
  // mise input regardless of whether the main pick has edge or not.
  const bestPlayableBet = (() => {
    const candidates = [];
    if (pick?.isValue && pick?.odd && pick?.probability) {
      candidates.push({
        market: pick.market,
        selection: pick.selectionLabel || pick.selection,
        edge: pick.edge,
        odd: pick.odd,
        prob: pick.probability,
        isMainPick: true,
      });
    }
    otherValueBets.forEach((vb) => {
      candidates.push({
        market: vb.market,
        selection: vb.selection,
        edge: vb.edge,
        odd: vb.odd,
        prob: vb.trueProb ?? vb.prob,
        isMainPick: false,
      });
    });
    return candidates.sort((a, b) => (b.edge || 0) - (a.edge || 0))[0] || null;
  })();
  const suggestedStake = bestPlayableBet
    ? kellyStake(bestPlayableBet.prob, bestPlayableBet.odd, liveBankroll, kFrac)
    : 0;
  const existingEntry = entries.find((e) => e.fixtureId === fixtureId);
  const savedMise = existingEntry?.mise != null ? String(existingEntry.mise) : '';
  const savedOdd = existingEntry?.actualOdd != null ? String(existingEntry.actualOdd) : '';
  const [miseInput, setMiseInput] = useState(savedMise);
  const [oddInput, setOddInput] = useState(savedOdd);
  // Show the bookmaker odd input as soon as the user types a positive mise
  // (saved or just typed) — don't gate it behind clicking Save first
  const hasMise = parseFloat(miseInput) > 0 || parseFloat(savedMise) > 0;
  const miseDirty = miseInput !== savedMise;
  const oddDirty = oddInput !== savedOdd;

  const saveMise = () => {
    if (!miseDirty) return;
    setMise(fixtureId, miseInput);
  };
  const saveOdd = () => {
    if (!oddDirty) return;
    setActualOdd(fixtureId, oddInput);
  };

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
      {/* Featured badge — its own line above league/time so it doesn't
          collide with the kick-off time + favourite star on the right */}
      {featured && (
        <div className="flex justify-end -mt-1 -mr-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-display tracking-widest text-dark-900 rounded-lg"
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
          <div className="min-w-0">
            <span className={clsx('block font-heading font-bold text-white truncate', featured ? 'text-base' : 'text-sm')}>{home?.name}</span>
            {streaks.home && (
              <span className={clsx(
                'block text-[10px] font-mono leading-none mt-0.5 truncate',
                streaks.home.intensity === 'hot' ? 'text-orange-400' :
                streaks.home.intensity === 'cold' ? 'text-blue-400' :
                'text-white/40'
              )}>{streaks.home.label}</span>
            )}
          </div>
        </div>

        <span className="matchup-vs flex-shrink-0 text-sm">VS</span>

        <div className="flex items-center gap-2 flex-1 min-w-0 flex-row-reverse">
          <div className={clsx('bg-dark-700/80 rounded-xl flex items-center justify-center p-1.5 flex-shrink-0', featured ? 'w-11 h-11' : 'w-9 h-9')}>
            <img src={away?.logo} alt={away?.name} className="w-full h-full object-contain" onError={(e) => { e.target.style.opacity = '0'; }} />
          </div>
          <div className="min-w-0 text-right">
            <span className={clsx('block font-heading font-bold text-white truncate', featured ? 'text-base' : 'text-sm')}>{away?.name}</span>
            {streaks.away && (
              <span className={clsx(
                'block text-[10px] font-mono leading-none mt-0.5 truncate',
                streaks.away.intensity === 'hot' ? 'text-orange-400' :
                streaks.away.intensity === 'cold' ? 'text-blue-400' :
                'text-white/40'
              )}>{streaks.away.label}</span>
            )}
          </div>
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

      {/* Value bets indicator — shown when this match has at least one
          detected value bet. Clickable shortcut to the dedicated /value-bets
          page where users can see the full list with Kelly stakes. */}
      {allValueBets.length > 0 && (
        <Link
          to="/value-bets"
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gold-500/[0.08] border border-gold-500/25 hover:border-gold-500/50 hover:bg-gold-500/[0.12] transition-all"
        >
          <Flame className="w-4 h-4 text-gold-400 flex-shrink-0" />
          <span className="text-xs font-heading font-semibold text-gold-300 flex-1">
            {allValueBets.length === 1
              ? '1 value bet détecté'
              : `${allValueBets.length} value bets détectés`}
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-gold-400/70" />
        </Link>
      )}

      {/* Kelly stake suggestion + actual stake/odd input (when there's a pick with odds) */}
      {pick?.odd && (
        <div className="flex flex-col gap-1.5 pl-3 pr-1 -mt-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              {suggestedStake > 0 ? (
                <span className="text-[11px] text-gold-400/70 font-heading">
                  <span className="font-display tracking-wider text-gold-400">
                    Mise: {formatStake(suggestedStake)}
                  </span>
                  <span className="text-white/40 ml-1.5">
                    sur {bestPlayableBet?.isMainPick
                      ? 'le pari principal'
                      : `${bestPlayableBet?.market} · ${bestPlayableBet?.selection}`} (+{bestPlayableBet?.edge?.toFixed(1)}%)
                  </span>
                </span>
              ) : (
                <span className="text-[11px] text-white/25 font-heading whitespace-nowrap">
                  Kelly inactif <span className="text-white/15">· aucun value bet</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-white/30 font-heading">Ma mise:</span>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="—"
                value={miseInput}
                onChange={(e) => { e.stopPropagation(); setMiseInput(e.target.value); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveMise(); } }}
                onClick={(e) => e.stopPropagation()}
                className="w-16 bg-dark-800 border border-white/10 rounded-md px-2 py-0.5 text-xs text-white font-mono text-right focus:outline-none focus:border-brand-500/50"
              />
              <span className="text-[11px] text-white/30">€</span>
              <button
                onClick={(e) => { e.stopPropagation(); saveMise(); }}
                disabled={!miseDirty}
                className={clsx(
                  'flex items-center justify-center w-6 h-6 rounded-md border transition-all',
                  miseDirty
                    ? 'bg-brand-500/15 border-brand-500/40 text-brand-400 hover:bg-brand-500/25'
                    : 'border-white/[0.05] text-white/15 cursor-not-allowed'
                )}
                title="Enregistrer la mise"
              >
                <Save className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Real bookmaker odd — only relevant when user has placed a stake */}
          {hasMise && (
            <div className="flex items-center justify-between gap-1.5">
              <span className="flex items-center gap-1 text-[11px] font-heading text-brand-400/80">
                <Target className="w-3 h-3" />
                Pari enregistré dans Historique pronos
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-white/30 font-heading">Ma cote:</span>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  placeholder={pick.odd.toFixed(2)}
                  value={oddInput}
                  onChange={(e) => { e.stopPropagation(); setOddInput(e.target.value); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveOdd(); } }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-16 bg-dark-800 border border-white/10 rounded-md px-2 py-0.5 text-xs text-white font-mono text-right focus:outline-none focus:border-brand-500/50"
                />
                <button
                  onClick={(e) => { e.stopPropagation(); saveOdd(); }}
                  disabled={!oddDirty}
                  className={clsx(
                    'flex items-center justify-center w-6 h-6 rounded-md border transition-all',
                    oddDirty
                      ? 'bg-brand-500/15 border-brand-500/40 text-brand-400 hover:bg-brand-500/25'
                      : 'border-white/[0.05] text-white/15 cursor-not-allowed'
                  )}
                  title="Enregistrer la cote"
                >
                  <Save className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confidence — calculated on the 1X2 market only, doesn't reflect
          BTTS / O-U / other markets. Adds a hint when the 1X2 has no edge
          (but secondary value bets do) so the user understands why a high
          confidence is shown but the recommendation says 'don't bet 1X2'. */}
      <div className="space-y-1.5 pl-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/25 flex items-center gap-1.5 font-heading">
            <Shield className="w-3 h-3" /> Confiance <span className="text-white/15">(1X2)</span>
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
        {!pick?.isValue && (
          <p className="text-[10px] text-white/30 font-heading leading-snug">
            ℹ️ La confiance porte sur le 1X2 uniquement.
            {otherValueBets.length > 0
              ? ' Le 1X2 n\'a pas d\'edge (cote bookie alignée) → ne pas parier dessus, mise sur les value bets ci-dessus.'
              : ' Le 1X2 n\'a pas d\'edge — pas de pari conseillé sur ce match.'}
          </p>
        )}
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

// Build a list of date offsets [0, 1, 2, 3] starting today
function buildDayOptions() {
  return [0, 1, 2, 3].map((offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const iso = d.toISOString().split('T')[0];
    let label;
    if (offset === 0) label = "Aujourd'hui";
    else if (offset === 1) label = 'Demain';
    else label = format(d, 'EEEE d', { locale: fr });
    return { offset, iso, label };
  });
}

export default function Home() {
  const [pronostics, setPronostics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const dayOptions = buildDayOptions();
  const [selectedDay, setSelectedDay] = useState(dayOptions[0].iso);
  const { edgeMode } = useBankrollStore();
  const { getStats, savePronostics } = useHistoryStore();
  const histStats = getStats();
  const isToday = selectedDay === dayOptions[0].iso;

  const load = async ({ force = false, date = selectedDay } = {}) => {
    setLoading(true);
    setError(null);
    try {
      // For today we omit the param to keep current cache key, otherwise pass explicit date
      const res = await pronosticsApi.getBestToday({
        force,
        date: date && date !== dayOptions[0].iso ? date : null,
      });
      const data = res?.data || [];
      setPronostics(data);
      // Persist pronostics in history regardless of day so the user can record
      // a stake (mise) and bookmaker odd on future-day picks. setMise/setActualOdd
      // need an existing entry with the matching fixtureId to update.
      if (data.length > 0) savePronostics(data);
    } catch (err) {
      setError({ message: err.message, code: err.code });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load({ date: selectedDay }); }, [selectedDay]);

  // Auto-retry once the rate-limit lockout expires. Capped at 3 attempts
  // total — beyond that the API is presumably saturated for real (daily
  // quota, upstream outage, etc.) and looping every 30s helps no one.
  const [rateLimitRetries, setRateLimitRetries] = useState(0);
  useEffect(() => {
    if (error?.code !== 'RATE_LIMITED') return;
    if (rateLimitRetries >= 3) return;
    const id = setInterval(() => {
      if (Date.now() >= getRateLimitedUntil()) {
        clearInterval(id);
        setRateLimitRetries((n) => n + 1);
        load({ date: selectedDay });
      }
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error?.code, rateLimitRetries]);
  // Reset retry counter on success (when error clears)
  useEffect(() => { if (!error) setRateLimitRetries(0); }, [error]);

  const highConf = pronostics.filter((p) => p.confidence >= 70).length;
  const valueBets = pronostics.filter((p) => p.pick?.isValue).length;
  const avgConf = pronostics.length > 0
    ? Math.round(pronostics.reduce((s, p) => s + p.confidence, 0) / pronostics.length)
    : 0;
  const isLowConfidenceFallback = pronostics.length > 0 && pronostics.every((p) => p.confidence < 45);
  const bankroll = useBankrollStore((s) => s.initialBankroll);
  const showLowBankrollHint = bankroll > 0 && bankroll < 50;
  const bkStats = useHistoryStore((s) => s.getBankrollStats());
  const liveBankroll = bankroll + (bkStats.pnl || 0) - (bkStats.pendingCommitted || 0);

  return (
    <div className="space-y-6 max-w-4xl xl:max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl text-white tracking-wide leading-none mb-1">
            {isToday ? 'Meilleur ' : 'Pronos '}<span className="text-gradient-neon">{isToday ? 'Prono du Jour' : 'À venir'}</span>
          </h1>
          <p className="text-sm text-white/35 font-heading font-medium capitalize">
            {format(new Date(selectedDay + 'T00:00:00'), "EEEE d MMMM yyyy", { locale: fr })}
            {isToday && ' · Analyse IA + données en direct'}
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

      {/* Day selector — today + next 3 days */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {dayOptions.map(({ offset, iso, label }) => (
          <button
            key={iso}
            onClick={() => setSelectedDay(iso)}
            className={clsx(
              'px-3 py-1.5 rounded-xl text-xs font-heading font-semibold border transition-all whitespace-nowrap capitalize',
              selectedDay === iso
                ? 'bg-brand-500/15 border-brand-500/40 text-brand-300'
                : 'border-white/[0.08] text-white/35 hover:text-white/60'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Stats */}
      {!loading && pronostics.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-3 gap-2.5"
        >
          {[
            { label: 'Pronostics', value: pronostics.length, color: 'text-white', icon: Target },
            { label: 'Haute conf.', value: highConf, color: 'text-brand-400', icon: Shield },
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
      {!loading && error && error.code === 'RATE_LIMITED' && (
        <div className="glass-card p-8 text-center space-y-2 border-orange-500/20 bg-orange-500/[0.03]">
          <p className="text-orange-300/90 font-heading">API surchargée — auto-retry dès que la limite reset</p>
          <p className="text-white/30 text-xs font-heading">Le compte à rebours est en haut de page</p>
        </div>
      )}
      {!loading && error && error.code !== 'RATE_LIMITED' && (
        <div className="glass-card p-10 text-center space-y-3">
          <div className="text-5xl font-display text-danger/60">ERR</div>
          <p className="text-white/50 font-heading font-semibold text-lg">{error.message}</p>
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

      {/* Top 10 pronos — every match (value-bet ones too). Cards with
          detected value bets show a 'X value bets détectés' indicator that
          links to /value-bets for the dedicated Kelly view. */}
      {!loading && !error && pronostics.length > 0 && (
        <>
          {isLowConfidenceFallback && (
            <div className="px-3.5 py-2.5 rounded-xl bg-gold-500/[0.06] border border-gold-500/20">
              <p className="text-xs text-gold-400/70 font-heading leading-relaxed">
                <span className="text-gold-400 font-semibold">Données limitées aujourd'hui —</span>{' '}
                Aucun pronostic à haute confiance disponible. Voici les meilleures opportunités du jour à titre indicatif.
              </p>
            </div>
          )}

          <PronosticCard pronostic={pronostics[0]} featured index={0} />

          {/* Top 10 meilleurs pronos — featured ([0]) + 9 next, by confidence desc */}
          <div className="space-y-3 pt-2">
            <h2 className="text-sm font-heading font-bold text-white/60 tracking-wide">
              Top 10 meilleurs pronos du jour
            </h2>
            {pronostics.slice(1, 10).length === 0 ? (
              <div className="text-center text-xs text-white/30 py-6 font-heading">
                Aucun autre prono pour ce jour. Reviens plus tard ou clique Actualiser.
              </div>
            ) : (
              pronostics.slice(1, 10).map((p, i) => (
                <Link
                  key={p.fixture?.fixture?.id || i}
                  to={`/match/${p.fixture?.fixture?.id}`}
                  className="block"
                >
                  <PronosticCard pronostic={p} index={i + 1} />
                </Link>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
