const mongoose = require('mongoose');

/**
 * Promo Code Schema
 * Represents discount codes for the e-commerce store
 */
const promoCodeSchema = new mongoose.Schema(
    {
        code: {
            type: String,
            required: [true, 'Promo code is required'],
            unique: true,
            uppercase: true,
            trim: true,
            index: true,
        },
        description: {
            type: String,
            trim: true,
        },
        discountType: {
            type: String,
            enum: ['percentage', 'fixed'],
            required: true,
            default: 'percentage',
        },
        discountValue: {
            type: Number,
            required: [true, 'Discount value is required'],
            min: [0, 'Discount cannot be negative'],
        },
        minOrderAmount: {
            type: Number,
            default: 0,
            min: 0,
        },
        maxDiscount: {
            type: Number,
            default: null, // null means no limit
        },
        usageLimit: {
            type: Number,
            default: null, // null means unlimited
        },
        usedCount: {
            type: Number,
            default: 0,
        },
        validFrom: {
            type: Date,
            default: Date.now,
        },
        validUntil: {
            type: Date,
            required: [true, 'Expiry date is required'],
        },
        isActive: {
            type: Boolean,
            default: true,
            index: true,
        },
        applicableCategories: {
            type: [String],
            default: [], // Empty means all categories
        },
        createdBy: {
            type: String,
        },
    },
    {
        timestamps: true,
        collection: 'promoCodeCollection',
    }
);

// Index for active promo codes lookup
promoCodeSchema.index({ code: 1, isActive: 1, validUntil: 1 });

// Virtual to check if promo is currently valid
promoCodeSchema.virtual('isValid').get(function() {
    const now = new Date();
    return (
        this.isActive &&
        now >= this.validFrom &&
        now <= this.validUntil &&
        (this.usageLimit === null || this.usedCount < this.usageLimit)
    );
});

// Method to validate promo code for an order
promoCodeSchema.methods.validateForOrder = function(orderTotal, category = null) {
    const errors = [];
    const now = new Date();

    if (!this.isActive) {
        errors.push('This promo code is no longer active');
    }
    if (now < this.validFrom) {
        errors.push('This promo code is not yet valid');
    }
    if (now > this.validUntil) {
        errors.push('This promo code has expired');
    }
    if (this.usageLimit !== null && this.usedCount >= this.usageLimit) {
        errors.push('This promo code has reached its usage limit');
    }
    if (orderTotal < this.minOrderAmount) {
        errors.push(`Minimum order amount is $${this.minOrderAmount}`);
    }
    if (this.applicableCategories.length > 0 && category && !this.applicableCategories.includes(category)) {
        errors.push('This promo code is not valid for these items');
    }

    return {
        isValid: errors.length === 0,
        errors,
    };
};

// Method to calculate discount amount
promoCodeSchema.methods.calculateDiscount = function(orderTotal) {
    let discount = 0;

    if (this.discountType === 'percentage') {
        discount = (orderTotal * this.discountValue) / 100;
    } else {
        discount = this.discountValue;
    }

    // Apply max discount cap if set
    if (this.maxDiscount !== null && discount > this.maxDiscount) {
        discount = this.maxDiscount;
    }

    // Ensure discount doesn't exceed order total
    if (discount > orderTotal) {
        discount = orderTotal;
    }

    return Math.round(discount * 100) / 100; // Round to 2 decimal places
};

const PromoCode = mongoose.model('PromoCode', promoCodeSchema);

module.exports = PromoCode;
