const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs'); // Needed for comparing current password
const jwt = require('jsonwebtoken'); // Needed for generating new tokens for password change
const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const sendEmail = require('../utils/sendEmail');
const { protect } = require('../middleware/authMiddleware');
const asyncHandler = require('express-async-handler'); // Simple wrapper for async functions

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
router.post('/register', asyncHandler(async (req, res) => {
    const { username, email, password } = req.body;

    // Basic validation
    if (!username || !email || !password) {
        res.status(400);
        throw new Error('Please enter all fields');
    }

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
        res.status(400);
        throw new Error('User already exists');
    }

    const user = await User.create({ username, email, password });

    if (user) {
        // Send verification email (placeholder - full implementation needs email template and token generation)
        const verificationToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

        await sendEmail({
            to: user.email,
            subject: 'Verify your Nobi Bot Account',
            text: `Please verify your email by clicking on this link: ${verificationLink}`,
            html: `<p>Please verify your email by clicking on this link: <a href="${verificationLink}">Verify Email</a></p>`
        });

        res.status(201).json({
            message: 'User registered successfully. Please check your email for verification.'
        });
    } else {
        res.status(400);
        throw new Error('Invalid user data');
    }
}));

// @desc    Verify user email
// @route   GET /api/auth/verify-email
// @access  Public
router.get('/verify-email', asyncHandler(async (req, res) => {
    const { token } = req.query;

    if (!token) {
        res.status(400);
        throw new Error('Verification token is missing');
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);

        if (!user) {
            res.status(404);
            throw new Error('User not found or invalid token');
        }

        user.isVerified = true;
        await user.save();

        res.status(200).json({ message: 'Email verified successfully!' });
    } catch (error) {
        res.status(400);
        throw new Error('Invalid or expired verification token');
    }
}));


// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
router.post('/login', asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password'); // Select password explicitly

    if (user && (await user.matchPassword(password))) {
        if (!user.isVerified) {
            res.status(401);
            throw new Error('Email not verified. Please check your inbox.');
        }

        res.json({
            _id: user._id,
            username: user.username,
            email: user.email,
            profilePicture: user.profilePicture,
            isAdmin: user.isAdmin,
            token: generateToken(user._id),
        });
    } else {
        res.status(401);
        throw new Error('Invalid email or password');
    }
}));

// @desc    Login/Register user with Google
// @route   POST /api/auth/google-login
// @access  Public
router.post('/google-login', asyncHandler(async (req, res) => {
    const { googleId, email, username, profilePicture } = req.body;

    // In a real app, you'd verify the googleId token with Google's API
    // For simplicity here, we assume googleId is verified by frontend

    let user = await User.findOne({ email });

    if (user) {
        // User exists, update Google ID if missing and return token
        if (!user.googleId) {
            user.googleId = googleId;
            await user.save();
        }
        res.json({
            _id: user._id,
            username: user.username,
            email: user.email,
            profilePicture: user.profilePicture,
            isAdmin: user.isAdmin,
            token: generateToken(user._id),
        });
    } else {
        // New user, create account
        user = await User.create({
            username: username || email.split('@')[0], // Fallback username
            email,
            googleId,
            profilePicture: profilePicture || 'https://res.cloudinary.com/dyv7xav3e/image/upload/v1717171717/default-avatar.png',
            isVerified: true // Google users are considered verified
        });

        if (user) {
            res.status(201).json({
                _id: user._id,
                username: user.username,
                email: user.email,
                profilePicture: user.profilePicture,
                isAdmin: user.isAdmin,
                token: generateToken(user._id),
            });
        } else {
            res.status(400);
            throw new Error('Invalid Google user data');
        }
    }
}));


// @desc    Request password reset
// @route   POST /api/auth/forgot-password
// @access  Public
router.post('/forgot-password', asyncHandler(async (req, res) => {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
        res.status(404);
        throw new Error('User with that email does not exist.');
    }

    // Generate a reset token (JWT for simplicity, or a crypto-generated token)
    const resetToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '15m' });

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpire = Date.now() + 15 * 60 * 1000; // 15 minutes
    await user.save();

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    await sendEmail({
        to: user.email,
        subject: 'Password Reset Request',
        text: `You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\nPlease click on the following link, or paste this into your browser to complete the process:\n\n${resetUrl}\n\nIf you did not request this, please ignore this email and your password will remain unchanged.`,
        html: `<p>You are receiving this because you (or someone else) have requested the reset of the password for your account.</p><p>Please click on the following link, or paste this into your browser to complete the process:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you did not request this, please ignore this email and your password will remain unchanged.</p>`
    });

    res.status(200).json({ message: 'Password reset email sent!' });
}));

// @desc    Reset password
// @route   PUT /api/auth/reset-password
// @access  Public
router.put('/reset-password', asyncHandler(async (req, res) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
        res.status(400);
        throw new Error('Token and new password are required');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || user.resetPasswordToken !== token || user.resetPasswordExpire < Date.now()) {
        res.status(400);
        throw new Error('Invalid or expired reset token');
    }

    // Update password (pre-save hook will hash it)
    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.status(200).json({ message: 'Password has been reset successfully.' });
}));


module.exports = router;