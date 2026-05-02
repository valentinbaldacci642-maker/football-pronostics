import { motion } from 'framer-motion';
import { Star, Trash2, Users, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useFavorites } from '../hooks/useFavorites';
import { useFavoriteTeamsStore } from '../store';
import MatchCard from '../components/match/MatchCard';
import { EmptyState } from '../components/ui/Loading';
import { Spinner } from '../components/ui/Loading';

function SectionHeader({ icon: Icon, title, count, onClear }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-gold-500/15 flex items-center justify-center">
          <Icon className="w-4 h-4 text-gold-400" />
        </div>
        <h2 className="font-heading font-bold text-white/80 text-base tracking-wide">{title}</h2>
        <span className="text-xs text-white/25 font-mono bg-dark-700/60 px-2 py-0.5 rounded-full">{count}</span>
      </div>
      {count > 0 && (
        <button onClick={onClear} className="flex items-center gap-1.5 text-xs text-red-400/50 hover:text-red-400 transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
          Effacer
        </button>
      )}
    </div>
  );
}

export default function Favorites() {
  const { fixtureData, loading, clear } = useFavorites();
  const { favoriteTeams, clearTeams } = useFavoriteTeamsStore();

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-8">
      {/* Page header */}
      <div>
        <h1 className="font-display text-4xl text-white tracking-wide leading-none">
          Mes <span className="text-gold-400">Favoris</span>
        </h1>
        <p className="text-sm text-white/35 font-heading font-medium mt-1">
          {favoriteTeams.length} équipe{favoriteTeams.length !== 1 ? 's' : ''} · {fixtureData.length} match{fixtureData.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Équipes favorites */}
      <div className="space-y-3">
        <SectionHeader
          icon={Users}
          title="Équipes favorites"
          count={favoriteTeams.length}
          onClear={clearTeams}
        />

        {favoriteTeams.length === 0 ? (
          <div className="glass-card p-8 text-center space-y-2">
            <Users className="w-8 h-8 text-white/10 mx-auto" />
            <p className="text-white/30 font-heading font-semibold text-sm">Aucune équipe favorite</p>
            <p className="text-white/20 text-xs font-heading">Ajoutez des équipes depuis la page d'une équipe</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {favoriteTeams.map((team) => (
              <motion.div
                key={team.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Link
                  to={`/team/${team.id}`}
                  className="football-card flex items-center gap-3 p-4 cursor-pointer group"
                >
                  <div className="w-12 h-12 bg-dark-700/80 rounded-xl flex items-center justify-center p-1.5 flex-shrink-0">
                    <img
                      src={team.logo}
                      alt={team.name}
                      className="w-full h-full object-contain"
                      onError={(e) => { e.target.style.opacity = '0'; }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-heading font-bold text-white/85 group-hover:text-white transition-colors truncate">
                      {team.name}
                    </p>
                    {team.country && (
                      <p className="text-xs text-white/30 font-heading mt-0.5">{team.country}</p>
                    )}
                  </div>
                  <Star className="w-4 h-4 text-gold-400 flex-shrink-0" />
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="pitch-divider" />

      {/* Matchs favoris */}
      <div className="space-y-3">
        <SectionHeader
          icon={Calendar}
          title="Matchs favoris"
          count={fixtureData.length}
          onClear={clear}
        />

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner />
          </div>
        ) : fixtureData.length === 0 ? (
          <EmptyState
            title="Aucun match favori"
            subtitle="Ajoutez des matchs à vos favoris en cliquant sur l'étoile"
            icon={<Star className="w-8 h-8 text-white/20" />}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {fixtureData.map((fixture) => (
              <MatchCard key={fixture.fixture.id} fixture={fixture} />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
