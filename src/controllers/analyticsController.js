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
                revenue: '$revenue', // Raw amount in Taka
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
                totalRevenue: totals[0].totalRevenue,
                totalOrders: totals[0].totalOrders,
                avgOrderValue: totals[0].avgOrderValue
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
            revenueToday: todayStats[0].revenueToday
        } : {
            ordersToday: 0,
            revenueToday: 0
        }
    });
});

/**
 * @desc    Get comprehensive dashboard data
 * @route   GET /api/analytics/dashboard
 * @access  Private/Staff
 */
const getDashboardData = asyncHandler(async (req, res) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // 1. Today's Stats & Total Products & Low Stock
    const [todayResult, totalProducts, lowStockProducts, recentOrders] = await Promise.all([
        Order.aggregate([
            { $match: { createdAt: { $gte: today } } },
            {
                $group: {
                    _id: null,
                    ordersToday: { $sum: 1 },
                    revenueToday: { $sum: '$amount' },
                    itemsSoldToday: { $sum: { $sum: '$items.quantity' } }
                }
            }
        ]),
        Product.countDocuments(),
        Product.countDocuments({ 'variants.stock': { $lt: 10 } }), // Threshold for low stock
        Order.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .select('orderId name contact date orderStatus amount items createdAt')
            .lean()
    ]);

    // 2. Revenue Over Time (Last 7 Days)
    const revenueData = await Order.aggregate([
        {
            $match: {
                createdAt: { $gte: sevenDaysAgo },
                orderStatus: { $nin: ['cancelled', 'returned'] }
            }
        },
        {
            $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                revenue: { $sum: '$amount' },
                orders: { $sum: 1 }
            }
        },
        { $sort: { '_id': 1 } },
        {
            $project: {
                date: '$_id',
                revenue: 1,
                orders: 1,
                _id: 0
            }
        }
    ]);

    // 3. Top Categories
    const topCategories = await Order.aggregate([
        { $unwind: '$items' },
        {
            $group: {
                _id: '$items.cat',
                count: { $sum: '$items.quantity' }
            }
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
        {
            $addFields: {
                catId: {
                    $convert: {
                        input: "$_id",
                        to: "objectId",
                        onError: "$_id",
                        onNull: "$_id"
                    }
                }
            }
        },
        {
            $lookup: {
                from: 'categories',
                localField: 'catId',
                foreignField: '_id',
                as: 'categoryInfo'
            }
        },
        { $unwind: { path: '$categoryInfo', preserveNullAndEmptyArrays: true } },
        {
            $project: {
                name: { $ifNull: ['$categoryInfo.name', 'Others'] },
                value: '$count'
            }
        }
    ]);

    // Calculate percentage for top categories
    const totalQty = topCategories.reduce((sum, cat) => sum + cat.value, 0);
    const topCategoriesFormatted = topCategories.map(cat => ({
        ...cat,
        percentage: totalQty > 0 ? Math.round((cat.value / totalQty) * 100) : 0
    })).slice(0, 5);

    res.json({
        success: true,
        data: {
            summary: {
                todaySales: todayResult[0]?.revenueToday || 0,
                todayRevenue: todayResult[0]?.revenueToday || 0, 
                todayOrders: todayResult[0]?.ordersToday || 0,
                itemsSoldToday: todayResult[0]?.itemsSoldToday || 0,
                totalProducts,
                lowStockProducts
            },
            revenueChart: revenueData,
            topCategories: topCategoriesFormatted,
            recentOrders: recentOrders.map(o => ({
                id: o.orderId || o._id.toString().slice(-8).toUpperCase(),
                product: o.items[0]?.name + (o.items.length > 1 ? ` +${o.items.length - 1} more` : ''),
                customer: o.name,
                date: o.createdAt,
                status: o.orderStatus,
                amount: o.amount
            }))
        }
    });
});

module.exports = {
    getRevenueStats,
    getOrdersByStatus,
    getTopProducts,
    getTodayStats,
    getDashboardData,
};
