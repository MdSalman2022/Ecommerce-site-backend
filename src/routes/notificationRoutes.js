const express = require('express');
const router = express.Router();
const {
    registerToken,
    removeToken,
    updatePreferences,
    getPreferences,
    sendTestNotification,
    broadcastNotification,
} = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');
const { adminOnly } = require('../middleware/rbacMiddleware');

/**
 * Notification Routes
 * Base path: /api/notifications
 */

// All routes require authentication
router.use(protect);

// Token management
router.post('/register', registerToken);
router.delete('/token', removeToken);

// Preferences
router.get('/preferences', getPreferences);
router.put('/preferences', updatePreferences);

// Admin only
router.post('/test', adminOnly, sendTestNotification);
router.post('/broadcast', adminOnly, broadcastNotification);

module.exports = router;

