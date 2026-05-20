import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, MapPin } from 'lucide-react';
import {
  getForecast, capeRisk, severeStormRisk, windRisk,
  rainviewerUrl, blitzortungUrl, windyUrl,
} from '../../services/meteo';
import MapEmbed from '../../components/meteo/MapEmbed';

const PAGE_BG = 'radial-gradient(1200px 600px at 50% -10%, #0a1628 0%, #050a12 60%)';
const DAYS_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

const TITLES = {
  orage: 'Orage',
  pluie: 'Pluie & radar',
  foudre: 'Foudre en direct',
  vent: 'Vent & rafales',
};

function Badge({ risk, children }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-heading font-bold border ${risk.border} ${risk.bg} ${risk.text}`}>
      {children}
    </span>
  );
}

export default function MeteoDetail() {
  const [params] = useSearchParams();
  const type = params.get('type') || 'orage';
  const lat = parseFloat(params.get('lat'));
  const lon = parseFloat(params.get('lon'));
  const name = params.get('name') || 'Ville';
  const admin = params.get('admin') || '';
  const backQS = (() => { const q = new URLSearchParams(); ['lat', 'lon', 'name', 'admin'].forEach((k) => params.get(k) && q.set(k, params.get(k))); return q.toString(); })();

  const [data, setData] = useState(null);
  const needsData = type !== 'foudre';

  useEffect(() => {
    if (!needsData || !Number.isFinite(lat)) return;
    let cancelled = false;
    getForecast(lat, lon).then((d) => { if (!cancelled) setData(d); }).catch(() => {});
    return () => { cancelled = true; };
  }, [lat, lon, needsData]);

  return (
    <div className="min-h-screen px-5" style={{ background: PAGE_BG, paddingTop: 'calc(1.5rem + env(safe-area-inset-top, 0px))', paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))' }}>
      <div className="max-w-2xl mx-auto">
        <Link to={`/meteo/ville?${backQS}`} className="inline-flex items-center gap-2 text-white/40 hover:text-white/70 text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" /> {name}
        </Link>

        <div className="mt-4 mb-5 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-sky-400" />
          <h1 className="font-display text-3xl text-white tracking-wide leading-none">{TITLES[type] || 'Détail'}</h1>
          <span className="text-sm text-white/35">· {name}{admin ? ` (${admin})` : ''}</span>
        </div>

        {type === 'foudre' && <FoudreView lat={lat} lon={lon} />}
        {type === 'orage' && <OrageView lat={lat} lon={lon} data={data} />}
        {type === 'pluie' && <PluieView lat={lat} lon={lon} data={data} />}
        {type === 'vent' && <VentView lat={lat} lon={lon} data={data} />}
      </div>
    </div>
  );
}

function FoudreView({ lat, lon }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-white/50">Carte des impacts de foudre en temps réel (réseau Blitzortung), centrée sur la ville.</p>
      <MapEmbed title="Impacts foudre en direct" src={blitzortungUrl(lat, lon, 8)} height={420} note="Blitzortung · live" />
    </div>
  );
}

function maxCape(data) {
  const h = data?.hourly || {};
  const today = data?.daily?.time?.[0];
  let max = 0;
  (h.time || []).forEach((t, i) => { if (today && t.startsWith(today) && h.cape?.[i] != null) max = Math.max(max, h.cape[i]); });
  return max;
}

function OrageView({ lat, lon, data }) {
  const cape = data ? maxCape(data) : 0;
  const code = data?.daily?.weather_code?.[0];
  const risk = capeRisk(cape);
  const severe = severeStormRisk(cape, code);
  return (
    <div className="space-y-4">
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/55 font-heading">Risque orageux</span>
          <Badge risk={risk}>{risk.label}</Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/55 font-heading">Risque d'orage violent</span>
          <Badge risk={severe}>{severe.label}</Badge>
        </div>
        <div className="pt-2 border-t border-white/[0.05] flex items-baseline gap-2">
          <span className="font-display text-3xl text-white">{Math.round(cape)}</span>
          <span className="text-sm text-white/40">J/kg de CAPE (énergie convective max aujourd'hui)</span>
        </div>
      </div>
      <MapEmbed title="Énergie orageuse (CAPE) · Windy" src={windyUrl(lat, lon, 'cape')} height={380} />
    </div>
  );
}

function PluieView({ lat, lon, data }) {
  const daily = data?.daily || {};
  const hourly = data?.hourly || {};
  const today = daily.time?.[0];
  const hourRows = (hourly.time || [])
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => today && t.startsWith(today))
    .map(({ t, i }) => ({ h: new Date(t).getHours(), prob: hourly.precipitation_probability?.[i], mm: hourly.precipitation?.[i] }));
  const maxMm = Math.max(0.1, ...(daily.precipitation_sum || [0]));

  return (
    <div className="space-y-4">
      <MapEmbed title="Radar pluie en direct · RainViewer" src={rainviewerUrl(lat, lon, 8)} height={400} note="live" />

      {(daily.time || []).length > 0 && (
        <div className="glass-card p-4">
          <p className="text-xs font-heading font-bold uppercase tracking-wider text-white/40 mb-3">Cumuls de pluie · 14 jours</p>
          <div className="space-y-1.5">
            {daily.time.map((t, i) => {
              const d = new Date(t + 'T12:00:00');
              const mm = daily.precipitation_sum?.[i] ?? 0;
              const prob = daily.precipitation_probability_max?.[i] ?? 0;
              return (
                <div key={t} className="flex items-center gap-2 text-xs">
                  <span className="w-16 text-white/50 font-heading">{i === 0 ? "Auj." : `${DAYS_FR[d.getDay()]} ${d.getDate()}`}</span>
                  <div className="flex-1 h-3 bg-white/[0.05] rounded-full overflow-hidden">
                    <div className="h-full bg-sky-500/70 rounded-full" style={{ width: `${Math.min(100, (mm / maxMm) * 100)}%` }} />
                  </div>
                  <span className="w-12 text-right text-sky-400/80 font-mono">{prob}%</span>
                  <span className="w-14 text-right text-white/70 font-mono">{mm.toFixed(1)}mm</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {hourRows.length > 0 && (
        <div className="glass-card p-4">
          <p className="text-xs font-heading font-bold uppercase tracking-wider text-white/40 mb-3">Aujourd'hui · heure par heure</p>
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {hourRows.map((r) => (
              <div key={r.h} className="flex flex-col items-center gap-1 flex-shrink-0 w-11">
                <span className="text-[10px] text-white/40 font-mono">{r.h}h</span>
                <span className="text-xs text-sky-400 font-mono">{r.prob ?? 0}%</span>
                <span className="text-[10px] text-white/40 font-mono">{(r.mm ?? 0).toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function VentView({ lat, lon, data }) {
  const cur = data?.current || {};
  const daily = data?.daily || {};
  const gustMax = daily.wind_gusts_10m_max?.[0] ?? cur.wind_gusts_10m ?? 0;
  const risk = windRisk(gustMax);
  return (
    <div className="space-y-4">
      <div className="glass-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/55 font-heading">Niveau de risque vent</span>
          <Badge risk={risk}>{risk.label}</Badge>
        </div>
        <div className="flex items-baseline gap-2 pt-2 border-t border-white/[0.05]">
          <span className="font-display text-3xl text-white">{Math.round(cur.wind_speed_10m ?? 0)}</span>
          <span className="text-white/40">km/h</span>
          <span className="text-white/35 ml-2">rafales <span className="text-white/70 font-semibold">{Math.round(gustMax)}</span> km/h</span>
        </div>
      </div>
      <MapEmbed title="Vent · Windy" src={windyUrl(lat, lon, 'wind')} height={380} />
    </div>
  );
}
