import { useEffect, useRef, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Settings, Waves } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getEarthquakes, magColor, magLabel, timeAgo } from '../services/seismes';

const PAGE_BG = 'radial-gradient(120% 80% at 50% 0%, #2a1430 0%, #160e1f 45%, #0a0610 100%)';
const MAG_FILTERS = [
  { v: 0, label: 'Tous' },
  { v: 2.5, label: '≥ 2.5' },
  { v: 4, label: '≥ 4' },
  { v: 5, label: '≥ 5' },
  { v: 6, label: '≥ 6' },
];

export default function Seismes() {
  const [quakes, setQuakes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [minMag, setMinMag] = useState(0);
  const mapEl = useRef(null);
  const mapObj = useRef(null);
  const layerRef = useRef(null);

  const load = () => {
    setLoading(true);
    getEarthquakes().then(setQuakes).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, []);

  const filtered = useMemo(() => quakes.filter((q) => q.mag >= minMag), [quakes, minMag]);

  // Init Leaflet once.
  useEffect(() => {
    if (mapObj.current || !mapEl.current) return undefined;
    const map = L.map(mapEl.current, { center: [25, 10], zoom: 2, worldCopyJump: true, zoomControl: true });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap · © CARTO', maxZoom: 18,
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapObj.current = map;
    return () => { map.remove(); mapObj.current = null; layerRef.current = null; };
  }, []);

  // Redraw markers when the filtered set changes.
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.clearLayers();
    for (const q of filtered) {
      if (q.lat == null || q.lon == null) continue;
      const col = magColor(q.mag);
      const m = L.circleMarker([q.lat, q.lon], {
        radius: Math.max(4, q.mag * 2.2), color: col, weight: 1, fillColor: col, fillOpacity: 0.5,
      });
      m.bindPopup(
        `<b>M${q.mag.toFixed(1)}</b> · ${q.place}<br>Prof. ${q.depth != null ? Math.round(q.depth) : '?'} km · ${q.source}${q.tsunami ? '<br>⚠️ Tsunami' : ''}`,
      );
      m.addTo(layer);
    }
  }, [filtered]);

  const focus = (q) => {
    if (mapObj.current && q.lat != null) mapObj.current.flyTo([q.lat, q.lon], 6, { duration: 0.6 });
  };

  return (
    <div className="min-h-screen pb-24" style={{ background: PAGE_BG }}>
      <div className="max-w-5xl mx-auto px-4 pt-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/" className="flex items-center gap-2 text-white/50 hover:text-white transition-colors text-sm flex-shrink-0">
              <ArrowLeft className="w-4 h-4" /> Accueil
            </Link>
            <h1 className="text-lg font-heading font-bold text-white flex items-center gap-2 truncate">
              <Waves className="w-5 h-5 text-fuchsia-400" /> MimiSéisme
            </h1>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={load} title="Rafraîchir" className="w-9 h-9 rounded-lg border border-white/10 bg-white/[0.04] flex items-center justify-center text-white/50 hover:text-white transition-all">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <Link to="/reglages" title="Réglages notifications" className="w-9 h-9 rounded-lg border border-white/10 bg-white/[0.04] flex items-center justify-center text-white/50 hover:text-white transition-all">
              <Settings className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Magnitude filter */}
        <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.03] p-0.5 mb-4">
          {MAG_FILTERS.map((f) => (
            <button
              key={f.v}
              onClick={() => setMinMag(f.v)}
              className={`px-3 py-1.5 rounded-lg text-sm font-heading font-semibold transition-colors ${minMag === f.v ? 'bg-fuchsia-500/30 text-fuchsia-200' : 'text-white/50 hover:text-white/80'}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Map */}
        <div ref={mapEl} className="w-full rounded-2xl overflow-hidden border border-white/10 mb-5" style={{ height: 320, background: '#0b1220' }} />

        {/* List */}
        <p className="text-[11px] font-heading font-bold tracking-[2px] text-white/45 mb-2">
          {filtered.length} SÉISMES · 24 H
        </p>
        <div className="space-y-1.5">
          {filtered.slice(0, 100).map((q) => (
            <button
              key={q.id}
              onClick={() => focus(q)}
              className="w-full flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06] px-3 py-2.5 text-left transition-colors"
            >
              <div
                className="w-11 h-11 rounded-xl flex flex-col items-center justify-center flex-shrink-0 font-display"
                style={{ background: `${magColor(q.mag)}22`, color: magColor(q.mag) }}
              >
                <span className="text-base leading-none">{q.mag.toFixed(1)}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-heading font-semibold text-white/90 truncate">
                  {q.place} {q.tsunami && <span className="text-red-400">⚠️ Tsunami</span>}
                </p>
                <p className="text-xs text-white/45">
                  {magLabel(q.mag)} · Prof. {q.depth != null ? Math.round(q.depth) : '?'} km · {q.source} · {timeAgo(q.time)}
                </p>
              </div>
            </button>
          ))}
          {!loading && filtered.length === 0 && (
            <p className="text-sm text-white/40 py-6 text-center">Aucun séisme pour ce filtre.</p>
          )}
        </div>
      </div>
    </div>
  );
}
