import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Search, Trophy, ChevronRight, Users } from 'lucide-react';
import { leaguesApi } from '../services/api';
import { SkeletonCard, EmptyState, ErrorState } from '../components/ui/Loading';

const CONTINENTS = {
  Europe: ['England', 'Spain', 'Germany', 'Italy', 'France', 'Portugal', 'Netherlands', 'Belgium', 'Turkey', 'Scotland'],
  World: ['World'],
  Americas: ['Brazil', 'Argentina', 'USA', 'Mexico', 'Colombia'],
  Asia: ['Japan', 'South Korea', 'China', 'Saudi Arabia'],
  Africa: ['Egypt', 'Morocco', 'Nigeria', 'South Africa'],
};

export default function Leagues() {
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('League');

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const data = await leaguesApi.getAll({ current: true });
        setLeagues(data?.response || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const filtered = leagues.filter((l) => {
    const matchSearch = !search || l.league?.name?.toLowerCase().includes(search.toLowerCase())
      || l.country?.name?.toLowerCase().includes(search.toLowerCase());
    const matchType = !selectedType || l.league?.type === selectedType;
    return matchSearch && matchType;
  });

  const TOP_LEAGUES = [39, 140, 78, 135, 61, 2, 3, 1, 94, 88];
  const topLeagues = leagues.filter((l) => TOP_LEAGUES.includes(l.league?.id));
  const otherLeagues = filtered.filter((l) => !TOP_LEAGUES.includes(l.league?.id));

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white">Compétitions</h1>
        <p className="text-sm text-white/40 mt-0.5">{leagues.length} ligues actives</p>
      </div>

      {/* Search + filters */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une ligue..."
            className="w-full bg-dark-800 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-brand-500/50"
          />
        </div>
        {['League', 'Cup'].map((type) => (
          <button
            key={type}
            onClick={() => setSelectedType(selectedType === type ? null : type)}
            className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
              selectedType === type ? 'bg-brand-500/20 border-brand-500/40 text-brand-300' : 'border-white/10 text-white/40 hover:text-white/70'
            }`}
          >
            {type === 'League' ? 'Ligues' : 'Coupes'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(9)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        <div className="space-y-8">
          {/* Top Leagues */}
          {topLeagues.length > 0 && !search && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="w-4 h-4 text-gold-400" />
                <h2 className="text-sm font-bold text-white/80">Compétitions majeures</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {topLeagues.map((item) => (
                  <LeagueCard key={item.league.id} item={item} featured />
                ))}
              </div>
            </div>
          )}

          {/* Other leagues */}
          {otherLeagues.length > 0 && (
            <div>
              {!search && (
                <h2 className="text-sm font-bold text-white/40 mb-4">Autres compétitions</h2>
              )}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {otherLeagues.slice(0, 30).map((item) => (
                  <LeagueCard key={item.league.id} item={item} />
                ))}
              </div>
            </div>
          )}

          {filtered.length === 0 && <EmptyState title="Aucune ligue trouvée" icon="🏆" />}
        </div>
      )}
    </motion.div>
  );
}

function LeagueCard({ item, featured = false }) {
  const { league, country, seasons } = item;
  const currentSeason = seasons?.find((s) => s.current);

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className={`glass-card p-4 flex items-center gap-3 cursor-pointer hover:border-white/10 transition-all ${featured ? 'border-brand-500/15' : ''}`}
    >
      <Link to={`/?league=${league.id}`} className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-11 h-11 rounded-xl bg-dark-700 flex items-center justify-center p-1.5 flex-shrink-0">
          <img src={league.logo} alt={league.name} className="w-full h-full object-contain"
            onError={(e) => e.target.style.display = 'none'} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`font-semibold truncate ${featured ? 'text-white' : 'text-white/80'}`}>{league.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {country?.flag && <img src={country.flag} alt="" className="w-3.5 h-2.5 object-cover rounded-sm" />}
            <span className="text-xs text-white/30">{country?.name}</span>
            {currentSeason && <span className="text-xs text-white/20">{currentSeason.year}</span>}
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-white/20 flex-shrink-0" />
      </Link>
    </motion.div>
  );
}
