const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * Invitation Schema
 * Tracks pending team invitations for admin/moderator roles
 */
const invitationSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: [true, 'Email is required'],
            trim: true,
            lowercase: true,
            match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
        },
        role: {
            type: String,
            enum: ['moderator', 'admin'],
            required: [true, 'Role is required'],
        },
        invitedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        token: {
            type: String,
            required: true,
            unique: true,
        },
        expiresAt: {
            type: Date,
            required: true,
            default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
        status: {
            type: String,
            enum: ['pending', 'accepted', 'expired', 'cancelled'],
            default: 'pending',
        },
        acceptedAt: Date,
        acceptedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
    },
    {
        timestamps: true,
        collection: 'invitations',
    }
);

// Indexes
invitationSchema.index({ email: 1, status: 1 });
// invitationSchema.index({ token: 1 }); // Removed duplicate
invitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

// Static method to generate a secure token
invitationSchema.statics.generateToken = function() {
    return crypto.randomBytes(32).toString('hex');
};

// Instance method to check if invitation is valid
invitationSchema.methods.isValid = function() {
    return this.status === 'pending' && this.expiresAt > new Date();
};

// Pre-save: Check for existing pending invitation to same email
invitationSchema.pre('save', async function(next) {
    if (this.isNew) {
        const existing = await this.constructor.findOne({
            email: this.email,
            status: 'pending',
            expiresAt: { $gt: new Date() },
        });
        
        if (existing) {
            const error = new Error('An active invitation already exists for this email');
            error.code = 'DUPLICATE_INVITATION';
            return next(error);
        }
    }
    next();
});

const Invitation = mongoose.model('Invitation', invitationSchema);

module.exports = Invitation;
