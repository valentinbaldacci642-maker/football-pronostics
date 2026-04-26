const express = require('express');
const router = express.Router();
const cache = require('../utils/cache');
const api = require('../services/apiFootball');

router.get('/stats', (req, res) => {
  res.json({
    cache: cache.getStats(),
    quota: api.getQuota(),
  });
});

router.delete('/flush', (req, res) => {
  cache.flush();
  res.json({ message: 'Cache flushed successfully' });
});

module.exports = router;
