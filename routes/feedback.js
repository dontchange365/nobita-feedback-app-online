// routes/feedback.js

const express = require('express');
const router = express.Router();
const { Feedback, User } = require('../config/database');
const { authenticateToken, isEmailVerified } = require('../middleware/auth');
const { getLeastUsedAvatarUrl, getAndIncrementAvatarUsage } = require('../utils/avatarGenerator');
const { sendPushNotificationToAdmin } = require('../services/pushNotification');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

router.get('/api/feedbacks', async (req, res) => {
    try {
        const { page = 1, limit = 10, sort = 'desc', filter, q } = req.query;

        const query = {};
        if (filter === 'pinned') query.isPinned = true;
        if (filter === 'replied') query['replies.0'] = { $exists: true };
        if (filter === 'unreplied') query['replies.0'] = { $exists: false };
        if (q) {
            const regex = new RegExp(q, 'i');
            query.$or = [{
                name: {
                    $regex: regex
                }
            }, {
                feedback: {
                    $regex: regex
                }
            }];
        }

        let sortOptions = {
            timestamp: sort === 'desc' ? -1 : 1
        };
        if (filter === 'all' || !filter) {
            sortOptions = {
                isPinned: -1,
                timestamp: -1
            };
        }

        const options = {
            page: parseInt(page, 10),
            limit: parseInt(limit, 10),
            sort: sortOptions,
            populate: {
                path: 'userId',
                select: 'loginMethod isVerified email name avatarUrl createdAt hasCustomAvatar'
            }
        };

        const feedbacks = await Feedback.paginate(query, options);

        const totalFeedbacks = await Feedback.countDocuments({});
        const averageRating = await Feedback.aggregate([
            { $group: { _id: null, avgRating: { $avg: '$rating' } } }
        ]);
        const totalPinned = await Feedback.countDocuments({ isPinned: true });
        const totalReplies = await Feedback.aggregate([
            { $unwind: '$replies' },
            { $count: 'totalReplies' }
        ]);

        const responseData = {
            feedbacks: feedbacks.docs,
            totalFeedbacks: totalFeedbacks,
            averageRating: averageRating[0] ? averageRating[0].avgRating.toFixed(1) : '0.0',
            totalPinned: totalPinned,
            totalReplies: totalReplies.length > 0 ? totalReplies[0].totalReplies : 0,
            currentPage: feedbacks.page,
            totalPages: feedbacks.totalPages,
            hasMore: feedbacks.hasNextPage
        };

        res.status(200).json(responseData);
    } catch (error) { console.error("Error fetching feedbacks:", error); res.status(500).json({ message: 'Failed to fetch feedbacks.', error: error.message }); }
});

router.post('/api/feedback', async (req, res) => {
    const { name: guestNameFromBody, guestId: guestIdFromBody, feedback, rating } = req.body;
    const userIp = req.clientIp;
    if (!feedback || !rating || rating === '0') return res.status(400).json({ message: 'Feedback and rating are required.' });
    let feedbackData = { feedback, rating: parseInt(rating), userIp, isEdited: false, readByAdmin: false, };
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    let isGuest = !token;

    try {
        if (isGuest) {
            if (!guestNameFromBody) return res.status(400).json({ message: 'Name is required for guest feedback.' });

            let guestAvatarUrl;
            if (guestIdFromBody) {
                const existingFeedback = await Feedback.findOne({ guestId: guestIdFromBody }).sort({ timestamp: -1 });
                if (existingFeedback) {
                    guestAvatarUrl = existingFeedback.avatarUrl;
                } else {
                    guestAvatarUrl = await getLeastUsedAvatarUrl();
                }
                feedbackData.guestId = guestIdFromBody;
            } else {
                guestAvatarUrl = await getLeastUsedAvatarUrl();
                feedbackData.guestId = 'guest_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            }

            feedbackData.name = guestNameFromBody;
            feedbackData.avatarUrl = guestAvatarUrl;
            feedbackData.userId = null;
            await getAndIncrementAvatarUsage(guestAvatarUrl);

        } else { // Logged-in user
            let decodedUserPayload;
            try { decodedUserPayload = jwt.verify(token, JWT_SECRET); } catch (jwtError) { return res.status(403).json({ message: "Your session is invalid or has expired." }); }
            const loggedInUser = await User.findById(decodedUserPayload.userId);
            if (!loggedInUser) { return res.status(404).json({ message: "Authenticated user not found." }); }

            feedbackData.name = loggedInUser.name;
            feedbackData.avatarUrl = loggedInUser.avatarUrl;
            feedbackData.userId = loggedInUser._id;
            if (loggedInUser.loginMethod === 'google' && loggedInUser.googleId) { feedbackData.googleIdSubmitter = loggedInUser.googleId; }
            feedbackData.guestId = null;
        }

        const newFeedback = new Feedback(feedbackData);
        await newFeedback.save();

        req.io.emit('new-feedback', newFeedback);

        sendPushNotificationToAdmin(newFeedback);
        res.status(201).json({ message: 'Your feedback has been successfully submitted!', feedback: newFeedback });
    } catch (error) { console.error("Feedback save error:", error); if (error.name === 'ValidationError') return res.status(400).json({ message: `Validation Error: ${error.message}` }); res.status(500).json({ message: 'Failed to save feedback.', error: error.message }); }
});

router.put('/api/feedback/:id', authenticateToken, isEmailVerified, async (req, res) => {
    const feedbackId = req.params.id;
    const { feedback, rating } = req.body;
    const loggedInJwtUser = req.user;
    if (!feedback || !rating || rating === '0') return res.status(400).json({ message: 'Feedback and rating are required for update!' });
    try {
        const existingFeedback = await Feedback.findById(feedbackId);
        if (!existingFeedback) return res.status(404).json({ message: 'This feedback ID was not found.' });
        if (!existingFeedback.userId || existingFeedback.userId.toString() !== loggedInJwtUser.userId) { return res.status(403).json({ message: 'You can only edit your own feedbacks.' }); }
        const currentUserFromDb = await User.findById(loggedInJwtUser.userId);
        if (!currentUserFromDb) return res.status(404).json({ message: 'User attempting to edit feedback not found.' });
        const contentActuallyChanged = existingFeedback.feedback !== feedback || existingFeedback.rating !== parseInt(rating);
        if (contentActuallyChanged) {
            if (!existingFeedback.originalContent) { existingFeedback.originalContent = { name: existingFeedback.name, feedback: existingFeedback.feedback, rating: existingFeedback.rating, timestamp: existingFeedback.timestamp }; }
            existingFeedback.name = currentUserFromDb.name; existingFeedback.feedback = feedback; existingFeedback.rating = parseInt(rating); existingFeedback.timestamp = Date.now(); existingFeedback.isEdited = true; existingFeedback.avatarUrl = currentUserFromDb.avatarUrl;
        }
        await existingFeedback.save();
        res.status(200).json({ message: 'Your feedback has been updated!', feedback: existingFeedback });
    } catch (error) { console.error(`Feedback update error (ID: ${feedbackId}):`, error); res.status(500).json({ message: 'Failed to update profile.', error: error.message }); }
});

// --- UPDATED ROUTE FOR VOTING (Upvote Only) START ---
router.post('/api/feedback/:id/vote', async (req, res) => {
    const feedbackId = req.params.id;
    // voteType must be 'upvote'
    const { voteType, guestId: guestIdFromBody } = req.body; 
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    const { ObjectId } = require('mongoose').Types; 

    if (voteType !== 'upvote') {
        return res.status(400).json({ message: 'Invalid vote type. Only "upvote" is supported.' });
    }

    try {
        const feedback = await Feedback.findById(feedbackId);
        if (!feedback) {
            return res.status(404).json({ message: 'Feedback not found.' });
        }

        let isUser = !!token;
        let identifier; // Registered user ID (ObjectId) or Guest ID (string)
        
        // 1. Determine voter ID
        if (isUser) {
            try { 
                const decodedUserPayload = jwt.verify(token, JWT_SECRET); 
                identifier = new ObjectId(decodedUserPayload.userId); 
            } catch (jwtError) { 
                isUser = false; // Invalid token, treat as guest
            }
        }
        
        if (!isUser) {
            // Guest User (Guest ID is persistent local storage value)
            identifier = guestIdFromBody; 
            if (!identifier) {
                return res.status(400).json({ message: 'Authentication required or provide a unique guest identifier.' });
            }
        }

        let updateQuery = {};
        let actionMessage = '';

        if (isUser) {
            // Logged-in User Logic: Check if ID is already in upvotes array
            const isUpvoted = feedback.upvotes.map(id => id.toString()).includes(identifier.toString());

            if (isUpvoted) { // Remove Upvote
                updateQuery = { $pull: { upvotes: identifier }, $inc: { upvoteCount: -1 } };
                actionMessage = 'Upvote removed.';
            } else { // Add Upvote
                updateQuery = { $addToSet: { upvotes: identifier }, $inc: { upvoteCount: 1 } };
                actionMessage = 'Upvoted successfully.';
            }
        } else {
            // Guest Logic: Check if ID is already in upvoteGuests array
            const isUpvoted = feedback.upvoteGuests.includes(identifier);

            if (isUpvoted) { // Remove Upvote
                updateQuery = { $pull: { upvoteGuests: identifier }, $inc: { upvoteCount: -1 } };
                actionMessage = 'Upvote removed.';
            } else { // Add Upvote
                updateQuery = { $addToSet: { upvoteGuests: identifier }, $inc: { upvoteCount: 1 } };
                actionMessage = 'Upvoted successfully.';
            }
        }
        
        if (Object.keys(updateQuery).length === 0) {
            return res.status(200).json({ 
                message: actionMessage || 'No change in vote status.',
                feedback: { 
                    _id: feedback._id,
                    upvoteCount: feedback.upvoteCount,
                }
            });
        }

        // Database Update
        const updatedFeedback = await Feedback.findByIdAndUpdate(
            feedbackId, 
            updateQuery, 
            { new: true, runValidators: true }
        );

        // Real-time Update
        if (req.io) {
            req.io.emit('feedback-vote-update', {
                feedbackId: updatedFeedback._id,
                upvoteCount: updatedFeedback.upvoteCount,
            });
        }

        res.status(200).json({ 
            message: actionMessage, 
            feedback: { 
                _id: updatedFeedback._id,
                upvoteCount: updatedFeedback.upvoteCount,
            }
        });

    } catch (error) { 
        console.error(`Feedback vote error (ID: ${feedbackId}):`, error); 
        res.status(500).json({ message: 'Failed to process vote.', error: error.message }); 
    }
});
// --- UPDATED ROUTE FOR VOTING (Upvote Only) END ---


module.exports = router;