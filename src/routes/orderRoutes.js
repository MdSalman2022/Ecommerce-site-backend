const express = require('express');
const router = express.Router();
const {
    getAllOrders,
    getOrdersByEmail,
    getOrderById,
    createOrder,
    updateOrderStatus,
    cancelOrders,
    deleteOrders,
} = require('../controllers/orderController');

/**
 * Order Routes
 * Base path: /api/orders
 */

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
