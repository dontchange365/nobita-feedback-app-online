// routes/auth.js
const express = require('express');
const router = express.Router();
const { User, Feedback } = require('../config/database');
const { authenticateToken, isEmailVerified } = require('../middleware/auth');
const { upload, cloudinary, newUpload } = require('../middleware/fileUpload');
const { getLeastUsedAvatarUrl, getAndIncrementAvatarUsage } = require('../utils/avatarGenerator');
const { createUserPayload } = require('../utils/helpers');
const { sendEmail, NOBITA_EMAIL_TEMPLATE } = require('../services/emailService');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const asyncHandler = require('express-async-handler');
const { OAuth2Client } = require('google-auth-library');

const FRONTEND_URL = process.env.FRONTEND_URL;
const JWT_SECRET = process.env.JWT_SECRET;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_CALLBACK_URL
);

// --- Get Rate Limiters from app.locals ---
const authLimiter = router.stack.filter(layer => layer.name === 'authLimiter')[0]?.handle || ((req, res, next) => next()); 
// --- Get Rate Limiters from app.locals ---

/**
 * Migrates existing guest upvotes and guest-submitted feedbacks to the newly registered/logged-in user.
 */
async function migrateGuestIdentity(guestId, newUser) {
    if (!guestId || !newUser || !newUser._id) return;
    
    try {
        // 1. Migrate Votes: Move upvotes from guest array to user array
        await Feedback.updateMany(
            { upvoteGuests: guestId },
            {
                $pull: { upvoteGuests: guestId }, // Remove the guest ID
                $addToSet: { upvotes: newUser._id } // Add the user's ObjectId
            }
        );

        // 2. Link Guest Feedback: Attach any old guest-submitted feedback to the new user ID
        await Feedback.updateMany(
            { guestId: guestId, userId: null }, // Find feedbacks submitted by this guest ID with no linked user
            {
                $set: { 
                    userId: newUser._id, // Link to the new user ID
                    name: newUser.name, // Update name to the registered user's name
                    avatarUrl: newUser.avatarUrl // Update avatar to the registered user's avatar
                }, 
                $unset: { guestId: "" } // Remove the guestId field (migration complete)
            }
        );
        console.log(`[IDENTITY_MIGRATION] Guest ID ${guestId} successfully migrated to User ID ${newUser._id}`);

    } catch (error) {
        console.error(`[IDENTITY_MIGRATION_ERROR] Failed to merge guest ID ${guestId}:`, error);
    }
}

// Apply authLimiter to high-cost/sensitive authentication routes
router.post('/api/auth/signup', authLimiter, asyncHandler(async (req, res) => {
    const { name, email, password, linkGuestId } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: "Name, email, and password are required." });
    if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters long." });
    
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
        if (existingUser.loginMethod === 'google' && !existingUser.password) { return res.status(409).json({ message: "An account exists for this email via Google. Please log in with Google, or use Forgot Password to set one for email login.", actionRequired: "SET_PASSWORD_FOR_GOOGLE_EMAIL" }); }
        return res.status(400).json({ message: "This email is already registered." });
    }
    const hashedPassword = await bcrypt.hash(password, 12);
    const userAvatar = await getLeastUsedAvatarUrl();
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const newUser = new User({ name, email: email.toLowerCase(), password: hashedPassword, avatarUrl: userAvatar, loginMethod: 'email', isVerified: false, emailVerificationToken: verificationToken, emailVerificationExpires: Date.now() + 10 * 60 * 1000, hasCustomAvatar: false });
    await newUser.save();
    
    if (linkGuestId) { await migrateGuestIdentity(linkGuestId, newUser); }
    
    const verifyUrl = `${FRONTEND_URL}/verify-email.html?token=${verificationToken}`;
    const emailHtml = NOBITA_EMAIL_TEMPLATE("📩 Email Verification", newUser.name, "✅ Verify Your Email", verifyUrl, newUser.avatarUrl, 'verify-request');
    try { await sendEmail({ email: newUser.email, subject: 'Nobita Feedback App: Email Verification', html: emailHtml }); } catch (emailError) { console.error("Error sending verification email:", emailError.message); }
    const userForToken = createUserPayload(newUser);
    const appToken = jwt.sign(userForToken, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token: appToken, user: userForToken, message: "Account created successfully. Please verify your email." });
}));

router.post('/api/auth/login', authLimiter, asyncHandler(async (req, res) => {
    const { email, password, linkGuestId } = req.body; 
    if (!email || !password) return res.status(400).json({ message: "Email and password are required." });
    
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ message: "Invalid email or password." });
    if (user.loginMethod === 'google' && !user.password) return res.status(401).json({ message: "You signed up with Google. Please log in with Google, or use the 'Forgot Password' link to set a new password." });
    if (!user.password) return res.status(401).json({ message: "Invalid login credentials." });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: "Invalid email or password." });
    
    if (linkGuestId) { await migrateGuestIdentity(linkGuestId, user); }

    const userForToken = createUserPayload(user);
    const appToken = jwt.sign(userForToken, JWT_SECRET, { expiresIn: '7d' });
    res.status(200).json({ token: appToken, user: userForToken });
}));

router.post('/api/auth/google-signin', authLimiter, asyncHandler(async (req, res) => {
    const { token, linkGuestId } = req.body;
    if (!token) return res.status(400).json({ message: 'Google ID token not found.' });
    
    const ticket = await oauth2Client.verifyIdToken({ idToken: token, audience: GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    if (!payload) throw new Error("Google token payload not found.");
    const { sub: googleId, name, email, picture: googleAvatar } = payload;
    let user = await User.findOne({ googleId });
    if (!user) {
        user = await User.findOne({ email: email.toLowerCase() });
        if (user) {
            if (user.loginMethod === 'email') { user.googleId = googleId; if (!user.hasCustomAvatar) { user.avatarUrl = googleAvatar || await getLeastUsedAvatarUrl(); } user.isVerified = true; user.emailVerificationToken = undefined; user.emailVerificationExpires = undefined; }
        } else { user = new User({ googleId, name, email: email.toLowerCase(), avatarUrl: googleAvatar || await getLeastUsedAvatarUrl(), loginMethod: 'google', isVerified: true, hasCustomAvatar: false }); }
        await user.save();
    } else { if (googleAvatar && !user.hasCustomAvatar) { user.avatarUrl = googleAvatar; await user.save(); } if (!user.isVerified) { user.isVerified = true; await user.save(); } }
    
    if (linkGuestId) { await migrateGuestIdentity(linkGuestId, user); }
    
    const userForToken = createUserPayload(user);
    const appToken = jwt.sign(userForToken, JWT_SECRET, { expiresIn: '7d' });
    res.status(200).json({ token: appToken, user: userForToken });
}));

router.get('/api/auth/me', authenticateToken, asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: "User not found." });
    res.status(200).json({ user: createUserPayload(user) });
}));

router.post('/api/auth/request-email-verification', authenticateToken, asyncHandler(async (req, res) => {
    if (!FRONTEND_URL) return res.status(500).json({ message: "Server configuration error (FRONTEND_URL missing)." });
    
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: "User not found." });
    if (user.loginMethod === 'google' || user.isVerified) return res.status(200).json({ message: "Email already verified or not applicable." });
    
    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = Date.now() + 10 * 60 * 1000;
    await user.save();
    const verifyUrl = `${FRONTEND_URL}/verify-email.html?token=${verificationToken}`;
    const emailHtml = NOBITA_EMAIL_TEMPLATE("📩 Email Verification", user.name, "✅ Verify Your Email", verifyUrl, user.avatarUrl, 'verify-request');
    try { await sendEmail({ email: user.email, subject: 'Nobita Feedback App: Email Verification', html: emailHtml }); } catch (emailError) { console.error("Error sending verification email:", emailError.message); }
    res.status(200).json({ message: "Verification link has been sent to your email." });
}));

// --- PASSWORD RESET TOKEN INVALIDITY LOGIC START ---
router.post('/api/auth/request-password-reset', authLimiter, asyncHandler(async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email address is required." });
    if (!FRONTEND_URL) return res.status(500).json({ message: "Server configuration error (FRONTEND_URL missing)." });
    
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user || (user.loginMethod === 'email' && !user.isVerified)) { 
        // Always return generic success message to prevent user enumeration
        return res.status(200).json({ message: "If your email is in our system and linked to an email/password account, you will receive a password reset link." }); 
    }
    
    // Check if an existing token is still valid (more than 5 minutes remaining)
    const MINIMUM_TIME_TO_WAIT_MS = 5 * 60 * 1000;
    if (user.resetPasswordExpires && user.resetPasswordExpires.getTime() > Date.now()) {
        const timeRemaining = user.resetPasswordExpires.getTime() - Date.now();
        const initialExpiryTime = 3600000; // 1 hour = 3600000 ms

        // If timeRemaining is very close to the initial expiry time (e.g., > 55 mins)
        if (timeRemaining > (initialExpiryTime - MINIMUM_TIME_TO_WAIT_MS)) {
            return res.status(429).json({ message: "A password reset link was recently sent to this email. Please check your inbox or wait a few minutes before requesting a new one." });
        }
        
        // **Implicit Invalidation:** If the user requests a new token while the old one is valid, 
        // overwriting the token and setting new expiry ensures that only the LATEST link works.
        // We ensure that the existing token is forcibly expired by overwriting the field below.
    }
    
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000;
    await user.save();
    const resetUrl = `${FRONTEND_URL}/reset-password.html?token=${resetToken}`;
    const htmlMessage = NOBITA_EMAIL_TEMPLATE("🔐 Password Reset", user.name, "🔁 Reset Your Password", resetUrl, user.avatarUrl, 'reset-request');
    await sendEmail({ email: user.email, subject: 'Your Password Reset Link (Nobita Feedback App)', html: htmlMessage });
    
    res.status(200).json({ message: "A password reset link has been sent to your email (if valid and linked)." });
}));
// --- PASSWORD RESET TOKEN INVALIDITY LOGIC END ---

router.post('/api/auth/reset-password', asyncHandler(async (req, res) => {
    const { token, password, confirmPassword } = req.body;
    if (!token) return res.status(400).json({ message: "Password reset token not found." });
    if (!password || !confirmPassword || password !== confirmPassword || password.length < 6) return res.status(400).json({ message: "Invalid password details." });
    
    const user = await User.findOne({ resetPasswordToken: token, resetPasswordExpires: { $gt: Date.now() } });
    if (!user) return res.status(400).json({ message: "Password reset token is invalid or has expired." });
    user.password = await bcrypt.hash(password, 12);
    user.resetPasswordToken = undefined; user.resetPasswordExpires = undefined;
    user.loginMethod = 'email';
    await user.save();
    const confirmationHtmlMessage = NOBITA_EMAIL_TEMPLATE("✅ Password Reset Successful", user.name, "Login Now", `${FRONTEND_URL}`, user.avatarUrl, 'reset-confirm');
    try { await sendEmail({ email: user.email, subject: 'Your Password Has Been Successfully Reset', html: confirmationHtmlMessage }); } catch (emailError) { console.error("Error sending password reset confirmation email:", emailError); }
    const userForToken = createUserPayload(user);
    const appToken = jwt.sign(userForToken, JWT_SECRET, { expiresIn: '7d' });
    res.status(200).json({ message: "Your password has been successfully reset.", token: appToken, user: userForToken });
}));

router.post('/api/auth/verify-email', asyncHandler(async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: "Email verification token not found." });
    
    const user = await User.findOne({ emailVerificationToken: token, emailVerificationExpires: { $gt: Date.now() } });
    if (!user) return res.status(400).json({ message: "Email verification token is invalid or has expired." });
    user.isVerified = true;
    user.emailVerificationToken = undefined; user.emailVerificationExpires = undefined;
    await user.save();
    const confirmationHtmlMessage = NOBITA_EMAIL_TEMPLATE("📨 Email Verified Successfully", user.name, "Go To Dashboard", `${FRONTEND_URL}/`, user.avatarUrl, 'verify-confirm');
    try { await sendEmail({ email: user.email, subject: 'Aapka Email Safaltapoorvak Verify Ho Gaya Hai!', html: confirmationHtmlMessage }); } catch (emailError) { console.error("Error sending verification confirmation email:", emailError); }
    const userForToken = createUserPayload(user);
    const newToken = jwt.sign(userForToken, JWT_SECRET, { expiresIn: '7d' });
    res.status(200).json({ message: "Your email has been successfully verified.", token: newToken, user: userForToken });
}));

router.put('/api/user/profile', authenticateToken, isEmailVerified, asyncHandler(async (req, res) => {
    const { name, avatarUrl } = req.body;
    const userId = req.user.userId;
    
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    if (user.loginMethod === 'google') {
        if (typeof name !== 'undefined' && name !== user.name) {
            user.name = name.trim();
        }
        if (typeof avatarUrl !== 'undefined' && avatarUrl && avatarUrl !== user.avatarUrl) {
            user.avatarUrl = avatarUrl;
            user.hasCustomAvatar = true;
            await getAndIncrementAvatarUsage(avatarUrl);
        }
    } else {
        if (typeof name !== 'undefined') {
            if (!name || !name.trim()) return res.status(400).json({ message: 'Name cannot be empty.' });
            user.name = name.trim();
        }
        if (typeof avatarUrl !== 'undefined' && avatarUrl) {
            user.avatarUrl = avatarUrl;
            user.hasCustomAvatar = true;
            await getAndIncrementAvatarUsage(avatarUrl);
        }
    }
    await user.save();
    await Feedback.updateMany({ userId: user._id }, { $set: { avatarUrl: user.avatarUrl, name: user.name } });
    const updatedUserForToken = createUserPayload(user);
    const newToken = jwt.sign(updatedUserForToken, JWT_SECRET, { expiresIn: '7d' });
    res.status(200).json({ message: 'Profile updated successfully!', user: updatedUserForToken, token: newToken });
}));

router.post('/api/user/change-password', authenticateToken, isEmailVerified, asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.userId;
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ message: 'Invalid password details. New password must be at least 6 characters.' });
    
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (user.password) {
        if (!currentPassword) return res.status(400).json({ message: 'Current password is required to change password.' });
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) return res.status(401).json({ message: 'Incorrect current password.' });
    } else if (user.loginMethod === 'google' && !user.password) { } else { return res.status(400).json({ message: 'Password change not applicable.' }); }
    user.password = await bcrypt.hash(newPassword, 12);
    user.loginMethod = 'email';
    await user.save();
    const userForToken = createUserPayload(user);
    const newToken = jwt.sign(userForToken, JWT_SECRET, { expiresIn: '7d' });
    res.status(200).json({ message: 'Password has been successfully set/changed!', token: newToken, user: userForToken });
}));

router.post('/api/user/upload-avatar', authenticateToken, isEmailVerified, newUpload.single('avatar'), asyncHandler(async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded.' });
    }
    const userId = req.user.userId;
    
    const user = await User.findById(userId);
    if (!user) {
        await cloudinary.uploader.destroy(req.file.public_id);
        return res.status(404).json({ message: 'User not found.' });
    }
    
    user.avatarUrl = req.file.path;
    user.avatarPublicId = req.file.filename;
    user.hasCustomAvatar = true;
    await user.save();
    await Feedback.updateMany({ userId: user._id }, { $set: { avatarUrl: user.avatarUrl } });
    
    const updatedUserForToken = createUserPayload(user);
    const newToken = jwt.sign(updatedUserForToken, JWT_SECRET, { expiresIn: '7d' });
    
    res.status(200).json({ message: 'Avatar uploaded successfully!', user: updatedUserForToken, token: newToken });
}));

router.post('/api/user/subscribe-notifications', authenticateToken, asyncHandler(async (req, res) => {
    const subscription = req.body.subscription;
    const userId = req.user.userId;
    if (!subscription || !subscription.endpoint) return res.status(400).json({ message: 'No push subscription data provided.' });
    
    await User.findByIdAndUpdate(userId, { pushSubscription: subscription });
    res.status(201).json({ message: 'User push subscription saved successfully!' });
}));

router.get('/api/vapid-public-key', (req, res) => {
    if (!process.env.VAPID_PUBLIC_KEY) { return res.status(500).json({ message: "VAPID public key not configured on server." }); }
    res.send(process.env.VAPID_PUBLIC_KEY);
});

module.exports = router;