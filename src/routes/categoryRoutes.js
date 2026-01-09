const express = require('express');
const router = express.Router();
const {
    getAllCategories,
    getCategoryById,
    createCategory,
    updateCategory,
    deleteCategory,
} = require('../controllers/categoryController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.route('/')
    .get(getAllCategories)
    .post(protect, restrictTo('admin'), createCategory);

router.route('/:id')
    .get(getCategoryById)
    .put(protect, restrictTo('admin'), updateCategory)
    .delete(protect, restrictTo('admin'), deleteCategory);

module.exports = router;
