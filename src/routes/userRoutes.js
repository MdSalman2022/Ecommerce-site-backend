const express = require('express');
const router = express.Router();
const {
    getAllUsers,
    getUserByEmail,
    createUser,
    updateCardInfo,
    updateDeliveryInfo,
} = require('../controllers/userController');

/**
 * User Routes
 * Base path: /api/users
 */

// GET routes
router.get('/', getAllUsers);
router.get('/:email', getUserByEmail);

// POST routes
router.post('/', createUser);

// PUT routes
router.put('/card', updateCardInfo);
router.put('/delivery', updateDeliveryInfo);

module.exports = router;
