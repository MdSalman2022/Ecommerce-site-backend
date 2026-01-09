const User = require('../models/User');
const Invitation = require('../models/Invitation');
const emailService = require('../services/emailService');
const { ApiError, ApiResponse } = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { ROLES, PERMISSIONS } = require('../constants/permissions');

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

/**
 * Team Controller
 * Handles team member management and invitations
 */

// @desc    Send team invitation
// @route   POST /api/team/invite
// @access  Admin only
const inviteMember = asyncHandler(async (req, res) => {
    const { email, role } = req.body;
    
    if (!email || !role) {
        throw new ApiError(400, 'Email and role are required');
    }
    
    if (!['admin', 'moderator'].includes(role)) {
        throw new ApiError(400, 'Role must be admin or moderator');
    }
    
    // Check if user already exists with this role or higher
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        if (existingUser.role === role) {
            throw new ApiError(400, `User is already a ${role}`);
        }
        if (existingUser.role === 'admin' && role === 'moderator') {
            throw new ApiError(400, 'User is already an admin');
        }
    }
    
    // Generate token and create invitation
    const token = Invitation.generateToken();
    
    try {
        const invitation = await Invitation.create({
            email,
            role,
            invitedBy: req.user._id,
            token,
        });
        
        // Send invitation email
        const inviteLink = `${CLIENT_URL}/invite/${token}`;
        await emailService.sendTeamInvitation(
            email, 
            role, 
            inviteLink, 
            req.user.name
        );
        
        res.status(201).json(
            new ApiResponse(201, {
                invitation: {
                    _id: invitation._id,
                    email: invitation.email,
                    role: invitation.role,
                    expiresAt: invitation.expiresAt,
                    status: invitation.status,
                }
            }, 'Invitation sent successfully')
        );
    } catch (error) {
        if (error.code === 'DUPLICATE_INVITATION') {
            throw new ApiError(400, error.message);
        }
        throw error;
    }
});

// @desc    Get invitation details by token (public)
// @route   GET /api/team/invite/:token
// @access  Public
const getInvitation = asyncHandler(async (req, res) => {
    const { token } = req.params;
    
    const invitation = await Invitation.findOne({ token })
        .populate('invitedBy', 'name email');
    
    if (!invitation) {
        throw new ApiError(404, 'Invitation not found');
    }
    
    if (!invitation.isValid()) {
        throw new ApiError(400, 'Invitation has expired or is no longer valid');
    }
    
    res.json(
        new ApiResponse(200, {
            invitation: {
                email: invitation.email,
                role: invitation.role,
                invitedBy: invitation.invitedBy?.name || 'Admin',
                expiresAt: invitation.expiresAt,
            }
        })
    );
});

// @desc    Accept invitation
// @route   POST /api/team/accept/:token
// @access  Authenticated (must match invitation email)
const acceptInvitation = asyncHandler(async (req, res) => {
    const { token } = req.params;
    
    const invitation = await Invitation.findOne({ token });
    
    if (!invitation) {
        throw new ApiError(404, 'Invitation not found');
    }
    
    if (!invitation.isValid()) {
        throw new ApiError(400, 'Invitation has expired or is no longer valid');
    }
    
    // Verify the logged-in user's email matches
    if (req.user.email !== invitation.email) {
        throw new ApiError(403, 'This invitation was sent to a different email address');
    }
    
    // Update user role
    const user = await User.findByIdAndUpdate(
        req.user._id,
        { role: invitation.role },
        { new: true }
    );
    
    // Mark invitation as accepted
    invitation.status = 'accepted';
    invitation.acceptedAt = new Date();
    invitation.acceptedBy = req.user._id;
    await invitation.save();
    
    res.json(
        new ApiResponse(200, {
            user: user.toPublicJSON(),
            message: `You are now a ${invitation.role}!`
        }, 'Invitation accepted successfully')
    );
});

// @desc    Cancel/revoke invitation
// @route   DELETE /api/team/invite/:id
// @access  Admin only
const cancelInvitation = asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    const invitation = await Invitation.findById(id);
    
    if (!invitation) {
        throw new ApiError(404, 'Invitation not found');
    }
    
    if (invitation.status !== 'pending') {
        throw new ApiError(400, 'Can only cancel pending invitations');
    }
    
    invitation.status = 'cancelled';
    await invitation.save();
    
    res.json(new ApiResponse(200, null, 'Invitation cancelled'));
});

// @desc    Get all team members (admins and moderators)
// @route   GET /api/team/members
// @access  Staff (admin/moderator)
const getTeamMembers = asyncHandler(async (req, res) => {
    const members = await User.find({ 
        role: { $in: ['admin', 'moderator'] } 
    })
    .select('name email role avatar createdAt lastLogin')
    .sort({ role: 1, createdAt: -1 });
    
    res.json(new ApiResponse(200, { members }));
});

// @desc    Get pending invitations
// @route   GET /api/team/invitations
// @access  Admin only
const getPendingInvitations = asyncHandler(async (req, res) => {
    const invitations = await Invitation.find({ 
        status: 'pending',
        expiresAt: { $gt: new Date() }
    })
    .populate('invitedBy', 'name email')
    .sort({ createdAt: -1 });
    
    res.json(new ApiResponse(200, { invitations }));
});

// @desc    Update team member role
// @route   PUT /api/team/members/:id
// @access  Admin only
const updateMemberRole = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;
    
    if (!['admin', 'moderator', 'user'].includes(role)) {
        throw new ApiError(400, 'Invalid role');
    }
    
    const member = await User.findById(id);
    
    if (!member) {
        throw new ApiError(404, 'User not found');
    }
    
    // Prevent self-demotion for last admin
    if (member._id.toString() === req.user._id.toString() && role !== 'admin') {
        const adminCount = await User.countDocuments({ role: 'admin' });
        if (adminCount <= 1) {
            throw new ApiError(400, 'Cannot demote: You are the only admin');
        }
    }
    
    member.role = role;
    await member.save();
    
    res.json(
        new ApiResponse(200, { 
            member: member.toPublicJSON() 
        }, `Role updated to ${role}`)
    );
});

// @desc    Remove member from team (demote to user)
// @route   DELETE /api/team/members/:id
// @access  Admin only
const removeMember = asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    const member = await User.findById(id);
    
    if (!member) {
        throw new ApiError(404, 'User not found');
    }
    
    if (!['admin', 'moderator'].includes(member.role)) {
        throw new ApiError(400, 'User is not a team member');
    }
    
    // Prevent removing self if last admin
    if (member._id.toString() === req.user._id.toString()) {
        const adminCount = await User.countDocuments({ role: 'admin' });
        if (adminCount <= 1) {
            throw new ApiError(400, 'Cannot remove: You are the only admin');
        }
    }
    
    member.role = 'user';
    await member.save();
    
    res.json(new ApiResponse(200, null, 'Member removed from team'));
});

// @desc    Resend invitation email
// @route   POST /api/team/invite/:id/resend
// @access  Admin only
const resendInvitation = asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    const invitation = await Invitation.findById(id);
    
    if (!invitation) {
        throw new ApiError(404, 'Invitation not found');
    }
    
    if (invitation.status !== 'pending') {
        throw new ApiError(400, 'Can only resend pending invitations');
    }
    
    // Check if expired
    if (invitation.expiresAt < new Date()) {
        // Generate new token and extend expiry
        invitation.token = Invitation.generateToken();
        invitation.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        await invitation.save();
    }
    
    // Send invitation email
    const inviteLink = `${CLIENT_URL}/invite/${invitation.token}`;
    await emailService.sendTeamInvitation(
        invitation.email, 
        invitation.role, 
        inviteLink, 
        req.user.name
    );
    
    res.json(
        new ApiResponse(200, {
            invitation: {
                _id: invitation._id,
                email: invitation.email,
                role: invitation.role,
                expiresAt: invitation.expiresAt,
                status: invitation.status,
            }
        }, 'Invitation resent successfully')
    );
});

// @desc    Get permissions for all roles
// @route   GET /api/team/permissions
// @access  Staff (admin/moderator)
const getPermissions = asyncHandler(async (req, res) => {
    const permissions = {
        admin: {
            description: 'Full access to all features',
            permissions: Object.keys(PERMISSIONS).map(key => ({
                key,
                name: PERMISSIONS[key],
                granted: true,
            })),
        },
        moderator: {
            description: 'Manage products, orders, and moderate content',
            permissions: Object.keys(PERMISSIONS).map(key => ({
                key,
                name: PERMISSIONS[key],
                granted: ROLES.moderator.includes(PERMISSIONS[key]),
            })),
        },
    };
    
    res.json(new ApiResponse(200, { permissions }));
});

module.exports = {
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
};
