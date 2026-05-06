import clsx from 'clsx';

/**
 * Mini badges showing which detection source(s) flagged a value bet.
 * Each source has a distinct color and short label so the user knows
 * which model(s) agree and can choose which to follow.
 *
 * 'shin'     → bookmaker margin redistribution (Shin 1992)
 * 'poisson'  → independent xG-based Poisson model on O/U + BTTS
 * 'lineup'   → flag added when xG was adjusted for an absent top scorer
 */
const SOURCE_META = {
  shin: { label: 'Shin', color: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    title: 'Méthode Shin · marge bookmaker redistribuée. Edge = vraie proba bookie − implicite.' },
  poisson: { label: 'Poisson', color: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    title: 'Modèle Poisson xG · proba calculée indépendamment depuis les buts attendus saison.' },
  lineup: { label: 'Compo', color: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
    title: 'Ajustement compositions · top scoreur absent du XI, xG réduit en conséquence.' },
};

export default function ValueBetSources({ sources = [], className = '' }) {
  if (!sources || sources.length === 0) return null;
  return (
    <div className={clsx('flex flex-wrap gap-1', className)}>
      {sources.map((src) => {
        const meta = SOURCE_META[src];
        if (!meta) return null;
        return (
          <span
            key={src}
            title={meta.title}
            className={clsx(
              'inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-heading font-bold uppercase tracking-wider border',
              meta.color
            )}
          >
            {meta.label}
          </span>
        );
      })}
      {sources.length >= 2 && (
        <span
          title="Plusieurs sources s'accordent — consensus fort"
          className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-heading font-bold uppercase tracking-wider border bg-brand-500/15 text-brand-300 border-brand-500/30"
        >
          ✓ Consensus
        </span>
      )}
    </div>
  );
}
