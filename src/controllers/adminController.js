const { User } = require('../models');
const { ApiError, ApiResponse } = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { ROLE_HIERARCHY, outranks } = require('../constants/permissions');

const getDashboardStatistics = asyncHandler(async (req, res) => {
    const Order = require('../models/Order');
    const Product = require('../models/Product');
    
    const [totalUsers, totalProducts, totalOrders, recentOrders] = await Promise.all([
        User.countDocuments(),
        Product.countDocuments(),
        Order.countDocuments(),
        Order.find().sort({ createdAt: -1 }).limit(5).lean(),
    ]);

    const pendingOrders = await Order.countDocuments({ status: 'pending' });
    const completedOrders = await Order.countDocuments({ status: 'completed' });

    res.json(new ApiResponse(200, {
        totalUsers,
        totalProducts,
        totalOrders,
        pendingOrders,
        completedOrders,
        recentOrders,
    }));
});

const getAllUsersWithRoles = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, role, search } = req.query;
    
    const filter = {};
    if (role && ['user', 'moderator', 'admin'].includes(role)) {
        filter.role = role;
    }
    if (search) {
        filter.$or = [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
        ];
    }

    const users = await User.find(filter)
        .select('-password -refreshToken')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .lean();

    const totalUsers = await User.countDocuments(filter);

    res.json(new ApiResponse(200, {
        users,
        pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalUsers / limit),
            totalUsers,
        },
    }));
});

const updateUserRole = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { newRole } = req.body;

    if (!['user', 'moderator', 'admin'].includes(newRole)) {
        throw new ApiError(400, 'Invalid role specified');
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
        throw new ApiError(404, 'User not found');
    }

    const requestingUserRole = req.user.role;
    const targetUserCurrentRole = targetUser.role;

    if (!outranks(requestingUserRole, targetUserCurrentRole)) {
        throw new ApiError(403, 'You cannot modify a user with equal or higher role');
    }

    if (ROLE_HIERARCHY[newRole] >= ROLE_HIERARCHY[requestingUserRole]) {
        throw new ApiError(403, 'You cannot promote a user to your level or higher');
    }

    if (requestingUserRole !== 'admin' && newRole === 'admin') {
        throw new ApiError(403, 'Only admins can create new admins');
    }

    targetUser.role = newRole;
    await targetUser.save();

    res.json(new ApiResponse(200, {
        user: targetUser.toPublicJSON(),
        message: `User role updated to ${newRole}`,
    }));
});

const removeUserRole = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    const targetUser = await User.findById(userId);
    if (!targetUser) {
        throw new ApiError(404, 'User not found');
    }

    if (!outranks(req.user.role, targetUser.role)) {
        throw new ApiError(403, 'You cannot demote a user with equal or higher role');
    }

    if (targetUser.role === 'user') {
        throw new ApiError(400, 'User already has the base role');
    }

    targetUser.role = 'user';
    await targetUser.save();

    res.json(new ApiResponse(200, {
        user: targetUser.toPublicJSON(),
        message: 'User demoted to regular user',
    }));
});

const getUserById = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    const user = await User.findById(userId).select('-password -refreshToken').lean();
    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    res.json(new ApiResponse(200, { user }));
});

module.exports = {
    getDashboardStatistics,
    getAllUsersWithRoles,
    updateUserRole,
    removeUserRole,
    getUserById,
};
