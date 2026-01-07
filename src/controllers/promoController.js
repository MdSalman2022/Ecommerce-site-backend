const PromoCode = require('../models/PromoCode');
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
    const { code, orderTotal, category } = req.body;

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

    // Validate for order
    const validation = promoCode.validateForOrder(orderTotal || 0, category);

    if (!validation.isValid) {
        return res.status(400).json({
            success: false,
            error: validation.errors[0],
            errors: validation.errors,
        });
    }

    // Calculate discount
    const discount = promoCode.calculateDiscount(orderTotal || 0);

    res.json({
        success: true,
        discount,
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
    const { code, description, discountType, discountValue, minOrderAmount, maxDiscount, usageLimit, validFrom, validUntil, applicableCategories } = req.body;

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

module.exports = {
    getAllPromoCodes,
    getActivePromoCodes,
    validatePromoCode,
    applyPromoCode,
    createPromoCode,
    updatePromoCode,
    deletePromoCode,
    togglePromoCode,
};
