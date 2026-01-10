const mongoose = require('mongoose');

/**
 * Cart Schema
 * Stores cart items for authenticated users for cross-device persistence
 */
const cartSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            sparse: true, // Allows multiple null values (for guest carts)
            index: true,
        },
        sessionId: {
            type: String,
            index: true, 
            sparse: true, // Unique index for guests (allows null for auth users)
        },
        items: [{
            product: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Product',
                required: true
            },
            variantId: {
                type: String, // ID of the variant from the variants array
                required: true
            },
            quantity: {
                type: Number,
                required: true,
                min: 1,
                default: 1
            }
        }],
        lastActivityAt: {
            type: Date,
            default: Date.now,
        }
    },
    {
        timestamps: true,
        collection: 'cartCollection',
    }
);

// Auto-delete guest carts after 30 days of inactivity
cartSchema.index({ lastActivityAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

const Cart = mongoose.model('Cart', cartSchema);

module.exports = Cart;
