const express = require('express');
const router = express.Router();
const Feedback = require('../models/Feedback');
const User = require('../models/User'); // Required for user data population
const { protect } = require('../middleware/authMiddleware');

// @desc    Submit new feedback
// @route   POST /api/feedback
// @access  Private
router.post('/', protect, async (req, res) => {
    const { rating, comment } = req.body;

    if (!rating || !comment) {
        return res.status(400).json({ message: 'Rating and comment are required.' });
    }

    try {
        const feedback = new Feedback({
            user: req.user._id, // User ID from authenticated request
            rating,
            comment
        });

        await feedback.save();

        // Populate user data for the response to send back to frontend
        const populatedFeedback = await Feedback.findById(feedback._id).populate('user', 'name avatar');

        res.status(201).json({
            message: 'Feedback submitted successfully',
            feedback: populatedFeedback
        });
    } catch (error) {
        console.error('Error submitting feedback:', error);
        res.status(500).json({ message: 'Server error during feedback submission' });
    }
});

// @desc    Get all feedbacks with user info and calculate overall rating
// @route   GET /api/feedback
// @access  Public
router.get('/', async (req, res) => {
    try {
        const feedbacks = await Feedback.find({})
            .populate('user', 'name avatar') // Populate user name and avatar
            .sort({ createdAt: -1 }); // Sort by newest first

        let totalRating = 0;
        feedbacks.forEach(f => totalRating += f.rating);
        const overallRating = feedbacks.length > 0 ? totalRating / feedbacks.length : 0;
        const totalFeedbacks = feedbacks.length;

        res.status(200).json({
            feedbacks,
            overallRating,
            totalFeedbacks
        });
    } catch (error) {
        console.error('Error fetching feedbacks:', error);
        res.status(500).json({ message: 'Server error fetching feedbacks' });
    }
});

// @desc    Delete feedback
// @route   DELETE /api/feedback/:id
// @access  Private (Owner or Admin)
router.delete('/:id', protect, async (req, res) => {
    try {
        const feedback = await Feedback.findById(req.params.id);

        if (!feedback) {
            return res.status(404).json({ message: 'Feedback not found' });
        }

        // Check if user is owner or admin
        if (feedback.user.toString() !== req.user._id.toString() && !req.user.isAdmin) {
            return res.status(403).json({ message: 'Not authorized to delete this feedback' });
        }

        await Feedback.deleteOne({ _id: req.params.id });
        res.status(200).json({ message: 'Feedback removed' });
    } catch (error) {
        console.error('Error deleting feedback:', error);
        res.status(500).json({ message: 'Server error during feedback deletion' });
    }
});

module.exports = router;
