const express = require('express');
const router = express.Router();
const {
    getPageConfig,
    getPublishedPageConfig,
    updatePageConfig,
    publishPageConfig,
    resetPageConfig
} = require('../controllers/pageBuilderController');

/**
 * Page Builder Routes
 * Base path: /api/page-builder
 */

// Public routes
router.get('/:pageName/published', getPublishedPageConfig);

// Admin routes (add auth middleware as needed)
router.get('/:pageName', getPageConfig);
router.put('/:pageName', updatePageConfig);
router.post('/:pageName/publish', publishPageConfig);
router.post('/:pageName/reset', resetPageConfig);

module.exports = router;
