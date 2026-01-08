const { cacheMiddleware, clearCache, cache } = require('./cacheMiddleware');
const { errorHandler, notFoundHandler } = require('./errorHandler');
const { authorize, authorizeAny, adminOnly, staffOnly, attachPermissions, ownerOrPermission, PERMISSIONS } = require('./rbacMiddleware');
const { userRateLimiter, authRateLimiter, sensitiveRateLimiter, aiRateLimiter } = require('./rateLimitMiddleware');

module.exports = {
    cacheMiddleware,
    clearCache,
    cache,
    errorHandler,
    notFoundHandler,
    authorize,
    authorizeAny,
    adminOnly,
    staffOnly,
    attachPermissions,
    ownerOrPermission,
    PERMISSIONS,
    userRateLimiter,
    authRateLimiter,
    sensitiveRateLimiter,
    aiRateLimiter,
};
