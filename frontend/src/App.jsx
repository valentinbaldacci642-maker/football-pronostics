import { Routes, Route } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Navbar from './components/common/Navbar';
import Sidebar from './components/common/Sidebar';
import Home from './pages/Home';
import Matchs from './pages/Matchs';
import MatchDetail from './pages/MatchDetail';
import Leagues from './pages/Leagues';
import Favorites from './pages/Favorites';
import Analytics from './pages/Analytics';

export default function App() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 lg:ml-64">
        <Navbar />
        <main className="flex-1 px-4 md:px-6 lg:px-8 pb-8 pt-20">
          <AnimatePresence mode="wait">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/matchs" element={<Matchs />} />
              <Route path="/match/:id" element={<MatchDetail />} />
              <Route path="/leagues" element={<Leagues />} />
              <Route path="/favorites" element={<Favorites />} />
              <Route path="/analytics" element={<Analytics />} />
            </Routes>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
