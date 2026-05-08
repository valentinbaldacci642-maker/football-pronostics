import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { App as CapacitorApp } from '@capacitor/app';
import { useHistoryStore } from './store';
import { resolveFinishedMatches } from './utils/resolveResults';
import { initCloudSync } from './services/cloudSync';
import Navbar from './components/common/Navbar';
import Sidebar from './components/common/Sidebar';
import BottomNav from './components/common/BottomNav';
import PageTransition from './components/common/PageTransition';
import RateLimitBanner from './components/common/RateLimitBanner';
import Home from './pages/Home';
import Matchs from './pages/Matchs';
import MatchDetail from './pages/MatchDetail';
import Leagues from './pages/Leagues';
import Favorites from './pages/Favorites';
import WorldCup from './pages/WorldCup';
import Team from './pages/Team';
import History from './pages/History';
import News from './pages/News';
import Help from './pages/Help';
import ValueBets from './pages/ValueBets';
import Settings from './pages/Settings';

export default function App() {
  const location = useLocation();
  const entries = useHistoryStore((s) => s.entries);
  const resolveResult = useHistoryStore((s) => s.resolveResult);

  // Initialize cloud sync (Supabase). No-op if env vars are missing —
  // app keeps working in localStorage-only mode.
  useEffect(() => { initCloudSync(); }, []);

  // Backfill matchDate for old historique entries that pre-date the field.
  // Runs once at startup, throttled, no-op if nothing's missing. Wrapped in
  // a small delay so it doesn't compete with the initial page render.
  useEffect(() => {
    const id = setTimeout(() => {
      useHistoryStore.getState().backfillMatchDates().catch(() => {});
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
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<PageTransition><Home /></PageTransition>} />
              <Route path="/matchs" element={<PageTransition><Matchs /></PageTransition>} />
              <Route path="/match/:id" element={<PageTransition><MatchDetail /></PageTransition>} />
              <Route path="/leagues" element={<PageTransition><Leagues /></PageTransition>} />
              <Route path="/favorites" element={<PageTransition><Favorites /></PageTransition>} />
              <Route path="/worldcup" element={<PageTransition><WorldCup /></PageTransition>} />
              <Route path="/team/:id" element={<PageTransition><Team /></PageTransition>} />
              <Route path="/history" element={<PageTransition><History /></PageTransition>} />
              <Route path="/news" element={<PageTransition><News /></PageTransition>} />
              <Route path="/help" element={<PageTransition><Help /></PageTransition>} />
              <Route path="/value-bets" element={<PageTransition><ValueBets /></PageTransition>} />
              <Route path="/settings" element={<PageTransition><Settings /></PageTransition>} />
            </Routes>
          </AnimatePresence>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
