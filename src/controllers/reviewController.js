const { Review, Order, Product } = require('../models');
const mongoose = require('mongoose');
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
 * Helper function to update product average rating and review count
 */
const updateProductRating = async (productId) => {
    try {
        const stats = await Review.aggregate([
            { $match: { productId: productId } },
            {
                $group: {
                    _id: '$productId',
                    numReviews: { $sum: 1 },
                    avgRating: { $avg: '$rating' }
                }
            }
        ]);

        if (stats.length > 0) {
            await Product.findByIdAndUpdate(productId, {
                rating: Number(stats[0].avgRating.toFixed(1)),
                numReviews: stats[0].numReviews
            });
        } else {
            await Product.findByIdAndUpdate(productId, {
                rating: 0,
                numReviews: 0
            });
        }
    } catch (error) {
        console.error('Error updating product rating:', error);
    }
};

/**
 * @desc    Create new review or update existing one
 * @route   POST /api/reviews
 * @access  Private
 */
const createReview = asyncHandler(async (req, res) => {
    const { email, productId, rating, review: reviewText } = req.body;

    if (!productId) {
        throw new ApiError(400, "Product ID is required");
    }

    // Check if review already exists for this product and user email
    let review = await Review.findOne({ email, productId });

    // Check if the user has purchased this product
    const hasOrdered = await Order.findOne({
        email: email,
        'cart._id': productId,
        shipment: 'delivered'
    });

    const isVerified = !!hasOrdered;

    if (review) {
        // Update existing review
        review.rating = rating;
        review.review = reviewText;
        review.isVerified = isVerified;
        review.date = new Date().toDateString(); // Update date if desired
        await review.save();
    } else {
        // Create new review
        const reviewData = {
            ...req.body,
            isVerified
        };
        review = await Review.create(reviewData);
    }

    // Sync rating to Product model
    await updateProductRating(productId);

    res.status(review.isNew ? 201 : 200).json(review);
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

    // Sync rating to Product model
    await updateProductRating(review.productId);

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

    // Sync rating to Product model
    await updateProductRating(review.productId);

    res.json({ message: 'Review deleted successfully' });
});

module.exports = {
    getAllReviews,
    getReviewsByProduct,
    createReview,
    updateReview,
    deleteReview,
};
