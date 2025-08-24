// routes/admin.js
const express = require('express');
const router = express.Router();
const { User, Feedback, Blog, AdminSettings } = require('../config/database');
const { authenticateAdminToken } = require('../middleware/auth');
const { createUserPayload } = require('../utils/helpers');
const { getDiceBearAvatarUrl } = require('../utils/avatarGenerator');
const { sendPushNotificationToUser } = require('../services/pushNotification');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_INITIAL_PASSWORD = process.env.ADMIN_INITIAL_PASSWORD;
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL;

router.post('/api/admin/login', async (req, res) => {
    const { username, password } = req.body;
    if (username !== ADMIN_USERNAME) return res.status(401).json({ message: "Invalid username or password." });
    try {
        let adminUser = await User.findOne({ username: ADMIN_USERNAME });
        if (!adminUser) {
            console.warn(`Admin user '${ADMIN_USERNAME}' not found in DB. Attempting to create it.`);
            if (!ADMIN_INITIAL_PASSWORD) { console.error("CRITICAL ERROR: ADMIN_INITIAL_PASSWORD env var is required to create the initial admin user."); return res.status(500).json({ message: "Server setup incomplete: Initial admin password not set." }); }
            const initialHashedPassword = await bcrypt.hash(ADMIN_INITIAL_PASSWORD, 12);
            adminUser = new User({ name: 'Admin User', username: ADMIN_USERNAME, email: `${ADMIN_USERNAME.toLowerCase().replace(/\s/g, '')}@admin.com`, password: initialHashedPassword, loginMethod: 'email', isVerified: true });
            await adminUser.save();
            console.log(`Admin user '${ADMIN_USERNAME}' created with default password.`);
        }
        const isMatch = await bcrypt.compare(password, adminUser.password);
        if (!isMatch) return res.status(401).json({ message: "Invalid username or password." });
        const adminPayload = { username: adminUser.username, userId: adminUser._id, loggedInAt: new Date().toISOString() };
        const adminToken = jwt.sign(adminPayload, ADMIN_JWT_SECRET, { expiresIn: '1h' });
        res.status(200).json({ message: "Admin login successful!", token: adminToken, admin: adminPayload });
    } catch (error) { console.error("Admin login error:", error); res.status(500).json({ message: "Server error during admin login.", error: error.message }); }
});

// Admin-specific Feedback Routes
router.delete('/api/admin/feedback/:id', authenticateAdminToken, async (req, res) => {
    try {
        const fb = await Feedback.findByIdAndDelete(req.params.id);
        if (!fb) return res.status(404).json({ message: 'ID not found.' });
        res.status(200).json({ message: 'Deleted.' });
    } catch (e) { console.error(`ADMIN DEL ERR: ${req.params.id}`, e); res.status(500).json({ message: 'Failed.', error: e.message }); }
});

router.delete('/api/admin/feedbacks/batch-delete', authenticateAdminToken, async (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: 'No IDs.' });
    try {
        const r = await Feedback.deleteMany({ _id: { $in: ids } });
        if (r.deletedCount === 0) return res.status(404).json({ message: 'None found.' });
        res.status(200).json({ message: `${r.deletedCount} deleted.`, deletedCount: r.deletedCount });
    } catch (e) { console.error(`ADMIN BATCH DEL ERR:`, e); res.status(500).json({ message: 'Failed.', error: e.message }); }
});

router.post('/api/admin/feedback/:id/reply', authenticateAdminToken, async (req, res) => {
    const fId = req.params.id;
    const { replyText, adminName } = req.body;
    if (!replyText) return res.status(400).json({ message: 'Reply text missing.' });
    try {
        const fb = await Feedback.findById(fId).populate('userId');
        if (!fb) return res.status(404).json({ message: 'ID not found.' });
        fb.replies.push({ text: replyText, adminName: adminName || 'Admin', timestamp: new Date() });
        await fb.save();
        if (fb.userId) {
            const user = await User.findById(fb.userId);
            if (user && user.pushSubscription) sendPushNotificationToUser(user.pushSubscription, fb);
        }
        res.status(200).json({ message: 'Replied.', reply: fb.replies[fb.replies.length - 1] });
    } catch (e) { console.error(`ADMIN REPLY ERR: ${fId}`, e); res.status(500).json({ message: 'Failed.', error: e.message }); }
});

router.delete('/api/admin/feedback/:feedbackId/reply/:replyId', authenticateAdminToken, async (req, res) => {
    try {
        const { feedbackId, replyId } = req.params;
        const updatedFeedback = await Feedback.findByIdAndUpdate(feedbackId, { $pull: { replies: { _id: replyId } } }, { new: true });
        if (!updatedFeedback) return res.status(404).json({ message: "Feedback or reply not found." });
        res.status(204).send();
    } catch (error) { console.error("ADMIN DEL REPLY ERR:", error); res.status(500).json({ message: "Server error while deleting reply." }); }
});

router.put('/api/admin/feedback/:feedbackId/reply/:replyId', authenticateAdminToken, async (req, res) => {
    try {
        const { feedbackId, replyId } = req.params;
        const { text } = req.body;
        if (!text || text.trim() === '') return res.status(400).json({ message: "Reply text cannot be empty." });
        const updatedFeedback = await Feedback.findOneAndUpdate({ "_id": feedbackId, "replies._id": replyId }, { "$set": { "replies.$.text": text, "replies.$.timestamp": new Date() } }, { new: true });
        if (!updatedFeedback) return res.status(404).json({ message: "Feedback or reply not found." });
        res.status(200).json({ message: "Reply updated successfully." });
    } catch (error) { console.error("ADMIN EDIT REPLY ERR:", error); res.status(500).json({ message: "Server error while updating reply." }); }
});

router.put('/api/admin/feedback/:id/pin', authenticateAdminToken, async (req, res) => {
    const { isPinned } = req.body;
    if (typeof isPinned !== 'boolean') return res.status(400).json({ message: 'Invalid request: "isPinned" must be a boolean.' });
    try {
        const feedbackToUpdate = await Feedback.findById(req.params.id);
        if (!feedbackToUpdate) return res.status(404).json({ message: 'Feedback not found.' });
        feedbackToUpdate.isPinned = isPinned;
        await feedbackToUpdate.save();
        res.status(200).json(feedbackToUpdate);
    } catch (error) { console.error(`ADMIN PIN/UNPIN ERR: ${req.params.id}`, error); res.status(500).json({ message: 'Server error while updating feedback.', error: error.message }); }
});

router.put('/api/admin/feedback/:feedbackId/change-avatar', authenticateAdminToken, async (req, res) => {
    const { feedbackId } = req.params;
    try {
        const feedback = await Feedback.findById(feedbackId);
        if (!feedback) return res.status(404).json({ message: 'Feedback not found.' });
        let newAvatarUrl;
        if (feedback.userId) {
            const user = await User.findById(feedback.userId);
            if (user) {
                if (!user.name) return res.status(400).json({ message: 'User name missing for avatar generation.' });
                newAvatarUrl = getDiceBearAvatarUrl(user.name, Date.now().toString());
                user.avatarUrl = newAvatarUrl;
                await user.save();
                await Feedback.updateMany({ userId: user._id }, { $set: { avatarUrl: newAvatarUrl } });
                const updatedFeedback = await Feedback.findById(feedbackId);
                return res.status(200).json(updatedFeedback);
            }
        }
        if (!feedback.name) return res.status(400).json({ message: 'Guest name missing for avatar generation.' });
        newAvatarUrl = getDiceBearAvatarUrl(feedback.name, Date.now().toString());
        feedback.avatarUrl = newAvatarUrl;
        await feedback.save();
        res.status(200).json(feedback);
    } catch (error) { console.error(`ADMIN AVATAR CHANGE ERR ON FEEDBACK ${feedbackId}:`, error); res.status(500).json({ message: 'Failed to change avatar due to server error.', error: error.message }); }
});

router.patch('/api/admin/feedbacks/:id/mark-read', authenticateAdminToken, async (req, res) => {
    try {
        const feedbackId = req.params.id;
        const feedback = await Feedback.findByIdAndUpdate(feedbackId, { $set: { readByAdmin: true } }, { new: true });
        if (!feedback) return res.status(404).json({ message: 'Feedback not found.' });
        res.status(200).json({ success: true, message: 'Feedback marked as read.', feedback });
    } catch (error) { console.error(`Error marking feedback ${req.params.id} as read:`, error); res.status(500).json({ message: 'Failed to mark feedback as read.', error: error.message }); }
});

// Blog Routes
router.post('/api/admin/blogs', authenticateAdminToken, async (req, res) => {
    const { link, title, summary, badge } = req.body;
    if (!link || !title || !summary) return res.status(400).json({ message: 'Missing fields.' });
    try {
        const blog = new Blog({ link, title, summary, badge });
        await blog.save();
        res.status(201).json({ message: 'Blog created.', blog });
    } catch (err) { res.status(500).json({ message: 'Fail.', error: err.message }); }
});

router.get('/api/blogs', async (req, res) => {
    try {
        const blogs = await Blog.find().sort({ date: -1 });
        res.json(blogs);
    } catch (error) { console.error("Error fetching blogs:", error); res.status(500).json({ message: "Failed to fetch blogs.", error: error.message }); }
});

router.delete('/api/admin/blog/:id', authenticateAdminToken, async (req, res) => {
    try {
        const deletedBlog = await Blog.findByIdAndDelete(req.params.id);
        if (!deletedBlog) return res.status(404).json({ message: 'Blog not found.' });
        res.json({ message: 'Blog deleted successfully.' });
    } catch (e) { console.error("Delete blog error:", e); res.status(500).json({ message: 'Failed to delete blog.', error: e.message }); }
});

router.put('/api/admin/blog/:id', authenticateAdminToken, async (req, res) => {
    const { link, title, summary, badge } = req.body;
    if (!link || !title || !summary) return res.status(400).json({ message: 'Missing fields for update.' });
    try {
        const blog = await Blog.findByIdAndUpdate(req.params.id, { link, title, summary, badge }, { new: true, runValidators: true });
        if (!blog) return res.status(404).json({ message: 'Blog not found.' });
        res.json({ message: 'Blog updated successfully.', blog });
    } catch (e) { console.error("Update blog error:", e); res.status(500).json({ message: 'Failed to update blog.', error: e.message }); }
});

router.post('/api/admin/restart', authenticateAdminToken, (req, res) => {
    res.json({ message: 'Server restarting now...' });
    setTimeout(() => { process.exit(0); }, 800);
});

// New notification routes
router.get('/api/admin/notifications', authenticateAdminToken, async (req, res) => {
    try {
        const adminId = req.adminUser.userId;
        const adminSettings = await AdminSettings.findOne({ adminId });
        const lastSeenTimestamp = adminSettings ? adminSettings.lastSeenFeedbackTimestamp : new Date(0);

        // Populate avatarUrl from Feedback model
        const newFeedbacks = await Feedback.find({ timestamp: { $gt: lastSeenTimestamp } }).sort({ timestamp: -1 });

        const notificationData = newFeedbacks.map(fb => ({
            id: fb._id,
            name: fb.name,
            feedback: fb.feedback,
            timestamp: fb.timestamp,
            avatarUrl: fb.avatarUrl // Include avatarUrl
        }));

        res.json(notificationData);
    } catch (error) {
        console.error('Error fetching admin notifications:', error);
        res.status(500).json({ message: 'Failed to fetch notifications.' });
    }
});

router.post('/api/admin/notifications/mark-seen', authenticateAdminToken, async (req, res) => {
    try {
        const adminId = req.adminUser.userId;
        const now = new Date();
        await AdminSettings.findOneAndUpdate(
            { adminId },
            { $set: { lastSeenFeedbackTimestamp: now } },
            { upsert: true, new: true }
        );
        res.status(200).json({ message: 'Notifications marked as seen.', timestamp: now });
    } catch (error) {
        console.error('Error marking notifications as seen:', error);
        res.status(500).json({ message: 'Failed to mark notifications as seen.' });
    }
});

module.exports = router;