const express = require('express');
const router = express.Router();
const {
    getAllProducts,
    getProductById,
    getFeaturedProducts,
    getLatestProducts,
    getBestsellerProducts,
    getSpecialProducts,
    getLatestItems,
    getBackInStore,
    createProduct,
    updateProduct,
    deleteProducts,
} = require('../controllers/productController');
const { cacheMiddleware } = require('../middleware/cacheMiddleware');

/**
 * Product Routes
 * Base path: /api/products
 */

// GET routes - with caching for main products list
router.get('/', cacheMiddleware('products'), getAllProducts);
router.get('/featured', getFeaturedProducts);
router.get('/latest', getLatestProducts);
router.get('/bestseller', getBestsellerProducts);
router.get('/special', getSpecialProducts);
router.get('/latest-items', getLatestItems);
router.get('/back-in-store', getBackInStore);
router.get('/:id', getProductById);

// POST routes
router.post('/', createProduct);

// PUT routes
router.put('/:id', updateProduct);

// DELETE routes
router.delete('/', deleteProducts);

module.exports = router;
