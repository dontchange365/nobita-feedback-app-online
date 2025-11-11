// routes/admin.js

const express = require('express');
const router = express.Router();
const { User, Feedback, Blog, AdminSettings, Visit } = require('../config/database'); // Visit Model Import kiya
const { authenticateAdminToken } = require('../middleware/auth');
const { createUserPayload } = require('../utils/helpers');
const { getLeastUsedAvatarUrl, getAndIncrementAvatarUsage } = require('../utils/avatarGenerator');
const { sendPushNotificationToUser } = require('../services/pushNotification'); 
const { sendEmail, NOBITA_EMAIL_TEMPLATE } = require('../services/emailService'); // ADDED: Email Service
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const githubService = require('../services/githubService');
const asyncHandler = require('express-async-handler'); // IMPORT ASYNCHANDLER
const mongoose = require('mongoose'); // ADDED: Mongoose for ObjectId
const crypto = require('crypto'); // ADDED: For OTP generation

// --- BOT/ADMIN DISPLAY NAME ---
const DISPLAY_ADMIN_NAME = "👉𝙉𝙊𝘽𝙄𝙏𝘼🤟"; 
// --- BOT/ADMIN DISPLAY NAME ---

const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_INITIAL_PASSWORD = process.env.ADMIN_INITIAL_PASSWORD;
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL;
const BASE_DIR = path.resolve(__dirname, '..');
const ADMIN_NOTIFICATION_EMAIL = process.env.ADMIN_EMAIL; // NEW CONSTANT FOR TARGET EMAIL

// --- MODIFIED ADMIN LOGIN ROUTE (OTP GENERATION) ---
router.post('/api/admin/login', asyncHandler(async (req, res) => {
    const { username, password } = req.body;
    if (username !== ADMIN_USERNAME) return res.status(401).json({ message: "Invalid username or password." });

    let adminUser = await User.findOne({ username: ADMIN_USERNAME });
    if (!adminUser) {
        console.warn(`Admin user '${ADMIN_USERNAME}' not found in DB. Attempting to create it.`);
        if (!ADMIN_INITIAL_PASSWORD) { console.error("CRITICAL ERROR: ADMIN_INITIAL_PASSWORD env var is required to create the initial admin user."); return res.status(500).json({ message: "Server setup incomplete: Initial admin password not set." }); }
        const initialHashedPassword = await bcrypt.hash(ADMIN_INITIAL_PASSWORD, 12);
        // NOTE: Admin DB email will be a dummy email, actual notification email comes from ENV
        adminUser = new User({ name: 'Admin User', username: ADMIN_USERNAME, email: `${ADMIN_USERNAME.toLowerCase().replace(/\s/g, '')}@admin.com`, password: initialHashedPassword, loginMethod: 'email', isVerified: true });
        await adminUser.save();
        console.log(`Admin user '${ADMIN_USERNAME}' created with default password.`);
    }
    const isMatch = await bcrypt.compare(password, adminUser.password);
    if (!isMatch) return res.status(401).json({ message: "Invalid username or password." });

    // --- 2FA LOGIC START ---
    const otp = crypto.randomBytes(3).toString('hex').toUpperCase(); // 6-digit Hex OTP
    const otpExpires = Date.now() + 5 * 60 * 1000; // 5 MINUTES expiration
    
    // Admin email fetch: USE ADMIN_NOTIFICATION_EMAIL FROM ENV
    const adminEmail = ADMIN_NOTIFICATION_EMAIL;
    if (!adminEmail) return res.status(500).json({ message: "Admin email (ADMIN_EMAIL) not configured in ENV." });

    adminUser.adminOtp = otp;
    adminUser.adminOtpExpires = otpExpires;
    await adminUser.save();

    const emailHtml = `
        <div style="text-align:center; font-family: Poppins, sans-serif;">
            <h2 style="color:#FFD700;">Admin Login OTP</h2>
            <p>Aapne Nobita Admin Panel mein login request ki hai.</p>
            <h1 style="color:#8B5CF6; font-size:3em; letter-spacing: 5px;">${otp}</h1>
            <p>Yeh OTP <b>5 minute</b> mein expire ho jaayega. Agar aapne login request nahi ki, toh is email ko ignore karein.</p>
        </div>
    `;

    try { 
        await sendEmail({ 
            email: adminEmail, // Use the email from ENV
            subject: '🔐 Nobita Admin OTP (Expires in 5 mins)', 
            html: emailHtml 
        }); 
        
        // Final token abhi nahi bhejna, sirf ek status bhejni hai
        res.status(202).json({ 
            message: "OTP sent to admin email. Please verify.", 
            step: "OTP_REQUIRED",
            username: adminUser.username 
        });

    } catch (emailError) { 
        console.error("Error sending Admin OTP email:", emailError.message);
        res.status(500).json({ message: "Login failed. Could not send OTP email." });
    }
}));


// --- NEW OTP VERIFICATION ROUTE ---
router.post('/api/admin/verify-otp', asyncHandler(async (req, res) => {
    const { username, otp } = req.body;
    if (!username || !otp) {
        return res.status(400).json({ message: "Username and OTP are required." });
    }

    const adminUser = await User.findOne({ username: username });
    if (!adminUser) {
        return res.status(404).json({ message: "Admin user not found." });
    }

    if (adminUser.adminOtp !== otp.toUpperCase()) {
        return res.status(401).json({ message: "Invalid OTP." });
    }

    if (adminUser.adminOtpExpires < Date.now()) {
        // Clear expired OTP to prevent retries
        adminUser.adminOtp = undefined;
        adminUser.adminOtpExpires = undefined;
        await adminUser.save();
        return res.status(401).json({ message: "OTP expired. Please log in again." });
    }

    // OTP successful! Final JWT token issue karein (24 hours expiry)
    const adminPayload = { username: adminUser.username, userId: adminUser._id, loggedInAt: new Date().toISOString() };
    
    // --- 24 HOURS EXPIRY ---
    const adminToken = jwt.sign(adminPayload, ADMIN_JWT_SECRET, { expiresIn: '24h' }); 
    
    // OTP fields clear karein for next login
    adminUser.adminOtp = undefined;
    adminUser.adminOtpExpires = undefined;
    await adminUser.save();

    res.status(200).json({ 
        message: "OTP verified. Login successful!", 
        token: adminToken, 
        admin: adminPayload
    });
}));


// Admin-specific Feedback Routes
router.delete('/api/admin/feedback/:id', authenticateAdminToken, asyncHandler(async (req, res) => {
    const fb = await Feedback.findByIdAndDelete(req.params.id);
    if (!fb) return res.status(404).json({ message: 'ID not found.' });
    res.status(200).json({ message: 'Deleted.' });
}));

router.delete('/api/admin/feedbacks/batch-delete', authenticateAdminToken, asyncHandler(async (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: 'No IDs.' });
    const r = await Feedback.deleteMany({ _id: { $in: ids } });
    if (r.deletedCount === 0) return res.status(404).json({ message: 'None found.' });
    res.status(200).json({ message: `${r.deletedCount} deleted.`, deletedCount: r.deletedCount });
}));

// POST Reply Route (UPDATED TO USE HARDCODED DISPLAY NAME AND EMAIL LOGIC)
router.post('/api/admin/feedback/:id/reply', authenticateAdminToken, asyncHandler(async (req, res) => {
    const fId = req.params.id;
    const { replyText } = req.body;
    // --- CHANGE 1: HARDCODE NAME TO DISPLAY_ADMIN_NAME ---
    const adminName = DISPLAY_ADMIN_NAME; 
    // --- CHANGE 1: HARDCODE NAME TO DISPLAY_ADMIN_NAME ---

    if (!replyText) return res.status(400).json({ message: 'Reply text missing.' });
    
    // 1. Fetch Feedback and User (for subscription AND email)
    // Populate userId taaki user ki details (email, name, avatarUrl) mil sake
    const fb = await Feedback.findById(fId).populate('userId', 'email name pushSubscription avatarUrl');
    if (!fb) return res.status(404).json({ message: 'ID not found.' });
    
    // 2. Add Reply
    // Use the hardcoded display name
    const newReply = { text: replyText, adminName: adminName, timestamp: new Date() };
    fb.replies.push(newReply);
    await fb.save();

    // 3. Send Push Notification to User (Existing Logic)
    if (fb.userId) {
        // Since we populated fb.userId, we can use it directly
        const user = fb.userId; 
        if (user && user.pushSubscription) {
            await sendPushNotificationToUser(user.pushSubscription, fb, adminName);
        }
        
        // 4. Send Email Notification to User (NEW LOGIC)
        if (user && user.email) {
            try {
                // NEW: feedbackId ke saath link banao
                const mailLink = `${FRONTEND_URL}/index.html?feedbackId=${fb._id}`; 
                const emailHtml = NOBITA_EMAIL_TEMPLATE(
                    'Admin Reply Received!',
                    user.name || 'User',
                    'View Reply Now',
                    mailLink,
                    user.avatarUrl || 'https://placehold.co/80x80/6a0dad/FFFFFF?text=U',
                    'admin-reply',
                    { 
                        reply: replyText,
                        originalFeedback: fb.feedback // User ka original feedback
                    }
                );
                
                await sendEmail({
                    email: user.email,
                    subject: `Admin Reply: ${fb.feedback.substring(0, 30)}...`,
                    html: emailHtml,
                    message: `Admin ${adminName} has replied to your feedback: ${replyText}`
                });
                console.log(`Email sent successfully to ${user.email} for reply.`);
            } catch (emailError) {
                console.error(`Failed to send reply notification email to ${user.email}:`, emailError.message);
                // Continue execution despite email failure
            }
        }
    }
    
    res.status(200).json({ message: 'Replied.', reply: fb.replies[fb.replies.length - 1] });
}));

router.delete('/api/admin/feedback/:feedbackId/reply/:replyId', authenticateAdminToken, asyncHandler(async (req, res) => {
    const { feedbackId, replyId } = req.params;
    const updatedFeedback = await Feedback.findByIdAndUpdate(feedbackId, { $pull: { replies: { _id: replyId } } }, { new: true });
    if (!updatedFeedback) return res.status(404).json({ message: "Feedback or reply not found." });
    res.status(204).send();
}));

router.put('/api/admin/feedback/:feedbackId/reply/:replyId', authenticateAdminToken, asyncHandler(async (req, res) => {
    const { feedbackId, replyId } = req.params;
    const { text } = req.body;
    if (!text || text.trim() === '') return res.status(400).json({ message: "Reply text cannot be empty." });
    // NOTE: This route retains the original adminName saved in the reply entry, which is now guaranteed to be "👉𝙉𝙊𝘽𝙄𝙏𝘼🤟"
    const updatedFeedback = await Feedback.findOneAndUpdate({ "_id": feedbackId, "replies._id": replyId }, { "$set": { "replies.$.text": text, "replies.$.timestamp": new Date() } }, { new: true });
    if (!updatedFeedback) return res.status(404).json({ message: "Feedback or reply not found." });
    res.status(200).json({ message: "Reply updated successfully." });
}));

router.put('/api/admin/feedback/:id/pin', authenticateAdminToken, asyncHandler(async (req, res) => {
    const { isPinned } = req.body;
    if (typeof isPinned !== 'boolean') return res.status(400).json({ message: 'Invalid request: "isPinned" must be a boolean.' });
    const feedbackToUpdate = await Feedback.findById(req.params.id);
    if (!feedbackToUpdate) return res.status(404).json({ message: 'Feedback not found.' });
    feedbackToUpdate.isPinned = isPinned;
    await feedbackToUpdate.save();
    res.status(200).json(feedbackToUpdate);
}));

router.put('/api/admin/feedback/:feedbackId/change-avatar', authenticateAdminToken, asyncHandler(async (req, res) => {
    const { feedbackId } = req.params;
    const feedback = await Feedback.findById(feedbackId);
    if (!feedback) return res.status(404).json({ message: 'Feedback not found.' });
    if (!feedback.name) return res.status(400).json({ message: 'Guest name missing for avatar generation.' });
    
    const newAvatarUrl = await getLeastUsedAvatarUrl();
    
    let query = {};
    if (feedback.userId) {
        const user = await User.findById(feedback.userId);
        if (!user) return res.status(404).json({ message: 'User not found.' });
        user.avatarUrl = newAvatarUrl;
        await user.save();
        query = { userId: user._id };
    } else {
        query = { name: feedback.name, timestamp: { $lte: feedback.timestamp } };
    }
    await Feedback.updateMany(query, { $set: { avatarUrl: newAvatarUrl } });
    
    await getAndIncrementAvatarUsage(newAvatarUrl);
    
    const updatedFeedback = await Feedback.findById(feedbackId);
    res.status(200).json(updatedFeedback);
}));

router.patch('/api/admin/feedbacks/:id/mark-read', authenticateAdminToken, asyncHandler(async (req, res) => {
    const feedbackId = req.params.id;
    const feedback = await Feedback.findByIdAndUpdate(feedbackId, { $set: { readByAdmin: true } }, { new: true });
    if (!feedback) return res.status(404).json({ message: 'Feedback not found.' });
    res.status(200).json({ success: true, message: 'Feedback marked as read.', feedback });
}));

// Blog Routes
router.post('/api/admin/blogs', authenticateAdminToken, asyncHandler(async (req, res) => {
    const { link, title, summary, badge } = req.body;
    if (!link || !title || !summary) return res.status(400).json({ message: 'Missing fields.' });
    const blog = new Blog({ link, title, summary, badge });
    await blog.save();
    res.status(201).json({ message: 'Blog created.', blog });
}));

router.get('/api/blogs', asyncHandler(async (req, res) => {
    const blogs = await Blog.find().sort({ date: -1 });
    res.json(blogs);
}));

router.delete('/api/admin/blog/:id', authenticateAdminToken, asyncHandler(async (req, res) => {
    const deletedBlog = await Blog.findByIdAndDelete(req.params.id);
    if (!deletedBlog) return res.status(404).json({ message: 'Blog not found.' });
    res.json({ message: 'Blog deleted successfully.' });
}));

router.put('/api/admin/blog/:id', authenticateAdminToken, asyncHandler(async (req, res) => {
    const { link, title, summary, badge } = req.body;
    if (!link || !title || !summary) return res.status(400).json({ message: 'Missing fields for update.' });
    const blog = await Blog.findByIdAndUpdate(req.params.id, { link, title, summary, badge }, { new: true, runValidators: true });
    if (!blog) return res.status(404).json({ message: 'Blog not found.' });
    res.json({ message: 'Blog updated successfully.', blog });
}));

router.post('/api/admin/restart', authenticateAdminToken, (req, res) => {
    res.json({ message: 'Server restarting now...' });
    setTimeout(() => { process.exit(0); }, 800);
});

// New notification routes
router.get('/api/admin/notifications', authenticateAdminToken, asyncHandler(async (req, res) => {
    const adminId = req.adminUser.userId;
    const adminSettings = await AdminSettings.findOne({ adminId });
    const lastSeenTimestamp = adminSettings ? adminSettings.lastSeenFeedbackTimestamp : new Date(0);

    const newFeedbacks = await Feedback.find({ timestamp: { $gt: lastSeenTimestamp } }).sort({ timestamp: -1 });

    const notificationData = newFeedbacks.map(fb => ({
        id: fb._id,
        name: fb.name,
        feedback: fb.feedback,
        timestamp: fb.timestamp,
        avatarUrl: fb.avatarUrl
    }));

    res.json(notificationData);
}));

router.post('/api/admin/notifications/mark-seen', authenticateAdminToken, asyncHandler(async (req, res) => {
    const adminId = req.adminUser.userId;
    const now = new Date();
    await AdminSettings.findOneAndUpdate(
        { adminId },
        { $set: { lastSeenFeedbackTimestamp: now } },
        { upsert: true, new: true }
    );
    res.status(200).json({ message: 'Notifications marked as seen.', timestamp: now });
}));

// CHANCE: GitHub push stream endpoint ko update karein
router.get('/api/admin/push-to-github/stream', authenticateAdminToken, asyncHandler(async (req, res) => {
    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
    res.flushHeaders();
    function sendLog(data) { res.write(`data: ${JSON.stringify(data)}\n\n`); }

    sendLog({ type: 'message', message: '[Connecting to GitHub...]' });
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const REPO_OWNER = githubService.GITHUB_REPO_OWNER;
    const REPO_NAME = githubService.GITHUB_REPO_NAME;
    const BRANCH = githubService.GITHUB_BRANCH;
    const pushMessage = req.query.message || 'Auto push from NOBI FILE MANAGER 😈';

    if (!GITHUB_TOKEN) { sendLog({ type: 'error', message: '[ERROR] GitHub Token is not configured.' }); sendLog({ type: 'message', message: '[GITHUB_DONE]' }); return res.end(); }

    const allFiles = githubService.walkAllFiles(BASE_DIR);
    sendLog({ type: 'message', message: `[Found ${allFiles.length} files, pushing to GitHub...]` });

    let pushed = 0;
    for (const file of allFiles) {
        sendLog({ type: 'start', file: file.path, status: 'push' });

        let sha = undefined;
        try {
            const meta = await axios.get(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodeURIComponent(file.path)}?ref=${BRANCH}`, { headers: { Authorization: `token ${GITHUB_TOKEN}` } });
            sha = meta.data.sha;
        } catch (e) {
            if (e.response && e.response.status !== 404) { console.warn(`Error checking SHA for ${file.path}:`, e.response?.data || e.message); }
        }

        try {
            await axios.put(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodeURIComponent(file.path)}`, { message: pushMessage, content: Buffer.from(file.content).toString('base64'), branch: BRANCH, ...(sha ? { sha } : {}) }, { headers: { Authorization: `token ${GITHUB_TOKEN}`, 'Content-Type': 'application/json', 'Accept': 'application/vnd.github.v3+json' } });
            pushed++;
            sendLog({ type: 'success', file: file.path, status: 'push' });
        } catch (err) { sendLog({ type: 'error', file: file.path, message: err.response?.data?.message || err.message, status: 'push' }); }
    }
    sendLog({ type: 'message', message: `[COMPLETE] Pushed: ${pushed}/${allFiles.length} files.` });
    sendLog({ type: 'message', message: '[GITHUB_DONE]' });
    res.end();
}));

// CHANGE: GitHub pull stream endpoint ko update karein
router.get('/api/admin/pull-from-github/stream', authenticateAdminToken, asyncHandler(async (req, res) => {
    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
    res.flushHeaders();
    function sendLog(data) { res.write(`data: ${JSON.stringify(data)}\n\n`); }

    sendLog({ type: 'message', message: '[Connecting to GitHub for pull...]' });
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const REPO_OWNER = githubService.GITHUB_REPO_OWNER;
    const REPO_NAME = githubService.GITHUB_REPO_NAME;
    const BRANCH = githubService.GITHUB_BRANCH;

    if (!GITHUB_TOKEN) { sendLog({ type: 'error', message: '[ERROR] GitHub Token is not configured.' }); sendLog({ type: 'message', message: '[GITHUB_DONE]' }); return res.end(); }

    await githubService.downloadGithubContents(REPO_OWNER, REPO_NAME, BRANCH, '', BASE_DIR, sendLog);
    sendLog({ type: 'message', message: '[COMPLETE] Files successfully pulled from GitHub!' });
    sendLog({ type: 'message', message: '[GITHUB_DONE]' });
    res.end();
}));

router.post('/api/admin/create-page-from-template', authenticateAdminToken, asyncHandler(async (req, res) => {
    const { pageName, pageTitle, metaDescription, metaKeywords, pageContent, inlineCss, inlineJs, websiteTitle, heroTitle, heroEmoji, heroPara } = req.body;
    if (!pageName || !pageTitle || !pageContent || !websiteTitle || !heroTitle || !heroPara) return res.status(400).json({ message: 'Page name, title, content, website title, hero title, and hero paragraph are required.' });
    const fileName = pageName.endsWith('.html') ? pageName : `${pageName}.html`;
    const filePath = path.join(BASE_DIR, 'public', fileName);
    if (filePath.includes('..') || !filePath.startsWith(path.join(BASE_DIR, 'public'))) return res.status(400).json({ message: 'Invalid page name.' });
    const templatePath = path.join(BASE_DIR, 'template.html');
    
    let templateContent = await fs.promises.readFile(templatePath, 'utf8');
    templateContent = templateContent.replace(/PAGE TITLE HERE/g, pageTitle);
    templateContent = templateContent.replace(/Meta description here/g, metaDescription || '');
    templateContent = templateContent.replace(/Nobita, keywords, update, new content/g, metaKeywords || 'Nobita, custom page');
    templateContent = templateContent.replace(/WEBSITE_TITLE_PLACEHOLDER/g, websiteTitle);
    templateContent = templateContent.replace(/HERO_TITLE_PLACEHOLDER/g, heroTitle);
    templateContent = templateContent.replace(/HERO_EMOJI_PLACEHOLDER/g, heroEmoji || '');
    templateContent = templateContent.replace(/HERO_PARA_PLACEHOLDER/g, heroPara);
    templateContent = templateContent.replace(/MAIN_CONTENT_PLACEHOLDER/g, pageContent);
    if (inlineCss) { templateContent = templateContent.replace('</head>', `<style>\n${inlineCss}\n</style>\n</head>`); }
    if (inlineJs) {
        const bodyEndIndex = templateContent.lastIndexOf('</body>');
        if (bodyEndIndex !== -1) { templateContent = templateContent.substring(0, bodyEndIndex) + `<script>\n${inlineJs}\n</script>\n` + templateContent.substring(bodyEndIndex); }
        else { templateContent = templateContent.replace('</html>', `<script>\n${inlineJs}\n</script>\n</html>`); }
    }
    await fs.promises.writeFile(filePath, templateContent);
    res.status(200).json({ message: `Page "${fileName}" created successfully in public folder.` });
}));

// --- NEW ANALYTICS ENDPOINT ---
router.get('/api/admin/analytics', authenticateAdminToken, asyncHandler(async (req, res) => {
    const { period = 'all' } = req.query; // Filters: all, today, yesterday, last7days, last30days
    
    let dateFilter = {};
    const now = new Date();
    const startOfToday = new Date(now.setHours(0, 0, 0, 0));
    
    if (period !== 'all') {
        let startTime;
        let endTime = now;

        switch (period) {
            case 'today':
                startTime = startOfToday;
                break;
            case 'yesterday':
                startTime = new Date(startOfToday);
                startTime.setDate(startOfToday.getDate() - 1);
                endTime = startOfToday;
                break;
            case 'last7days':
                startTime = new Date(startOfToday);
                startTime.setDate(startOfToday.getDate() - 7);
                break;
            case 'last30days':
                startTime = new Date(startOfToday);
                startTime.setDate(startOfToday.getDate() - 30);
                break;
            case 'lastweek': // Last full week (Sun-Sat)
                // This is a complex definition, using simple 7 days for quick calc
                startTime = new Date(startOfToday);
                startTime.setDate(startOfToday.getDate() - 7);
                break;
            default:
                break;
        }

        if (startTime) {
            dateFilter.timestamp = { $gte: startTime, $lte: endTime };
        }
    }

    // 1. Total Visits Count
    const totalVisits = await Visit.countDocuments(dateFilter);

    // 2. Unique IP Count
    const uniqueIpsResult = await Visit.aggregate([
        { $match: dateFilter },
        { $group: { _id: '$ipAddress' } },
        { $count: 'uniqueCount' }
    ]);
    const uniqueVisits = uniqueIpsResult.length > 0 ? uniqueIpsResult[0].uniqueCount : 0;
    
    res.status(200).json({
        period: period,
        totalVisits: totalVisits,
        uniqueVisits: uniqueVisits
    });
}));
// --- END NEW ANALYTICS ENDPOINT ---

module.exports = router;