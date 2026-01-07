const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Import routes
const { apiRoutes, legacyRoutes } = require('./routes');

// Import middleware
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

/**
 * Express Application Configuration
 * Sets up middleware, routes, and error handling
 */
const app = express();

// ============================================
// Security Middleware
// ============================================
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
        success: false,
        message: 'Too many requests, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Apply rate limiting to API routes only
app.use('/api', limiter);

// ============================================
// Body Parsing Middleware
// ============================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================
// CORS Configuration
// ============================================
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ============================================
// Health Check Route (root)
// ============================================
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'BestDeal Portal Server is running',
        version: '2.0.0',
    });
});

// ============================================
// API Routes
// ============================================
// RESTful API routes under /api prefix
app.use('/api', apiRoutes);

// Legacy routes at root level for backward compatibility
app.use('/', legacyRoutes);

// ============================================
// Error Handling
// ============================================
// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

module.exports = app;
