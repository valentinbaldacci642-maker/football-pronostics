import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, X, Clock, Target, TrendingUp, BarChart3, BookOpen, Search, Wallet, Euro, History as HistoryIcon, ListChecks, RotateCcw, RefreshCw, Save, Download, MessageSquare } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { useHistoryStore, useBankrollStore, EDGE_MODE_THRESHOLD } from '../store';
import { resolveFinishedMatches } from '../utils/resolveResults';
import { exportBankrollCsv } from '../utils/exportCsv';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { formatMatchDate } from '../utils/format';
import clsx from 'clsx';
import ValueBetSources from '../components/match/ValueBetSources';

const RESULT_CONFIG = {
  win:     { label: 'Gagné',    color: 'text-brand-400', bg: 'bg-brand-500/15 border-brand-500/30', icon: Check },
  loss:    { label: 'Perdu',    color: 'text-danger',    bg: 'bg-danger/15 border-danger/30',       icon: X },
  push:    { label: 'Remboursé',color: 'text-white/50',  bg: 'bg-white/[0.06] border-white/15',     icon: Clock },
  cashout: { label: 'Cash Out', color: 'text-info',      bg: 'bg-info/15 border-info/30',           icon: RefreshCw },
  null:    { label: 'En cours', color: 'text-white/30',  bg: 'bg-white/5 border-white/10',          icon: Clock },
};

/**
 * Flatten entries into a unified bet list:
 *   - One item per entry-level mise > 0 (the main pronos pick)
 *   - One item per per-VB mise > 0 (individual value bets staked on /value-bets)
 *
 * Decoupled from /value-bets API state — once saved, a bet stays here even
 * if its underlying value bet disappears from the live list (edge dropped).
 */
function flattenBets(entries, bookmaker) {
  const list = [];
  const matchesBook = (b) => !bookmaker || (b?.bookmaker || 'unibet') === bookmaker;
  for (const e of entries) {
    if (Number.isFinite(e.mise) && e.mise > 0 && matchesBook(e)) {
      // Fallback for legacy entries: any pronos pick that's a value bet
      // shows at least the Shin badge (every detected VB has Shin).
      const fallbackSources = e.pickSources && e.pickSources.length
        ? e.pickSources
        : (e.pickIsValue ? ['shin'] : []);
      list.push({
        key: `${e.fixtureId}::main`,
        fixtureId: e.fixtureId,
        homeTeam: e.homeTeam, awayTeam: e.awayTeam,
        homeLogo: e.homeLogo, awayLogo: e.awayLogo,
        league: e.league, leagueLogo: e.leagueLogo,
        date: e.date, matchDate: e.matchDate || null, savedAt: e.savedAt,
        market: e.pickMarket || '1X2',
        selection: e.pickLabel || e.pick,
        rawSelection: e.pick,
        mise: e.mise,
        odd: e.actualOdd || e.odd || null,
        modelOdd: e.odd || null,
        result: e.result || null,
        finalScore: e.finalScore || null,
        source: 'pronos',
        detectionSources: fallbackSources,
      });
    }
    for (const [betKey, bet] of Object.entries(e.bets || {})) {
      if (!Number.isFinite(bet.mise) || bet.mise <= 0) continue;
      if (!matchesBook(bet)) continue;
      const [market, selection] = betKey.split('::');
      // Per-VB stakes always come from the value-bets page → Shin minimum.
      // If sources were stored at save time, use those; otherwise fall back.
      const fallbackSources = (bet.sources && bet.sources.length) ? bet.sources : ['shin'];
      list.push({
        key: `${e.fixtureId}::${betKey}`,
        fixtureId: e.fixtureId,
        betKey,
        homeTeam: e.homeTeam, awayTeam: e.awayTeam,
        homeLogo: e.homeLogo, awayLogo: e.awayLogo,
        league: e.league, leagueLogo: e.leagueLogo,
        date: e.date, matchDate: e.matchDate || null, savedAt: e.savedAt,
        market, selection,
        rawSelection: selection,
        mise: bet.mise,
        // Fall back to the system-suggested odd captured at save time so
        // gains potentiels stay visible when the user didn't enter "Ma cote".
        odd: bet.actualOdd || bet.modelOdd || null,
        modelOdd: bet.modelOdd || null,
        closingOdd: bet.closingOdd ?? null,
        result: bet.result || null,
        cashoutReturn: bet.cashoutReturn ?? null,
        finalScore: e.finalScore || null,
        source: 'value-bet',
        detectionSources: fallbackSources,
      });
    }
  }
  // Sort: pending first (most recent savedAt), then settled by date desc
  return list.sort((a, b) => {
    if (!!a.result !== !!b.result) return a.result ? 1 : -1;
    return (b.savedAt || '').localeCompare(a.savedAt || '');
  });
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-dark-700 border border-white/10 rounded-xl px-3 py-2 text-xs">
      <p className="text-white/50 font-heading mb-1">{d.label}</p>
      <p className={clsx('font-display text-lg', d.running >= 0 ? 'text-brand-400' : 'text-danger')}>
        {d.running >= 0 ? '+' : ''}{d.running}€
      </p>
      <p className={clsx('font-heading text-xs', d.pnl >= 0 ? 'text-brand-400/70' : 'text-danger/70')}>
        {d.pnl >= 0 ? '+' : ''}{d.pnl}€ ce pari
      </p>
    </div>
  );
};

export default function History() {
  const { entries, getStats, getBankrollStats, getBankrollCurve, getCLVStats, setMise, clearAll, clearUnstakedEntries, resolveResult, seedUnibetBets } = useHistoryStore();
  const {
    initialBankrollUnibet, initialBankrollWinamax,
    kellyFraction, edgeMode,
    setInitialBankrollUnibet, setInitialBankrollWinamax,
    setKellyFraction, setEdgeMode, reset: resetBankroll,
  } = useBankrollStore();

  // Bookmaker selector — drives all the filters / displays below.
  const [activeBookmaker, setActiveBookmaker] = useState('unibet');
  // En mode 'all', l'initial bankroll affichée = somme des deux ; l'édition
  // est désactivée (faut switch sur un book spécifique pour modifier).
  const initialBankroll = activeBookmaker === 'winamax' ? initialBankrollWinamax
    : activeBookmaker === 'unibet' ? initialBankrollUnibet
    : initialBankrollUnibet + initialBankrollWinamax;
  const setInitialBankroll = activeBookmaker === 'winamax' ? setInitialBankrollWinamax
    : activeBookmaker === 'unibet' ? setInitialBankrollUnibet
    : () => {}; // no-op en mode all
  const isAllMode = activeBookmaker === 'all';

  // Local input state so the bankroll input has a Save button (no save-on-keystroke)
  const [bankrollInput, setBankrollInput] = useState(String(initialBankroll));
  useEffect(() => { setBankrollInput(String(initialBankroll)); }, [initialBankroll]);
  const bankrollChanged = parseFloat(bankrollInput) !== initialBankroll;

  const handleSaveBankroll = () => {
    const v = parseFloat(bankrollInput);
    if (!Number.isFinite(v) || v < 0) return;
    setInitialBankroll(v);
  };

  // Bookmaker sync: user types real bookmaker balance, system computes
  // the delta with currentBankroll and patches initialBankroll so live
  // bankroll matches reality. Used for small reconciliations (un pari mal
  // résolu, bonus, cashout partiel) sans avoir à recalculer manuellement.
  const [syncInput, setSyncInput] = useState('');
  const [syncMsg, setSyncMsg] = useState(null);
  const handleSyncBankroll = () => {
    const target = parseFloat(syncInput);
    if (!Number.isFinite(target) || target < 0) return;
    const _bk = getBankrollStats(activeBookmaker);
    const live = initialBankroll + (_bk.pnl || 0) - (_bk.pendingCommitted || 0);
    const delta = target - live;
    if (Math.abs(delta) < 0.005) {
      setSyncMsg('Déjà synchro');
      return;
    }
    setInitialBankroll(parseFloat((initialBankroll + delta).toFixed(2)));
    setSyncMsg(`${delta >= 0 ? '+' : ''}${delta.toFixed(2)} € appliqué`);
    setSyncInput('');
  };

  // Manual resolve trigger for the "Vérifier les résultats" button
  const [resolving, setResolving] = useState(false);
  const [resolveMsg, setResolveMsg] = useState(null);

  // Auto-resolve on mount: any pending bet whose match has finished gets
  // graded and moves to "Historique pronos" automatically. The user no
  // longer needs to click the button — but it's still there for retry.
  // Runs once per History page open.
  useEffect(() => {
    const hasPending = entries.some((e) => {
      if (Number.isFinite(e.mise) && e.mise > 0 && !e.result) return true;
      return Object.values(e.bets || {}).some((b) => Number.isFinite(b.mise) && b.mise > 0 && !b.result);
    });
    if (!hasPending) return;
    resolveFinishedMatches(entries, resolveResult).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleResolveNow = async () => {
    setResolving(true);
    setResolveMsg(null);
    try {
      const { checked, resolved } = await resolveFinishedMatches(entries, resolveResult);
      if (checked === 0) setResolveMsg('Aucun pari en attente à vérifier');
      else if (resolved === 0) setResolveMsg(`${checked} pari(s) vérifié(s), aucun résultat encore disponible`);
      else setResolveMsg(`${resolved} pari(s) résolu(s) sur ${checked} vérifié(s)`);
    } catch {
      setResolveMsg('Erreur lors de la vérification');
    } finally {
      setResolving(false);
      setTimeout(() => setResolveMsg(null), 4000);
    }
  };

  const handleResetAll = () => {
    const ok = window.confirm(
      'Reset complet ?\n\n' +
      '- Tout l\'historique des pronos sera supprimé\n' +
      '- Bankroll de départ remise à 0 €\n' +
      '- Mode Standard, 1/4 Kelly\n\n' +
      'Cette action est irréversible.'
    );
    if (!ok) return;
    clearAll();
    resetBankroll();
  };

  const handleResetBankrollOnly = () => {
    const ok = window.confirm(
      'Réinitialiser uniquement la bankroll ?\n\n' +
      'Les paramètres reviennent aux valeurs par défaut (0 €, ¼ Kelly, Standard) ' +
      'mais l\'historique des pronos est conservé.'
    );
    if (!ok) return;
    resetBankroll();
  };

  const handleResetStatsOnly = () => {
    const _bk = bkStats;
    const liveBk = initialBankroll + (_bk.pnl || 0) - (_bk.pendingCommitted || 0);
    const ok = window.confirm(
      'Réinitialiser les stats Total / Réussite / Gagnés / ROI ?\n\n' +
      `Tous les paris (en cours + terminés) seront supprimés.\n` +
      `Ta bankroll de ${liveBk.toFixed(2)} € est conservée (figée comme nouvelle bankroll initiale).\n` +
      'Kelly + mode edge inchangés.\n\n' +
      'Action irréversible.'
    );
    if (!ok) return;
    // Materialize current live bankroll as the new initial so the bankroll
    // pill keeps its value despite wiping all entries (which would otherwise
    // reset pnl + pendingCommitted to 0).
    setInitialBankroll(parseFloat(liveBk.toFixed(2)));
    clearAll();
  };
  const [filter, setFilter] = useState('all');
  const [tab, setTab] = useState('pending');
  const [search, setSearch] = useState('');
  // activeBookmaker peut être 'unibet', 'winamax', ou 'all' (cumul). En
  // mode 'all', on passe undefined aux selectors → stats agrégées sur les
  // deux books.
  const statsBookmaker = activeBookmaker === 'all' ? undefined : activeBookmaker;
  const stats = getStats(statsBookmaker);
  const bkStats = getBankrollStats(statsBookmaker);
  const curve = getBankrollCurve();
  const clvStats = getCLVStats();
  // Live bankroll = initial + settled P&L − pending stakes (cash committed at bookie).
  // This makes the bankroll react the moment a stake is entered, not only after
  // auto-resolve marks the bet as W/L.
  const currentBankroll = initialBankroll + (bkStats.pnl || 0) - (bkStats.pendingCommitted || 0);

  const byResult = entries.filter((e) => {
    if (filter === 'pending') return !e.result;
    if (filter === 'win') return e.result === 'win';
    if (filter === 'loss') return e.result === 'loss';
    return true;
  });

  const filtered = tab === 'recherche' && search.trim()
    ? entries.filter((e) =>
        e.homeTeam?.toLowerCase().includes(search.toLowerCase()) ||
        e.awayTeam?.toLowerCase().includes(search.toLowerCase())
      )
    : byResult;

  const teamStats = search.trim() && tab === 'recherche' ? (() => {
    const settled = filtered.filter(e => e.result === 'win' || e.result === 'loss');
    const wins = settled.filter(e => e.result === 'win').length;
    return { total: filtered.length, settled: settled.length, wins, rate: settled.length > 0 ? Math.round(wins / settled.length * 100) : null };
  })() : null;

  const grouped = filtered.reduce((acc, e) => {
    // Group by match kickoff day, falling back to save day for legacy
    // entries without matchDate. Avoids the 'Jeudi 7 mai' header showing
    // for a match actually played on Vendredi 8 mai.
    const day = e.matchDate?.split('T')[0] || e.date || e.savedAt?.split('T')[0] || 'unknown';
    if (!acc[day]) acc[day] = [];
    acc[day].push(e);
    return acc;
  }, {});
  const sortedDays = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div className="max-w-3xl xl:max-w-5xl mx-auto space-y-6">
      {/* Header + bookmaker selector */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <h1 className="font-display text-4xl text-white tracking-wide leading-none">Historique <span className="text-brand-400">pronos</span></h1>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveBookmaker('unibet')}
            className={clsx(
              'text-xs font-heading font-bold px-3 py-1.5 rounded-lg border transition-all',
              activeBookmaker === 'unibet'
                ? 'bg-red-500/20 border-red-500/50 text-red-200'
                : 'border-white/[0.08] text-white/40 hover:text-white/70'
            )}
          >
            Unibet
          </button>
          <button
            onClick={() => setActiveBookmaker('winamax')}
            className={clsx(
              'text-xs font-heading font-bold px-3 py-1.5 rounded-lg border transition-all',
              activeBookmaker === 'winamax'
                ? 'bg-yellow-400/20 border-yellow-400/50 text-yellow-200'
                : 'border-white/[0.08] text-white/40 hover:text-white/70'
            )}
          >
            Winamax
          </button>
          <button
            onClick={() => setActiveBookmaker('all')}
            className={clsx(
              'text-xs font-heading font-bold px-3 py-1.5 rounded-lg border transition-all',
              activeBookmaker === 'all'
                ? 'bg-brand-500/20 border-brand-500/50 text-brand-300'
                : 'border-white/[0.08] text-white/40 hover:text-white/70'
            )}
            title="Stats agrégées Unibet + Winamax (lecture seule)"
          >
            Total
          </button>
        </div>
      </div>

      {/* Stats globales */}
      <div className="space-y-2">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {[
            { label: stats.settled > 0 ? `Réussite · ${stats.wins}/${stats.settled}` : 'Réussite', value: stats.rate !== null ? `${stats.rate}%` : '—', color: stats.rate >= 55 ? 'text-brand-400' : stats.rate !== null ? 'text-gold-400' : 'text-white/30', icon: Target },
            { label: 'Gagnés', value: stats.wins, color: 'text-brand-400', icon: Check },
            { label: 'Perdus', value: stats.losses, color: 'text-danger', icon: X },
            { label: 'Cash out', value: stats.cashouts || 0, color: 'text-info', icon: RefreshCw },
            { label: 'ROI', value: stats.roi !== null ? `${stats.roi > 0 ? '+' : ''}${stats.roi}%` : '—', color: stats.roi > 0 ? 'text-brand-400' : stats.roi !== null ? 'text-danger' : 'text-white/30', icon: TrendingUp },
          ].map(({ label, value, color, icon: Icon }) => (
            <div key={label} className="glass-card px-3.5 py-3 flex items-center gap-3">
              <Icon className={`w-4 h-4 flex-shrink-0 ${color}`} />
              <div className="min-w-0">
                <p className={`stat-number text-xl leading-none ${color}`}>{value}</p>
                <p className="text-[11px] text-white/25 font-heading font-medium mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>
        {(stats.wins > 0 || stats.losses > 0 || stats.settled > 0) && (
          <div className="flex justify-end">
            <button
              onClick={handleResetStatsOnly}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.06] text-[11px] font-heading font-semibold text-white/35 hover:text-white/70 hover:border-white/15 transition-all"
            >
              <RotateCcw className="w-3 h-3" />
              Réinitialiser ces stats
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {[
          { id: 'pending',   label: 'Paris en cours',    icon: Clock },
          { id: 'pronos',    label: 'Historique pronos', icon: ListChecks },
          { id: 'bankroll',  label: 'Bankroll',          icon: Wallet },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-heading font-semibold border transition-all ${
              tab === id ? 'bg-brand-500/15 border-brand-500/35 text-brand-400' : 'border-white/[0.08] text-white/35 hover:text-white/60'
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* ── BANKROLL TAB ── */}
      {tab === 'bankroll' && (
        <div className="space-y-4">
          {/* Manual actions: resolve + export */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleResolveNow}
              disabled={resolving}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-brand-500/30 text-xs font-heading font-semibold text-brand-400 hover:bg-brand-500/10 transition-all disabled:opacity-50"
            >
              <RefreshCw className={clsx('w-3.5 h-3.5', resolving && 'animate-spin')} />
              {resolving ? 'Vérification...' : 'Vérifier les résultats'}
            </button>
            <button
              onClick={() => exportBankrollCsv(entries, `bankroll-${new Date().toISOString().split('T')[0]}.csv`)}
              disabled={!entries.some((e) => e.mise > 0)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/[0.08] text-xs font-heading font-semibold text-white/50 hover:text-white/80 hover:border-white/15 transition-all disabled:opacity-30"
              title="Exporter l'historique des paris en CSV"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
            {resolveMsg && (
              <span className="text-xs text-white/50 font-heading">{resolveMsg}</span>
            )}
          </div>

          {/* Settings: initial bankroll + Kelly fraction + edge mode */}
          <div className="glass-card p-4 space-y-3">
            <p className="text-xs font-heading font-semibold text-white/35 uppercase tracking-wider">Paramètres bankroll</p>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-white/40 font-heading">
                Bankroll de départ {activeBookmaker === 'unibet' ? 'Unibet' : activeBookmaker === 'winamax' ? 'Winamax' : 'cumul (Unibet + Winamax)'} (€)
              </span>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={bankrollInput}
                  onChange={(e) => setBankrollInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveBankroll(); }}
                  disabled={isAllMode}
                  className={clsx(
                    'flex-1 bg-dark-800 border border-white/10 rounded-lg px-3 py-2 text-white font-display tracking-wider focus:outline-none focus:border-brand-500/50',
                    isAllMode && 'opacity-40 cursor-not-allowed'
                  )}
                  title={isAllMode ? 'Sélectionne Unibet ou Winamax pour éditer' : ''}
                />
                <button
                  onClick={handleSaveBankroll}
                  disabled={!bankrollChanged || isAllMode}
                  className={clsx(
                    'flex items-center gap-1.5 px-4 py-2 rounded-lg border text-xs font-heading font-semibold transition-all whitespace-nowrap',
                    bankrollChanged && !isAllMode
                      ? 'bg-brand-500/15 border-brand-500/40 text-brand-400 hover:bg-brand-500/25'
                      : 'border-white/[0.05] text-white/20 cursor-not-allowed'
                  )}
                  title="Enregistrer la bankroll"
                >
                  <Save className="w-3.5 h-3.5" />
                  Enregistrer
                </button>
              </div>
              {isAllMode && (
                <span className="text-[10px] text-white/30 font-heading mt-0.5">
                  Lecture seule. Sélectionne <strong>Unibet</strong> ou <strong>Winamax</strong> en haut pour modifier la bankroll d'un book spécifique.
                </span>
              )}
            </label>

            {/* Sync with bookmaker — quick reconciliation when the live
                bankroll drifts from the real bookmaker balance (mal résolu,
                bonus, cashout, etc). User types real balance, we compute
                delta and bump initialBankroll. */}
            <label className="flex flex-col gap-1 pt-2 border-t border-white/[0.05]">
              <span className="text-xs text-white/40 font-heading">
                Synchroniser avec le bookmaker
              </span>
              <span className="text-[11px] text-white/25 font-heading leading-relaxed -mt-0.5">
                Tape ta vraie balance Unibet/Winamax/Betclic → le système ajuste
                la bankroll initiale pour matcher.
              </span>
              <div className="flex gap-2 mt-1">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Ex: 8.55"
                  value={syncInput}
                  onChange={(e) => { setSyncInput(e.target.value); setSyncMsg(null); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSyncBankroll(); }}
                  className="flex-1 bg-dark-800 border border-white/10 rounded-lg px-3 py-2 text-white font-display tracking-wider focus:outline-none focus:border-brand-500/50"
                />
                <button
                  onClick={handleSyncBankroll}
                  disabled={!syncInput || parseFloat(syncInput) < 0}
                  className={clsx(
                    'flex items-center gap-1.5 px-4 py-2 rounded-lg border text-xs font-heading font-semibold transition-all whitespace-nowrap',
                    syncInput && parseFloat(syncInput) >= 0
                      ? 'bg-gold-500/15 border-gold-500/40 text-gold-400 hover:bg-gold-500/25'
                      : 'border-white/[0.05] text-white/20 cursor-not-allowed'
                  )}
                  title="Synchroniser la bankroll avec ta vraie balance bookmaker"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Synchroniser
                </button>
              </div>
              {syncMsg && (
                <span className="text-xs text-gold-400/80 font-heading mt-1">{syncMsg}</span>
              )}
            </label>

            <div className="pt-2 border-t border-white/[0.05]">
              <button
                onClick={() => {
                  const ok = window.confirm(
                    'Importer historique Unibet v3 : remplace TOUT par 33 paris terminés (dont 3 cashouts), aucun pari en cours. Mise totale 5.47 € · returns 5.30 € · PnL -0.17 €. Pense à régler bankroll initiale à 10 € après pour avoir 9.83 € live. Continuer ?'
                  );
                  if (!ok) return;
                  seedUnibetBets();
                  setResolveMsg("Historique Unibet importé · règle bankroll à 10€");
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-orange-500/40 text-xs font-heading font-semibold text-orange-300 hover:bg-orange-500/10 transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                Importer historique Unibet (one-shot)
              </button>
            </div>

            <label className="flex flex-col gap-1">
              <span className="text-xs text-white/40 font-heading">Fraction Kelly</span>
              <select
                value={kellyFraction}
                onChange={(e) => setKellyFraction(e.target.value)}
                className="bg-dark-800 border border-white/10 rounded-lg px-3 py-2 text-white font-display tracking-wider focus:outline-none focus:border-brand-500/50"
              >
                <option value="0.1">1/10 Kelly · ultra-prudent</option>
                <option value="0.25">1/4 Kelly · recommandé</option>
                <option value="0.5">1/2 Kelly · agressif</option>
                <option value="1">Full Kelly · variance max</option>
              </select>
            </label>

            <p className="text-[11px] text-white/25 font-heading leading-relaxed pt-1">
              {kellyFraction == 0.1 && '1/10 Kelly · Mises très petites (~1-2% de la bankroll). Très peu de variance, croissance lente. Idéal si tu débutes ou si ton modèle n’est pas encore validé sur 50+ paris settlés.'}
              {kellyFraction == 0.25 && '1/4 Kelly · Mises modérées (~2-5%). Équilibre optimal entre croissance et variance, recommandé par la majorité des parieurs pro. Réduit drastiquement la variance par rapport à Full Kelly tout en captant 80% de la croissance théorique.'}
              {kellyFraction == 0.5 && '1/2 Kelly · Mises élevées (~5-10%). Croissance rapide mais variance significative. Réservé si tu as un ROI réel mesuré >10% sur 100+ paris et que tu acceptes des swings de bankroll de ±30% sur des séries.'}
              {kellyFraction == 1 && 'Full Kelly · Mathématiquement optimal long terme MAIS variance énorme. Une mauvaise série peut couper ta bankroll en 2 même avec un edge correct. Déconseillé sauf si tu as une certitude absolue sur tes probabilités.'}
            </p>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-white/40 font-heading">Mode de sélection des pronos</span>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'conservative', label: 'Conservateur', sub: 'edge ≥ 8%', color: 'brand' },
                  { id: 'standard',     label: 'Standard',    sub: 'edge ≥ 5%', color: 'gold' },
                  { id: 'aggressive',   label: 'Aggressif',   sub: 'tout',      color: 'red' },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setEdgeMode(m.id)}
                    className={clsx(
                      'flex flex-col items-center gap-0.5 px-2 py-2.5 rounded-lg border text-xs font-heading transition-all',
                      edgeMode === m.id
                        ? m.color === 'brand'
                          ? 'bg-brand-500/15 border-brand-500/40 text-brand-400'
                          : m.color === 'gold'
                          ? 'bg-gold-500/15 border-gold-500/40 text-gold-400'
                          : 'bg-red-500/15 border-red-500/40 text-red-400'
                        : 'border-white/[0.08] text-white/40 hover:text-white/70'
                    )}
                  >
                    <span className="font-bold">{m.label}</span>
                    <span className="text-[10px] opacity-60 font-mono">{m.sub}</span>
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-white/25 font-heading leading-relaxed pt-1">
                {edgeMode === 'conservative' && 'Très peu de pronos par jour, edge confortable, variance faible. Idéal si tu débutes ou si tu veux des paris ultra-fiables.'}
                {edgeMode === 'standard' && 'Recommandé. Volume modéré, edge minimum 5% (au-dessus de la marge d’erreur du modèle).'}
                {edgeMode === 'aggressive' && 'Tous les pronostics affichés (value bets + classiques). Beaucoup de volume mais variance élevée.'}
              </p>
            </div>

            <div className="pt-2 border-t border-white/[0.05] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/40 font-heading">Bankroll dispo (cash chez toi)</span>
                <span className={clsx(
                  'text-2xl font-display tracking-wider',
                  currentBankroll >= initialBankroll ? 'text-brand-400' : 'text-danger'
                )}>
                  {currentBankroll.toFixed(2)} €
                  <span className="text-xs text-white/30 ml-2 font-mono">
                    ({bkStats.pnl >= 0 ? '+' : ''}{bkStats.pnl.toFixed(2)}€)
                  </span>
                </span>
              </div>
              {bkStats.pendingCommitted > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/30 font-heading">
                    En jeu (paris en attente · {bkStats.pendingCount})
                  </span>
                  <span className="text-gold-400/80 font-mono">
                    {bkStats.pendingCommitted.toFixed(2)} €
                  </span>
                </div>
              )}
            </div>

            {/* Reset actions */}
            <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-white/[0.05]">
              <button
                onClick={handleResetBankrollOnly}
                className="flex items-center justify-center gap-1.5 flex-1 px-3 py-2 rounded-lg border border-white/[0.08] text-xs font-heading font-semibold text-white/50 hover:text-white/80 hover:border-white/15 transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset bankroll uniquement
              </button>
              <button
                onClick={handleResetAll}
                className="flex items-center justify-center gap-1.5 flex-1 px-3 py-2 rounded-lg border border-danger/30 text-xs font-heading font-semibold text-danger/80 hover:text-danger hover:bg-danger/10 transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset complet (bankroll + historique)
              </button>
            </div>
          </div>

          {/* Bankroll stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              { label: 'Total misé', value: bkStats.totalMise > 0 ? `${bkStats.totalMise.toFixed(2)}€` : '—', color: 'text-white' },
              { label: 'Retour', value: bkStats.totalReturn > 0 ? `${bkStats.totalReturn.toFixed(2)}€` : '—', color: 'text-white' },
              { label: 'P&L', value: bkStats.count > 0 ? `${bkStats.pnl >= 0 ? '+' : ''}${bkStats.pnl.toFixed(2)}€` : '—', color: bkStats.pnl >= 0 ? 'text-brand-400' : 'text-danger' },
              { label: 'ROI réel', value: bkStats.roi !== null ? `${bkStats.roi >= 0 ? '+' : ''}${bkStats.roi}%` : '—', color: bkStats.roi >= 0 ? 'text-brand-400' : 'text-danger' },
            ].map(({ label, value, color }) => (
              <div key={label} className="glass-card px-3.5 py-3">
                <p className={`stat-number text-xl leading-none ${color}`}>{value}</p>
                <p className="text-[11px] text-white/25 font-heading font-medium mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* CLV agrégé — preuve d'edge avant que le ROI ait convergé. */}
          {clvStats.count > 0 && (() => {
            const c = clvStats.avg;
            const color = c >= 2 ? 'text-brand-400' : c >= 0 ? 'text-gold-400' : 'text-danger';
            const verdict = c >= 2
              ? 'Edge confirmé long terme'
              : c >= 0
                ? 'Marginal · garde un échantillon plus grand'
                : 'Cotes Unibet en-dessous du marché · vérifie ton bookmaker';
            return (
              <div className="glass-card px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] text-white/25 font-heading font-medium uppercase tracking-wider">CLV moyen</p>
                  <p className={`stat-number text-2xl leading-none mt-0.5 ${color}`}>
                    {c >= 0 ? '+' : ''}{c.toFixed(2)}%
                  </p>
                  <p className="text-[11px] text-white/40 font-heading mt-1">
                    {clvStats.positive}/{clvStats.count} paris avec cote de clôture · {verdict}
                  </p>
                </div>
                <div className="text-[10px] text-white/25 font-heading text-right max-w-[180px] leading-relaxed">
                  Le CLV mesure si tu as parié à une meilleure cote que celle juste avant le kickoff. Positif sur 30+ paris = stratégie +EV prouvée.
                </div>
              </div>
            );
          })()}

          {/* Courbe */}
          {curve.length >= 2 ? (
            <div className="glass-card p-4">
              <p className="text-xs font-heading font-semibold text-white/35 uppercase tracking-wider mb-4">Courbe P&L cumulé (€)</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={curve} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <XAxis dataKey="n" tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 11 }} axisLine={false} tickLine={false} width={40}
                    tickFormatter={(v) => `${v > 0 ? '+' : ''}${v}€`} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" strokeDasharray="4 4" />
                  <Line
                    type="monotone"
                    dataKey="running"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#22c55e', strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: '#22c55e' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="glass-card p-8 text-center">
              <Wallet className="w-10 h-10 text-white/10 mx-auto mb-3" />
              <p className="text-white/40 font-heading font-semibold">Entrez vos mises sur les pronos du jour</p>
              <p className="text-white/20 text-xs font-heading mt-1">La courbe apparaîtra après 2 paris résolus avec mise</p>
            </div>
          )}

        </div>
      )}

      {/* ── RECHERCHE TAB ── */}
      {/* ── PARIS EN COURS TAB ── (every staked bet without a result yet) */}
      {tab === 'pending' && (() => {
        const allBets = flattenBets(entries, statsBookmaker);
        const pending = allBets.filter((b) => !b.result);

        return (
          <>
            {/* Bankroll snapshot */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="glass-card px-3.5 py-3">
                <p className={clsx(
                  'stat-number text-xl leading-none',
                  currentBankroll >= initialBankroll ? 'text-brand-400' : 'text-danger'
                )}>
                  {currentBankroll.toFixed(2)} €
                </p>
                <p className="text-[11px] text-white/30 font-heading font-medium mt-0.5">Bankroll dispo</p>
              </div>
              <div className="glass-card px-3.5 py-3">
                <p className="stat-number text-xl leading-none text-gold-400">
                  {bkStats.pendingCommitted.toFixed(2)} €
                </p>
                <p className="text-[11px] text-white/30 font-heading font-medium mt-0.5">
                  En jeu · {pending.length} pari{pending.length > 1 ? 's' : ''}
                </p>
              </div>
              <div className="glass-card px-3.5 py-3">
                <p className={clsx(
                  'stat-number text-xl leading-none',
                  bkStats.pnl >= 0 ? 'text-brand-400' : 'text-danger'
                )}>
                  {bkStats.pnl >= 0 ? '+' : ''}{bkStats.pnl.toFixed(2)} €
                </p>
                <p className="text-[11px] text-white/30 font-heading font-medium mt-0.5">P&L réglé</p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleResolveNow}
                disabled={resolving || pending.length === 0}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-brand-500/30 bg-brand-500/[0.08] text-brand-400 text-xs font-heading font-semibold hover:bg-brand-500/[0.15] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <RefreshCw className={clsx('w-3.5 h-3.5', resolving && 'animate-spin')} />
                Vérifier les résultats
              </button>
              {resolveMsg && (
                <span className="text-xs text-white/50 font-heading">{resolveMsg}</span>
              )}
            </div>

            {pending.length === 0 ? (
              <div className="glass-card p-12 text-center">
                <Clock className="w-12 h-12 text-white/10 mx-auto mb-3" />
                <p className="text-white/50 font-heading font-semibold">Aucun pari en cours</p>
                <p className="text-white/25 text-sm mt-1 font-heading max-w-sm mx-auto">
                  Saisis une mise sur la page Pronos ou Value bets pour qu'un pari apparaisse ici.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {pending.map((b) => <BetCard key={b.key} bet={b} />)}
              </div>
            )}
          </>
        );
      })()}

      {/* ── HISTORIQUE PRONOS TAB ── (every settled bet, won or lost) */}
      {tab === 'pronos' && (() => {
        const allBets = flattenBets(entries, statsBookmaker);
        const settled = allBets.filter((b) => b.result);
        const filtered = settled.filter((b) => {
          if (filter === 'win') return b.result === 'win';
          if (filter === 'loss') return b.result === 'loss';
          return true;
        });
        const grouped = filtered.reduce((acc, b) => {
          // Group by match kickoff day (matchDate) instead of save day so
          // the 'JEUDI 7 MAI' header reflects when the match was played,
          // not when the user pressed Save.
          const day = b.matchDate?.split('T')[0] || b.date || b.savedAt?.split('T')[0] || 'unknown';
          (acc[day] = acc[day] || []).push(b);
          return acc;
        }, {});
        const days = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

        return (
          <>
            <div className="flex gap-2">
              {[['all', `Tous · ${settled.length}`],
                ['win', `Gagnés · ${settled.filter((b) => b.result === 'win').length}`],
                ['loss', `Perdus · ${settled.filter((b) => b.result === 'loss').length}`]].map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setFilter(val)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-heading font-semibold border transition-all ${
                    filter === val ? 'bg-brand-500/15 border-brand-500/35 text-brand-400' : 'border-white/[0.08] text-white/35 hover:text-white/60'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {settled.length === 0 ? (
              <div className="glass-card p-12 text-center">
                <ListChecks className="w-12 h-12 text-white/10 mx-auto mb-3" />
                <p className="text-white/50 font-heading font-semibold">Aucun pari terminé</p>
                <p className="text-white/25 text-sm mt-1 font-heading max-w-sm mx-auto">
                  Tes paris terminés (gagnés ou perdus) apparaîtront ici une fois les matchs joués et les résultats vérifiés.
                </p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="glass-card p-8 text-center">
                <p className="text-white/35 text-sm font-heading">Aucun pari dans cette catégorie</p>
              </div>
            ) : (
              <div className="space-y-6">
                {days.map((day) => (
                  <div key={day}>
                    <p className="text-xs font-heading font-semibold text-white/25 uppercase tracking-widest mb-2 px-1">
                      {day !== 'unknown' ? format(parseISO(day), 'EEEE d MMMM yyyy', { locale: fr }) : 'Date inconnue'}
                    </p>
                    <div className="space-y-2">
                      {grouped[day].map((b) => <BetCard key={b.key} bet={b} />)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
}

/**
 * Compact card for a single bet (entry-level OR per-VB). Used by both the
 * 'Paris en cours' tab and the 'Historique pronos' (settled) tab.
 */
function BetCard({ bet }) {
  const setBetCashout = useHistoryStore((s) => s.setBetCashout);
  const clearBetResult = useHistoryStore((s) => s.clearBetResult);
  const duplicateBet = useHistoryStore((s) => s.duplicateBet);
  const setBetClosingOdd = useHistoryStore((s) => s.setBetClosingOdd);
  const [cashoutInput, setCashoutInput] = useState('');
  const [showCashoutInput, setShowCashoutInput] = useState(false);
  const [closingInput, setClosingInput] = useState(bet.closingOdd != null ? String(bet.closingOdd) : '');

  // CLV: (got / closing - 1) × 100. Positive = got better than closing line
  // = standard proof of edge. Updates live as user types closingInput so
  // they see the impact immediately.
  const liveClosing = parseFloat(closingInput);
  const clv = (bet.odd && Number.isFinite(liveClosing) && liveClosing > 0)
    ? ((parseFloat(bet.odd) / liveClosing) - 1) * 100
    : null;
  const closingDirty = closingInput !== (bet.closingOdd != null ? String(bet.closingOdd) : '');
  const saveClosing = () => {
    if (!bet.betKey) return;
    setBetClosingOdd(bet.fixtureId, bet.betKey, closingInput);
  };

  const res = RESULT_CONFIG[bet.result] || RESULT_CONFIG[null];
  const ResIcon = res.icon;
  const pnl = bet.result === 'win' && bet.odd
    ? bet.mise * (parseFloat(bet.odd) - 1)
    : bet.result === 'loss'
      ? -bet.mise
      : bet.result === 'cashout' && Number.isFinite(bet.cashoutReturn)
        ? bet.cashoutReturn - bet.mise
        : 0;

  const handleCashout = () => {
    const v = parseFloat(cashoutInput);
    if (!Number.isFinite(v) || v < 0) return;
    if (!bet.betKey) return; // entry-level not supported here
    setBetCashout(bet.fixtureId, bet.betKey, v);
    setShowCashoutInput(false);
    setCashoutInput('');
  };

  const handleUndoCashout = () => {
    if (!bet.betKey) return;
    clearBetResult(bet.fixtureId, bet.betKey);
  };
  const sourceLabel = bet.source === 'value-bet' ? 'Value bet' : 'Pronos';
  const sourceClass = bet.source === 'value-bet' ? 'text-gold-400 bg-gold-500/[0.08]' : 'text-brand-400 bg-brand-500/[0.08]';

  return (
    <div className={clsx('p-4 rounded-xl border space-y-2.5', res.bg)}>
      <div className="flex items-center gap-2 flex-wrap">
        {bet.leagueLogo && <img src={bet.leagueLogo} alt="" className="w-4 h-4 object-contain opacity-60" />}
        <span className="text-sm text-white/50 font-heading truncate flex-1 min-w-0">{bet.league}</span>
        <span className={clsx('text-xs font-heading font-semibold px-2 py-0.5 rounded', sourceClass)}>
          {sourceLabel}
        </span>
        {bet.detectionSources && bet.detectionSources.length > 0 && (
          <ValueBetSources sources={bet.detectionSources} />
        )}
        <span className={clsx('inline-flex items-center gap-1 text-xs font-heading font-semibold px-2 py-0.5 rounded border', res.bg, res.color)}>
          <ResIcon className="w-3.5 h-3.5" />
          {res.label}
        </span>
      </div>

      {bet.matchDate && (
        <div className="text-xs text-white/40 font-mono">
          {formatMatchDate(bet.matchDate)}
        </div>
      )}

      <div className="flex items-center gap-2">
        {bet.homeLogo && <img src={bet.homeLogo} alt="" className="w-6 h-6 object-contain flex-shrink-0" />}
        <span className="text-base font-heading font-bold text-white truncate flex-1">{bet.homeTeam}</span>
        <span className="text-xs text-white/35 font-display">VS</span>
        <span className="text-base font-heading font-bold text-white truncate flex-1 text-right">{bet.awayTeam}</span>
        {bet.awayLogo && <img src={bet.awayLogo} alt="" className="w-6 h-6 object-contain flex-shrink-0" />}
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-sm">
          <span className="text-white/45 font-heading">{bet.market}</span>
          <span className="text-white/80 font-heading font-semibold ml-1.5">{bet.selection}</span>
          {bet.finalScore && (
            <span className="text-white/50 font-mono ml-2">· {bet.finalScore}</span>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 text-sm">
          <div className="flex items-center gap-3">
            {bet.odd && (
              <span className="text-white/60 font-mono">
                @{parseFloat(bet.odd).toFixed(2)}
              </span>
            )}
            <span className="text-white/85 font-mono font-semibold">
              {bet.mise.toFixed(2)} €
            </span>
            {bet.result && (
              <span className={clsx('font-display tracking-wider text-base', pnl >= 0 ? 'text-brand-400' : 'text-danger')}>
                {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)} €
              </span>
            )}
          </div>
          {!bet.result && bet.odd && bet.mise > 0 && (() => {
            const oddNum = parseFloat(bet.odd);
            const potentialReturn = bet.mise * oddNum;
            const potentialGain = bet.mise * (oddNum - 1);
            return (
              <div className="flex items-baseline gap-2 flex-wrap justify-end">
                <span className="text-xs text-gold-400/70 font-mono">
                  Bénéfices potentiels: <span className="text-gold-400 font-semibold">+{potentialGain.toFixed(2)} €</span>
                </span>
                <span className="text-base font-display tracking-wider text-gold-400 bg-gold-400/15 px-2 py-0.5 rounded border border-gold-400/30">
                  gains potentiels {potentialReturn.toFixed(2)} €
                </span>
              </div>
            );
          })()}

          {/* Cashout marking — pending per-VB bets get an inline 'Cash Out'
              action so the user can record a manual cashout from the
              bookmaker without waiting for FT auto-resolution.
              + bouton Dupliquer : crée un 2e pari identique pour les cas
              où l'utilisateur a parié plusieurs fois la même combinaison. */}
          {!bet.result && bet.betKey && bet.mise > 0 && (
            <div className="flex items-center gap-1.5">
              {!showCashoutInput ? (
                <>
                  <button
                    type="button"
                    onClick={() => setShowCashoutInput(true)}
                    className="flex items-center gap-1 text-xs text-info/70 hover:text-info font-heading font-semibold px-2 py-1 rounded-md border border-info/30 hover:bg-info/10 transition-all"
                    title="Marquer comme cash out"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Cash Out
                  </button>
                  <button
                    type="button"
                    onClick={() => duplicateBet(bet.fixtureId, bet.betKey)}
                    className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 font-heading font-semibold px-2 py-1 rounded-md border border-white/[0.08] hover:border-white/20 transition-all"
                    title="Dupliquer ce pari (si tu l'as placé plusieurs fois)"
                  >
                    +1
                  </button>
                </>
              ) : (
                <>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Retour €"
                    value={cashoutInput}
                    onChange={(e) => setCashoutInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCashout(); }}
                    className="w-20 bg-dark-800 border border-info/40 rounded-md px-2 py-1 text-xs text-white font-mono text-right focus:outline-none focus:border-info"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleCashout}
                    disabled={!cashoutInput || parseFloat(cashoutInput) < 0}
                    className="text-xs px-2 py-1 rounded-md border border-info/40 text-info hover:bg-info/10 transition-all disabled:opacity-30"
                  >
                    OK
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowCashoutInput(false); setCashoutInput(''); }}
                    className="text-xs px-2 py-1 rounded-md border border-white/10 text-white/40 hover:text-white/70 transition-all"
                  >
                    Annuler
                  </button>
                </>
              )}
            </div>
          )}

          {/* Cashout: undo button so the user can fix a mis-clicked cashout */}
          {bet.result === 'cashout' && bet.betKey && (
            <button
              type="button"
              onClick={handleUndoCashout}
              className="text-[11px] text-white/30 hover:text-white/60 font-heading underline-offset-2 hover:underline transition-colors"
              title="Réinitialiser ce pari (le repasse en cours)"
            >
              Annuler le cash out
            </button>
          )}

          {/* Closing odd input — kept compact so it doesn't dominate. CLV
              displayed as a colored chip the moment a valid closingOdd is
              entered. The "got" odd used is bet.odd (actualOdd → modelOdd
              fallback), which is the price the user effectively played at. */}
          {bet.betKey && bet.odd && (
            <div className="flex items-center gap-1.5 pt-1 border-t border-white/5">
              <span className="text-[11px] text-white/35 font-heading">Cote clôture :</span>
              <input
                type="number"
                min="1"
                step="0.01"
                placeholder="@—"
                value={closingInput}
                onChange={(e) => setClosingInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveClosing(); }}
                onBlur={() => { if (closingDirty) saveClosing(); }}
                className="w-16 bg-dark-800 border border-white/10 rounded-md px-1.5 py-0.5 text-[11px] text-white font-mono text-right focus:outline-none focus:border-brand-500/50"
              />
              {clv != null && (
                <span className={clsx(
                  'text-[11px] font-display tracking-wider px-1.5 py-0.5 rounded-md',
                  clv >= 0 ? 'bg-brand-500/15 text-brand-400' : 'bg-red-500/15 text-red-400'
                )}>
                  CLV {clv >= 0 ? '+' : ''}{clv.toFixed(1)}%
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EntryCard({ entry, setMise, showMise = false }) {
  const setActualOdd = useHistoryStore((s) => s.setActualOdd);
  const setNote = useHistoryStore((s) => s.setNote);
  const setClosingOdd = useHistoryStore((s) => s.setClosingOdd);
  const res = RESULT_CONFIG[entry.result] || RESULT_CONFIG[null];
  const ResIcon = res.icon;
  const [miseInput, setMiseInput] = useState(entry.mise != null ? String(entry.mise) : '');
  const [oddInput, setOddInput] = useState(entry.actualOdd != null ? String(entry.actualOdd) : '');
  const [closingInput, setClosingInput] = useState(entry.closingOdd != null ? String(entry.closingOdd) : '');
  const [noteInput, setNoteInput] = useState(entry.note || '');
  const [noteOpen, setNoteOpen] = useState(false);
  const noteDirty = noteInput !== (entry.note || '');

  // CLV (Closing Line Value) — positive means user got a better price than the
  // closing market did, which is the standard proof of edge. Computed from the
  // user-entered actualOdd vs closingOdd.
  const clv = (entry.actualOdd && entry.closingOdd)
    ? ((parseFloat(entry.actualOdd) / parseFloat(entry.closingOdd)) - 1) * 100
    : null;

  // Use the user-entered actual bookmaker odd when present, otherwise the
  // system-suggested odd from when the prono was generated.
  const effectiveOdd = parseFloat(entry.actualOdd || entry.odd || 1);
  const pnl = entry.result === 'win' && entry.mise
    ? entry.mise * (effectiveOdd - 1)
    : entry.result === 'loss' && entry.mise
    ? -entry.mise
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card px-4 py-3"
    >
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 border ${res.bg}`}>
          <ResIcon className={`w-3.5 h-3.5 ${res.color}`} />
        </div>

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <img src={entry.homeLogo} alt="" className="w-4 h-4 object-contain flex-shrink-0" onError={e => e.target.style.display='none'} />
          <span className="text-sm font-heading font-semibold text-white/75 truncate">{entry.homeTeam}</span>
          <span className="text-xs text-white/20 flex-shrink-0">vs</span>
          <span className="text-sm font-heading font-semibold text-white/75 truncate">{entry.awayTeam}</span>
          <img src={entry.awayLogo} alt="" className="w-4 h-4 object-contain flex-shrink-0" onError={e => e.target.style.display='none'} />
        </div>

        {entry.finalScore && (
          <span className="font-display text-base text-white tabular-nums flex-shrink-0">{entry.finalScore}</span>
        )}
        {entry.odd && (() => {
          // Gold tint reserved for actual value bets — neutral white for plain
          // pronos so the color stops misleading users in the Équipe history.
          const isVB = (entry.pickSources && entry.pickSources.length > 0)
            || entry.pickIsValue;
          return (
            <span className={`text-sm font-display flex-shrink-0 ${isVB ? 'text-gold-400' : 'text-white/55'}`}>
              @{parseFloat(entry.odd).toFixed(2)}
            </span>
          );
        })()}
      </div>

      <div className="flex items-center justify-between mt-2 ml-11 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {entry.leagueLogo && (
            <img src={entry.leagueLogo} alt="" className="w-3 h-3 object-contain" onError={e => e.target.style.display='none'} />
          )}
          <span className="text-xs text-white/30 font-heading">{entry.league}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {entry.pickLabel && (
            <span className="text-xs font-heading font-semibold text-brand-300 bg-brand-500/10 px-2 py-0.5 rounded-md">{entry.pickLabel}</span>
          )}
          {/* Mise input */}
          <div className="flex items-center gap-1 bg-dark-700 border border-white/[0.07] rounded-lg px-2 py-0.5">
            <Euro className="w-3 h-3 text-white/25" />
            <input
              type="number"
              min="0"
              step="1"
              value={miseInput}
              onChange={(e) => {
                setMiseInput(e.target.value);
                setMise(entry.fixtureId, e.target.value);
              }}
              placeholder="Mise"
              className="w-14 bg-transparent text-xs text-white placeholder:text-white/20 focus:outline-none font-mono"
            />
          </div>
          {/* Actual bookie odd input — only relevant when user has placed a stake */}
          {parseFloat(miseInput) > 0 && (
            <div
              className="flex items-center gap-1 bg-dark-700 border border-white/[0.07] rounded-lg px-2 py-0.5"
              title="Cote réelle obtenue chez ton bookmaker (laisse vide pour utiliser la cote système)"
            >
              <span className="text-[10px] text-white/25 font-mono">@</span>
              <input
                type="number"
                min="1"
                step="0.01"
                value={oddInput}
                onChange={(e) => {
                  setOddInput(e.target.value);
                  setActualOdd(entry.fixtureId, e.target.value);
                }}
                placeholder={entry.odd ? parseFloat(entry.odd).toFixed(2) : '—'}
                className="w-12 bg-transparent text-xs text-white placeholder:text-white/20 focus:outline-none font-mono"
              />
            </div>
          )}
          {/* P&L display */}
          {pnl !== null && (
            <span className={`text-xs font-display ${pnl >= 0 ? 'text-brand-400' : 'text-danger'}`}>
              {pnl >= 0 ? '+' : ''}{pnl.toFixed(1)}€
            </span>
          )}
          <span className={`text-xs font-heading font-semibold ${res.color}`}>{res.label}</span>
          {/* Note toggle */}
          <button
            onClick={() => setNoteOpen((v) => !v)}
            className={clsx(
              'flex items-center justify-center w-6 h-6 rounded-md border transition-all',
              entry.note
                ? 'bg-gold-500/15 border-gold-500/40 text-gold-400'
                : 'border-white/[0.08] text-white/35 hover:text-white/70'
            )}
            title={entry.note ? 'Modifier la note' : 'Ajouter une note'}
          >
            <MessageSquare className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* CLV row — only relevant once the user has placed a bet (mise > 0) */}
      {parseFloat(miseInput) > 0 && (
        <div className="mt-2 ml-11 flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-white/30 font-heading">Cote au coup d'envoi:</span>
          <div className="flex items-center gap-1 bg-dark-700 border border-white/[0.07] rounded-lg px-2 py-0.5">
            <span className="text-[10px] text-white/25 font-mono">@</span>
            <input
              type="number"
              min="1"
              step="0.01"
              value={closingInput}
              onChange={(e) => { setClosingInput(e.target.value); setClosingOdd(entry.fixtureId, e.target.value); }}
              placeholder="—"
              className="w-12 bg-transparent text-xs text-white placeholder:text-white/20 focus:outline-none font-mono"
            />
          </div>
          {clv !== null && (
            <span className={clsx(
              'text-[11px] font-display tracking-wider px-2 py-0.5 rounded-md',
              clv >= 0 ? 'bg-brand-500/15 text-brand-400' : 'bg-red-500/15 text-red-400'
            )}>
              CLV {clv >= 0 ? '+' : ''}{clv.toFixed(1)}%
            </span>
          )}
        </div>
      )}

      {noteOpen && (
        <div className="mt-2 ml-11 flex gap-2">
          <textarea
            value={noteInput}
            onChange={(e) => setNoteInput(e.target.value)}
            placeholder="Pourquoi ce pari ? (ex: edge fort, équipe en forme, blessure de X...)"
            rows={2}
            className="flex-1 bg-dark-800 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/80 placeholder:text-white/20 focus:outline-none focus:border-brand-500/50 resize-none font-heading"
          />
          <button
            onClick={() => { setNote(entry.fixtureId, noteInput); setNoteOpen(false); }}
            disabled={!noteDirty}
            className={clsx(
              'flex items-center justify-center px-3 rounded-lg border text-xs font-heading font-semibold transition-all',
              noteDirty
                ? 'bg-brand-500/15 border-brand-500/40 text-brand-400 hover:bg-brand-500/25'
                : 'border-white/[0.05] text-white/20 cursor-not-allowed'
            )}
          >
            <Save className="w-3 h-3" />
          </button>
        </div>
      )}
    </motion.div>
  );
}
