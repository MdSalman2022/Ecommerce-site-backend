const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { protect } = require('../middleware/authMiddleware');
const { adminOnly, staffOnly, authorize, PERMISSIONS } = require('../middleware/rbacMiddleware');

router.use(protect);

router.get('/stats', staffOnly, adminController.getDashboardStatistics);

router.get('/users', authorize(PERMISSIONS.VIEW_ALL_USERS), adminController.getAllUsersWithRoles);
router.get('/users/:userId', authorize(PERMISSIONS.VIEW_ALL_USERS), adminController.getUserById);

router.put('/users/:userId/role', adminOnly, adminController.updateUserRole);
router.delete('/users/:userId/role', adminOnly, adminController.removeUserRole);

router.post('/order/courier', adminOnly, adminController.sendToCourier);
router.post('/order/sync-courier', adminOnly, adminController.syncCourierStatus);

module.exports = router;
