const express = require('express');
const router = express.Router();
const {
    trackCartUpdate,
    markCheckoutStarted,
    markCartConverted,
    getAbandonedCarts,
} = require('../controllers/cartController');
const { protect } = require('../middleware/authMiddleware');
const { staffOnly } = require('../middleware/rbacMiddleware');

/**
 * Cart Routes
 * Base path: /api/cart
 */

// Public tracking endpoints (called from frontend)
router.post('/track', trackCartUpdate);
router.post('/checkout-started', markCheckoutStarted);
router.post('/converted', markCartConverted);

// Admin endpoint to view abandoned carts
router.get('/abandoned', protect, staffOnly, getAbandonedCarts);

module.exports = router;
