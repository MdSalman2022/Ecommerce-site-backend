const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const User = require('../models/User');

/**
 * Passport Configuration
 * Sets up authentication strategies for local, Google, and Facebook auth
 */

// ============================================
// Local Strategy (Email/Password)
// ============================================
passport.use(
    new LocalStrategy(
        {
            usernameField: 'email',
            passwordField: 'password',
        },
        async (email, password, done) => {
            try {
                // Find user and include password field
                const user = await User.findOne({ email }).select('+password');

                if (!user) {
                    return done(null, false, { message: 'Invalid email or password' });
                }

                // Check if user registered with OAuth
                if (user.authProvider !== 'local') {
                    return done(null, false, { 
                        message: `Please sign in with ${user.authProvider}` 
                    });
                }

                // Verify password
                const isMatch = await user.comparePassword(password);
                if (!isMatch) {
                    return done(null, false, { message: 'Invalid email or password' });
                }

                return done(null, user);
            } catch (error) {
                return done(error);
            }
        }
    )
);

// ============================================
// Google OAuth Strategy
// ============================================
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
        new GoogleStrategy(
            {
                clientID: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback',
                scope: ['profile', 'email'],
            },
            async (accessToken, refreshToken, profile, done) => {
                try {
                    // Check if user already exists
                    let user = await User.findOne({
                        $or: [
                            { providerId: profile.id, authProvider: 'google' },
                            { email: profile.emails?.[0]?.value }
                        ]
                    });

                    if (user) {
                        // Update provider info if user exists
                        if (user.authProvider !== 'google') {
                            user.authProvider = 'google';
                            user.providerId = profile.id;
                        }
                        user.avatar = profile.photos?.[0]?.value || user.avatar;
                        user.lastLogin = new Date();
                        await user.save();
                    } else {
                        // Create new user
                        user = await User.create({
                            name: profile.displayName,
                            email: profile.emails?.[0]?.value,
                            avatar: profile.photos?.[0]?.value,
                            authProvider: 'google',
                            providerId: profile.id,
                            isVerified: true, // Google emails are verified
                        });
                    }

                    return done(null, user);
                } catch (error) {
                    return done(error);
                }
            }
        )
    );
}

// ============================================
// Facebook OAuth Strategy
// ============================================
if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
    passport.use(
        new FacebookStrategy(
            {
                clientID: process.env.FACEBOOK_APP_ID,
                clientSecret: process.env.FACEBOOK_APP_SECRET,
                callbackURL: process.env.FACEBOOK_CALLBACK_URL || '/api/auth/facebook/callback',
                profileFields: ['id', 'displayName', 'photos', 'email'],
            },
            async (accessToken, refreshToken, profile, done) => {
                try {
                    const email = profile.emails?.[0]?.value;
                    
                    // Check if user already exists
                    let user = await User.findOne({
                        $or: [
                            { providerId: profile.id, authProvider: 'facebook' },
                            ...(email ? [{ email }] : [])
                        ]
                    });

                    if (user) {
                        // Update provider info if user exists
                        if (user.authProvider !== 'facebook') {
                            user.authProvider = 'facebook';
                            user.providerId = profile.id;
                        }
                        user.avatar = profile.photos?.[0]?.value || user.avatar;
                        user.lastLogin = new Date();
                        await user.save();
                    } else {
                        // Create new user
                        user = await User.create({
                            name: profile.displayName,
                            email: email || `${profile.id}@facebook.placeholder`,
                            avatar: profile.photos?.[0]?.value,
                            authProvider: 'facebook',
                            providerId: profile.id,
                            isVerified: !!email, // Only verified if email is available
                        });
                    }

                    return done(null, user);
                } catch (error) {
                    return done(error);
                }
            }
        )
    );
}

// ============================================
// Serialization (for session-based auth if needed)
// ============================================
passport.serializeUser((user, done) => {
    done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (error) {
        done(error);
    }
});

module.exports = passport;
