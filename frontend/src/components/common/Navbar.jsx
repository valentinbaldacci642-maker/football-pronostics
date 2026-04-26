import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Bell, Menu, X, Zap } from 'lucide-react';
import { useUIStore } from '../../store';
import { teamsApi } from '../../services/api';

export default function Navbar() {
  const { sidebarOpen, setSidebarOpen } = useUIStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const navigate = useNavigate();

  const handleSearch = async (e) => {
    const val = e.target.value;
    setQuery(val);
    if (val.length < 3) { setResults([]); return; }
    setSearching(true);
    try {
      const data = await teamsApi.search(val);
      setResults(data?.response?.slice(0, 6) || []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 lg:left-64 z-40 h-16 bg-dark-900/90 backdrop-blur-md border-b border-white/5 flex items-center px-4 md:px-6 gap-4">
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden btn-ghost !px-2 !py-2"
      >
        {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      <Link to="/" className="flex items-center gap-2 lg:hidden">
        <div className="w-7 h-7 rounded-lg bg-brand-gradient flex items-center justify-center">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <span className="font-bold text-white text-sm">PronoStats</span>
      </Link>

      {/* Search */}
      <div className="flex-1 max-w-md relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            value={query}
            onChange={handleSearch}
            placeholder="Rechercher une équipe..."
            className="w-full bg-dark-700 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-brand-500/50 transition-colors"
          />
        </div>
        {results.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 glass-card shadow-card overflow-hidden z-50">
            {results.map((r) => (
              <button
                key={r.team.id}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
                onClick={() => { setQuery(''); setResults([]); navigate(`/?team=${r.team.id}`); }}
              >
                <img src={r.team.logo} alt="" className="w-6 h-6 object-contain" onError={(e) => e.target.style.display = 'none'} />
                <div>
                  <p className="text-sm font-medium">{r.team.name}</p>
                  <p className="text-xs text-white/40">{r.team.country}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-live-dot" />
          <span className="text-xs text-red-400 font-medium">LIVE</span>
        </div>
        <button className="btn-ghost !px-2 !py-2 relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-brand-500" />
        </button>
      </div>
    </header>
  );
}
