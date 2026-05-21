import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Search, MapPin, Navigation, Clock, Loader2, ShieldAlert, ExternalLink, CloudRain, Zap, Wind, Snowflake } from 'lucide-react';
import { searchCity, getRecentCities, addRecentCity, blitzortungUrl, windyUrl, VIGILANCE_URL } from '../../services/meteo';
import MapEmbed from '../../components/meteo/MapEmbed';

// Clear-sky atmosphere for the landing (no city selected yet).
const PAGE_BG = 'radial-gradient(120% 80% at 50% 0%, #0f3a63 0%, #0a2238 45%, #06111d 100%)';

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
    const params = new URLSearchParams({ lat: String(city.lat), lon: String(city.lon), name: city.name });
    if (city.admin) params.set('admin', city.admin);
    navigate(`/meteo/ville?${params.toString()}`);
  };

  const useMyLocation = () => {
    setGeoError(null);
    if (!navigator.geolocation) { setGeoError('Géolocalisation non disponible'); return; }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setGeoLoading(false); pick({ lat: pos.coords.latitude, lon: pos.coords.longitude, name: 'Ma position', admin: '' }); },
      () => { setGeoLoading(false); setGeoError('Position refusée ou indisponible'); },
      { timeout: 10000, enableHighAccuracy: false },
    );
  };

  const glass = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' };

  return (
    <div className="min-h-screen relative" style={{ background: PAGE_BG, paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))' }}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[460px] rounded-full blur-3xl" style={{ background: 'rgba(56,189,248,0.22)' }} />
      </div>

      <div className="relative max-w-7xl mx-auto px-4" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))' }}>
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-white/55 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> SiteDesFoufous
        </Link>

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="mt-8 mb-6 max-w-xl">
          <h1 className="font-display text-5xl text-white tracking-wide leading-none">
            Mimi<span className="text-sky-400">Météo</span>
          </h1>
          <p className="text-sm text-white/45 font-heading font-medium mt-2">Météo, orages, pluie et foudre en direct — partout en France.</p>
        </motion.div>

        {/* Search + geoloc */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="max-w-xl">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35" />
            {searching && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-sky-400 animate-spin" />}
            <input
              autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher une ville…"
              className="w-full rounded-2xl pl-11 pr-11 py-3.5 text-base text-white placeholder:text-white/30 focus:outline-none focus:border-sky-500/50 transition-all backdrop-blur-md"
              style={glass}
            />
          </div>

          <button onClick={useMyLocation} disabled={geoLoading}
            className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-heading font-semibold text-sky-300 hover:bg-sky-500/15 transition-all disabled:opacity-50 backdrop-blur-md"
            style={{ background: 'rgba(56,189,248,0.10)', border: '1px solid rgba(56,189,248,0.30)' }}>
            {geoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />} Utiliser ma position
          </button>
          {geoError && <p className="text-xs text-danger/80 mt-2 text-center">{geoError}</p>}

          {results.length > 0 && (
            <div className="mt-3 rounded-2xl overflow-hidden backdrop-blur-md" style={glass}>
              {results.map((c) => (
                <button key={c.id} onClick={() => pick(c)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.06] transition-colors text-left border-b border-white/[0.05] last:border-b-0">
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

          {results.length === 0 && recent.length > 0 && (
            <div className="mt-5">
              <div className="flex items-center gap-2 mb-2 px-1">
                <Clock className="w-3.5 h-3.5 text-white/35" />
                <span className="text-[11px] font-heading font-bold uppercase tracking-wider text-white/40">Récentes</span>
              </div>
              <div className="rounded-2xl overflow-hidden backdrop-blur-md" style={glass}>
                {recent.map((c, i) => (
                  <button key={`${c.lat}-${c.lon}-${i}`} onClick={() => pick(c)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.06] transition-colors text-left border-b border-white/[0.05] last:border-b-0">
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
        </motion.div>

        {/* Live maps + vigilance */}
        {results.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="mt-9">
            <a href={VIGILANCE_URL} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-2xl p-4 mb-5 hover:border-amber-500/40 transition-colors backdrop-blur-md max-w-xl"
              style={{ background: 'linear-gradient(160deg, rgba(245,158,11,0.12), rgba(245,158,11,0.03))', border: '1px solid rgba(245,158,11,0.30)' }}>
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-heading font-semibold text-white/90">Vigilance Météo-France</p>
                <p className="text-xs text-white/40">Carte officielle des vigilances en cours</p>
              </div>
              <ExternalLink className="w-4 h-4 text-white/30 flex-shrink-0" />
            </a>

            <p className="text-[11px] font-heading font-bold uppercase tracking-[2px] text-white/45 mb-2.5">En direct · France</p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-1.5 mb-2 px-1 text-sky-300">
                  <CloudRain className="w-3.5 h-3.5" />
                  <span className="text-[11px] font-heading font-bold uppercase tracking-wider">Radar pluie</span>
                </div>
                <MapEmbed src={windyUrl(46.6, 2.4, 'rain', 5)} height={520} note="Windy · live" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-2 px-1 text-emerald-300">
                  <Wind className="w-3.5 h-3.5" />
                  <span className="text-[11px] font-heading font-bold uppercase tracking-wider">Vent</span>
                </div>
                <MapEmbed src={windyUrl(46.6, 2.4, 'wind', 5)} height={520} note="Windy · live" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-2 px-1 text-cyan-200">
                  <Snowflake className="w-3.5 h-3.5" />
                  <span className="text-[11px] font-heading font-bold uppercase tracking-wider">Neige</span>
                </div>
                <MapEmbed src={windyUrl(46.6, 2.4, 'snowAccu', 5)} height={520} note="Windy · accumulation" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-2 px-1 text-amber-300">
                  <Zap className="w-3.5 h-3.5" />
                  <span className="text-[11px] font-heading font-bold uppercase tracking-wider">Impacts foudre</span>
                </div>
                <MapEmbed src={blitzortungUrl(46.6, 2.4, 5)} height={520} note="Blitzortung · live" />
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
