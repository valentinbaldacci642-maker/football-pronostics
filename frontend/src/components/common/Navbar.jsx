import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { teamsApi } from '../../services/api';

export default function Navbar() {
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
    <header className="fixed top-0 left-0 right-0 lg:left-64 z-40 h-14 flex items-center px-4 md:px-6 gap-4"
      style={{
        background: '#050a12',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      <Link to="/" className="flex items-center gap-2 lg:hidden flex-shrink-0">
        <img src="/ball.webp" alt="logo" className="w-7 h-7 rounded-lg object-cover" style={{ filter: 'drop-shadow(0 0 6px rgba(34,197,94,0.35))' }} />
        <span className="font-display text-base text-white tracking-wider">PronosDesFoufous</span>
      </Link>

      {/* Search */}
      <div className="flex-1 max-w-sm relative lg:ml-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
          {searching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-brand-500/50 border-t-brand-500 rounded-full animate-spin" />
          )}
          <input
            type="text"
            value={query}
            onChange={handleSearch}
            placeholder="Chercher une équipe..."
            className="w-full bg-dark-700 border border-white/[0.07] rounded-xl pl-9 pr-9 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-brand-500/40 transition-all duration-200 font-heading"
          />
        </div>

        {results.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 glass-card shadow-stadium overflow-hidden z-50">
            {results.map((r, i) => (
              <button
                key={r.team.id}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.06] transition-colors text-left group"
                onClick={() => { setQuery(''); setResults([]); navigate(`/?team=${r.team.id}`); }}
              >
                <img src={r.team.logo} alt="" className="w-6 h-6 object-contain opacity-80 group-hover:opacity-100 transition-opacity" onError={(e) => e.target.style.display = 'none'} />
                <div>
                  <p className="text-sm font-heading font-semibold text-white/80 group-hover:text-white transition-colors">{r.team.name}</p>
                  <p className="text-xs text-white/30 font-mono">{r.team.country}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
