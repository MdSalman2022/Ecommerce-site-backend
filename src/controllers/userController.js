const { User } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { ApiResponse, ApiError } = require('../utils/ApiResponse');
const { sendWelcomeEmail } = require('../services/emailService');

/**
 * @desc    Get all users
 * @route   GET /api/users
 * @access  Private/Admin
 */
const getAllUsers = asyncHandler(async (req, res) => {
    const users = await User.find().sort({ createdAt: -1 });
    // Return plain array for frontend compatibility
    res.json(users);
});

/**
 * @desc    Get user by email
 * @route   GET /api/users/:email
 * @access  Private
 */
const getUserByEmail = asyncHandler(async (req, res) => {
    const user = await User.findOne({ email: req.params.email });

    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    res.json(user);
});

/**
 * @desc    Create/Register new user
 * @route   POST /api/users
 * @access  Public
 */
const createUser = asyncHandler(async (req, res) => {
    const { email } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        return res.json(existingUser);
    }

    const user = await User.create(req.body);

    // Send welcome email (asynchronous, don't block response)
    sendWelcomeEmail({ email: user.email, name: user.orderName || user.name || 'Valued Customer' })
        .catch(err => console.error('Failed to send welcome email:', err));

    res.status(201).json(user);
});

/**
 * @desc    Update user card information
 * @route   PUT /api/users/card
 * @access  Private
 */
const updateCardInfo = asyncHandler(async (req, res) => {
    const { email, cardnumber } = req.body;

    if (!email) {
        throw new ApiError(400, 'Email is required');
    }

    const user = await User.findOneAndUpdate(
        { email },
        { cardnumber },
        { new: true, upsert: true, runValidators: true }
    );

    res.json(user);
});

/**
 * @desc    Update user delivery information
 * @route   PUT /api/users/delivery
 * @access  Private
 */
const updateDeliveryInfo = asyncHandler(async (req, res) => {
    const { email, address, orderName, contact, city } = req.body;

    if (!email) {
        throw new ApiError(400, 'Email is required');
    }

    const user = await User.findOneAndUpdate(
        { email },
        { address, orderName, contact, city },
        { new: true, upsert: true, runValidators: true }
    );

    res.json(user);
});

module.exports = {
    getAllUsers,
    getUserByEmail,
    createUser,
    updateCardInfo,
    updateDeliveryInfo,
};
