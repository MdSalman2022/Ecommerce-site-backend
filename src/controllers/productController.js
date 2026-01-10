const { Product } = require('../models');
const mongoose = require('mongoose');
const asyncHandler = require('../utils/asyncHandler');
const { ApiResponse, ApiError } = require('../utils/ApiResponse');
const { clearCache } = require('../middleware/cacheMiddleware');

/**
 * @desc    Get all products with pagination, filtering, sorting, and search
 * @route   GET /api/products
 * @access  Public
 * @query   page, limit, category, brand, stockStatus, minPrice, maxPrice, sortBy, sortOrder, search
 */
const getAllProducts = asyncHandler(async (req, res) => {
    const { 
        page, 
        limit, 
        category, 
        brand, 
        stockStatus, 
        minPrice, 
        maxPrice, 
        sortBy, 
        sortOrder,
        search 
    } = req.query;

    // Build query
    let query = {};

    // Category filter
    if (category) {
        // Try to find category by slug first
        const categoryDoc = await mongoose.model('Category').findOne({ slug: category });
        const categoryId = categoryDoc ? categoryDoc._id : (mongoose.isValidObjectId(category) ? category : null);
        
        if (categoryId) {
            // Match if it's either in the category or in the subCategory
            query.$or = [
                { category: categoryId },
                { subCategory: categoryId }
            ];
        }
    }

    // Brand filter
    if (brand) {
        query.brand = brand;
    }

    // Search filter - search across name, brand, tags
    if (search) {
        query.$or = [
            { name: { $regex: search, $options: 'i' } },
            { brand: { $regex: search, $options: 'i' } },
            { tags: { $in: [new RegExp(search, 'i')] } }
        ];
    }

    // If pagination parameters are provided, return paginated results
    if (page || limit) {
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 20;
        const skip = (pageNum - 1) * limitNum;

        // Get all products matching the query for filtering by price/stock
        let productsQuery = Product.find(query)
            .populate('category', 'name slug')
            .populate('subCategory', 'name slug')
            .lean();

        let products = await productsQuery;

        // Stock status filter (needs to be done after query since it's in variants)
        if (stockStatus) {
            products = products.filter(p => {
                const totalStock = p.variants?.reduce((sum, v) => sum + (v.stock || 0), 0) || 0;
                
                switch (stockStatus) {
                    case 'in-stock':
                        return totalStock > 10;
                    case 'low-stock':
                        return totalStock > 0 && totalStock <= 10;
                    case 'out-of-stock':
                        return totalStock === 0;
                    default:
                        return true;
                }
            });
        }

        // Price range filter (needs to be done after query since price is in variants)
        if (minPrice || maxPrice) {
            products = products.filter(p => {
                const variant = p.variants?.[0];
                if (!variant) return false;
                
                const price = variant.salePrice > 0 ? variant.salePrice : variant.regularPrice;
                
                if (minPrice && maxPrice) {
                    return price >= parseFloat(minPrice) && price <= parseFloat(maxPrice);
                } else if (minPrice) {
                    return price >= parseFloat(minPrice);
                } else if (maxPrice) {
                    return price <= parseFloat(maxPrice);
                }
                return true;
            });
        }

        // Total before pagination
        const total = products.length;

        // Sorting
        if (sortBy) {
            products.sort((a, b) => {
                const order = sortOrder === 'asc' ? 1 : -1;
                
                switch (sortBy) {
                    case 'price': {
                        const priceA = a.variants?.[0]?.salePrice > 0 ? a.variants[0].salePrice : a.variants?.[0]?.regularPrice || 0;
                        const priceB = b.variants?.[0]?.salePrice > 0 ? b.variants[0].salePrice : b.variants?.[0]?.regularPrice || 0;
                        return (priceA - priceB) * order;
                    }
                    case 'date':
                        return (new Date(a.createdAt) - new Date(b.createdAt)) * order;
                    case 'stock': {
                        const stockA = a.variants?.reduce((sum, v) => sum + (v.stock || 0), 0) || 0;
                        const stockB = b.variants?.reduce((sum, v) => sum + (v.stock || 0), 0) || 0;
                        return (stockA - stockB) * order;
                    }
                    case 'name':
                        return a.name.localeCompare(b.name) * order;
                    default:
                        return 0;
                }
            });
        } else {
            // Default sort by createdAt descending
            products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }

        // Apply pagination
        const paginatedProducts = products.slice(skip, skip + limitNum);

        // Return paginated response
        return res.json({
            data: paginatedProducts,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total: total,
                pages: Math.ceil(total / limitNum)
            }
        });
    }

    // If no pagination, return all products (backward compatibility)
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
    const limitNum = parseInt(req.query.limit) || 8;
    const products = await Product.find({ 'flags.featured': true })
        .populate('category', 'name slug')
        .limit(limitNum)
        .sort({ createdAt: -1 })
        .lean();
    res.json(products);
});

/**
 * @desc    Get latest products
 * @route   GET /api/products/latest
 * @access  Public
 */
const getLatestProducts = asyncHandler(async (req, res) => {
    const limitNum = parseInt(req.query.limit) || 8;
    const products = await Product.find({ 'flags.latest': true })
        .sort({ createdAt: -1 })
        .populate('category', 'name slug')
        .limit(limitNum)
        .lean();
    res.json(products);
});

/**
 * @desc    Get bestseller products
 * @route   GET /api/products/bestseller
 * @access  Public
 */
const getBestsellerProducts = asyncHandler(async (req, res) => {
    const limitNum = parseInt(req.query.limit) || 8;
    const products = await Product.find({ 'flags.bestseller': true })
        .populate('category', 'name slug')
        .limit(limitNum)
        .sort({ createdAt: -1 })
        .lean();
    res.json(products);
});

/**
 * @desc    Get special products
 * @route   GET /api/products/special
 * @access  Public
 */
const getSpecialProducts = asyncHandler(async (req, res) => {
    const limitNum = parseInt(req.query.limit) || 8;
    const products = await Product.find({ 'flags.special': true })
        .populate('category', 'name slug')
        .limit(limitNum)
        .sort({ createdAt: -1 })
        .lean();
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
