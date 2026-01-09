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
        // Session/User identification
        sessionId: {
            type: String,
            required: true,
            index: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            sparse: true,
        },
        email: {
            type: String,
            trim: true,
            lowercase: true,
        },
        phone: {
            type: String,
            trim: true,
        },
        
        // Cart items (snapshot at abandonment)
        items: [{
            productId: String,
            name: String,
            image: String,
            price: Number,
            quantity: Number,
            totalPrice: Number,
        }],
        
        // Cart value
        cartTotal: {
            type: Number,
            default: 0,
        },
        
        // Funnel stage
        stage: {
            type: String,
            enum: ['cart_added', 'checkout_started', 'checkout_info_filled', 'converted', 'abandoned'],
            default: 'cart_added',
        },
        
        // Checkout info (if they filled any before abandoning)
        checkoutInfo: {
            name: String,
            address: String,
            city: String,
            contact: String,
        },
        
        // Timing
        cartCreatedAt: {
            type: Date,
            default: Date.now,
        },
        checkoutStartedAt: Date,
        lastActivityAt: {
            type: Date,
            default: Date.now,
        },
        abandonedAt: Date,
        convertedAt: Date,
        
        // Recovery tracking
        recoveryEmailSent: {
            type: Boolean,
            default: false,
        },
        recoveryEmailSentAt: Date,
        
        // Device/source info
        deviceInfo: {
            userAgent: String,
            ip: String,
        },
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
abandonedCartSchema.index({ createdAt: 1 });

// Static method to find or create cart session
abandonedCartSchema.statics.findOrCreateSession = async function(sessionId, userId = null) {
    let cart = await this.findOne({ sessionId, stage: { $nin: ['converted', 'abandoned'] } });
    
    if (!cart) {
        cart = new this({ sessionId, userId });
        await cart.save();
    }
    
    return cart;
};

// Mark cart as checkout started
abandonedCartSchema.methods.startCheckout = async function() {
    this.stage = 'checkout_started';
    this.checkoutStartedAt = new Date();
    this.lastActivityAt = new Date();
    return this.save();
};

// Mark cart as converted (order placed)
abandonedCartSchema.methods.markConverted = async function() {
    this.stage = 'converted';
    this.convertedAt = new Date();
    return this.save();
};

const AbandonedCart = mongoose.model('AbandonedCart', abandonedCartSchema);

module.exports = AbandonedCart;
