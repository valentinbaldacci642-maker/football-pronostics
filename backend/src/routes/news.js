const express = require('express');
const router = express.Router();
const Parser = require('rss-parser');
const parser = new Parser({
  timeout: 10000,
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)' },
  customFields: {
    item: [
      ['media:content', 'mediaContent', { keepArray: true }],
      ['media:thumbnail', 'mediaThumbnail', { keepArray: true }],
      ['content:encoded', 'contentEncoded'],
    ],
  },
});

// Extract the article image from every reasonable RSS field. rss-parser
// flattens namespaced fields differently per source, so we try several
// shapes before falling back to <img> in description.
function extractImage(item) {
  const fromArr = (arr) => {
    if (!Array.isArray(arr)) return null;
    for (const el of arr) {
      const url = el?.$?.url || el?.url;
      if (url && /^https?:\/\//.test(url)) return url;
    }
    return null;
  };
  const candidates = [
    fromArr(item.mediaContent),
    fromArr(item.mediaThumbnail),
    item.enclosure?.url,
    item['media:content']?.$?.url,
    item['media:thumbnail']?.$?.url,
  ];
  for (const c of candidates) {
    if (c && /^https?:\/\//.test(c)) return c;
  }
  // <img> in description / content:encoded
  const html = item.contentEncoded || item.content || item['content:encoded'] || '';
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (m && /^https?:\/\//.test(m[1])) return m[1];
  return null;
}

// Native publisher RSS feeds — these expose <media:content> or
// <media:thumbnail> with the article's lead image, unlike Google News which
// strips images. Fetched server-side so no CORS dance.
const FEEDS = [
  { url: 'https://www.lemonde.fr/sport/rss_full.xml',                  source: 'Le Monde' },
  { url: 'https://feeds.bbci.co.uk/sport/football/rss.xml',            source: 'BBC Sport' },
  { url: 'https://rmcsport.bfmtv.com/rss/football/',                   source: 'RMC Sport' },
  { url: 'https://www.90min.com/fr/posts.rss',                         source: '90min' },
  { url: 'https://news.google.com/rss/search?q=football+ligue+1+france&hl=fr&gl=FR&ceid=FR:fr', source: 'Google News' },
  { url: 'https://news.google.com/rss/search?q=football+transfert+mercato&hl=fr&gl=FR&ceid=FR:fr', source: 'Google News' },
];

let cache = { data: null, ts: 0 };
const TTL = 15 * 60 * 1000;

router.get('/', async (req, res, next) => {
  try {
    if (cache.data && Date.now() - cache.ts < TTL) {
      return res.json(cache.data);
    }

    const results = await Promise.allSettled(
      FEEDS.map(async (feed) => {
        const parsed = await parser.parseURL(feed.url);
        return (parsed.items || []).slice(0, 12).map((item) => ({
          title: item.title?.trim() || '',
          link: item.link || item.guid || '',
          pubDate: item.isoDate || item.pubDate || null,
          source: feed.source,
          image: extractImage(item),
          summary: (item.contentSnippet || item.summary || '')
            .replace(/<[^>]*>/g, '')
            .slice(0, 180)
            .trim(),
        }));
      })
    );

    const articles = results
      .filter((r) => r.status === 'fulfilled')
      .flatMap((r) => r.value)
      .filter((a) => a.title && a.link)
      .sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0))
      .slice(0, 40);

    cache = { data: { articles }, ts: Date.now() };
    res.json({ articles });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
