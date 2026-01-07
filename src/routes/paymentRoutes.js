const express = require('express');
const router = express.Router();
const {
    createPaymentIntent,
    confirmPayment,
} = require('../controllers/paymentController');

/**
 * Payment Routes
 * Base path: /api/payments
 */

// POST routes
router.post('/create-intent', createPaymentIntent);
router.post('/confirm', confirmPayment);

module.exports = router;
