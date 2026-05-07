import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, RefreshCw, Newspaper, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';


// Google News RSS feeds — most other publishers' direct RSS endpoints have
// either disappeared or are CORS-blocked. Google News is the most reliable
// aggregator. RSS items don't carry images and the article URLs redirect via
// JS so og:image extraction is unreliable; instead each source provides a
// branded fallback logo so cards have visual identity.
const FEEDS = [
  { url: 'https://news.google.com/rss/search?q=site:rmcsport.bfmtv.com+football&hl=fr&gl=FR&ceid=FR:fr', source: 'RMC Sport',  domain: 'rmcsport.bfmtv.com' },
  { url: 'https://news.google.com/rss/search?q=site:90min.com+football&hl=fr&gl=FR&ceid=FR:fr',           source: '90min',       domain: '90min.com' },
  { url: 'https://news.google.com/rss/search?q=site:lequipe.fr+football&hl=fr&gl=FR&ceid=FR:fr',          source: "L'Équipe",    domain: 'lequipe.fr' },
  { url: 'https://news.google.com/rss/search?q=site:maxifoot.fr&hl=fr&gl=FR&ceid=FR:fr',                   source: 'Maxifoot',    domain: 'maxifoot.fr' },
  { url: 'https://news.google.com/rss/search?q=site:footmercato.net&hl=fr&gl=FR&ceid=FR:fr',               source: 'Foot Mercato', domain: 'footmercato.net' },
];

// Hi-res favicon URL via Google's S2 service. Returns a real PNG (~120px) of
// the site's branding — works for every domain in FEEDS. Used as the visible
// thumbnail when the article doesn't carry its own image.
const SOURCE_DOMAIN = Object.fromEntries(FEEDS.map((f) => [f.source, f.domain]));
function sourceLogo(source) {
  const domain = SOURCE_DOMAIN[source];
  if (!domain) return null;
  return `https://www.google.com/s2/favicons?sz=128&domain=${domain}`;
}

// Extract og:image / twitter:image from an article URL. Cached in sessionStorage
// so we don't re-fetch the same article on a later page reload during the
// session. Returns the image URL or null.
async function fetchArticleImage(url) {
  if (!url) return null;
  const cacheKey = `pdf-news-img:${url}`;
  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached !== null) return cached || null;
  } catch (e) {}
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(`${PROXY}${encodeURIComponent(url)}`, { signal: ctrl.signal })
      .finally(() => clearTimeout(timer));
    if (!res.ok) {
      try { sessionStorage.setItem(cacheKey, ''); } catch (e) {}
      return null;
    }
    const html = await res.text();
    // Match og:image or twitter:image meta tags (any attribute order)
    const patterns = [
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    ];
    for (const re of patterns) {
      const m = html.match(re);
      if (m && /^https?:\/\//.test(m[1])) {
        try { sessionStorage.setItem(cacheKey, m[1]); } catch (e) {}
        return m[1];
      }
    }
    try { sessionStorage.setItem(cacheKey, ''); } catch (e) {}
    return null;
  } catch (e) {
    return null;
  }
}

const PROXY = 'https://api.allorigins.win/raw?url=';

function extractImage(item) {
  const mediaNS = 'http://search.yahoo.com/mrss/';
  // Try every media:* element (some feeds put image in thumbnail, others in
  // content, and some include multiple — pick the first with a url).
  const mediaTags = ['content', 'thumbnail', 'group'];
  for (const tag of mediaTags) {
    const elems = item.getElementsByTagNameNS(mediaNS, tag);
    for (const el of elems) {
      const url = el.getAttribute('url');
      if (url && /^https?:\/\//.test(url)) return url;
      // media:group can wrap nested media:content
      const inner = el.getElementsByTagNameNS(mediaNS, 'content')[0]
        || el.getElementsByTagNameNS(mediaNS, 'thumbnail')[0];
      if (inner?.getAttribute('url')) return inner.getAttribute('url');
    }
  }
  // <enclosure type="image/..." url="...">
  const enc = item.querySelector('enclosure');
  if (enc) {
    const t = enc.getAttribute('type') || '';
    const u = enc.getAttribute('url') || '';
    if ((t.startsWith('image/') || /\.(jpe?g|png|webp|gif)$/i.test(u)) && /^https?:\/\//.test(u)) {
      return u;
    }
  }
  // Fallback: parse <description> CDATA for an <img src="..."> tag
  const desc = item.querySelector('description')?.textContent || '';
  const m = desc.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (m && /^https?:\/\//.test(m[1])) return m[1];
  // Last resort: <content:encoded> often carries the full HTML
  const contentNS = 'http://purl.org/rss/1.0/modules/content/';
  const enc2 = item.getElementsByTagNameNS(contentNS, 'encoded')[0];
  if (enc2) {
    const m2 = enc2.textContent.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (m2 && /^https?:\/\//.test(m2[1])) return m2[1];
  }
  return null;
}

function parseFeedXML(xml, source) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  return Array.from(doc.querySelectorAll('item'))
    .slice(0, 15)
    .map((item) => {
      const get = (tag) => item.querySelector(tag)?.textContent?.trim() || '';
      const linkEl = item.getElementsByTagName('link')[0];
      const link = linkEl?.textContent?.trim() || linkEl?.getAttribute('href') || '';
      const rawDate = get('pubDate') || get('updated');
      let image = extractImage(item);
      if (!image) {
        const desc = item.querySelector('description')?.textContent || '';
        const m = desc.match(/<img[^>]+src=["']([^"']+)["']/);
        if (m) image = m[1];
      }
      const description = item.querySelector('description')?.textContent || '';
      return {
        title: get('title'),
        link,
        pubDate: rawDate ? (() => { try { return new Date(rawDate).toISOString(); } catch { return null; } })() : null,
        source,
        image,
        summary: description.replace(/<[^>]*>/g, '').slice(0, 180).trim(),
      };
    })
    .filter((a) => a.title && a.link);
}

async function fetchDirectRSS() {
  const results = await Promise.allSettled(
    FEEDS.map(async (feed) => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12000);
      const res = await fetch(`${PROXY}${encodeURIComponent(feed.url)}`, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
      const xml = await res.text();
      if (!xml?.trim().startsWith('<')) return [];
      return parseFeedXML(xml, feed.source);
    })
  );
  return results
    .filter((r) => r.status === 'fulfilled')
    .flatMap((r) => r.value)
    .filter((a) => a.title && a.link)
    .sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0))
    .slice(0, 40);
}
const SOURCE_COLORS = {
  "Google News":  { bg: 'bg-blue-500/15 text-blue-400',    dot: 'bg-blue-400' },
  "RMC Sport":    { bg: 'bg-brand-500/15 text-brand-400',  dot: 'bg-brand-400' },
  "90min":        { bg: 'bg-gold-500/15 text-gold-400',    dot: 'bg-gold-400' },
  "L'Équipe":     { bg: 'bg-red-500/15 text-red-400',      dot: 'bg-red-400' },
  "Maxifoot":     { bg: 'bg-violet-500/15 text-violet-400', dot: 'bg-violet-400' },
  "Foot Mercato": { bg: 'bg-orange-500/15 text-orange-400', dot: 'bg-orange-400' },
};

function timeAgo(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return formatDistanceToNow(d, { addSuffix: true, locale: fr });
  } catch {
    return '';
  }
}

function ArticleCard({ article, index }) {
  const src = SOURCE_COLORS[article.source] || { bg: 'bg-white/10 text-white/50', dot: 'bg-white/40' };
  // Show the article's own image when available; otherwise fall back to the
  // source's hi-res favicon so cards always have visual identity.
  const thumb = article.image || sourceLogo(article.source);

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
      {/* Thumbnail — article image when available, else the source logo */}
      {thumb ? (
        <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden flex-shrink-0 bg-dark-700 flex items-center justify-center ${article.image ? '' : 'p-4'}`}>
          <img
            src={thumb}
            alt=""
            className={article.image
              ? "w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
              : "w-full h-full object-contain opacity-90 group-hover:opacity-100 transition-opacity"}
            onError={(e) => { e.target.style.display = 'none'; }}
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
      const base = import.meta.env.VITE_VERCEL_URL || '';
      const res = await fetch(`${base}/api/news`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const arts = data?.articles ?? [];
      if (arts.length === 0) throw new Error('empty');
      setArticles(arts);
    } catch (primaryErr) {
      console.error('[News] vercel fetch failed:', primaryErr.message);
      try {
        const arts = await fetchDirectRSS();
        if (arts.length === 0) throw new Error('empty');
        setArticles(arts);
      } catch (fallbackErr) {
        console.error('[News] fallback failed:', fallbackErr.message);
        setError(`Erreur: ${primaryErr.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // After articles load, lazily hydrate missing images by extracting og:image
  // from each article URL. Done sequentially with a tiny gap so we don't
  // hammer the proxy. Updates the article in place when an image arrives.
  useEffect(() => {
    if (articles.length === 0) return;
    let cancelled = false;
    (async () => {
      for (let i = 0; i < articles.length; i++) {
        if (cancelled) return;
        const a = articles[i];
        if (a.image) continue;
        const img = await fetchArticleImage(a.link);
        if (cancelled) return;
        if (img) {
          setArticles((prev) => prev.map((x, idx) => idx === i && !x.image ? { ...x, image: img } : x));
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articles.length]);

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
          <p className="text-white/40 font-heading font-mono text-xs">{error}</p>
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
