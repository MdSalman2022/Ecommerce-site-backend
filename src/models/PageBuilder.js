const mongoose = require('mongoose');

/**
 * PageBuilder Schema - Store customizable page configurations
 * Allows admins to customize landing pages with sections like hero, products, categories, etc.
 */

const sectionSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['hero', 'brandMarquee', 'categories', 'products', 'serviceBar', 'aiRecommendations'],
        required: true
    },
    isVisible: {
        type: Boolean,
        default: true
    },
    order: {
        type: Number,
        required: true
    },
    config: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, { _id: false });

const pageBuilderSchema = new mongoose.Schema(
    {
        pageName: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            index: true
        },
        isPublished: {
            type: Boolean,
            default: false
        },
        sections: [sectionSchema],
        metadata: {
            lastEditedBy: String,
            publishedAt: Date,
            version: {
                type: Number,
                default: 1
            }
        }
    },
    {
        timestamps: true,
        collection: 'pageBuilders'
    }
);

// Method to publish page
pageBuilderSchema.methods.publish = function() {
    this.isPublished = true;
    this.metadata.publishedAt = new Date();
    return this.save();
};

// Method to increment version
pageBuilderSchema.pre('save', function(next) {
    if (this.isModified('sections')) {
        this.metadata.version += 1;
    }
    next();
});

const PageBuilder = mongoose.model('PageBuilder', pageBuilderSchema);

module.exports = PageBuilder;
