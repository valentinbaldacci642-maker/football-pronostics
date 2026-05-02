function safeIso(str) {
  try { return new Date(str).toISOString(); } catch { return null; }
}

function parseItems(xml, source) {
  const items = [];
  const itemRe = /<item[^>]*>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRe.exec(xml)) !== null && items.length < 15) {
    const body = m[1];
    const title = (body.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i) || [])[1]?.trim() || '';
    const linkText = (body.match(/<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i) || [])[1]?.trim() || '';
    const linkAttr = (body.match(/<link[^>]+href="([^"]+)"/) || [])[1] || '';
    const link = linkText || linkAttr;
    const pubDate = (body.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i) || body.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i) || [])[1]?.trim() || '';
    const desc = (body.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i) || body.match(/<summary[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/summary>/i) || [])[1] || '';
    const image = (body.match(/media:(?:content|thumbnail)[^>]+url="([^"]+)"/) || [])[1]
      || (desc.match(/<img[^>]+src=["']([^"']+)["']/) || [])[1]
      || null;
    if (title && link) {
      items.push({
        title,
        link,
        pubDate: pubDate ? safeIso(pubDate) : null,
        source,
        image,
        summary: desc.replace(/<[^>]*>/g, '').slice(0, 180).trim(),
      });
    }
  }
  return items;
}

const FEEDS = [
  { url: 'https://news.google.com/rss/search?q=site:rmcsport.bfmtv.com+football&hl=fr&gl=FR&ceid=FR:fr', source: 'RMC Sport' },
  { url: 'https://news.google.com/rss/search?q=site:90min.com+football&hl=fr&gl=FR&ceid=FR:fr', source: '90min' },
  { url: 'https://news.google.com/rss/search?q=site:lequipe.fr+football&hl=fr&gl=FR&ceid=FR:fr', source: "L'Équipe" },
  { url: 'https://news.google.com/rss/search?q=site:maxifoot.fr&hl=fr&gl=FR&ceid=FR:fr', source: 'Maxifoot' },
  { url: 'https://news.google.com/rss/search?q=site:footmercato.net&hl=fr&gl=FR&ceid=FR:fr', source: 'Foot Mercato' },
];

async function fetchFeed(feed) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(feed.url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)' },
    });
    const xml = await res.text();
    return parseItems(xml, feed.source);
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate');
  try {
    const results = await Promise.allSettled(FEEDS.map(fetchFeed));
    const articles = results
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => r.value)
      .filter(a => a.title && a.link)
      .sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0))
      .slice(0, 40);
    res.json({ articles });
  } catch (err) {
    console.error('[news]', err);
    res.status(500).json({ articles: [], error: err.message });
  }
};
