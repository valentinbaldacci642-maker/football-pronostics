const https = require('https');
const http = require('http');

function fetchUrl(url, redirects) {
  if (redirects === undefined) redirects = 3;
  return new Promise(function(resolve, reject) {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)' },
      timeout: 10000,
    }, function(res) {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
        return fetchUrl(res.headers.location, redirects - 1).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() { resolve(data); });
    });
    req.on('error', reject);
    req.on('timeout', function() { req.destroy(); reject(new Error('timeout')); });
  });
}

function safeIso(str) {
  try { return new Date(str).toISOString(); } catch(e) { return null; }
}

function parseItems(xml, source) {
  const items = [];
  const itemRe = /<item[^>]*>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRe.exec(xml)) !== null && items.length < 15) {
    const body = m[1];

    const titleM = body.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
    const title = titleM ? titleM[1].trim() : '';

    const linkM = body.match(/<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i);
    const linkText = linkM ? linkM[1].trim() : '';
    const linkAttr = (body.match(/<link[^>]+href="([^"]+)"/) || [])[1] || '';
    const link = linkText || linkAttr;

    const pubM = body.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i) || body.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i);
    const pubDate = pubM ? pubM[1].trim() : '';

    const descM = body.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i) ||
                  body.match(/<summary[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/summary>/i);
    const desc = descM ? descM[1] : '';

    const mcUrl = (body.match(/media:(?:content|thumbnail)[^>]+url="([^"]+)"/) || [])[1] || null;
    const imgUrl = (desc.match(/<img[^>]+src=["']([^"']+)["']/) || [])[1] || null;

    if (title && link) {
      items.push({
        title: title,
        link: link,
        pubDate: pubDate ? safeIso(pubDate) : null,
        source: source,
        image: mcUrl || imgUrl || null,
        summary: desc.replace(/<[^>]*>/g, '').slice(0, 180).trim(),
      });
    }
  }
  return items;
}

const FEEDS = [
  { url: 'https://rmcsport.bfmtv.com/rss/football/', source: 'RMC Sport' },
  { url: 'https://www.90min.com/fr/posts.rss', source: '90min' },
  { url: 'https://news.google.com/rss/search?q=site:lequipe.fr+football&hl=fr&gl=FR&ceid=FR:fr', source: "L'Équipe" },
  { url: 'https://news.google.com/rss/search?q=site:maxifoot.fr&hl=fr&gl=FR&ceid=FR:fr', source: 'Maxifoot' },
  { url: 'https://news.google.com/rss/search?q=site:footmercato.net&hl=fr&gl=FR&ceid=FR:fr', source: 'Foot Mercato' },
];

module.exports = async function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate');

  const results = await Promise.allSettled(
    FEEDS.map(async function(feed) {
      const xml = await fetchUrl(feed.url);
      return parseItems(xml, feed.source);
    })
  );

  const articles = results
    .filter(function(r) { return r.status === 'fulfilled'; })
    .reduce(function(acc, r) { return acc.concat(r.value); }, [])
    .filter(function(a) { return a.title && a.link; })
    .sort(function(a, b) { return new Date(b.pubDate || 0) - new Date(a.pubDate || 0); })
    .slice(0, 40);

  res.json({ articles: articles });
};
