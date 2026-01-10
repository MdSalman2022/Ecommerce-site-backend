const express = require('express');
const router = express.Router();
const {
    getCart,
    updateCart,
    clearCart,
    mergeCart,
    trackCartUpdate,
    markCheckoutStarted,
    markCartConverted,
    getAbandonedCarts,
} = require('../controllers/cartController');
const { protect, optionalAuth } = require('../middleware/authMiddleware');
const { staffOnly } = require('../middleware/rbacMiddleware');

/**
 * Cart Routes
 * Base path: /api/cart
 */

// Cart Routes
router.get('/', optionalAuth, getCart);
router.post('/', optionalAuth, updateCart);
router.delete('/', optionalAuth, clearCart);
router.post('/merge', protect, mergeCart);

// Checkout tracking endpoints
// router.post('/track', trackCartUpdate); // DEPRECATED: tracking starts at checkout now
router.post('/checkout-started', optionalAuth, markCheckoutStarted);
router.post('/converted', optionalAuth, markCartConverted);

// Admin endpoint to view abandoned carts
router.get('/abandoned', protect, staffOnly, getAbandonedCarts);

module.exports = router;
