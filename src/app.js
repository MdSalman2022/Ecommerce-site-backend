const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

const passport = require('./config/passport');
const { apiRoutes, legacyRoutes } = require('./routes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { userRateLimiter, authRateLimiter, aiRateLimiter } = require('./middleware/rateLimitMiddleware');
const { optionalAuth } = require('./middleware/authMiddleware');

const app = express();

app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

app.use(passport.initialize());

const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
app.use(cors({
    origin: corsOrigin === '*' ? true : corsOrigin.split(',').map(o => o.trim()),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
}));

app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'BestDeal Portal Server is running',
        version: '2.0.0',
    });
});

app.use('/api/auth', authRateLimiter);
app.use('/api/ai', aiRateLimiter);
app.use('/api', optionalAuth, userRateLimiter);

app.use('/api', apiRoutes);
app.use('/', legacyRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;

