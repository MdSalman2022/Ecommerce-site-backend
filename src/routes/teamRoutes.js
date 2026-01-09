const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { adminOnly, staffOnly } = require('../middleware/rbacMiddleware');
const {
    inviteMember,
    getInvitation,
    acceptInvitation,
    cancelInvitation,
    resendInvitation,
    getTeamMembers,
    getPendingInvitations,
    updateMemberRole,
    removeMember,
    getPermissions,
} = require('../controllers/teamController');

// Public routes
router.get('/invite/:token', getInvitation); // Get invitation details by token

// Authenticated routes
router.use(protect);

// Accept invitation (any authenticated user with matching email)
router.post('/accept/:token', acceptInvitation);

// Staff routes (admin + moderator)
router.get('/members', staffOnly, getTeamMembers);
router.get('/permissions', staffOnly, getPermissions);

// Admin only routes
router.post('/invite', adminOnly, inviteMember);
router.post('/invite/:id/resend', adminOnly, resendInvitation);
router.delete('/invite/:id', adminOnly, cancelInvitation);
router.get('/invitations', adminOnly, getPendingInvitations);
router.put('/members/:id', adminOnly, updateMemberRole);
router.delete('/members/:id', adminOnly, removeMember);

module.exports = router;
