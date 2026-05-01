const https = require('https');
const http = require('http');

function fetchUrl(url, redirects) {
  if (redirects === undefined) redirects = 3;
  return new Promise(function(resolve, reject) {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)' },
      timeout: 8000,
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
    const tag = function(name) {
      const r = body.match(new RegExp('<' + name + '[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/' + name + '>', 'i'));
      return r ? r[1].trim() : '';
    };
    const title = tag('title');
    const linkText = tag('link');
    const linkAttr = (body.match(/<link[^>]+href="([^"]+)"/) || [])[1] || '';
    const link = linkText || linkAttr;
    const pubDate = tag('pubDate') || tag('updated');
    const desc = tag('description') || tag('summary') || '';
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
];

let cache = { data: null, ts: 0 };
const TTL = 15 * 60 * 1000;

module.exports = async function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate');

  if (cache.data && Date.now() - cache.ts < TTL) {
    return res.json(cache.data);
  }

  const results = await Promise.allSettled(
    FEEDS.map(async function(feed) {
      const xml = await fetchUrl(feed.url);
      const items = parseItems(xml, feed.source);
      return items;
    })
  );

  const errors = results.filter(function(r) { return r.status === 'rejected'; }).map(function(r) { return r.reason && r.reason.message; });
  const articles = results
    .filter(function(r) { return r.status === 'fulfilled'; })
    .reduce(function(acc, r) { return acc.concat(r.value); }, [])
    .filter(function(a) { return a.title && a.link; })
    .sort(function(a, b) { return new Date(b.pubDate || 0) - new Date(a.pubDate || 0); })
    .slice(0, 40);

  const out = { articles: articles };
  if (errors.length) out.errors = errors;
  cache = { data: out, ts: Date.now() };
  res.json(out);
};
