const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.RESEND_TO_MAIL || 'onboarding@resend.dev';

/**
 * Send order confirmation email
 * @param {object} orderData - Order details
 * @returns {Promise<object>} - Email send result
 */
const sendOrderConfirmation = async (orderData) => {
    const { email, name, orderId, items, total, address, city, discount, promoCode } = orderData;

    const itemsList = items
        .map(item => `<tr>
            <td style="padding: 12px; border-bottom: 1px solid #eee;">${item.name}</td>
            <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
            <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">$${item.price.toFixed(2)}</td>
        </tr>`)
        .join('');

    const discountRow = discount > 0 
        ? `<tr>
            <td colspan="2" style="padding: 10px 15px; text-align: right; color: #666;">Discount ${promoCode ? `(${promoCode})` : ''}</td>
            <td style="padding: 10px 15px; text-align: right; color: #e11d48; font-weight: bold;">-$${discount.toFixed(2)}</td>
        </tr>`
        : '';

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
        <div style="background: linear-gradient(135deg, #ef7d00 0%, #ff9933 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Order Confirmed!</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Thank you for shopping with BestDeal</p>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <p style="font-size: 16px; color: #333;">Hi <strong>${name}</strong>,</p>
            <p style="color: #666; line-height: 1.6;">Your order has been confirmed and is being processed. Here's your order summary:</p>
            
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; color: #666;"><strong>Order ID:</strong> <span style="color: #ef7d00;">#${orderId}</span></p>
            </div>

            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <thead>
                    <tr style="background: #f8f9fa;">
                        <th style="padding: 12px; text-align: left; color: #333;">Product</th>
                        <th style="padding: 12px; text-align: center; color: #333;">Qty</th>
                        <th style="padding: 12px; text-align: right; color: #333;">Price</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsList}
                </tbody>
                <tfoot>
                    ${discountRow}
                    <tr>
                        <td colspan="2" style="padding: 15px; font-weight: bold; font-size: 18px;">Total Paid</td>
                        <td style="padding: 15px; text-align: right; font-weight: bold; font-size: 18px; color: #ef7d00;">$${total.toFixed(2)}</td>
                    </tr>
                </tfoot>
            </table>

            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0 0 5px 0; color: #666;"><strong>Shipping Address:</strong></p>
                <p style="margin: 0; color: #333;">${address}, ${city}</p>
            </div>

            <p style="color: #666; line-height: 1.6;">We'll send you another email when your order ships. If you have any questions, feel free to contact our support team.</p>

            <div style="text-align: center; margin-top: 30px;">
                <a href="https://bestdeal.com/orders" style="display: inline-block; background: #ef7d00; color: white; padding: 12px 30px; border-radius: 25px; text-decoration: none; font-weight: bold;">Track Your Order</a>
            </div>

            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            
            <p style="text-align: center; color: #999; font-size: 12px;">
                © 2024 BestDeal. All rights reserved.<br>
                This email was sent to ${email}
            </p>
        </div>
    </body>
    </html>
    `;

    try {
        const result = await resend.emails.send({
            from: `BestDeal <${FROM_EMAIL}>`,
            to: email,
            subject: `🎉 Order Confirmed - #${orderId}`,
            html,
        });
        return { success: true, messageId: result.id };
    } catch (error) {
        console.error('Email send error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Send shipping update email
 * @param {object} data - Shipping details
 * @returns {Promise<object>} - Email send result
 */
const sendShippingUpdate = async ({ email, name, orderId, status, trackingNumber }) => {
    const statusMessages = {
        picked: '📦 Your order has been picked up and is on its way!',
        shipped: '🚚 Your order is out for delivery!',
        delivered: '✅ Your order has been delivered!',
    };

    const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #ef7d00; padding: 20px; text-align: center; border-radius: 8px;">
            <h1 style="color: white; margin: 0;">Shipping Update</h1>
        </div>
        <div style="padding: 20px;">
            <p>Hi <strong>${name}</strong>,</p>
            <p style="font-size: 18px;">${statusMessages[status] || 'Your order status has been updated.'}</p>
            <p><strong>Order ID:</strong> #${orderId}</p>
            ${trackingNumber ? `<p><strong>Tracking Number:</strong> ${trackingNumber}</p>` : ''}
            <p>Thank you for shopping with BestDeal!</p>
        </div>
    </body>
    </html>
    `;

    try {
        const result = await resend.emails.send({
            from: `BestDeal <${FROM_EMAIL}>`,
            to: email,
            subject: `${statusMessages[status]?.split(' ')[0] || '📦'} Order #${orderId} - ${status.charAt(0).toUpperCase() + status.slice(1)}`,
            html,
        });
        return { success: true, messageId: result.id };
    } catch (error) {
        console.error('Email send error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Send welcome email
 * @param {object} data - User details
 * @returns {Promise<object>} - Email send result
 */
const sendWelcomeEmail = async ({ email, name }) => {
    const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #ef7d00 0%, #ff9933 100%); padding: 30px; text-align: center; border-radius: 12px;">
            <h1 style="color: white; margin: 0;">Welcome to BestDeal! 🎉</h1>
        </div>
        <div style="padding: 30px;">
            <p style="font-size: 16px;">Hi <strong>${name}</strong>,</p>
            <p>Thank you for joining BestDeal! We're excited to have you as part of our community.</p>
            <p>Here's what you can do now:</p>
            <ul>
                <li>🛒 Browse our amazing products</li>
                <li>❤️ Add items to your wishlist</li>
                <li>🎁 Enjoy exclusive member discounts</li>
            </ul>
            <div style="text-align: center; margin-top: 30px;">
                <a href="https://bestdeal.com" style="display: inline-block; background: #ef7d00; color: white; padding: 12px 30px; border-radius: 25px; text-decoration: none; font-weight: bold;">Start Shopping</a>
            </div>
        </div>
    </body>
    </html>
    `;

    try {
        const result = await resend.emails.send({
            from: `BestDeal <${FROM_EMAIL}>`,
            to: email,
            subject: 'Welcome to BestDeal! 🎉',
            html,
        });
        return { success: true, messageId: result.id };
    } catch (error) {
        console.error('Email send error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Send password reset email
 * @param {object} data - Reset details
 * @returns {Promise<object>} - Email send result
 */
const sendPasswordResetEmail = async ({ email, name, resetToken }) => {
    const resetUrl = `${process.env.FRONTEND_URL || 'https://bestdeal.com'}/reset-password?token=${resetToken}`;
    
    const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #ef7d00; padding: 30px; text-align: center; border-radius: 12px;">
            <h1 style="color: white; margin: 0;">Password Reset Request</h1>
        </div>
        <div style="padding: 30px;">
            <p>Hi <strong>${name}</strong>,</p>
            <p>We received a request to reset your password. If you didn't make this request, you can safely ignore this email.</p>
            <p>To reset your password, click the button below:</p>
            <div style="text-align: center; margin-top: 30px;">
                <a href="${resetUrl}" style="display: inline-block; background: #ef7d00; color: white; padding: 12px 30px; border-radius: 25px; text-decoration: none; font-weight: bold;">Reset Password</a>
            </div>
            <p style="margin-top: 30px; font-size: 12px; color: #666;">
                If the button above doesn't work, copy and paste this link into your browser:<br>
                <a href="${resetUrl}" style="color: #ef7d00;">${resetUrl}</a>
            </p>
            <p style="margin-top: 20px;">This link will expire in 1 hour.</p>
        </div>
    </body>
    </html>
    `;

    try {
        const result = await resend.emails.send({
            from: `BestDeal <${FROM_EMAIL}>`,
            to: email,
            subject: 'Password Reset Request - BestDeal',
            html,
        });
        return { success: true, messageId: result.id };
    } catch (error) {
        console.error('Email send error:', error);
        return { success: false, error: error.message };
    }
};

module.exports = {
    sendOrderConfirmation,
    sendShippingUpdate,
    sendWelcomeEmail,
    sendPasswordResetEmail,
};
