const express = require('express');
const router = express.Router();
const {
    getAllOrders,
    searchOrders,
    getOrdersByEmail,
    getOrderById,
    createOrder,
    updateOrderStatus,
    cancelOrders,
    deleteOrders,
    getOrdersByPhone,
} = require('../controllers/orderController');

/**
 * Order Routes
 * Base path: /api/orders
 */

// Public tracking route (no auth required)
router.get('/track/:phone', getOrdersByPhone);

// Search route (must be before /:id to prevent conflict)
router.get('/search', searchOrders);

// GET routes
router.get('/', getAllOrders);
router.get('/user/:email', getOrdersByEmail);
router.get('/:id', getOrderById);

// POST routes
router.post('/', createOrder);

// PUT routes
router.put('/status', updateOrderStatus);
router.put('/cancel', cancelOrders);

// DELETE routes
router.delete('/', deleteOrders);

module.exports = router;
