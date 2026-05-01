import { motion } from 'framer-motion';

export function Spinner({ size = 'md', className = '' }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-8 h-8', lg: 'w-12 h-12' };
  return (
    <div className={`${sizes[size]} ${className}`}>
      <svg className="animate-spin text-brand-500" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
        <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  );
}

export function SkeletonCard({ className = '' }) {
  return (
    <div className={`football-card p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4 px-3">
        <div className="h-3 w-24 skeleton rounded" />
        <div className="h-3 w-16 skeleton rounded" />
      </div>
      <div className="flex items-center justify-between gap-4 px-3">
        <div className="flex flex-col items-center gap-2 flex-1">
          <div className="w-12 h-12 rounded-xl skeleton" />
          <div className="h-3 w-20 skeleton rounded" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="h-6 w-16 skeleton rounded" />
          <div className="h-3 w-10 skeleton rounded" />
        </div>
        <div className="flex flex-col items-center gap-2 flex-1">
          <div className="w-12 h-12 rounded-xl skeleton" />
          <div className="h-3 w-20 skeleton rounded" />
        </div>
      </div>
      <div className="mt-4 h-10 skeleton rounded-xl mx-3" />
    </div>
  );
}

export function LoadingPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <Spinner size="lg" />
      <p className="text-white/30 text-sm font-heading font-medium tracking-wide">Chargement...</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center min-h-[300px] gap-4 text-center"
    >
      <div className="w-16 h-16 rounded-2xl bg-danger/10 border border-danger/20 flex items-center justify-center">
        <span className="font-display text-2xl text-danger/60">ERR</span>
      </div>
      <div>
        <p className="text-white/70 font-heading font-semibold">Erreur de chargement</p>
        <p className="text-white/35 text-sm mt-1 font-mono">{message}</p>
      </div>
      {onRetry && (
        <button onClick={onRetry} className="btn-primary">Réessayer</button>
      )}
    </motion.div>
  );
}

export function EmptyState({ title = 'Aucun résultat', subtitle, icon = '⚽' }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center min-h-[300px] gap-3 text-center"
    >
      <div className="text-5xl opacity-30">{icon}</div>
      <p className="text-white/50 font-heading font-semibold">{title}</p>
      {subtitle && <p className="text-white/25 text-sm font-heading">{subtitle}</p>}
    </motion.div>
  );
}
