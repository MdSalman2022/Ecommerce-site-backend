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
        // Try to find category by slug
        const categoryDoc = await mongoose.model('Category').findOne({ slug: category });
        if (categoryDoc) {
            query.category = categoryDoc._id;
        } else if (mongoose.isValidObjectId(category)) {
            // If valid ID, assume it's ID
            query.category = category;
        }
    }

    const products = await Product.find(query)
        .populate('category', 'name slug')
        .populate('subCategory', 'name slug')
        .sort({ createdAt: -1 })
        .lean();

    res.json(products);
});

/**
 * @desc    Get product by ID
 * @route   GET /api/products/:id
 * @access  Public
 */
const getProductById = asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id)
        .populate('category', 'name slug')
        .populate('subCategory', 'name slug')
        .lean();

    if (!product) {
        throw new ApiError(404, 'Product not found');
    }

    res.json(product);
});

/**
 * @desc    Get product by slug
 * @route   GET /api/products/slug/:slug
 * @access  Public
 */
const getProductBySlug = asyncHandler(async (req, res) => {
    const product = await Product.findOne({ slug: req.params.slug })
        .populate('category', 'name slug')
        .populate('subCategory', 'name slug')
        .lean();

    if (!product) {
        throw new ApiError(404, 'Product not found');
    }

    res.json(product);
});

/**
 * @desc    Get featured products
 * @route   GET /api/products/featured
 * @access  Public
 */
const getFeaturedProducts = asyncHandler(async (req, res) => {
    const products = await Product.find({ 'flags.featured': true })
        .populate('category', 'name slug')
        .limit(8)
        .lean();
    res.json(products);
});

/**
 * @desc    Get latest products
 * @route   GET /api/products/latest
 * @access  Public
 */
const getLatestProducts = asyncHandler(async (req, res) => {
    const products = await Product.find({ 'flags.latest': true }) // Or just sort by date? Usually 'latest' flag is manual curation or just sort
        .sort({ createdAt: -1 })
        .populate('category', 'name slug')
        .limit(8)
        .lean();
    res.json(products);
});

/**
 * @desc    Get bestseller products
 * @route   GET /api/products/bestseller
 * @access  Public
 */
const getBestsellerProducts = asyncHandler(async (req, res) => {
    const products = await Product.find({ 'flags.bestseller': true })
        .populate('category', 'name slug')
        .limit(8)
        .lean();
    res.json(products);
});

/**
 * @desc    Get special products
 * @route   GET /api/products/special
 * @access  Public
 */
const getSpecialProducts = asyncHandler(async (req, res) => {
    const products = await Product.find({ special: true }).limit(4).lean();
    // Return plain array for frontend compatibility
    res.json(products);
});

/**
 * @desc    Get latest items (3)
 * @route   GET /api/products/latest-items
 * @access  Public
 */
const getLatestItems = asyncHandler(async (req, res) => {
    const products = await Product.find().sort({ createdAt: -1 }).limit(3).lean();
    // Return plain array for frontend compatibility
    res.json(products);
});

/**
 * @desc    Get back in store products
 * @route   GET /api/products/back-in-store
 * @access  Public
 */
const getBackInStore = asyncHandler(async (req, res) => {
    const products = await Product.find().sort({ createdAt: -1 }).limit(20).lean();
    // Return plain array for frontend compatibility
    res.json(products);
});

/**
 * @desc    Create new product
 * @route   POST /api/products
 * @access  Private/Admin
 */
const createProduct = asyncHandler(async (req, res) => {
    const { variantConfigs, featured, latest, bestseller, special, image, images } = req.body;
    let productData = { ...req.body };
    
    // Handle flags - group them into flags object
    productData.flags = {
        featured: featured || false,
        latest: latest || false,
        bestseller: bestseller || false,
        special: special || false,
    };
    
    // Remove legacy flag fields from root
    delete productData.featured;
    delete productData.latest;
    delete productData.bestseller;
    delete productData.special;
    
    // Handle images array
    if (image && (!images || images.length === 0)) {
        productData.images = [image];
    } else if (images) {
        productData.images = images;
    }
    delete productData.image;
    
    // Handle variants
    if (variantConfigs && variantConfigs.length > 0) {
        // Multi-variant product
        productData.variants = variantConfigs.map(config => ({
            attributes: config.attributes || {},
            sku: config.sku || `SKU-${Date.now().toString().slice(-4)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
            regularPrice: config.regularPrice,
            salePrice: config.salePrice || 0,
            costPrice: config.costPrice || 0,
            stock: config.stock || 0,
            sells: 0,
            images: config.images || []
        }));
        delete productData.variantConfigs;
    } else {
        // Single-variant product - create one variant from root fields
        productData.variants = [{
            attributes: {},
            sku: productData.sku || `SKU-${Date.now().toString().slice(-4)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
            regularPrice: productData.regularPrice || productData.price || 0,
            salePrice: productData.salePrice || 0,
            costPrice: productData.costPrice || 0,
            stock: productData.stock || 0,
            sells: 0,
            images: []
        }];
    }
    
    // Remove legacy root-level fields (they're now in variants)
    delete productData.regularPrice;
    delete productData.salePrice;
    delete productData.costPrice;
    delete productData.stock;
    delete productData.sku;
    delete productData.price;
    delete productData.specialprice;
    delete productData.discount;
    delete productData.sells;
    
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

    const { variantConfigs, featured, latest, bestseller, special, image, images } = req.body;
    const productData = { ...req.body };
    
    // Handle flags - group them into flags object
    if (featured !== undefined || latest !== undefined || bestseller !== undefined || special !== undefined) {
        productData.flags = {
            featured: featured !== undefined ? featured : product.flags?.featured || false,
            latest: latest !== undefined ? latest : product.flags?.latest || false,
            bestseller: bestseller !== undefined ? bestseller : product.flags?.bestseller || false,
            special: special !== undefined ? special : product.flags?.special || false,
        };
    }
    
    // Remove legacy flag fields from root
    delete productData.featured;
    delete productData.latest;
    delete productData.bestseller;
    delete productData.special;
    
    // Handle images array
    if (image && (!productData.images || productData.images.length === 0)) {
        productData.images = [image];
    }
    delete productData.image;
    
    // Handle variants
    if (variantConfigs && variantConfigs.length > 0) {
        // Multi-variant product update
        productData.variants = variantConfigs.map(config => ({
            attributes: config.attributes || {},
            sku: config.sku || `SKU-${Date.now().toString().slice(-4)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
            regularPrice: config.regularPrice,
            salePrice: config.salePrice || 0,
            costPrice: config.costPrice || 0,
            stock: config.stock || 0,
            sells: config.sells || 0,
            images: config.images || []
        }));
        delete productData.variantConfigs;
    }
    
    // Remove legacy root-level fields (they're now in variants)
    delete productData.regularPrice;
    delete productData.salePrice;
    delete productData.costPrice;
    delete productData.stock;
    delete productData.sku;
    delete productData.price;
    delete productData.specialprice;
    delete productData.discount;
    delete productData.sells;

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
    getProductBySlug,
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
