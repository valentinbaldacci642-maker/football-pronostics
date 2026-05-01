const express = require('express');
const router = express.Router();
const Parser = require('rss-parser');
const parser = new Parser({ timeout: 8000 });

const FEEDS = [
  { url: 'https://rmcsport.bfmtv.com/rss/football/', source: 'RMC Sport' },
  { url: 'https://www.lequipe.fr/rss/actu_rss.xml', source: "L'Équipe" },
  { url: 'https://feeds.bbci.co.uk/sport/football/rss.xml', source: 'BBC Sport' },
  { url: 'https://www.goal.com/feeds/fr/news', source: 'Goal.com' },
];

let cache = { data: null, ts: 0 };
const TTL = 15 * 60 * 1000; // 15 min

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
          image:
            item.enclosure?.url ||
            item['media:content']?.['$']?.url ||
            item['media:thumbnail']?.['$']?.url ||
            null,
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
