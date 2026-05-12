import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Flame, RefreshCw, ChevronRight, AlertTriangle, Star, Save, Target } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import clsx from 'clsx';
import { pronosticsApi, getRateLimitedUntil } from '../services/api';
import { useBankrollStore, useHistoryStore, useFavoritesStore } from '../store';
import { kellyStake } from '../utils/kelly';
import { formatStake } from '../utils/formatStake';
import { formatMatchDate } from '../utils/format';
import { isUnibetLeague } from '../utils/unibetLeagues';
import { isWinamaxLeague } from '../utils/winamaxLeagues';
import ValueBetSources from '../components/match/ValueBetSources';

function PerBetMiseInputs({ fixtureId, vb, leagueId, liveBankrollUnibet, liveBankrollWinamax, kFrac, defaultBookmaker }) {
  const setBetMise = useHistoryStore((s) => s.setBetMise);
  const setBetActualOdd = useHistoryStore((s) => s.setBetActualOdd);
  const entries = useHistoryStore((s) => s.entries);
  const existingEntry = entries.find((e) => e.fixtureId === fixtureId);

  // Which bookmakers can actually be used for this VB (based on league
  // coverage). Disable picker buttons for non-covered books.
  const unibetAvailable = isUnibetLeague(leagueId);
  const winamaxAvailable = isWinamaxLeague(leagueId);

  // betKey includes the bookmaker so a user can place TWO separate bets on
  // the same VB (one Unibet, one Winamax) without overwriting each other.
  // Legacy bets (saved before this fix) live under the bookmaker-less key
  // and are migrated on the fly when matched.
  const legacyKey = `${vb.market}::${vb.selection}`;
  const keyFor = (bm) => `${vb.market}::${vb.selection}::${bm}`;
  const readSaved = (bm) => {
    const bets = existingEntry?.bets || {};
    if (bets[keyFor(bm)]) return bets[keyFor(bm)];
    // Legacy: bet under old key whose bookmaker matches the requested one.
    const legacy = bets[legacyKey];
    if (legacy && (legacy.bookmaker || 'unibet') === bm) return legacy;
    return {};
  };

  // Default bookmaker pick : the one that has an existing saved bet first,
  // then user's global default if covered, then any covered, then unibet.
  const initialBookmaker = (() => {
    const u = readSaved('unibet');
    const w = readSaved('winamax');
    if (u.mise != null && unibetAvailable) return 'unibet';
    if (w.mise != null && winamaxAvailable) return 'winamax';
    if (defaultBookmaker === 'winamax' && winamaxAvailable) return 'winamax';
    if (unibetAvailable) return 'unibet';
    if (winamaxAvailable) return 'winamax';
    return 'unibet';
  })();
  const [selectedBookmaker, setSelectedBookmaker] = useState(initialBookmaker);

  // Saved data follows the currently selected bookmaker — switching the
  // picker reloads the inputs to that book's saved state.
  const saved = readSaved(selectedBookmaker);
  const savedMise = saved.mise != null ? String(saved.mise) : '';
  const savedOdd = saved.actualOdd != null ? String(saved.actualOdd) : '';

  const [miseInput, setMiseInput] = useState(savedMise);
  const [oddInput, setOddInput] = useState(savedOdd);
  // When the user clicks Unibet ↔ Winamax, re-prime the inputs to that
  // book's saved state instead of keeping the previous book's value.
  useEffect(() => {
    setMiseInput(savedMise);
    setOddInput(savedOdd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBookmaker]);

  const miseDirty = miseInput !== savedMise;
  const oddDirty = oddInput !== savedOdd;

  // The "live bankroll" used for Kelly depends on which bookmaker the user
  // is about to play this bet at — the bet pulls from that book's capital.
  const liveBankroll = selectedBookmaker === 'winamax' ? liveBankrollWinamax : liveBankrollUnibet;

  // Kelly is recomputed live against the user-entered bookmaker odd. The
  // odd shown on the site is just an indicative average — the user's actual
  // bookmaker (Unibet, Winamax) often differs by ±0.05-0.10, which shifts
  // both the edge AND the Kelly stake materially. Falling back to vb.odd
  // while the input is empty keeps the suggestion meaningful from the start.
  const effectiveOdd = parseFloat(oddInput) || vb.odd;
  const trueProb = vb.prob ?? vb.trueProb;
  const liveKellyStake = (effectiveOdd && trueProb)
    ? kellyStake(trueProb, effectiveOdd, liveBankroll, kFrac)
    : 0;
  const liveEdge = (effectiveOdd && trueProb)
    ? trueProb - (100 / effectiveOdd)
    : null;
  const usingCustomOdd = parseFloat(oddInput) > 0 && parseFloat(oddInput) !== vb.odd;

  const saveMise = () => {
    if (miseDirty) setBetMise(fixtureId, keyFor(selectedBookmaker), miseInput, vb.sources, vb.odd, selectedBookmaker);
  };
  const saveOdd = () => {
    if (oddDirty) setBetActualOdd(fixtureId, keyFor(selectedBookmaker), oddInput);
  };

  return (
    <div className="flex flex-col gap-2 pt-2.5 mt-1 border-t border-gold-500/15">
      {/* Bookmaker picker — uses the bankroll of the selected book for Kelly,
          and tags the saved bet so it counts in the right history. */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-xs text-white/45 font-heading">Parier chez :</span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={!unibetAvailable}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedBookmaker('unibet'); }}
            className={clsx(
              'text-[11px] font-heading font-bold px-2 py-0.5 rounded border transition-all',
              selectedBookmaker === 'unibet'
                ? 'bg-red-500/20 border-red-500/50 text-red-200'
                : 'border-white/[0.08] text-white/40 hover:text-white/70',
              !unibetAvailable && 'opacity-30 cursor-not-allowed',
            )}
          >
            Unibet
          </button>
          <button
            type="button"
            disabled={!winamaxAvailable}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedBookmaker('winamax'); }}
            className={clsx(
              'text-[11px] font-heading font-bold px-2 py-0.5 rounded border transition-all',
              selectedBookmaker === 'winamax'
                ? 'bg-yellow-400/20 border-yellow-400/50 text-yellow-200'
                : 'border-white/[0.08] text-white/40 hover:text-white/70',
              !winamaxAvailable && 'opacity-30 cursor-not-allowed',
            )}
          >
            Winamax
          </button>
        </div>
      </div>

      {/* Step 1 — bookmaker odd (always visible, recomputes Kelly on change) */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {liveKellyStake > 0 ? (
            <span className="text-sm text-gold-400/80 font-heading truncate">
              <span className="font-display tracking-wider text-gold-400">
                Mise Kelly: {formatStake(liveKellyStake)}
              </span>
              {usingCustomOdd && liveEdge != null && (
                <span className="text-white/45 ml-1.5">
                  · edge {liveEdge >= 0 ? '+' : ''}{liveEdge.toFixed(1)}% à @{effectiveOdd.toFixed(2)}
                </span>
              )}
            </span>
          ) : (
            <span className="text-sm text-white/35 font-heading">
              {liveBankroll <= 0 ? (
                'Définir bankroll pour voir Kelly'
              ) : usingCustomOdd && liveEdge != null ? (
                <>
                  Edge <span className={liveEdge >= 0 ? 'text-gold-400' : 'text-danger'}>
                    {liveEdge >= 0 ? '+' : ''}{liveEdge.toFixed(1)}%
                  </span>{' '}à @{effectiveOdd.toFixed(2)}
                </>
              ) : (
                'Kelly inactif'
              )}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 ml-auto flex-shrink-0">
          <span className="text-sm text-white/45 font-heading">Ma cote:</span>
          <input
            type="number"
            min="1"
            step="0.01"
            placeholder={vb.odd?.toFixed(2)}
            value={oddInput}
            onChange={(e) => { e.stopPropagation(); setOddInput(e.target.value); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveOdd(); } }}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
            className="w-20 bg-dark-800 border border-white/10 rounded-md px-2 py-1 text-sm text-white font-mono text-right focus:outline-none focus:border-brand-500/50"
          />
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); saveOdd(); }}
            disabled={!oddDirty}
            className={clsx(
              'flex items-center justify-center w-7 h-7 rounded-md border transition-all',
              oddDirty
                ? 'bg-brand-500/15 border-brand-500/40 text-brand-400 hover:bg-brand-500/25'
                : 'border-white/[0.05] text-white/15 cursor-not-allowed'
            )}
            title="Enregistrer la cote"
          >
            <Save className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Step 2 — actual stake */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="flex items-center gap-1.5 text-sm font-heading text-brand-400/90">
          <Target className="w-3.5 h-3.5" />
          {parseFloat(miseInput) > 0 || parseFloat(savedMise) > 0 ? 'Pari enregistré' : 'Saisis ta mise'}
        </span>
        <div className="flex items-center gap-2 ml-auto flex-shrink-0">
          <span className="text-sm text-white/45 font-heading">Ma mise:</span>
          <input
            type="number"
            min="0"
            step="1"
            placeholder={liveKellyStake > 0 ? liveKellyStake.toFixed(2) : '—'}
            value={miseInput}
            onChange={(e) => { e.stopPropagation(); setMiseInput(e.target.value); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveMise(); } }}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
            className="w-20 bg-dark-800 border border-white/10 rounded-md px-2 py-1 text-sm text-white font-mono text-right focus:outline-none focus:border-brand-500/50"
          />
          <span className="text-sm text-white/45">€</span>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); saveMise(); }}
            disabled={!miseDirty}
            className={clsx(
              'flex items-center justify-center w-7 h-7 rounded-md border transition-all',
              miseDirty
                ? 'bg-brand-500/15 border-brand-500/40 text-brand-400 hover:bg-brand-500/25'
                : 'border-white/[0.05] text-white/15 cursor-not-allowed'
            )}
            title="Enregistrer la mise"
          >
            <Save className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function buildDayOptions() {
  return Array.from({ length: 8 }, (_, i) => i).map((offset) => {
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
  // pronosticsByDay: { 'YYYY-MM-DD': [...pronostics] } — fetched in the
  // background for all 8 days so navigation is instant once loaded.
  const [pronosticsByDay, setPronosticsByDay] = useState({});
  const [loadingDays, setLoadingDays] = useState({}); // { 'YYYY-MM-DD': true }
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const dayOptions = buildDayOptions();
  const [selectedDay, setSelectedDay] = useState(dayOptions[0].iso);
  const isToday = selectedDay === dayOptions[0].iso;

  const pronostics = pronosticsByDay[selectedDay] || [];
  const loading = !!loadingDays[selectedDay];

  const {
    initialBankrollUnibet, initialBankrollWinamax,
    kellyFraction: kFrac, defaultBookmaker,
  } = useBankrollStore();
  const entries = useHistoryStore((s) => s.entries);
  const getBankrollStats = useHistoryStore((s) => s.getBankrollStats);
  const savePronostics = useHistoryStore((s) => s.savePronostics);
  const { toggle: toggleFav, isFavorite } = useFavoritesStore();
  const uStats = getBankrollStats('unibet');
  const wStats = getBankrollStats('winamax');
  const liveBankrollUnibet = initialBankrollUnibet + (uStats.pnl || 0) - (uStats.pendingCommitted || 0);
  const liveBankrollWinamax = initialBankrollWinamax + (wStats.pnl || 0) - (wStats.pendingCommitted || 0);

  // Fetch one day, populate pronosticsByDay
  const loadDay = async (date, { force = false } = {}) => {
    setLoadingDays((prev) => ({ ...prev, [date]: true }));
    try {
      const res = await pronosticsApi.getBestToday({
        force,
        date: date !== dayOptions[0].iso ? date : null,
      });
      const data = res?.data || [];
      setPronosticsByDay((prev) => ({ ...prev, [date]: data }));
      if (data.length > 0) savePronostics(data);
      return data;
    } catch (err) {
      setError({ message: err.message, code: err.code });
      return null;
    } finally {
      setLoadingDays((prev) => {
        const next = { ...prev };
        delete next[date];
        return next;
      });
    }
  };

  // Refresh every day in dayOptions with bounded parallelism (3 in flight).
  // Backend's outbound throttler caps at 420/min, so 3 concurrent day-scans
  // saturate the queue without bursting upstream. Triggered manually by the
  // Actualiser button — not on mount, to avoid burning the daily quota when
  // the user only wants to glance at today. 8 days × ~280 req ≈ 2240 req,
  // ~5-6 min at 420/min throttle.
  const loadAllDays = async ({ force = false, concurrency = 3 } = {}) => {
    setError(null);
    const total = dayOptions.length;
    setProgress({ done: 0, total });
    let done = 0;
    let cursor = 0;
    const worker = async () => {
      while (cursor < dayOptions.length) {
        const i = cursor++;
        const { iso } = dayOptions[i];
        // eslint-disable-next-line no-await-in-loop
        await loadDay(iso, { force });
        done += 1;
        setProgress({ done, total });
      }
    };
    await Promise.all(Array.from({ length: concurrency }, worker));
    setProgress({ done: 0, total: 0 });
  };

  // On mount: only load the selected day. Other days load on click (or via
  // the Actualiser button which refreshes all 14 in parallel).
  useEffect(() => {
    loadDay(selectedDay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When user picks a day not yet loaded, fetch it on demand
  useEffect(() => {
    if (!pronosticsByDay[selectedDay] && !loadingDays[selectedDay]) {
      loadDay(selectedDay);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDay]);

  // Auto-retry once rate-limit lockout expires (capped at 3)
  const [rateLimitRetries, setRateLimitRetries] = useState(0);
  useEffect(() => {
    if (error?.code !== 'RATE_LIMITED') return;
    if (rateLimitRetries >= 3) return;
    const id = setInterval(() => {
      if (Date.now() >= getRateLimitedUntil()) {
        clearInterval(id);
        setRateLimitRetries((n) => n + 1);
        loadDay(selectedDay);
      }
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error?.code, rateLimitRetries]);
  useEffect(() => { if (!error) setRateLimitRetries(0); }, [error]);

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
          sources: vb.sources || [],
          edgePoisson: vb.edgePoisson,
          trueProbPoisson: vb.trueProbPoisson,
          // Stake indicatif basé sur la SOMME des deux bankrolls (Unibet +
          // Winamax). C'est juste un repère visuel sur la carte ; le vrai
          // calcul Kelly se fait dans PerBetMiseInputs avec la bankroll du
          // book sélectionné par l'utilisateur.
          stake: (vb.odd && prob) ? kellyStake(prob, vb.odd, liveBankrollUnibet + liveBankrollWinamax, kFrac) : 0,
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
  }, [pronostics, liveBankrollUnibet, liveBankrollWinamax, kFrac]);

  // Plus de filtre : le scan backend ne retourne que des matchs couverts
  // par Unibet ou Winamax. On garde la variable pour compatibilité.
  const filteredMatches = matchesWithValueBets;

  const totalValueBetsCount = filteredMatches.reduce((s, m) => s + m.valueBets.length, 0);
  const totalSuggestedStake = filteredMatches.reduce((s, m) => s + m.totalStake, 0);

  return (
    <div className="space-y-6 max-w-4xl xl:max-w-6xl mx-auto">
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
          onClick={() => loadAllDays({ force: true })}
          disabled={progress.total > 0}
          className="btn-ghost !px-2.5 !py-2 flex items-center gap-2"
          title="Actualise les 8 jours d'un coup"
        >
          <RefreshCw className={clsx('w-4 h-4', progress.total > 0 && 'animate-spin')} />
          <span className="text-xs hidden sm:block font-heading font-semibold tracking-wide">
            {progress.total > 0 ? `${progress.done}/${progress.total}` : 'Actualiser tout'}
          </span>
        </button>
      </div>

      {/* Bulk refresh progress bar (Actualiser tout) */}
      {progress.total > 0 && (
        <div className="px-3.5 py-2.5 rounded-xl bg-brand-500/[0.08] border border-brand-500/25 space-y-2">
          <div className="flex items-center justify-between text-xs font-heading text-brand-300">
            <span>Actualisation des 8 jours · {progress.done}/{progress.total} jours scannés</span>
            <span className="text-brand-400/70">~5-6 min</span>
          </div>
          <div className="h-1.5 rounded-full bg-brand-500/15 overflow-hidden">
            <div
              className="h-full bg-brand-400 transition-all duration-500"
              style={{ width: `${(progress.done / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Note: les value bets sont dynamiques */}
      <div className="px-3.5 py-2.5 rounded-xl bg-orange-500/[0.08] border border-orange-500/25">
        <p className="text-xs text-orange-300/90 font-heading leading-relaxed">
          ⚠️ <strong>Les value bets peuvent disparaître au cours de la journée.</strong>{' '}
          Si les bookmakers resserrent la cote (ex: 3.13 → 2.95), la proba implicite
          monte et l'edge baisse — si l'edge passe sous 5%, le pari n'est plus détecté
          comme value bet par Kelly et sort de cette liste. Saisis ta mise et ta cote
          dès qu'un value bet t'intéresse, le marché bouge vite.
        </p>
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
      {!loading && filteredMatches.length > 0 && (
        <div className="grid grid-cols-3 gap-2.5">
          <div className="glass-card px-3.5 py-3">
            <p className="stat-number text-xl leading-none text-gold-400">{totalValueBetsCount}</p>
            <p className="text-[11px] text-white/25 font-heading font-medium mt-0.5">Value bets · {filteredMatches.length} matchs</p>
          </div>
          <div className="glass-card px-3.5 py-3">
            <p className="stat-number text-xl leading-none text-white">
              {filteredMatches[0]?.bestEdge?.toFixed(1)}%
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
          <div className="px-3.5 py-2.5 rounded-xl bg-brand-500/[0.08] border border-brand-500/25 flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-brand-400 animate-spin flex-shrink-0" />
            <p className="text-xs text-brand-300 font-heading leading-relaxed">
              Analyse en cours · scan des matchs et détection des value bets sur toutes les ligues du jour. Peut prendre 30-50 secondes au premier chargement.
            </p>
          </div>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="football-card p-4 h-24 skeleton" />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="glass-card p-10 text-center space-y-3">
          <div className="text-5xl font-display text-danger/60">ERR</div>
          <p className="text-white/50 font-heading font-semibold text-lg">{error.message || String(error)}</p>
          <button onClick={() => loadDay(selectedDay, { force: true })} className="btn-primary mt-2">Réessayer</button>
        </div>
      )}

      {!loading && !error && filteredMatches.length === 0 && (
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
      {!loading && !error && filteredMatches.length > 0 && (
        <div className="space-y-3">
          {liveBankrollUnibet <= 0 && liveBankrollWinamax <= 0 && (
            <div className="px-3.5 py-2.5 rounded-xl bg-brand-500/[0.08] border border-brand-500/25">
              <p className="text-xs text-brand-300 font-heading leading-relaxed flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>
                  <strong>Bankroll non définie.</strong> Va dans Historique → Bankroll
                  pour la régler (Unibet et/ou Winamax).
                </span>
              </p>
            </div>
          )}

          {filteredMatches.map((m, mi) => (
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
                {/* League + bookmaker badge + time header */}
                <div className="flex items-center gap-3">
                  {m.league?.logo && (
                    <img src={m.league.logo} alt="" className="w-4 h-4 object-contain opacity-60 flex-shrink-0" />
                  )}
                  <span className="text-sm text-white/45 font-heading truncate">
                    {m.league?.name}
                    {m.league?.country && (
                      <span className="text-white/25 ml-1.5">· {m.league.country}</span>
                    )}
                  </span>
                  {/* Bookmaker badge — tells the user where to place this bet */}
                  {(() => {
                    const u = isUnibetLeague(m.league?.id);
                    const w = isWinamaxLeague(m.league?.id);
                    if (u && w) {
                      return (
                        <span className="text-[10px] font-heading font-bold px-1.5 py-0.5 rounded bg-gradient-to-r from-red-500/15 to-yellow-400/15 border border-white/15 text-white/80 whitespace-nowrap">
                          Unibet · Winamax
                        </span>
                      );
                    }
                    if (u) {
                      return (
                        <span className="text-[10px] font-heading font-bold px-1.5 py-0.5 rounded bg-red-500/15 border border-red-500/40 text-red-300 whitespace-nowrap">
                          Unibet
                        </span>
                      );
                    }
                    if (w) {
                      return (
                        <span className="text-[10px] font-heading font-bold px-1.5 py-0.5 rounded bg-yellow-400/15 border border-yellow-400/40 text-yellow-300 whitespace-nowrap">
                          Winamax
                        </span>
                      );
                    }
                    return null;
                  })()}
                  <span className="text-xs text-gold-400/80 font-mono ml-auto">
                    {m.valueBets.length} value bet{m.valueBets.length > 1 ? 's' : ''}
                  </span>
                  {m.date && (
                    <span className="text-sm font-mono text-white/40 whitespace-nowrap">
                      {formatMatchDate(m.date)}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFav(m.fixtureId); }}
                    className={clsx(
                      'p-1 rounded-md transition-colors flex-shrink-0',
                      isFavorite(m.fixtureId)
                        ? 'text-gold-400 hover:text-gold-300'
                        : 'text-white/25 hover:text-white/60'
                    )}
                    aria-label={isFavorite(m.fixtureId) ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                  >
                    <Star className="w-4 h-4" fill={isFavorite(m.fixtureId) ? 'currentColor' : 'none'} />
                  </button>
                </div>

                {/* Teams */}
                <div className="flex items-center gap-2">
                  {m.home?.logo && (
                    <img src={m.home.logo} alt={m.home?.name} className="w-6 h-6 object-contain flex-shrink-0" />
                  )}
                  <span className="text-base font-heading font-bold text-white truncate flex-1">{m.home?.name}</span>
                  <span className="matchup-vs text-sm flex-shrink-0">VS</span>
                  <span className="text-base font-heading font-bold text-white truncate flex-1 text-right">{m.away?.name}</span>
                  {m.away?.logo && (
                    <img src={m.away.logo} alt={m.away?.name} className="w-6 h-6 object-contain flex-shrink-0" />
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
                        <span className="text-base font-display tracking-wider text-gold-400 bg-gold-400/10 px-2 py-0.5 rounded leading-none">
                          +{vb.edge?.toFixed(1)}%
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-xs text-white/50 font-heading uppercase tracking-wider">{vb.market}</p>
                            <ValueBetSources sources={vb.sources} />
                          </div>
                          <p className="text-base font-heading font-bold text-white truncate">{vb.selection}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-lg font-display tracking-wider text-gold-400">@{vb.odd?.toFixed(2)}</p>
                          {vb.stake > 0 ? (
                            <p className="text-sm text-gold-400/90 font-display tracking-wider mt-0.5">
                              Mise: {formatStake(vb.stake)}
                            </p>
                          ) : (
                            <p className="text-xs text-white/30 font-heading mt-0.5">{liveBankrollUnibet <= 0 && liveBankrollWinamax <= 0 ? 'Définir bankroll' : '—'}</p>
                          )}
                        </div>
                      </div>
                      {/* Edge explanation per source */}
                      <p className="text-xs text-white/55 font-heading leading-relaxed pt-1.5 border-t border-gold-500/15">
                        <span className="text-gold-400/80 font-semibold">Edge +{vb.edge?.toFixed(1)}%</span> :
                        notre modèle estime ce pari à {vb.prob?.toFixed(1)}% contre
                        {' '}{(100 / vb.odd).toFixed(1)}% implicite par la cote {vb.odd?.toFixed(2)}.
                        {vb.edgePoisson != null && (
                          <span className="text-purple-300/90">
                            {' · '}Poisson confirme à +{vb.edgePoisson.toFixed(1)}% ({vb.trueProbPoisson?.toFixed(1)}%).
                          </span>
                        )}
                      </p>
                      {/* Per-VB mise + cote inputs */}
                      <PerBetMiseInputs
                        fixtureId={m.fixtureId}
                        vb={vb}
                        leagueId={m.league?.id}
                        liveBankrollUnibet={liveBankrollUnibet}
                        liveBankrollWinamax={liveBankrollWinamax}
                        kFrac={kFrac}
                        defaultBookmaker={defaultBookmaker}
                      />
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
