const express = require('express');
const router = express.Router();
const {
    getAllPromoCodes,
    getActivePromoCodes,
    validatePromoCode,
    applyPromoCode,
    createPromoCode,
    updatePromoCode,
    deletePromoCode,
    togglePromoCode,
    getPromoUsageHistory,
    getPromoSuggestions,
} = require('../controllers/promoController');

// Public routes
router.get('/active', getActivePromoCodes);
router.post('/validate', validatePromoCode);
router.post('/apply', applyPromoCode);
router.get('/suggestions', getPromoSuggestions);

// Admin routes
router.get('/', getAllPromoCodes);
router.post('/', createPromoCode);
router.put('/:id', updatePromoCode);
router.delete('/:id', deletePromoCode);
router.patch('/:id/toggle', togglePromoCode);
router.get('/:id/usage', getPromoUsageHistory);

module.exports = router;
