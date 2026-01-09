const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

/**
 * @route   GET /api/settings
 * @desc    Get all store settings
 * @access  Public
 */
router.get('/', settingsController.getSettings);

/**
 * @route   GET /api/settings/:section
 * @desc    Get settings by section (layout, store, social, ecommerce, seo, maintenance, notifications)
 * @access  Public
 */
router.get('/:section', settingsController.getSettingsBySection);

/**
 * @route   PUT /api/settings
 * @desc    Update all settings
 * @access  Admin only
 */
router.put('/', protect, restrictTo('admin'), settingsController.updateSettings);

/**
 * @route   PUT /api/settings/:section
 * @desc    Update specific section of settings
 * @access  Admin only
 */
router.put('/:section', protect, restrictTo('admin'), settingsController.updateSettings);

/**
 * @route   DELETE /api/settings
 * @desc    Reset settings to defaults
 * @access  Admin only
 */
router.delete('/', protect, restrictTo('admin'), settingsController.resetSettings);

module.exports = router;
