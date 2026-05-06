import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Settings as SettingsIcon, Wallet, Calculator, Filter, RotateCcw, Save, BookOpen, Info } from 'lucide-react';
import clsx from 'clsx';
import { useBankrollStore, useHistoryStore, EDGE_MODE_THRESHOLD } from '../store';

export default function Settings() {
  const {
    initialBankroll,
    kellyFraction,
    edgeMode,
    setInitialBankroll,
    setKellyFraction,
    setEdgeMode,
    reset: resetBankroll,
  } = useBankrollStore();
  const clearAll = useHistoryStore((s) => s.clearAll);

  const [bankrollInput, setBankrollInput] = useState(String(initialBankroll));
  useEffect(() => { setBankrollInput(String(initialBankroll)); }, [initialBankroll]);
  const bankrollChanged = parseFloat(bankrollInput) !== initialBankroll;

  const handleSaveBankroll = () => {
    const v = parseFloat(bankrollInput);
    if (!Number.isFinite(v) || v < 0) return;
    setInitialBankroll(v);
  };

  const handleResetBankroll = () => {
    const ok = window.confirm(
      'Réinitialiser uniquement la bankroll ?\n\n' +
      'Les paramètres reviennent aux valeurs par défaut (0 €, ¼ Kelly, Standard) ' +
      'mais l\'historique des paris est conservé.'
    );
    if (!ok) return;
    resetBankroll();
  };

  const handleResetAll = () => {
    const ok = window.confirm(
      'Reset complet ?\n\n' +
      '- Tout l\'historique des paris sera supprimé\n' +
      '- Bankroll de départ remise à 0 €\n' +
      '- Mode Standard, ¼ Kelly\n\n' +
      'Cette action est irréversible.'
    );
    if (!ok) return;
    clearAll();
    resetBankroll();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto space-y-6"
    >
      {/* Header */}
      <div>
        <h1 className="font-display text-4xl text-white tracking-wide leading-none mb-1 flex items-center gap-2">
          <SettingsIcon className="w-8 h-8 text-brand-400" />
          Paramètres
        </h1>
        <p className="text-sm text-white/35 font-heading font-medium">
          Bankroll, Kelly, mode de sélection — tout ce qui pilote les mises suggérées.
        </p>
      </div>

      {/* Bankroll */}
      <section className="glass-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Wallet className="w-5 h-5 text-brand-400" />
          <h2 className="font-heading font-bold text-white text-lg">Bankroll de départ</h2>
        </div>
        <p className="text-sm text-white/45">
          Le capital initial que tu engages dans le bankroll management. Kelly utilise
          la <strong className="text-white/70">bankroll dispo</strong> (initiale + P&L réglé − cash en jeu)
          pour calculer chaque mise suggérée.
        </p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            step="10"
            value={bankrollInput}
            onChange={(e) => setBankrollInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSaveBankroll(); } }}
            placeholder="ex: 100"
            className="flex-1 bg-dark-800 border border-white/10 rounded-lg px-3 py-2 text-base text-white font-mono focus:outline-none focus:border-brand-500/50"
          />
          <span className="text-sm text-white/40">€</span>
          <button
            onClick={handleSaveBankroll}
            disabled={!bankrollChanged}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-heading font-semibold transition-all',
              bankrollChanged
                ? 'bg-brand-500/15 border-brand-500/40 text-brand-400 hover:bg-brand-500/25'
                : 'border-white/[0.05] text-white/15 cursor-not-allowed'
            )}
          >
            <Save className="w-3.5 h-3.5" /> Enregistrer
          </button>
        </div>
        <p className="text-xs text-white/30 italic">
          Le pill "Bankroll dispo" en haut de chaque page n'apparaît qu'à partir du moment
          où tu enregistres un montant {'>'} 0.
        </p>
      </section>

      {/* Kelly */}
      <section className="glass-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Calculator className="w-5 h-5 text-gold-400" />
          <h2 className="font-heading font-bold text-white text-lg">Fraction Kelly</h2>
        </div>
        <p className="text-sm text-white/45">
          Multiplicateur appliqué à la formule Kelly pleine. Plus la fraction est petite,
          plus la mise est prudente. <strong className="text-white/70">¼ Kelly</strong> recommandé
          pour réduire la variance.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[0.1, 0.25, 0.5, 1].map((v) => (
            <button
              key={v}
              onClick={() => setKellyFraction(v)}
              className={clsx(
                'px-3 py-2 rounded-lg border text-sm font-heading font-semibold transition-all',
                kellyFraction == v
                  ? 'bg-gold-500/15 border-gold-500/40 text-gold-400'
                  : 'border-white/[0.08] text-white/35 hover:text-white/60 hover:border-white/15'
              )}
            >
              {v === 1 ? 'Plein' : v === 0.5 ? '½' : v === 0.25 ? '¼' : '1/10'} Kelly
            </button>
          ))}
        </div>
        <p className="text-xs text-white/30 italic leading-relaxed">
          {kellyFraction == 0.1 && '1/10 Kelly · Mises très petites (~1-2%). Croissance lente, variance minimale. Idéal si tu débutes.'}
          {kellyFraction == 0.25 && '¼ Kelly · Mises modérées (~2-5%). Compromis recommandé pour la plupart des bettors.'}
          {kellyFraction == 0.5 && '½ Kelly · Mises élevées (~5-10%). Croissance rapide mais variance ±30% sur des séries.'}
          {kellyFraction == 1 && 'Plein Kelly · Mises très agressives. Mathématiquement optimal mais drawdown extrême — déconseillé.'}
        </p>
      </section>

      {/* Edge mode */}
      <section className="glass-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-info" />
          <h2 className="font-heading font-bold text-white text-lg">Mode de sélection</h2>
        </div>
        <p className="text-sm text-white/45">
          Filtre minimum d'edge pour qu'un pari soit affiché comme value bet.
        </p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: 'conservative', label: 'Conservateur', edge: '≥ 8%' },
            { id: 'standard', label: 'Standard', edge: '≥ 5%' },
            { id: 'aggressive', label: 'Agressif', edge: 'tous' },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => setEdgeMode(m.id)}
              className={clsx(
                'flex flex-col items-center gap-0.5 px-3 py-3 rounded-lg border text-sm font-heading font-semibold transition-all',
                edgeMode === m.id
                  ? 'bg-info/15 border-info/40 text-info'
                  : 'border-white/[0.08] text-white/35 hover:text-white/60 hover:border-white/15'
              )}
            >
              <span>{m.label}</span>
              <span className="text-xs font-mono opacity-70">{m.edge}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-white/30 italic leading-relaxed">
          {edgeMode === 'conservative' && 'Très peu de pronos par jour, edge confortable, variance faible. Idéal si tu débutes ou si tu veux des paris ultra-fiables.'}
          {edgeMode === 'standard' && 'Recommandé. Volume modéré, edge minimum 5% (au-dessus de la marge d\'erreur du modèle).'}
          {edgeMode === 'aggressive' && 'Tous les pronostics affichés (value bets + classiques). Beaucoup de volume mais variance élevée.'}
        </p>
      </section>

      {/* Quick links */}
      <section className="glass-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Info className="w-5 h-5 text-white/40" />
          <h2 className="font-heading font-bold text-white text-lg">Plus de réglages</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-2">
          <Link
            to="/history"
            className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/[0.08] hover:border-brand-500/30 transition-all text-white/60 hover:text-white"
          >
            <BookOpen className="w-4 h-4 text-brand-400" />
            <span className="text-sm font-heading font-semibold">Historique &amp; bankroll détaillée</span>
          </Link>
          <Link
            to="/help"
            className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/[0.08] hover:border-brand-500/30 transition-all text-white/60 hover:text-white"
          >
            <Info className="w-4 h-4 text-info" />
            <span className="text-sm font-heading font-semibold">Aide &amp; explications</span>
          </Link>
        </div>
      </section>

      {/* Reset zone */}
      <section className="glass-card p-5 space-y-3 border-danger/15">
        <div className="flex items-center gap-2">
          <RotateCcw className="w-5 h-5 text-danger/70" />
          <h2 className="font-heading font-bold text-white text-lg">Reset</h2>
        </div>
        <p className="text-sm text-white/45">
          Réinitialise les données stockées localement (bankroll, paris, paramètres).
          Sans effet sur ce qui est côté backend.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={handleResetBankroll}
            className="flex items-center justify-center gap-1.5 flex-1 px-3 py-2 rounded-lg border border-white/[0.08] text-sm font-heading font-semibold text-white/60 hover:text-white hover:border-white/20 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset bankroll uniquement
          </button>
          <button
            onClick={handleResetAll}
            className="flex items-center justify-center gap-1.5 flex-1 px-3 py-2 rounded-lg border border-danger/30 text-sm font-heading font-semibold text-danger/80 hover:text-danger hover:bg-danger/10 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset complet (bankroll + historique)
          </button>
        </div>
      </section>

      <p className="text-center text-xs text-white/20 font-mono pt-2">
        PronosDesFoufous · v1.0
      </p>
    </motion.div>
  );
}
