import { motion } from 'framer-motion';
import { Star, Trash2 } from 'lucide-react';
import { useFavorites } from '../hooks/useFavorites';
import MatchCard from '../components/match/MatchCard';
import { EmptyState } from '../components/ui/Loading';
import { Spinner } from '../components/ui/Loading';

export default function Favorites() {
  const { fixtureData, loading, clear, toggle } = useFavorites();

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl text-white tracking-wide leading-none">Mes <span className="text-gold-400">Favoris</span></h1>
          <p className="text-sm text-white/35 font-heading font-medium mt-1">{fixtureData.length} match{fixtureData.length > 1 ? 's' : ''} sauvegardé{fixtureData.length > 1 ? 's' : ''}</p>
        </div>
        {fixtureData.length > 0 && (
          <button onClick={clear} className="flex items-center gap-2 text-xs text-red-400/60 hover:text-red-400 transition-colors">
            <Trash2 className="w-4 h-4" />
            Tout effacer
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Spinner /></div>
      ) : fixtureData.length === 0 ? (
        <EmptyState
          title="Aucun favori"
          subtitle="Ajoutez des matchs à vos favoris en cliquant sur l'étoile"
          icon={<Star className="w-10 h-10 text-white/20" />}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {fixtureData.map((fixture) => (
            <MatchCard key={fixture.fixture.id} fixture={fixture} />
          ))}
        </div>
      )}
    </motion.div>
  );
}
