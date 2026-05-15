import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { motion } from 'framer-motion';
import { Settings as SettingsIcon, SlidersHorizontal, User, Cloud, LogOut, Loader2, CheckCircle2, Bell, BellOff } from 'lucide-react';
import clsx from 'clsx';
import { useAuthStore, signIn, signUp, signOut, pullFromCloud, pushToCloud } from '../services/cloudSync';
import { isNotificationsEnabled, enablePushNotifications, disablePushNotifications } from '../services/pushNotifications';

const TABS = [
  { id: 'general', label: 'Paramètres généraux', icon: SlidersHorizontal },
  { id: 'account', label: 'Compte', icon: User },
];

export default function Settings() {
  const [tab, setTab] = useState('general');

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto space-y-6"
    >
      <div>
        <h1 className="font-display text-4xl text-white tracking-wide leading-none mb-1 flex items-center gap-2">
          <SettingsIcon className="w-8 h-8 text-brand-400" />
          Paramètres
        </h1>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-heading font-semibold border transition-all whitespace-nowrap',
              tab === id
                ? 'bg-brand-500/15 border-brand-500/35 text-brand-400'
                : 'border-white/[0.08] text-white/35 hover:text-white/60'
            )}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {tab === 'general' && <GeneralTab />}

      {tab === 'account' && <AccountTab />}
    </motion.div>
  );
}

function GeneralTab() {
  const isNative = Capacitor.isNativePlatform();
  const [notifsEnabled, setNotifsEnabled] = useState(() => isNotificationsEnabled());
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  // Re-read on mount in case Settings was opened after the App.jsx
  // init flow already toggled state.
  useEffect(() => { setNotifsEnabled(isNotificationsEnabled()); }, []);

  const onToggle = async () => {
    if (busy) return;
    setBusy(true);
    setStatusMsg(null);
    try {
      if (notifsEnabled) {
        await disablePushNotifications();
        setNotifsEnabled(false);
        setStatusMsg({ ok: true, text: 'Notifications désactivées' });
      } else {
        const r = await enablePushNotifications();
        if (r?.ok) {
          setNotifsEnabled(true);
          setStatusMsg({ ok: true, text: 'Notifications activées' });
        } else {
          setStatusMsg({ ok: false, text: r?.reason === 'permission-denied'
            ? 'Permission refusée — autorise les notifications dans les réglages Android'
            : `Activation impossible (${r?.reason || 'erreur'})` });
        }
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="glass-card p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="text-base font-heading font-bold text-white flex items-center gap-2 mb-1">
            {notifsEnabled ? <Bell className="w-4 h-4 text-brand-400" /> : <BellOff className="w-4 h-4 text-white/40" />}
            Notifications value bets
          </p>
          <p className="text-xs text-white/50 leading-relaxed">
            Reçois une notif quand un nouveau value bet ≥ 5% d'edge est détecté.
            Le serveur scanne les pronostics toutes les 5 minutes en arrière-plan.
          </p>
          {!isNative && (
            <p className="text-xs text-amber-300/80 mt-2">
              Disponible uniquement sur l'app Android (pas sur la version web).
            </p>
          )}
        </div>
        <button
          onClick={onToggle}
          disabled={busy || !isNative}
          className={clsx(
            'relative w-12 h-6 rounded-full transition-colors flex-shrink-0',
            notifsEnabled ? 'bg-brand-500/60' : 'bg-white/10',
            (busy || !isNative) && 'opacity-50 cursor-not-allowed',
          )}
        >
          <div
            className={clsx(
              'absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all',
              notifsEnabled ? 'left-6' : 'left-0.5',
            )}
          />
        </button>
      </div>

      {statusMsg && (
        <p className={clsx('text-xs font-heading', statusMsg.ok ? 'text-brand-400' : 'text-danger')}>
          {statusMsg.text}
        </p>
      )}
    </section>
  );
}

function AccountTab() {
  const { user, enabled, syncing, lastSyncAt } = useAuthStore();

  if (!enabled) {
    return (
      <section className="glass-card p-6 space-y-3">
        <p className="text-white/70 text-sm font-heading">
          Le système de comptes n'est pas configuré sur cette installation.
          Tes données restent stockées localement dans ce navigateur / cette app.
        </p>
      </section>
    );
  }

  if (!user) return <SignInForm />;

  return (
    <section className="glass-card p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-brand-500/15 flex items-center justify-center">
          <User className="w-6 h-6 text-brand-400" />
        </div>
        <div>
          <p className="text-base font-heading font-bold text-white">{user.email}</p>
          <p className="text-xs text-white/40">Connecté · données synchronisées</p>
        </div>
      </div>

      <div className="px-3 py-2.5 rounded-xl bg-brand-500/[0.08] border border-brand-500/25 flex items-center gap-2">
        {syncing ? (
          <Loader2 className="w-4 h-4 text-brand-400 animate-spin flex-shrink-0" />
        ) : (
          <CheckCircle2 className="w-4 h-4 text-brand-400 flex-shrink-0" />
        )}
        <span className="text-sm text-brand-300 font-heading">
          {syncing
            ? 'Synchronisation en cours…'
            : lastSyncAt
              ? `Dernière sync : ${new Date(lastSyncAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
              : 'Synchronisation automatique active'}
        </span>
      </div>

      <p className="text-xs text-white/45 leading-relaxed">
        Tes paris, bankroll, favoris et paramètres sont sauvegardés dans le cloud. Tu peux te connecter
        avec le même compte sur un autre appareil pour retrouver toutes tes données.
      </p>

      <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-white/[0.05]">
        <button
          onClick={() => pushToCloud()}
          className="flex items-center justify-center gap-1.5 flex-1 px-3 py-2 rounded-lg border border-white/[0.08] text-sm font-heading font-semibold text-white/60 hover:text-white hover:border-white/20 transition-all"
        >
          <Cloud className="w-3.5 h-3.5" />
          Forcer une sync maintenant
        </button>
        <button
          onClick={() => signOut()}
          className="flex items-center justify-center gap-1.5 flex-1 px-3 py-2 rounded-lg border border-danger/30 text-sm font-heading font-semibold text-danger/80 hover:text-danger hover:bg-danger/10 transition-all"
        >
          <LogOut className="w-3.5 h-3.5" />
          Déconnexion
        </button>
      </div>
    </section>
  );
}

function SignInForm() {
  const [mode, setMode] = useState('signin'); // signin | signup
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      if (mode === 'signup') {
        await signUp(email, password);
        setSuccess('Compte créé. Vérifie ton email pour activer le compte.');
      } else {
        await signIn(email, password);
        // useAuthStore subscriber updates the UI automatically
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="glass-card p-6 space-y-4">
      <div>
        <p className="text-base font-heading font-bold text-white mb-1">
          {mode === 'signin' ? 'Connexion' : 'Créer un compte'}
        </p>
        <p className="text-xs text-white/45 leading-relaxed">
          Synchronise tes paris, bankroll et favoris entre tes appareils. Optionnel — tu peux continuer à utiliser l'app sans compte, tes données restent locales.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="text-xs text-white/40 font-heading mb-1 block">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="ton@email.com"
            className="w-full bg-dark-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-brand-500/50"
          />
        </div>
        <div>
          <label className="text-xs text-white/40 font-heading mb-1 block">Mot de passe</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            placeholder="6 caractères minimum"
            className="w-full bg-dark-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-brand-500/50"
          />
        </div>

        {error && <p className="text-xs text-danger font-heading">{error}</p>}
        {success && <p className="text-xs text-brand-400 font-heading">{success}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-brand-500/15 border border-brand-500/40 text-brand-400 text-sm font-heading font-semibold hover:bg-brand-500/25 transition-all disabled:opacity-40"
        >
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {mode === 'signin' ? 'Se connecter' : 'Créer le compte'}
        </button>
      </form>

      <button
        onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); setSuccess(null); }}
        className="text-xs text-white/45 hover:text-white/70 font-heading w-full text-center"
      >
        {mode === 'signin' ? "Pas encore de compte ? Créer un compte" : 'Déjà un compte ? Se connecter'}
      </button>
    </section>
  );
}
