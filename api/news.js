const https = require('https');
const http = require('http');

// Block requests to internal/loopback/link-local/private ranges so a
// redirect from an upstream feed can't pivot into Vercel's metadata
// service, our own backend, or any internal infra. IPv4 + IPv6.
const SSRF_BLOCKLIST = [
  /^localhost$/i,
  /^127\./,           // loopback
  /^10\./,            // RFC1918
  /^192\.168\./,      // RFC1918
  /^172\.(1[6-9]|2\d|3[01])\./, // RFC1918
  /^169\.254\./,      // link-local (incl. cloud metadata 169.254.169.254)
  /^0\./,             // 0.0.0.0/8
  /^::1$/,            // IPv6 loopback
  /^fe80:/i,          // IPv6 link-local
  /^fc00:/i, /^fd00:/i, // IPv6 unique local
];

function isSafeUrl(url) {
  let parsed;
  try { parsed = new URL(url); } catch (_) { return false; }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  const host = parsed.hostname;
  if (!host) return false;
  return !SSRF_BLOCKLIST.some((re) => re.test(host));
}

// 5 MB cap is plenty for RSS payloads (real feeds are <500 KB). A larger
// response is almost certainly hostile or broken — abort to protect the
// 256 MB function memory budget.
const MAX_BODY = 5 * 1024 * 1024;

function fetchUrl(url, redirects) {
  if (redirects === undefined) redirects = 3;
  return new Promise(function(resolve, reject) {
    if (!isSafeUrl(url)) return reject(new Error('blocked URL'));
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)' },
      timeout: 10000,
    }, function(res) {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
        // Resolve relative Location headers against the current URL, then
        // re-validate to make sure the target isn't internal.
        let nextUrl;
        try { nextUrl = new URL(res.headers.location, url).toString(); }
        catch (_) { return reject(new Error('bad redirect')); }
        res.resume(); // discard body so the socket can be reused
        return fetchUrl(nextUrl, redirects - 1).then(resolve).catch(reject);
      }
      let data = '';
      let total = 0;
      res.on('data', function(chunk) {
        total += chunk.length;
        if (total > MAX_BODY) {
          req.destroy();
          reject(new Error('response too large'));
          return;
        }
        data += chunk;
      });
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
  { url: 'https://news.google.com/rss/search?q=site:rmcsport.bfmtv.com+football&hl=fr&gl=FR&ceid=FR:fr', source: 'RMC Sport' },
  { url: 'https://news.google.com/rss/search?q=site:90min.com+football&hl=fr&gl=FR&ceid=FR:fr', source: '90min' },
  { url: 'https://news.google.com/rss/search?q=site:lequipe.fr+football&hl=fr&gl=FR&ceid=FR:fr', source: "L'Équipe" },
  { url: 'https://news.google.com/rss/search?q=site:maxifoot.fr&hl=fr&gl=FR&ceid=FR:fr', source: 'Maxifoot' },
  { url: 'https://news.google.com/rss/search?q=site:footmercato.net&hl=fr&gl=FR&ceid=FR:fr', source: 'Foot Mercato' },
];

// Restrict CORS to our own origins to prevent abuse of this serverless
// function from arbitrary websites (would burn Vercel invocations / bw).
const ALLOWED_ORIGINS = [
  'https://football-pronostics-tau.vercel.app',
  'https://pronos-foufous-app.vercel.app',
  'http://localhost:5173',
  'http://localhost',
  'https://localhost',
  'capacitor://localhost',
];

module.exports = async function(req, res) {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  // Aggressive edge caching: news feeds change slowly, and shared caching
  // means most hits never reach the function at all → bandwidth-safe.
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');

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
