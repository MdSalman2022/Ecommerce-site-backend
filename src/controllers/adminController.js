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

const SteadfastService = require('../services/SteadfastService');
const Order = require('../models/Order');

const sendToCourier = asyncHandler(async (req, res) => {
    const { orderId } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
        throw new ApiError(404, 'Order not found');
    }

    if (order.courierInfo && order.courierInfo.consignmentId) {
        throw new ApiError(400, 'Order already sent to courier');
    }

    const courierData = {
        invoice: order.orderId || order._id.toString().slice(-8).toUpperCase(), // Use orderId if available
        recipient_name: order.name,
        recipient_phone: order.contact,
        recipient_address: `${order.address}, ${order.city}`,
        cod_amount: order.transactionId === 'Cash on Delivery' ? order.amount : 0,
        note: 'Handle with care'
    };

    try {
        const response = await SteadfastService.createOrder(courierData);
        
        // Steadfast returns data nested under 'consignment' key
        const consignmentData = response.consignment || response;
        
        const courierInfo = {
            consignmentId: consignmentData.consignment_id,
            trackingCode: consignmentData.tracking_code,
            status: consignmentData.status,
            invoice: consignmentData.invoice,
            recipientName: consignmentData.recipient_name,
            recipientPhone: consignmentData.recipient_phone,
            codAmount: consignmentData.cod_amount,
            createdAt: consignmentData.created_at
        };
        
        // Update order with courier info
        order.courierInfo = courierInfo;
        order.orderStatus = 'shipped'; // Update status to reflect shipment
        await order.save();

        res.json({
            success: true,
            message: 'Order sent to Steadfast successfully',
            courierInfo: courierInfo
        });
    } catch (error) {
        console.error('Steadfast API Error:', error);
        throw new ApiError(500, `Courier API Error: ${error.message}`);
    }
});

const syncCourierStatus = asyncHandler(async (req, res) => {
    const { orderIds } = req.body;

    if (!orderIds || !Array.isArray(orderIds)) {
        throw new ApiError(400, 'Invalid order IDs provided');
    }

    const syncResults = [];
    const updatedOrders = [];

    for (const orderId of orderIds) {
        try {
            const order = await Order.findById(orderId);
            if (!order || !order.courierInfo || !order.courierInfo.consignmentId) {
                syncResults.push({ orderId, status: 'error', message: 'No consignment ID' });
                continue;
            }

            const response = await SteadfastService.checkStatus(order.courierInfo.consignmentId);
            
            if (response && response.status === 200) {
                const newStatus = response.delivery_status;
                
                // Only update if status has changed
                if (order.courierInfo.status !== newStatus) {
                    order.courierInfo.status = newStatus;
                    
                    // Map Steadfast status to internal status if needed
                    if (newStatus === 'delivered') order.orderStatus = 'delivered';
                    if (newStatus === 'cancelled') order.orderStatus = 'cancelled';
                    
                    await order.save();
                    updatedOrders.push({
                        _id: order._id,
                        courierInfo: order.courierInfo,
                        orderStatus: order.orderStatus
                    });
                    syncResults.push({ orderId, status: 'synced', newStatus });
                } else {
                    syncResults.push({ orderId, status: 'no_change' });
                }
            } else {
                syncResults.push({ orderId, status: 'error', message: 'API response error' });
            }
        } catch (error) {
            console.error(`Error syncing order ${orderId}:`, error);
            syncResults.push({ orderId, status: 'error', message: error.message });
        }
    }

    res.json({
        success: true,
        message: 'Sync completed',
        results: syncResults,
        updatedOrders // Return updated orders to update frontend state
    });
});

/**
 * @desc    Send low stock alert email to admin
 * @route   POST /api/admin/inventory-alert
 * @access  Private/Staff
 */
const sendInventoryAlert = asyncHandler(async (req, res) => {
    const { products } = req.body;

    if (!products || products.length === 0) {
        return res.status(400).json({ success: false, message: 'No products provided' });
    }

    const result = await emailService.sendLowStockAlert(products);
    
    res.json({
        success: result?.success || false,
        message: result?.success ? 'Low stock alert sent successfully' : 'Failed to send alert'
    });
});

module.exports = {
    getDashboardStatistics,
    getAllUsersWithRoles,
    updateUserRole,
    removeUserRole,
    getUserById,
    sendToCourier,
    syncCourierStatus,
    sendInventoryAlert
};
