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
} = require('../controllers/promoController');

// Public routes
router.get('/active', getActivePromoCodes);
router.post('/validate', validatePromoCode);
router.post('/apply', applyPromoCode);

// Admin routes
router.get('/', getAllPromoCodes);
router.post('/', createPromoCode);
router.put('/:id', updatePromoCode);
router.delete('/:id', deletePromoCode);
router.patch('/:id/toggle', togglePromoCode);

module.exports = router;
