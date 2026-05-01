const https = require('https');

function fetchUrl(url) {
  return new Promise(function(resolve, reject) {
    const req = https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)' },
      timeout: 8000,
    }, function(res) {
      let data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() { resolve({ status: res.statusCode, body: data }); });
    });
    req.on('error', reject);
    req.on('timeout', function() { req.destroy(); reject(new Error('timeout')); });
  });
}

module.exports = async function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const result = await fetchUrl('https://rmcsport.bfmtv.com/rss/football/').catch(function(e) { return { error: e.message }; });
  const body = result.body || '';
  const itemCount = (body.match(/<item/g) || []).length;
  const titleMatch = body.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/);
  
  res.json({
    status: result.status,
    bodyStart: body.slice(0, 100),
    itemCount: itemCount,
    firstTitle: titleMatch ? titleMatch[1].slice(0, 60) : 'NO MATCH',
    error: result.error,
  });
};
