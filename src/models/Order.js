const mongoose = require('mongoose');

/**
 * Order Item Schema (embedded)
 * Represents individual items in an order
 */
const orderItemSchema = new mongoose.Schema(
    {
        _id: String,
        name: String,
        cat: String,
        subcat: String,
        brand: String,
        image: String,
        spec: [String],
        price: Number,
        rating: Number,
        featured: Boolean,
        latest: Boolean,
        bestseller: Boolean,
        sells: Number,
        special: Boolean,
        specialprice: Number,
        discount: Number,
        date: String,
        stock: Boolean,
        capacity: String,
        quantity: {
            type: Number,
            default: 1,
        },
        totalPrice: Number,
    },
    { _id: false }
);

/**
 * Order Schema
 * Represents customer orders in the e-commerce platform
 * Matches actual OrderHistory collection structure
 */
const orderSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            trim: true,
        },
        orderId: {
            type: String,
            unique: true,
            sparse: true // Allows null/undefined for legacy orders
        },
        address: {
            type: String,
            trim: true,
        },
        contact: {
            type: String,
            trim: true,
        },
        city: {
            type: String,
            trim: true,
        },
        email: {
            type: String,
            trim: true,
            lowercase: true,
            match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
            // Email is optional for guest checkout, but if provided must be valid
        },
        isGuest: {
            type: Boolean,
            default: false,
        },
        transactionId: {
            type: String,
            trim: true,
        },
        amount: {
            type: Number,
            required: [true, 'Order amount is required'],
        },
        items: [orderItemSchema],
        date: {
            type: String,
        },
        orderStatus: {
            type: String,
            enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'],
            default: 'pending',
        },
        // Courier / Shipment Info (Steadfast)
        courierInfo: {
            consignmentId: String,
            invoice: String,
            trackingCode: String,
            status: String,
            note: String,
        },
        promoCode: {
            type: String,
            trim: true,
        },
        discountAmount: {
            type: Number,
            default: 0,
        },
        // Status History for Timeline
        statusHistory: [{
            status: {
                type: String,
                enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'],
            },
            timestamp: {
                type: Date,
                default: Date.now,
            },
            note: String,
        }],
    },
    {
        timestamps: true,
        collection: 'OrderHistory',
    }
);

// Indexes for common queries
orderSchema.index({ orderId: 1 });
orderSchema.index({ email: 1 });
orderSchema.index({ orderStatus: 1 });
orderSchema.index({ 'courierInfo.trackingCode': 1 });

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
