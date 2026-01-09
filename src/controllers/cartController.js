const { AbandonedCart } = require('../models');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Cart Controller
 * Handles cart tracking and abandoned cart functionality
 */

/**
 * @desc    Track cart update (when items are added/updated)
 * @route   POST /api/cart/track
 * @access  Public
 */
const trackCartUpdate = asyncHandler(async (req, res) => {
    const { sessionId, items, cartTotal, userId, email, phone } = req.body;
    
    if (!sessionId) {
        return res.status(400).json({ success: false, message: 'Session ID required' });
    }

    let cart = await AbandonedCart.findOne({ 
        sessionId, 
        stage: { $nin: ['converted', 'abandoned'] } 
    });

    if (!cart) {
        cart = new AbandonedCart({ 
            sessionId,
            userId,
            email,
            phone,
            items,
            cartTotal,
            stage: 'cart_added',
            deviceInfo: {
                userAgent: req.headers['user-agent'],
                ip: req.ip
            }
        });
    } else {
        cart.items = items;
        cart.cartTotal = cartTotal;
        cart.lastActivityAt = new Date();
        if (email) cart.email = email;
        if (phone) cart.phone = phone;
        if (userId) cart.userId = userId;
    }

    await cart.save();
    res.json({ success: true, cartId: cart._id });
});

/**
 * @desc    Mark checkout started (when user enters checkout page)
 * @route   POST /api/cart/checkout-started
 * @access  Public
 */
const markCheckoutStarted = asyncHandler(async (req, res) => {
    const { sessionId, checkoutInfo } = req.body;

    if (!sessionId) {
        return res.status(400).json({ success: false, message: 'Session ID required' });
    }

    const cart = await AbandonedCart.findOne({ 
        sessionId, 
        stage: { $nin: ['converted', 'abandoned'] } 
    });

    if (!cart) {
        return res.status(404).json({ success: false, message: 'Cart session not found' });
    }

    cart.stage = 'checkout_started';
    cart.checkoutStartedAt = new Date();
    cart.lastActivityAt = new Date();
    
    if (checkoutInfo) {
        cart.checkoutInfo = checkoutInfo;
        cart.stage = 'checkout_info_filled';
        if (checkoutInfo.email) cart.email = checkoutInfo.email;
        if (checkoutInfo.contact) cart.phone = checkoutInfo.contact;
    }

    await cart.save();
    res.json({ success: true, stage: cart.stage });
});

/**
 * @desc    Mark cart as converted (order was placed)
 * @route   POST /api/cart/converted
 * @access  Public
 */
const markCartConverted = asyncHandler(async (req, res) => {
    const { sessionId, orderId } = req.body;

    if (!sessionId) {
        return res.status(400).json({ success: false, message: 'Session ID required' });
    }

    const cart = await AbandonedCart.findOne({ 
        sessionId, 
        stage: { $nin: ['converted', 'abandoned'] } 
    });

    if (cart) {
        cart.stage = 'converted';
        cart.convertedAt = new Date();
        cart.orderId = orderId;
        await cart.save();
    }

    res.json({ success: true });
});

/**
 * @desc    Get abandoned carts for dashboard
 * @route   GET /api/cart/abandoned
 * @access  Private/Admin
 */
const getAbandonedCarts = asyncHandler(async (req, res) => {
    // Mark old checkout_started carts as abandoned (older than 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    await AbandonedCart.updateMany(
        {
            stage: { $in: ['checkout_started', 'checkout_info_filled'] },
            lastActivityAt: { $lt: twentyFourHoursAgo }
        },
        {
            $set: { stage: 'abandoned', abandonedAt: new Date() }
        }
    );

    // Get abandoned carts with checkout info
    const abandonedCarts = await AbandonedCart.find({
        stage: 'abandoned'
    })
    .sort({ abandonedAt: -1 })
    .limit(100);

    // Get stats
    const stats = await AbandonedCart.aggregate([
        {
            $group: {
                _id: '$stage',
                count: { $sum: 1 },
                totalValue: { $sum: '$cartTotal' }
            }
        }
    ]);

    res.json({
        success: true,
        data: {
            carts: abandonedCarts,
            stats: stats.reduce((acc, curr) => {
                acc[curr._id] = { count: curr.count, totalValue: curr.totalValue };
                return acc;
            }, {})
        }
    });
});

module.exports = {
    trackCartUpdate,
    markCheckoutStarted,
    markCartConverted,
    getAbandonedCarts,
};
