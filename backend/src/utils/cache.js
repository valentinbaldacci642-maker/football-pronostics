const NodeCache = require('node-cache');
const config = require('../config');
const logger = require('./logger');

class CacheManager {
  constructor() {
    this.store = new NodeCache({
      stdTTL: config.cache.ttl,
      maxKeys: config.cache.maxKeys,
      checkperiod: 120,
      useClones: false,
    });

    this.store.on('expired', (key) => {
      logger.debug(`Cache expired: ${key}`);
    });

    this.stats = { hits: 0, misses: 0, sets: 0 };
  }

  get(key) {
    const value = this.store.get(key);
    if (value !== undefined) {
      this.stats.hits++;
      logger.debug(`Cache HIT: ${key}`);
      return value;
    }
    this.stats.misses++;
    logger.debug(`Cache MISS: ${key}`);
    return null;
  }

  set(key, value, ttl) {
    this.stats.sets++;
    const success = ttl
      ? this.store.set(key, value, ttl)
      : this.store.set(key, value);
    logger.debug(`Cache SET: ${key} (TTL: ${ttl || config.cache.ttl}s)`);
    return success;
  }

  del(key) {
    return this.store.del(key);
  }

  flush() {
    this.store.flushAll();
    logger.info('Cache flushed');
  }

  getStats() {
    return {
      ...this.stats,
      keys: this.store.keys().length,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses || 1),
    };
  }

  buildKey(...parts) {
    return parts.join(':');
  }
}

module.exports = new CacheManager();
