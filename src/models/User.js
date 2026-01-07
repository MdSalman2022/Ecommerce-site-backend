const mongoose = require('mongoose');

/**
 * User Schema
 * Represents users/customers in the e-commerce platform
 * Matches actual userCollection structure
 */
const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            trim: true,
        },
        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            trim: true,
            lowercase: true,
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
        // Card information
        cardnumber: {
            type: String,
            trim: true,
        },
        // Date stored as string to match existing format
        date: {
            type: String,
        },
    },
    {
        timestamps: true,
        collection: 'userCollection',
    }
);

// Index for email lookups
userSchema.index({ email: 1 });

const User = mongoose.model('User', userSchema);

module.exports = User;
