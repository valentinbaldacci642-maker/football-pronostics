import { motion } from 'framer-motion';

export function Spinner({ size = 'md', className = '' }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-8 h-8', lg: 'w-12 h-12' };
  return (
    <div className={`${sizes[size]} ${className}`}>
      <svg className="animate-spin text-brand-500" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  );
}

export function SkeletonCard({ className = '' }) {
  return (
    <div className={`glass-card p-4 animate-pulse ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="h-3 w-24 bg-white/10 rounded" />
        <div className="h-3 w-16 bg-white/10 rounded" />
      </div>
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col items-center gap-2 flex-1">
          <div className="w-12 h-12 rounded-full bg-white/10" />
          <div className="h-3 w-20 bg-white/10 rounded" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="h-5 w-12 bg-white/10 rounded" />
          <div className="h-3 w-8 bg-white/10 rounded" />
        </div>
        <div className="flex flex-col items-center gap-2 flex-1">
          <div className="w-12 h-12 rounded-full bg-white/10" />
          <div className="h-3 w-20 bg-white/10 rounded" />
        </div>
      </div>
      <div className="mt-4 h-10 bg-white/5 rounded-lg" />
    </div>
  );
}

export function LoadingPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <Spinner size="lg" />
      <p className="text-white/40 text-sm">Chargement...</p>
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
      <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-3xl">⚠️</div>
      <div>
        <p className="text-white/80 font-medium">Erreur de chargement</p>
        <p className="text-white/40 text-sm mt-1">{message}</p>
      </div>
      {onRetry && (
        <button onClick={onRetry} className="btn-primary text-sm">
          Réessayer
        </button>
      )}
    </motion.div>
  );
}

export function EmptyState({ title = 'Aucun résultat', subtitle, icon = '🔍' }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center min-h-[300px] gap-3 text-center"
    >
      <div className="text-4xl">{icon}</div>
      <p className="text-white/60 font-medium">{title}</p>
      {subtitle && <p className="text-white/30 text-sm">{subtitle}</p>}
    </motion.div>
  );
}
