import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Search, MapPin, Navigation, Clock, Loader2 } from 'lucide-react';
import { searchCity, getRecentCities, addRecentCity } from '../../services/meteo';

const PAGE_BG = 'radial-gradient(1200px 600px at 50% -10%, #0a1628 0%, #050a12 60%)';

export default function MeteoSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState(null);
  const [recent, setRecent] = useState(() => getRecentCities());
  const seqRef = useRef(0);

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    const seq = ++seqRef.current;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const r = await searchCity(query);
        if (seq === seqRef.current) setResults(r);
      } catch (_) {
        if (seq === seqRef.current) setResults([]);
      } finally {
        if (seq === seqRef.current) setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const pick = (city) => {
    addRecentCity(city);
    const params = new URLSearchParams({
      lat: String(city.lat), lon: String(city.lon), name: city.name,
    });
    if (city.admin) params.set('admin', city.admin);
    navigate(`/meteo/ville?${params.toString()}`);
  };

  const useMyLocation = () => {
    setGeoError(null);
    if (!navigator.geolocation) { setGeoError('Géolocalisation non disponible'); return; }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLoading(false);
        const { latitude, longitude } = pos.coords;
        pick({ lat: latitude, lon: longitude, name: 'Ma position', admin: '' });
      },
      () => { setGeoLoading(false); setGeoError('Position refusée ou indisponible'); },
      { timeout: 10000, enableHighAccuracy: false },
    );
  };

  return (
    <div className="min-h-screen px-5" style={{ background: PAGE_BG, paddingTop: 'calc(1.5rem + env(safe-area-inset-top, 0px))', paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))' }}>
      <div className="max-w-xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 text-white/40 hover:text-white/70 text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" /> SiteDesFoufous
        </Link>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-8 mb-6">
          <h1 className="font-display text-4xl text-white tracking-wide leading-none">
            Mimi<span className="text-sky-400">Météo</span>
          </h1>
          <p className="text-sm text-white/40 font-heading font-medium mt-1">Cherche ta ville pour la météo, les orages et les alertes</p>
        </motion.div>

        {/* Search box */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          {searching && <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-sky-400 animate-spin" />}
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une ville…"
            className="w-full bg-dark-800 border border-white/10 rounded-2xl pl-10 pr-10 py-3 text-base text-white placeholder:text-white/30 focus:outline-none focus:border-sky-500/50 transition-all"
          />
        </div>

        {/* Geolocation */}
        <button
          onClick={useMyLocation}
          disabled={geoLoading}
          className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl border border-sky-500/30 bg-sky-500/[0.08] text-sky-300 text-sm font-heading font-semibold hover:bg-sky-500/15 transition-all disabled:opacity-50"
        >
          {geoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
          Utiliser ma position
        </button>
        {geoError && <p className="text-xs text-danger/80 mt-2 text-center">{geoError}</p>}

        {/* Results */}
        {results.length > 0 && (
          <div className="mt-4 glass-card overflow-hidden">
            {results.map((c) => (
              <button key={c.id} onClick={() => pick(c)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.05] transition-colors text-left border-b border-white/[0.04] last:border-b-0">
                <MapPin className="w-4 h-4 text-sky-400/70 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-heading font-semibold text-white/85 truncate">{c.name}</p>
                  <p className="text-xs text-white/35 truncate">{[c.admin, c.country].filter(Boolean).join(' · ')}</p>
                </div>
                {c.postcode && <span className="text-xs text-white/25 font-mono flex-shrink-0">{c.postcode}</span>}
              </button>
            ))}
          </div>
        )}

        {/* Recent */}
        {results.length === 0 && recent.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center gap-2 mb-2 px-1">
              <Clock className="w-3.5 h-3.5 text-white/30" />
              <span className="text-[11px] font-heading font-bold uppercase tracking-wider text-white/40">Récentes</span>
            </div>
            <div className="glass-card overflow-hidden">
              {recent.map((c, i) => (
                <button key={`${c.lat}-${c.lon}-${i}`} onClick={() => pick(c)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.05] transition-colors text-left border-b border-white/[0.04] last:border-b-0">
                  <MapPin className="w-4 h-4 text-white/30 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-heading font-semibold text-white/80 truncate">{c.name}</p>
                    {c.admin && <p className="text-xs text-white/30 truncate">{c.admin}</p>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
