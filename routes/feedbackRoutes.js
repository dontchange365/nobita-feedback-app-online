const express = require('express');
const router = express.Router();
const Feedback = require('../models/Feedback');
const { protect } = require('../middleware/authMiddleware');
const asyncHandler = require('express-async-handler');
const cloudinary = require('cloudinary').v2; // For uploading media

// @desc    Create new feedback
// @route   POST /api/feedback
// @access  Private
router.post('/', protect, asyncHandler(async (req, res) => {
    const { rating, comment } = req.body;
    let mediaUrls = [];

    // Basic validation
    if (!rating || !comment) {
        res.status(400);
        throw new Error('Please add a rating and comment');
    }

    // Handle media upload if files are present
    if (req.files && Object.keys(req.files).length > 0) {
        // req.files.media is an array if multiple files are uploaded, or an object if single
        const files = Array.isArray(req.files.media) ? req.files.media : [req.files.media];

        for (const file of files) {
            if (!file.mimetype.startsWith('image') && !file.mimetype.startsWith('video')) {
                res.status(400);
                throw new Error('Only image and video files are allowed for media uploads.');
            }
            const result = await cloudinary.uploader.upload(file.tempFilePath, {
                folder: 'nobi_feedback_media', // Optional: specific folder
                resource_type: "auto" // Auto-detect resource type (image/video)
            });
            mediaUrls.push(result.secure_url);
        }
    }

    const feedback = new Feedback({
        user: req.user._id,
        name: req.user.username, // Use username from logged-in user
        rating,
        comment,
        media: mediaUrls
    });

    const createdFeedback = await feedback.save();
    res.status(201).json(createdFeedback);
}));

// @desc    Get all feedbacks
// @route   GET /api/feedback
// @access  Public
router.get('/', asyncHandler(async (req, res) => {
    const feedbacks = await Feedback.find({}).populate('user', 'username profilePicture'); // Populate user data
    res.json(feedbacks);
}));

// @desc    Update a feedback
// @route   PUT /api/feedback/:id
// @access  Private (only owner can update)
router.put('/:id', protect, asyncHandler(async (req, res) => {
    const { rating, comment } = req.body;
    const feedback = await Feedback.findById(req.params.id);

    if (feedback) {
        // Check if the logged-in user is the owner of the feedback
        if (feedback.user.toString() !== req.user._id.toString()) {
            res.status(401);
            throw new Error('Not authorized to update this feedback');
        }

        feedback.rating = rating || feedback.rating;
        feedback.comment = comment || feedback.comment;

        // If media is being updated, it needs a separate handling
        // For simplicity, this update route doesn't handle media changes.
        // A full implementation would require checking for new files and deleting old ones.
        // For now, assume media is added/removed via separate functions or only when creating feedback.

        const updatedFeedback = await feedback.save();
        res.json(updatedFeedback);
    } else {
        res.status(404);
        throw new Error('Feedback not found');
    }
}));

// @desc    Delete a feedback
// @route   DELETE /api/feedback/:id
// @access  Private (only owner or admin can delete)
router.delete('/:id', protect, asyncHandler(async (req, res) => {
    const feedback = await Feedback.findById(req.params.id);

    if (feedback) {
        // Check if logged-in user is owner OR admin
        if (feedback.user.toString() === req.user._id.toString() || req.user.isAdmin) {
            // Delete associated media from Cloudinary (optional but good practice)
            for (const url of feedback.media) {
                try {
                    const publicId = url.split('/').pop().split('.')[0];
                    // Example: delete `nobi_feedback_media/image_name` if folder was used
                    const folder = 'nobi_feedback_media/';
                    await cloudinary.uploader.destroy(folder + publicId);
                } catch (cloudinaryError) {
                    console.error(`Error deleting Cloudinary image ${url}:`, cloudinaryError.message);
                    // Continue, don't block deletion if image delete fails
                }
            }

            await feedback.deleteOne(); // Use deleteOne()
            res.json({ message: 'Feedback removed' });
        } else {
            res.status(401);
            throw new Error('Not authorized to delete this feedback');
        }
    } else {
        res.status(404);
        throw new Error('Feedback not found');
    }
}));

module.exports = router;