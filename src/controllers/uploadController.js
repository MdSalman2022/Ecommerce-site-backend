const { uploadImage, uploadMultipleImages, deleteImage } = require('../services/cloudinaryService');
const asyncHandler = require('../utils/asyncHandler');

/**
 * @desc    Upload single image to Cloudinary
 * @route   POST /api/upload
 * @access  Private
 */
const uploadSingleImage = asyncHandler(async (req, res) => {
    const { image, folder } = req.body;

    if (!image) {
        return res.status(400).json({ success: false, error: 'Image data is required' });
    }

    const result = await uploadImage(image, folder || 'bestdeal/products');

    if (result.success) {
        res.json(result);
    } else {
        res.status(500).json(result);
    }
});

/**
 * @desc    Upload multiple images to Cloudinary
 * @route   POST /api/upload/multiple
 * @access  Private
 */
const uploadImages = asyncHandler(async (req, res) => {
    const { images, folder } = req.body;

    if (!images || !Array.isArray(images) || images.length === 0) {
        return res.status(400).json({ success: false, error: 'Images array is required' });
    }

    if (images.length > 5) {
        return res.status(400).json({ success: false, error: 'Maximum 5 images allowed' });
    }

    const results = await uploadMultipleImages(images, folder || 'bestdeal/products');
    const successfulUploads = results.filter(r => r.success);

    res.json({
        success: true,
        uploaded: successfulUploads.length,
        total: images.length,
        urls: successfulUploads.map(r => r.url),
        results,
    });
});

/**
 * @desc    Delete image from Cloudinary
 * @route   DELETE /api/upload/:publicId
 * @access  Private
 */
const removeSingleImage = asyncHandler(async (req, res) => {
    const { publicId } = req.params;

    if (!publicId) {
        return res.status(400).json({ success: false, error: 'Public ID is required' });
    }

    const result = await deleteImage(publicId);
    res.json(result);
});

module.exports = {
    uploadSingleImage,
    uploadImages,
    removeSingleImage,
};
