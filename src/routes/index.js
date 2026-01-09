const express = require('express');
const router = express.Router();

// Import all route modules
const productRoutes = require('./productRoutes');
const userRoutes = require('./userRoutes');
const orderRoutes = require('./orderRoutes');
const reviewRoutes = require('./reviewRoutes');
const paymentRoutes = require('./paymentRoutes');
const uploadRoutes = require('./uploadRoutes');
const wishlistRoutes = require('./wishlistRoutes');
const aiRoutes = require('./aiRoutes');
const promoRoutes = require('./promoRoutes');
const authRoutes = require('./authRoutes');
const adminRoutes = require('./adminRoutes');
const analyticsRoutes = require('./analyticsRoutes');
const cartRoutes = require('./cartRoutes');
const cronRoutes = require('./cronRoutes');
const notificationRoutes = require('./notificationRoutes');
const teamRoutes = require('./teamRoutes');

const { productController, userController, orderController, reviewController, paymentController } = require('../controllers');

router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/cart', cartRoutes);
router.use('/cron', cronRoutes);
router.use('/notifications', notificationRoutes);
router.use('/products', productRoutes);
router.use('/users', userRoutes);
router.use('/orders', orderRoutes);
router.use('/reviews', reviewRoutes);
router.use('/payments', paymentRoutes);
router.use('/upload', uploadRoutes);
router.use('/wishlist', wishlistRoutes);
router.use('/ai', aiRoutes);
router.use('/promo', promoRoutes);
router.use('/team', teamRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'API is running',
        timestamp: new Date().toISOString(),
    });
});

// ============================================
// Legacy Route Aliases (for backward compatibility)
// These maintain the original API structure for frontend
// ============================================

/**
 * @deprecated Use /api/products instead
 */
const legacyRoutes = express.Router();

// Legacy product routes
legacyRoutes.get('/products', productController.getAllProducts);
legacyRoutes.get('/product/:id', productController.getProductById);
legacyRoutes.get('/featured', productController.getFeaturedProducts);
legacyRoutes.get('/latest', productController.getLatestProducts);
legacyRoutes.get('/bestseller', productController.getBestsellerProducts);
legacyRoutes.get('/special', productController.getSpecialProducts);
legacyRoutes.get('/latestItems', productController.getLatestItems);
legacyRoutes.get('/backInStore', productController.getBackInStore);
legacyRoutes.post('/addproduct', productController.createProduct);
legacyRoutes.put('/update/:id', productController.updateProduct);
legacyRoutes.delete('/delete', productController.deleteProducts);

// Legacy user routes
legacyRoutes.get('/getusers', userController.getAllUsers);
legacyRoutes.post('/adduser', userController.createUser);
legacyRoutes.put('/userdata', userController.updateCardInfo);
legacyRoutes.put('/deliveryInfo', userController.updateDeliveryInfo);

// Legacy order routes
legacyRoutes.get('/orderhistory', orderController.getAllOrders);
legacyRoutes.post('/orderhistory', orderController.createOrder);
legacyRoutes.put('/orderstatus', orderController.updateOrderStatus);
legacyRoutes.put('/orderCancel', orderController.cancelOrders);
legacyRoutes.delete('/deleteOrder', orderController.deleteOrders);

// Legacy review routes
legacyRoutes.get('/get-review', reviewController.getAllReviews);
legacyRoutes.post('/post-review', reviewController.createReview);

// Legacy payment routes
legacyRoutes.post('/create-payment-intent', paymentController.createPaymentIntent);

module.exports = { apiRoutes: router, legacyRoutes };
