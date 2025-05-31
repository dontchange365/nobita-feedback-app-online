const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Feedback = require('../models/Feedback');
const { protect } = require('../middleware/authMiddleware');
const { admin } = require('../middleware/adminMiddleware'); // Admin middleware
const asyncHandler = require('express-async-handler');
const bcrypt = require('bcryptjs'); // For initial admin creation
const cloudinary = require('cloudinary').v2; // For deleting user images/feedback media

// @desc    Create initial admin user (RUN ONCE, THEN REMOVE OR SECURE)
// @route   POST /api/admin/create-initial-admin
// @access  Public (should be restricted in production)
router.post('/create-initial-admin', asyncHandler(async (req, res) => {
    // THIS ROUTE SHOULD ONLY BE RUN ONCE FOR INITIAL ADMIN SETUP
    // In production, remove this route or add stronger checks.
    // For local testing, it's fine.

    const adminExists = await User.findOne({ isAdmin: true });
    if (adminExists) {
        res.status(400);
        throw new Error('Admin user already exists. Cannot create another initial admin.');
    }

    const { ADMIN_USERNAME, ADMIN_PASSWORD, EMAIL_USER } = process.env;

    if (!ADMIN_USERNAME || !ADMIN_PASSWORD || !EMAIL_USER) {
        res.status(500);
        throw new Error('Admin credentials or email not set in environment variables.');
    }

    const user = await User.create({
        username: ADMIN_USERNAME,
        email: EMAIL_USER, // Using owner's email for admin
        password: ADMIN_PASSWORD, // Pre-save hook will hash it
        isAdmin: true,
        isVerified: true // Admin is always verified
    });

    if (user) {
        res.status(201).json({
            message: `Initial admin user '${user.username}' created successfully.`,
            _id: user._id,
            username: user.username,
            email: user.email,
            isAdmin: user.isAdmin
        });
    } else {
        res.status(400);
        throw new Error('Invalid admin data');
    }
}));

// @desc    Admin login
// @route   POST /api/admin/login
// @access  Public (same as regular login but checks isAdmin)
router.post('/login', asyncHandler(async (req, res) => {
    const { username, password } = req.body;

    const user = await User.findOne({ username }).select('+password');

    if (user && user.isAdmin && (await user.matchPassword(password))) {
        res.json({
            _id: user._id,
            username: user.username,
            email: user.email,
            isAdmin: user.isAdmin,
            token: process.env.JWT_SECRET // Or generate a specific admin token
        });
    } else {
        res.status(401);
        throw new Error('Invalid admin credentials');
    }
}));


// @desc    Get all users (Admin only)
// @route   GET /api/admin/users
// @access  Private/Admin
router.get('/users', protect, admin, asyncHandler(async (req, res) => {
    const users = await User.find({}).select('-password'); // Don't send passwords
    res.json(users);
}));

// @desc    Delete a user (Admin only)
// @route   DELETE /api/admin/users/:id
// @access  Private/Admin
router.delete('/users/:id', protect, admin, asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);

    if (user) {
        // Prevent admin from deleting themselves
        if (user._id.toString() === req.user._id.toString()) {
            res.status(400);
            throw new Error('Admin cannot delete their own account via this panel');
        }

        // Delete user's profile picture from Cloudinary (if not default)
        if (user.profilePicture && user.profilePicture !== 'https://res.cloudinary.com/dyv7xav3e/image/upload/v1717171717/default-avatar.png') {
            try {
                const publicId = user.profilePicture.split('/').pop().split('.')[0];
                await cloudinary.uploader.destroy(`nobi_avatars/${publicId}`); // Assuming folder structure
            } catch (error) {
                console.error(`Error deleting user profile picture ${user.profilePicture}:`, error.message);
            }
        }

        // Also delete all feedback submitted by this user
        const userFeedbacks = await Feedback.find({ user: user._id });
        for (const feedback of userFeedbacks) {
            for (const url of feedback.media) {
                try {
                    const publicId = url.split('/').pop().split('.')[0];
                    await cloudinary.uploader.destroy(`nobi_feedback_media/${publicId}`, { resource_type: "auto" });
                } catch (cloudinaryError) {
                    console.error(`Error deleting Cloudinary media for feedback ${feedback._id}:`, cloudinaryError.message);
                }
            }
        }
        await Feedback.deleteMany({ user: user._id });

        await user.deleteOne();
        res.json({ message: 'User and their associated data removed' });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
}));

// @desc    Get all feedbacks (Admin only)
// @route   GET /api/admin/feedbacks
// @access  Private/Admin
router.get('/feedbacks', protect, admin, asyncHandler(async (req, res) => {
    const feedbacks = await Feedback.find({}).populate('user', 'username email');
    res.json(feedbacks);
}));

// @desc    Delete a feedback (Admin only)
// @route   DELETE /api/admin/feedbacks/:id
// @access  Private/Admin
router.delete('/feedbacks/:id', protect, admin, asyncHandler(async (req, res) => {
    const feedback = await Feedback.findById(req.params.id);

    if (feedback) {
        // Delete associated media from Cloudinary
        for (const url of feedback.media) {
            try {
                const publicId = url.split('/').pop().split('.')[0];
                await cloudinary.uploader.destroy(`nobi_feedback_media/${publicId}`, { resource_type: "auto" });
            } catch (cloudinaryError) {
                console.error(`Error deleting Cloudinary media ${url}:`, cloudinaryError.message);
            }
        }
        await feedback.deleteOne();
        res.json({ message: 'Feedback removed' });
    } else {
        res.status(404);
        throw new Error('Feedback not found');
    }
}));

module.exports = router;