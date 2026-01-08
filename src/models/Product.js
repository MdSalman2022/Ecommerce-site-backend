const mongoose = require('mongoose');

/**
 * Product Schema
 * Represents products in the e-commerce store
 * Matches actual productCollection structure
 */
const productSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Product name is required'],
            trim: true,
        },
        cat: {
            type: String,
            trim: true,
            index: true,
        },
        subcat: {
            type: String,
            trim: true,
            index: true,
        },
        brand: {
            type: String,
            trim: true,
            index: true,
        },
        manufacturer: {
            type: String,
            trim: true,
        },
        capacity: {
            type: String,
            trim: true,
        },
        // Inventory & Variants
        variantGroupId: {
            type: String,
            index: true, // properties with same groupId are variants of each other
        },
        variantAttributes: {
             type: Map,
             of: String, // e.g., { "color": "Red", "size": "XL" }
             default: {}
        },
        stock: {
            type: Number,
            default: 0,
            min: 0
        },
        sku: {
            type: String,
            trim: true,
        },
        
        // Specifications (key-value pairs)
        specifications: [{
            key: String,
            value: String
        }],

        // Pricing
        regularPrice: {
            type: Number,
            required: [true, 'Regular price is required'],
            min: 0
        },
        salePrice: {
            type: Number,
            default: 0,
            min: 0
        },
        costPrice: {
            type: Number,
            default: 0,
            min: 0 // For profit calculation
        },
        
        // Legacy fields mapping (for backward compatibility if needed)
        image: {
            type: String,
            trim: true,
        },
        images: {
            type: [String],
            default: [],
        },

        rating: {
            type: Number,
            min: 0,
            max: 5,
            default: 0,
        },
        featured: {
            type: Boolean,
            default: false,
            index: true,
        },
        latest: {
            type: Boolean,
            default: false,
        },
        bestseller: {
            type: Boolean,
            default: false,
            index: true,
        },
        sells: {
            type: Number,
            default: 0,
        },
        special: {
            type: Boolean,
            default: false,
            index: true,
        },
        specialprice: {
            type: Number,
            default: 0,
        },
        discount: {
            type: Number,
            default: 0,
        },
        date: {
            type: String,
        },

    },
    {
        timestamps: true,
        collection: 'productCollection',
    }
);

// Indexes for common queries
productSchema.index({ cat: 1, subcat: 1 });

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
