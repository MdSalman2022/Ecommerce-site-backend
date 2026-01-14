const mongoose = require('mongoose');

/**
 * Promo Code Usage Schema
 * Tracks individual redemptions for audit trail and fraud prevention
 */
const promoCodeUsageSchema = new mongoose.Schema(
    {
        promoCodeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'PromoCode',
            required: true,
            index: true,
        },
        orderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Order',
            required: true,
            index: true,
        },
        code: {
            type: String,
            required: true,
            uppercase: true,
            trim: true,
            index: true,
        },
        discountAmount: {
            type: Number,
            required: true,
            min: 0,
        },
        orderTotal: {
            type: Number,
            required: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        email: {
            type: String,
            trim: true,
            lowercase: true,
        },
        sessionId: {
            type: String,
            trim: true,
        },
        ipAddress: {
            type: String,
        },
    },
    {
        timestamps: true,
        collection: 'promoCodeUsage',
    }
);

// Compound indexes for common queries
promoCodeUsageSchema.index({ code: 1, email: 1 });
promoCodeUsageSchema.index({ code: 1, userId: 1 });
promoCodeUsageSchema.index({ code: 1, createdAt: -1 });
promoCodeUsageSchema.index({ promoCodeId: 1, createdAt: -1 });

const PromoCodeUsage = mongoose.model('PromoCodeUsage', promoCodeUsageSchema);

module.exports = PromoCodeUsage;
