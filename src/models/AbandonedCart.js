const mongoose = require('mongoose');

/**
 * Abandoned Cart Schema
 * Tracks checkout abandonment for industry-standard abandoned cart analytics
 * 
 * Industry Best Practice:
 * - Create session when user adds item to cart
 * - Mark as "checkout_started" when they reach checkout page
 * - Remove/mark as "converted" when order is placed
 * - Abandoned = checkout_started but no order placed within timeout (e.g., 24 hours)
 */
const abandonedCartSchema = new mongoose.Schema(
    {
        // Reference to the actual cart
        cart: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Cart',
            required: true,
            index: true,
        },
        
        // Contact information (captured at checkout)
        email: {
            type: String,
            trim: true,
            lowercase: true,
        },
        phone: {
            type: String,
            trim: true,
        },
        
        // Funnel stage
        stage: {
            type: String,
            enum: ['checkout_started', 'checkout_info_filled', 'converted', 'abandoned'],
            default: 'checkout_started',
        },
        
        // Checkout info (shipping details)
        checkoutInfo: {
            name: String,
            address: String,
            city: String,
            contact: String,
            email: String,
        },
        
        // Timing
        checkoutStartedAt: {
            type: Date,
            default: Date.now,
        },
        lastActivityAt: {
            type: Date,
            default: Date.now,
        },
        abandonedAt: Date,
        convertedAt: Date,
        orderId: String,
        
        // Recovery tracking
        recoveryEmailSent: {
            type: Boolean,
            default: false,
        },
        recoveryEmailSentAt: Date,
    },
    {
        timestamps: true,
        collection: 'abandonedCarts',
    }
);

// Indexes
abandonedCartSchema.index({ stage: 1, lastActivityAt: 1 });
abandonedCartSchema.index({ email: 1 });
abandonedCartSchema.index({ phone: 1 });
abandonedCartSchema.index({ cart: 1 }, { unique: true }); // One abandoned cart per cart

const AbandonedCart = mongoose.model('AbandonedCart', abandonedCartSchema);

module.exports = AbandonedCart;
