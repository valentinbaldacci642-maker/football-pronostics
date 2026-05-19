const crypto = require('crypto');

// Fail-closed auth shared by admin / scan endpoints. Compares with
// timingSafeEqual to avoid leaking the secret one byte at a time.
// `allowQueryKey` should stay true only for endpoints that need to be
// hittable by UptimeRobot free tier (no custom headers).
function adminAuth({ allowQueryKey = false } = {}) {
  return function (req, res, next) {
    const expected = process.env.NOTIFICATIONS_SCAN_SECRET;
    if (!expected) {
      return res.status(503).json({ error: 'Admin auth not configured' });
    }
    const provided = req.headers['x-scan-key']
      || (allowQueryKey ? req.query.key : undefined);
    if (!provided || typeof provided !== 'string') {
      return res.status(401).json({ error: 'Missing scan key' });
    }
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(401).json({ error: 'Invalid scan key' });
    }
    return next();
  };
}

module.exports = adminAuth;
