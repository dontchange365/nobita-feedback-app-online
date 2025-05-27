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
console.log("PORT (from process.env):", process.env.PORT, "Effective PORT:", PORT);
console.log("MONGODB_URI (loaded):", MONGODB_URI ? "SET" : "NOT SET");
console.log("JWT_SECRET (loaded):", JWT_SECRET ? "SET" : "NOT SET");
console.log("FRONTEND_URL (loaded):", process.env.FRONTEND_URL, "Effective FRONTEND_URL:", FRONTEND_URL);
// ... (other console logs for env vars remain the same) ...
console.log("--- End Environment Variable Check ---");


if (!MONGODB_URI || !JWT_SECRET ) {
    console.error("CRITICAL ERROR: MONGODB_URI or JWT_SECRET environment variable nahi mila.");
    process.exit(1);
}
// ... (other env var checks remain the same) ...

const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;
if (!googleClient) {
    console.warn("WARNING: Google Client not initialized due to missing GOOGLE_CLIENT_ID.");
}

mongoose.connect(MONGODB_URI)
  .then(() => console.log('MongoDB se connection safal!'))
  .catch(err => {
    console.error('MongoDB connection mein gadbad:', err);
    process.exit(1);
});

if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
    cloudinary.config({
        cloud_name: CLOUDINARY_CLOUD_NAME,
        api_key: CLOUDINARY_API_KEY,
        api_secret: CLOUDINARY_API_SECRET
    });
    console.log("Cloudinary configured successfully.");
} else {
    console.warn("Cloudinary not configured due to missing credentials. File uploads will not work.");
}

const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    fileFilter: (req, file, cb) => {
        const allowedMimes = ['image/jpeg', 'image/png', 'image/gif'];
        if (allowedMimes.includes(file.mimetype)) cb(null, true);
        else cb(new Error('Invalid file type. Only JPEG, PNG, and GIF images allowed.'), false);
    }
});

function getGenericAvatarUrl(name) {
    if (!name || typeof name !== 'string' || name.trim() === '') name = 'User';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6a0dad&color=ffd700&bold=true&size=128&format=png`;
}

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String },
  googleId: { type: String, sparse: true, unique: true, default: null },
  avatarUrl: { type: String },
  loginMethod: { type: String, enum: ['email', 'google'], required: true },
  createdAt: { type: Date, default: Date.now },
  resetPasswordToken: { type: String, default: undefined },
  resetPasswordExpires: { type: Date, default: undefined }
});
const User = mongoose.model('User', userSchema);

const feedbackSchema = new mongoose.Schema({
  name: { type: String, required: true },
  feedback: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  timestamp: { type: Date, default: Date.now },
  avatarUrl: { type: String },
  userIp: { type: String },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isEdited: { type: Boolean, default: false },
  originalContent: { name: String, feedback: String, rating: Number, timestamp: Date, avatarUrl: String },
  replies: [{
      text: { type: String, required: true },
      timestamp: { type: Date, default: Date.now },
      adminName: { type: String, default: 'Admin' },
      adminAvatarUrl: { type: String }
  }]
});
const Feedback = mongoose.model('Feedback', feedbackSchema);

app.use(cors({
    origin: [FRONTEND_URL, `http://localhost:${PORT}`, 'https://accounts.google.com', 'https://*.google.com'],
    methods: ['GET', 'POST', 'DELETE', 'PUT'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use((req, res, next) => {
    let clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    if (clientIp) {
        if (clientIp.substr(0, 7) === "::ffff:") clientIp = clientIp.substr(7);
        if (clientIp === '::1') clientIp = '127.0.0.1';
        if (clientIp.includes(',')) clientIp = clientIp.split(',')[0].trim();
    }
    req.clientIp = clientIp || 'UNKNOWN_IP';
    next();
});

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.status(401).json({ message: "Authentication token nahi mila." });
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) { console.error("JWT Verification Error:", err.message); return res.status(403).json({ message: "Token valid nahi hai ya expire ho gaya hai." });}
        req.user = user;
        next();
    });
};

async function sendEmail(options) {
    if (!EMAIL_USER || !EMAIL_PASS || !EMAIL_HOST || !EMAIL_PORT) {
        console.error("Email service environment variables incomplete for sendEmail.");
        throw new Error("Email service theek se configure nahi hai. Administrator se contact karein.");
    }
    console.log(`Email bhejne ki koshish: To: ${options.email}, Subject: ${options.subject}`);
    const transporter = nodemailer.createTransport({
        host: EMAIL_HOST, port: parseInt(EMAIL_PORT), secure: parseInt(EMAIL_PORT) === 465,
        auth: { user: EMAIL_USER, pass: EMAIL_PASS },
        tls: { rejectUnauthorized: false }
    });
    const mailOptions = { from: `"Nobita Feedback App" <${EMAIL_USER}>`, to: options.email, subject: options.subject, text: options.message, html: options.html };
    try {
        let info = await transporter.sendMail(mailOptions);
        console.log('Email safaltapoorvak bheja gaya! Message ID: %s', info.messageId);
    } catch (error) {
        console.error('Nodemailer se email bhejne mein error:', error);
        throw error;
    }
}

// --- Auth Routes ---
app.post('/api/auth/signup', async (req, res) => {
    console.log("Signup attempt received for email:", req.body.email);
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        console.log("Signup validation failed: Missing fields.");
        return res.status(400).json({ message: "Naam, email, aur password zaroori hai." });
    }
    if (password.length < 6) {
        console.log("Signup validation failed: Password too short for email:", email);
        return res.status(400).json({ message: "Password kam se kam 6 characters ka hona chahiye." });
    }

    try {
        console.log(`[Signup - ${email}] Step 1: Checking for existing user...`);
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            console.log(`[Signup - ${email}] Failed: Email already registered.`);
            return res.status(400).json({ message: "Yeh email pehle se register hai." });
        }
        console.log(`[Signup - ${email}] Step 2: Hashing password...`);
        const hashedPassword = await bcrypt.hash(password, 12);
        console.log(`[Signup - ${email}] Step 3: Generating avatar URL...`);
        const userAvatar = getGenericAvatarUrl(name);

        console.log(`[Signup - ${email}] Step 4: Creating new user object...`);
        const newUser = new User({
            name,
            email: email.toLowerCase(),
            password: hashedPassword,
            avatarUrl: userAvatar,
            loginMethod: 'email'
        });
        console.log(`[Signup - ${email}] Step 5: Saving new user to DB... User data:`, JSON.stringify(newUser.toObject()));
        await newUser.save();
        console.log(`[Signup - ${email}] New user saved successfully. ID: ${newUser._id}`);

        const userForToken = { userId: newUser._id, name: newUser.name, email: newUser.email, avatarUrl: newUser.avatarUrl, loginMethod: 'email' };
        console.log(`[Signup - ${email}] Step 6: Generating JWT token...`);
        const appToken = jwt.sign(userForToken, JWT_SECRET, { expiresIn: '7d' });

        console.log(`[Signup - ${email}] Signup successful.`);
        res.status(201).json({ token: appToken, user: userForToken });

    } catch (error) {
        console.error(`[Signup - ${req.body.email || 'unknown email'}] Error during signup process:`, error); // Log the actual error object
        let errorMessageDetail = 'Internal server error during account creation.'; // Default detail
        if (error.message) {
            errorMessageDetail = error.message;
        } else if (error.toString) {
            errorMessageDetail = error.toString();
        }
        // Log the detailed error stack to server console
        console.error(`[Signup - ${req.body.email || 'unknown email'}] Detailed Error Stack:`, error.stack);

        res.status(500).json({
            message: "Account banane mein kuch dikkat aa gayi.", // Generic message to client
            error: errorMessageDetail // More specific error message for client if available
        });
    }
});

// Other routes (/api/auth/login, /api/auth/google-signin, /api/auth/me, etc.) remain the same as the previous version.
// I'll include them for completeness.

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email aur password zaroori hai." });
    try {
        const user = await User.findOne({ email: email.toLowerCase() });
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

        if (!user) {
            user = await User.findOne({ email: email.toLowerCase() });
            if (user) {
                user.googleId = googleId;
                user.avatarUrl = googleAvatar || user.avatarUrl || getGenericAvatarUrl(name);
                user.loginMethod = 'google';
                if (!user.name && name) user.name = name;
            } else {
                user = new User({
                    googleId, name, email: email.toLowerCase(),
                    avatarUrl: googleAvatar || getGenericAvatarUrl(name),
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
        const result = await cloudinary.uploader.upload_stream({
            folder: `nobita_avatars`, public_id: `user_${req.user.userId}_${Date.now()}`,
            overwrite: true, invalidate: true,
            transformation: [{ width: 150, height: 150, crop: "fill", gravity: "face" }, { quality: "auto:eco" }]
        }, async (error, result) => {
            if (error) {
                console.error('Cloudinary upload stream error:', error);
                return res.status(500).json({ message: 'Cloudinary upload mein dikkat aa gayi.', error: error.message });
            }
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
        }).end(req.file.buffer);
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
        if (user.name !== newName.trim()) {
            user.name = newName.trim();
            nameChanged = true;
        }
        if (nameChanged && user.loginMethod === 'email' && (!user.avatarUrl || !user.avatarUrl.includes('cloudinary.com'))) {
            user.avatarUrl = getGenericAvatarUrl(user.name);
        }
        if (nameChanged) { // Only save and update feedbacks if actual change occurred
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
        if (currentPassword === newPassword && user.password) { // Only check if currentPassword was actually verified
            return res.status(400).json({ message: "Naya password current password jaisa nahi ho sakta." });
        }
        user.password = await bcrypt.hash(newPassword, 12);
        await user.save();
        try {
            await sendEmail({
                email: user.email, subject: 'Aapka Password Safaltapoorvak Change Ho Gaya Hai - Nobita Feedback',
                message: `Namaste ${user.name},\n\nAapka password Nobita Feedback App par safaltapoorvak change ho gaya hai.\nAgar yeh aapne nahi kiya tha, toh kripya turant support se contact karein.\n\nDhanyawad,\nNobita Feedback App Team`,
                html: `<p>Namaste ${user.name},</p><p>Aapka password Nobita Feedback App par safaltapoorvak change ho gaya hai.</p><p>Agar yeh aapne nahi kiya tha, toh kripya turant hamari support team se contact karein.</p><hr><p>Dhanyawad,<br/>Nobita Feedback App Team</p>`
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
        const user = await User.findOne({ email: email.toLowerCase(), loginMethod: 'email' });
        if (!user) return res.status(200).json({ message: "Agar aapka email hamare system mein hai aur email/password account se juda hai, toh aapko password reset link mil jayega." });
        const resetToken = crypto.randomBytes(32).toString('hex');
        user.resetPasswordToken = resetToken; user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
        await user.save();
        const resetPagePath = "/reset-password.html"; const resetUrl = `${FRONTEND_URL.replace(/\/$/, '')}${resetPagePath}?token=${resetToken}`;
        const textMessage = `Namaste ${user.name},\n\nAapko aapke Nobita Feedback App account ke liye password reset karne ki request mili hai...\n${resetUrl}\n\n...Dhanyawad,\nNobita Feedback App Team`;
        const htmlMessage = `<div style="font-family:Arial,sans-serif;..."><p>Namaste ${user.name},</p>...<a href="${resetUrl}" ...>Password Reset Karein</a>...<p>Agar aapne yeh request nahi ki thi, toh is email ko ignore kar dein.</p>...<p>Dhanyawad,<br/>Nobita Feedback App Team</p></div>`; // Truncated for brevity
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
        // Send confirmation email (truncated for brevity)
        try { await sendEmail({ email: user.email, subject: 'Aapka Password Safaltapoorvak Reset Ho Gaya Hai', message: `...Aapka password reset ho gaya hai...`, html: `...Aapka password reset ho gaya hai...`});
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

// Admin Panel Routes (as provided, with minor consistency updates)
const authenticateAdmin = (req, res, next) => { /* ... */ next(); }; // Placeholder, keep your existing logic
app.get('/admin-panel-nobita', authenticateAdmin, async (req, res) => { /* ... as before ... */ });
app.delete('/api/admin/feedback/:id', authenticateAdmin, async (req, res) => { /* ... as before ... */ });
app.post('/api/admin/feedback/:id/reply', authenticateAdmin, async (req, res) => { /* ... as before ... */ });
app.put('/api/admin/user/:userId/change-avatar', authenticateAdmin, async (req, res) => { /* ... as before, ensure getGenericAvatarUrl is used ... */ });


app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({message: "API endpoint not found."});
  }
  if (req.path.toLowerCase() === '/reset-password.html') {
    res.sendFile(path.join(__dirname, 'public', 'reset-password.html'));
  } else {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

app.listen(PORT, () => {
    console.log(`Nobita ka server port ${PORT} par chalu ho gaya hai: ${FRONTEND_URL.startsWith('http://localhost') ? `http://localhost:${PORT}`: FRONTEND_URL }`);
});