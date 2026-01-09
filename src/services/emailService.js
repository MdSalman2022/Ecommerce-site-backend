const nodemailer = require('nodemailer');
const QRCode = require('qrcode');

/**
 * Gmail SMTP Configuration
 * Required environment variables:
 * - SMTP_HOST: smtp.gmail.com (or your SMTP server)
 * - SMTP_PORT: 587 (or 465 for SSL)
 * - SMTP_USER: your Gmail address
 * - SMTP_PASS: your Gmail App Password (NOT your regular password)
 * - FROM_EMAIL: Display name and email (e.g., "BestDeal <your@gmail.com>")
 * 
 * To generate a Gmail App Password:
 * 1. Go to https://myaccount.google.com/apppasswords
 * 2. Select "Mail" and your device
 * 3. Copy the 16-character password
 */

// Create SMTP transporter
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for 587
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const FROM_EMAIL = process.env.FROM_EMAIL || 'BestDeal <noreply@bestdeal.com>';
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

/**
 * Email Service
 * Handles transactional emails using Nodemailer (Gmail SMTP)
 */
class EmailService {
    
    /**
     * Send Welcome Email to new users
     * @param {String} toEmail
     * @param {String} name
     */
    async sendWelcomeEmail(toEmail, name) {
        try {
            await transporter.sendMail({
                from: FROM_EMAIL,
                to: toEmail,
                subject: 'Welcome to BestDeal!',
                html: `
                    <div style="font-family: Arial, sans-serif; color: #333;">
                        <h1>Welcome to BestDeal, ${name}!</h1>
                        <p>We are excited to have you on board. Start exploring our latest products and deals.</p>
                        <a href="${CLIENT_URL}" style="background: #2563EB; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Shop Now</a>
                    </div>
                `
            });
        } catch (error) {
            console.error('Welcome Email Error:', error);
        }
    }

    /**
     * Send Order Confirmation to customer with QR Code
     * @param {Object} order
     */
    async sendOrderConfirmation(order) {
        if (!order.email) return; // Skip if no email (guest without email)

        try {
            // Generate QR code for tracking URL
            const trackingUrl = `${CLIENT_URL}/track`;
            const qrCodeDataUrl = await QRCode.toDataURL(trackingUrl, { width: 120, margin: 1 });

            const itemsHtml = order.items.map(item => `
                <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #eee;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            ${item.image ? `<img src="${item.image}" alt="${item.name}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 8px;" />` : ''}
                            <div>
                                <p style="margin: 0; font-weight: 500;">${item.name}</p>
                                <p style="margin: 4px 0 0; color: #666; font-size: 14px;">Qty: ${item.quantity}</p>
                            </div>
                        </div>
                    </td>
                    <td style="padding: 12px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: 500;">
                        ৳${item.totalPrice || item.price}
                    </td>
                </tr>
            `).join('');

            const total = order.total || (order.amount / 100);
            const orderId = order.orderId || order._id;
            
            await transporter.sendMail({
                from: FROM_EMAIL,
                to: order.email,
                subject: `Order Confirmed #${orderId} - BestDeal`,
                html: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="utf-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    </head>
                    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f5f5;">
                        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
                            <!-- Header -->
                            <div style="background: linear-gradient(135deg, #2563EB 0%, #1d4ed8 100%); padding: 30px; text-align: center;">
                                <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Order Confirmed! 🎉</h1>
                                <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0;">Thank you for your purchase</p>
                            </div>
                            
                            <!-- Order Info -->
                            <div style="padding: 30px;">
                                <div style="background-color: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                                    <table style="width: 100%; border-collapse: collapse;">
                                        <tr>
                                            <td style="padding: 8px 0;">
                                                <span style="color: #666;">Order ID:</span>
                                                <strong style="color: #2563EB; margin-left: 8px;">#${orderId}</strong>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 8px 0;">
                                                <span style="color: #666;">Date:</span>
                                                <span style="margin-left: 8px;">${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 8px 0;">
                                                <span style="color: #666;">Delivery Address:</span>
                                                <span style="margin-left: 8px;">${order.address || 'N/A'}${order.city ? `, ${order.city}` : ''}</span>
                                            </td>
                                        </tr>
                                    </table>
                                </div>

                                <!-- Items -->
                                <h3 style="margin: 0 0 16px; font-size: 18px;">Order Items</h3>
                                <table style="width: 100%; border-collapse: collapse;">
                                    ${itemsHtml}
                                </table>

                                <!-- Total -->
                                <div style="margin-top: 20px; padding-top: 20px; border-top: 2px solid #2563EB;">
                                    <table style="width: 100%;">
                                        ${order.discount ? `
                                        <tr>
                                            <td style="padding: 8px 0; color: #666;">Discount ${order.promoCode ? `(${order.promoCode})` : ''}</td>
                                            <td style="text-align: right; color: #22c55e;">-৳${order.discount}</td>
                                        </tr>
                                        ` : ''}
                                        <tr>
                                            <td style="padding: 8px 0; font-size: 18px; font-weight: bold;">Total</td>
                                            <td style="text-align: right; font-size: 24px; font-weight: bold; color: #2563EB;">৳${total.toLocaleString()}</td>
                                        </tr>
                                    </table>
                                </div>

                                <!-- QR Code -->
                                <div style="margin-top: 30px; text-align: center; background-color: #f8fafc; border-radius: 12px; padding: 20px;">
                                    <p style="margin: 0 0 12px; font-weight: 500;">Track Your Order</p>
                                    <img src="${qrCodeDataUrl}" alt="QR Code" style="width: 120px; height: 120px;" />
                                    <p style="margin: 12px 0 0; font-size: 14px; color: #666;">Scan to track your order status</p>
                                </div>

                                <!-- CTA Button -->
                                <div style="margin-top: 24px; text-align: center;">
                                    <a href="${trackingUrl}" style="display: inline-block; background-color: #2563EB; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 500; font-size: 16px;">
                                        Track Order
                                    </a>
                                </div>
                            </div>

                            <!-- Footer -->
                            <div style="background-color: #1f2937; color: #9ca3af; padding: 24px; text-align: center;">
                                <p style="margin: 0 0 8px;">Need help? Contact us at support@bestdeal.com</p>
                                <p style="margin: 0; font-size: 14px;">© ${new Date().getFullYear()} BestDeal. All rights reserved.</p>
                            </div>
                        </div>
                    </body>
                    </html>
                `
            });
            return { success: true };
        } catch (error) {
            console.error('Order Confirmation Email Error:', error);
            return { success: false, error };
        }
    }


    /**
     * Send New Order Notification to Admin
     * @param {Object} order
     */
    async sendAdminNotification(order) {
        if (!ADMIN_EMAIL) return;

        try {
            await transporter.sendMail({
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

            await transporter.sendMail({
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

    /**
     * Send Low Stock Alert to Admin
     * @param {Array} products - Array of low stock products
     */
    async sendLowStockAlert(products) {
        if (!ADMIN_EMAIL || !products || products.length === 0) return;

        try {
            const productsHtml = products.map(p => `
                <tr>
                    <td style="padding: 10px; border-bottom: 1px solid #eee;">
                        ${p.image ? `<img src="${p.image}" alt="${p.name}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px;" />` : ''}
                    </td>
                    <td style="padding: 10px; border-bottom: 1px solid #eee;">
                        <strong>${p.name}</strong>
                        ${p.sku ? `<br/><span style="color: #666; font-size: 12px;">SKU: ${p.sku}</span>` : ''}
                    </td>
                    <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center; color: ${p.stock === 0 ? '#ef4444' : '#f97316'}; font-weight: bold;">
                        ${p.stock === 0 ? 'Out of Stock' : `${p.stock} left`}
                    </td>
                </tr>
            `).join('');

            await transporter.sendMail({
                from: FROM_EMAIL,
                to: ADMIN_EMAIL,
                subject: `⚠️ Low Stock Alert - ${products.length} Products Need Restocking`,
                html: `
                    <!DOCTYPE html>
                    <html>
                    <body style="margin: 0; padding: 20px; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f5f5;">
                        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden;">
                            <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 24px; text-align: center;">
                                <h1 style="color: #ffffff; margin: 0; font-size: 24px;">⚠️ Low Stock Alert</h1>
                                <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0;">${products.length} products need your attention</p>
                            </div>
                            
                            <div style="padding: 24px;">
                                <table style="width: 100%; border-collapse: collapse;">
                                    <thead>
                                        <tr style="background-color: #f8fafc;">
                                            <th style="padding: 12px; text-align: left; width: 60px;">Image</th>
                                            <th style="padding: 12px; text-align: left;">Product</th>
                                            <th style="padding: 12px; text-align: center; width: 100px;">Stock</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${productsHtml}
                                    </tbody>
                                </table>
                                
                                <div style="margin-top: 24px; text-align: center;">
                                    <a href="${CLIENT_URL}/dashboard/products" style="display: inline-block; background-color: #2563EB; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 500;">
                                        Manage Inventory
                                    </a>
                                </div>
                            </div>
                            
                            <div style="background-color: #f8fafc; padding: 16px; text-align: center; color: #666; font-size: 14px;">
                                This is an automated alert from BestDeal Inventory System
                            </div>
                        </div>
                    </body>
                    </html>
                `
            });
            return { success: true };
        } catch (error) {
            console.error('Low Stock Alert Email Error:', error);
            return { success: false, error };
        }
    }

    /**
     * Send Team Invitation Email
     * @param {String} toEmail - Recipient email
     * @param {String} role - 'admin' or 'moderator'
     * @param {String} inviteLink - Full URL to accept invitation
     * @param {String} inviterName - Name of the person sending the invite
     */
    async sendTeamInvitation(toEmail, role, inviteLink, inviterName) {
        try {
            const roleDisplay = role.charAt(0).toUpperCase() + role.slice(1);
            
            await transporter.sendMail({
                from: FROM_EMAIL,
                to: toEmail,
                subject: `You're invited to join BestDeal as ${roleDisplay}`,
                html: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="utf-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    </head>
                    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
                        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
                            
                            <!-- Header -->
                            <div style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 40px 32px; text-align: center;">
                                <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">
                                    🎉 You're Invited!
                                </h1>
                                <p style="margin: 12px 0 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">
                                    Join the BestDeal team
                                </p>
                            </div>
                            
                            <!-- Content -->
                            <div style="padding: 40px 32px;">
                                <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                                    Hi there,
                                </p>
                                
                                <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                                    <strong>${inviterName}</strong> has invited you to join <strong>BestDeal</strong> as a <strong style="color: #4f46e5;">${roleDisplay}</strong>.
                                </p>
                                
                                <!-- Role Badge -->
                                <div style="background-color: #f0f9ff; border-radius: 8px; padding: 20px; margin: 0 0 24px 0; text-align: center;">
                                    <div style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: white; padding: 8px 20px; border-radius: 20px; font-size: 14px; font-weight: 600;">
                                        ${roleDisplay.toUpperCase()}
                                    </div>
                                    <p style="color: #64748b; font-size: 14px; margin: 12px 0 0 0;">
                                        ${role === 'admin' 
                                            ? 'Full access to manage products, orders, team, and settings' 
                                            : 'Access to manage products, orders, and moderate content'}
                                    </p>
                                </div>
                                
                                <!-- CTA Button -->
                                <div style="text-align: center; margin: 32px 0;">
                                    <a href="${inviteLink}" 
                                       style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                                        Accept Invitation
                                    </a>
                                </div>
                                
                                <p style="color: #9ca3af; font-size: 14px; line-height: 1.6; margin: 24px 0 0 0;">
                                    This invitation will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
                                </p>
                            </div>
                            
                            <!-- Footer -->
                            <div style="background-color: #f8fafc; padding: 24px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
                                <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                                    © ${new Date().getFullYear()} BestDeal. All rights reserved.
                                </p>
                            </div>
                        </div>
                    </body>
                    </html>
                `
            });
            
            console.log(`Team invitation sent to ${toEmail} for role ${role}`);
            return { success: true };
        } catch (error) {
            console.error('Team Invitation Email Error:', error);
            return { success: false, error };
        }
    }
}

module.exports = new EmailService();
