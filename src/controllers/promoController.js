const PromoCode = require('../models/PromoCode');
const PromoCodeUsage = require('../models/PromoCodeUsage');
const asyncHandler = require('../utils/asyncHandler');
const { ApiError } = require('../utils/ApiResponse');

/**
 * @desc    Get all promo codes (admin)
 * @route   GET /api/promo
 * @access  Private/Admin
 */
const getAllPromoCodes = asyncHandler(async (req, res) => {
    const promoCodes = await PromoCode.find().sort({ createdAt: -1 });
    res.json({
        success: true,
        count: promoCodes.length,
        promoCodes,
    });
});

/**
 * @desc    Get active promo codes
 * @route   GET /api/promo/active
 * @access  Public
 */
const getActivePromoCodes = asyncHandler(async (req, res) => {
    const now = new Date();
    const promoCodes = await PromoCode.find({
        isActive: true,
        validFrom: { $lte: now },
        validUntil: { $gte: now },
        $or: [
            { usageLimit: null },
            { $expr: { $lt: ['$usedCount', '$usageLimit'] } },
        ],
    }).select('code description discountType discountValue minOrderAmount maxDiscount validUntil');

    res.json({
        success: true,
        count: promoCodes.length,
        promoCodes,
    });
});

/**
 * @desc    Validate and apply promo code
 * @route   POST /api/promo/validate
 * @access  Public
 */
const validatePromoCode = asyncHandler(async (req, res) => {
    const { code, orderTotal, cartItems } = req.body;

    if (!code) {
        throw new ApiError(400, 'Promo code is required');
    }

    const promoCode = await PromoCode.findOne({ code: code.toUpperCase() });

    if (!promoCode) {
        return res.status(404).json({
            success: false,
            error: 'Invalid promo code',
        });
    }

    // If cart items provided, use targeted discount calculation
    let discount, targetedSubtotal, eligibleItemCount;
    
    if (cartItems && Array.isArray(cartItems) && cartItems.length > 0) {
        const result = promoCode.calculateDiscountForCart(cartItems);
        discount = result.discount;
        targetedSubtotal = result.targetedSubtotal;
        eligibleItemCount = result.eligibleItemCount;
        
        // Check if any items are eligible
        if (eligibleItemCount === 0) {
            return res.status(400).json({
                success: false,
                error: 'This promo code is not applicable to items in your cart',
            });
        }
        
        // Validate against targeted subtotal
        const validation = promoCode.validateForOrder(targetedSubtotal);
        if (!validation.isValid) {
            return res.status(400).json({
                success: false,
                error: validation.errors[0],
                errors: validation.errors,
            });
        }
    } else {
        // Legacy: use simple total-based calculation
        const validation = promoCode.validateForOrder(orderTotal || 0);
        if (!validation.isValid) {
            return res.status(400).json({
                success: false,
                error: validation.errors[0],
                errors: validation.errors,
            });
        }
        discount = promoCode.calculateDiscount(orderTotal || 0);
        targetedSubtotal = orderTotal || 0;
    }

    res.json({
        success: true,
        discount,
        targetedSubtotal,
        promoCode: {
            code: promoCode.code,
            description: promoCode.description,
            discountType: promoCode.discountType,
            discountValue: promoCode.discountValue,
        },
        newTotal: (orderTotal || 0) - discount,
    });
});

/**
 * @desc    Apply promo code (increment usage)
 * @route   POST /api/promo/apply
 * @access  Private
 */
const applyPromoCode = asyncHandler(async (req, res) => {
    const { code, orderTotal, orderId } = req.body;

    if (!code) {
        throw new ApiError(400, 'Promo code is required');
    }

    const promoCode = await PromoCode.findOne({ code: code.toUpperCase() });

    if (!promoCode) {
        throw new ApiError(404, 'Invalid promo code');
    }

    // Validate
    const validation = promoCode.validateForOrder(orderTotal || 0);
    if (!validation.isValid) {
        throw new ApiError(400, validation.errors[0]);
    }

    // Calculate discount and increment usage
    const discount = promoCode.calculateDiscount(orderTotal || 0);
    promoCode.usedCount += 1;
    await promoCode.save();

    res.json({
        success: true,
        discount,
        message: `Promo code ${code} applied successfully`,
    });
});

/**
 * @desc    Create promo code (admin)
 * @route   POST /api/promo
 * @access  Private/Admin
 */
const createPromoCode = asyncHandler(async (req, res) => {
    const { 
        code, 
        description, 
        discountType, 
        discountValue, 
        minOrderAmount, 
        maxDiscount, 
        usageLimit, 
        validFrom, 
        validUntil, 
        applicableCategories,
        applicableProducts,
        minItemQuantity,
        perUserLimit
    } = req.body;

    // Check if code already exists
    const existing = await PromoCode.findOne({ code: code.toUpperCase() });
    if (existing) {
        throw new ApiError(400, 'Promo code already exists');
    }

    const promoCode = await PromoCode.create({
        code: code.toUpperCase(),
        description,
        discountType,
        discountValue,
        minOrderAmount,
        maxDiscount,
        usageLimit,
        validFrom,
        validUntil,
        applicableCategories,
        applicableProducts,
        minItemQuantity,
        perUserLimit,
    });

    res.status(201).json({
        success: true,
        promoCode,
    });
});

/**
 * @desc    Update promo code (admin)
 * @route   PUT /api/promo/:id
 * @access  Private/Admin
 */
const updatePromoCode = asyncHandler(async (req, res) => {
    const promoCode = await PromoCode.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
    );

    if (!promoCode) {
        throw new ApiError(404, 'Promo code not found');
    }

    res.json({
        success: true,
        promoCode,
    });
});

/**
 * @desc    Delete promo code (admin)
 * @route   DELETE /api/promo/:id
 * @access  Private/Admin
 */
const deletePromoCode = asyncHandler(async (req, res) => {
    const promoCode = await PromoCode.findByIdAndDelete(req.params.id);

    if (!promoCode) {
        throw new ApiError(404, 'Promo code not found');
    }

    res.json({
        success: true,
        message: 'Promo code deleted',
    });
});

/**
 * @desc    Toggle promo code active status (admin)
 * @route   PATCH /api/promo/:id/toggle
 * @access  Private/Admin
 */
const togglePromoCode = asyncHandler(async (req, res) => {
    const promoCode = await PromoCode.findById(req.params.id);

    if (!promoCode) {
        throw new ApiError(404, 'Promo code not found');
    }

    promoCode.isActive = !promoCode.isActive;
    await promoCode.save();

    res.json({
        success: true,
        isActive: promoCode.isActive,
        message: `Promo code ${promoCode.isActive ? 'activated' : 'deactivated'}`,
    });
});

/**
 * @desc    Get detailed usage history for a promo code (admin)
 * @route   GET /api/promo/:id/usage
 * @access  Private/Admin
 */
const getPromoUsageHistory = asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    // Optional: Filter by specific code if ID is not available or search by code
    const usage = await PromoCodeUsage.find({ promoCodeId: id })
        .populate('orderId', 'orderId amount createdAt') // Link to order data
        .sort({ createdAt: -1 });

    res.json({
        success: true,
        count: usage.length,
        usage,
    });
});

/**
 * @desc    Get intelligent promo suggestions based on cart state
 * @route   GET /api/promo/suggestions
 * @access  Public
 */
const getPromoSuggestions = asyncHandler(async (req, res) => {
    const { cartTotal = 0, itemCount = 0, categoryIds = '', productIds = '' } = req.query;
    
    const total = parseFloat(cartTotal);
    const items = parseInt(itemCount);
    const categories = categoryIds ? categoryIds.split(',') : [];
    const products = productIds ? productIds.split(',') : [];
    
    const now = new Date();
    
    // Find all active, valid promos
    const allPromos = await PromoCode.find({
        isActive: true,
        validFrom: { $lte: now },
        validUntil: { $gte: now },
        $or: [
            { usageLimit: null },
            { $expr: { $lt: ['$usedCount', '$usageLimit'] } }
        ]
    });
    
    const suggestions = [];
    
    for (const promo of allPromos) {
        const suggestion = {
            code: promo.code,
            description: promo.description,
            discountType: promo.discountType,
            discountValue: promo.discountValue,
            potentialSavings: 0,
            requirements: [],
            gap: {},
            progress: 0,
            isUnlocked: true
        };
        
        // Check minimum order amount
        if (promo.minOrderAmount && total < promo.minOrderAmount) {
            suggestion.isUnlocked = false;
            const amountGap = promo.minOrderAmount - total;
            suggestion.gap.amount = amountGap;
            suggestion.requirements.push(`Add ৳${Math.ceil(amountGap)} more`);
            suggestion.progress = Math.min((total / promo.minOrderAmount) * 100, 99);
        }
        
        // Check minimum item quantity
        if (promo.minItemQuantity && items < promo.minItemQuantity) {
            suggestion.isUnlocked = false;
            const itemGap = promo.minItemQuantity - items;
            suggestion.gap.items = itemGap;
            suggestion.requirements.push(`Add ${itemGap} more item${itemGap > 1 ? 's' : ''}`);
            suggestion.progress = Math.min((items / promo.minItemQuantity) * 100, 99);
        }
        
        
        // Check category restrictions - skip if categories are specified BUT cart has no matching categories
        if (promo.applicableCategories && promo.applicableCategories.length > 0) {
            const hasEligibleCategory = categories.some(cat => 
                promo.applicableCategories.includes(cat)
            );
            
            // Skip this promo if user has items but none match the required categories
            if (!hasEligibleCategory) {
                continue; // Don't show this promo
            }
        }

        // Check product restrictions - skip if products are specified BUT cart has no matching products
        if (promo.applicableProducts && promo.applicableProducts.length > 0) {
            const hasEligibleProduct = products.some(prod => 
                promo.applicableProducts.map(p => p.toString()).includes(prod)
            );
            // Skip this promo if user has items but none match the required products
            if (!hasEligibleProduct) {
                continue; // Don't show this promo
            }
        }
        
        // Calculate potential savings
        if (suggestion.isUnlocked) {
            suggestion.potentialSavings = promo.calculateDiscount(total);
            suggestion.progress = 100;
        } else if (promo.minOrderAmount) {
            // Estimate savings if user meets requirement
            const projectedTotal = promo.minOrderAmount;
            suggestion.potentialSavings = promo.calculateDiscount(projectedTotal);
        }
        
        // Show ALL suggestions (removed the 50% progress filter)
        suggestions.push(suggestion);
    }
    
    // Sort: Unlocked first, then by highest progress
    suggestions.sort((a, b) => {
        if (a.isUnlocked && !b.isUnlocked) return -1;
        if (!a.isUnlocked && b.isUnlocked) return 1;
        return b.progress - a.progress;
    });
    
    res.json({
        success: true,
        suggestions: suggestions.slice(0, 10), // Top 10 suggestions
    });
});

module.exports = {
    getAllPromoCodes,
    getActivePromoCodes,
    validatePromoCode,
    applyPromoCode,
    createPromoCode,
    updatePromoCode,
    deletePromoCode,
    togglePromoCode,
    getPromoUsageHistory,
    getPromoSuggestions,
};
