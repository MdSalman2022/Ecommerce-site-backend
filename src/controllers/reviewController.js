const { Review, Order } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { ApiResponse, ApiError } = require('../utils/ApiResponse');

/**
 * @desc    Get all reviews
 * @route   GET /api/reviews
 * @access  Public
 */
const getAllReviews = asyncHandler(async (req, res) => {
    const reviews = await Review.find().sort({ createdAt: -1 });
    // Return plain array for frontend compatibility
    res.json(reviews);
});

/**
 * @desc    Get reviews by product ID
 * @route   GET /api/reviews/product/:productId
 * @access  Public
 */
const getReviewsByProduct = asyncHandler(async (req, res) => {
    const reviews = await Review.find({ productId: req.params.productId }).sort({ createdAt: -1 });
    res.json(reviews);
});

/**
 * @desc    Create new review
 * @route   POST /api/reviews
 * @access  Private
 */
const createReview = asyncHandler(async (req, res) => {
    const { email, productId } = req.body;

    // Check if the user has purchased this product
    const hasOrdered = await Order.findOne({
        email: email,
        'cart._id': productId,
        shipment: 'delivered' // Optional: only verify if delivered
    });

    const reviewData = {
        ...req.body,
        isVerified: !!hasOrdered
    };

    const review = await Review.create(reviewData);
    res.status(201).json(review);
});

/**
 * @desc    Update review
 * @route   PUT /api/reviews/:id
 * @access  Private
 */
const updateReview = asyncHandler(async (req, res) => {
    const review = await Review.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
    );

    if (!review) {
        throw new ApiError(404, 'Review not found');
    }

    res.json(review);
});

/**
 * @desc    Delete review
 * @route   DELETE /api/reviews/:id
 * @access  Private
 */
const deleteReview = asyncHandler(async (req, res) => {
    const review = await Review.findByIdAndDelete(req.params.id);

    if (!review) {
        throw new ApiError(404, 'Review not found');
    }

    res.json({ message: 'Review deleted successfully' });
});

module.exports = {
    getAllReviews,
    getReviewsByProduct,
    createReview,
    updateReview,
    deleteReview,
};
