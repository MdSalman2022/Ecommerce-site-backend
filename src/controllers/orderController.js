const { Order } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { ApiResponse, ApiError } = require('../utils/ApiResponse');
const emailService = require('../services/emailService');

/**
 * @desc    Get all orders
 * @route   GET /api/orders
 * @access  Private/Admin
 */
const getAllOrders = asyncHandler(async (req, res) => {
    const orders = await Order.find().sort({ createdAt: -1 });
    // Return plain array for frontend compatibility
    res.json(orders);
});

/**
 * @desc    Get orders by email
 * @route   GET /api/orders/user/:email
 * @access  Private/Admin
 */
const getOrdersByEmail = asyncHandler(async (req, res) => {
    const orders = await Order.find({ email: req.params.email }).sort({ createdAt: -1 });
    res.json(orders);
});

/**
 * @desc    Get order by ID
 * @route   GET /api/orders/:id
 * @access  Private
 */
const getOrderById = asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);

    if (!order) {
        throw new ApiError(404, 'Order not found');
    }

    res.json(order);
});

/**
 * @desc    Create new order
 * @route   POST /api/orders
 * @access  Private
 */
/**
 * Generate Custom Order ID
 * Format: ORDYYYYMMDDXXXX (e.g., ORD202410050001)
 */
const generateOrderId = async () => {
    const date = new Date();
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const todayPrefix = `ORD${yyyy}${mm}${dd}`;

    // Find the last order created today
    const lastOrder = await Order.findOne({ 
        orderId: { $regex: new RegExp(`^${todayPrefix}`) } 
    }).sort({ createdAt: -1 });

    let nextNum = 1;
    if (lastOrder && lastOrder.orderId) {
        const currentStr = lastOrder.orderId.replace(todayPrefix, '');
        const currentNum = parseInt(currentStr, 10);
        if (!isNaN(currentNum)) {
            nextNum = currentNum + 1;
        }
    }

    const suffix = String(nextNum).padStart(4, '0');
    return `${todayPrefix}${suffix}`;
};

const createOrder = asyncHandler(async (req, res) => {
    const orderData = req.body;
    
    // Generate Custom Order ID
    orderData.orderId = await generateOrderId();

    const order = await Order.create(orderData);
    
    // Send order confirmation email (non-blocking)
    if (order.email) {
        const emailData = {
            email: order.email,
            name: order.name || 'Customer',
            orderId: order.orderId, // Use the new custom ID
            items: order.items || [], // Corrected field access
            total: (order.amount || 0) / 100, // Convert from cents
            discount: order.discountAmount || 0,
            promoCode: order.promoCode || null,
            address: order.address || '',
            city: order.city || '',
        };
        
        emailService.sendOrderConfirmation(emailData)
            .then(result => {
                if (result && result.success) {
                    console.log(`Order confirmation email sent to ${order.email}`);
                }
            })
            .catch(err => console.error('Email error:', err));
    }
    
    res.status(201).json(order);
});

/**
 * @desc    Update order status (shipment)
 * @route   PUT /api/orders/status
 * @access  Private/Admin
 */
const updateOrderStatus = asyncHandler(async (req, res) => {
    const { ids, status } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        throw new ApiError(400, 'Please provide order IDs');
    }

    const result = await Order.updateMany(
        { _id: { $in: ids } },
        { orderStatus: status } // Update orderStatus instead of shipment
    );

    // Send shipping update emails (non-blocking)
    if (result.modifiedCount > 0) {
        Order.find({ _id: { $in: ids } })
            .then(orders => {
                orders.forEach(order => {
                    if (order.email) {
                        emailService.sendShippingUpdate({
                            email: order.email,
                            name: order.name || 'Customer',
                            orderId: order.orderId || order._id.toString().slice(-8).toUpperCase(),
                            status: status,
                        }).catch(err => console.error('Shipping update email error:', err));
                    }
                });
            })
            .catch(err => console.error('Find orders error:', err));
    }

    res.json({ modifiedCount: result.modifiedCount });
});

/**
 * @desc    Cancel orders
 * @route   PUT /api/orders/cancel
 * @access  Private/Admin
 */
const cancelOrders = asyncHandler(async (req, res) => {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        throw new ApiError(400, 'Please provide order IDs');
    }

    const result = await Order.updateMany(
        { _id: { $in: ids } },
        { orderStatus: false }
    );

    res.json({ modifiedCount: result.modifiedCount });
});

/**
 * @desc    Delete orders
 * @route   DELETE /api/orders
 * @access  Private/Admin
 */
const deleteOrders = asyncHandler(async (req, res) => {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        throw new ApiError(400, 'Please provide order IDs to delete');
    }

    const result = await Order.deleteMany({ _id: { $in: ids } });

    res.json({ deletedCount: result.deletedCount });
});

module.exports = {
    getAllOrders,
    getOrdersByEmail,
    getOrderById,
    createOrder,
    updateOrderStatus,
    cancelOrders,
    deleteOrders,
};
