const Category = require('../models/Category');
const asyncHandler = require('../utils/asyncHandler');
const { ApiError } = require('../utils/ApiResponse');

// Helper to create nested categories
const createCategories = (categories, parentId = null) => {
    const categoryList = [];
    let category;

    if (parentId == null) {
        category = categories.filter((cat) => cat.parent == undefined);
    } else {
        category = categories.filter((cat) => String(cat.parent) == String(parentId));
    }

    for (let cate of category) {
        categoryList.push({
            _id: cate._id,
            name: cate.name,
            slug: cate.slug,
            parentId: cate.parent,
            image: cate.image,
            icon: cate.icon,
            description: cate.description,
            showInHeader: cate.showInHeader,
            showInSidebar: cate.showInSidebar,
            order: cate.order,
            isActive: cate.isActive,
            children: createCategories(categories, cate._id),
        });
    }

    return categoryList;
};

/**
 * @desc    Get all categories
 * @route   GET /api/categories
 * @access  Public
 */
const getAllCategories = asyncHandler(async (req, res) => {
    const categories = await Category.find({}).sort({ order: 1 });
    
    if (req.query.nested === 'true') {
        const categoryList = createCategories(categories);
        return res.json({ success: true, count: categoryList.length, data: categoryList });
    }

    res.json({ success: true, count: categories.length, data: categories });
});

/**
 * @desc    Get single category
 * @route   GET /api/categories/:id
 * @access  Public
 */
const getCategoryById = asyncHandler(async (req, res) => {
    const category = await Category.findById(req.params.id);

    if (!category) {
        throw new ApiError(404, 'Category not found');
    }

    res.json({ success: true, data: category });
});

/**
 * @desc    Create new category
 * @route   POST /api/categories
 * @access  Private/Admin
 */
const createCategory = asyncHandler(async (req, res) => {
    const { name, parent, image, icon, description, showInHeader, showInSidebar, order } = req.body;

    const categoryExists = await Category.findOne({ name });
    if (categoryExists) {
        throw new ApiError(400, 'Category already exists');
    }

    const category = await Category.create({
        name,
        parent: parent || null, // Ensure parent is null if empty string or undefined
        image,
        icon,
        description,
        showInHeader: showInHeader !== undefined ? showInHeader : true,
        showInSidebar: showInSidebar !== undefined ? showInSidebar : true,
        order: order || 0,
    });

    res.status(201).json({ success: true, data: category });
});

/**
 * @desc    Update category
 * @route   PUT /api/categories/:id
 * @access  Private/Admin
 */
const updateCategory = asyncHandler(async (req, res) => {
    const category = await Category.findById(req.params.id);

    if (!category) {
        throw new ApiError(404, 'Category not found');
    }

    const updatedCategory = await Category.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
    );

    res.json({ success: true, data: updatedCategory });
});

/**
 * @desc    Delete category
 * @route   DELETE /api/categories/:id
 * @access  Private/Admin
 */
const deleteCategory = asyncHandler(async (req, res) => {
    const category = await Category.findById(req.params.id);

    if (!category) {
        throw new ApiError(404, 'Category not found');
    }

    // Optional: Prevent deleting categories with children or products?
    // For now, allow delete.
    
    await Category.deleteOne({ _id: req.params.id });

    res.json({ success: true, message: 'Category removed' });
});

module.exports = {
    getAllCategories,
    getCategoryById,
    createCategory,
    updateCategory,
    deleteCategory,
};
