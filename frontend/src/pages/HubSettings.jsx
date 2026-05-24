import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Bell, Target, CloudSun } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import {
  isNotificationsEnabled, enablePushNotifications, disablePushNotifications,
  NOTIF_TYPES, getNotifPrefs, setNotifPref, syncFavoriteTeamsToBackend,
} from '../services/pushNotifications';

const PAGE_BG = 'radial-gradient(120% 80% at 50% 0%, #10213f 0%, #0a1326 45%, #060a14 100%)';
const isNative = Capacitor.isNativePlatform();
// Which notif types belong to MimiMétéo; everything else is Pronos Foot.
const METEO_KEYS = new Set(['weather']);

function Toggle({ on, onClick, accent = 'brand' }) {
  const bg = on ? (accent === 'sky' ? 'bg-sky-500/60' : 'bg-brand-500/60') : 'bg-white/10';
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

  const footTypes = NOTIF_TYPES.filter((t) => !METEO_KEYS.has(t.key));
  const meteoTypes = NOTIF_TYPES.filter((t) => METEO_KEYS.has(t.key));

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
                <p className="text-[11px] text-white/30 italic px-1">Les changements s'appliquent au prochain scan (≤ 5 min).</p>
              </>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}
