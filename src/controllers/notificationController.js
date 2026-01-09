const { User } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const notificationService = require('../services/notificationService');

/**
 * @desc    Register FCM token for push notifications
 * @route   POST /api/notifications/register
 * @access  Private
 */
const registerToken = asyncHandler(async (req, res) => {
    const { token, device = 'web' } = req.body;
    const userId = req.user.id;

    if (!token) {
        return res.status(400).json({ success: false, message: 'Token is required' });
    }

    const user = await User.findById(userId);
    if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if token already exists
    const existingTokenIndex = user.fcmTokens.findIndex(t => t.token === token);
    
    if (existingTokenIndex >= 0) {
        // Update existing token's lastUsed
        user.fcmTokens[existingTokenIndex].lastUsed = new Date();
    } else {
        // Add new token (limit to 5 devices per user)
        if (user.fcmTokens.length >= 5) {
            // Remove oldest token
            user.fcmTokens.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            user.fcmTokens.shift();
        }
        user.fcmTokens.push({ token, device, createdAt: new Date() });
    }

    await user.save();

    res.json({ 
        success: true, 
        message: 'Token registered successfully',
        deviceCount: user.fcmTokens.length 
    });
});

/**
 * @desc    Remove FCM token (on logout)
 * @route   DELETE /api/notifications/token
 * @access  Private
 */
const removeToken = asyncHandler(async (req, res) => {
    const { token } = req.body;
    const userId = req.user.id;

    if (!token) {
        return res.status(400).json({ success: false, message: 'Token is required' });
    }

    await User.findByIdAndUpdate(userId, {
        $pull: { fcmTokens: { token } }
    });

    res.json({ success: true, message: 'Token removed successfully' });
});

/**
 * @desc    Update notification preferences
 * @route   PUT /api/notifications/preferences
 * @access  Private
 */
const updatePreferences = asyncHandler(async (req, res) => {
    const { orderUpdates, promotions, newProducts } = req.body;
    const userId = req.user.id;

    const updateData = {};
    if (typeof orderUpdates === 'boolean') updateData['notificationPreferences.orderUpdates'] = orderUpdates;
    if (typeof promotions === 'boolean') updateData['notificationPreferences.promotions'] = promotions;
    if (typeof newProducts === 'boolean') updateData['notificationPreferences.newProducts'] = newProducts;

    const user = await User.findByIdAndUpdate(
        userId,
        { $set: updateData },
        { new: true }
    ).select('notificationPreferences');

    res.json({ 
        success: true, 
        preferences: user.notificationPreferences 
    });
});

/**
 * @desc    Get notification preferences
 * @route   GET /api/notifications/preferences
 * @access  Private
 */
const getPreferences = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id).select('notificationPreferences fcmTokens');
    
    res.json({
        success: true,
        preferences: user.notificationPreferences || {
            orderUpdates: true,
            promotions: true,
            newProducts: false,
        },
        hasToken: user.fcmTokens && user.fcmTokens.length > 0,
    });
});

/**
 * @desc    Send test notification (Admin only)
 * @route   POST /api/notifications/test
 * @access  Private/Admin
 */
const sendTestNotification = asyncHandler(async (req, res) => {
    const { userId, title, body } = req.body;

    const result = await notificationService.sendToUser(
        userId || req.user.id,
        { title: title || 'Test Notification', body: body || 'This is a test notification from BestDeal!' }
    );

    res.json(result);
});

/**
 * @desc    Broadcast notification to all users with FCM tokens
 * @route   POST /api/notifications/broadcast
 * @access  Private/Admin
 */
const broadcastNotification = asyncHandler(async (req, res) => {
    const { title, body, imageUrl, url, targetPreference } = req.body;

    if (!title || !body) {
        return res.status(400).json({ success: false, message: 'Title and body are required' });
    }

    // Build query based on target preference filter
    const query = { 'fcmTokens.0': { $exists: true } }; // Users with at least one token
    
    if (targetPreference === 'promotions') {
        query['notificationPreferences.promotions'] = { $ne: false };
    } else if (targetPreference === 'newProducts') {
        query['notificationPreferences.newProducts'] = true;
    }

    const users = await User.find(query).select('fcmTokens notificationPreferences name email');
    
    if (users.length === 0) {
        return res.json({ success: true, sent: 0, message: 'No users with tokens found' });
    }

    // Collect all tokens
    const allTokens = [];
    users.forEach(user => {
        user.fcmTokens.forEach(tokenDoc => {
            allTokens.push(tokenDoc.token);
        });
    });

    // Send notifications in batches (FCM limit is 500 per request)
    const notification = { title, body, imageUrl };
    const data = { type: 'promotion', url: url || '/' };
    
    let sent = 0;
    let failed = 0;
    const errors = [];

    console.log(`[Broadcast] Starting broadcast to ${allTokens.length} tokens...`);

    const batchSize = 500;
    for (let i = 0; i < allTokens.length; i += batchSize) {
        const batch = allTokens.slice(i, i + batchSize);
        console.log(`[Broadcast] Processing batch ${Math.floor(i/batchSize) + 1}...`);
        
        const results = await Promise.all(
            batch.map(async (token) => {
                const res = await notificationService.sendToToken(token, notification, data);
                if (!res.success) {
                    console.error(`[Broadcast] Failed for token: ${token.substring(0, 10)}... Error: ${res.error}`);
                    errors.push(res.error);
                }
                return res;
            })
        );
        
        sent += results.filter(r => r.success).length;
        failed += results.filter(r => !r.success).length;
    }

    console.log(`[Broadcast] Completed. Sent: ${sent}, Failed: ${failed}`);

    res.json({
        success: true,
        totalUsers: users.length,
        totalTokens: allTokens.length,
        sent,
        failed,
        message: `Notification sent to ${sent} devices`,
        errors: failed > 0 ? Array.from(new Set(errors)) : undefined
    });
});

module.exports = {
    registerToken,
    removeToken,
    updatePreferences,
    getPreferences,
    sendTestNotification,
    broadcastNotification,
};
