const NodeCache = require('node-cache');

// Initialize cache with 5 minutes TTL
const cache = new NodeCache({ stdTTL: 300 });

/**
 * Cache Middleware Factory
 * Creates middleware that caches responses for specified duration
 * 
 * @param {string} keyPrefix - Prefix for cache key
 * @param {number} ttl - Time to live in seconds (optional)
 * @returns {Function} Express middleware
 */
const cacheMiddleware = (keyPrefix, ttl) => {
    return (req, res, next) => {
        const key = `${keyPrefix}_${req.originalUrl}`;
        const cachedResponse = cache.get(key);

        if (cachedResponse) {
            return res.json(cachedResponse);
        }

        // Store original json method
        const originalJson = res.json.bind(res);

        // Override json method to cache response
        res.json = (data) => {
            cache.set(key, data, ttl);
            return originalJson(data);
        };

        next();
    };
};

/**
 * Clear cache for specific key or all cache
 * @param {string} key - Optional specific key to clear
 */
const clearCache = (key) => {
    if (key) {
        // Clear all keys that start with the prefix
        const keys = cache.keys().filter((k) => k.startsWith(key));
        keys.forEach((k) => cache.del(k));
    } else {
        cache.flushAll();
    }
};

module.exports = { cacheMiddleware, clearCache, cache };
