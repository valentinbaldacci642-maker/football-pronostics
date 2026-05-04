import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { App as CapacitorApp } from '@capacitor/app';
import { useHistoryStore } from './store';
import { fixturesApi } from './services/api';
import Navbar from './components/common/Navbar';
import Sidebar from './components/common/Sidebar';
import BottomNav from './components/common/BottomNav';
import PageTransition from './components/common/PageTransition';
import Home from './pages/Home';
import Matchs from './pages/Matchs';
import MatchDetail from './pages/MatchDetail';
import Leagues from './pages/Leagues';
import Favorites from './pages/Favorites';
import Analytics from './pages/Analytics';
import WorldCup from './pages/WorldCup';
import Team from './pages/Team';
import History from './pages/History';
import News from './pages/News';

export default function App() {
  const location = useLocation();
  const entries = useHistoryStore((s) => s.entries);
  const resolveResult = useHistoryStore((s) => s.resolveResult);

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

  // Auto-resolve finished matches: at app launch, look at unresolved entries
  // from the past 14 days and check the API for their final scores. If the
  // match is finished (FT/AET/PEN) we call resolveResult to mark W/L, which
  // feeds the bankroll ROI calculations. Limited to 30 lookups per launch
  // and runs once per session to avoid hammering the API.
  useEffect(() => {
    const FINISHED_STATUSES = ['FT', 'AET', 'PEN'];
    const MAX_LOOKUPS = 30;
    const MAX_AGE_DAYS = 14;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - MAX_AGE_DAYS);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    const todoStr = new Date().toISOString().split('T')[0];
    const candidates = entries
      .filter((e) => !e.result && e.fixtureId && e.date && e.date >= cutoffStr && e.date < todoStr)
      .slice(0, MAX_LOOKUPS);

    if (candidates.length === 0) return;

    let cancelled = false;
    Promise.allSettled(
      candidates.map((e) =>
        fixturesApi.getById(e.fixtureId).then((res) => ({ entry: e, raw: res }))
      )
    ).then((results) => {
      if (cancelled) return;
      results.forEach((r) => {
        if (r.status !== 'fulfilled') return;
        const { entry, raw } = r.value;
        const fixture = raw?.response?.[0] || raw?.data?.response?.[0];
        const status = fixture?.fixture?.status?.short;
        const hg = fixture?.goals?.home;
        const ag = fixture?.goals?.away;
        if (FINISHED_STATUSES.includes(status) && Number.isFinite(hg) && Number.isFinite(ag)) {
          resolveResult(entry.fixtureId, hg, ag);
        }
      });
    }).catch(() => {});

    return () => { cancelled = true; };
    // run only once per app mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 lg:ml-64">
        <Navbar />
        <main className="flex-1 px-4 md:px-6 lg:px-8 pb-24 lg:pb-8 pt-20">
          <AnimatePresence mode="wait" initial={false}>
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<PageTransition><Home /></PageTransition>} />
              <Route path="/matchs" element={<PageTransition><Matchs /></PageTransition>} />
              <Route path="/match/:id" element={<PageTransition><MatchDetail /></PageTransition>} />
              <Route path="/leagues" element={<PageTransition><Leagues /></PageTransition>} />
              <Route path="/favorites" element={<PageTransition><Favorites /></PageTransition>} />
              <Route path="/analytics" element={<PageTransition><Analytics /></PageTransition>} />
              <Route path="/worldcup" element={<PageTransition><WorldCup /></PageTransition>} />
              <Route path="/team/:id" element={<PageTransition><Team /></PageTransition>} />
              <Route path="/history" element={<PageTransition><History /></PageTransition>} />
              <Route path="/news" element={<PageTransition><News /></PageTransition>} />
            </Routes>
          </AnimatePresence>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
