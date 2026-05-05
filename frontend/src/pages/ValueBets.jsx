import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Flame, RefreshCw, ChevronRight, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import clsx from 'clsx';
import { pronosticsApi } from '../services/api';
import { useBankrollStore, useHistoryStore } from '../store';
import { kellyStake } from '../utils/kelly';
import { formatStake } from '../utils/formatStake';
import { formatTime } from '../utils/format';

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

export default function ValueBets() {
  const [pronostics, setPronostics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const dayOptions = buildDayOptions();
  const [selectedDay, setSelectedDay] = useState(dayOptions[0].iso);
  const isToday = selectedDay === dayOptions[0].iso;

  const { initialBankroll, kellyFraction: kFrac } = useBankrollStore();
  const { getBankrollStats, savePronostics } = useHistoryStore();
  const _bk = getBankrollStats();
  const liveBankroll = initialBankroll + (_bk.pnl || 0) - (_bk.pendingCommitted || 0);

  const load = async ({ force = false, date = selectedDay } = {}) => {
    setLoading(true);
    setError(null);
    try {
      const res = await pronosticsApi.getBestToday({
        force,
        date: date && date !== dayOptions[0].iso ? date : null,
      });
      const data = res?.data || [];
      setPronostics(data);
      if (data.length > 0) savePronostics(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load({ date: selectedDay }); }, [selectedDay]);

  // Group value bets BY MATCH so a single fixture with multiple value bets
  // (e.g. PSG-Bayern with Under 2.5 + BTTS No) shows up as one card containing
  // all its value bets, instead of one row per value bet (which duplicated
  // the team names confusingly).
  const matchesWithValueBets = useMemo(() => {
    const groups = [];
    pronostics.forEach((p) => {
      const all = p.analysis?.odds?.valueBets || [];
      if (!all.length) return;
      const fixture = p.fixture;
      const valueBets = all.map((vb) => {
        const prob = vb.trueProb ?? vb.prob;
        return {
          market: vb.market,
          selection: vb.selection,
          edge: vb.edge,
          odd: vb.odd,
          prob,
          stake: (vb.odd && prob) ? kellyStake(prob, vb.odd, liveBankroll, kFrac) : 0,
        };
      }).sort((a, b) => (b.edge || 0) - (a.edge || 0));

      groups.push({
        fixtureId: fixture?.fixture?.id,
        home: fixture?.teams?.home,
        away: fixture?.teams?.away,
        league: fixture?.league,
        date: fixture?.fixture?.date,
        confidence: p.confidence,
        valueBets,
        bestEdge: valueBets[0]?.edge || 0,
        totalStake: valueBets.reduce((s, vb) => s + (vb.stake || 0), 0),
      });
    });
    return groups.sort((a, b) => b.bestEdge - a.bestEdge);
  }, [pronostics, liveBankroll, kFrac]);

  const totalValueBetsCount = matchesWithValueBets.reduce((s, m) => s + m.valueBets.length, 0);
  const totalSuggestedStake = matchesWithValueBets.reduce((s, m) => s + m.totalStake, 0);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl text-white tracking-wide leading-none mb-1 flex items-center gap-2">
            <Flame className="w-8 h-8 text-gold-400" />
            <span className="text-gold-400">Value bets</span>
          </h1>
          <p className="text-sm text-white/35 font-heading font-medium capitalize">
            {format(new Date(selectedDay + 'T00:00:00'), "EEEE d MMMM yyyy", { locale: fr })}
            {' · '}Tous les paris où Kelly s'active (edge ≥ 5%)
          </p>
        </div>
        <button
          onClick={() => load({ force: true })}
          disabled={loading}
          className="btn-ghost !px-2.5 !py-2 flex items-center gap-2"
        >
          <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} />
          <span className="text-xs hidden sm:block font-heading font-semibold tracking-wide">Actualiser</span>
        </button>
      </div>

      {/* Day selector */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {dayOptions.map(({ iso, label }) => (
          <button
            key={iso}
            onClick={() => setSelectedDay(iso)}
            className={clsx(
              'px-3 py-1.5 rounded-xl text-xs font-heading font-semibold border transition-all whitespace-nowrap capitalize',
              selectedDay === iso
                ? 'bg-gold-500/15 border-gold-500/40 text-gold-300'
                : 'border-white/[0.08] text-white/35 hover:text-white/60'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Summary */}
      {!loading && matchesWithValueBets.length > 0 && (
        <div className="grid grid-cols-3 gap-2.5">
          <div className="glass-card px-3.5 py-3">
            <p className="stat-number text-xl leading-none text-gold-400">{totalValueBetsCount}</p>
            <p className="text-[11px] text-white/25 font-heading font-medium mt-0.5">Value bets · {matchesWithValueBets.length} matchs</p>
          </div>
          <div className="glass-card px-3.5 py-3">
            <p className="stat-number text-xl leading-none text-white">
              {matchesWithValueBets[0]?.bestEdge?.toFixed(1)}%
            </p>
            <p className="text-[11px] text-white/25 font-heading font-medium mt-0.5">Meilleur edge</p>
          </div>
          <div className="glass-card px-3.5 py-3">
            <p className="stat-number text-xl leading-none text-brand-400">
              {formatStake(totalSuggestedStake)}
            </p>
            <p className="text-[11px] text-white/25 font-heading font-medium mt-0.5">Total suggéré</p>
          </div>
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="football-card p-4 h-24 skeleton" />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="glass-card p-10 text-center space-y-3">
          <div className="text-5xl font-display text-danger/60">ERR</div>
          <p className="text-white/50 font-heading font-semibold text-lg">{error}</p>
          <button onClick={() => load()} className="btn-primary mt-2">Réessayer</button>
        </div>
      )}

      {!loading && !error && matchesWithValueBets.length === 0 && (
        <div className="glass-card p-12 text-center space-y-4">
          <Flame className="w-12 h-12 text-white/10 mx-auto" />
          <div>
            <p className="text-white/60 font-heading font-bold">Aucun value bet aujourd'hui</p>
            <p className="text-white/30 text-xs mt-1 font-heading max-w-sm mx-auto">
              Les bookmakers ont bien évalué tous les matchs analysés. Reviens
              demain ou clique Actualiser plus tard, le marché évolue.
            </p>
          </div>
          <Link to="/" className="inline-flex items-center gap-2 btn-ghost mt-2">
            Voir tous les pronos <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* Match cards — one per match, with all its value bets stacked inside */}
      {!loading && !error && matchesWithValueBets.length > 0 && (
        <div className="space-y-3">
          {liveBankroll <= 0 && (
            <div className="px-3.5 py-2.5 rounded-xl bg-brand-500/[0.08] border border-brand-500/25">
              <p className="text-xs text-brand-300 font-heading leading-relaxed flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>
                  <strong>Bankroll non définie.</strong> Va dans Historique → Bankroll
                  pour la régler et voir les mises Kelly suggérées.
                </span>
              </p>
            </div>
          )}

          {matchesWithValueBets.map((m, mi) => (
            <Link
              key={m.fixtureId}
              to={`/match/${m.fixtureId}`}
              className="block"
            >
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(mi * 0.04, 0.3), duration: 0.28 }}
                className="football-card p-4 border-l-4 border-gold-500 cursor-pointer hover:border-gold-400 transition-colors space-y-3"
              >
                {/* League + time header */}
                <div className="flex items-center gap-3">
                  {m.league?.logo && (
                    <img src={m.league.logo} alt="" className="w-4 h-4 object-contain opacity-60 flex-shrink-0" />
                  )}
                  <span className="text-xs text-white/35 font-heading truncate">{m.league?.name}</span>
                  <span className="text-[10px] text-gold-400/80 font-mono ml-auto">
                    {m.valueBets.length} value bet{m.valueBets.length > 1 ? 's' : ''}
                  </span>
                  {m.date && (
                    <span className="text-xs font-mono text-white/30">
                      {formatTime(m.date)}
                    </span>
                  )}
                </div>

                {/* Teams */}
                <div className="flex items-center gap-2">
                  {m.home?.logo && (
                    <img src={m.home.logo} alt={m.home?.name} className="w-5 h-5 object-contain flex-shrink-0" />
                  )}
                  <span className="text-sm font-heading font-bold text-white truncate flex-1">{m.home?.name}</span>
                  <span className="matchup-vs text-xs flex-shrink-0">VS</span>
                  <span className="text-sm font-heading font-bold text-white truncate flex-1 text-right">{m.away?.name}</span>
                  {m.away?.logo && (
                    <img src={m.away.logo} alt={m.away?.name} className="w-5 h-5 object-contain flex-shrink-0" />
                  )}
                </div>

                {/* Stack of value bets on this match */}
                <div className="space-y-2">
                  {m.valueBets.map((vb, i) => (
                    <div
                      key={i}
                      className="px-3 py-2.5 rounded-lg bg-gold-500/[0.08] border border-gold-500/30 space-y-2"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-display tracking-wider text-gold-400 bg-gold-400/10 px-2 py-0.5 rounded leading-none">
                          +{vb.edge?.toFixed(1)}%
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-white/40 font-heading uppercase tracking-wider">{vb.market}</p>
                          <p className="text-sm font-heading font-bold text-white truncate">{vb.selection}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-base font-display tracking-wider text-gold-400">@{vb.odd?.toFixed(2)}</p>
                          {vb.stake > 0 ? (
                            <p className="text-xs text-gold-400/90 font-display tracking-wider mt-0.5">
                              Mise: {formatStake(vb.stake)}
                            </p>
                          ) : (
                            <p className="text-[10px] text-white/30 font-heading mt-0.5">{liveBankroll <= 0 ? 'Définir bankroll' : '—'}</p>
                          )}
                        </div>
                      </div>
                      {/* Edge explanation */}
                      <p className="text-[10px] text-white/40 font-heading leading-snug pt-1.5 border-t border-gold-500/15">
                        <span className="text-gold-400/70">Edge +{vb.edge?.toFixed(1)}%</span> :
                        notre modèle estime ce pari à {vb.prob?.toFixed(1)}% contre
                        {' '}{(100 / vb.odd).toFixed(1)}% implicite par la cote {vb.odd?.toFixed(2)}.
                        {' '}Le bookie sous-évalue de {vb.edge?.toFixed(1)} points → tu gagnes
                        statistiquement {vb.edge?.toFixed(1)}% de plus que ce que la cote paye.
                      </p>
                    </div>
                  ))}
                </div>
              </motion.div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
