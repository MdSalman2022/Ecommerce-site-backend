const express = require('express');
const router = express.Router();
const {
    uploadSingleImage,
    uploadImages,
    removeSingleImage,
} = require('../controllers/uploadController');

// Increase payload limit for base64 images
router.use(express.json({ limit: '10mb' }));

// Upload routes
router.post('/', uploadSingleImage);
router.post('/multiple', uploadImages);
router.delete('/:publicId', removeSingleImage);

module.exports = router;
