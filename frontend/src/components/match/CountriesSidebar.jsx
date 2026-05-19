import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ChevronDown, ChevronRight, Pin, Globe2, X } from 'lucide-react';
import clsx from 'clsx';
import { leaguesApi } from '../../services/api';

// The 10 pinned leagues that show up at the top of the sidebar — mirrors
// the priority order used by groupByLeague in Matchs and the standings
// picker. Keep IDs in sync with backend's `topIds` in apiFootball.js if
// possible. Flags are emoji because they render at any size.
const PINNED_LEAGUES = [
  { id: 78,  name: 'Bundesliga',         flag: '🇩🇪', country: 'Germany' },
  { id: 39,  name: 'Premier League',     flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', country: 'England' },
  { id: 140, name: 'La Liga',            flag: '🇪🇸', country: 'Spain' },
  { id: 61,  name: 'Ligue 1',            flag: '🇫🇷', country: 'France' },
  { id: 62,  name: 'Ligue 2',            flag: '🇫🇷', country: 'France' },
  { id: 66,  name: 'Coupe de France',    flag: '🇫🇷', country: 'France' },
  { id: 135, name: 'Serie A',            flag: '🇮🇹', country: 'Italy' },
  { id: 88,  name: 'Eredivisie',         flag: '🇳🇱', country: 'Netherlands' },
  { id: 2,   name: 'Ligue des Champions',flag: '🏆', country: 'World' },
  { id: 3,   name: 'Ligue Europa',       flag: '🇪🇺', country: 'World' },
];

/**
 * Right sidebar showing pinned top-10 leagues + collapsible list of all
 * countries with their leagues. Clicking a league fires onPickLeague with
 * { id, name, logo, season } so the parent (Matchs) can filter the central
 * area to that league. Clicking a country toggles its expansion.
 *
 * The full leagues list is fetched once on mount and cached in component
 * state. Render cost stays bounded: ~200 country rows + ~1500 leagues, but
 * only the expanded country renders its children — collapsed countries are
 * just a single button row.
 */
export default function CountriesSidebar({
  selectedLeagueId = null,
  onPickLeague,
  onClearFilter,
  className = '',
}) {
  const [allLeagues, setAllLeagues] = useState(null); // raw response
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [expandedCountry, setExpandedCountry] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    leaguesApi.getAll({ current: 'true' })
      .then((data) => {
        if (cancelled) return;
        setAllLeagues(data?.response || []);
      })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Group { Country → leagues[] } once per data change. Filtered by search.
  const countriesGrouped = useMemo(() => {
    if (!allLeagues) return [];
    const map = new Map();
    const q = search.trim().toLowerCase();

    for (const item of allLeagues) {
      const country = item.country?.name;
      const league = item.league;
      if (!country || !league?.id) continue;
      const currentSeason = item.seasons?.find((s) => s.current);
      if (!currentSeason) continue;

      // Search match: country name OR any league name OR direct equality
      if (q) {
        const inCountry = country.toLowerCase().includes(q);
        const inLeague = league.name?.toLowerCase().includes(q);
        if (!inCountry && !inLeague) continue;
      }

      if (!map.has(country)) {
        map.set(country, {
          name: country,
          flag: item.country?.flag,
          code: item.country?.code,
          leagues: [],
        });
      }
      map.get(country).leagues.push({
        id: league.id,
        name: league.name,
        logo: league.logo,
        type: league.type,
        season: currentSeason.year,
      });
    }

    // Sort: World first (continental + UEFA/FIFA), then alphabetical
    const list = Array.from(map.values());
    list.forEach((c) => c.leagues.sort((a, b) => {
      // Leagues before Cups, then by name
      if (a.type !== b.type) return a.type === 'League' ? -1 : 1;
      return a.name.localeCompare(b.name);
    }));
    list.sort((a, b) => {
      if (a.name === 'World') return -1;
      if (b.name === 'World') return 1;
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [allLeagues, search]);

  // If the user typed in the search box, auto-expand every matching country
  // so they can see what's inside without an extra click.
  const isExpanded = (country) => {
    if (search.trim()) return true;
    return expandedCountry === country;
  };

  const handlePinnedClick = (l) => {
    onPickLeague?.({
      id: l.id,
      name: l.name,
      logo: null, // pinned uses emoji flag — let StandingsView fall back to flag
      flag: l.flag,
      season: new Date().getFullYear() - 1, // Aug-Dec → use current calendar yr -1 for European seasons
    });
  };

  const handleLeagueClick = (league) => {
    onPickLeague?.({
      id: league.id,
      name: league.name,
      logo: league.logo,
      season: league.season,
    });
  };

  return (
    <aside className={clsx('flex flex-col gap-4 text-sm', className)}>
      {/* Pinned leagues — top section */}
      <div className="glass-card p-3 space-y-2">
        <div className="flex items-center gap-2 px-1">
          <Pin className="w-3.5 h-3.5 text-gold-400" />
          <span className="text-[11px] font-heading font-bold uppercase tracking-wider text-white/55">Ligues épinglées</span>
        </div>
        <div className="space-y-0.5">
          {PINNED_LEAGUES.map((l) => {
            const active = selectedLeagueId === l.id;
            return (
              <button
                key={l.id}
                onClick={() => handlePinnedClick(l)}
                className={clsx(
                  'w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left transition-colors',
                  active ? 'bg-brand-500/15 text-brand-300' : 'text-white/70 hover:bg-white/[0.04] hover:text-white'
                )}
              >
                <span className="text-base leading-none w-5 text-center flex-shrink-0">{l.flag}</span>
                <span className="text-xs font-heading font-semibold truncate flex-1">{l.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active filter chip — clear button when a non-pinned league is selected */}
      {selectedLeagueId && (
        <button
          onClick={onClearFilter}
          className="glass-card p-2.5 flex items-center justify-between hover:border-brand-500/30 transition-colors text-left"
        >
          <span className="text-xs text-white/50 font-heading">Filtre actif</span>
          <X className="w-3.5 h-3.5 text-white/40" />
        </button>
      )}

      {/* Countries section */}
      <div className="glass-card p-3 space-y-2 max-h-[60vh] overflow-y-auto overscroll-contain">
        <div className="flex items-center gap-2 px-1 sticky top-0 bg-dark-900/95 backdrop-blur pb-2 -mx-1 px-1 z-10">
          <Globe2 className="w-3.5 h-3.5 text-white/45" />
          <span className="text-[11px] font-heading font-bold uppercase tracking-wider text-white/55">Pays</span>
          {countriesGrouped.length > 0 && (
            <span className="text-[10px] text-white/30 font-mono ml-auto">{countriesGrouped.length}</span>
          )}
        </div>

        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher pays / ligue..."
            className="w-full bg-dark-800 border border-white/[0.08] rounded-lg pl-7 pr-2 py-1.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-brand-500/40"
          />
        </div>

        {loading ? (
          <div className="space-y-1.5 px-1 py-2">
            {[...Array(8)].map((_, i) => <div key={i} className="h-6 skeleton rounded" />)}
          </div>
        ) : error ? (
          <p className="text-xs text-danger/70 px-1 py-2">Erreur chargement: {error}</p>
        ) : countriesGrouped.length === 0 ? (
          <p className="text-xs text-white/30 px-1 py-2 italic">Aucun résultat</p>
        ) : (
          <div className="space-y-0.5">
            {countriesGrouped.map((country) => {
              const expanded = isExpanded(country.name);
              return (
                <div key={country.name}>
                  <button
                    onClick={() => setExpandedCountry(expanded ? null : country.name)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.04] transition-colors text-left"
                  >
                    {country.flag ? (
                      <img src={country.flag} alt="" className="w-4 h-3 object-cover rounded-sm flex-shrink-0"
                        onError={(e) => e.target.style.display = 'none'} />
                    ) : (
                      <span className="w-4 h-3 flex-shrink-0">🌍</span>
                    )}
                    <span className="text-xs font-heading text-white/70 truncate flex-1">{country.name}</span>
                    <span className="text-[10px] text-white/25 font-mono">{country.leagues.length}</span>
                    {expanded
                      ? <ChevronDown className="w-3 h-3 text-white/30 flex-shrink-0" />
                      : <ChevronRight className="w-3 h-3 text-white/30 flex-shrink-0" />
                    }
                  </button>

                  <AnimatePresence initial={false}>
                    {expanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden"
                      >
                        <div className="ml-3 pl-2 border-l border-white/[0.06] py-0.5 space-y-0.5">
                          {country.leagues.map((l) => {
                            const active = selectedLeagueId === l.id;
                            return (
                              <button
                                key={l.id}
                                onClick={() => handleLeagueClick(l)}
                                className={clsx(
                                  'w-full flex items-center gap-2 px-2 py-1 rounded-md text-left transition-colors',
                                  active ? 'bg-brand-500/15 text-brand-300' : 'text-white/55 hover:bg-white/[0.04] hover:text-white/85'
                                )}
                              >
                                {l.logo ? (
                                  <img src={l.logo} alt="" className="w-3.5 h-3.5 object-contain flex-shrink-0"
                                    onError={(e) => e.target.style.display = 'none'} />
                                ) : (
                                  <span className="w-3.5 h-3.5 text-[10px] text-white/30 flex items-center justify-center">⚽</span>
                                )}
                                <span className="text-[11px] font-heading truncate flex-1">{l.name}</span>
                                {l.type === 'Cup' && (
                                  <span className="text-[9px] text-white/30 font-mono">cup</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
