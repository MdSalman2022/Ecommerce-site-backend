const { Product } = require('../models');
const mongoose = require('mongoose');
const asyncHandler = require('../utils/asyncHandler');
const { ApiResponse, ApiError } = require('../utils/ApiResponse');
const { clearCache } = require('../middleware/cacheMiddleware');

/**
 * @desc    Get all products
 * @route   GET /api/products
 * @access  Public
 */
const getAllProducts = asyncHandler(async (req, res) => {
    const { category } = req.query;
    let query = {};

    if (category) {
        query.cat = category;
    }

    const products = await Product.find(query).sort({ createdAt: -1 });
    // Return plain array for frontend compatibility
    res.json(products);
});

/**
 * @desc    Get product by ID
 * @route   GET /api/products/:id
 * @access  Public
 */
const getProductById = asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id);

    if (!product) {
        throw new ApiError(404, 'Product not found');
    }

    // Return plain object for frontend compatibility
    res.json(product);
});

/**
 * @desc    Get featured products
 * @route   GET /api/products/featured
 * @access  Public
 */
const getFeaturedProducts = asyncHandler(async (req, res) => {
    const products = await Product.find({ featured: true }).limit(4);
    // Return plain array for frontend compatibility
    res.json(products);
});

/**
 * @desc    Get latest products
 * @route   GET /api/products/latest
 * @access  Public
 */
const getLatestProducts = asyncHandler(async (req, res) => {
    const products = await Product.find().sort({ createdAt: -1 }).limit(4);
    // Return plain array for frontend compatibility
    res.json(products);
});

/**
 * @desc    Get bestseller products
 * @route   GET /api/products/bestseller
 * @access  Public
 */
const getBestsellerProducts = asyncHandler(async (req, res) => {
    const products = await Product.find({ bestseller: true }).limit(4);
    // Return plain array for frontend compatibility
    res.json(products);
});

/**
 * @desc    Get special products
 * @route   GET /api/products/special
 * @access  Public
 */
const getSpecialProducts = asyncHandler(async (req, res) => {
    const products = await Product.find({ special: true }).limit(4);
    // Return plain array for frontend compatibility
    res.json(products);
});

/**
 * @desc    Get latest items (3)
 * @route   GET /api/products/latest-items
 * @access  Public
 */
const getLatestItems = asyncHandler(async (req, res) => {
    const products = await Product.find().sort({ createdAt: -1 }).limit(3);
    // Return plain array for frontend compatibility
    res.json(products);
});

/**
 * @desc    Get back in store products
 * @route   GET /api/products/back-in-store
 * @access  Public
 */
const getBackInStore = asyncHandler(async (req, res) => {
    const products = await Product.find().sort({ createdAt: -1 }).limit(20);
    // Return plain array for frontend compatibility
    res.json(products);
});

/**
 * @desc    Create new product
 * @route   POST /api/products
 * @access  Private/Admin
 */
const createProduct = asyncHandler(async (req, res) => {
    const { variantConfigs } = req.body; // Remove hasVariants from destructuring
    let productData = { ...req.body };
    
    // Auto-generate SKU if missing
    if (!productData.sku || productData.sku.trim() === '') {
        const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
        productData.sku = `SKU-${Date.now().toString().slice(-4)}-${randomSuffix}`;
    }
    
    // Handle products with variants
    if (variantConfigs && variantConfigs.length > 0) {
        // Map variantConfigs to variants array
        productData.variants = variantConfigs.map(config => {
            const variantSku = `${productData.sku}-${config.id}`;
            
            return {
                attributes: config.attributes,
                sku: variantSku,
                regularPrice: config.regularPrice,
                salePrice: config.salePrice,
                costPrice: config.costPrice,
                stock: config.stock,
                images: config.images || []
            };
        });
        
        // Remove meta-fields that shouldn't be stored
        delete productData.variantConfigs;
    }
    
    // Ensure IDs are used if sent
    if (req.body.category) productData.category = req.body.category;
    if (req.body.subCategory) productData.subCategory = req.body.subCategory;

    const product = await Product.create(productData);

    // Clear cache
    clearCache('products');

    res.status(201).json(product);
});

/**
 * @desc    Update product
 * @route   PUT /api/products/:id
 * @access  Private/Admin
 */
const updateProduct = asyncHandler(async (req, res) => {
    let product = await Product.findById(req.params.id);

    if (!product) {
        throw new ApiError(404, 'Product not found');
    }

    const productData = { ...req.body };
    
    // Handle variant product updates
    if (productData.variantConfigs && productData.variantConfigs.length > 0) {
        // Map variantConfigs to variants array
        productData.variants = productData.variantConfigs.map(config => {
            const variantSku = `${productData.sku}-${config.id}`;
            
            return {
                attributes: config.attributes,
                sku: variantSku,
                regularPrice: config.regularPrice,
                salePrice: config.salePrice,
                costPrice: config.costPrice,
                stock: config.stock,
                images: config.images || []
            };
        });
        
        // Remove meta-fields
        delete productData.variantConfigs;
    }
    
    // Ensure IDs are used if sent
    if (req.body.category) productData.category = req.body.category;
    if (req.body.subCategory) productData.subCategory = req.body.subCategory;

    product = await Product.findByIdAndUpdate(req.params.id, productData, {
        new: true,
        runValidators: true,
    });

    // Clear cache
    clearCache('products');

    res.json(product);
});

/**
 * @desc    Delete multiple products
 * @route   DELETE /api/products
 * @access  Private/Admin
 */
const deleteProducts = asyncHandler(async (req, res) => {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        throw new ApiError(400, 'Please provide product IDs to delete');
    }

    const result = await Product.deleteMany({ _id: { $in: ids } });

    // Clear products cache
    clearCache('products');

    res.json({ deletedCount: result.deletedCount });
});

module.exports = {
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
};
