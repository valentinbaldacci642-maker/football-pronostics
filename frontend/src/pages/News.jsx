import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, RefreshCw, Newspaper, Clock } from 'lucide-react';
import { newsApi } from '../services/api';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

const SOURCE_COLORS = {
  "RMC Sport":  { bg: 'bg-blue-500/15 text-blue-400',  dot: 'bg-blue-400' },
  "L'Équipe":   { bg: 'bg-brand-500/15 text-brand-400', dot: 'bg-brand-400' },
  "BBC Sport":  { bg: 'bg-red-500/15 text-red-400',     dot: 'bg-red-400' },
  "Goal.com":   { bg: 'bg-gold-500/15 text-gold-400',   dot: 'bg-gold-400' },
};

function timeAgo(dateStr) {
  if (!dateStr) return '';
  try {
    return formatDistanceToNow(parseISO(dateStr), { addSuffix: true, locale: fr });
  } catch {
    return '';
  }
}

function ArticleCard({ article, index }) {
  const src = SOURCE_COLORS[article.source] || { bg: 'bg-white/10 text-white/50', dot: 'bg-white/40' };

  return (
    <motion.a
      href={article.link}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
      className="football-card flex gap-4 p-4 cursor-pointer group"
    >
      {/* Thumbnail */}
      {article.image ? (
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden flex-shrink-0 bg-dark-700">
          <img
            src={article.image}
            alt=""
            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
            onError={(e) => { e.target.parentElement.style.display = 'none'; }}
          />
        </div>
      ) : (
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-dark-700 flex-shrink-0 flex items-center justify-center">
          <Newspaper className="w-7 h-7 text-white/15" />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[11px] font-heading font-semibold px-2 py-0.5 rounded-full ${src.bg}`}>
            {article.source}
          </span>
          {article.pubDate && (
            <span className="text-xs text-white/25 font-mono flex items-center gap-1">
              <Clock className="w-3 h-3" /> {timeAgo(article.pubDate)}
            </span>
          )}
        </div>

        <h3 className="text-sm font-heading font-semibold text-white/85 group-hover:text-white transition-colors line-clamp-2 leading-snug">
          {article.title}
        </h3>

        {article.summary && (
          <p className="text-xs text-white/35 line-clamp-2 leading-relaxed hidden sm:block">
            {article.summary}
          </p>
        )}
      </div>

      <ExternalLink className="w-3.5 h-3.5 text-white/15 group-hover:text-white/40 flex-shrink-0 mt-1 transition-colors" />
    </motion.a>
  );
}

function ArticleSkeleton() {
  return (
    <div className="football-card flex gap-4 p-4">
      <div className="w-20 h-20 rounded-xl skeleton flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-20 skeleton rounded-full" />
        <div className="h-4 skeleton rounded" />
        <div className="h-4 w-3/4 skeleton rounded" />
        <div className="h-3 skeleton rounded hidden sm:block" />
      </div>
    </div>
  );
}

export default function News() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sourceFilter, setSourceFilter] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await newsApi.getLatest();
      setArticles(data?.articles || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const sources = [...new Set(articles.map((a) => a.source))];
  const filtered = sourceFilter ? articles.filter((a) => a.source === sourceFilter) : articles;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl text-white tracking-wide leading-none">
            Actu <span className="text-brand-400">Football</span>
          </h1>
          <p className="text-sm text-white/35 font-heading font-medium mt-1">
            Dernières news · Sources agrégées
          </p>
        </div>
        <button onClick={load} disabled={loading} className="btn-ghost !px-2.5 !py-2 flex items-center gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span className="text-xs hidden sm:block font-heading font-semibold tracking-wide">Actualiser</span>
        </button>
      </div>

      {/* Source filters */}
      {sources.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSourceFilter(null)}
            className={`px-3 py-1.5 rounded-xl text-xs font-heading font-semibold border transition-all ${
              !sourceFilter ? 'bg-brand-500/15 border-brand-500/35 text-brand-400' : 'border-white/[0.08] text-white/35 hover:text-white/60'
            }`}
          >
            Toutes sources
          </button>
          {sources.map((s) => {
            const c = SOURCE_COLORS[s] || { bg: '', dot: 'bg-white/40' };
            return (
              <button
                key={s}
                onClick={() => setSourceFilter(s === sourceFilter ? null : s)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-heading font-semibold border transition-all ${
                  sourceFilter === s ? 'bg-dark-700 border-white/15 text-white' : 'border-white/[0.08] text-white/35 hover:text-white/60'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                {s}
              </button>
            );
          })}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => <ArticleSkeleton key={i} />)}
        </div>
      ) : error ? (
        <div className="glass-card p-10 text-center space-y-3">
          <div className="font-display text-3xl text-danger/50">ERR</div>
          <p className="text-white/40 font-heading">{error}</p>
          <button onClick={load} className="btn-primary mt-2">Réessayer</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Newspaper className="w-10 h-10 text-white/10 mx-auto mb-3" />
          <p className="text-white/40 font-heading font-semibold">Aucun article disponible</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((article, i) => (
            <ArticleCard key={`${article.link}-${i}`} article={article} index={i} />
          ))}
          <p className="text-center text-xs text-white/20 font-heading pt-2">
            {filtered.length} articles · Mis à jour toutes les 15 minutes
          </p>
        </div>
      )}
    </div>
  );
}
