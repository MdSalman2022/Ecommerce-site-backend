const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { ApiError } = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Auth Middleware
 * Protects routes by verifying JWT tokens
 */

/**
 * Protect route - Require authentication
 * Extracts JWT from Authorization header or cookies
 */
const protect = asyncHandler(async (req, res, next) => {
    let token;

    // Check Authorization header
    if (req.headers.authorization?.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }
    // Check cookies
    else if (req.cookies?.accessToken) {
        token = req.cookies.accessToken;
    }

    if (!token) {
        throw new ApiError(401, 'Not authorized. Please log in.');
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Find user and attach to request
        const user = await User.findById(decoded.id);
        
        if (!user) {
            throw new ApiError(401, 'User not found. Please log in again.');
        }

        req.user = user;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            throw new ApiError(401, 'Token expired. Please log in again.');
        }
        if (error.name === 'JsonWebTokenError') {
            throw new ApiError(401, 'Invalid token. Please log in again.');
        }
        throw error;
    }
});

/**
 * Restrict to specific roles
 * @param  {...string} roles - Allowed roles
 */
const restrictTo = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            throw new ApiError(401, 'Not authorized');
        }

        if (!roles.includes(req.user.role)) {
            throw new ApiError(403, 'You do not have permission to perform this action');
        }

        next();
    };
};

/**
 * Optional auth - Attach user if token present, but don't require it
 * Useful for guest checkout or public routes that benefit from user context
 */
const optionalAuth = asyncHandler(async (req, res, next) => {
    let token;

    // Check Authorization header
    if (req.headers.authorization?.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }
    // Check cookies
    else if (req.cookies?.accessToken) {
        token = req.cookies.accessToken;
    }

    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.id);
            if (user) {
                req.user = user;
            }
        } catch (error) {
            // Token invalid, but don't throw - just continue without user
        }
    }

    next();
});

module.exports = {
    protect,
    restrictTo,
    optionalAuth,
};
