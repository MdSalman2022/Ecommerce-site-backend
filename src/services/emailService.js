const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const FROM_EMAIL = process.env.FROM_EMAIL || 'BestDeal <onboarding@resend.dev>'; // Verification required for production domain

/**
 * Email Service
 * Handles transactional emails using Resend
 */
class EmailService {
    
    /**
     * Send Welcome Email to new users
     * @param {String} toEmail
     * @param {String} name
     */
    async sendWelcomeEmail(toEmail, name) {
        try {
            await resend.emails.send({
                from: FROM_EMAIL,
                to: toEmail,
                subject: 'Welcome to BestDeal!',
                html: `
                    <div style="font-family: Arial, sans-serif; color: #333;">
                        <h1>Welcome to BestDeal, ${name}!</h1>
                        <p>We are excited to have you on board. Start exploring our latest products and deals.</p>
                        <a href="${process.env.CLIENT_URL}" style="background: #2563EB; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Shop Now</a>
                    </div>
                `
            });
        } catch (error) {
            console.error('Welcome Email Error:', error);
        }
    }

    /**
     * Send Order Confirmation to customer
     * @param {Object} order
     */
    async sendOrderConfirmation(order) {
        if (!order.email) return; // Skip if no email (guest without email)

        try {
            const itemsList = order.items.map(item => `<li>${item.name} x ${item.quantity} - ${item.totalPrice}</li>`).join('');
            
            await resend.emails.send({
                from: FROM_EMAIL,
                to: order.email,
                subject: `Order Confirmed #${order._id}`,
                html: `
                    <div style="font-family: Arial, sans-serif; color: #333;">
                        <h1>Thank you for your order!</h1>
                        <p>Your order <strong>#${order._id}</strong> has been received and is being processed.</p>
                        <h3>Order Summary:</h3>
                        <ul>${itemsList}</ul>
                        <p><strong>Total: ${order.amount}</strong></p>
                    </div>
                `
            });
        } catch (error) {
            console.error('Order Confirmation Email Error:', error);
        }
    }

    /**
     * Send New Order Notification to Admin
     * @param {Object} order
     */
    async sendAdminNotification(order) {
        if (!ADMIN_EMAIL) return;

        try {
            await resend.emails.send({
                from: FROM_EMAIL,
                to: ADMIN_EMAIL,
                subject: `New Order Received #${order._id}`,
                html: `
                    <div style="font-family: Arial, sans-serif; color: #333;">
                        <h1>New Order Alert</h1>
                        <p>A new order has been placed by <strong>${order.name || 'Guest'}</strong>.</p>
                        <p>Order ID: ${order._id}</p>
                        <p>Total Amount: ${order.amount}</p>
                        <a href="${process.env.CLIENT_URL}/dashboard/orders" style="color: #2563EB;">View in Dashboard</a>
                    </div>
                `
            });
        } catch (error) {
            console.error('Admin Notification Error:', error);
        }
    }

    /**
     * Send Shipping Status Update to customer
     * @param {Object} data - {email, name, orderId, status}
     */
    async sendShippingUpdate(data) {
        if (!data.email) return;

        try {
            const statusMessages = {
                pending: 'Your order is pending confirmation',
                processing: 'Your order is being processed',
                shipped: 'Your order has been shipped',
                delivered: 'Your order has been delivered',
                cancelled: 'Your order has been cancelled',
                returned: 'Your order return is being processed'
            };

            await resend.emails.send({
                from: FROM_EMAIL,
                to: data.email,
                subject: `Order Status Update - ${data.orderId}`,
                html: `
                    <div style="font-family: Arial, sans-serif; color: #333;">
                        <h1>Order Status Update</h1>
                        <p>Hello ${data.name},</p>
                        <p>${statusMessages[data.status] || 'Your order status has been updated'}.</p>
                        <p><strong>Order ID:</strong> ${data.orderId}</p>
                        <p><strong>Status:</strong> ${data.status}</p>
                        <a href="${process.env.CLIENT_URL}/orders/${data.orderId}" style="background: #2563EB; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Track Order</a>
                    </div>
                `
            });
            return { success: true };
        } catch (error) {
            console.error('Shipping Update Email Error:', error);
            return { success: false, error };
        }
    }
}

module.exports = new EmailService();
