const mongoose = require('mongoose');

/**
 * Review Schema
 * Represents product reviews from customers
 * Matches actual reviewCollection structure
 */
const reviewSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            trim: true,
        },
        email: {
            type: String,
            trim: true,
            lowercase: true,
        },
        rating: {
            type: Number,
            min: [1, 'Rating must be at least 1'],
            max: [5, 'Rating cannot exceed 5'],
        },
        review: {
            type: String,
            trim: true,
        },
        productId: {
            type: String,
            index: true,
        },
        date: {
            type: String,
        },
        isVerified: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
        collection: 'reviewCollection',
    }
);

// Index for product reviews
// reviewSchema.index({ productId: 1 }); // Removed duplicate

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;
