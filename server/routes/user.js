const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');
const cloudinary = require('../utils/cloudinary');
const multer = require('multer'); // For handling file uploads

// Set up Multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

// @desc    Get user profile
// @route   GET /api/user/profile
// @access  Private
router.get('/profile', protect, async (req, res) => {
    try {
        // req.user is populated by the protect middleware
        const user = await User.findById(req.user._id).select('-password');
        if (user) {
            res.json({ user });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ message: 'Server error fetching user profile' });
    }
});

// @desc    Update user profile
// @route   PUT /api/user/profile
// @access  Private
router.put('/profile', protect, upload.single('avatar'), async (req, res) => {
    const { name } = req.body;
    let avatarUrl = req.user.avatar; // Keep current avatar if not updated

    try {
        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.name = name || user.name;

        if (req.file) {
            // Upload new avatar to Cloudinary
            const result = await cloudinary.uploader.upload(
                `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`,
                { folder: 'nobita-feedback-avatars', transformation: [{ width: 150, height: 150, crop: "fill", gravity: "face" }] }
            );
            avatarUrl = result.secure_url;
            user.avatar = avatarUrl;
        }

        await user.save();

        res.json({
            message: 'Profile updated successfully',
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                avatar: user.avatar,
                isAdmin: user.isAdmin,
                createdAt: user.createdAt
            }
        });
    } catch (error) {
        console.error('Error updating user profile:', error);
        if (error.message.includes('Only image files are allowed')) {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Server error during profile update' });
    }
});

module.exports = router;
