const { ApiError } = require('../utils/ApiResponse');
const { 
    PERMISSIONS, 
    hasPermission, 
    hasAllPermissions, 
    hasAnyPermission,
    outranks 
} = require('../constants/permissions');

// RBAC Middleware: Permission-based authorization

// Authorize middleware - Check if user has ALL required permissions
const authorize = (...requiredPermissions) => {
    return (req, res, next) => {
        if (!req.user) {
            throw new ApiError(401, 'Authentication required');
        }

        const userRole = req.user.role;
        
        if (!hasAllPermissions(userRole, requiredPermissions)) {
            throw new ApiError(
                403, 
                'You do not have permission to perform this action'
            );
        }

        next();
    };
};

// Authorize any - Check if user has ANY of the required permissions
const authorizeAny = (...anyPermissions) => {
    return (req, res, next) => {
        if (!req.user) {
            throw new ApiError(401, 'Authentication required');
        }

        const userRole = req.user.role;
        
        if (!hasAnyPermission(userRole, anyPermissions)) {
            throw new ApiError(
                403, 
                'You do not have permission to perform this action'
            );
        }

        next();
    };
};

// Admin only middleware - Shorthand for admin-only routes
const adminOnly = (req, res, next) => {
    if (!req.user) {
        throw new ApiError(401, 'Authentication required');
    }

    if (req.user.role !== 'admin') {
        throw new ApiError(403, 'Admin access required');
    }

    next();
};

// Staff only middleware - Allows admin and moderator
const staffOnly = (req, res, next) => {
    if (!req.user) {
        throw new ApiError(401, 'Authentication required');
    }

    if (!['admin', 'moderator'].includes(req.user.role)) {
        throw new ApiError(403, 'Staff access required');
    }

    next();
};

// Check permission middleware - For conditional logic in controllers
const attachPermissions = (req, res, next) => {
    req.hasPermission = (permission) => {
        if (!req.user) return false;
        return hasPermission(req.user.role, permission);
    };
    
    req.canManage = (targetRole) => {
        if (!req.user) return false;
        return outranks(req.user.role, targetRole);
    };
    
    next();
};

// Resource ownership check - Ensure user owns the resource or has override permission
const ownerOrPermission = (overridePermission) => {
    return (req, res, next) => {
        if (!req.user) {
            throw new ApiError(401, 'Authentication required');
        }

        // Check if user has override permission (admin/moderator)
        if (hasPermission(req.user.role, overridePermission)) {
            return next();
        }

        // Otherwise, ownership check must be performed in the controller
        req.requireOwnership = true;
        next();
    };
};

module.exports = {
    authorize,
    authorizeAny,
    adminOnly,
    staffOnly,
    attachPermissions,
    ownerOrPermission,
    PERMISSIONS, // Re-export for convenience
};
