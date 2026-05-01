import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Navbar from './components/common/Navbar';
import Sidebar from './components/common/Sidebar';
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

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 lg:ml-64">
        <Navbar />
        <main className="flex-1 px-4 md:px-6 lg:px-8 pb-8 pt-20">
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
    </div>
  );
}
