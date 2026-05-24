import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Bell, Target, CloudSun, Waves, MapPin, X } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import {
  isNotificationsEnabled, enablePushNotifications, disablePushNotifications,
  NOTIF_TYPES, getNotifPrefs, setNotifPref, syncFavoriteTeamsToBackend,
  getSeismeSettings, setSeismeSettings,
} from '../services/pushNotifications';
import { searchCity } from '../services/meteo';

const PAGE_BG = 'radial-gradient(120% 80% at 50% 0%, #10213f 0%, #0a1326 45%, #060a14 100%)';
const isNative = Capacitor.isNativePlatform();
// Notif types grouped by app; everything not météo/séisme is Pronos Foot.
const METEO_KEYS = new Set(['weather', 'vigilance']);
const SEISME_KEYS = new Set(['seisme']);

function Toggle({ on, onClick, accent = 'brand' }) {
  const onBg = { sky: 'bg-sky-500/60', fuchsia: 'bg-fuchsia-500/60', brand: 'bg-brand-500/60' }[accent] || 'bg-brand-500/60';
  const bg = on ? onBg : 'bg-white/10';
  return (
    <button onClick={onClick} aria-pressed={on} className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${bg}`}>
      <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${on ? 'left-[1.375rem]' : 'left-0.5'}`} />
    </button>
  );
}

function NotifGroup({ title, icon: Icon, color, types, prefs, onToggle, accent }) {
  if (types.length === 0) return null;
  return (
    <section className="rounded-2xl p-5 bg-white/[0.04] border border-white/10 backdrop-blur-md">
      <p className="flex items-center gap-2 text-[11px] font-heading font-bold tracking-[2px] mb-3" style={{ color }}>
        <Icon className="w-4 h-4" /> {title}
      </p>
      <div className="space-y-1">
        {types.map((t) => (
          <div key={t.key} className="flex items-center justify-between gap-3 py-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-heading font-semibold text-white/85">{t.label}</p>
              <p className="text-xs text-white/40 leading-snug">{t.desc}</p>
            </div>
            <Toggle on={!!prefs[t.key]} onClick={() => onToggle(t.key)} accent={accent} />
          </div>
        ))}
      </div>
    </section>
  );
}

// Extra MimiSéisme controls: global magnitude threshold + optional proximity zone.
function SeismeExtra() {
  const [s, setS] = useState(() => getSeismeSettings());
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  const update = (patch) => {
    const next = setSeismeSettings(patch);
    setS({ ...next });
    syncFavoriteTeamsToBackend().catch(() => {});
  };

  const onSearch = async (q) => {
    setQuery(q);
    if (q.trim().length < 2) { setResults([]); return; }
    try { setResults(await searchCity(q)); } catch { setResults([]); }
  };
  const pickCity = (c) => {
    update({ zoneLat: c.lat, zoneLon: c.lon, zoneName: c.name, zoneRadius: s.zoneRadius > 0 ? s.zoneRadius : 300 });
    setQuery(''); setResults([]);
  };
  const clearZone = () => update({ zoneLat: null, zoneLon: null, zoneName: '', zoneRadius: 0 });

  return (
    <section className="rounded-2xl p-5 bg-white/[0.04] border border-white/10 backdrop-blur-md space-y-4">
      <p className="text-[11px] font-heading font-bold tracking-[2px] text-fuchsia-300/80">RÉGLAGES SÉISME</p>

      {/* Magnitude minimale (alerte mondiale) */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-white/80 font-heading">Alerte mondiale dès</span>
          <span className="text-sm font-display text-fuchsia-300">M ≥ {s.minMag.toFixed(1)}</span>
        </div>
        <input
          type="range" min="3" max="7" step="0.5" value={s.minMag}
          onChange={(e) => update({ minMag: parseFloat(e.target.value) })}
          className="w-full accent-fuchsia-500"
        />
        <p className="text-[11px] text-white/35">Notifie tout séisme dans le monde au-dessus de ce seuil.</p>
      </div>

      {/* Zone de proximité */}
      <div className="pt-2 border-t border-white/[0.06]">
        <p className="text-sm text-white/80 font-heading mb-2">Zone de proximité (optionnel)</p>
        {s.zoneLat != null ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-sm text-fuchsia-200"><MapPin className="w-4 h-4" /> {s.zoneName || 'Zone définie'}</span>
              <button onClick={clearZone} className="text-white/40 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/60">Rayon</span>
              <span className="text-sm font-display text-fuchsia-300">{s.zoneRadius} km</span>
            </div>
            <input
              type="range" min="50" max="1000" step="50" value={s.zoneRadius || 300}
              onChange={(e) => update({ zoneRadius: parseInt(e.target.value, 10) })}
              className="w-full accent-fuchsia-500"
            />
            <p className="text-[11px] text-white/35">Notifie tout séisme (M ≥ 2.5) dans ce rayon, même sous le seuil mondial.</p>
          </div>
        ) : (
          <div className="relative">
            <input
              value={query}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Rechercher une ville…"
              className="w-full bg-dark-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-fuchsia-500/50"
            />
            {results.length > 0 && (
              <div className="absolute z-10 left-0 right-0 mt-1 rounded-lg border border-white/10 bg-dark-900 overflow-hidden max-h-52 overflow-y-auto">
                {results.slice(0, 6).map((c, i) => (
                  <button key={i} onClick={() => pickCity(c)} className="w-full text-left px-3 py-2 text-sm text-white/80 hover:bg-white/[0.06]">
                    {c.name}{c.admin ? <span className="text-white/40"> · {c.admin}</span> : ''}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export default function HubSettings() {
  const [enabled, setEnabled] = useState(() => isNotificationsEnabled());
  const [prefs, setPrefs] = useState(() => getNotifPrefs());
  const [busy, setBusy] = useState(false);

  const toggleMaster = async () => {
    setBusy(true);
    try {
      if (enabled) { await disablePushNotifications(); setEnabled(false); }
      else { const r = await enablePushNotifications(); if (r?.ok) setEnabled(true); }
    } finally { setBusy(false); }
  };

  const toggleType = (key) => {
    const next = setNotifPref(key, !prefs[key]);
    setPrefs({ ...next });
    syncFavoriteTeamsToBackend().catch(() => {});
  };

  const footTypes = NOTIF_TYPES.filter((t) => !METEO_KEYS.has(t.key) && !SEISME_KEYS.has(t.key));
  const meteoTypes = NOTIF_TYPES.filter((t) => METEO_KEYS.has(t.key));
  const seismeTypes = NOTIF_TYPES.filter((t) => SEISME_KEYS.has(t.key));

  return (
    <div className="min-h-screen px-4 pb-24 pt-6" style={{ background: PAGE_BG }}>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 text-white/50 hover:text-white transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" /> Accueil
          </Link>
          <h1 className="text-lg font-heading font-bold text-white">Réglages · Notifications</h1>
        </div>

        {!isNative ? (
          <section className="rounded-2xl p-5 bg-white/[0.04] border border-white/10 backdrop-blur-md">
            <p className="text-sm text-white/60 leading-relaxed">
              Les notifications push sont disponibles uniquement sur l'application Android.
            </p>
          </section>
        ) : (
          <>
            {/* Master switch */}
            <section className="rounded-2xl p-5 bg-white/[0.04] border border-white/10 backdrop-blur-md flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="flex items-center gap-2 text-sm font-heading font-bold text-white/90"><Bell className="w-4 h-4 text-brand-400" /> Notifications</p>
                <p className="text-xs text-white/45 leading-snug">{enabled ? 'Activées sur cet appareil.' : 'Désactivées — active-les pour recevoir les alertes.'}</p>
              </div>
              <Toggle on={enabled} onClick={busy ? () => {} : toggleMaster} />
            </section>

            {enabled && (
              <>
                <NotifGroup title="PRONOS FOOT" icon={Target} color="#34d399" accent="brand" types={footTypes} prefs={prefs} onToggle={toggleType} />
                <NotifGroup title="MIMIMÉTÉO" icon={CloudSun} color="#38bdf8" accent="sky" types={meteoTypes} prefs={prefs} onToggle={toggleType} />
                <NotifGroup title="MIMISÉISME" icon={Waves} color="#e879f9" accent="fuchsia" types={seismeTypes} prefs={prefs} onToggle={toggleType} />
                {prefs.seisme && <SeismeExtra />}
                <p className="text-[11px] text-white/30 italic px-1">Les changements s'appliquent au prochain scan (≤ 5 min).</p>
              </>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}
