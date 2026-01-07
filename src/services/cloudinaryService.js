const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload image to Cloudinary
 * @param {string} base64Image - Base64 encoded image string
 * @param {string} folder - Folder name in Cloudinary
 * @returns {Promise<object>} - Cloudinary upload result
 */
const uploadImage = async (base64Image, folder = 'bestdeal/products') => {
    try {
        const result = await cloudinary.uploader.upload(base64Image, {
            folder,
            resource_type: 'image',
            transformation: [
                { width: 800, height: 800, crop: 'limit' },
                { quality: 'auto:good' },
                { fetch_format: 'auto' },
            ],
        });
        return {
            success: true,
            url: result.secure_url,
            publicId: result.public_id,
            width: result.width,
            height: result.height,
        };
    } catch (error) {
        console.error('Cloudinary upload error:', error);
        return {
            success: false,
            error: error.message,
        };
    }
};

/**
 * Upload multiple images to Cloudinary
 * @param {string[]} base64Images - Array of base64 encoded images
 * @param {string} folder - Folder name in Cloudinary
 * @returns {Promise<object[]>} - Array of upload results
 */
const uploadMultipleImages = async (base64Images, folder = 'bestdeal/products') => {
    const uploadPromises = base64Images.map((img) => uploadImage(img, folder));
    return Promise.all(uploadPromises);
};

/**
 * Delete image from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @returns {Promise<object>} - Delete result
 */
const deleteImage = async (publicId) => {
    try {
        const result = await cloudinary.uploader.destroy(publicId);
        return { success: result.result === 'ok' };
    } catch (error) {
        console.error('Cloudinary delete error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Generate optimized thumbnail URL
 * @param {string} url - Original Cloudinary URL
 * @param {number} width - Thumbnail width
 * @returns {string} - Optimized thumbnail URL
 */
const getThumbnailUrl = (url, width = 300) => {
    if (!url || !url.includes('cloudinary')) return url;
    return url.replace('/upload/', `/upload/w_${width},c_scale,q_auto,f_auto/`);
};

module.exports = {
    cloudinary,
    uploadImage,
    uploadMultipleImages,
    deleteImage,
    getThumbnailUrl,
};
