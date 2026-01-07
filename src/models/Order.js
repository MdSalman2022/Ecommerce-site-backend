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
            required: [true, 'Customer email is required'],
            trim: true,
            lowercase: true,
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
            type: Boolean,
            default: true,
        },
        shipment: {
            type: String,
            default: 'pending',
        },
        promoCode: {
            type: String,
            trim: true,
        },
        discountAmount: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: true,
        collection: 'OrderHistory',
    }
);

// Indexes for common queries
orderSchema.index({ email: 1 });
orderSchema.index({ orderStatus: 1 });

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
