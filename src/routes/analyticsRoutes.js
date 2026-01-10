const express = require('express');
const router = express.Router();
const {
    getRevenueStats,
    getOrdersByStatus,
    getTopProducts,
    getTodayStats,
    getDashboardData,
} = require('../controllers/analyticsController');
const { protect } = require('../middleware/authMiddleware');
const { staffOnly } = require('../middleware/rbacMiddleware');

/**
 * Analytics Routes
 * Base path: /api/analytics
 * All routes require staff/admin access
 */

router.use(protect);
router.use(staffOnly);

router.get('/dashboard', getDashboardData);
router.get('/revenue', getRevenueStats);
router.get('/orders-by-status', getOrdersByStatus);
router.get('/top-products', getTopProducts);
router.get('/today', getTodayStats);

module.exports = router;
