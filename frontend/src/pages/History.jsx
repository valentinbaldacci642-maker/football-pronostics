import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, X, Clock, Target, TrendingUp, BarChart3, BookOpen, Search, Wallet, Euro, History as HistoryIcon, ListChecks, RotateCcw, RefreshCw, Save, Download, MessageSquare } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { useHistoryStore, useBankrollStore, EDGE_MODE_THRESHOLD } from '../store';
import { resolveFinishedMatches } from '../utils/resolveResults';
import { exportBankrollCsv } from '../utils/exportCsv';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import clsx from 'clsx';

const RESULT_CONFIG = {
  win:  { label: 'Gagné',    color: 'text-brand-400', bg: 'bg-brand-500/15 border-brand-500/30', icon: Check },
  loss: { label: 'Perdu',    color: 'text-danger',    bg: 'bg-danger/15 border-danger/30',       icon: X },
  null: { label: 'En cours', color: 'text-white/30',  bg: 'bg-white/5 border-white/10',          icon: Clock },
};

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
  const { entries, getStats, getBankrollStats, getBankrollCurve, setMise, clearAll, resolveResult } = useHistoryStore();
  const { initialBankroll, kellyFraction, edgeMode, setInitialBankroll, setKellyFraction, setEdgeMode, reset: resetBankroll } = useBankrollStore();

  // Local input state so the bankroll input has a Save button (no save-on-keystroke)
  const [bankrollInput, setBankrollInput] = useState(String(initialBankroll));
  useEffect(() => { setBankrollInput(String(initialBankroll)); }, [initialBankroll]);
  const bankrollChanged = parseFloat(bankrollInput) !== initialBankroll;

  const handleSaveBankroll = () => {
    const v = parseFloat(bankrollInput);
    if (!Number.isFinite(v) || v < 0) return;
    setInitialBankroll(v);
  };

  // Manual resolve trigger for the "Vérifier les résultats" button
  const [resolving, setResolving] = useState(false);
  const [resolveMsg, setResolveMsg] = useState(null);
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
  const [filter, setFilter] = useState('all');
  const [tab, setTab] = useState('matchs');
  const [search, setSearch] = useState('');
  const stats = getStats();
  const bkStats = getBankrollStats();
  const curve = getBankrollCurve();
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
    const day = e.date || e.savedAt?.split('T')[0] || 'unknown';
    if (!acc[day]) acc[day] = [];
    acc[day].push(e);
    return acc;
  }, {});
  const sortedDays = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div className="max-w-3xl xl:max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-4xl text-white tracking-wide leading-none">Historique <span className="text-brand-400">Pronos</span></h1>
        <p className="text-sm text-white/35 font-heading font-medium mt-1">Tous les pronostics générés par le site</p>
      </div>

      {/* Stats globales */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[
          { label: 'Total', value: stats.total, color: 'text-white', icon: BarChart3 },
          { label: 'Réussite', value: stats.rate !== null ? `${stats.rate}%` : '—', color: stats.rate >= 55 ? 'text-brand-400' : stats.rate !== null ? 'text-gold-400' : 'text-white/30', icon: Target },
          { label: 'Gagnés', value: stats.wins, color: 'text-brand-400', icon: Check },
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

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {[
          { id: 'matchs',    label: 'Historique matchs', icon: HistoryIcon },
          { id: 'pronos',    label: 'Historique pronos', icon: ListChecks },
          { id: 'bankroll',  label: 'Bankroll',          icon: Wallet },
          { id: 'recherche', label: 'Équipe',            icon: Search },
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
              <span className="text-xs text-white/40 font-heading">Bankroll de départ (€)</span>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={bankrollInput}
                  onChange={(e) => setBankrollInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveBankroll(); }}
                  className="flex-1 bg-dark-800 border border-white/10 rounded-lg px-3 py-2 text-white font-display tracking-wider focus:outline-none focus:border-brand-500/50"
                />
                <button
                  onClick={handleSaveBankroll}
                  disabled={!bankrollChanged}
                  className={clsx(
                    'flex items-center gap-1.5 px-4 py-2 rounded-lg border text-xs font-heading font-semibold transition-all whitespace-nowrap',
                    bankrollChanged
                      ? 'bg-brand-500/15 border-brand-500/40 text-brand-400 hover:bg-brand-500/25'
                      : 'border-white/[0.05] text-white/20 cursor-not-allowed'
                  )}
                  title="Enregistrer la bankroll"
                >
                  <Save className="w-3.5 h-3.5" />
                  Enregistrer
                </button>
              </div>
            </label>

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
                  {currentBankroll.toFixed(0)} €
                  <span className="text-xs text-white/30 ml-2 font-mono">
                    ({bkStats.pnl >= 0 ? '+' : ''}{bkStats.pnl.toFixed(0)}€)
                  </span>
                </span>
              </div>
              {bkStats.pendingCommitted > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/30 font-heading">
                    En jeu (paris en attente · {bkStats.pendingCount})
                  </span>
                  <span className="text-gold-400/80 font-mono">
                    {bkStats.pendingCommitted.toFixed(0)} €
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
              { label: 'Total misé', value: bkStats.totalMise > 0 ? `${bkStats.totalMise.toFixed(0)}€` : '—', color: 'text-white' },
              { label: 'Retour', value: bkStats.totalReturn > 0 ? `${bkStats.totalReturn.toFixed(0)}€` : '—', color: 'text-white' },
              { label: 'P&L', value: bkStats.count > 0 ? `${bkStats.pnl >= 0 ? '+' : ''}${bkStats.pnl.toFixed(1)}€` : '—', color: bkStats.pnl >= 0 ? 'text-brand-400' : 'text-danger' },
              { label: 'ROI réel', value: bkStats.roi !== null ? `${bkStats.roi >= 0 ? '+' : ''}${bkStats.roi}%` : '—', color: bkStats.roi >= 0 ? 'text-brand-400' : 'text-danger' },
            ].map(({ label, value, color }) => (
              <div key={label} className="glass-card px-3.5 py-3">
                <p className={`stat-number text-xl leading-none ${color}`}>{value}</p>
                <p className="text-[11px] text-white/25 font-heading font-medium mt-0.5">{label}</p>
              </div>
            ))}
          </div>

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
      {tab === 'recherche' && (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Chercher une équipe..."
              className="w-full bg-dark-800 border border-white/[0.07] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-brand-500/40 font-heading"
              autoFocus
            />
          </div>
          {teamStats && search.trim() && (
            <div className="glass-card px-4 py-3 flex items-center gap-4 flex-wrap">
              <span className="text-sm text-white/40 font-heading">"{search}" :</span>
              <span className="text-sm text-white/60 font-heading font-semibold">{teamStats.total} pronos</span>
              {teamStats.settled > 0 && (
                <>
                  <span className={`stat-number text-lg ${teamStats.rate >= 55 ? 'text-brand-400' : 'text-gold-400'}`}>{teamStats.rate}%</span>
                  <span className="text-sm text-brand-400 font-heading font-semibold">{teamStats.wins}W</span>
                  <span className="text-sm text-danger font-heading font-semibold">{teamStats.settled - teamStats.wins}L</span>
                </>
              )}
            </div>
          )}
          <div className="space-y-2">
            {filtered.map((entry) => (
              <EntryCard key={entry.fixtureId || entry.savedAt} entry={entry} setMise={setMise} />
            ))}
          </div>
        </>
      )}

      {/* ── HISTORIQUE MATCHS TAB ── (matchs terminés, ou pronos d'une date passée) */}
      {tab === 'matchs' && (() => {
        const todayStr = new Date().toISOString().split('T')[0];
        const finished = entries.filter((e) => e.result || (e.date && e.date < todayStr));
        const finishedFiltered = finished.filter((e) => {
          if (filter === 'pending') return !e.result;
          if (filter === 'win') return e.result === 'win';
          if (filter === 'loss') return e.result === 'loss';
          return true;
        });
        const groupedF = finishedFiltered.reduce((acc, e) => {
          const day = e.date || e.savedAt?.split('T')[0] || 'unknown';
          (acc[day] = acc[day] || []).push(e);
          return acc;
        }, {});
        const daysF = Object.keys(groupedF).sort((a, b) => b.localeCompare(a));

        return (
          <>
            <div className="flex gap-2">
              {[['all', 'Tous'], ['pending', 'Sans résultat'], ['win', 'Gagnés'], ['loss', 'Perdus']].map(([val, label]) => (
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

            {finished.length === 0 && (
              <div className="glass-card p-12 text-center">
                <HistoryIcon className="w-12 h-12 text-white/10 mx-auto mb-3" />
                <p className="text-white/50 font-heading font-semibold">Aucun match terminé</p>
                <p className="text-white/25 text-sm mt-1 font-heading max-w-xs mx-auto">
                  Les pronos d’une journée passée apparaîtront ici une fois les matchs joués
                </p>
              </div>
            )}

            {finishedFiltered.length === 0 && finished.length > 0 && (
              <div className="glass-card p-8 text-center">
                <p className="text-white/35 text-sm font-heading">Aucun match dans cette catégorie</p>
              </div>
            )}

            <div className="space-y-6">
              {daysF.map((day) => (
                <div key={day}>
                  <p className="text-xs font-heading font-semibold text-white/25 uppercase tracking-widest mb-2 px-1">
                    {day !== 'unknown' ? format(parseISO(day), 'EEEE d MMMM yyyy', { locale: fr }) : 'Date inconnue'}
                  </p>
                  <div className="space-y-2">
                    {groupedF[day].map((entry) => (
                      <EntryCard key={entry.fixtureId || entry.savedAt} entry={entry} setMise={setMise} showMise />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        );
      })()}

      {/* ── HISTORIQUE PRONOS TAB ── (paris où l’utilisateur a saisi une mise) */}
      {tab === 'pronos' && (() => {
        const withMise = entries.filter((e) => e.mise > 0);
        const groupedP = withMise.reduce((acc, e) => {
          const day = e.date || e.savedAt?.split('T')[0] || 'unknown';
          (acc[day] = acc[day] || []).push(e);
          return acc;
        }, {});
        const daysP = Object.keys(groupedP).sort((a, b) => b.localeCompare(a));

        return (
          <>
            {withMise.length === 0 ? (
              <div className="glass-card p-12 text-center">
                <ListChecks className="w-12 h-12 text-white/10 mx-auto mb-3" />
                <p className="text-white/50 font-heading font-semibold">Aucun prono misé</p>
                <p className="text-white/25 text-sm mt-1 font-heading max-w-xs mx-auto">
                  Saisis une mise sur un prono dans l'onglet Bankroll pour le voir apparaître ici
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {daysP.map((day) => (
                  <div key={day}>
                    <p className="text-xs font-heading font-semibold text-white/25 uppercase tracking-widest mb-2 px-1">
                      {day !== 'unknown' ? format(parseISO(day), 'EEEE d MMMM yyyy', { locale: fr }) : 'Date inconnue'}
                    </p>
                    <div className="space-y-2">
                      {groupedP[day].map((entry) => (
                        <EntryCard
                          key={entry.fixtureId || entry.savedAt}
                          entry={entry}
                          setMise={setMise}
                          showMise
                        />
                      ))}
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
        {entry.odd && (
          <span className="text-sm font-display text-gold-400 flex-shrink-0">@{parseFloat(entry.odd).toFixed(2)}</span>
        )}
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
