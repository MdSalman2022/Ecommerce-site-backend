const mongoose = require('mongoose');

/**
 * Product Schema - Clean, simplified structure
 * All products use variants array for pricing/stock, even single-variant products
 */
const productSchema = new mongoose.Schema(
    {
        // Core Information
        name: {
            type: String,
            required: [true, 'Product name is required'],
            trim: true,
        },
        slug: {
            type: String,
            unique: true,
            trim: true,
            index: true,
        },
        description: {
            type: String,
            trim: true,
        },
        tags: {
            type: [String],
            default: [],
            index: true,
        },
        
        // Categories (ObjectId references only)
        category: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Category',
            index: true,
        },
        subCategory: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Category',
            index: true,
        },
        
        // Brand Information
        brand: {
            type: String,
            trim: true,
            index: true,
        },
        manufacturer: {
            type: String,
            trim: true,
        },
        
        // Media
        images: {
            type: [String],
            default: [],
        },
        
        // Specifications (key-value pairs)
        specifications: [{
            key: String,
            value: String
        }],
        
        // Product Flags
        flags: {
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
            special: {
                type: Boolean,
                default: false,
                index: true,
            },
        },
        
        // Variants (ALL products use this - even single-variant products)
        variants: [{
            attributes: {
                type: Map,
                of: String,
                default: {} // Empty for single-variant products
            },
            sku: {
                type: String,
                trim: true
            },
            regularPrice: {
                type: Number,
                required: true,
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
                min: 0
            },
            stock: {
                type: Number,
                default: 0,
                min: 0
            },
            sells: {
                type: Number,
                default: 0,
                min: 0
            },
            images: {
                type: [String],
                default: []
            }
        }],
        
        // Rating
        rating: {
            type: Number,
            min: 0,
            max: 5,
            default: 0,
        },
    },
    {
        timestamps: true,
        collection: 'productCollection',
    }
);

// Indexes for common queries
productSchema.index({ 'category': 1, 'subCategory': 1 });

// Slug generation utility
async function generateUniqueSlug(name, productId) {
    // Take first 100 chars, convert to lowercase, replace spaces/special chars with hyphens
    let baseSlug = name
        .slice(0, 100)
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    
    let slug = baseSlug;
    let counter = 1;
    
    // Check if slug exists (excluding current product if updating)
    const Product = mongoose.model('Product');
    while (await Product.findOne({ slug, _id: { $ne: productId } })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
    }
    
    return slug;
}

// Pre-save hook: Generate slug if missing or name changed
productSchema.pre('save', async function(next) {
    // Generate slug if missing or name changed
    if (!this.slug || this.isModified('name')) {
        this.slug = await generateUniqueSlug(this.name, this._id);
    }
    
    // Ensure at least one variant exists
    if (!this.variants || this.variants.length === 0) {
        throw new Error('Product must have at least one variant');
    }
    
    next();
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
