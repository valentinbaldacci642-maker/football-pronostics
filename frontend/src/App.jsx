import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { App as CapacitorApp } from '@capacitor/app';
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
