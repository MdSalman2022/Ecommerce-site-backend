const mongoose = require('mongoose');

/**
 * Store Settings Schema
 * Comprehensive document storing all store-wide settings
 * Uses a singleton pattern - only one document exists
 */
const storeSettingsSchema = new mongoose.Schema(
    {
        // ==================== LAYOUT SETTINGS ====================
        layout: {
            // Announcement Bar
            announcementBar: {
                enabled: { type: Boolean, default: true },
                text: { type: String, default: '🎉 Welcome to BestDeal!' },
                backgroundColor: { type: String, default: '' },
                textColor: { type: String, default: '' },
            },
            // Header
            header: {
                showSearchBar: { type: Boolean, default: true },
                showWishlist: { type: Boolean, default: true },
                showCompare: { type: Boolean, default: true },
            },
            // Footer
            footer: {
                showNewsletter: { type: Boolean, default: true },
                copyrightText: { type: String, default: '© 2025 BestDeal. All rights reserved.' },
            },
        },

        // ==================== STORE INFO ====================
        store: {
            name: { type: String, default: 'BestDeal' },
            tagline: { type: String, default: 'Your one-stop e-commerce destination' },
            logo: { type: String, default: '' },
            favicon: { type: String, default: '' },
            email: { type: String, default: '' },
            phone: { type: String, default: '' },
            address: { type: String, default: '' },
            currency: { type: String, default: 'BDT' },
            currencySymbol: { type: String, default: '৳' },
        },

        // ==================== SOCIAL LINKS ====================
        social: {
            facebook: { type: String, default: '' },
            instagram: { type: String, default: '' },
            twitter: { type: String, default: '' },
            youtube: { type: String, default: '' },
            linkedin: { type: String, default: '' },
            whatsapp: { type: String, default: '' },
        },

        // ==================== ECOMMERCE SETTINGS ====================
        ecommerce: {
            // Checkout
            enableGuestCheckout: { type: Boolean, default: true },
            minOrderAmount: { type: Number, default: 0 },
            maxOrderAmount: { type: Number, default: 0 }, // 0 = no limit
            
            // Shipping
            freeShippingThreshold: { type: Number, default: 0 },
            defaultShippingCost: { type: Number, default: 60 },
            
            // Stock
            lowStockThreshold: { type: Number, default: 5 },
            showOutOfStock: { type: Boolean, default: true },
            
            // Reviews
            enableReviews: { type: Boolean, default: true },
            reviewModeration: { type: Boolean, default: false },
        },

        // ==================== SEO SETTINGS ====================
        seo: {
            metaTitle: { type: String, default: 'BestDeal - E-commerce' },
            metaDescription: { type: String, default: 'Shop the best deals online' },
            metaKeywords: { type: String, default: '' },
            googleAnalyticsId: { type: String, default: '' },
            facebookPixelId: { type: String, default: '' },
        },

        // ==================== MAINTENANCE ====================
        maintenance: {
            enabled: { type: Boolean, default: false },
            message: { type: String, default: 'We are currently under maintenance. Please check back soon!' },
            allowedIPs: [{ type: String }], // Admin IPs that can bypass maintenance
        },

        // ==================== NOTIFICATIONS ====================
        notifications: {
            orderConfirmationEmail: { type: Boolean, default: true },
            orderStatusEmail: { type: Boolean, default: true },
            lowStockAlert: { type: Boolean, default: true },
            newOrderAlert: { type: Boolean, default: true },
            adminEmail: { type: String, default: '' },
        },

        // Metadata
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
    },
    {
        timestamps: true,
        collection: 'storeSettings',
    }
);

// Static method to get the singleton settings document
storeSettingsSchema.statics.getSettings = async function() {
    let settings = await this.findOne();
    if (!settings) {
        settings = await this.create({});
    }
    return settings;
};

const StoreSettings = mongoose.model('StoreSettings', storeSettingsSchema);

module.exports = StoreSettings;
