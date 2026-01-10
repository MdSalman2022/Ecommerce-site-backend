/**
 * Models Module Aggregator
 * Centralizes all model exports
 */
const Product = require('./Product');
const User = require('./User');
const Order = require('./Order');
const Review = require('./Review');
const Wishlist = require('./Wishlist');
const AbandonedCart = require('./AbandonedCart');
const Cart = require('./Cart');
const StoreSettings = require('./SiteSettings');
const Category = require('./Category');

module.exports = {
    Product,
    User,
    Order,
    Review,
    Wishlist,
    AbandonedCart,
    Cart,
    StoreSettings,
    Category,
};
