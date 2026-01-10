const Wishlist = require('../models/Wishlist');
const { Product } = require('../models');
const asyncHandler = require('../utils/asyncHandler');

/**
 * @desc    Get user's wishlist
 * @route   GET /api/wishlist/:email
 * @access  Private
 */
const getWishlist = asyncHandler(async (req, res) => {
    const { email } = req.params;

    const wishlistItems = await Wishlist.find({ email }).populate({
        path: 'productId',
        select: 'name slug images brand category subCategory rating variants flags',
    }).sort({ addedAt: -1 }).lean();

    const products = wishlistItems
        .filter(item => item.productId) // Filter out any null products
        .map(item => {
            const product = item.productId;
            const mainVariant = product.variants?.[0] || {};
            
            return {
                _id: product._id,
                name: product.name,
                slug: product.slug,
                price: mainVariant.salePrice > 0 ? mainVariant.salePrice : mainVariant.regularPrice,
                regularPrice: mainVariant.regularPrice,
                image: (product.images && product.images[0]) || (mainVariant.images && mainVariant.images[0]),
                brand: product.brand,
                category: product.category,
                subCategory: product.subCategory,
                rating: product.rating,
                stock: (mainVariant.stock || 0) > 0,
                flags: product.flags,
                addedAt: item.addedAt,
            };
        });

    res.json({
        success: true,
        count: products.length,
        products,
    });
});

/**
 * @desc    Add product to wishlist
 * @route   POST /api/wishlist
 * @access  Private
 */
const addToWishlist = asyncHandler(async (req, res) => {
    const { email, productId } = req.body;

    if (!email || !productId) {
        return res.status(400).json({ 
            success: false, 
            error: 'Email and productId are required' 
        });
    }

    // Check if already in wishlist
    const existing = await Wishlist.findOne({ email, productId });
    if (existing) {
        return res.status(400).json({ 
            success: false, 
            error: 'Product already in wishlist' 
        });
    }

    // Verify product exists
    const product = await Product.findById(productId);
    if (!product) {
        return res.status(404).json({ 
            success: false, 
            error: 'Product not found' 
        });
    }

    const wishlistItem = await Wishlist.create({ email, productId });

    res.status(201).json({
        success: true,
        message: 'Added to wishlist',
        item: wishlistItem,
    });
});

/**
 * @desc    Remove product from wishlist
 * @route   DELETE /api/wishlist/:email/:productId
 * @access  Private
 */
const removeFromWishlist = asyncHandler(async (req, res) => {
    const { email, productId } = req.params;

    const result = await Wishlist.findOneAndDelete({ email, productId });

    if (!result) {
        return res.status(404).json({ 
            success: false, 
            error: 'Item not found in wishlist' 
        });
    }

    res.json({
        success: true,
        message: 'Removed from wishlist',
    });
});

/**
 * @desc    Check if product is in wishlist
 * @route   GET /api/wishlist/check/:email/:productId
 * @access  Private
 */
const checkWishlist = asyncHandler(async (req, res) => {
    const { email, productId } = req.params;

    const exists = await Wishlist.findOne({ email, productId });

    res.json({
        success: true,
        inWishlist: !!exists,
    });
});

/**
 * @desc    Get wishlist count for user
 * @route   GET /api/wishlist/count/:email
 * @access  Private
 */
const getWishlistCount = asyncHandler(async (req, res) => {
    const { email } = req.params;

    const count = await Wishlist.countDocuments({ email });

    res.json({
        success: true,
        count,
    });
});

module.exports = {
    getWishlist,
    addToWishlist,
    removeFromWishlist,
    checkWishlist,
    getWishlistCount,
};
