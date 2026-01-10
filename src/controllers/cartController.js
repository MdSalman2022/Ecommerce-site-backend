const { AbandonedCart, Cart, Product } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { ApiResponse, ApiError } = require('../utils/ApiResponse');

/**
 * Cart Controller
 * Handles cart tracking, abandoned cart functionality, and persistent user carts
 */

/**
 * @desc    Get authenticated user's cart
 * @route   GET /api/cart
 * @access  Private
 */
/**
 * @desc    Get cart (Guest or Authenticated)
 * @route   GET /api/cart
 * @access  Public (with Session ID) or Private
 */
const getCart = asyncHandler(async (req, res) => {
    const sessionId = req.headers['x-session-id'];
    const userId = req.user?._id;

    if (!userId && !sessionId) {
        return res.json({ success: true, data: { items: [] } });
    }

    const query = userId ? { user: userId } : { sessionId };
    const cart = await Cart.findOne(query).populate('items.product');
    
    if (!cart) {
        return res.json({ success: true, data: { items: [] } });
    }

    res.json({ success: true, data: cart });
});

/**
 * @desc    Update cart (Sync from frontend - Guest & Auth)
 * @route   POST /api/cart
 * @access  Public (with Session ID) or Private
 */
const updateCart = asyncHandler(async (req, res) => {
    const { items } = req.body;
    const sessionId = req.headers['x-session-id'];
    const userId = req.user?._id;

    if (!items || !Array.isArray(items)) {
        throw new ApiError(400, 'Items array required');
    }

    if (!userId && !sessionId) {
        throw new ApiError(400, 'Session ID or User required');
    }

    const query = userId ? { user: userId } : { sessionId };
    
    // If items array is empty, delete the cart entirely
    if (items.length === 0) {
        const cart = await Cart.findOneAndDelete(query);
        
        // Also delete any associated abandoned cart
        if (cart) {
            await AbandonedCart.findOneAndDelete({ cart: cart._id });
        }
        
        return res.json({ success: true, data: { items: [] } });
    }
    
    // Prepare update object with proper upsert handling
    const updateObj = {
        $set: {
            items: items.map(item => ({
                product: item.productId,
                variantId: item.variantId,
                quantity: item.quantity
            })),
            lastActivityAt: new Date()
        },
        $setOnInsert: userId ? { user: userId } : { sessionId }
    };
    
    // Atomic update or create
    const cart = await Cart.findOneAndUpdate(
        query,
        updateObj,
        { 
            upsert: true, 
            new: true, 
            runValidators: true,
            setDefaultsOnInsert: true 
        }
    ).populate('items.product');

    res.json({ success: true, data: cart });
});

/**
 * @desc    Clear user's or guest's cart
 * @route   DELETE /api/cart
 * @access  Public (with Session ID) or Private
 */
const clearCart = asyncHandler(async (req, res) => {
    const sessionId = req.headers['x-session-id'];
    const userId = req.user?._id;

    if (!userId && !sessionId) {
        throw new ApiError(400, 'Session ID or User required');
    }

    const query = userId ? { user: userId } : { sessionId };
    const cart = await Cart.findOneAndDelete(query);
    
    // Delete associated abandoned cart if exists
    if (cart) {
        await AbandonedCart.findOneAndDelete({ cart: cart._id });
    }

    res.json({ success: true, message: 'Cart cleared' });
});

/**
 * @desc    Merge guest cart into authenticated user's cart
 * @route   POST /api/cart/merge
 * @access  Private
 */
/**
 * @desc    Merge guest cart into authenticated user's cart
 * @route   POST /api/cart/merge
 * @access  Private
 */
const mergeCart = asyncHandler(async (req, res) => {
    // We can accept sessionId headers OR explicit items body. 
    // Prefer merging from DB if sessionId provided.
    const sessionId = req.headers['x-session-id'];
    const { guestItems } = req.body; // Legacy support or fallbacks

    let itemsToMerge = [];

    // 1. Try to fetch from Guest DB Cart
    if (sessionId) {
        const guestCart = await Cart.findOne({ sessionId });
        if (guestCart && guestCart.items.length > 0) {
            // Map DB items to simple structure
            itemsToMerge = guestCart.items.map(item => ({
                productId: item.product.toString(),
                variantId: item.variantId,
                quantity: item.quantity
            }));
            
            // Clean up guest cart after merging
            await Cart.findByIdAndDelete(guestCart._id);
        }
    }

    // 2. Fallback to body items (if frontend sent them explicitly)
    if (itemsToMerge.length === 0 && guestItems && Array.isArray(guestItems)) {
        itemsToMerge = guestItems;
    }

    if (itemsToMerge.length === 0) {
         // Nothing to merge, just return user cart
         const userCart = await Cart.findOne({ user: req.user._id }).populate('items.product');
         return res.json({ success: true, data: userCart || { items: [] } });
    }

    let cart = await Cart.findOne({ user: req.user._id });

    if (!cart) {
        cart = new Cart({ user: req.user._id, items: [] });
    }

    // Merge logic: If item+variant exists, update quantity, otherwise add
    itemsToMerge.forEach(guestItem => {
        const existingItem = cart.items.find(item => 
            item.product.toString() === guestItem.productId && 
            item.variantId === guestItem.variantId
        );

        if (existingItem) {
            // Optional: Strategy could be Max, Sum, or overwrite. Sum is safest.
            existingItem.quantity += guestItem.quantity;
        } else {
            cart.items.push({
                product: guestItem.productId,
                variantId: guestItem.variantId,
                quantity: guestItem.quantity
            });
        }
    });

    cart.lastActivityAt = new Date();
    await cart.save();

    const populatedCart = await Cart.findById(cart._id).populate('items.product');
    res.json({ success: true, data: populatedCart });
});

/**
 * @desc    Track cart update (when items are added/updated - handles Guest & Auth)
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
        stage: { $ne: 'converted' } 
    });

    // If no existing cart and no contact info, skip creating (User preference: Only track leads)
    if (!cart && !email && !phone && !userId) {
        return res.json({ success: true, message: 'Skipped anonymous cart' });
    }

    if (!cart) {
        cart = new AbandonedCart({ 
            sessionId,
            userId,
            email,
            phone,
            items: items.map(item => ({
                productId: item.productId || item._id,
                name: item.name,
                image: item.image,
                price: item.price,
                quantity: item.quantity,
                totalPrice: item.price * item.quantity
            })),
            cartTotal,
            stage: 'cart_added',
            deviceInfo: {
                userAgent: req.headers['user-agent'],
                ip: req.ip
            }
        });
    } else {
        cart.items = items.map(item => ({
            productId: item.productId || item._id,
            name: item.name,
            image: item.image,
            price: item.price,
            quantity: item.quantity,
            totalPrice: item.price * item.quantity
        }));
        cart.cartTotal = cartTotal;
        cart.lastActivityAt = new Date();
        
        // If it was abandoned, reactivate it
        if (cart.stage === 'abandoned') {
            cart.stage = 'cart_added';
            cart.abandonedAt = undefined; // Clear abandoned timestamp
        }

        if (email) cart.email = email;
        if (phone) cart.phone = phone;
        if (userId) cart.userId = userId;
    }

    await cart.save();
    res.json({ success: true, cartId: cart._id });
});

/**
 * @desc    Mark checkout started (when user provides shipping info)
 * @route   POST /api/cart/checkout-started
 * @access  Public
 */
const markCheckoutStarted = asyncHandler(async (req, res) => {
    const { checkoutInfo } = req.body;
    const sessionId = req.headers['x-session-id'];
    const userId = req.user?._id;

    if (!userId && !sessionId) {
        throw new ApiError(400, 'Session ID or User required');
    }

    if (!checkoutInfo) {
        throw new ApiError(400, 'Checkout info required');
    }

    // Find the actual cart
    const query = userId ? { user: userId } : { sessionId };
    const cart = await Cart.findOne(query);

    if (!cart) {
        throw new ApiError(404, 'Cart not found');
    }

    // Check if abandoned cart already exists for this cart
    let abandonedCart = await AbandonedCart.findOne({ cart: cart._id });

    if (!abandonedCart) {
        // Create new abandoned cart tracking
        abandonedCart = new AbandonedCart({
            cart: cart._id,
            email: checkoutInfo.email,
            phone: checkoutInfo.contact,
            checkoutInfo,
            stage: 'checkout_info_filled',
            checkoutStartedAt: new Date(),
            lastActivityAt: new Date()
        });
    } else {
        // Update existing
        abandonedCart.checkoutInfo = checkoutInfo;
        abandonedCart.email = checkoutInfo.email;
        abandonedCart.phone = checkoutInfo.contact;
        abandonedCart.stage = 'checkout_info_filled';
        abandonedCart.lastActivityAt = new Date();
    }

    await abandonedCart.save();
    res.json({ success: true, stage: abandonedCart.stage });
});

/**
 * @desc    Mark cart as converted (order placed) and cleanup
 * @route   POST /api/cart/converted
 * @access  Public
 */
const markCartConverted = asyncHandler(async (req, res) => {
    const { orderId } = req.body;
    const sessionId = req.headers['x-session-id'];
    const userId = req.user?._id;

    if (!userId && !sessionId) {
        throw new ApiError(400, 'Session ID or User required');
    }

    // Find the cart
    const query = userId ? { user: userId } : { sessionId };
    const cart = await Cart.findOne(query);

    if (cart) {
        // Delete the abandoned cart (if exists) - we keep it marked as converted for a brief moment for analytics
        await AbandonedCart.findOneAndDelete({ cart: cart._id });

        // Delete the cart (order is now created)
        await Cart.findByIdAndDelete(cart._id);
    }

    res.json({ success: true });
});

/**
 * @desc    Get abandoned carts for dashboard
 * @route   GET /api/cart/abandoned
 * @access  Private/Admin
 */
const getAbandonedCarts = asyncHandler(async (req, res) => {
    const ONE_HOUR = 60 * 60 * 1000;
    const abandonmentThreshold = new Date(Date.now() - ONE_HOUR);

    // Mark carts with no activity as abandoned
    await AbandonedCart.updateMany(
        {
            stage: { $in: ['checkout_started', 'checkout_info_filled'] },
            lastActivityAt: { $lt: abandonmentThreshold }
        },
        {
            $set: { stage: 'abandoned', abandonedAt: new Date() }
        }
    );

    // Fetch abandoned carts and populate cart data
    const abandonedCarts = await AbandonedCart.find({
        stage: 'abandoned'
    })
    .populate({
        path: 'cart',
        populate: {
            path: 'items.product',
            select: 'name images variants'
        }
    })
    .sort({ abandonedAt: -1 })
    .limit(100);

    // Format the response with calculated totals
    const formattedCarts = abandonedCarts.map(ac => {
        if (!ac.cart) {
            // Cart was deleted but abandoned cart record remains
            return {
                _id: ac._id,
                email: ac.email,
                phone: ac.phone,
                checkoutInfo: ac.checkoutInfo,
                stage: ac.stage,
                abandonedAt: ac.abandonedAt,
                items: [],
                cartTotal: 0,
                note: 'Cart data no longer available'
            };
        }

        // Calculate items and total from cart
        const items = ac.cart.items.map(item => {
            if (!item.product) return null;
            
            const variant = item.product.variants?.find(v => v._id.toString() === item.variantId) || item.product.variants?.[0];
            const price = variant ? (variant.salePrice > 0 ? variant.salePrice : variant.regularPrice) : 0;
            
            return {
                productId: item.product._id,
                name: item.product.name,
                image: variant?.images?.[0] || item.product.images?.[0],
                price,
                quantity: item.quantity,
                totalPrice: price * item.quantity
            };
        }).filter(Boolean);

        const cartTotal = items.reduce((sum, item) => sum + item.totalPrice, 0);

        return {
            _id: ac._id,
            cartId: ac.cart._id,
            email: ac.email,
            phone: ac.phone,
            checkoutInfo: ac.checkoutInfo,
            stage: ac.stage,
            checkoutStartedAt: ac.checkoutStartedAt,
            abandonedAt: ac.abandonedAt,
            lastActivityAt: ac.lastActivityAt,
            items,
            cartTotal,
            recoveryEmailSent: ac.recoveryEmailSent
        };
    });

    const totalValue = formattedCarts.reduce((sum, c) => sum + (c.cartTotal || 0), 0);

    res.json({
        success: true,
        data: {
            carts: formattedCarts,
            stats: {
                count: formattedCarts.length,
                totalValue
            }
        }
    });
});

module.exports = {
    getCart,
    updateCart,
    clearCart,
    mergeCart,
    trackCartUpdate,
    markCheckoutStarted,
    markCartConverted,
    getAbandonedCarts,
};
