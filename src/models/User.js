const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// User Schema: Extended with Passport.js, OAuth, and RBAC support
const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            trim: true,
            required: [true, 'Name is required'],
        },
        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            trim: true,
            lowercase: true,
            match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
        },
        // Password - only for local auth, excluded from queries by default
        password: {
            type: String,
            minlength: [6, 'Password must be at least 6 characters'],
            select: false, // Don't include in queries by default
        },
        // OAuth provider info
        authProvider: {
            type: String,
            enum: ['local', 'google', 'facebook'],
            default: 'local',
        },
        providerId: {
            type: String, // Google/Facebook user ID
        },
        // Profile
        avatar: {
            type: String,
            default: '',
        },
        // User status & roles
        isVerified: {
            type: Boolean,
            default: false,
        },
        role: {
            type: String,
            enum: ['user', 'moderator', 'admin'],
            default: 'user',
        },
        // Session management
        refreshToken: {
            type: String,
            select: false,
        },
        lastLogin: {
            type: Date,
        },
        // Delivery information
        orderName: {
            type: String,
            trim: true,
        },
        address: {
            type: String,
            trim: true,
        },
        city: {
            type: String,
            trim: true,
        },
        contact: {
            type: String,
            trim: true,
        },
        // Card information (legacy - consider encrypting)
        cardnumber: {
            type: String,
            trim: true,
        },
    },
    {
        timestamps: true,
        collection: 'userCollection',
    }
);

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ authProvider: 1, providerId: 1 });

// Pre-save middleware - Hash password
userSchema.pre('save', async function (next) {
    // Only hash if password is modified
    if (!this.isModified('password')) return next();
    
    // Skip hashing for OAuth users
    if (this.authProvider !== 'local') return next();
    
    try {
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Instance Methods

// Compare password with hashed password
userSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

// Generate JWT access token
userSchema.methods.generateAuthToken = function () {
    return jwt.sign(
        { 
            id: this._id,
            email: this.email,
            role: this.role 
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
};

// Generate refresh token
userSchema.methods.generateRefreshToken = function () {
    const refreshToken = jwt.sign(
        { id: this._id },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
    );
    this.refreshToken = refreshToken;
    return refreshToken;
};

// Get public profile (exclude sensitive data)
userSchema.methods.toPublicJSON = function () {
    return {
        _id: this._id,
        name: this.name,
        email: this.email,
        avatar: this.avatar,
        role: this.role,
        authProvider: this.authProvider,
        isVerified: this.isVerified,
        createdAt: this.createdAt,
    };
};

const User = mongoose.model('User', userSchema);

module.exports = User;

