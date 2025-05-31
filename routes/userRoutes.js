const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');
const asyncHandler = require('express-async-handler');
const cloudinary = require('cloudinary').v2; // For deleting old image if any
const generateToken = require('../utils/generateToken'); // For generating new token after profile update

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
router.get('/profile', protect, asyncHandler(async (req, res) => {
    // req.user is set by the protect middleware
    res.json({
        _id: req.user._id,
        username: req.user.username,
        email: req.user.email,
        profilePicture: req.user.profilePicture,
        isAdmin: req.user.isAdmin
    });
}));

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
router.put('/profile', protect, asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);

    if (user) {
        user.username = req.body.username || user.username;
        user.email = req.body.email || user.email;

        const updatedUser = await user.save();

        res.json({
            _id: updatedUser._id,
            username: updatedUser.username,
            email: updatedUser.email,
            profilePicture: updatedUser.profilePicture,
            isAdmin: updatedUser.isAdmin,
            token: generateToken(updatedUser._id) // Generate new token if profile fields affect it
        });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
}));

// @desc    Update user profile picture
// @route   PUT /api/users/profile-picture
// @access  Private
router.put('/profile-picture', protect, asyncHandler(async (req, res) => {
    if (!req.files || Object.keys(req.files).length === 0) {
        res.status(400);
        throw new Error('No files were uploaded.');
    }

    const file = req.files.profilePicture; // Assuming the field name is 'profilePicture'

    // Validate file type
    if (!file.mimetype.startsWith('image')) {
        res.status(400);
        throw new Error('Please upload an image file.');
    }

    const user = await User.findById(req.user._id);

    if (user) {
        // Upload new image to Cloudinary
        const result = await cloudinary.uploader.upload(file.tempFilePath, {
            folder: 'nobi_avatars', // Optional: specific folder in Cloudinary
            // For unsigned uploads: upload_preset: process.env.CLOUDINARY_UPLOAD_PRESET_AVATAR
            // If using `nobita_avatar_unsigned` from frontend, remove this server-side upload.
        });

        // Delete old profile picture from Cloudinary if it's not the default one
        if (user.profilePicture && user.profilePicture !== 'https://res.cloudinary.com/dyv7xav3e/image/upload/v1717171717/default-avatar.png') {
            const publicId = user.profilePicture.split('/').pop().split('.')[0];
            await cloudinary.uploader.destroy(`nobi_avatars/${publicId}`); // Assuming folder structure
        }

        user.profilePicture = result.secure_url;
        const updatedUser = await user.save();

        res.json({
            _id: updatedUser._id,
            username: updatedUser.username,
            email: updatedUser.email,
            profilePicture: updatedUser.profilePicture,
            isAdmin: updatedUser.isAdmin,
            token: generateToken(updatedUser._id) // Generate new token
        });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
}));


// @desc    Change user password
// @route   PUT /api/users/change-password
// @access  Private
router.put('/change-password', protect, asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select('+password'); // Select password explicitly

    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    // Check if user has a password set (not signed up with Google)
    if (!user.password) {
        res.status(400);
        throw new Error('Password cannot be changed. User signed up via Google.');
    }

    // Check current password
    if (!(await user.matchPassword(currentPassword))) {
        res.status(401);
        throw new Error('Current password is incorrect');
    }

    // Update password (pre-save hook in User model will hash it)
    user.password = newPassword;
    await user.save();

    res.status(200).json({ message: 'Password changed successfully' });
}));

module.exports = router;