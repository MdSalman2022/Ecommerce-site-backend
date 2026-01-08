const rateLimit = require('express-rate-limit');

// Rate Limiting Middleware: Per-user limits with configurable env variables

// Create a rate limiter with custom options
const createRateLimiter = (options = {}) => {
    const {
        windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes default
        max = parseInt(process.env.RATE_LIMIT_MAX) || 100, // 100 requests per window default
        message = 'Too many requests, please try again later.',
        keyGenerator = null,
    } = options;

    return rateLimit({
        windowMs,
        max,
        message: {
            success: false,
            message,
            retryAfter: Math.ceil(windowMs / 1000),
        },
        standardHeaders: true, // Return rate limit info in headers
        legacyHeaders: false,
        keyGenerator: keyGenerator || ((req) => {
            // Use user ID if authenticated, otherwise use IP
            return req.user?._id?.toString() || req.ip;
        }),
        skip: (req) => {
            // Skip rate limiting for admins (optional - remove if not desired)
            return req.user?.role === 'admin';
        },
        handler: (req, res, next, options) => {
            res.status(429).json({
                success: false,
                message: options.message.message,
                retryAfter: options.message.retryAfter,
            });
        },
    });
};

// Standard API rate limiter (per-user)
const userRateLimiter = createRateLimiter();

// Strict rate limiter for auth routes
const authRateLimiter = createRateLimiter({
    windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 10, // Stricter for auth
    message: 'Too many authentication attempts, please try again later.',
    keyGenerator: (req) => {
        // For auth routes, always use IP since user isn't authenticated yet
        return req.ip;
    },
});

// Very strict rate limiter for sensitive operations (password reset)
const sensitiveRateLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // Very strict
    message: 'Too many attempts. Please try again in an hour.',
    keyGenerator: (req) => req.ip,
});

// AI endpoints rate limiter (resource-intensive)
const aiRateLimiter = createRateLimiter({
    windowMs: parseInt(process.env.AI_RATE_LIMIT_WINDOW_MS) || 60 * 1000, // 1 minute
    max: parseInt(process.env.AI_RATE_LIMIT_MAX) || 10, // 10 per minute
    message: 'AI request limit reached. Please wait before trying again.',
});

module.exports = {
    createRateLimiter,
    userRateLimiter,
    authRateLimiter,
    sensitiveRateLimiter,
    aiRateLimiter,
};
