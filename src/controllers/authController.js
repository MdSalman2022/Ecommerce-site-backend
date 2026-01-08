const passport = require('passport');
const { User } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { ApiError, ApiResponse } = require('../utils/ApiResponse');

/**
 * Auth Controller
 * Handles user authentication: register, login, OAuth, and token management
 */

// Cookie options for JWT tokens
const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

/**
 * @desc    Register new user with email/password
 * @route   POST /api/auth/register
 * @access  Public
 */
const register = asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;

    // Validate input
    if (!name || !email || !password) {
        throw new ApiError(400, 'Please provide name, email, and password');
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        throw new ApiError(400, 'Email already registered. Please log in.');
    }

    // Create user
    const user = await User.create({
        name,
        email,
        password,
        authProvider: 'local',
    });

    // Generate tokens
    const accessToken = user.generateAuthToken();
    const refreshToken = user.generateRefreshToken();
    await user.save();

    // Set cookies
    res.cookie('accessToken', accessToken, cookieOptions);
    res.cookie('refreshToken', refreshToken, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 * 1000 });

    res.status(201).json({
        success: true,
        message: 'Registration successful',
        user: user.toPublicJSON(),
        accessToken,
    });
});

/**
 * @desc    Login with email/password
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = asyncHandler(async (req, res, next) => {
    passport.authenticate('local', { session: false }, async (err, user, info) => {
        if (err) {
            return next(err);
        }

        if (!user) {
            return res.status(401).json({
                success: false,
                message: info?.message || 'Invalid credentials',
            });
        }

        // Update last login
        user.lastLogin = new Date();
        
        // Generate tokens
        const accessToken = user.generateAuthToken();
        const refreshToken = user.generateRefreshToken();
        await user.save();

        // Set cookies
        res.cookie('accessToken', accessToken, cookieOptions);
        res.cookie('refreshToken', refreshToken, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 * 1000 });

        res.json({
            success: true,
            message: 'Login successful',
            user: user.toPublicJSON(),
            accessToken,
        });
    })(req, res, next);
});

/**
 * @desc    Get current logged in user
 * @route   GET /api/auth/me
 * @access  Private
 */
const getMe = asyncHandler(async (req, res) => {
    res.json({
        success: true,
        user: req.user.toPublicJSON(),
    });
});

/**
 * @desc    Logout user
 * @route   POST /api/auth/logout
 * @access  Private
 */
const logout = asyncHandler(async (req, res) => {
    // Clear refresh token in database
    if (req.user) {
        req.user.refreshToken = undefined;
        await req.user.save();
    }

    // Clear cookies
    res.cookie('accessToken', '', { ...cookieOptions, maxAge: 0 });
    res.cookie('refreshToken', '', { ...cookieOptions, maxAge: 0 });

    res.json({
        success: true,
        message: 'Logged out successfully',
    });
});

/**
 * @desc    Refresh access token
 * @route   POST /api/auth/refresh
 * @access  Public (with refresh token)
 */
const refreshToken = asyncHandler(async (req, res) => {
    const token = req.cookies?.refreshToken || req.body.refreshToken;

    if (!token) {
        throw new ApiError(401, 'No refresh token provided');
    }

    try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findById(decoded.id).select('+refreshToken');
        
        if (!user || user.refreshToken !== token) {
            throw new ApiError(401, 'Invalid refresh token');
        }

        // Generate new access token
        const accessToken = user.generateAuthToken();
        res.cookie('accessToken', accessToken, cookieOptions);

        res.json({
            success: true,
            accessToken,
        });
    } catch (error) {
        throw new ApiError(401, 'Invalid or expired refresh token');
    }
});

/**
 * @desc    Google OAuth callback
 * @route   GET /api/auth/google/callback
 * @access  Public
 */
const googleCallback = asyncHandler(async (req, res) => {
    const user = req.user;

    // Generate tokens
    const accessToken = user.generateAuthToken();
    const refreshToken = user.generateRefreshToken();
    await user.save();

    // Set cookies
    res.cookie('accessToken', accessToken, cookieOptions);
    res.cookie('refreshToken', refreshToken, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 * 1000 });

    // Redirect to frontend with success
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/auth/callback?success=true`);
});

/**
 * @desc    Facebook OAuth callback
 * @route   GET /api/auth/facebook/callback
 * @access  Public
 */
const facebookCallback = asyncHandler(async (req, res) => {
    const user = req.user;

    // Generate tokens
    const accessToken = user.generateAuthToken();
    const refreshToken = user.generateRefreshToken();
    await user.save();

    // Set cookies
    res.cookie('accessToken', accessToken, cookieOptions);
    res.cookie('refreshToken', refreshToken, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 * 1000 });

    // Redirect to frontend with success
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/auth/callback?success=true`);
});

/**
 * @desc    Update user password
 * @route   PUT /api/auth/password
 * @access  Private
 */
const updatePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        throw new ApiError(400, 'Please provide current and new password');
    }

    // Get user with password
    const user = await User.findById(req.user._id).select('+password');

    if (user.authProvider !== 'local') {
        throw new ApiError(400, `Password cannot be changed for ${user.authProvider} accounts`);
    }

    // Check current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
        throw new ApiError(401, 'Current password is incorrect');
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Generate new tokens
    const accessToken = user.generateAuthToken();
    res.cookie('accessToken', accessToken, cookieOptions);

    res.json({
        success: true,
        message: 'Password updated successfully',
    });
});

module.exports = {
    register,
    login,
    getMe,
    logout,
    refreshToken,
    googleCallback,
    facebookCallback,
    updatePassword,
};
