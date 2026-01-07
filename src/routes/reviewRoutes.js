const express = require('express');
const router = express.Router();
const {
    getAllReviews,
    getReviewsByProduct,
    createReview,
    updateReview,
    deleteReview,
} = require('../controllers/reviewController');

/**
 * Review Routes
 * Base path: /api/reviews
 */

// GET routes
router.get('/', getAllReviews);
router.get('/product/:productId', getReviewsByProduct);

// POST routes
router.post('/', createReview);

// PUT routes
router.put('/:id', updateReview);

// DELETE routes
router.delete('/:id', deleteReview);

module.exports = router;
