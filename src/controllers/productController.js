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
    const products = await Product.find().sort({ createdAt: -1 });
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
    const productData = req.body;
    
    // Check if we need to create variants
    if (productData.hasVariants && productData.variantOptions && productData.variantOptions.length > 0) {
        
        // 1. Generate a common Group ID
        const variantGroupId = new mongoose.Types.ObjectId();
        
        // 2. Parse Options (Currently handling 1st dimension for simplicity, can be expanded)
        // e.g. [{ name: "Color", values: "Red, Blue" }]
        const primaryOption = productData.variantOptions[0];
        const optionName = primaryOption.name;
        const optionValues = primaryOption.values.split(',').map(v => v.trim()).filter(v => v);
        
        const createdProducts = [];
        
        for (const val of optionValues) {
             const variantPayload = {
                 ...productData,
                 name: `${productData.name} - ${val}`,
                 variantGroupId: variantGroupId,
                 variantAttributes: { [optionName]: val },
                 // Ensure each variant has unique URL/Slug/ID distinctness if needed
             };
             
             // Remove meta-fields that define the group
             delete variantPayload.variantOptions;
             delete variantPayload.hasVariants;
             
             const product = await Product.create(variantPayload);
             createdProducts.push(product);
        }
        
        clearCache('products');
        res.status(201).json({ message: `Created ${createdProducts.length} variants`, products: createdProducts });

    } else {
        // Single product creation
        const product = await Product.create(productData);
        clearCache('products');
        res.status(201).json(product);
    }
});

/**
 * @desc    Update product
 * @route   PUT /api/products/:id
 * @access  Private/Admin
 */
const updateProduct = asyncHandler(async (req, res) => {
    const { name, price, stock } = req.body;

    const product = await Product.findByIdAndUpdate(
        req.params.id,
        { name, price, stock },
        { new: true, runValidators: true }
    );

    if (!product) {
        throw new ApiError(404, 'Product not found');
    }

    // Clear products cache
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
