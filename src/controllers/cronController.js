const { AbandonedCart } = require('../models');
const asyncHandler = require('../utils/asyncHandler');

/**
 * @desc    Process abandoned carts (called by Vercel Cron)
 * @route   GET /api/cron/process-abandoned
 * @access  Internal (Vercel Cron)
 */
const processAbandonedCarts = asyncHandler(async (req, res) => {
    // Verify it's a legitimate cron request (Vercel sends this header)
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        // Allow in development or if no secret configured
        if (process.env.NODE_ENV === 'production' && process.env.CRON_SECRET) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
    }

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const result = await AbandonedCart.updateMany(
        {
            stage: { $in: ['checkout_started', 'checkout_info_filled'] },
            lastActivityAt: { $lt: twentyFourHoursAgo }
        },
        {
            $set: { stage: 'abandoned', abandonedAt: new Date() }
        }
    );

    res.json({
        success: true,
        message: `Processed ${result.modifiedCount} abandoned carts`,
        timestamp: new Date().toISOString()
    });
});

module.exports = { processAbandonedCarts };
