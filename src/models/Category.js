const mongoose = require('mongoose');
const slugify = require('slugify');

const categorySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Category name is required'],
            trim: true,
            unique: true,
        },
        slug: {
            type: String,
            unique: true,
            index: true,
        },
        parent: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Category',
            default: null,
        },
        image: {
            type: String,
            default: '',
        },
        icon: {
            type: String, // e.g., 'Smartphone', 'Laptop' (lucide icon names)
            default: 'Circle',
        },
        description: {
            type: String,
            trim: true,
        },
        showInHeader: {
            type: Boolean,
            default: true,
        },
        showInSidebar: {
            type: Boolean,
            default: true,
        },
        order: {
            type: Number,
            default: 0,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// Virtual for subcategories
categorySchema.virtual('subcategories', {
    ref: 'Category',
    localField: '_id',
    foreignField: 'parent',
});

// Auto-generate slug before save
categorySchema.pre('save', function (next) {
    if (this.isModified('name') && !this.slug) {
        this.slug = slugify(this.name, { lower: true, strict: true });
    }
    next();
});

const Category = mongoose.model('Category', categorySchema);

module.exports = Category;
