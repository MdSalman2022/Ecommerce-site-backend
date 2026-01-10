const asyncHandler = require('../utils/asyncHandler');
const { ApiResponse, ApiError } = require('../utils/ApiResponse');

// Initialize Stripe
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const { Product } = require('../models');

/**
 * @desc    Create payment intent
 * @route   POST /api/payments/create-intent
 * @access  Private
 */
const createPaymentIntent = asyncHandler(async (req, res) => {
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
        throw new ApiError(400, 'Please provide items for checkout');
    }

    // Server-side total calculation (Source of Truth)
    let calculatedAmount = 0;
    for (const item of items) {
        const product = await Product.findById(item.productId || item._id);
        if (!product) {
            throw new ApiError(404, `Product not found: ${item.name}`);
        }

        // Find the specific variant
        const variant = product.variants.find(v => v._id.toString() === item.variantId) || product.variants[0];
        const price = variant.salePrice > 0 ? variant.salePrice : variant.regularPrice;
        
        calculatedAmount += price * item.quantity;
    }

    // Add shipping logic if needed (placeholder for now)
    // const shipping = 60; // BDT 60
    // calculatedAmount += shipping;

    // Convert to cents (or points for BDT in Stripe)
    const amount = Math.round(calculatedAmount * 100);

    const paymentIntent = await stripe.paymentIntents.create({
        currency: 'bdt',
        amount,
        payment_method_types: ['card'],
        metadata: {
            userId: req.user?._id?.toString() || 'guest',
            itemCount: items.length
        }
    });

    res.json({ clientSecret: paymentIntent.client_secret, amount: calculatedAmount });
});

/**
 * @desc    Confirm payment
 * @route   POST /api/payments/confirm
 * @access  Private
 */
const confirmPayment = asyncHandler(async (req, res) => {
    const { paymentIntentId } = req.body;

    if (!paymentIntentId) {
        throw new ApiError(400, 'Payment intent ID is required');
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    res.json({ status: paymentIntent.status });
});

module.exports = {
    createPaymentIntent,
    confirmPayment,
};
