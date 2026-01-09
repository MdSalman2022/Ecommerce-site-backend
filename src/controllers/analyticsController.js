const { Order, Product } = require('../models');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Analytics Controller
 * Provides aggregated statistics for the dashboard
 */

/**
 * @desc    Get revenue statistics (daily for last 30 days)
 * @route   GET /api/analytics/revenue
 * @access  Private/Admin
 */
const getRevenueStats = asyncHandler(async (req, res) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const revenueData = await Order.aggregate([
        {
            $match: {
                createdAt: { $gte: thirtyDaysAgo },
                orderStatus: { $nin: ['cancelled', 'returned'] }
            }
        },
        {
            $group: {
                _id: {
                    $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
                },
                revenue: { $sum: '$amount' },
                orders: { $sum: 1 }
            }
        },
        { $sort: { '_id': 1 } },
        {
            $project: {
                date: '$_id',
                revenue: { $divide: ['$revenue', 100] }, // Convert from cents
                orders: 1,
                _id: 0
            }
        }
    ]);

    // Calculate totals
    const totals = await Order.aggregate([
        {
            $match: {
                orderStatus: { $nin: ['cancelled', 'returned'] }
            }
        },
        {
            $group: {
                _id: null,
                totalRevenue: { $sum: '$amount' },
                totalOrders: { $sum: 1 },
                avgOrderValue: { $avg: '$amount' }
            }
        }
    ]);

    res.json({
        success: true,
        data: {
            daily: revenueData,
            totals: totals[0] ? {
                totalRevenue: totals[0].totalRevenue / 100,
                totalOrders: totals[0].totalOrders,
                avgOrderValue: totals[0].avgOrderValue / 100
            } : {
                totalRevenue: 0,
                totalOrders: 0,
                avgOrderValue: 0
            }
        }
    });
});

/**
 * @desc    Get orders by status
 * @route   GET /api/analytics/orders-by-status
 * @access  Private/Admin
 */
const getOrdersByStatus = asyncHandler(async (req, res) => {
    const statusData = await Order.aggregate([
        {
            $group: {
                _id: '$orderStatus',
                count: { $sum: 1 }
            }
        },
        {
            $project: {
                status: '$_id',
                count: 1,
                _id: 0
            }
        }
    ]);

    res.json({
        success: true,
        data: statusData
    });
});

/**
 * @desc    Get top selling products
 * @route   GET /api/analytics/top-products
 * @access  Private/Admin
 */
const getTopProducts = asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit) || 5;

    const topProducts = await Order.aggregate([
        { $unwind: '$items' },
        {
            $group: {
                _id: '$items._id',
                name: { $first: '$items.name' },
                image: { $first: '$items.image' },
                totalSold: { $sum: '$items.quantity' },
                totalRevenue: { $sum: '$items.totalPrice' }
            }
        },
        { $sort: { totalSold: -1 } },
        { $limit: limit },
        {
            $project: {
                productId: '$_id',
                name: 1,
                image: 1,
                totalSold: 1,
                totalRevenue: 1,
                _id: 0
            }
        }
    ]);

    res.json({
        success: true,
        data: topProducts
    });
});

/**
 * @desc    Get today's summary
 * @route   GET /api/analytics/today
 * @access  Private/Admin
 */
const getTodayStats = asyncHandler(async (req, res) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayStats = await Order.aggregate([
        {
            $match: {
                createdAt: { $gte: today }
            }
        },
        {
            $group: {
                _id: null,
                ordersToday: { $sum: 1 },
                revenueToday: { $sum: '$amount' }
            }
        }
    ]);

    res.json({
        success: true,
        data: todayStats[0] ? {
            ordersToday: todayStats[0].ordersToday,
            revenueToday: todayStats[0].revenueToday / 100
        } : {
            ordersToday: 0,
            revenueToday: 0
        }
    });
});

module.exports = {
    getRevenueStats,
    getOrdersByStatus,
    getTopProducts,
    getTodayStats,
};
