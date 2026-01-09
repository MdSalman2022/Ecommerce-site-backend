/**
 * Notification Service
 * Handles sending push notifications via Firebase Cloud Messaging
 */
const { getMessaging } = require('../config/firebaseAdmin');
const { User } = require('../models');

class NotificationService {
    /**
     * Send notification to a specific FCM token
     * @param {String} token - FCM token
     * @param {Object} notification - {title, body, imageUrl?}
     * @param {Object} data - Additional data payload
     */
    async sendToToken(token, notification, data = {}) {
        const messaging = getMessaging();
        if (!messaging) {
            console.warn('Firebase not configured, skipping notification');
            return { success: false, error: 'Firebase not configured' };
        }

        try {
            const message = {
                token,
                notification: {
                    title: notification.title,
                    body: notification.body,
                    ...(notification.imageUrl && { imageUrl: notification.imageUrl }),
                },
                data: Object.fromEntries(
                    Object.entries(data).map(([k, v]) => [k, String(v)])
                ),
                webpush: {
                    fcmOptions: {
                        link: data.url || process.env.CLIENT_URL || 'https://bestdeal.com',
                    },
                },
            };

            const response = await messaging.send(message);
            return { success: true, messageId: response };
        } catch (error) {
            console.error('FCM send error:', error.message);
            // If token is invalid, we should remove it
            if (error.code === 'messaging/invalid-registration-token' ||
                error.code === 'messaging/registration-token-not-registered') {
                await this.removeInvalidToken(token);
            }
            return { success: false, error: error.message };
        }
    }

    /**
     * Send notification to all devices of a user
     * @param {String} userId - User's MongoDB ID
     * @param {Object} notification - {title, body, imageUrl?}
     * @param {Object} data - Additional data payload
     */
    async sendToUser(userId, notification, data = {}) {
        try {
            const user = await User.findById(userId).select('fcmTokens notificationPreferences');
            if (!user || !user.fcmTokens || user.fcmTokens.length === 0) {
                return { success: false, error: 'No FCM tokens found for user' };
            }

            const results = await Promise.all(
                user.fcmTokens.map(tokenDoc => 
                    this.sendToToken(tokenDoc.token, notification, data)
                )
            );

            // Update lastUsed for successful sends
            const successCount = results.filter(r => r.success).length;
            
            return { 
                success: successCount > 0, 
                sent: successCount, 
                failed: results.length - successCount 
            };
        } catch (error) {
            console.error('sendToUser error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send order status update notification
     */
    async sendOrderUpdate(userId, orderId, status, orderName = 'Your order') {
        const statusMessages = {
            pending: 'has been received and is pending confirmation',
            processing: 'is now being processed',
            shipped: 'has been shipped! Track it now',
            delivered: 'has been delivered! Thank you for shopping',
            cancelled: 'has been cancelled',
            returned: 'return has been processed',
        };

        const notification = {
            title: `Order Update: ${status.charAt(0).toUpperCase() + status.slice(1)}`,
            body: `${orderName} ${statusMessages[status] || 'status has been updated'}`,
        };

        return this.sendToUser(userId, notification, {
            type: 'order_update',
            orderId: orderId,
            status: status,
            url: `/track`,
        });
    }

    /**
     * Send promotional notification to multiple users
     */
    async sendPromotion(userIds, notification, data = {}) {
        const results = await Promise.all(
            userIds.map(userId => this.sendToUser(userId, notification, { ...data, type: 'promotion' }))
        );
        return {
            sent: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
        };
    }

    /**
     * Remove invalid token from database
     */
    async removeInvalidToken(token) {
        try {
            await User.updateMany(
                { 'fcmTokens.token': token },
                { $pull: { fcmTokens: { token } } }
            );
        } catch (error) {
            console.error('Error removing invalid token:', error);
        }
    }
}

module.exports = new NotificationService();
