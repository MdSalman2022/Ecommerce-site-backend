const express = require('express');
const router = express.Router();
const {
    getWishlist,
    addToWishlist,
    removeFromWishlist,
    checkWishlist,
    getWishlistCount,
} = require('../controllers/wishlistController');

// Wishlist routes
router.get('/:email', getWishlist);
router.get('/count/:email', getWishlistCount);
router.get('/check/:email/:productId', checkWishlist);
router.post('/', addToWishlist);
router.delete('/:email/:productId', removeFromWishlist);

module.exports = router;
