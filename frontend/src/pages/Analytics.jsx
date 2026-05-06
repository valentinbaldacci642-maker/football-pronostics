import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Target, Flame, Plus, Trash2, Check, X, Clock, Euro } from 'lucide-react';
import { useBetsStore, useHistoryStore } from '../store';

const TOOLTIP_STYLE = {
  background: '#0f1629',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  color: '#fff',
  fontSize: 12,
};

const RESULTAT_CONFIG = {
  attente: { label: 'En attente', icon: Clock, color: 'text-white/40', bg: 'bg-white/5', dot: 'bg-white/30' },
  gagne:   { label: 'Gagné',      icon: Check, color: 'text-green-400', bg: 'bg-green-500/15', dot: 'bg-green-400' },
  perdu:   { label: 'Perdu',      icon: X,     color: 'text-red-400',   bg: 'bg-red-500/15',   dot: 'bg-red-400' },
};

function BetForm({ onAdd, onCancel }) {
  const [form, setForm] = useState({ libelle: '', mise: '', cote: '' });
  const gainPotentiel = form.mise && form.cote
    ? parseFloat((parseFloat(form.mise) * parseFloat(form.cote)).toFixed(2))
    : null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.libelle || !form.mise || !form.cote) return;
    onAdd({
      libelle: form.libelle,
      mise: parseFloat(form.mise),
      cote: parseFloat(form.cote),
      gainPotentiel: gainPotentiel,
    });
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      onSubmit={handleSubmit}
      className="glass-card p-4 space-y-3"
    >
      <p className="text-xs font-heading font-semibold text-white/50 uppercase tracking-wider">Nouveau pari</p>
      <input
        type="text"
        placeholder="Ex: PSG vs Lyon — Victoire PSG"
        value={form.libelle}
        onChange={(e) => setForm(f => ({ ...f, libelle: e.target.value }))}
        className="w-full bg-dark-700 border border-white/[0.07] rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-brand-500/40 transition-all"
      />
      <div className="grid grid-cols-3 gap-2">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-xs">€</span>
          <input
            type="number" min="0" step="0.5"
            placeholder="Mise"
            value={form.mise}
            onChange={(e) => setForm(f => ({ ...f, mise: e.target.value }))}
            className="w-full bg-dark-700 border border-white/[0.07] rounded-xl pl-7 pr-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-brand-500/40 transition-all"
          />
        </div>
        <input
          type="number" min="1" step="0.01"
          placeholder="Cote"
          value={form.cote}
          onChange={(e) => setForm(f => ({ ...f, cote: e.target.value }))}
          className="w-full bg-dark-700 border border-white/[0.07] rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-brand-500/40 transition-all"
        />
        <div className="flex items-center justify-center rounded-xl border border-white/[0.07] bg-dark-700 px-3">
          <span className="text-xs text-white/30">Gain :</span>
          <span className="text-sm font-bold text-green-400 ml-1.5">
            {gainPotentiel !== null ? `${gainPotentiel}€` : '—'}
          </span>
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <button type="button" onClick={onCancel} className="btn-ghost !px-3 !py-1.5 text-xs">Annuler</button>
        <button
          type="submit"
          disabled={!form.libelle || !form.mise || !form.cote}
          className="btn-primary !px-4 !py-1.5 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Ajouter
        </button>
      </div>
    </motion.form>
  );
}

function BetRow({ bet, onUpdateResultat, onDelete }) {
  const [menu, setMenu] = useState(false);
  const cfg = RESULTAT_CONFIG[bet.resultat];
  const pnl = bet.resultat === 'gagne'
    ? +(bet.gainPotentiel - bet.mise).toFixed(2)
    : bet.resultat === 'perdu'
    ? -bet.mise
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8 }}
      className="flex items-center gap-3 py-3 border-b border-white/[0.04] last:border-0"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-heading font-semibold text-white/85 truncate">{bet.libelle}</p>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-white/35 font-mono">
          <span>{bet.mise}€</span>
          <span className="text-white/15">·</span>
          <span>@{bet.cote}</span>
          <span className="text-white/15">·</span>
          <span className="text-green-400/70">→ {bet.gainPotentiel}€</span>
        </div>
      </div>

      {pnl !== null && (
        <span className={`text-sm font-black tabular-nums ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {pnl >= 0 ? '+' : ''}{pnl}€
        </span>
      )}

      {/* Résultat badge */}
      <div className="relative">
        <button
          onClick={() => setMenu(!menu)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-heading font-semibold cursor-pointer transition-all ${cfg.bg} ${cfg.color}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
          {cfg.label}
        </button>
        <AnimatePresence>
          {menu && (
            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.95 }}
              className="absolute right-0 top-full mt-1 glass-card shadow-stadium z-50 overflow-hidden min-w-[130px]"
            >
              {Object.entries(RESULTAT_CONFIG).map(([key, v]) => (
                <button
                  key={key}
                  onClick={() => { onUpdateResultat(bet.id, key); setMenu(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-heading font-semibold hover:bg-white/[0.06] transition-colors ${v.color}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${v.dot}`} />
                  {v.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <button
        onClick={() => onDelete(bet.id)}
        className="w-7 h-7 flex items-center justify-center rounded-xl text-white/15 hover:text-red-400 hover:bg-red-500/10 transition-all flex-shrink-0"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}

export default function Analytics() {
  const [showForm, setShowForm] = useState(false);

  const { bets, addBet, updateResultat, deleteBet, getStats } = useBetsStore();
  const stats = getStats();

  const { getStats: getPronoStats, getBankrollStats } = useHistoryStore();
  const pronoStats = getPronoStats();
  const bkStats = getBankrollStats();
  const pending = pronoStats.total - pronoStats.settled;

  const simulatedData = {
    valueDetection: [
      { month: 'Oct', found: 23, converted: 14 },
      { month: 'Nov', found: 31, converted: 19 },
      { month: 'Dec', found: 28, converted: 17 },
      { month: 'Jan', found: 35, converted: 22 },
      { month: 'Feb', found: 29, converted: 18 },
      { month: 'Mar', found: 41, converted: 26 },
    ],
    marketDist: [
      { name: '1X2', value: 45, color: '#10b981' },
      { name: 'O/U', value: 28, color: '#3b82f6' },
      { name: 'BTTS', value: 16, color: '#f59e0b' },
      { name: 'Score', value: 7, color: '#8b5cf6' },
      { name: 'Autres', value: 4, color: '#6b7280' },
    ],
  };

  const handleAdd = (bet) => {
    addBet(bet);
    setShowForm(false);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-4xl text-white tracking-wide leading-none">Dashboard <span className="text-brand-400">Analytics</span></h1>
        <p className="text-sm text-white/35 font-heading font-medium mt-1">Performance globale · Suivi de paris</p>
      </div>

      {/* ── MES PARIS ─────────────────────────────────────────── */}
      <div className="glass-card p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Euro className="w-4 h-4 text-gold-400" />
            <h3 className="text-sm font-bold text-white/80">Mes Paris</h3>
            {bets.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-white/5 text-white/40 text-xs font-mono">{bets.length}</span>
            )}
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 btn-primary !px-3 !py-1.5 text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Ajouter un pari
          </button>
        </div>

        {/* Summary KPIs */}
        {stats.settled > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl bg-dark-700/60 p-3">
              <p className="text-xs text-white/35 font-heading">Total misé</p>
              <p className="text-lg font-black text-white/80 tabular-nums">{stats.totalMise.toFixed(2)}€</p>
            </div>
            <div className="rounded-xl bg-dark-700/60 p-3">
              <p className="text-xs text-white/35 font-heading">Total gagné</p>
              <p className="text-lg font-black text-green-400 tabular-nums">{stats.totalGagne.toFixed(2)}€</p>
            </div>
            <div className="rounded-xl bg-dark-700/60 p-3">
              <p className="text-xs text-white/35 font-heading">Profit net</p>
              <p className={`text-lg font-black tabular-nums ${stats.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {stats.pnl >= 0 ? '+' : ''}{stats.pnl.toFixed(2)}€
              </p>
            </div>
            <div className="rounded-xl bg-dark-700/60 p-3">
              <p className="text-xs text-white/35 font-heading">ROI · Taux</p>
              <p className={`text-lg font-black tabular-nums ${(stats.roi ?? 0) >= 0 ? 'text-brand-400' : 'text-red-400'}`}>
                {stats.roi !== null ? `${stats.roi >= 0 ? '+' : ''}${stats.roi}%` : '—'}
                <span className="text-sm font-semibold text-white/30 ml-1">
                  {stats.taux !== null ? `· ${stats.taux}%` : ''}
                </span>
              </p>
            </div>
          </div>
        )}

        {/* Win/loss bar */}
        {stats.settled > 0 && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-white/30 font-mono">
              <span>{stats.wins}W · {stats.losses}L · {stats.total - stats.settled} en attente</span>
              <span>{stats.settled} résolus</span>
            </div>
            <div className="h-2 rounded-full bg-white/5 overflow-hidden flex">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${stats.taux}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="h-full bg-green-500 rounded-l-full"
              />
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${100 - stats.taux}%` }}
                transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
                className="h-full bg-red-500/60 rounded-r-full"
              />
            </div>
          </div>
        )}

        {/* Form */}
        <AnimatePresence>
          {showForm && (
            <BetForm onAdd={handleAdd} onCancel={() => setShowForm(false)} />
          )}
        </AnimatePresence>

        {/* Bets list */}
        {bets.length === 0 && !showForm ? (
          <div className="py-8 text-center">
            <Euro className="w-8 h-8 text-white/10 mx-auto mb-2" />
            <p className="text-sm text-white/30 font-heading">Aucun pari enregistré</p>
            <p className="text-xs text-white/20 mt-0.5">Clique sur "Ajouter un pari" pour commencer</p>
          </div>
        ) : (
          <AnimatePresence>
            {bets.map((bet) => (
              <BetRow
                key={bet.id}
                bet={bet}
                onUpdateResultat={updateResultat}
                onDelete={deleteBet}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* ── PERFORMANCE PRONOS ────────────────────────────────── */}
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-brand-400" />
          <h3 className="text-sm font-bold text-white/80">Performance des Pronos</h3>
          {pronoStats.total > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-white/5 text-white/40 text-xs font-mono">{pronoStats.total} pronos</span>
          )}
        </div>

        {pronoStats.total === 0 ? (
          <div className="py-6 text-center">
            <Target className="w-8 h-8 text-white/10 mx-auto mb-2" />
            <p className="text-sm text-white/30 font-heading">Aucun pronostic enregistré</p>
            <p className="text-xs text-white/20 mt-0.5">Les pronos générés sur l'accueil s'enregistrent dans Historique</p>
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl bg-dark-700/60 p-3">
                <p className="text-xs text-white/35 font-heading">Taux de réussite</p>
                <p className={`text-2xl font-black tabular-nums ${pronoStats.rate >= 55 ? 'text-brand-400' : pronoStats.rate !== null ? 'text-gold-400' : 'text-white/30'}`}>
                  {pronoStats.rate !== null ? `${pronoStats.rate}%` : '—'}
                </p>
              </div>
              <div className="rounded-xl bg-dark-700/60 p-3">
                <p className="text-xs text-white/35 font-heading">Gagnés / Perdus</p>
                <p className="text-lg font-black text-white/80 tabular-nums">
                  <span className="text-brand-400">{pronoStats.wins}</span>
                  <span className="text-white/20 mx-1">/</span>
                  <span className="text-red-400">{pronoStats.losses}</span>
                </p>
              </div>
              <div className="rounded-xl bg-dark-700/60 p-3">
                <p className="text-xs text-white/35 font-heading">En attente</p>
                <p className="text-lg font-black text-white/40 tabular-nums">{pending}</p>
              </div>
              <div className="rounded-xl bg-dark-700/60 p-3">
                <p className="text-xs text-white/35 font-heading">ROI pronos</p>
                <p className={`text-lg font-black tabular-nums ${pronoStats.roi > 0 ? 'text-brand-400' : pronoStats.roi !== null ? 'text-red-400' : 'text-white/30'}`}>
                  {pronoStats.roi !== null ? `${pronoStats.roi > 0 ? '+' : ''}${pronoStats.roi}%` : '—'}
                </p>
              </div>
            </div>

            {/* Barres réussite / échec / attente */}
            {pronoStats.settled > 0 && (
              <div className="space-y-2.5">
                {[
                  { label: 'Gagnés', value: pronoStats.wins, total: pronoStats.total, color: 'bg-brand-500', text: 'text-brand-400' },
                  { label: 'Perdus', value: pronoStats.losses, total: pronoStats.total, color: 'bg-red-500', text: 'text-red-400' },
                  { label: 'En attente', value: pending, total: pronoStats.total, color: 'bg-white/20', text: 'text-white/30' },
                ].map((row, i) => {
                  const pct = pronoStats.total > 0 ? Math.round((row.value / pronoStats.total) * 100) : 0;
                  return (
                    <div key={row.label} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-white/50 font-heading">{row.label}</span>
                        <span className={`font-bold tabular-nums ${row.text}`}>{row.value} <span className="text-white/25">({pct}%)</span></span>
                      </div>
                      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.6, delay: i * 0.1, ease: 'easeOut' }}
                          className={`h-full rounded-full ${row.color}`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Bankroll pronos si mises renseignées */}
            {bkStats.count > 0 && (
              <div className="pt-3 border-t border-white/[0.05] grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <p className="text-xs text-white/30 font-heading">Misé total</p>
                  <p className="text-sm font-bold text-white/60 tabular-nums">{bkStats.totalMise.toFixed(2)}€</p>
                </div>
                <div>
                  <p className="text-xs text-white/30 font-heading">Retour total</p>
                  <p className="text-sm font-bold text-white/60 tabular-nums">{bkStats.totalReturn.toFixed(2)}€</p>
                </div>
                <div>
                  <p className="text-xs text-white/30 font-heading">P&L réel</p>
                  <p className={`text-sm font-bold tabular-nums ${bkStats.pnl >= 0 ? 'text-brand-400' : 'text-red-400'}`}>
                    {bkStats.pnl >= 0 ? '+' : ''}{bkStats.pnl.toFixed(2)}€
                  </p>
                </div>
                <div>
                  <p className="text-xs text-white/30 font-heading">ROI réel</p>
                  <p className={`text-sm font-bold tabular-nums ${bkStats.roi >= 0 ? 'text-brand-400' : 'text-red-400'}`}>
                    {bkStats.roi !== null ? `${bkStats.roi >= 0 ? '+' : ''}${bkStats.roi}%` : '—'}
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── ANALYTICS EXISTANTS ───────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="glass-card p-5 lg:col-span-3">
          <h3 className="text-sm font-bold text-white/80 mb-4 flex items-center gap-2">
            <Flame className="w-4 h-4 text-gold-400" />
            Évolution des value bets
          </h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={simulatedData.valueDetection}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Line type="monotone" dataKey="found" stroke="#f59e0b" strokeWidth={2} dot={false} name="Détectés" />
              <Line type="monotone" dataKey="converted" stroke="#10b981" strokeWidth={2} dot={false} name="Convertis" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card p-5 lg:col-span-2">
          <h3 className="text-sm font-bold text-white/80 mb-4">Répartition par marché</h3>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie data={simulatedData.marketDist} cx="50%" cy="50%" outerRadius={55} dataKey="value" strokeWidth={0}>
                {simulatedData.marketDist.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v}%`, 'Part']} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {simulatedData.marketDist.map((d) => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                  <span className="text-white/50">{d.name}</span>
                </div>
                <span className="font-bold text-white/80">{d.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

    </motion.div>
  );
}
