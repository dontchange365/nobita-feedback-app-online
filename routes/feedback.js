// routes/feedback.js

const express = require('express');
const router = express.Router();
const { Feedback, User } = require('../config/database');
const { authenticateToken, isEmailVerified } = require('../middleware/auth');
const { getLeastUsedAvatarUrl, getAndIncrementAvatarUsage } = require('../utils/avatarGenerator');
const { sendPushNotificationToAdmin } = require('../services/pushNotification');
const { sendEmail, NOBITA_EMAIL_TEMPLATE } = require('../services/emailService'); // NEW: Import Email Service
const jwt = require('jsonwebtoken');

// --- Centralized Error Handling Import ---
const asyncHandler = require('express-async-handler');

// --- XSS Sanitization Imports ---
const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);
// --- XSS Sanitization Imports End ---

// --- AI CONFIG: GET ADMIN NAME ONLY (LOGIC MOVED TO SCHEDULER) ---
const { ADMIN_NAME } = require('../scheduler/ai_responder'); 
// --- AI CONFIG: END ---

const JWT_SECRET = process.env.JWT_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://nobita-app.com'; // Fallback URL

// --- Get Rate Limiter from app.locals ---
const feedbackLimiter = router.stack.filter(layer => layer.name === 'feedbackLimiter')[0]?.handle || ((req, res, next) => next()); 
// --- Get Rate Limiter from app.locals ---

// --- Helper function for Milestone Check (NEW LOGIC) ---
function shouldSendMilestoneEmail(currentCount, lastEmailedCount) {
    // Milestones: 5, 10, 20, 50, 99 (99+ ke liye)
    const milestones = [5, 10, 20, 50, 99]; 

    // Find the next target milestone jo pichle emailed count se bada ho
    const nextMilestone = milestones.find(m => m > lastEmailedCount);

    if (nextMilestone === undefined) {
        // 99+ milestone tak pahunch chuke hain. Ab email nahi bhejna hai.
        return { shouldSend: false, newEmailedCount: lastEmailedCount };
    }

    if (currentCount >= nextMilestone) {
        // Milestone hit ho gaya!
        const newEmailedCount = nextMilestone;
        
        return { shouldSend: true, newEmailedCount: newEmailedCount };
    }

    // Next milestone tak nahi pahunche ya count kam ho gaya.
    return { shouldSend: false, newEmailedCount: lastEmailedCount };
}
// --- Helper function for Milestone Check End ---

// 1. GET Feedbacks (using asyncHandler)
router.get('/api/feedbacks', asyncHandler(async (req, res) => {
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
}));

// 2. POST Feedback (IMMEDIATE AI LOGIC REMOVED)
router.post('/api/feedback', feedbackLimiter, asyncHandler(async (req, res) => {
    const { name: guestNameFromBody, guestId: guestIdFromBody, feedback, rating } = req.body;
    
    // --- SANITIZE USER INPUTS ---
    const sanitizedFeedback = DOMPurify.sanitize(feedback);
    const sanitizedGuestName = DOMPurify.sanitize(guestNameFromBody);
    // --- SANITIZE USER INPUTS ---

    const userIp = req.clientIp;
    if (!sanitizedFeedback || !rating || rating === '0') return res.status(400).json({ message: 'Feedback and rating are required.' });
    
    // Use sanitized feedback in data object
    let feedbackData = { feedback: sanitizedFeedback, rating: parseInt(rating), userIp, isEdited: false, readByAdmin: false, };
    
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    let isGuest = !token;

    let finalUserName = ''; // Variable to store the final display name

    if (isGuest) {
        if (!sanitizedGuestName) return res.status(400).json({ message: 'Name is required for guest feedback.' });

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

        finalUserName = sanitizedGuestName;
        feedbackData.name = sanitizedGuestName;
        feedbackData.avatarUrl = guestAvatarUrl;
        feedbackData.userId = null;
        await getAndIncrementAvatarUsage(guestAvatarUrl);

    } else { // Logged-in user
        let decodedUserPayload;
        try { decodedUserPayload = jwt.verify(token, JWT_SECRET); } catch (jwtError) { return res.status(403).json({ message: "Your session is invalid or has expired." }); }
        const loggedInUser = await User.findById(decodedUserPayload.userId);
        if (!loggedInUser) { return res.status(404).json({ message: "Authenticated user not found." }); }

        finalUserName = loggedInUser.name;
        feedbackData.name = loggedInUser.name;
        feedbackData.avatarUrl = loggedInUser.avatarUrl;
        feedbackData.userId = loggedInUser._id;
        if (loggedInUser.loginMethod === 'google' && loggedInUser.googleId) { feedbackData.googleIdSubmitter = loggedInUser.googleId; }
        feedbackData.guestId = null;
    }

    // 1. Submit the new feedback 
    const newFeedback = new Feedback(feedbackData);
    await newFeedback.save();

    // 2. No AI reply here. It will be handled by the scheduler after 4 hours.

    // 3. Emit real-time update
    req.io.emit('new-feedback', newFeedback);

    // 4. Send Push Notification
    sendPushNotificationToAdmin(newFeedback);

    // === ADMIN EMAIL NOTIFICATION START ===
    if (process.env.ADMIN_EMAIL) {
        try {
            const adminEmail = process.env.ADMIN_EMAIL;
            // 'finalUserName' variable pehle se defined hai upar
            const feedbackUser = finalUserName || 'Anonymous'; 
            // 'sanitizedFeedback' variable pehle se defined hai upar
            const feedbackContent = sanitizedFeedback; 
            const adminPanelLink = `${FRONTEND_URL}/admin-panel/index.html`;

            const emailHtml = `
                <div style="font-family: Arial, sans-serif; font-size: 16px; line-height: 1.6; color: #333;">
                    <h2 style="color: #00ffdd; border-bottom: 2px solid #005566; padding-bottom: 10px;">🚀 New Feedback Received!</h2>
                    <p>A new feedback has been submitted on NOBI BOT.</p>
                    <p><strong>From:</strong> ${feedbackUser}</p>
                    <p><strong>Feedback Content:</strong></p>
                    <blockquote style="border-left: 4px solid #00ffdd; padding: 10px 15px; margin: 0 0 20px 0; background: #f4f4f4; color: #555;">
                        ${feedbackContent}
                    </blockquote>
                    <p><strong>Rating:</strong> ${newFeedback.rating} ⭐</p>
                    <a href="${adminPanelLink}" style="display: inline-block; background-color: #ff3399; color: #ffffff; padding: 12px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                        Go to Admin Panel
                    </a>
                    <p style="font-size: 12px; color: #888; margin-top: 25px;">
                       (IP Address: ${userIp})
                    </p>
                </div>
            `;

            await sendEmail({
                email: adminEmail,
                subject: `🔔 New Feedback (${newFeedback.rating}★) from ${feedbackUser}`,
                html: emailHtml
            });
            console.log(`Admin notification email sent to ${adminEmail}`);

        } catch (emailError) {
            // Agar admin ko email nahi gaya, tab bhi user ko error mat dikhao
            // Sirf console mein log kar do
            console.error('Failed to send admin notification email:', emailError.message);
        }
    }
    // === ADMIN EMAIL NOTIFICATION END ===

    // 5. Send response to user
    res.status(201).json({ message: 'Your feedback has been successfully submitted!', feedback: newFeedback });
}));

// 3. PUT Feedback (using asyncHandler)
router.put('/api/feedback/:id', authenticateToken, isEmailVerified, asyncHandler(async (req, res) => {
    const feedbackId = req.params.id;
    const { feedback, rating } = req.body;
    
    // --- SANITIZE USER INPUTS ---
    const sanitizedFeedback = DOMPurify.sanitize(feedback);
    // --- SANITIZE USER INPUTS ---
    
    const loggedInJwtUser = req.user;
    if (!sanitizedFeedback || !rating || rating === '0') return res.status(400).json({ message: 'Feedback and rating are required for update!' });
    
    const existingFeedback = await Feedback.findById(feedbackId);
    if (!existingFeedback) return res.status(404).json({ message: 'This feedback ID was not found.' });
    if (!existingFeedback.userId || existingFeedback.userId.toString() !== loggedInJwtUser.userId) { return res.status(403).json({ message: 'You can only edit your own feedbacks.' }); }
    
    const currentUserFromDb = await User.findById(loggedInJwtUser.userId);
    if (!currentUserFromDb) return res.status(404).json({ message: 'User attempting to edit feedback not found.' });
    
    // Use sanitized feedback for comparison
    const contentActuallyChanged = existingFeedback.feedback !== sanitizedFeedback || existingFeedback.rating !== parseInt(rating);
    
    if (contentActuallyChanged) {
        if (!existingFeedback.originalContent) { existingFeedback.originalContent = { name: existingFeedback.name, feedback: existingFeedback.feedback, rating: existingFeedback.rating, timestamp: existingFeedback.timestamp }; }
        
        // Use sanitized feedback here
        existingFeedback.name = currentUserFromDb.name; 
        existingFeedback.feedback = sanitizedFeedback; 
        existingFeedback.rating = parseInt(rating); 
        existingFeedback.timestamp = Date.now(); 
        existingFeedback.isEdited = true; 
        existingFeedback.avatarUrl = currentUserFromDb.avatarUrl;
    }
    await existingFeedback.save();
    res.status(200).json({ message: 'Your feedback has been updated!', feedback: existingFeedback });
}));

// 4. POST Vote (using asyncHandler)
router.post('/api/feedback/:id/vote', asyncHandler(async (req, res) => {
    const feedbackId = req.params.id;
    // voteType must be 'upvote'
    const { voteType, guestId: guestIdFromBody } = req.body; 
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    const { ObjectId } = require('mongoose').Types; 

    if (voteType !== 'upvote') {
        return res.status(400).json({ message: 'Invalid vote type. Only "upvote" is supported.' });
    }

    // Populate userId to check if the owner is logged in and for email details
    const feedback = await Feedback.findById(feedbackId).populate('userId', 'email name avatarUrl lastEmailUpvoteCount'); 
    if (!feedback) {
        return res.status(404).json({ message: 'Feedback not found.' });
    }

    let isUser = !!token;
    let identifier = null; // Registered user ID (ObjectId) or Guest ID (string)
    let voterUserId = null; // Stored voter ID if user is logged in
    
    // 1. Determine voter ID and user status
    if (isUser) {
        try { 
            const decodedUserPayload = jwt.verify(token, JWT_SECRET); 
            voterUserId = decodedUserPayload.userId;
            identifier = new ObjectId(voterUserId); 
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
    let voteStatusChanged = false;

    if (isUser) {
        // Logged-in User Logic: Check if ID is already in upvotes array
        const isUpvoted = feedback.upvotes.map(id => id.toString()).includes(identifier.toString());

        if (isUpvoted) { // Remove Like
            updateQuery = { $pull: { upvotes: identifier }, $inc: { upvoteCount: -1 } };
            actionMessage = 'Upvote removed.';
            voteStatusChanged = true;
        } else { // Add Like
            updateQuery = { $addToSet: { upvotes: identifier }, $inc: { upvoteCount: 1 } };
            actionMessage = 'Upvoted successfully.';
            voteStatusChanged = true;
        }
    } else {
        // Guest Logic: Check if ID is already in upvoteGuests array
        const isUpvoted = feedback.upvoteGuests.includes(identifier);

        if (isUpvoted) { // Remove Like
            updateQuery = { $pull: { upvoteGuests: identifier }, $inc: { upvoteCount: -1 } };
            actionMessage = 'Upvote removed.';
            voteStatusChanged = true;
        } else { // Add Like
            updateQuery = { $addToSet: { upvoteGuests: identifier }, $inc: { upvoteCount: 1 } };
            actionMessage = 'Upvoted successfully.';
            voteStatusChanged = true;
        }
    }
    
    if (!voteStatusChanged) {
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

    // 2. Email Notification Logic (UPDATED)
    // Removed !isOwnerVoting condition as per user's request: "Like chahe koi bhi kare email jana chahiye"
    if (voteStatusChanged && actionMessage === 'Upvoted successfully.' && feedback.userId && feedback.userId.email) {
        
        const currentCount = updatedFeedback.upvoteCount;
        // BUG FIX: lastEmailedCount ko original feedback object se retrieve karo
        const lastEmailedCount = feedback.lastEmailUpvoteCount || 0; 
        
        // Check if email should be sent based on milestone rules
        const { shouldSend, newEmailedCount } = shouldSendMilestoneEmail(currentCount, lastEmailedCount);

        if (shouldSend) {
            try {
                const owner = feedback.userId;
                // NEW: feedbackId ke saath link banao
                const mailLink = `${FRONTEND_URL}/index.html?feedbackId=${feedback._id}`; 
                const emailHtml = NOBITA_EMAIL_TEMPLATE(
                    (newEmailedCount === 99 ? '🔥 Century Milestone!' : `👍 New Like Milestone!`),
                    owner.name || 'User',
                    'View Your Feedback',
                    mailLink,
                    owner.avatarUrl || 'https://placehold.co/80x80/6a0dad/FFFFFF?text=U',
                    'feedback-liked',
                    { 
                        originalFeedback: feedback.feedback, 
                        newUpvoteCount: updatedFeedback.upvoteCount 
                    }
                );
                
                await sendEmail({
                    email: owner.email,
                    subject: `Milestone: ${updatedFeedback.upvoteCount} likes on your feedback!`,
                    html: emailHtml,
                    message: `Your feedback (${feedback.feedback.substring(0, 50)}...) received ${updatedFeedback.upvoteCount} likes.`
                });
                
                // --- IMPORTANT: Update the lastEmailedCount in the database ---
                await Feedback.findByIdAndUpdate(feedbackId, { lastEmailUpvoteCount: newEmailedCount });
                console.log(`Email sent to ${owner.email} for ${newEmailedCount} like milestone.`);
                // -----------------------------------------------------------------

            } catch (emailError) {
                console.error(`Failed to send milestone notification email:`, emailError.message);
            }
        }
    }

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
}));


module.exports = router;
