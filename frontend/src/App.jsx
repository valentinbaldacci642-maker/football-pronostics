import { useEffect } from 'react';
import { Routes, Route, useLocation, Navigate, Outlet } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { App as CapacitorApp } from '@capacitor/app';
import { useHistoryStore, useFavoriteTeamsStore, useFavoritesStore } from './store';
import { resolveFinishedMatches } from './utils/resolveResults';
import { initCloudSync } from './services/cloudSync';
import { initPushNotifications, syncFavoriteTeamsToBackend } from './services/pushNotifications';
import Navbar from './components/common/Navbar';
import Sidebar from './components/common/Sidebar';
import BottomNav from './components/common/BottomNav';
import PageTransition from './components/common/PageTransition';
import RateLimitBanner from './components/common/RateLimitBanner';
import Hub from './pages/Hub';
import Meteo from './pages/meteo/Meteo';
import Home from './pages/Home';
import Matchs from './pages/Matchs';
import MatchDetail from './pages/MatchDetail';
import Favorites from './pages/Favorites';
import WorldCup from './pages/WorldCup';
import Team from './pages/Team';
import Player from './pages/Player';
import History from './pages/History';
import News from './pages/News';
import Help from './pages/Help';
import ValueBets from './pages/ValueBets';
import Settings from './pages/Settings';

// Football section chrome (sidebar + navbar + bottom nav). Persists across
// football route changes; only the page content (Outlet) animates.
function FootballLayout() {
  const location = useLocation();
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 lg:ml-64">
        <Navbar />
        <RateLimitBanner />
        <main
          className="flex-1 px-4 md:px-6 lg:px-8 pb-24 lg:pb-8"
          style={{ paddingTop: 'calc(80px + env(safe-area-inset-top, 0px))' }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <PageTransition key={location.pathname}>
              <Outlet />
            </PageTransition>
          </AnimatePresence>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}

export default function App() {
  const entries = useHistoryStore((s) => s.entries);
  const resolveResult = useHistoryStore((s) => s.resolveResult);

  // Initialize cloud sync (Supabase). No-op if env vars are missing —
  // app keeps working in localStorage-only mode.
  useEffect(() => { initCloudSync(); }, []);

  // Register FCM push notifications on native (Android). Idempotent —
  // re-sending the same token is a no-op server-side. Web → skipped.
  useEffect(() => { initPushNotifications().catch(() => {}); }, []);

  // Keep the backend's per-token favorites (teams + matches) in sync so the
  // reminder notifs reflect the user's current favorites. Debounced to
  // coalesce rapid toggles. Both store subscriptions feed the same sync.
  useEffect(() => {
    let timer = null;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { syncFavoriteTeamsToBackend().catch(() => {}); }, 1500);
    };
    const unsubTeams = useFavoriteTeamsStore.subscribe(schedule);
    const unsubMatches = useFavoritesStore.subscribe(schedule);
    return () => { clearTimeout(timer); unsubTeams(); unsubMatches(); };
  }, []);

  // Backend warm-up : Render free tier endort l'instance après ~15min
  // d'inactivité, ce qui produit un cold start de 30-60s sur le premier
  // appel. On ping /health dès l'ouverture pour démarrer le réveil en
  // arrière-plan, comme ça quand l'utilisateur clique sur un match la
  // backend est déjà debout. Fire-and-forget, on n'attend pas la réponse.
  useEffect(() => {
    const base = import.meta.env.VITE_API_URL || 'https://football-pronostics-api-0xhw.onrender.com';
    fetch(`${base}/health`, { method: 'GET' }).catch(() => {});
  }, []);

  // Backfill matchDate for old historique entries that pre-date the field.
  // Runs once at startup, throttled, no-op if nothing's missing. Wrapped in
  // a small delay so it doesn't compete with the initial page render.
  useEffect(() => {
    const id = setTimeout(() => {
      useHistoryStore.getState().backfillMatchDates().catch(() => {});
      // Same idea: re-link entries with synthetic (negative) fixtureIds —
      // typically from the manual Unibet import — to their real API id so
      // the resolver can grade them when the match ends.
      useHistoryStore.getState().backfillSyntheticFixtureIds().catch(() => {});
    }, 3000);
    return () => clearTimeout(id);
  }, []);

  // Hardware back button on Android: navigate back in WebView history rather
  // than exiting the app or always returning to home. Only exits when there
  // is no history left (i.e. on the entry page).
  useEffect(() => {
    let removeListener = () => {};
    CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack && window.history.length > 1) {
        window.history.back();
      } else {
        CapacitorApp.exitApp();
      }
    }).then((handle) => {
      removeListener = () => handle.remove();
    }).catch(() => {
      // Plugin not available (web/PWA context) — ignore
    });
    return () => removeListener();
  }, []);

  // Auto-resolve finished matches at app launch + every 5 min while open.
  // Only fires when there's at least one pending bet (entry-level OR per-VB),
  // to avoid burning API quota when nothing's at stake. Also re-runs when the
  // app returns from background (Android pause/resume, PC tab focus).
  useEffect(() => {
    const tick = () => {
      const all = useHistoryStore.getState().entries;
      const hasPending = all.some((e) => {
        if (Number.isFinite(e.mise) && e.mise > 0 && !e.result) return true;
        return Object.values(e.bets || {}).some((b) => Number.isFinite(b.mise) && b.mise > 0 && !b.result);
      });
      if (!hasPending) return;
      resolveFinishedMatches(useHistoryStore.getState().entries, resolveResult).catch(() => {});
    };

    tick(); // initial run
    const id = setInterval(tick, 15 * 60 * 1000); // every 15 min
    const onVisible = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Routes>
      {/* Umbrella hub + standalone weather section (no football chrome) */}
      <Route path="/" element={<Hub />} />
      <Route path="/meteo/*" element={<Meteo />} />

      {/* Football section — shares the sidebar/navbar layout */}
      <Route element={<FootballLayout />}>
        <Route path="/pronos" element={<Home />} />
        <Route path="/matchs" element={<Matchs />} />
        <Route path="/match/:id" element={<MatchDetail />} />
        {/* Legacy /leagues link → redirect into the merged Matchs page on the Classements tab. */}
        <Route path="/leagues" element={<Navigate to="/matchs?tab=classements" replace />} />
        <Route path="/favorites" element={<Favorites />} />
        <Route path="/worldcup" element={<WorldCup />} />
        <Route path="/team/:id" element={<Team />} />
        <Route path="/player/:id" element={<Player />} />
        <Route path="/history" element={<History />} />
        <Route path="/news" element={<News />} />
        <Route path="/help" element={<Help />} />
        <Route path="/value-bets" element={<ValueBets />} />
        <Route path="/settings" element={<Settings />} />
        {/* Old home path → football home */}
        <Route path="/home" element={<Navigate to="/pronos" replace />} />
      </Route>
    </Routes>
  );
}
