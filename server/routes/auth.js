const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');
// You'd integrate Passport.js for Google OAuth here
// const passport = require('passport'); // If using Passport
// require('../config/passport-google'); // Your Google strategy config

const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD; // Use a hashed password in production for admin

// Helper function to generate JWT
const generateToken = (id) => {
    return jwt.sign({ id }, JWT_SECRET, { expiresIn: '1h' });
};

// @desc    Register or Login User (Email/Password)
// @route   POST /api/auth/login
// @access  Public
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    // Admin Login Special Case
    if (email === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        // In a real app, hash ADMIN_PASSWORD and compare
        // For now, direct comparison as per request
        const adminUser = {
            _id: 'admin_id_placeholder', // A static ID for admin
            name: 'Admin',
            email: ADMIN_USERNAME,
            avatar: 'https://res.cloudinary.com/dyv7xav3e/image/upload/v1716942973/admin_avatar.png', // A dedicated admin avatar
            isAdmin: true
        };
        res.status(200).json({
            message: 'Admin login successful',
            token: generateToken(adminUser._id),
            user: adminUser
        });
        return;
    }

    try {
        let user = await User.findOne({ email });

        if (user && user.password && (await user.matchPassword(password))) {
            res.status(200).json({
                message: 'Login successful',
                token: generateToken(user._id),
                user: {
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    avatar: user.avatar,
                    isAdmin: user.isAdmin
                }
            });
        } else if (user && !user.password) {
            res.status(400).json({ message: 'This email is registered via Google. Please log in with Google.' });
        }
        else {
            // If user not found, register new user
            const newUser = new User({ email, password, name: email.split('@')[0] }); // Default name
            await newUser.save();
            res.status(201).json({
                message: 'User registered and logged in successfully',
                token: generateToken(newUser._id),
                user: {
                    _id: newUser._id,
                    name: newUser.name,
                    email: newUser.email,
                    avatar: newUser.avatar,
                    isAdmin: newUser.isAdmin
                }
            });
        }
    } catch (error) {
        console.error('Login/Registration error:', error);
        res.status(500).json({ message: 'Server error during login/registration' });
    }
});

// @desc    Google OAuth Login
// @route   GET /api/auth/google
// @access  Public
// This would typically use Passport.js. For a simpler demo, you could manually redirect.
router.get('/google', (req, res) => {
    // This route would initiate the Google OAuth flow.
    // In a real app with Passport.js, it would look like:
    // passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);

    // For a direct demo, we'll redirect to a simplified Google login URL that would eventually
    // redirect back to your `/api/auth/google/callback` with parameters.
    // This is NOT how real OAuth works, but illustrates the front-end triggering it.
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent('https://nobita-feedback-app-online.onrender.com/api/auth/google/callback')}&response_type=code&scope=profile email`;
    res.redirect(googleAuthUrl);
});


module.exports = router;
