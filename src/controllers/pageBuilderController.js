const PageBuilder = require('../models/PageBuilder');
const asyncHandler = require('../utils/asyncHandler');
const { ApiError } = require('../utils/ApiResponse');

/**
 * @desc    Get page configuration
 * @route   GET /api/page-builder/:pageName
 * @access  Public
 */
const getPageConfig = asyncHandler(async (req, res) => {
    const { pageName } = req.params;
    
    const pageConfig = await PageBuilder.findOne({ pageName }).lean();
    
    if (!pageConfig) {
        throw new ApiError(404, `Page configuration for '${pageName}' not found`);
    }
    
    res.json({
        success: true,
        data: pageConfig
    });
});

/**
 * @desc    Get published page configuration (for public use)
 * @route   GET /api/page-builder/:pageName/published
 * @access  Public
 */
const getPublishedPageConfig = asyncHandler(async (req, res) => {
    const { pageName } = req.params;
    
    const pageConfig = await PageBuilder.findOne({ 
        pageName,
        isPublished: true 
    }).lean();
    
    if (!pageConfig) {
        throw new ApiError(404, `Published page configuration for '${pageName}' not found`);
    }
    
    res.json({
        success: true,
        data: pageConfig
    });
});

/**
 * @desc    Update page configuration
 * @route   PUT /api/page-builder/:pageName
 * @access  Private/Admin
 */
const updatePageConfig = asyncHandler(async (req, res) => {
    const { pageName } = req.params;
    const { sections, isPublished } = req.body;
    const mongoose = require('mongoose');
    
    let pageConfig = await PageBuilder.findOne({ pageName });
    
    // Process sections to ensure they all have IDs
    const processedSections = (sections || []).map(section => {
        if (!section.id) {
            return {
                ...section,
                id: new mongoose.Types.ObjectId().toHexString()
            };
        }
        return section;
    });
    
    if (!pageConfig) {
        // Create new page config if doesn't exist
        pageConfig = new PageBuilder({
            pageName,
            sections: processedSections,
            isPublished: isPublished || false
        });
    } else {
        // Update existing
        if (sections) pageConfig.sections = processedSections;
        if (isPublished !== undefined) pageConfig.isPublished = isPublished;
    }
    
    // Set metadata
    if (req.user) {
        pageConfig.metadata.lastEditedBy = req.user.email || req.user.name;
    }
    
    await pageConfig.save();
    
    res.json({
        success: true,
        message: 'Page configuration updated successfully',
        data: pageConfig
    });
});

/**
 * @desc    Publish page configuration
 * @route   POST /api/page-builder/:pageName/publish
 * @access  Private/Admin
 */
const publishPageConfig = asyncHandler(async (req, res) => {
    const { pageName } = req.params;
    
    const pageConfig = await PageBuilder.findOne({ pageName });
    
    if (!pageConfig) {
        throw new ApiError(404, `Page configuration for '${pageName}' not found`);
    }
    
    await pageConfig.publish();
    
    res.json({
        success: true,
        message: 'Page published successfully',
        data: pageConfig
    });
});

/**
 * @desc    Reset page to default configuration
 * @route   POST /api/page-builder/:pageName/reset
 * @access  Private/Admin
 */
const resetPageConfig = asyncHandler(async (req, res) => {
    const { pageName } = req.params;
    
    // Get default config based on page name
    const defaultConfig = getDefaultPageConfig(pageName);
    
    if (!defaultConfig) {
        throw new ApiError(400, `No default configuration available for '${pageName}'`);
    }
    
    const pageConfig = await PageBuilder.findOneAndUpdate(
        { pageName },
        { 
            $set: {
                sections: defaultConfig.sections,
                isPublished: false
            }
        },
        { new: true, upsert: true }
    );
    
    res.json({
        success: true,
        message: 'Page reset to default configuration',
        data: pageConfig
    });
});

/**
 * Get default configuration for a page
 */
function getDefaultPageConfig(pageName) {
    if (pageName === 'home') {
        return {
            sections: [
                {
                    id: '659f1c7e2b8f4a001b2c3d4e',
                    type: 'hero',
                    isVisible: true,
                    order: 0,
                    config: {
                        slides: [
                            {
                                id: 'slide-1',
                                badge: 'Coming Soon May',
                                title: 'New Lenovo',
                                subtitle: 'Laptop Intel',
                                highlight: 'Core I9 13900K',
                                ctaText: 'Shop Now',
                                ctaLink: '/category/laptop',
                                productImage: 'https://i.ibb.co/mqPKhHX/image-removebg-preview-2.webp',
                                bgGradient: 'from-orange-50 to-orange-100/50'
                            },
                            {
                                id: 'slide-2',
                                badge: 'Latest Product',
                                title: 'Macbook Pro',
                                subtitle: 'Macbook Pro 14"',
                                highlight: 'Apple M2 Pro Chip',
                                ctaText: 'Shop Now',
                                ctaLink: '/category/laptop',
                                productImage: 'https://i.ibb.co/Dprx1Fh/image-removebg-preview-4.webp',
                                bgGradient: 'from-gray-50 to-gray-100'
                            },
                            {
                                id: 'slide-3',
                                badge: 'Coming Soon May',
                                title: 'Ultra Reborn',
                                subtitle: 'Samsung S23 Ultra',
                                highlight: '200MP Wow-worthy resolution',
                                ctaText: 'Shop Now',
                                ctaLink: '/category/smartphone',
                                productImage: 'https://i.ibb.co/vj1jcZ1/image-removebg-preview-5.webp',
                                bgGradient: 'from-purple-50 to-gray-50'
                            }
                        ],
                        promoCards: [
                            {
                                id: 'promo-1',
                                subtitle: 'IN BANGLADESH',
                                title: 'Gaming Experience Center',
                                image: '/assets/banners/gaming_center.png',
                                link: '/locations',
                                bgColor: 'bg-gray-800'
                            },
                            {
                                id: 'promo-2',
                                subtitle: 'AVAILABLE NOW!',
                                title: 'Latest Accessories',
                                image: '/assets/banners/accessories.png',
                                link: '/category/accessories',
                                bgColor: 'bg-gray-800'
                            },
                            {
                                id: 'promo-3',
                                subtitle: 'Keep your eyes open',
                                title: 'LAUNCHING SOON!',
                                image: '/assets/banners/launching.png',
                                link: '/products',
                                bgColor: 'bg-gray-800'
                            }
                        ]
                    }
                },
                {
                    id: '659f1c7e2b8f4a001b2c3d4f',
                    type: 'brandMarquee',
                    isVisible: true,
                    order: 1,
                    config: {
                        displayType: 'icons',
                        speed: 100,
                        pauseOnHover: true,
                        selectedBrands: ['apple', 'samsung', 'xiaomi', 'asus', 'razer', 'intel', 'amd', 'nvidia', 'dell', 'logitech', 'corsair'],
                        customImages: []
                    }
                },
                {
                    id: '659f1c7e2b8f4a001b2c3d50',
                    type: 'categories',
                    isVisible: true,
                    order: 2,
                    config: {
                        title: 'Popular Categories',
                        selectedCategories: [],
                        displayStyle: 'grid',
                        itemsPerRow: 4
                    }
                },
                {
                    id: '659f1c7e2b8f4a001b2c3d51',
                    type: 'aiRecommendations',
                    isVisible: true,
                    order: 3,
                    config: {
                        title: 'Selected For You',
                        limit: 4
                    }
                },
                {
                    id: '659f1c7e2b8f4a001b2c3d52',
                    type: 'products',
                    isVisible: true,
                    order: 4,
                    config: {
                        title: 'Best deal Alert! 🛒',
                        sourceType: 'bestseller',
                        limit: 10,
                        viewAllLink: '/products?filter=bestseller'
                    }
                },
                {
                    id: '659f1c7e2b8f4a001b2c3d53',
                    type: 'products',
                    isVisible: true,
                    order: 5,
                    config: {
                        title: 'Best Selling ⌨️',
                        sourceType: 'featured',
                        limit: 10,
                        viewAllLink: '/products?filter=featured'
                    }
                },
                {
                    id: '659f1c7e2b8f4a001b2c3d54',
                    type: 'serviceBar',
                    isVisible: true,
                    order: 6,
                    config: {}
                }
            ]
        };
    }
    
    return null;
}

module.exports = {
    getPageConfig,
    getPublishedPageConfig,
    updatePageConfig,
    publishPageConfig,
    resetPageConfig
};
