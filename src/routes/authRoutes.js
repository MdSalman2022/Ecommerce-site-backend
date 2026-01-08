const express = require('express');
const passport = require('passport');
const router = express.Router();

const {
    register,
    login,
    getMe,
    logout,
    refreshToken,
    googleCallback,
    facebookCallback,
    updatePassword,
} = require('../controllers/authController');

const { protect } = require('../middleware/authMiddleware');

/**
 * Auth Routes
 * Base path: /api/auth
 */

// ============================================
// Local Authentication (Email/Password)
// ============================================

// Register new user
router.post('/register', register);

// Login with email/password
router.post('/login', login);

// Logout
router.post('/logout', protect, logout);

// Refresh access token
router.post('/refresh', refreshToken);

// Get current user profile
router.get('/me', protect, getMe);

// Update password
router.put('/password', protect, updatePassword);

// ============================================
// Google OAuth
// ============================================

// Start Google OAuth flow
router.get('/google', 
    passport.authenticate('google', { 
        scope: ['profile', 'email'],
        session: false 
    })
);

// Google OAuth callback
router.get('/google/callback',
    passport.authenticate('google', { 
        session: false,
        failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=google_auth_failed`
    }),
    googleCallback
);

// ============================================
// Facebook OAuth
// ============================================

// Start Facebook OAuth flow
router.get('/facebook',
    passport.authenticate('facebook', { 
        scope: ['email'],
        session: false 
    })
);

// Facebook OAuth callback
router.get('/facebook/callback',
    passport.authenticate('facebook', { 
        session: false,
        failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=facebook_auth_failed`
    }),
    facebookCallback
);

module.exports = router;
