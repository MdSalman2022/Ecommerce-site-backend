/**
 * Controllers Module Aggregator
 * Centralizes all controller exports
 */
const productController = require('./productController');
const userController = require('./userController');
const orderController = require('./orderController');
const reviewController = require('./reviewController');
const paymentController = require('./paymentController');
const authController = require('./authController');

module.exports = {
    productController,
    userController,
    orderController,
    reviewController,
    paymentController,
    authController,
};
