const express = require('express');
const router = express.Router();
const Feedback = require('../models/Feedback');
const { protect, admin } = require('../middleware/authMiddleware');
const User = require('../models/User'); // For fetching admin avatar

// @desc    Admin reply to feedback
// @route   POST /api/admin/feedback/:id/reply
// @access  Private (Admin only)
router.post('/feedback/:id/reply', protect, admin, async (req, res) => {
    const { reply } = req.body;

    if (!reply || reply.trim() === '') {
        return res.status(400).json({ message: 'Reply text cannot be empty.' });
    }

    try {
        const feedback = await Feedback.findById(req.params.id);

        if (!feedback) {
            return res.status(404).json({ message: 'Feedback not found' });
        }

        // Get admin's actual avatar from DB (or use static one from env for consistency)
        const adminUser = await User.findById(req.user._id);
        const adminAvatar = adminUser ? adminUser.avatar : 'https://res.cloudinary.com/dyv7xav3e/image/upload/v1716942973/admin_avatar.png'; // Fallback

        feedback.adminReply = {
            text: reply.trim(),
            adminId: req.user._id,
            adminAvatar: adminAvatar,
            createdAt: new Date()
        };

        await feedback.save();

        // Populate user for the response
        const populatedFeedback = await Feedback.findById(feedback._id).populate('user', 'name avatar');


        res.status(200).json({
            message: 'Admin reply added successfully',
            feedback: populatedFeedback
        });
    } catch (error) {
        console.error('Error adding admin reply:', error);
        res.status(500).json({ message: 'Server error adding admin reply' });
    }
});

// @desc    Get all feedbacks (for admin panel view)
// @route   GET /api/admin/feedbacks
// @access  Private (Admin only)
router.get('/feedbacks', protect, admin, async (req, res) => {
    try {
        const feedbacks = await Feedback.find({})
            .populate('user', 'name avatar') // Populate user info
            .sort({ createdAt: -1 }); // Newest first

        res.status(200).json({ feedbacks });
    } catch (error) {
        console.error('Error fetching feedbacks for admin:', error);
        res.status(500).json({ message: 'Server error fetching feedbacks for admin' });
    }
});

// @desc    Delete any feedback (admin override)
// @route   DELETE /api/admin/feedback/:id
// @access  Private (Admin only)
router.delete('/feedback/:id', protect, admin, async (req, res) => {
    try {
        const feedback = await Feedback.findById(req.params.id);

        if (!feedback) {
            return res.status(404).json({ message: 'Feedback not found' });
        }

        await Feedback.deleteOne({ _id: req.params.id });
        res.status(200).json({ message: 'Feedback removed by admin' });
    } catch (error) {
        console.error('Error deleting feedback by admin:', error);
        res.status(500).json({ message: 'Server error during feedback deletion by admin' });
    }
});

module.exports = router;
