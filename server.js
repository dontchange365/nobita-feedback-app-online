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
const cloudinary = require('cloudinary').v2; // Cloudinary
const multer = require('multer'); // Multer for file uploads

dotenv.config(); // This is for local .env file, Render will ignore it

const app = express();
const PORT = process.env.PORT || 3000; // Default to 3000 if not set

// Load from .env (On Render, these will come from the dashboard)
const MONGODB_URI = process.env.MONGODB_URI;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const JWT_SECRET = process.env.JWT_SECRET;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_HOST = process.env.EMAIL_HOST;
const EMAIL_PORT = process.env.EMAIL_PORT;
const FRONTEND_URL = process.env.FRONTEND_URL;

// Cloudinary Configuration
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET
});

// --- Debugging Environment Variables ---
console.log("--- Environment Variable Check (server.js start) ---");
console.log("PORT (from process.env):", process.env.PORT);
console.log("MONGODB_URI (loaded):", MONGODB_URI ? "SET" : "NOT SET");
console.log("JWT_SECRET (loaded):", JWT_SECRET ? "SET" : "NOT SET");
console.log("FRONTEND_URL (loaded):", FRONTEND_URL ? "SET" : "NOT SET");
// ... (other console logs for env vars)
console.log("--- End Environment Variable Check ---");

// Critical environment variables check
if (!MONGODB_URI || !JWT_SECRET || !FRONTEND_URL) {
    console.error("CRITICAL ERROR: MONGODB_URI, JWT_SECRET, or FRONTEND_URL environment variable not found.");
    process.exit(1);
}
// ... (other warnings for missing env vars)


const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => console.log('MongoDB connection successful!'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
});

// Function to generate DiceBear avatar URL
function getDiceBearAvatarUrl(name, randomSeed = '') {
    const seedName = (typeof name === 'string' && name) ? name.toLowerCase() : 'default_seed';
    const seed = encodeURIComponent(seedName + randomSeed);
    return `https://api.dicebear.com/8.x/adventurer/svg?seed=${seed}&flip=true&radius=50&doodle=true&scale=90`;
}

// Mongoose Schemas
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String }, // Optional for Google users
  googleId: { type: String, sparse: true, unique: true },
  avatarUrl: { type: String },
  loginMethod: { type: String, enum: ['email', 'google'], required: true },
  createdAt: { type: Date, default: Date.now },
  resetPasswordToken: { type: String, default: undefined },
  resetPasswordExpires: { type: Date, default: undefined },
  isVerified: { type: Boolean, default: false },
  emailVerificationToken: { type: String, default: undefined },
  emailVerificationExpires: { type: Date, default: undefined }
});
const User = mongoose.model('User', userSchema);

const feedbackSchema = new mongoose.Schema({
  name: { type: String, required: true }, // Name of the submitter (guest or registered user's name at time of submission)
  feedback: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  timestamp: { type: Date, default: Date.now },
  avatarUrl: { type: String }, // Avatar of the submitter (guest or registered user's avatar at time of submission)
  userIp: { type: String },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // Null for guests, or if user is deleted
  guestId: { type: String, index: true, sparse: true, default: null }, // For tracking guest activity before registration
  googleIdSubmitter: { type: String, sparse: true }, // Legacy field
  isEdited: { type: Boolean, default: false },
  originalContent: { name: String, feedback: String, rating: Number, timestamp: Date },
  replies: [{ text: { type: String, required: true }, timestamp: { type: Date, default: Date.now }, adminName: { type: String, default: 'Admin' } }],
  isPinned: { type: Boolean, default: false }
});
const Feedback = mongoose.model('Feedback', feedbackSchema);

// Middleware Setup
app.use(cors({
    origin: [FRONTEND_URL, `http://localhost:${PORT}`, `http://localhost:3001`], // Added 3001 if you test frontend from there
    methods: ['GET', 'POST', 'DELETE', 'PUT'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Custom middleware to get client IP address
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

// Middleware to authenticate JWT token (used by protected routes)
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.status(401).json({ message: "Authentication token not found." });
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error("JWT Verification Error:", err.message);
            return res.status(403).json({ message: "Invalid or expired token. Please log in again." });
        }
        req.user = { ...user, isVerified: user.isVerified };
        next();
    });
};

// Middleware to check if email is verified (used by protected routes that require verification)
const isEmailVerified = async (req, res, next) => {
    if (!req.user || !req.user.userId) {
        return res.status(401).json({ message: "Authentication required." });
    }
    try {
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }
        if (user.loginMethod === 'google' || user.isVerified) {
            next();
        } else {
            return res.status(403).json({ message: "Email not verified. Please verify your email to perform this action." });
        }
    } catch (error) {
        console.error("isEmailVerified middleware error:", error);
        res.status(500).json({ message: "Server error while checking email verification status." });
    }
};

// Function to send emails
async function sendEmail(options) {
    if (!EMAIL_USER || !EMAIL_PASS || !EMAIL_HOST || !EMAIL_PORT) {
        console.error("Email service environment variables (EMAIL_USER, EMAIL_PASS, EMAIL_HOST, EMAIL_PORT) are not fully set.");
        throw new Error("Email service is not properly configured. Please contact the administrator.");
    }
    console.log(`Attempting to send email: To: ${options.email}, Subject: ${options.subject} (Host: ${EMAIL_HOST})`);
    const transporter = nodemailer.createTransport({
        host: EMAIL_HOST, port: parseInt(EMAIL_PORT), secure: parseInt(EMAIL_PORT) === 465,
        auth: { user: EMAIL_USER, pass: EMAIL_PASS },
    });
    const mailOptions = { from: `"Nobita Feedback App" <${EMAIL_USER}>`, to: options.email, subject: options.subject, text: options.message, html: options.html };
    try {
        let info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully! Message ID: %s', info.messageId);
    } catch (error) {
        console.error('Error sending email with Nodemailer:', error);
        if(error.responseCode === 535 || (error.command && error.command === 'AUTH LOGIN')) {
            console.error("SMTP Authentication Error: Username/Password might be incorrect or Gmail 'less secure app access'/'App Password' is required.");
        }
        throw error;
    }
}

// --- Auth Routes ---
app.post('/api/auth/signup', async (req, res) => {
    const { name, email, password, linkGuestId } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: "Name, email, and password are required." });
    if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters long." });

    try {
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) return res.status(400).json({ message: "This email is already registered." });

        const hashedPassword = await bcrypt.hash(password, 12);
        const userAvatar = getDiceBearAvatarUrl(name, Date.now().toString());
        
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const newUser = new User({
            name, email: email.toLowerCase(), password: hashedPassword,
            avatarUrl: userAvatar, loginMethod: 'email', isVerified: false,
            emailVerificationToken: verificationToken,
            emailVerificationExpires: Date.now() + 10 * 60 * 1000 // 10 minutes expiry
        });
        await newUser.save();

        if (linkGuestId) {
            console.log(`Attempting to link guest ID ${linkGuestId} to new user ${newUser._id}`);
            const updateResult = await Feedback.updateMany(
                { guestId: linkGuestId, userId: null }, 
                { 
                    $set: { 
                        userId: newUser._id, 
                        name: newUser.name,
                        avatarUrl: newUser.avatarUrl,
                        guestId: null
                    } 
                }
            );
            console.log(`Feedbacks updated for guest ID linking: ${updateResult.modifiedCount} modified.`);
        }

        const verifyPagePath = "/verify-email.html";
        const verifyUrl = `${FRONTEND_URL}${verifyPagePath}?token=${verificationToken}`;
        const emailSubject = 'Nobita Feedback App: Email Verification';
        const emailText = `Hello ${newUser.name},\n\nPlease click the link to verify your email:\n${verifyUrl}\n\nThank you,\nNobita Feedback App Team`;
        const emailHtml = `<p>Hello ${newUser.name},</p><p>Please click <a href="${verifyUrl}">here</a> to verify your email.</p>`;
        
        try {
            await sendEmail({ email: newUser.email, subject: emailSubject, message: emailText, html: emailHtml });
        } catch (emailError) {
            console.error("Error sending verification email:", emailError.message);
        }

        const userForToken = { userId: newUser._id, name: newUser.name, email: newUser.email, avatarUrl: newUser.avatarUrl, loginMethod: 'email', isVerified: newUser.isVerified };
        const appToken = jwt.sign(userForToken, JWT_SECRET, { expiresIn: '7d' });
        let responseMessage = "Account created successfully. Please verify your email.";

        res.status(201).json({ token: appToken, user: userForToken, message: responseMessage });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ message: "Something went wrong while creating the account.", error: error.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email and password are required." });
    try {
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) return res.status(401).json({ message: "Invalid email or password." });
        if (user.loginMethod === 'google' && !user.password) return res.status(401).json({ message: "You signed up with Google. Please log in with Google." });
        if (!user.password) return res.status(401).json({ message: "Invalid login credentials." });
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ message: "Invalid email or password." });
        const userForToken = { userId: user._id, name: user.name, email: user.email, avatarUrl: user.avatarUrl, loginMethod: user.loginMethod, isVerified: user.isVerified };
        const appToken = jwt.sign(userForToken, JWT_SECRET, { expiresIn: '7d' });
        res.status(200).json({ token: appToken, user: userForToken });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: "Something went wrong while logging in.", error: error.message });
    }
});

app.post('/api/auth/google-signin', async (req, res) => {
    const { token, linkGuestId } = req.body;
    if (!token) return res.status(400).json({ message: 'Google ID token not found.' });
    try {
        const ticket = await googleClient.verifyIdToken({ idToken: token, audience: GOOGLE_CLIENT_ID });
        const payload = ticket.getPayload();
        if (!payload) throw new Error("Google token payload not found.");
        const { sub: googleId, name, email, picture: googleAvatar } = payload;

        let user = await User.findOne({ googleId });
        if (!user) {
            user = await User.findOne({ email: email.toLowerCase() });
            if (user) {
                if (user.loginMethod === 'email') {
                    user.googleId = googleId;
                    user.avatarUrl = googleAvatar || user.avatarUrl;
                    user.isVerified = true;
                    user.emailVerificationToken = undefined;
                    user.emailVerificationExpires = undefined;
                }
            } else {
                user = new User({
                    googleId, name, email: email.toLowerCase(),
                    avatarUrl: googleAvatar || getDiceBearAvatarUrl(name),
                    loginMethod: 'google', isVerified: true
                });
            }
            await user.save();
        } else {
            if (user.avatarUrl !== googleAvatar && googleAvatar) { user.avatarUrl = googleAvatar; await user.save(); }
            if (!user.isVerified) { user.isVerified = true; await user.save(); }
        }

        if (linkGuestId) {
            console.log(`Attempting to link guest ID ${linkGuestId} to Google user ${user._id}`);
            const updateResult = await Feedback.updateMany(
                { guestId: linkGuestId, userId: null },
                { 
                    $set: { 
                        userId: user._id, 
                        name: user.name,
                        avatarUrl: user.avatarUrl,
                        guestId: null
                    } 
                }
            );
            console.log(`Feedbacks updated for guest ID linking (Google): ${updateResult.modifiedCount} modified.`);
        }

        const userForToken = { userId: user._id, name: user.name, email: user.email, avatarUrl: user.avatarUrl, loginMethod: 'google', isVerified: user.isVerified };
        const appToken = jwt.sign(userForToken, JWT_SECRET, { expiresIn: '7d' });
        res.status(200).json({ token: appToken, user: userForToken });
    } catch (error) {
        console.error('Google signin error:', error);
        res.status(401).json({ message: 'Google token invalid or verification failed.', error: error.message });
    }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
    res.status(200).json(req.user);
});

// --- Password Reset Routes ---
app.post('/api/auth/request-password-reset', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email address is required." });
    if (!FRONTEND_URL) return res.status(500).json({ message: "Server configuration error (FRONTEND_URL missing)." });
    try {
        const user = await User.findOne({ email: email.toLowerCase(), loginMethod: 'email', isVerified: true });
        if (!user) return res.status(200).json({ message: "If your email is in our system and linked to an email/password account, you will receive a password reset link." });
        const resetToken = crypto.randomBytes(32).toString('hex');
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = Date.now() + 3600000;
        await user.save();
        const resetPagePath = "/reset-password.html";
        const resetUrl = `${FRONTEND_URL}${resetPagePath}?token=${resetToken}`;
        const textMessage = `Hello ${user.name},\n\nPassword reset link:\n${resetUrl}\n\nNobita Feedback App Team`;
        const htmlMessage = `<p>Hello ${user.name},</p><p>Click <a href="${resetUrl}">here</a> to reset your password.</p>`;
        await sendEmail({ email: user.email, subject: 'Your Password Reset Link (Nobita Feedback App)', message: textMessage, html: htmlMessage });
        res.status(200).json({ message: "A password reset link has been sent to your email (if valid and linked)." });
    } catch (error) {
        console.error('Request password reset API error:', error);
        res.status(500).json({ message: "Something went wrong processing the password reset request." });
    }
});
app.post('/api/auth/reset-password', async (req, res) => {
    const { token, password, confirmPassword } = req.body;
    if (!token) return res.status(400).json({ message: "Password reset token not found." });
    if (!password || !confirmPassword || password !== confirmPassword || password.length < 6) {
        return res.status(400).json({ message: "Invalid password details." });
    }
    try {
        const user = await User.findOne({ resetPasswordToken: token, resetPasswordExpires: { $gt: Date.now() } });
        if (!user) return res.status(400).json({ message: "Password reset token is invalid or has expired." });
        user.password = await bcrypt.hash(password, 12);
        user.resetPasswordToken = undefined; user.resetPasswordExpires = undefined;
        await user.save();
        const confirmationTextMessage = `Hello ${user.name},\n\nYour password has been reset.`;
        const confirmationHtmlMessage = `<p>Hello ${user.name},</p><p>Your password has been reset.</p>`;
        try { await sendEmail({ email: user.email, subject: 'Your Password Has Been Successfully Reset', message: confirmationTextMessage, html: confirmationHtmlMessage});
        } catch (emailError) { console.error("Error sending password reset confirmation email:", emailError); }
        res.status(200).json({ message: "Your password has been successfully reset." });
    } catch (error) {
        console.error('Reset password API error:', error);
        res.status(500).json({ message: "Something went wrong while resetting the password." });
    }
});

// --- Email Verification Routes ---
app.post('/api/auth/request-email-verification', authenticateToken, async (req, res) => {
    if (!FRONTEND_URL) return res.status(500).json({ message: "Server configuration error (FRONTEND_URL missing)." });
    try {
        const user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ message: "User not found." });
        if (user.loginMethod === 'google' || user.isVerified) return res.status(200).json({ message: "Email already verified or not applicable." });
        const verificationToken = crypto.randomBytes(32).toString('hex');
        user.emailVerificationToken = verificationToken;
        user.emailVerificationExpires = Date.now() + 10 * 60 * 1000;
        await user.save();
        const verifyPagePath = "/verify-email.html";
        const verifyUrl = `${FRONTEND_URL}${verifyPagePath}?token=${verificationToken}`;
        const textMessage = `Hello ${user.name},\n\nVerify your email:\n${verifyUrl}\n\nNobita Feedback App Team`;
        const htmlMessage = `<p>Hello ${user.name},</p><p>Click <a href="${verifyUrl}">here</a> to verify your email.</p>`;
        await sendEmail({ email: user.email, subject: 'Your Email Verification Link (Nobita Feedback App)', message: textMessage, html: htmlMessage });
        res.status(200).json({ message: "Verification link has been sent to your email." });
    } catch (error) {
        console.error('Request email verification API error:', error);
        res.status(500).json({ message: "Something went wrong processing the email verification request." });
    }
});
app.post('/api/auth/verify-email', async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: "Email verification token not found." });
    try {
        const user = await User.findOne({ emailVerificationToken: token, emailVerificationExpires: { $gt: Date.now() } });
        if (!user) return res.status(400).json({ message: "Email verification token is invalid or has expired." });
        user.isVerified = true;
        user.emailVerificationToken = undefined; user.emailVerificationExpires = undefined;
        await user.save();
        const confirmationTextMessage = `Hello ${user.name},\n\nYour email has been verified.`;
        const confirmationHtmlMessage = `<p>Hello ${user.name},</p><p>Your email has been verified.</p>`;
        try { await sendEmail({ email: user.email, subject: 'Aapka Email Safaltapoorvak Verify Ho Gaya Hai!', message: confirmationTextMessage, html: confirmationHtmlMessage });
        } catch (emailError) { console.error("Error sending verification confirmation email:", emailError); }
        const userForToken = { userId: user._id, name: user.name, email: user.email, avatarUrl: user.avatarUrl, loginMethod: user.loginMethod, isVerified: user.isVerified };
        const newToken = jwt.sign(userForToken, JWT_SECRET, { expiresIn: '7d' });
        res.status(200).json({ message: "Your email has been successfully verified.", token: newToken, user: userForToken });
    } catch (error) {
        console.error('Verify email API error:', error);
        res.status(500).json({ message: "Something went wrong while verifying the email." });
    }
});

// Multer setup for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (req, file, cb) => { file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Only image files are allowed!'), false); } });

// --- User Profile Management Routes ---
app.put('/api/user/profile', authenticateToken, isEmailVerified, async (req, res) => {
    const { name, avatarUrl } = req.body; const userId = req.user.userId;
    if (!name) return res.status(400).json({ message: 'Name is required.' });
    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found.' });
        if (user.loginMethod === 'google') {
            if (name !== user.name) return res.status(400).json({ message: 'Name for Google-linked accounts cannot be changed here.' });
            if (avatarUrl && avatarUrl !== user.avatarUrl) user.avatarUrl = avatarUrl;
        } else {
            user.name = name;
            if (avatarUrl) user.avatarUrl = avatarUrl;
            else if (user.avatarUrl && user.avatarUrl.startsWith('https://api.dicebear.com') && name !== req.user.name) user.avatarUrl = getDiceBearAvatarUrl(name, Date.now().toString());
        }
        await user.save();
        if (avatarUrl || (user.loginMethod === 'email' && name !== req.user.name)) {
            await Feedback.updateMany({ userId: user._id }, { $set: { avatarUrl: user.avatarUrl, name: user.name } });
        }
        const updatedUserForToken = { userId: user._id, name: user.name, email: user.email, avatarUrl: user.avatarUrl, loginMethod: user.loginMethod, isVerified: user.isVerified };
        const newToken = jwt.sign(updatedUserForToken, JWT_SECRET, { expiresIn: '7d' });
        res.status(200).json({ message: 'Profile updated successfully!', user: updatedUserForToken, token: newToken });
    } catch (error) { console.error('Profile update error:', error); res.status(500).json({ message: 'Failed to update profile.', error: error.message }); }
});
app.post('/api/user/change-password', authenticateToken, isEmailVerified, async (req, res) => {
    const { currentPassword, newPassword } = req.body; const userId = req.user.userId;
    if (!currentPassword || !newPassword || newPassword.length < 6) return res.status(400).json({ message: 'Invalid password details.' });
    try {
        const user = await User.findById(userId);
        if (!user || user.loginMethod === 'google' || !user.password) return res.status(400).json({ message: 'Password change not applicable or user not found.' });
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) return res.status(401).json({ message: 'Incorrect current password.' });
        user.password = await bcrypt.hash(newPassword, 12);
        await user.save();
        res.status(200).json({ message: 'Password changed successfully!' });
    } catch (error) { console.error('Password change error:', error); res.status(500).json({ message: 'Failed to change password.', error: error.message }); }
});
app.post('/api/user/upload-avatar', authenticateToken, isEmailVerified, upload.single('avatar'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) return res.status(500).json({ message: 'Avatar upload service is not configured on the server.' });
    try {
        const result = await new Promise((resolve, reject) => { cloudinary.uploader.upload_stream({ folder: 'nobita_feedback_avatars', transformation: [ { width: 150, height: 150, crop: "fill", gravity: "face", radius: "max" }, { quality: "auto:eco" } ] }, (error, result) => { if (error) return reject(new Error(error.message)); if (!result || !result.secure_url) return reject(new Error('Cloudinary did not return a URL.')); resolve(result); }).end(req.file.buffer); });
        const userId = req.user.userId; const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found.' });
        user.avatarUrl = result.secure_url; await user.save();
        await Feedback.updateMany({ userId: user._id }, { $set: { avatarUrl: user.avatarUrl } });
        const updatedUserForToken = { userId: user._id, name: user.name, email: user.email, avatarUrl: user.avatarUrl, loginMethod: user.loginMethod, isVerified: user.isVerified };
        const newToken = jwt.sign(updatedUserForToken, JWT_SECRET, { expiresIn: '7d' });
        res.status(200).json({ message: 'Avatar uploaded successfully!', avatarUrl: user.avatarUrl, token: newToken });
    } catch (error) { console.error('Avatar upload route error:', error); res.status(500).json({ message: 'Error uploading avatar.', error: error.message }); }
});


// --- Static Files & Feedback Routes ---
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/feedbacks', async (req, res) => {
    try {
        const allFeedbacks = await Feedback.find()
            .populate({ path: 'userId', select: 'loginMethod isVerified email name avatarUrl' })
            .sort({ isPinned: -1, timestamp: -1 });

        res.status(200).json(allFeedbacks);
    } catch (error) {
        console.error("Error fetching feedbacks:", error);
        res.status(500).json({ message: 'Failed to fetch feedbacks.', error: error.message });
    }
});

app.post('/api/feedback', async (req, res) => {
    const { name: guestNameFromBody, guestId: guestIdFromBody, feedback, rating } = req.body;
    const userIp = req.clientIp;

    if (!feedback || !rating || rating === '0') {
        return res.status(400).json({ message: 'Feedback and rating are required.' });
    }

    let feedbackData = {
        feedback,
        rating: parseInt(rating),
        userIp,
        isEdited: false,
    };

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    try {
        if (token) {
            let decodedUserPayload;
            try {
                decodedUserPayload = jwt.verify(token, JWT_SECRET);
            } catch (jwtError) {
                console.error("JWT Verification Error on feedback submission:", jwtError.message);
                return res.status(403).json({ message: "Your session is invalid or has expired. Please log in again to submit as a registered user, or refresh and submit as a guest." });
            }

            const loggedInUser = await User.findById(decodedUserPayload.userId);

            if (!loggedInUser) {
                console.warn(`Feedback submission: User ID ${decodedUserPayload.userId} from token not found in DB.`);
                return res.status(404).json({ message: "Authenticated user not found. Please try logging in again." });
            }

            feedbackData.name = loggedInUser.name;
            feedbackData.avatarUrl = loggedInUser.avatarUrl;
            feedbackData.userId = loggedInUser._id;
            if (loggedInUser.loginMethod === 'google' && loggedInUser.googleId) {
                feedbackData.googleIdSubmitter = loggedInUser.googleId;
            }
            feedbackData.guestId = null;

        } else {
            if (!guestNameFromBody) {
                return res.status(400).json({ message: 'Name is required for guest feedback.' });
            }
            if (!guestIdFromBody) {
                console.warn('Guest feedback submission missing guestId from frontend.');
                return res.status(400).json({ message: 'Guest identifier is missing for this session.' });
            }
            feedbackData.name = guestNameFromBody;
            feedbackData.guestId = guestIdFromBody;
            feedbackData.avatarUrl = getDiceBearAvatarUrl(guestNameFromBody, guestIdFromBody);
            feedbackData.userId = null;
        }

        const newFeedback = new Feedback(feedbackData);
        await newFeedback.save();
        res.status(201).json({ message: 'Your feedback has been successfully submitted!', feedback: newFeedback });

    } catch (error) {
        console.error("Feedback save error:", error);
        if (error.name === 'ValidationError') {
             return res.status(400).json({ message: `Validation Error: ${error.message}` });
        }
        res.status(500).json({ message: 'Failed to save feedback.', error: error.message });
    }
});

app.put('/api/feedback/:id', authenticateToken, isEmailVerified, async (req, res) => {
    const feedbackId = req.params.id;
    const { feedback, rating } = req.body;
    const loggedInJwtUser = req.user;
    if (!feedback || !rating || rating === '0') return res.status(400).json({ message: 'Feedback and rating are required for update!' });
    try {
        const existingFeedback = await Feedback.findById(feedbackId);
        if (!existingFeedback) return res.status(404).json({ message: 'This feedback ID was not found.' });
        if (!existingFeedback.userId || existingFeedback.userId.toString() !== loggedInJwtUser.userId) {
            return res.status(403).json({ message: 'You can only edit your own feedbacks.' });
        }
        const currentUserFromDb = await User.findById(loggedInJwtUser.userId);
        if (!currentUserFromDb) return res.status(404).json({ message: 'User attempting to edit feedback not found.' });
        const currentNameFromDb = currentUserFromDb.name;
        const currentAvatarFromDb = currentUserFromDb.avatarUrl;
        const parsedRating = parseInt(rating);
        const contentActuallyChanged = existingFeedback.feedback !== feedback || existingFeedback.rating !== parsedRating || existingFeedback.name !== currentNameFromDb || existingFeedback.avatarUrl !== currentAvatarFromDb;
        if (contentActuallyChanged) {
            if (!existingFeedback.originalContent) { existingFeedback.originalContent = { name: existingFeedback.name, feedback: existingFeedback.feedback, rating: existingFeedback.rating, timestamp: existingFeedback.timestamp }; }
            existingFeedback.name = currentNameFromDb; existingFeedback.feedback = feedback; existingFeedback.rating = parsedRating; existingFeedback.timestamp = Date.now(); existingFeedback.isEdited = true; existingFeedback.avatarUrl = currentAvatarFromDb;
        }
        await existingFeedback.save();
        res.status(200).json({ message: 'Your feedback has been updated!', feedback: existingFeedback });
    } catch (error) { console.error(`Feedback update error (ID: ${feedbackId}):`, error); res.status(500).json({ message: 'Failed to update feedback.', error: error.message }); }
});

// --- Admin Panel Routes ---
const authenticateAdmin = (req, res, next) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate'); res.setHeader('Pragma', 'no-cache'); res.setHeader('Expires', '0');
    const authHeader = req.headers.authorization; if (!authHeader) { res.set('WWW-Authenticate', 'Basic realm="Admin Area"'); return res.status(401).json({ message: 'UNAUTHORIZED: AUTH HEADER MISSING.' }); }
    const [scheme, credentials] = authHeader.split(' '); if (scheme !== 'Basic' || !credentials) { res.set('WWW-Authenticate', 'Basic realm="Admin Area"'); return res.status(401).json({ message: 'UNAUTHORIZED: INVALID AUTH SCHEME.' }); }
    const [username, password] = Buffer.from(credentials, 'base64').toString().split(':');
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) { next(); } else { res.set('WWW-Authenticate', 'Basic realm="Admin Area"'); res.status(401).json({ message: 'UNAUTHORIZED: INVALID ADMIN CREDENTIALS.' }); }
};
app.get('/admin-panel-nobita', authenticateAdmin, async (req, res) => {
    console.log("Admin panel access attempt.");
    try {
        const feedbacks = await Feedback.find().populate({ path: 'userId', select: 'loginMethod name email isVerified' }).sort({ isPinned: -1, timestamp: -1 });
        const encodedCredentials = Buffer.from(`${ADMIN_USERNAME}:${ADMIN_PASSWORD}`).toString('base64');
        const authHeaderValue = `Basic ${encodedCredentials}`;
        const nobitaAvatarUrl = 'https://i.ibb.co/FsSs4SG/creator-avatar.png'; const blueTickPath = '/images/blue-tick.png'; const redTickPath = '/images/red-tick.png';
        let html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>ADMIN PANEL: NOBITA'S COMMAND CENTER</title><link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap" rel="stylesheet"><style>body{font-family:'Roboto',sans-serif;background:linear-gradient(135deg, #1A1A2E, #16213E);color:#E0E0E0;margin:0;padding:30px 20px;display:flex;flex-direction:column;align-items:center;min-height:100vh}h1{color:#FFD700;text-align:center;margin-bottom:40px;font-size:2.8em;text-shadow:0 0 15px rgba(255,215,0,0.5)}.main-panel-btn-container{width:100%;max-width:1200px;display:flex;justify-content:space-between;margin-bottom:20px;padding:0 10px;align-items:center;}.main-panel-btn{background-color:#007bff;color:white;padding:10px 20px;border:none;border-radius:8px;font-size:1em;font-weight:bold;cursor:pointer;transition:background-color .3s ease,transform .2s;text-decoration:none;display:inline-block;text-transform:uppercase}.main-panel-btn:hover{background-color:#0056b3;transform:translateY(-2px)}.feedback-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(350px,1fr));gap:30px;width:100%;max-width:1200px}.feedback-card{background-color:transparent;border-radius:15px;perspective:1000px;min-height:500px}.feedback-card-inner{position:relative;width:100%;height:100%;transition:transform .7s;transform-style:preserve-3d;box-shadow:0 8px 25px rgba(0,0,0,.4);border-radius:15px}.feedback-card.is-flipped .feedback-card-inner{transform:rotateY(180deg)}.feedback-card-front,.feedback-card-back{position:absolute;width:100%;height:100%;-webkit-backface-visibility:hidden;backface-visibility:hidden;background-color:#2C3E50;color:#E0E0E0;border-radius:15px;padding:25px;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;overflow-y:auto}.feedback-card-back{transform:rotateY(180deg);background-color:#34495E}.feedback-header{display:flex;align-items:center;gap:15px;margin-bottom:15px;flex-shrink:0}.feedback-avatar{width:60px;height:60px;border-radius:50%;overflow:hidden;border:3px solid #FFD700;flex-shrink:0;box-shadow:0 0 10px rgba(255,215,0,.3)}.feedback-avatar img{width:100%;height:100%;object-fit:cover}.feedback-info{flex-grow:1;display:flex;flex-direction:column;align-items:flex-start}.feedback-info h4{margin:0;font-size:1.3em;color:#FFD700;text-transform:uppercase;display:flex;align-items:center;gap:8px}.feedback-info h4 small{font-size:0.7em; color:#bbb; text-transform:none; margin-left:5px;}.feedback-info .rating{font-size:1.1em;color:#F39C12;margin-top:5px}.feedback-info .user-ip{font-size:.9em;color:#AAB7B8;margin-top:5px}.feedback-body{font-size:1em;color:#BDC3C7;line-height:1.6;margin-bottom:15px;flex-grow:1;overflow-y:auto;word-wrap:break-word}.feedback-date{font-size:.8em;color:#7F8C8D;text-align:right;margin-bottom:10px;border-top:1px solid #34495E;padding-top:10px;flex-shrink:0}.action-buttons{display:flex;gap:10px;margin-bottom:10px;flex-shrink:0}.action-buttons button,.flip-btn{flex-grow:1;padding:10px 12px;border:none;border-radius:8px;font-size:.9em;font-weight:bold;cursor:pointer;transition:background-color .3s ease,transform .2s;text-transform:uppercase}.action-buttons button:hover,.flip-btn:hover{transform:translateY(-2px)}.delete-btn{background-color:#E74C3C;color:white}.delete-btn:hover{background-color:#C0392B}.change-avatar-btn{background-color:#3498DB;color:white}.change-avatar-btn:hover{background-color:#2980B9}.change-avatar-btn:disabled{background-color:#555;cursor:not-allowed}.flip-btn{background-color:#fd7e14;color:white;margin-top:10px;flex-grow:0;width:100%}.flip-btn:hover{background-color:#e66800}.reply-section{border-top:1px solid #34495E;padding-top:15px;margin-top:10px;flex-shrink:0}.reply-section textarea{width:calc(100% - 20px);padding:10px;border:1px solid #4A6070;border-radius:8px;background-color:#34495E;color:#ECF0F1;resize:vertical;min-height:50px;margin-bottom:10px;font-size:.95em}.reply-section textarea::placeholder{color:#A9B7C0}.reply-btn{background-color:#27AE60;color:white;width:100%;padding:10px;border:none;border-radius:8px;font-weight:bold;cursor:pointer;transition:background-color .3s ease,transform .2s;text-transform:uppercase}.reply-btn:hover{background-color:#229954;transform:translateY(-2px)}.replies-display{margin-top:15px;background-color:#213042;border-radius:10px;padding:10px;border:1px solid #2C3E50;max-height:150px;overflow-y:auto}.replies-display h4{color:#85C1E9;font-size:1.1em;margin-bottom:10px;border-bottom:1px solid #34495E;padding-bottom:8px}.single-reply{border-bottom:1px solid #2C3E50;padding-bottom:10px;margin-bottom:10px;font-size:.9em;color:#D5DBDB;display:flex;align-items:flex-start;gap:10px}.single-reply:last-child{border-bottom:none;margin-bottom:0}.admin-reply-avatar-sm{width:30px;height:30px;border-radius:50%;border:2px solid #9B59B6;flex-shrink:0;object-fit:cover;box-shadow:0 0 5px rgba(155,89,182,.5)}.reply-content-wrapper{flex-grow:1;word-wrap:break-word}.reply-admin-name{font-weight:bold;color:#9B59B6;display:inline;margin-right:5px}.reply-timestamp{font-size:.75em;color:#8E9A9D;margin-left:10px}.edited-admin-tag{background-color:#5cb85c;color:white;padding:3px 8px;border-radius:5px;font-size:.75em;font-weight:bold;vertical-align:middle}.admin-modal-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.75);display:none;justify-content:center;align-items:center;z-index:2000}.admin-custom-modal{background:#222a35;padding:30px;border-radius:15px;box-shadow:0 10px 30px rgba(0,0,0,.5);text-align:center;color:#f0f0f0;width:90%;max-width:480px;border:1px solid #445}.admin-custom-modal h3{color:#FFD700;margin-top:0;margin-bottom:15px;font-size:1.8em}.admin-custom-modal p{margin-bottom:25px;font-size:1.1em;line-height:1.6;color:#ccc;word-wrap:break-word}.admin-modal-buttons button{background-color:#007bff;color:white;border:none;padding:12px 22px;border-radius:8px;cursor:pointer;font-size:1em;margin:5px;transition:background-color .3s,transform .2s;font-weight:bold}.admin-modal-buttons button:hover{transform:translateY(-2px)}#adminModalOkButton:hover{background-color:#0056b3}#adminModalConfirmButton{background-color:#28a745}#adminModalConfirmButton:hover{background-color:#1e7e34}#adminModalCancelButton{background-color:#dc3545}#adminModalCancelButton:hover{background:none;color:#dc3545}.select-all-container { display: flex; align-items: center; gap: 10px; margin-right: 20px; }.select-all-container label { font-size: 1.1em; color: #FFD700; }.select-all-container input[type="checkbox"] { width: 20px; height: 20px; cursor: pointer; }.bulk-delete-btn { background-color: #E74C3C; color: white; padding: 10px 20px; border: none; border-radius: 8px; font-size: 1em; font-weight: bold; cursor: pointer; transition: background-color .3s ease,transform .2s; text-transform: uppercase; margin-left: auto;}.feedback-checkbox { width: 20px; height: 20px; margin-left: 5px; cursor: pointer; align-self: flex-start; }@media (max-width:768px){h1{font-size:2.2em}.feedback-grid{grid-template-columns:1fr}.main-panel-btn-container{flex-direction:column; gap: 15px;}.select-all-container {margin-right: 0;}.bulk-delete-btn {width: 100%; margin-left: 0;}}</style></head><body><h1>NOBITA'S COMMAND CENTER</h1><div class="main-panel-btn-container"><div class="select-all-container"><input type="checkbox" id="selectAllCheck" onchange="toggleSelectAll(this.checked)"><label for="selectAllCheck">Select All</label></div><button class="bulk-delete-btn" onclick="tryDeleteSelectedFeedbacks()">Delete Selected</button></div><div class="feedback-grid">`;
        if (feedbacks.length === 0) html += `<p style="text-align:center;color:#7F8C8D;font-size:1.2em;grid-column:1 / -1;">No feedback received yet!</p>`;
        else { feedbacks.forEach(fb => { let userTag = '', userDisplayName = (fb.userId && fb.userId.name) ? fb.userId.name : fb.name; if (!userDisplayName) userDisplayName = 'Guest User'; let userEmailDisplay = ''; if (fb.userId && typeof fb.userId === 'object') { userEmailDisplay = fb.userId.email ? `<small>(${fb.userId.email})</small>` : ''; if (fb.userId.isVerified) userTag += `<img src="${blueTickPath}" alt="V" title="Verified" style="width:18px;height:18px;vertical-align:middle;margin-left:5px;">`; else if (fb.userId.loginMethod === 'email') userTag += `<img src="${redTickPath}" alt="NV" title="Not Verified" style="width:18px;height:18px;vertical-align:middle;margin-left:5px;">`; } else if (fb.googleIdSubmitter) userTag += `<img src="${blueTickPath}" alt="V" title="Verified (Google Legacy)" style="width:18px;height:18px;vertical-align:middle;margin-left:5px;">`; else userTag += `<img src="${redTickPath}" alt="G" title="Guest or Unknown" style="width:18px;height:18px;vertical-align:middle;margin-left:5px;">`; const pinIndicator = fb.isPinned ? ' <span title="Pinned">📌</span>' : ''; html += `<div class="feedback-card" id="card-${fb._id}"><div class="feedback-card-inner"><div class="feedback-card-front"><div class="feedback-header"><input type="checkbox" class="feedback-checkbox" value="${fb._id}"><div class="feedback-avatar"><img src="${fb.avatarUrl || getDiceBearAvatarUrl(userDisplayName, fb.guestId || (fb.userId ? fb.userId.toString() : ''))}" alt="${userDisplayName.charAt(0) || 'U'}"></div><div class="feedback-info"><h4>${userDisplayName}${pinIndicator} ${fb.isEdited ? '<span class="edited-admin-tag">E</span>' : ''} ${userTag}</h4><small style="font-size:0.7em; color:#bbb;">${userEmailDisplay.replace(/[()]/g, '')}</small><div class="rating">${'★'.repeat(fb.rating)}${'☆'.repeat(5-fb.rating)}</div><div class="user-ip">IP: ${fb.userIp||'N/A'} | UserID: ${fb.userId? (fb.userId._id?fb.userId._id.toString():fb.userId.toString()) : (fb.guestId ? `Guest (${fb.guestId.substring(0,6)}...)` : 'N/A')}</div></div></div><div class="feedback-body"><p>${fb.feedback}</p></div><div class="feedback-date">${fb.isEdited?'Edited':'Posted'}: ${new Date(fb.timestamp).toLocaleString()}${fb.isEdited&&fb.originalContent?`<br><small>Original: ${new Date(fb.originalContent.timestamp).toLocaleString()}</small>`:''}</div><div class="action-buttons"><button class="delete-btn" onclick="tryDeleteFeedback('${fb._id}')">DEL</button><button style="background-color: #17a2b8;" onclick="tryPinFeedback('${fb._id}', ${fb.isPinned})">${fb.isPinned ? 'UNPIN' : 'PIN'}</button><button class="change-avatar-btn" onclick="tryChangeAvatarForFeedback('${fb._id}')" title="Change this feedback's avatar">AV</button></div><div class="reply-section"><textarea id="reply-text-${fb._id}" placeholder="Admin reply..."></textarea><button class="reply-btn" onclick="tryPostReply('${fb._id}','reply-text-${fb._id}')">REPLY</button><div class="replies-display">${fb.replies&&fb.replies.length>0?'<h4>Replies:</h4>':''}${fb.replies.map(reply=>`<div class="single-reply"><img src="${nobitaAvatarUrl}" alt="A" class="admin-reply-avatar-sm"><div class="reply-content-wrapper"><span class="reply-admin-name">${reply.adminName}:</span> ${reply.text}<span class="reply-timestamp">(${new Date(reply.timestamp).toLocaleString()})</span></div></div>`).join('')}</div></div>${fb.isEdited&&fb.originalContent?`<button class="flip-btn" onclick="flipCard('${fb._id}')">ORIG</button>`:''}</div>`; if (fb.isEdited&&fb.originalContent) html += `<div class="feedback-card-back"><div class="feedback-header"><div class="feedback-avatar"><img src="${(fb.originalContent.avatarUrl||fb.avatarUrl)}" alt="O"></div><div class="feedback-info"><h4>ORIG: ${fb.originalContent.name}</h4><div class="rating">${'★'.repeat(fb.originalContent.rating)}${'☆'.repeat(5-fb.originalContent.rating)}</div></div></div><div class="feedback-body"><p>${fb.originalContent.feedback}</p></div><div class="feedback-date">Orig Posted: ${new Date(fb.originalContent.timestamp).toLocaleString()}</div><div style="margin-top:auto;"><button class="flip-btn" onclick="flipCard('${fb._id}')">EDITED</button></div></div>`; html += `</div></div>`; }); }
        html += `</div><div id="adminModalOverlay" class="admin-modal-overlay"><div class="admin-custom-modal"><h3 id="adminModalTitle"></h3><p id="adminModalMessage"></p><div class="admin-modal-buttons"><button id="adminModalOkButton">OK</button><button id="adminModalConfirmButton" style="display:none;">Confirm</button><button id="adminModalCancelButton" style="display:none;">Cancel</button></div></div></div><script>const AUTH_HEADER='${authHeaderValue}';if(!AUTH_HEADER||AUTH_HEADER==="Basic Og=="){console.error("CRITICAL: AUTH_HEADER missing/invalid!");showAdminModal('alert','Auth Error','Admin auth not configured. Actions fail.');}const adminModalOverlay=document.getElementById('adminModalOverlay'),adminModalTitle=document.getElementById('adminModalTitle'),adminModalMessage=document.getElementById('adminModalMessage'),adminModalOkButton=document.getElementById('adminModalOkButton'),adminModalConfirmButton=document.getElementById('adminModalConfirmButton'),adminModalCancelButton=document.getElementById('adminModalCancelButton');let globalConfirmCallback=null;function showAdminModal(t,e,o,a=null){adminModalTitle.textContent=e,adminModalMessage.textContent=o,globalConfirmCallback=a,adminModalOkButton.style.display="confirm"===t?"none":"inline-block",adminModalConfirmButton.style.display="confirm"===t?"inline-block":"none",adminModalCancelButton.style.display="confirm"===t?"inline-block":"none",adminModalOverlay.style.display="flex"}adminModalOkButton.addEventListener("click",()=>adminModalOverlay.style.display="none"),adminModalConfirmButton.addEventListener("click",()=>{adminModalOverlay.style.display="none",globalConfirmCallback&&globalConfirmCallback(!0)}),adminModalCancelButton.addEventListener("click",()=>{adminModalOverlay.style.display="none",globalConfirmCallback&&globalConfirmCallback(!1)});function flipCard(t){document.getElementById(\`card-\${t}\`).classList.toggle("is-flipped")}async function tryDeleteFeedback(t){showAdminModal("confirm","Delete Feedback?","Sure to delete? Cannot undo.",async e=>{if(e)try{const e=await fetch(\`/api/admin/feedback/\${t}\`,{method:"DELETE",headers:{Authorization:AUTH_HEADER}});if(e.ok)showAdminModal("alert","Deleted!","Feedback deleted."),setTimeout(()=>location.reload(),1e3);else{const t=await e.json();showAdminModal("alert","Error!",\`Failed to delete: \${t.message||e.statusText}\`)}}catch(t){showAdminModal("alert","Fetch Error!",\`Error: \${t.message}\`)}})}async function tryPostReply(t,e){const o=document.getElementById(e).value.trim();if(!o)return void showAdminModal("alert","Empty Reply","Write something.");showAdminModal("confirm","Post Reply?",\`Confirm: "\${o.substring(0,50)}..."\`,async e=>{if(e)try{const e=await fetch(\`/api/admin/feedback/\${t}/reply\`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:AUTH_HEADER},body:JSON.stringify({replyText:o,adminName:"👉𝙉𝙊𝘽𝙄𝙏𝘼🤟"})});if(e.ok)showAdminModal("alert","Replied!","Reply posted."),setTimeout(()=>location.reload(),1e3);else{const t=await e.json();showAdminModal("alert","Error!",\`Failed to reply: \${t.message||e.statusText}\`)}}catch(t){showAdminModal("alert","Fetch Error!",\`Error: \${t.message}\`)}})}async function tryChangeAvatarForFeedback(feedbackId){showAdminModal("confirm","Change Avatar?",\`Regenerate a new random avatar for this feedback card?\`,async confirmed=>{if(confirmed){try{const response=await fetch(\`/api/admin/feedback/\${feedbackId}/change-avatar\`,{method:'PUT',headers:{'Authorization':AUTH_HEADER}});if(response.ok){showAdminModal("alert","Avatar Changed!",\`Avatar has been updated.\`);setTimeout(()=>location.reload(),1200)}else{const errorData=await response.json();showAdminModal("alert","Error!",\`Failed to change avatar: \${errorData.message||response.statusText}\`)}}catch(error){showAdminModal("alert","Fetch Error!",\`An error occurred: \${error.message}\`)}}})}async function tryPinFeedback(feedbackId,isCurrentlyPinned){const action=isCurrentlyPinned?'Unpin':'Pin';const newPinStatus=!isCurrentlyPinned;showAdminModal("confirm",\`\${action} Feedback?\`,\`Are you sure you want to \${action.toLowerCase()} this feedback?\`,async confirmed=>{if(confirmed){try{const response=await fetch(\`/api/admin/feedback/\${feedbackId}/pin\`,{method:'PUT',headers:{'Content-Type':'application/json','Authorization':AUTH_HEADER},body:JSON.stringify({isPinned:newPinStatus})});if(response.ok){showAdminModal("alert","Success!",\`Feedback has been \${action.toLowerCase()}ned.\`);setTimeout(()=>location.reload(),1200)}else{const errorData=await response.json();showAdminModal("alert","Error!",\`Failed to \${action.toLowerCase()} feedback: \${errorData.message||response.statusText}\`)}}catch(error){showAdminModal("alert","Fetch Error!",\`An error occurred: \${error.message}\`)}}})}function toggleSelectAll(t){document.querySelectorAll(".feedback-checkbox").forEach(e=>e.checked=t)}async function tryDeleteSelectedFeedbacks(){const t=Array.from(document.querySelectorAll(".feedback-checkbox:checked")).map(t=>t.value);if(0===t.length)return void showAdminModal("alert","No Selection","Select feedback to delete.");showAdminModal("confirm","Delete Selected?",\`Delete \${t.length} selected? Cannot undo.\`,async e=>{if(e)try{const e=await fetch("/api/admin/feedbacks/batch-delete",{method:"DELETE",headers:{"Content-Type":"application/json",Authorization:AUTH_HEADER},body:JSON.stringify({ids:t})});if(e.ok)showAdminModal("alert","Deleted!",\`\${t.length} feedback(s) deleted.\`),setTimeout(()=>location.reload(),1e3);else{const t=await e.json();showAdminModal("alert","Error!",\`Failed: \${t.message||e.statusText}\`)}}catch(t){showAdminModal("alert","Fetch Error!",\`Error: \${t.message}\`)}})}</script></body></html>`;
        res.send(html);
    } catch (error) { console.error('Error generating admin panel:', error); res.status(500).send(`Admin panel issue: ${error.message}`); }
});
app.delete('/api/admin/feedback/:id', authenticateAdmin, async (req, res) => { console.log(`ADMIN DEL: ${req.params.id}`); try { const fb = await Feedback.findByIdAndDelete(req.params.id); if (!fb) return res.status(404).json({ message: 'ID not found.' }); res.status(200).json({ message: 'Deleted.' }); } catch (e) { console.error(`ADMIN DEL ERR: ${req.params.id}`, e); res.status(500).json({ message: 'Failed.', error: e.message }); } });
app.delete('/api/admin/feedbacks/batch-delete', authenticateAdmin, async (req, res) => { const { ids } = req.body; console.log(`ADMIN BATCH DEL:`, ids); if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: 'No IDs.' }); try { const r = await Feedback.deleteMany({ _id: { $in: ids } }); if (r.deletedCount === 0) return res.status(404).json({ message: 'None found.' }); res.status(200).json({ message: `${r.deletedCount} deleted.`, deletedCount: r.deletedCount }); } catch (e) { console.error(`ADMIN BATCH DEL ERR:`, e); res.status(500).json({ message: 'Failed.', error: e.message }); } });
app.post('/api/admin/feedback/:id/reply', authenticateAdmin, async (req, res) => { const fId = req.params.id; const { replyText, adminName } = req.body; console.log(`ADMIN REPLY: ${fId}, Text: ${replyText}`); if (!replyText) return res.status(400).json({ message: 'Reply text missing.' }); try { const fb = await Feedback.findById(fId); if (!fb) return res.status(404).json({ message: 'ID not found.' }); fb.replies.push({ text: replyText, adminName: adminName || 'Admin', timestamp: new Date() }); await fb.save(); res.status(200).json({ message: 'Replied.', reply: fb.replies[fb.replies.length - 1] }); } catch (e) { console.error(`ADMIN REPLY ERR: ${fId}`, e); res.status(500).json({ message: 'Failed.', error: e.message }); } });

app.put('/api/admin/feedback/:id/pin', authenticateAdmin, async (req, res) => {
    const { isPinned } = req.body;
    if (typeof isPinned !== 'boolean') {
        return res.status(400).json({ message: 'Invalid request: "isPinned" must be a boolean.' });
    }
    try {
        const feedbackToUpdate = await Feedback.findById(req.params.id);
        if (!feedbackToUpdate) {
            return res.status(404).json({ message: 'Feedback not found.' });
        }
        feedbackToUpdate.isPinned = isPinned;
        await feedbackToUpdate.save();
        console.log(`ADMIN PIN/UNPIN: Feedback ID ${req.params.id} set to isPinned: ${isPinned}`);
        res.status(200).json({ message: `Feedback ${isPinned ? 'pinned' : 'unpinned'} successfully.`, feedback: feedbackToUpdate });
    } catch (error) {
        console.error(`ADMIN PIN/UNPIN ERR: ${req.params.id}`, error);
        res.status(500).json({ message: 'Server error while updating feedback.', error: error.message });
    }
});

app.put('/api/admin/feedback/:feedbackId/change-avatar', authenticateAdmin, async (req, res) => {
    const { feedbackId } = req.params;
    console.log(`ADMIN AVATAR CHANGE FOR FEEDBACK: ${feedbackId}`);

    try {
        const feedback = await Feedback.findById(feedbackId);
        if (!feedback) {
            return res.status(404).json({ message: 'Feedback not found.' });
        }

        // Case 1: Feedback is from a REGISTERED USER (Email or Google)
        if (feedback.userId) {
            const user = await User.findById(feedback.userId);
            if (user) {
                if (!user.name) return res.status(400).json({ message: 'User name missing for avatar generation.' });
                
                const newAvatarUrl = getDiceBearAvatarUrl(user.name, Date.now().toString());
                
                user.avatarUrl = newAvatarUrl;
                await user.save();
                
                await Feedback.updateMany({ userId: user._id }, { $set: { avatarUrl: newAvatarUrl } });
                
                return res.status(200).json({ message: 'User avatar updated across all their feedbacks.', newAvatarUrl });
            }
        }

        // Case 2: Feedback is from a GUEST (or deleted user)
        if (!feedback.name) return res.status(400).json({ message: 'Guest name missing for avatar generation.' });
        
        const newGuestAvatarUrl = getDiceBearAvatarUrl(feedback.name, Date.now().toString());
        feedback.avatarUrl = newGuestAvatarUrl;
        await feedback.save();
        
        res.status(200).json({ message: 'Guest feedback avatar changed.', newAvatarUrl: newGuestAvatarUrl });

    } catch (error) {
        console.error(`ADMIN AVATAR CHANGE ERR ON FEEDBACK ${feedbackId}:`, error);
        res.status(500).json({ message: 'Failed to change avatar due to server error.', error: error.message });
    }
});


app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    res.status(404).json({message: "API endpoint not found."});
  }
});

app.listen(PORT, () => {
    console.log(`Nobita's server is running on port ${PORT}: http://localhost:${PORT}`);
});