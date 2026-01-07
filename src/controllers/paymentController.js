const asyncHandler = require('../utils/asyncHandler');
const { ApiResponse, ApiError } = require('../utils/ApiResponse');

// Initialize Stripe
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

/**
 * @desc    Create payment intent
 * @route   POST /api/payments/create-intent
 * @access  Private
 */
const createPaymentIntent = asyncHandler(async (req, res) => {
    const { price } = req.body;

    if (!price || price <= 0) {
        throw new ApiError(400, 'Please provide a valid price');
    }

    // Convert to cents
    const amount = Math.round(price * 100);

    const paymentIntent = await stripe.paymentIntents.create({
        currency: 'usd',
        amount,
        payment_method_types: ['card'],
    });

    // Return plain object for frontend compatibility
    res.json({ clientSecret: paymentIntent.client_secret });
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
