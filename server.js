// server.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL || `http://localhost:${PORT}`;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_HOST = process.env.EMAIL_HOST;
const EMAIL_PORT = process.env.EMAIL_PORT;
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "password";

console.log("--- Environment Variable Check (server.js start) ---");
console.log("MONGODB_URI (loaded):", MONGODB_URI ? "SET" : "NOT SET");
console.log("JWT_SECRET (loaded):", JWT_SECRET ? "SET" : "NOT SET");
// ... other env var logs ...
console.log("--- End Environment Variable Check ---");

if (!MONGODB_URI || !JWT_SECRET ) {
    console.error("CRITICAL ERROR: MONGODB_URI or JWT_SECRET environment variable nahi mila. Application will exit.");
    process.exit(1);
}
// ... other env var checks ...

const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;
if (!googleClient && GOOGLE_CLIENT_ID) {
    console.warn("WARNING: Google Client not initialized properly despite GOOGLE_CLIENT_ID being set.");
}

mongoose.connect(MONGODB_URI)
  .then(() => console.log('MongoDB se connection safal!'))
  .catch(err => {
    console.error('MongoDB connection mein gadbad:', err);
    process.exit(1);
});

if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
    cloudinary.config({ /* ... */ });
    console.log("Cloudinary configured successfully.");
} else {
    console.warn("Cloudinary not configured. File uploads for avatars will not work.");
}

const storage = multer.memoryStorage();
const upload = multer({ /* ... */ });

function getGenericAvatarUrl(name) {
    if (!name || typeof name !== 'string' || name.trim() === '') name = 'User';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6a0dad&color=ffd700&bold=true&size=128&format=png`;
}

const userSchema = new mongoose.Schema({
  name: { type: String, required: [true, "Name is required."], trim: true },
  email: { type: String, required: [true, "Email is required."], unique: true, lowercase: true, trim: true },
  password: { type: String },
  googleId: { type: String, sparse: true, unique: true, default: null },
  avatarUrl: { type: String },
  loginMethod: { type: String, enum: ['email', 'google'], required: [true, "Login method is required."] },
  createdAt: { type: Date, default: Date.now },
  resetPasswordToken: { type: String, default: undefined },
  resetPasswordExpires: { type: Date, default: undefined }
});

userSchema.post('save', function(error, doc, next) {
  if (error.name === 'MongoServerError' && error.code === 11000 && error.keyPattern && error.keyPattern.email) {
    next(new Error('Yeh email address pehle se register hai (duplicate key).'));
  } else {
    next(error);
  }
});
const User = mongoose.model('User', userSchema);

const feedbackSchema = new mongoose.Schema({ /* ... */ });
const Feedback = mongoose.model('Feedback', feedbackSchema);

app.use(cors({ /* ... */ }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use((req, res, next) => { /* IP logging ... */ next(); });
const authenticateToken = (req, res, next) => { /* ... */ next(); };
async function sendEmail(options) { /* ... */ }

// --- Auth Routes ---
app.post('/api/auth/signup', async (req, res) => {
    const requestedEmail = req.body.email || 'unknown_email_in_request';
    console.log(`[Signup - ${requestedEmail}] Attempt received.`);
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        console.log(`[Signup - ${requestedEmail}] Validation Failed: Missing fields. Name: ${!!name}, Email: ${!!email}, Password: ${!!password}`);
        return res.status(400).json({ message: "Naam, email, aur password zaroori hai." });
    }
    if (password.length < 6) {
        console.log(`[Signup - ${requestedEmail}] Validation Failed: Password too short.`);
        return res.status(400).json({ message: "Password kam se kam 6 characters ka hona chahiye." });
    }

    try {
        const trimmedName = name.trim();
        const lowerCaseEmail = email.toLowerCase().trim();

        console.log(`[Signup - ${requestedEmail}] Processing with sanitized email: '${lowerCaseEmail}' and name: '${trimmedName}'`);

        console.log(`[Signup - ${lowerCaseEmail}] Step 1: Checking for existing user with email: '${lowerCaseEmail}'`);
        const existingUser = await User.findOne({ email: lowerCaseEmail });

        if (existingUser) {
            console.log(`[Signup - ${lowerCaseEmail}] RESULT of findOne: User FOUND. ID: ${existingUser._id}. Aborting registration.`);
            return res.status(400).json({ message: "Yeh email address pehle se register hai." });
        } else {
            console.log(`[Signup - ${lowerCaseEmail}] RESULT of findOne: No existing user found with email '${lowerCaseEmail}'. Proceeding to create new user.`);
        }

        console.log(`[Signup - ${lowerCaseEmail}] Step 2: Hashing password.`);
        const hashedPassword = await bcrypt.hash(password, 12);

        console.log(`[Signup - ${lowerCaseEmail}] Step 3: Generating avatar URL for name: ${trimmedName}`);
        const userAvatar = getGenericAvatarUrl(trimmedName);

        console.log(`[Signup - ${lowerCaseEmail}] Step 4: Creating new user object instance.`);
        const newUser = new User({
            name: trimmedName,
            email: lowerCaseEmail,
            password: hashedPassword,
            avatarUrl: userAvatar,
            loginMethod: 'email'
        });
        console.log(`[Signup - ${lowerCaseEmail}] Step 5: Attempting to save new user. Data before save:`, JSON.stringify(newUser.toObject()));
        await newUser.save();
        console.log(`[Signup - ${lowerCaseEmail}] User saved successfully. New User ID: ${newUser._id}`);

        const userForToken = { userId: newUser._id, name: newUser.name, email: newUser.email, avatarUrl: newUser.avatarUrl, loginMethod: 'email' };
        console.log(`[Signup - ${lowerCaseEmail}] Step 6: Generating JWT token.`);
        const appToken = jwt.sign(userForToken, JWT_SECRET, { expiresIn: '7d' });

        console.log(`[Signup - ${lowerCaseEmail}] Signup process completed successfully.`);
        res.status(201).json({ token: appToken, user: userForToken });

    } catch (error) {
        console.error(`[Signup - ${requestedEmail}] Critical error during signup process:`, error);
        let errorMessageDetail = 'Server par account banane mein ek anjaan samasya aa gayi.';
        let statusCode = 500;

        if (error.name === 'ValidationError') {
            statusCode = 400;
            const messages = Object.values(error.errors).map(e => e.message);
            errorMessageDetail = `Validation failed: ${messages.join('. ')}`;
            console.error(`[Signup - ${requestedEmail}] Mongoose Validation Error: ${errorMessageDetail}`);
        } else if (error.message === 'Yeh email address pehle se register hai (duplicate key).') {
            statusCode = 400;
            errorMessageDetail = error.message;
            console.error(`[Signup - ${requestedEmail}] Duplicate email error (from post-save hook or direct code 11000): ${errorMessageDetail}`);
        } else if (error.code === 11000) {
            statusCode = 400;
            errorMessageDetail = "Yeh email address pehle se register hai (MongoDB error code 11000).";
            console.error(`[Signup - ${requestedEmail}] MongoDB Duplicate Key Error (Code 11000):`, error.keyValue);
        } else if (error.message) {
            errorMessageDetail = error.message;
        }
        
        console.error(`[Signup - ${requestedEmail}] Error Name: ${error.name}, Error Code: ${error.code || 'N/A'}`);
        console.error(`[Signup - ${requestedEmail}] Detailed Error Stack:`, error.stack);

        res.status(statusCode).json({
            message: "Account banane mein kuch dikkat aa gayi.",
            error: errorMessageDetail
        });
    }
});

// ... (rest of the routes: /api/auth/login, /api/auth/google-signin, /api/auth/me, user profile routes, feedback routes, admin routes, fallback route, app.listen are the same as the previous version)
// Ensure all routes from the previous correct server.js are included below for completeness.

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email aur password zaroori hai." });
    try {
        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user) return res.status(401).json({ message: "Email ya password galat hai." });
        if (user.loginMethod === 'google' && !user.password) return res.status(401).json({ message: "Aapne Google se sign up kiya tha. Kripya Google se login karein." });
        if (!user.password) return res.status(401).json({ message: "Is account ke liye password set nahi hai."});

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ message: "Email ya password galat hai." });

        const userForToken = { userId: user._id, name: user.name, email: user.email, avatarUrl: user.avatarUrl, loginMethod: user.loginMethod };
        const appToken = jwt.sign(userForToken, JWT_SECRET, { expiresIn: '7d' });
        res.status(200).json({ token: appToken, user: userForToken });
    } catch (error) { console.error('Login mein error:', error); res.status(500).json({ message: "Login karne mein kuch dikkat aa gayi.", error: error.message });}
});

app.post('/api/auth/google-signin', async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: 'Google ID token nahi mila.' });
    if (!googleClient) return res.status(500).json({ message: 'Google Sign-In server par configure nahi hai.' });
    try {
        const ticket = await googleClient.verifyIdToken({ idToken: token, audience: GOOGLE_CLIENT_ID });
        const payload = ticket.getPayload();
        if (!payload) throw new Error("Google token payload nahi mila.");

        const { sub: googleId, name, email, picture: googleAvatar } = payload;
        let user = await User.findOne({ googleId });
        const lowerCaseEmail = email.toLowerCase().trim();

        if (!user) {
            user = await User.findOne({ email: lowerCaseEmail });
            if (user) {
                user.googleId = googleId;
                user.avatarUrl = googleAvatar || user.avatarUrl || getGenericAvatarUrl(name || user.name); // Ensure name is available
                user.loginMethod = 'google';
                if (!user.name && name) user.name = name.trim();
            } else {
                user = new User({
                    googleId, name: (name || "Google User").trim(), email: lowerCaseEmail,
                    avatarUrl: googleAvatar || getGenericAvatarUrl(name || "Google User"),
                    loginMethod: 'google'
                });
            }
            await user.save();
        } else {
             if (user.avatarUrl !== googleAvatar && googleAvatar) { user.avatarUrl = googleAvatar; await user.save(); }
        }
        const userForToken = { userId: user._id, name: user.name, email: user.email, avatarUrl: user.avatarUrl, loginMethod: 'google' };
        const appToken = jwt.sign(userForToken, JWT_SECRET, { expiresIn: '7d' });
        res.status(200).json({ token: appToken, user: userForToken });
    } catch (error) { console.error('Google signin mein error:', error); res.status(401).json({ message: 'Google token invalid hai ya server error.', error: error.message });}
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
    try {
        const userFromDb = await User.findById(req.user.userId).select('-password -resetPasswordToken -resetPasswordExpires');
        if (!userFromDb) {
            return res.status(404).json({ message: "User not found in database." });
        }
        const userPayload = {
            userId: userFromDb._id, name: userFromDb.name, email: userFromDb.email,
            avatarUrl: userFromDb.avatarUrl, loginMethod: userFromDb.loginMethod
        };
        res.status(200).json(userPayload);
    } catch (error) {
        console.error("Error fetching user details for /me route:", error);
        res.status(500).json({ message: "Error fetching user details.", error: error.message });
    }
});

app.post('/api/user/upload-avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'Koi image file upload nahi ki gayi.' });
    if (!CLOUDINARY_CLOUD_NAME) return res.status(500).json({message: "Cloudinary server par configure nahi hai."});

    const userMakingRequest = await User.findById(req.user.userId);
    if (!userMakingRequest) return res.status(404).json({ message: "User not found." });
    if (userMakingRequest.loginMethod === 'google') {
        return res.status(400).json({ message: 'Google login users apni profile picture Google se manage karein.' });
    }
    try {
        const stream = cloudinary.uploader.upload_stream({
            folder: `nobita_avatars`, public_id: `user_${req.user.userId}_${Date.now()}`,
            overwrite: true, invalidate: true,
            transformation: [{ width: 150, height: 150, crop: "fill", gravity: "face" }, { quality: "auto:eco" }]
        }, async (error, result) => {
            if (error) { console.error('Cloudinary upload stream error:', error); return res.status(500).json({ message: 'Cloudinary upload mein dikkat aa gayi.', error: error.message }); }
            if (!result) { console.error('Cloudinary upload stream no result:', result); return res.status(500).json({ message: 'Cloudinary upload se koi result nahi mila.'}); }


            const oldAvatarUrl = userMakingRequest.avatarUrl;
            userMakingRequest.avatarUrl = result.secure_url;
            await userMakingRequest.save();
            await Feedback.updateMany({ userId: userMakingRequest._id }, { $set: { avatarUrl: result.secure_url } });
            if (oldAvatarUrl && oldAvatarUrl.includes('cloudinary.com') && oldAvatarUrl !== result.secure_url) {
                try {
                    const publicIdWithFolder = oldAvatarUrl.substring(oldAvatarUrl.indexOf('nobita_avatars/'), oldAvatarUrl.lastIndexOf('.'));
                    if (publicIdWithFolder) await cloudinary.uploader.destroy(publicIdWithFolder);
                } catch (deleteError) { console.error("Purana Cloudinary avatar delete karte waqt error:", deleteError); }
            }
            const userForToken = { userId: userMakingRequest._id, name: userMakingRequest.name, email: userMakingRequest.email, avatarUrl: userMakingRequest.avatarUrl, loginMethod: userMakingRequest.loginMethod };
            const newAppToken = jwt.sign(userForToken, JWT_SECRET, { expiresIn: '7d' });
            res.status(200).json({ message: 'Profile picture safaltapoorvak upload aur update ho gayi!', newAvatarUrl: userMakingRequest.avatarUrl, token: newAppToken });
        });
        stream.end(req.file.buffer);
    } catch (error) {
        console.error('Avatar upload process error:', error);
        res.status(500).json({ message: 'Profile picture upload karne mein dikkat aa gayi.', error: error.message });
    }
});

app.put('/api/user/update-profile', authenticateToken, async (req, res) => {
    const { name: newName } = req.body;
    if (!newName || typeof newName !== 'string' || newName.trim() === '') {
        return res.status(400).json({ message: "Name cannot be empty." });
    }
    try {
        const user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ message: "User not found." });
        let nameChanged = false;
        const trimmedNewName = newName.trim();
        if (user.name !== trimmedNewName) {
            user.name = trimmedNewName;
            nameChanged = true;
        }
        if (nameChanged && user.loginMethod === 'email' && (!user.avatarUrl || !user.avatarUrl.includes('cloudinary.com'))) {
            user.avatarUrl = getGenericAvatarUrl(user.name);
        }
        if (nameChanged) {
            await user.save();
            const feedbackUpdateFields = { name: user.name };
            if (user.loginMethod === 'email' && (!req.user.avatarUrl || !req.user.avatarUrl.includes('cloudinary.com'))) {
                 feedbackUpdateFields.avatarUrl = user.avatarUrl;
            }
            await Feedback.updateMany({ userId: user._id }, { $set: feedbackUpdateFields });
        }
        const userForToken = { userId: user._id, name: user.name, email: user.email, avatarUrl: user.avatarUrl, loginMethod: user.loginMethod };
        const appToken = jwt.sign(userForToken, JWT_SECRET, { expiresIn: '7d' });
        res.status(200).json({ message: 'Profile updated successfully!', user: userForToken, token: appToken });
    } catch (error) {
        console.error("Error updating profile:", error);
        res.status(500).json({ message: "Profile update karne mein error.", error: error.message });
    }
});

app.post('/api/user/change-password', authenticateToken, async (req, res) => {
    const { currentPassword, newPassword, confirmNewPassword } = req.body;
    if (!currentPassword || !newPassword || !confirmNewPassword) return res.status(400).json({ message: "Saare password fields zaroori hain." });
    if (newPassword.length < 6) return res.status(400).json({ message: "Naya password kam se kam 6 characters ka hona chahiye." });
    if (newPassword !== confirmNewPassword) return res.status(400).json({ message: "Naye passwords match nahi ho rahe." });

    try {
        const user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ message: "User nahi mila." });
        if (user.loginMethod === 'google') return res.status(400).json({ message: "Google users apna password Google se manage karein." });
        if (!user.password) {
             console.warn(`User ${user.email} (email login) has no password set. Allowing password set without current password check.`);
        } else {
            const isMatch = await bcrypt.compare(currentPassword, user.password);
            if (!isMatch) return res.status(401).json({ message: "Aapka current password galat hai." });
        }
        if (user.password && await bcrypt.compare(newPassword, user.password)) { // Check if new is same as old only if old exists
            return res.status(400).json({ message: "Naya password current password jaisa nahi ho sakta." });
        }
        user.password = await bcrypt.hash(newPassword, 12);
        await user.save();
        try {
            await sendEmail({
                email: user.email, subject: 'Aapka Password Safaltapoorvak Change Ho Gaya Hai - Nobita Feedback',
                message: `Namaste ${user.name},\n\nAapka password Nobita Feedback App par safaltapoorvak change ho gaya hai...\n\nDhanyawad,\nNobita Feedback App Team`,
                html: `<p>Namaste ${user.name},</p><p>Aapka password Nobita Feedback App par safaltapoorvak change ho gaya hai...</p><hr><p>Dhanyawad,<br/>Nobita Feedback App Team</p>`
            });
        } catch (emailError) { console.error("Password change confirmation email bhejne mein error:", emailError); }
        res.status(200).json({ message: "Aapka password safaltapoorvak change ho gaya hai.", reloginRequired: false });
    } catch (error) {
        console.error('Password change mein error:', error);
        res.status(500).json({ message: "Password change karne mein kuch dikkat aa gayi.", error: error.message });
    }
});

app.post('/api/auth/request-password-reset', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email address zaroori hai." });
    if (!FRONTEND_URL) { console.error("CRITICAL: FRONTEND_URL missing."); return res.status(500).json({ message: "Server configuration error (FRONTEND_URL)." });}
    try {
        const user = await User.findOne({ email: email.toLowerCase().trim(), loginMethod: 'email' });
        if (!user) return res.status(200).json({ message: "Agar aapka email hamare system mein hai aur email/password account se juda hai, toh aapko password reset link mil jayega." });
        const resetToken = crypto.randomBytes(32).toString('hex');
        user.resetPasswordToken = resetToken; user.resetPasswordExpires = Date.now() + 3600000;
        await user.save();
        const resetPagePath = "/reset-password.html"; const resetUrl = `${FRONTEND_URL.replace(/\/$/, '')}${resetPagePath}?token=${resetToken}`;
        const textMessage = `Namaste ${user.name},\n\nAapko aapke Nobita Feedback App account ke liye password reset karne ki request mili hai...\n${resetUrl}\n\n...Dhanyawad,\nNobita Feedback App Team`;
        const htmlMessage = `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; padding: 20px; border: 1px solid #ddd; border-radius: 5px; background-color: #f9f9f9;"><h2 style="color: #6a0dad; border-bottom: 2px solid #FFD700; padding-bottom: 10px;">Password Reset Request</h2><p>Namaste ${user.name},</p><p>Aapko aapke Nobita Feedback App account ke liye password reset karne ki request mili hai.</p><p>Kripya neeche diye gaye button par click karke apna password reset karein. Yeh link <strong>1 ghante</strong> tak valid rahega:</p><p style="text-align: center; margin: 25px 0;"><a href="${resetUrl}" style="background-color: #FFD700; color: #1A1A2E !important; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; border: 1px solid #E0C000; display: inline-block;">Password Reset Karein</a></p><p style="font-size: 0.9em;">Agar button kaam na kare, toh aap is link ko apne browser mein copy-paste kar sakte hain: <a href="${resetUrl}" target="_blank" style="color: #3B82F6;">${resetUrl}</a></p><p>Agar aapne yeh request nahi ki thi, toh is email ko ignore kar dein aur aapka password nahi badlega.</p><hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;"><p style="font-size: 0.9em; color: #777;">Dhanyawad,<br/>Nobita Feedback App Team</p></div>`;
        await sendEmail({ email: user.email, subject: 'Aapka Password Reset Link (Nobita Feedback App)', message: textMessage, html: htmlMessage });
        res.status(200).json({ message: "Password reset link aapke email par bhej diya gaya hai (agar email valid hai aur email/password account se juda hai)." });
    } catch (error) { console.error('Request password reset API mein error:', error); res.status(500).json({ message: "Password reset request process karne mein kuch dikkat aa gayi hai." }); }
});

app.post('/api/auth/reset-password', async (req, res) => {
    const { token, password, confirmPassword } = req.body;
    if (!token || !password || !confirmPassword || password !== confirmPassword || password.length < 6) return res.status(400).json({ message: "Invalid input. Ensure passwords match and are at least 6 characters." });
    try {
        const user = await User.findOne({ resetPasswordToken: token, resetPasswordExpires: { $gt: Date.now() } });
        if (!user) return res.status(400).json({ message: "Password reset token invalid hai ya expire ho chuka hai." });
        user.password = await bcrypt.hash(password, 12);
        user.resetPasswordToken = undefined; user.resetPasswordExpires = undefined;
        await user.save();
        const confirmationTextMessage = `Namaste ${user.name},\n\nAapka password Nobita Feedback App par safaltapoorvak reset ho gaya hai...\nDhanyawad,\nNobita Feedback App Team`;
        const confirmationHtmlMessage = `<div style="font-family:Arial,sans-serif;..."><p>Namaste ${user.name},</p><p>Aapka password Nobita Feedback App par safaltapoorvak reset ho gaya hai...</p>...<p>Dhanyawad,<br/>Nobita Feedback App Team</p></div>`;
        try { await sendEmail({ email: user.email, subject: 'Aapka Password Safaltapoorvak Reset Ho Gaya Hai', message: confirmationTextMessage, html: confirmationHtmlMessage});
        } catch (emailError) { console.error("Password reset confirmation email bhejne mein error:", emailError); }
        res.status(200).json({ message: "Aapka password safaltapoorvak reset ho gaya hai. Ab aap naye password se login kar sakte hain." });
    } catch (error) { console.error('Reset password API mein error:', error); res.status(500).json({ message: "Password reset karne mein kuch dikkat aa gayi." });}
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/feedbacks', async (req, res) => {
    try {
        const allFeedbacks = await Feedback.find().populate({ path: 'userId', select: 'name email avatarUrl loginMethod' }).sort({ timestamp: -1 });
        res.status(200).json(allFeedbacks);
    } catch (error) { console.error("Feedbacks fetch error:", error); res.status(500).json({ message: 'Feedbacks fetch nahi ho paye.', error: error.message }); }
});

app.post('/api/feedback', authenticateToken, async (req, res) => {
    const { feedback, rating } = req.body; const userIp = req.clientIp;
    if (!req.user || !req.user.userId) return res.status(403).json({ message: "Feedback dene ke liye कृपया login karein." });
    if (!feedback || !rating || rating === '0') return res.status(400).json({ message: 'Feedback aur rating zaroori hai.' });
    try {
        const submitter = await User.findById(req.user.userId);
        if (!submitter) return res.status(404).json({ message: "Submitter user not found." });
        let feedbackData = { name: submitter.name, avatarUrl: submitter.avatarUrl, userId: submitter._id, feedback, rating: parseInt(rating), userIp, isEdited: false };
        const newFeedback = new Feedback(feedbackData); await newFeedback.save();
        const populatedFeedback = await Feedback.findById(newFeedback._id).populate({ path: 'userId', select: 'name email avatarUrl loginMethod' });
        res.status(201).json({ message: 'Aapka feedback सफलतापूर्वक jama ho gaya!', feedback: populatedFeedback });
    } catch (error) { console.error("Feedback save error:", error); res.status(500).json({ message: 'Feedback save nahi ho paya.', error: error.message }); }
});

app.put('/api/feedback/:id', authenticateToken, async (req, res) => {
    const feedbackId = req.params.id; const { feedback, rating } = req.body; const loggedInJwtUser = req.user;
    if (!feedback || !rating || rating === '0') return res.status(400).json({ message: 'Update ke liye feedback aur rating zaroori hai!' });
    try {
        const existingFeedback = await Feedback.findById(feedbackId);
        if (!existingFeedback) return res.status(404).json({ message: 'Yeh feedback ID mila nahi.' });
        if (existingFeedback.userId.toString() !== loggedInJwtUser.userId) return res.status(403).json({ message: 'Aap sirf apne diye gaye feedbacks ko hi edit kar sakte hain.' });
        const currentUserFromDb = await User.findById(loggedInJwtUser.userId);
        if (!currentUserFromDb) return res.status(404).json({ message: "Editor user account not found." });
        const contentActuallyChanged = existingFeedback.feedback !== feedback || existingFeedback.rating !== parseInt(rating) || existingFeedback.name !== currentUserFromDb.name || existingFeedback.avatarUrl !== currentUserFromDb.avatarUrl;
        if (contentActuallyChanged) {
            if (!existingFeedback.originalContent) {
                existingFeedback.originalContent = { name: existingFeedback.name, feedback: existingFeedback.feedback, rating: existingFeedback.rating, timestamp: existingFeedback.timestamp, avatarUrl: existingFeedback.avatarUrl };
            }
            existingFeedback.name = currentUserFromDb.name; existingFeedback.avatarUrl = currentUserFromDb.avatarUrl;
            existingFeedback.feedback = feedback; existingFeedback.rating = parseInt(rating);
            existingFeedback.timestamp = Date.now(); existingFeedback.isEdited = true;
        }
        await existingFeedback.save();
        const populatedFeedback = await Feedback.findById(existingFeedback._id).populate({ path: 'userId', select: 'name email avatarUrl loginMethod' });
        res.status(200).json({ message: 'Aapka feedback update ho gaya!', feedback: populatedFeedback });
    } catch (error) { console.error(`Feedback update error (ID: ${feedbackId}):`, error); res.status(500).json({ message: 'Feedback update nahi ho paya.', error: error.message }); }
});

const { ADMIN_USERNAME_ACTUAL, ADMIN_PASSWORD_ACTUAL } = (() => {
    let adminUser = process.env.ADMIN_USERNAME; let adminPass = process.env.ADMIN_PASSWORD;
    return { ADMIN_USERNAME_ACTUAL: adminUser || "admin", ADMIN_PASSWORD_ACTUAL: adminPass || "password" };
})();
const adminAuthenticate = (req, res, next) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate'); res.setHeader('Pragma', 'no-cache'); res.setHeader('Expires', '0');
    const authHeader = req.headers.authorization; if (!authHeader) { res.set('WWW-Authenticate', 'Basic realm="Admin Area"'); return res.status(401).json({ message: 'UNAUTHORIZED: AUTH HEADER MISSING.' });}
    const [scheme, credentials] = authHeader.split(' '); if (scheme !== 'Basic' || !credentials) { res.set('WWW-Authenticate', 'Basic realm="Admin Area"'); return res.status(401).json({ message: 'UNAUTHORIZED: INVALID AUTH SCHEME.' });}
    const [username, password] = Buffer.from(credentials, 'base64').toString().split(':');
    if (username === ADMIN_USERNAME_ACTUAL && password === ADMIN_PASSWORD_ACTUAL) { next(); } else { res.set('WWW-Authenticate', 'Basic realm="Admin Area"'); res.status(401).json({ message: 'UNAUTHORIZED: INVALID ADMIN CREDENTIALS.' });}
};
app.get('/admin-panel-nobita', adminAuthenticate, async (req, res) => { /* ... (same as before) ... */ });
app.delete('/api/admin/feedback/:id', adminAuthenticate, async (req, res) => { /* ... (same as before) ... */ });
app.post('/api/admin/feedback/:id/reply', adminAuthenticate, async (req, res) => { /* ... (same as before) ... */ });
app.put('/api/admin/user/:userId/change-avatar', adminAuthenticate, async (req, res) => { /* ... (same as before) ... */ });


app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({message: "API endpoint not found."});
  }
  if (req.path.toLowerCase() === '/reset-password.html') {
    return res.sendFile(path.join(__dirname, 'public', 'reset-password.html'));
  }
  if (req.path.toLowerCase() === '/create-account.html') {
    return res.sendFile(path.join(__dirname, 'public', 'create-account.html'));
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Nobita ka server port ${PORT} par chalu ho gaya hai: ${FRONTEND_URL.startsWith('http://localhost') ? `http://localhost:${PORT}`: FRONTEND_URL }`);
});