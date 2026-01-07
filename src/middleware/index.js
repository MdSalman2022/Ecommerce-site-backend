/**
 * Middleware Module Aggregator
 * Centralizes all middleware exports
 */
const { cacheMiddleware, clearCache, cache } = require('./cacheMiddleware');
const { errorHandler, notFoundHandler } = require('./errorHandler');

module.exports = {
    cacheMiddleware,
    clearCache,
    cache,
    errorHandler,
    notFoundHandler,
};
