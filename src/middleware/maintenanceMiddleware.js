const StoreSettings = require('../models/SiteSettings');
const { ApiError } = require('../utils/ApiResponse');
 
const maintenanceMiddleware = async (req, res, next) => {
    try {
        const settings = await StoreSettings.getSettings();
        
        // If maintenance is disabled, proceed
        if (!settings.maintenance?.enabled) {
            return next();
        }

        // Always allow admins
        if (req.user && (req.user.role === 'admin' || req.user.role === 'moderator')) {
            return next();
        }

        // Define routes that should ALWAYS be accessible
        // Use regex or string matching to allow auth, settings, and health check
        const allowedPaths = [
            '/api/auth',
            '/api/settings',
            '/api/health',
            '/api/users/profile', // Basic user profile check
            '/api/upload', // Allow uploads potentially
            '/api/categories', // Allow categories for public/admin visibility
            '/api/products', // Allow products for public/admin visibility
            '/api/page-builder', // Allow page configuration
        ];

        const isAllowedPath = allowedPaths.some(path => req.originalUrl.startsWith(path));
        if (isAllowedPath) {
            return next();
        }

        // Return 503 Service Unavailable for all other paths
        res.status(503).json({
            success: false,
            maintenance: true,
            message: settings.maintenance.message || 'We are currently under maintenance. Please check back soon!',
        });
    } catch (error) {
        console.error('Maintenance middleware error:', error);
        next(); // Proceed if we can't check settings to avoid breaking site entirely
    }
};

module.exports = maintenanceMiddleware;
