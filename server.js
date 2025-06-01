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
const PORT = process.env.PORT || 3000;

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
console.log("ADMIN_USERNAME (loaded):", ADMIN_USERNAME ? "SET" : "NOT SET");
console.log("ADMIN_PASSWORD (loaded):", ADMIN_PASSWORD ? "SET (value hidden)" : "NOT SET");
console.log("GOOGLE_CLIENT_ID (loaded):", GOOGLE_CLIENT_ID ? "SET" : "NOT SET");
console.log("EMAIL_USER (loaded):", EMAIL_USER ? "SET" : "NOT SET");
console.log("EMAIL_PASS (loaded):", EMAIL_PASS ? "SET (value hidden)" : "NOT SET");
console.log("EMAIL_HOST (loaded):", EMAIL_HOST ? "SET" : "NOT SET");
console.log("EMAIL_PORT (loaded):", EMAIL_PORT ? "SET" : "NOT SET");
console.log("CLOUDINARY_CLOUD_NAME (loaded):", CLOUDINARY_CLOUD_NAME ? "SET" : "NOT SET");
console.log("CLOUDINARY_API_KEY (loaded):", CLOUDINARY_API_KEY ? "SET" : "NOT SET");
console.log("CLOUDINARY_API_SECRET (loaded):", CLOUDINARY_API_SECRET ? "SET (value hidden)" : "NOT SET");
console.log("--- End Environment Variable Check ---");

// Critical environment variables check
if (!MONGODB_URI || !JWT_SECRET || !FRONTEND_URL) {
    console.error("CRITICAL ERROR: MONGODB_URI, JWT_SECRET, or FRONTEND_URL environment variable not found.");
    console.error("Please check the 'Environment' section in your Render dashboard to ensure these variables are set with correct Key and Value and are not empty.");
    console.error("After saving changes, remember to manually redeploy/restart the service.");
    process.exit(1); // Stop server from starting
}
if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
    console.warn("WARNING: ADMIN_USERNAME or ADMIN_PASSWORD environment variable not found. Admin panel login will not work.");
}
if (!GOOGLE_CLIENT_ID) {
    console.warn("WARNING: GOOGLE_CLIENT_ID environment variable not found. Google Sign-In will not work.");
}
if (!EMAIL_USER || !EMAIL_PASS || !EMAIL_HOST || !EMAIL_PORT) {
    console.warn("WARNING: Email service environment variables (EMAIL_USER, EMAIL_PASS, EMAIL_HOST, EMAIL_PORT) are not fully set. Password reset email will not work.");
}
if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    console.warn("WARNING: Cloudinary environment variables are not fully set. Avatar upload will not work.");
}


const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => console.log('MongoDB connection successful!'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    console.error('Ensure MONGODB_URI environment variable is correctly set on Render and your IP is whitelisted (if necessary).');
    process.exit(1);
});

// Function to generate DiceBear avatar URL
function getDiceBearAvatarUrl(name, randomSeed = '') {
    const seedName = (typeof name === 'string' && name) ? name.toLowerCase() : 'default_seed';
    // Use a combination of name and random seed for better uniqueness
    const seed = encodeURIComponent(seedName + randomSeed);
    return `https://api.dicebear.com/8.x/adventurer/svg?seed=${seed}&flip=true&radius=50&doodle=true&scale=90`;
}

// Mongoose Schemas
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String }, // Optional for Google users
  googleId: { type: String, sparse: true, unique: true }, // sparse allows multiple nulls
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
  name: { type: String, required: true },
  feedback: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  timestamp: { type: Date, default: Date.now },
  avatarUrl: { type: String },
  userIp: { type: String },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  googleIdSubmitter: { type: String, sparse: true }, // Legacy field, consider removing if all users are linked by userId
  isEdited: { type: Boolean, default: false },
  originalContent: { name: String, feedback: String, rating: Number, timestamp: Date }, // Stores original content if feedback is edited
  replies: [{ text: { type: String, required: true }, timestamp: { type: Date, default: Date.now }, adminName: { type: String, default: 'Admin' } }]
});
const Feedback = mongoose.model('Feedback', feedbackSchema);

// Middleware Setup
app.use(cors({
    // Only allow requests from the specified frontend URL and localhost for development
    origin: [FRONTEND_URL, `http://localhost:${PORT}`],
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
        if (clientIp.includes(',')) clientIp = clientIp.split(',')[0].trim(); // Handle multiple IPs in x-forwarded-for
    }
    req.clientIp = clientIp || 'UNKNOWN_IP';
    next();
});

// Middleware to authenticate JWT token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.status(401).json({ message: "Authentication token not found." });
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error("JWT Verification Error:", err.message);
            // Provide a more generic error message for security
            return res.status(403).json({ message: "Invalid or expired token. Please log in again." });
        }
        // Include isVerified status in req.user for easier access in routes
        req.user = { ...user, isVerified: user.isVerified };
        next();
    });
};

// Middleware to check if email is verified for sensitive actions
const isEmailVerified = async (req, res, next) => {
    if (!req.user || !req.user.userId) {
        return res.status(401).json({ message: "Authentication required." });
    }
    try {
        // Fetch user from DB to get the most current isVerified status
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }
        // Google users are considered verified by default as Google handles it
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
        host: EMAIL_HOST,
        port: parseInt(EMAIL_PORT),
        secure: parseInt(EMAIL_PORT) === 465, // true for 465, false for other ports
        auth: {
            user: EMAIL_USER,
            pass: EMAIL_PASS
        },
    });
    const mailOptions = {
        from: `"Nobita Feedback App" <${EMAIL_USER}>`,
        to: options.email,
        subject: options.subject,
        text: options.message,
        html: options.html
    };
    try {
        let info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully! Message ID: %s', info.messageId);
    } catch (error) {
        console.error('Error sending email with Nodemailer:', error);
        if(error.responseCode === 535 || (error.command && error.command === 'AUTH LOGIN')) {
            console.error("SMTP Authentication Error: Username/Password might be incorrect or Gmail 'less secure app access'/'App Password' is required.");
        }
        throw error; // Re-throw to be caught by the route handler
    }
}

// --- Auth Routes ---
app.post('/api/auth/signup', async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: "Name, email, and password are required." });
    if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters long." });
    try {
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) return res.status(400).json({ message: "This email is already registered." });

        const hashedPassword = await bcrypt.hash(password, 12);
        // Generate a unique avatar for signup using current timestamp as seed
        const userAvatar = getDiceBearAvatarUrl(name, Date.now().toString());
        
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const newUser = new User({
            name,
            email: email.toLowerCase(),
            password: hashedPassword,
            avatarUrl: userAvatar,
            loginMethod: 'email',
            isVerified: false,
            emailVerificationToken: verificationToken,
            emailVerificationExpires: Date.now() + 10 * 60 * 1000 // 10 minutes expiry
        });
        await newUser.save();

        const verifyPagePath = "/verify-email.html";
        const verifyUrl = `${FRONTEND_URL}${verifyPagePath}?token=${verificationToken}`;
        const emailSubject = 'Nobita Feedback App: Email Verification';
        const emailText = `Hello ${newUser.name},\n\nYou have created an account on Nobita Feedback App. Please click the link below to verify your email:\n${verifyUrl}\n\nIf you did not request this, please ignore this email.\n\nThank you,\nNobita Feedback App Team`;
        const emailHtml = `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; padding: 20px; border: 1px solid #ddd; border-radius: 5px; background-color: #f9f9f9;"><h2 style="color: #6a0dad; border-bottom: 2px solid #FFD700; padding-bottom: 10px;">Email Verification</h2><p>Hello ${newUser.name},</p><p>You have created an account on Nobita Feedback App.</p><p>Please click the button below to verify your email. This link will be valid for <strong>10 minutes</strong>:</p><p style="text-align: center; margin: 25px 0;"><a href="${verifyUrl}" style="background-color: #FFD700; color: #1A1A2E !important; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; border: 1px solid #E0C000; display: inline-block;">Verify Email</a></p><p style="font-size: 0.9em;">If the button doesn't work, you can copy-paste this link into your browser: <a href="${verifyUrl}" target="_blank" style="color: #3B82F6;">${verifyUrl}</a></p><p>You will be able to use all app features only after your email is verified.</p><p>If you did not request this, please ignore this email.</p><hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;"><p style="font-size: 0.9em; color: #777;">Thank you,<br/>Nobita Feedback App Team</p></div>`;
        
        try {
            await sendEmail({ email: newUser.email, subject: emailSubject, message: emailText, html: emailHtml });
        } catch (emailError) {
            console.error("Error sending verification email:", emailError);
            // Do not block signup if email sending fails, but log the error
        }

        const userForToken = { userId: newUser._id, name: newUser.name, email: newUser.email, avatarUrl: newUser.avatarUrl, loginMethod: 'email', isVerified: newUser.isVerified };
        const appToken = jwt.sign(userForToken, JWT_SECRET, { expiresIn: '7d' });
        res.status(201).json({ token: appToken, user: userForToken, message: "Account created successfully. Please verify your email." });
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
        if (!user.password) return res.status(401).json({ message: "Invalid login credentials." }); // Should not happen if loginMethod is 'email'
        
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
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: 'Google ID token not found.' });
    try {
        const ticket = await googleClient.verifyIdToken({ idToken: token, audience: GOOGLE_CLIENT_ID });
        const payload = ticket.getPayload();
        if (!payload) throw new Error("Google token payload not found.");
        const { sub: googleId, name, email, picture: googleAvatar } = payload;

        let user = await User.findOne({ googleId });
        if (!user) {
            // Check if an email-based account exists with the same email
            user = await User.findOne({ email: email.toLowerCase() });
            if (user) {
                // Link existing email account to Google ID
                if (user.loginMethod === 'email') {
                    user.googleId = googleId;
                    user.avatarUrl = googleAvatar || user.avatarUrl; // Prioritize Google avatar if available
                    user.isVerified = true; // Google accounts are implicitly verified
                    user.emailVerificationToken = undefined; // Clear any pending verification tokens
                    user.emailVerificationExpires = undefined;
                }
            } else {
                // Create a new user if no existing account (email or Google) found
                user = new User({
                    googleId,
                    name,
                    email: email.toLowerCase(),
                    avatarUrl: googleAvatar || getDiceBearAvatarUrl(name), // Use Google avatar or generate DiceBear
                    loginMethod: 'google',
                    isVerified: true // Google accounts are implicitly verified
                });
            }
            await user.save();
        } else {
             // Update avatar if Google provides a new one and user is a Google user
             if (user.avatarUrl !== googleAvatar && googleAvatar) { user.avatarUrl = googleAvatar; await user.save(); }
             // Ensure Google user is marked as verified
             if (!user.isVerified) { user.isVerified = true; await user.save(); }
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
    // Returns user data from the JWT token
    res.status(200).json(req.user);
});

// --- Password Reset Routes ---
app.post('/api/auth/request-password-reset', async (req, res) => {
    const { email } = req.body;
    console.log(`Password reset request received for email: ${email}`);
    if (!email) return res.status(400).json({ message: "Email address is required." });
    if (!FRONTEND_URL) {
        console.error("CRITICAL: FRONTEND_URL is not set in .env file. Password reset link cannot be generated.");
        return res.status(500).json({ message: "Server configuration error (FRONTEND_URL missing)." });
    }
    try {
        // Only allow password reset for email-based, verified accounts
        const user = await User.findOne({ email: email.toLowerCase(), loginMethod: 'email', isVerified: true });
        if (!user) {
            console.log(`Password reset: Email "${email}" not found in system, not an email/password account, or not verified.`);
            // Send a generic success message to prevent email enumeration
            return res.status(200).json({ message: "If your email is in our system and linked to an email/password account, you will receive a password reset link." });
        }
        const resetToken = crypto.randomBytes(32).toString('hex');
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour expiry
        await user.save();
        console.log(`Password reset token for ${user.email} generated. Expiry: ${new Date(user.resetPasswordExpires).toLocaleString()}`);

        const resetPagePath = "/reset-password.html";
        const resetUrl = `${FRONTEND_URL}${resetPagePath}?token=${resetToken}`;
        console.log("Password Reset URL generated:", resetUrl);

        const textMessage = `Hello ${user.name},\n\nYou have received a password reset request for your Nobita Feedback App account.\nPlease click the link below to reset your password. This link will be valid for 1 hour:\n${resetUrl}\n\nIf you did not request this, please ignore this email.\n\nThank you,\nNobita Feedback App Team`;
        const htmlMessage = `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; padding: 20px; border: 1px solid #ddd; border-radius: 5px; background-color: #f9f9f9;"><h2 style="color: #6a0dad; border-bottom: 2px solid #FFD700; padding-bottom: 10px;">Password Reset Request</h2><p>Hello ${user.name},</p><p>You have received a password reset request for your Nobita Feedback App account.</p><p>Please click the button below to reset your password. This link will be valid for <strong>1 hour</strong>:</p><p style="text-align: center; margin: 25px 0;"><a href="${resetUrl}" style="background-color: #FFD700; color: #1A1A2E !important; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; border: 1px solid #E0C000; display: inline-block;">Reset Password</a></p><p style="font-size: 0.9em;">If the button doesn't work, you can copy-paste this link into your browser: <a href="${resetUrl}" target="_blank" style="color: #3B82F6;">${resetUrl}</a></p><p>If you did not request this, please ignore this email and your password will not be changed.</p><hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;"><p style="font-size: 0.9em; color: #777;">Thank you,<br/>Nobita Feedback App Team</p></div>`;
        await sendEmail({ email: user.email, subject: 'Your Password Reset Link (Nobita Feedback App)', message: textMessage, html: htmlMessage });
        res.status(200).json({ message: "A password reset link has been sent to your email (if the email is valid and linked to an email/password account)." });
    } catch (error) {
        console.error('Request password reset API error:', error);
        if (error.message && (error.message.includes("Email service is not properly configured") || error.message.includes("Invalid login")) || (error.code && (error.code === 'EAUTH' || error.code === 'EENVELOPE' || error.errno === -3008))) {
             res.status(500).json({ message: "There was a technical issue sending the email. Please contact the administrator or check email settings in .env." });
        } else {
             res.status(500).json({ message: "Something went wrong processing the password reset request." });
        }
    }
});

app.post('/api/auth/reset-password', async (req, res) => {
    const { token, password, confirmPassword } = req.body;
    console.log(`Password reset attempt for token: ${token ? token.substring(0,10)+'...' : 'NO TOKEN'}`);
    if (!token) return res.status(400).json({ message: "Password reset token not found." });
    if (!password || !confirmPassword) return res.status(400).json({ message: "New password and confirmation password are required." });
    if (password !== confirmPassword) return res.status(400).json({ message: "Passwords do not match." });
    if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters long." });
    try {
        const user = await User.findOne({ resetPasswordToken: token, resetPasswordExpires: { $gt: Date.now() } });
        if (!user) {
            console.log(`Password reset: Invalid or expired token "${token ? token.substring(0,10)+'...' : 'NO TOKEN'}"`);
            return res.status(400).json({ message: "Password reset token is invalid or has expired." });
        }
        
        user.password = await bcrypt.hash(password, 12);
        user.resetPasswordToken = undefined; // Clear token after use
        user.resetPasswordExpires = undefined;
        await user.save();
        console.log(`Password successfully reset for user: ${user.email}`);

        const confirmationTextMessage = `Hello ${user.name},\n\nYour password on Nobita Feedback App has been successfully reset.\n\nIf you did not do this, please contact support immediately.`;
        const confirmationHtmlMessage = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#333"><p>Hello ${user.name},</p><p>Your password on Nobita Feedback App has been successfully reset.</p><p>You can now log in with your new password.</p><p>If you did not do this, please contact our support team immediately.</p><hr><p>Thank you,<br/>Nobita Feedback App Team</p></div>`;
        try {
            await sendEmail({ email: user.email, subject: 'Your Password Has Been Successfully Reset', message: confirmationTextMessage, html: confirmationHtmlMessage});
        } catch (emailError) {
            console.error("Error sending password reset confirmation email:", emailError);
        }
        res.status(200).json({ message: "Your password has been successfully reset. You can now log in with the new password." });
    } catch (error) {
        console.error('Reset password API error:', error);
        res.status(500).json({ message: "Something went wrong while resetting the password." });
    }
});

// --- Email Verification Routes ---
app.post('/api/auth/request-email-verification', authenticateToken, async (req, res) => {
    console.log(`Email verification request received for user ID: ${req.user.userId}`);
    if (!FRONTEND_URL) {
        console.error("CRITICAL: FRONTEND_URL is not set in .env file. Verification link cannot be generated.");
        return res.status(500).json({ message: "Server configuration error (FRONTEND_URL missing)." });
    }
    try {
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }
        if (user.loginMethod === 'google') {
            return res.status(400).json({ message: "Google accounts do not require email verification." });
        }
        if (user.isVerified) {
            return res.status(200).json({ message: "Your email is already verified." });
        }

        const verificationToken = crypto.randomBytes(32).toString('hex');
        user.emailVerificationToken = verificationToken;
        user.emailVerificationExpires = Date.now() + 10 * 60 * 1000; // 10 minutes expiry
        await user.save();

        console.log(`Email verification token for ${user.email} generated. Expiry: ${new Date(user.emailVerificationExpires).toLocaleString()}`);
        const verifyPagePath = "/verify-email.html";
        const verifyUrl = `${FRONTEND_URL}${verifyPagePath}?token=${verificationToken}`;
        console.log("Email Verification URL generated:", verifyUrl);

        const textMessage = `Hello ${user.name},\n\nYou have received an email verification request for your Nobita Feedback App account.\nPlease click the link below to verify your email. This link will be valid for 10 minutes:\n${verifyUrl}\n\nIf you did not request this, please ignore this email.\n\nThank you,\nNobita Feedback App Team`;
        const htmlMessage = `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; padding: 20px; border: 1px solid #ddd; border-radius: 5px; background-color: #f9f9f9;"><h2 style="color: #6a0dad; border-bottom: 2px solid #FFD700; padding-bottom: 10px;">Email Verification Request</h2><p>Hello ${user.name},</p><p>You have received an email verification request for your Nobita Feedback App account.</p><p>Please click the button below to verify your email. This link will be valid for <strong>10 minutes</strong>:</p><p style="text-align: center; margin: 25px 0;"><a href="${verifyUrl}" style="background-color: #FFD700; color: #1A1A2E !important; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; border: 1px solid #E0C000; display: inline-block;">Verify Email</a></p><p style="font-size: 0.9em;">If the button doesn't work, you can copy-paste this link into your browser: <a href="${verifyUrl}" target="_blank" style="color: #3B82F6;">${verifyUrl}</a></p><p>If you did not request this, please ignore this email.</p><hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;"><p style="font-size: 0.9em; color: #777;">Thank you,<br/>Nobita Feedback App Team</p></div>`;

        await sendEmail({ email: user.email, subject: 'Your Email Verification Link (Nobita Feedback App)', message: textMessage, html: htmlMessage });
        res.status(200).json({ message: "Verification link has been sent to your email. Please check your inbox." });

    } catch (error) {
        console.error('Request email verification API error:', error);
        res.status(500).json({ message: "Something went wrong processing the email verification request." });
    }
});

app.post('/api/auth/verify-email', async (req, res) => {
    const { token } = req.body;
    console.log(`Email verification attempt for token: ${token ? token.substring(0,10)+'...' : 'NO TOKEN'}`);

    if (!token) {
        return res.status(400).json({ message: "Email verification token not found." });
    }

    try {
        const user = await User.findOne({ emailVerificationToken: token, emailVerificationExpires: { $gt: Date.now() } });
        if (!user) {
            console.log(`Email verification: Invalid or expired token "${token ? token.substring(0,10)+'...' : 'NO TOKEN'}"`);
            return res.status(400).json({ message: "Email verification token is invalid or has expired." });
        }

        user.isVerified = true;
        user.emailVerificationToken = undefined; // Clear token after use
        user.emailVerificationExpires = undefined;
        await user.save();

        console.log(`Email successfully verified for user: ${user.email}`);

        const confirmationTextMessage = `Hello ${user.name},\n\nYour email on Nobita Feedback App has been successfully verified.\nYou can now use all features of the app.\n\nThank you,\nNobita Feedback App Team`;
        const confirmationHtmlMessage = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#333"><p>Hello ${user.name},</p><p>Your email on Nobita Feedback App has been successfully verified.</p><p>You can now use all features of the app.</p><hr><p>Thank you,<br/>Nobita Feedback App Team</p></div>`;
        try {
            await sendEmail({ email: user.email, subject: 'Aapka Email Safaltapoorvak Verify Ho Gaya Hai!', message: confirmationTextMessage, html: confirmationHtmlMessage });
        } catch (emailError) {
            console.error("Error sending verification confirmation email:", emailError);
        }

        // Generate a new token with updated isVerified status
        const userForToken = { userId: user._id, name: user.name, email: user.email, avatarUrl: user.avatarUrl, loginMethod: user.loginMethod, isVerified: user.isVerified };
        const newToken = jwt.sign(userForToken, JWT_SECRET, { expiresIn: '7d' });

        res.status(200).json({ message: "Your email has been successfully verified.", token: newToken, user: userForToken });
    } catch (error) {
        console.error('Verify email API error:', error);
        res.status(500).json({ message: "Something went wrong while verifying the email." });
    }
});


// Multer setup for file uploads (max 5MB)
const storage = multer.memoryStorage(); // Store files in memory as buffers
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

// --- User Profile Management Routes ---
// Profile update, password change, and avatar upload WILL require email verification
app.put('/api/user/profile', authenticateToken, isEmailVerified, async (req, res) => {
    const { name, avatarUrl } = req.body;
    const userId = req.user.userId;

    if (!name) {
        return res.status(400).json({ message: 'Name is required.' });
    }

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        if (user.loginMethod === 'google') {
            // For Google users, only avatar can be changed via profile update, name is managed by Google
            if (name !== user.name) {
                return res.status(400).json({ message: 'Name for Google-linked accounts cannot be changed here.' });
            }
            if (avatarUrl && avatarUrl !== user.avatarUrl) {
                user.avatarUrl = avatarUrl;
            }
        } else {
            // For email users, name and avatar can be changed
            user.name = name;
            if (avatarUrl) {
                user.avatarUrl = avatarUrl;
            } else if (user.avatarUrl && user.avatarUrl.startsWith('https://api.dicebear.com') && name !== req.user.name) {
                // If DiceBear avatar and name changed, regenerate DiceBear avatar
                user.avatarUrl = getDiceBearAvatarUrl(name, Date.now().toString());
            }
        }
        
        await user.save();

        // Update name and avatar in associated feedbacks if they changed
        if (avatarUrl || (user.loginMethod === 'email' && name !== req.user.name)) {
            await Feedback.updateMany({ userId: user._id }, { $set: { avatarUrl: user.avatarUrl, name: user.name } });
        }

        // Generate a new token with updated user information
        const updatedUserForToken = { userId: user._id, name: user.name, email: user.email, avatarUrl: user.avatarUrl, loginMethod: user.loginMethod, isVerified: user.isVerified };
        const newToken = jwt.sign(updatedUserForToken, JWT_SECRET, { expiresIn: '7d' });

        res.status(200).json({ message: 'Profile updated successfully!', user: updatedUserForToken, token: newToken });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ message: 'Failed to update profile.', error: error.message });
    }
});

app.post('/api/user/change-password', authenticateToken, isEmailVerified, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.userId;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Current and new password are required.' });
    }
    if (newPassword.length < 6) {
        return res.status(400).json({ message: 'New password must be at least 6 characters long.' });
    }

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        if (user.loginMethod === 'google') {
            return res.status(400).json({ message: 'Password for Google-linked accounts cannot be changed here.' });
        }
        if (!user.password) {
            // This case should ideally not happen for email users, but good to handle
            return res.status(400).json({ message: 'Your account does not have a password set. Please use the password reset feature.' });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Incorrect current password.' });
        }

        user.password = await bcrypt.hash(newPassword, 12);
        await user.save();

        res.status(200).json({ message: 'Password changed successfully!' });
    } catch (error) {
        console.error('Password change error:', error);
        res.status(500).json({ message: 'Failed to change password.', error: error.message });
    }
});

app.post('/api/user/upload-avatar', authenticateToken, isEmailVerified, upload.single('avatar'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded.' });
    }
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
        console.error("Cloudinary credentials missing. Cannot upload avatar.");
        return res.status(500).json({ message: 'Avatar upload service is not configured on the server.' });
    }

    try {
        // Upload image buffer to Cloudinary
        const result = await new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream({
                folder: 'nobita_feedback_avatars', // Dedicated folder for avatars
                transformation: [
                    { width: 150, height: 150, crop: "fill", gravity: "face", radius: "max" }, // Crop to a circle, focus on face
                    { quality: "auto:eco" } // Optimize quality
                ]
            }, (error, result) => {
                if (error) {
                    console.error('Cloudinary upload error:', error);
                    return reject(new Error(error.message));
                }
                if (!result || !result.secure_url) {
                    return reject(new Error('Cloudinary did not return a URL.'));
                }
                resolve(result);
            }).end(req.file.buffer); // Pass the file buffer to Cloudinary
        });

        const userId = req.user.userId;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        user.avatarUrl = result.secure_url; // Save the Cloudinary URL
        await user.save();

        // Update avatar URL in all feedbacks submitted by this user
        await Feedback.updateMany({ userId: user._id }, { $set: { avatarUrl: user.avatarUrl } });

        // Generate a new token with updated avatar URL
        const updatedUserForToken = { userId: user._id, name: user.name, email: user.email, avatarUrl: user.avatarUrl, loginMethod: user.loginMethod, isVerified: user.isVerified };
        const newToken = jwt.sign(updatedUserForToken, JWT_SECRET, { expiresIn: '7d' });

        res.status(200).json({ message: 'Avatar uploaded successfully!', avatarUrl: user.avatarUrl, token: newToken });

    } catch (error) {
        console.error('Avatar upload route error:', error);
        res.status(500).json({ message: 'Error uploading avatar.', error: error.message });
    }
});


// --- Static Files & Feedback Routes ---
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/feedbacks', async (req, res) => {
    try {
        // Populate userId to get loginMethod and isVerified status for display
        const allFeedbacks = await Feedback.find().populate({ path: 'userId', select: 'loginMethod isVerified email' }).sort({ timestamp: -1 });
        res.status(200).json(allFeedbacks);
    } catch (error) {
        console.error("Error fetching feedbacks:", error);
        res.status(500).json({ message: 'Failed to fetch feedbacks.', error: error.message });
    }
});

// Feedback submission DOES NOT require email verification (only authentication)
app.post('/api/feedback', authenticateToken, async (req, res) => {
    const { feedback, rating } = req.body;
    const userIp = req.clientIp;
    if (!req.user) return res.status(403).json({ message: "Please log in to submit feedback." });
    if (!feedback || !rating || rating === '0') return res.status(400).json({ message: 'Feedback and rating are required.' });
    
    try {
        const loggedInUser = await User.findById(req.user.userId);
        if (!loggedInUser) {
            return res.status(404).json({ message: "Logged-in user not found." });
        }

        let feedbackData = {
            name: loggedInUser.name,
            avatarUrl: loggedInUser.avatarUrl,
            userId: loggedInUser._id,
            feedback,
            rating: parseInt(rating),
            userIp,
            isEdited: false
        };
        
        // This googleIdSubmitter field might become redundant if all users are linked by userId
        if (loggedInUser.loginMethod === 'google' && loggedInUser.googleId) {
            feedbackData.googleIdSubmitter = loggedInUser.googleId;
        }

        const newFeedback = new Feedback(feedbackData);
        await newFeedback.save();
        res.status(201).json({ message: 'Your feedback has been successfully submitted!', feedback: newFeedback });
    } catch (error) {
        console.error("Feedback save error:", error);
        res.status(500).json({ message: 'Failed to save feedback.', error: error.message });
    }
});

// Feedback edit WILL require email verification
app.put('/api/feedback/:id', authenticateToken, isEmailVerified, async (req, res) => {
    const feedbackId = req.params.id;
    const { feedback, rating } = req.body;
    const loggedInJwtUser = req.user; // User info from JWT

    if (!feedback || !rating || rating === '0') return res.status(400).json({ message: 'Feedback and rating are required for update!' });

    try {
        const existingFeedback = await Feedback.findById(feedbackId);
        if (!existingFeedback) return res.status(404).json({ message: 'This feedback ID was not found.' });
        
        // Ensure the user trying to edit is the original submitter
        if (existingFeedback.userId.toString() !== loggedInJwtUser.userId) {
            return res.status(403).json({ message: 'You can only edit your own feedbacks.' });
        }
        
        // Fetch the most current user data from DB for name/avatar consistency
        const currentUserFromDb = await User.findById(loggedInJwtUser.userId);
        if (!currentUserFromDb) {
            return res.status(404).json({ message: 'User attempting to edit feedback not found.' });
        }

        const currentNameFromDb = currentUserFromDb.name;
        const currentAvatarFromDb = currentUserFromDb.avatarUrl;
        const parsedRating = parseInt(rating);
        
        // Check if content actually changed before marking as edited
        const contentActuallyChanged = existingFeedback.feedback !== feedback ||
                                       existingFeedback.rating !== parsedRating ||
                                       existingFeedback.name !== currentNameFromDb ||
                                       existingFeedback.avatarUrl !== currentAvatarFromDb;
        
        if (contentActuallyChanged) {
            // Store original content if it's the first edit
            if (!existingFeedback.originalContent) {
                existingFeedback.originalContent = {
                    name: existingFeedback.name,
                    feedback: existingFeedback.feedback,
                    rating: existingFeedback.rating,
                    timestamp: existingFeedback.timestamp
                };
            }
            existingFeedback.name = currentNameFromDb; // Always update with current user's name
            existingFeedback.feedback = feedback;
            existingFeedback.rating = parsedRating;
            existingFeedback.timestamp = Date.now(); // Update timestamp on edit
            existingFeedback.isEdited = true;
            existingFeedback.avatarUrl = currentAvatarFromDb; // Always update with current user's avatar
        }
        await existingFeedback.save();
        res.status(200).json({ message: 'Your feedback has been updated!', feedback: existingFeedback });
    } catch (error) {
        console.error(`Feedback update error (ID: ${feedbackId}):`, error);
        res.status(500).json({ message: 'Failed to update feedback.', error: error.message });
    }
});

// --- Admin Panel Routes ---
const authenticateAdmin = (req, res, next) => {
    // Prevent caching of admin panel
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const authHeader = req.headers.authorization;
    if (!authHeader) {
        res.set('WWW-Authenticate', 'Basic realm="Admin Area"');
        return res.status(401).json({ message: 'UNAUTHORIZED: AUTH HEADER MISSING.' });
    }
    const [scheme, credentials] = authHeader.split(' ');
    if (scheme !== 'Basic' || !credentials) {
        res.set('WWW-Authenticate', 'Basic realm="Admin Area"');
        return res.status(401).json({ message: 'UNAUTHORIZED: INVALID AUTH SCHEME.' });
    }
    const [username, password] = Buffer.from(credentials, 'base64').toString().split(':');

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        next();
    } else {
        res.set('WWW-Authenticate', 'Basic realm="Admin Area"');
        res.status(401).json({ message: 'UNAUTHORIZED: INVALID ADMIN CREDENTIALS.' });
    }
};

app.get('/admin-panel-nobita', authenticateAdmin, async (req, res) => {
    console.log("Admin panel access attempt.");
    try {
        // Populate userId to get full user details including loginMethod, name, email, isVerified
        const feedbacks = await Feedback.find().populate({ path: 'userId', select: 'loginMethod name email isVerified' }).sort({ timestamp: -1 });
        
        // Encode credentials for client-side JS use (for subsequent AJAX calls)
        const encodedCredentials = Buffer.from(`${ADMIN_USERNAME}:${ADMIN_PASSWORD}`).toString('base64');
        const authHeaderValue = `Basic ${encodedCredentials}`;
        console.log("Generated AUTH_HEADER for admin panel JS:", authHeaderValue ? "Present" : "MISSING/EMPTY");
        
        const nobitaAvatarUrl = 'https://i.ibb.co/FsSs4SG/creator-avatar.png'; // Static URL for admin avatar

        let html = `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>ADMIN PANEL: NOBITA'S COMMAND CENTER</title>
                <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap" rel="stylesheet">
                <style>
                    body{font-family:'Roboto',sans-serif;background:linear-gradient(135deg, #1A1A2E, #16213E);color:#E0E0E0;margin:0;padding:30px 20px;display:flex;flex-direction:column;align-items:center;min-height:100vh}
                    h1{color:#FFD700;text-align:center;margin-bottom:40px;font-size:2.8em;text-shadow:0 0 15px rgba(255,215,0,0.5)}
                    .main-panel-btn-container{width:100%;max-width:1200px;display:flex;justify-content:space-between;margin-bottom:20px;padding:0 10px;align-items:center;}
                    .main-panel-btn{background-color:#007bff;color:white;padding:10px 20px;border:none;border-radius:8px;font-size:1em;font-weight:bold;cursor:pointer;transition:background-color .3s ease,transform .2s;text-decoration:none;display:inline-block;text-transform:uppercase}
                    .main-panel-btn:hover{background-color:#0056b3;transform:translateY(-2px)}
                    .feedback-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(350px,1fr));gap:30px;width:100%;max-width:1200px}
                    .feedback-card{background-color:transparent;border-radius:15px;perspective:1000px;min-height:500px}
                    .feedback-card-inner{position:relative;width:100%;height:100%;transition:transform .7s;transform-style:preserve-3d;box-shadow:0 8px 25px rgba(0,0,0,.4);border-radius:15px}
                    .feedback-card.is-flipped .feedback-card-inner{transform:rotateY(180deg)}
                    .feedback-card-front,.feedback-card-back{position:absolute;width:100%;height:100%;-webkit-backface-visibility:hidden;backface-visibility:hidden;background-color:#2C3E50;color:#E0E0E0;border-radius:15px;padding:25px;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;overflow-y:auto}
                    .feedback-card-back{transform:rotateY(180deg);background-color:#34495E}
                    .feedback-header{display:flex;align-items:center;gap:15px;margin-bottom:15px;flex-shrink:0}
                    .feedback-avatar{width:60px;height:60px;border-radius:50%;overflow:hidden;border:3px solid #FFD700;flex-shrink:0;box-shadow:0 0 10px rgba(255,215,0,.3)}
                    .feedback-avatar img{width:100%;height:100%;object-fit:cover}
                    .feedback-info{flex-grow:1;display:flex;flex-direction:column;align-items:flex-start}
                    .feedback-info h4{margin:0;font-size:1.3em;color:#FFD700;text-transform:uppercase;display:flex;align-items:center;gap:8px}
                    .feedback-info h4 small{font-size:0.7em; color:#bbb; text-transform:none; margin-left:5px;}
                    .google-user-tag{background-color:#4285F4;color:white;padding:2px 6px;border-radius:4px;font-size:.7em;margin-left:8px;vertical-align:middle}
                    .email-user-tag{background-color:#6c757d;color:white;padding:2px 6px;border-radius:4px;font-size:.7em;margin-left:8px;vertical-align:middle}
                    /* These are now unused but kept as per instruction */
                    .verified-tag{background-color:#28a745;color:white;padding:2px 6px;border-radius:4px;font-size:.7em;margin-left:8px;vertical-align:middle}
                    .unverified-tag{background-color:#ffc107;color:#333;padding:2px 6px;border-radius:4px;font-size:.7em;margin-left:8px;vertical-align:middle}
                    /* End unused CSS */
                    .feedback-info .rating{font-size:1.1em;color:#F39C12;margin-top:5px}
                    .feedback-info .user-ip{font-size:.9em;color:#AAB7B8;margin-top:5px}
                    .feedback-body{font-size:1em;color:#BDC3C7;line-height:1.6;margin-bottom:15px;flex-grow:1;overflow-y:auto;word-wrap:break-word}
                    .feedback-date{font-size:.8em;color:#7F8C8D;text-align:right;margin-bottom:10px;border-top:1px solid #34495E;padding-top:10px;flex-shrink:0}
                    .action-buttons{display:flex;gap:10px;margin-bottom:10px;flex-shrink:0}
                    .action-buttons button,.flip-btn{flex-grow:1;padding:10px 12px;border:none;border-radius:8px;font-size:.9em;font-weight:bold;cursor:pointer;transition:background-color .3s ease,transform .2s;text-transform:uppercase}
                    .action-buttons button:hover,.flip-btn:hover{transform:translateY(-2px)}
                    .delete-btn{background-color:#E74C3C;color:white}
                    .delete-btn:hover{background-color:#C0392B}
                    .change-avatar-btn{background-color:#3498DB;color:white}
                    .change-avatar-btn:hover{background-color:#2980B9}
                    .flip-btn{background-color:#fd7e14;color:white;margin-top:10px;flex-grow:0;width:100%}
                    .flip-btn:hover{background-color:#e66800}
                    .reply-section{border-top:1px solid #34495E;padding-top:15px;margin-top:10px;flex-shrink:0}
                    .reply-section textarea{width:calc(100% - 20px);padding:10px;border:1px solid #4A6070;border-radius:8px;background-color:#34495E;color:#ECF0F1;resize:vertical;min-height:50px;margin-bottom:10px;font-size:.95em}
                    .reply-section textarea::placeholder{color:#A9B7C0}
                    .reply-btn{background-color:#27AE60;color:white;width:100%;padding:10px;border:none;border-radius:8px;font-weight:bold;cursor:pointer;transition:background-color .3s ease,transform .2s;text-transform:uppercase}
                    .reply-btn:hover{background-color:#229954;transform:translateY(-2px)}
                    .replies-display{margin-top:15px;background-color:#213042;border-radius:10px;padding:10px;border:1px solid #2C3E50;max-height:150px;overflow-y:auto}
                    .replies-display h4{color:#85C1E9;font-size:1.1em;margin-bottom:10px;border-bottom:1px solid #34495E;padding-bottom:8px}
                    .single-reply{border-bottom:1px solid #2C3E50;padding-bottom:10px;margin-bottom:10px;font-size:.9em;color:#D5DBDB;display:flex;align-items:flex-start;gap:10px}
                    .single-reply:last-child{border-bottom:none;margin-bottom:0}
                    .admin-reply-avatar-sm{width:30px;height:30px;border-radius:50%;border:2px solid #9B59B6;flex-shrink:0;object-fit:cover;box-shadow:0 0 5px rgba(155,89,182,.5)}
                    .reply-content-wrapper{flex-grow:1;word-wrap:break-word}
                    .reply-admin-name{font-weight:bold;color:#9B59B6;display:inline;margin-right:5px}
                    .reply-timestamp{font-size:.75em;color:#8E9A9D;margin-left:10px}
                    .edited-admin-tag{background-color:#5cb85c;color:white;padding:3px 8px;border-radius:5px;font-size:.75em;font-weight:bold;vertical-align:middle}
                    .admin-modal-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.75);display:none;justify-content:center;align-items:center;z-index:2000}
                    .admin-custom-modal{background:#222a35;padding:30px;border-radius:15px;box-shadow:0 10px 30px rgba(0,0,0,.5);text-align:center;color:#f0f0f0;width:90%;max-width:480px;border:1px solid #445}
                    .admin-custom-modal h3{color:#FFD700;margin-top:0;margin-bottom:15px;font-size:1.8em}
                    .admin-custom-modal p{margin-bottom:25px;font-size:1.1em;line-height:1.6;color:#ccc;word-wrap:break-word}
                    .admin-modal-buttons button{background-color:#007bff;color:white;border:none;padding:12px 22px;border-radius:8px;cursor:pointer;font-size:1em;margin:5px;transition:background-color .3s,transform .2s;font-weight:bold}
                    .admin-modal-buttons button:hover{transform:translateY(-2px)}
                    #adminModalOkButton:hover{background-color:#0056b3}
                    #adminModalConfirmButton{background-color:#28a745}
                    #adminModalConfirmButton:hover{background-color:#1e7e34}
                    #adminModalCancelButton{background-color:#dc3545}
                    #adminModalCancelButton:hover{background:none;color:#dc3545}
                    .select-all-container { display: flex; align-items: center; gap: 10px; margin-right: 20px; }
                    .select-all-container label { font-size: 1.1em; color: #FFD700; }
                    .select-all-container input[type="checkbox"] { width: 20px; height: 20px; cursor: pointer; }
                    .bulk-delete-btn { background-color: #E74C3C; color: white; padding: 10px 20px; border: none; border-radius: 8px; font-size: 1em; font-weight: bold; cursor: pointer; transition: background-color .3s ease,transform .2s; text-transform: uppercase; margin-left: auto;}
                    .bulk-delete-btn:hover { background-color: #C0392B; transform: translateY(-2px); }
                    .feedback-checkbox { width: 20px; height: 20px; margin-left: 5px; cursor: pointer; align-self: flex-start; }
                    @media (max-width:768px){h1{font-size:2.2em}.feedback-grid{grid-template-columns:1fr}.main-panel-btn-container{flex-direction:column; gap: 15px;}.select-all-container {margin-right: 0;}.bulk-delete-btn {width: 100%; margin-left: 0;}}
                </style>
            </head>
            <body>
                <h1>NOBITA'S COMMAND CENTER</h1>
                <div class="main-panel-btn-container">
                    <div class="select-all-container">
                        <input type="checkbox" id="selectAllCheck" onchange="toggleSelectAll(this.checked)">
                        <label for="selectAllCheck">Select All</label>
                    </div>
                    <button class="bulk-delete-btn" onclick="tryDeleteSelectedFeedbacks()">Delete Selected</button>
                </div>
                <div class="feedback-grid">
        `;

        if (feedbacks.length === 0) {
            html += `<p style="text-align:center;color:#7F8C8D;font-size:1.2em;grid-column:1 / -1;">No feedback received yet!</p>`;
        } else {
            for (const fb of feedbacks) {
                let userTag = '';
                let userDisplayName = fb.userId && fb.userId.name ? fb.userId.name : fb.name;
                
                if (!userDisplayName) {
                    userDisplayName = 'Unknown User'; // Fallback if name is missing
                }
                let userEmailDisplay = '';

                // Determine user type and verification status
                if (fb.userId && typeof fb.userId === 'object') { // Check if userId is populated
                   if (fb.userId.loginMethod === 'google') {
                       userTag = `<span class="google-user-tag" title="Google User (${fb.userId.email || ''})">G</span>`;
                   } else if (fb.userId.loginMethod === 'email') {
                       userTag = `<span class="email-user-tag" title="Email User (${fb.userId.email || ''})">E</span>`;
                   }
                   userEmailDisplay = fb.userId.email ? `<small>(${fb.userId.email})</small>` : '';

                   if (fb.userId.isVerified) {
                       // Changed from span.verified-tag to img with blue tick for verified
                       userTag += `<img src="https://ibb.co/N6TrbkHD" alt="Verified" title="Email Verified" style="width: 18px; height: 18px; vertical-align: middle; margin-left: 5px;">`;
                   } else if (fb.userId.loginMethod === 'email') { // Only show unverified for email users
                       // Changed from span.unverified-tag to img with red tick for unverified
                       userTag += `<img src="https://ibb.co/HpLnr6jQ" alt="Unverified" title="Email Not Verified" style="width: 18px; height: 18px; vertical-align: middle; margin-left: 5px;">`;
                   }
                } else if (fb.googleIdSubmitter) {
                    // Fallback for older feedbacks submitted directly with googleId before userId population
                    userTag = `<span class="google-user-tag" title="Google User (Legacy)">G</span>`;
                    // Assume legacy Google users were verified, using blue tick
                    userTag += `<img src="https://ibb.co/N6TrbkHD" alt="Verified" title="Email Verified" style="width: 18px; height: 18px; vertical-align: middle; margin-left: 5px;">`;
                } else {
                    // Fallback for feedbacks without linked user or googleIdSubmitter
                    userTag = `<span class="email-user-tag" title="Legacy User">U</span>`;
                    // For legacy users without verification status, default to red tick as unverified
                    userTag += `<img src="https://ibb.co/HpLnr6jQ" alt="Unverified" title="Status Unknown / Unverified" style="width: 18px; height: 18px; vertical-align: middle; margin-left: 5px;">`;
                }

                html += `
                    <div class="feedback-card" id="card-${fb._id}">
                        <div class="feedback-card-inner">
                            <div class="feedback-card-front">
                                <div class="feedback-header">
                                    <input type="checkbox" class="feedback-checkbox" value="${fb._id}">
                                    <div class="feedback-avatar">
                                        <img src="${fb.avatarUrl || getDiceBearAvatarUrl(userDisplayName)}" alt="${userDisplayName.charAt(0) || 'U'}">
                                    </div>
                                    <div class="feedback-info">
                                        <h4>${userDisplayName} ${fb.isEdited ? '<span class="edited-admin-tag">EDITED</span>' : ''} ${userTag}</h4>
                                        <small style="font-size:0.7em; color:#bbb; text-transform:none; margin-top: 5px; display: block;">${userEmailDisplay.replace(/[()]/g, '')}</small>
                                        <div class="rating">${'★'.repeat(fb.rating)}${'☆'.repeat(5 - fb.rating)}</div>
                                        <div class="user-ip">IP: ${fb.userIp || 'N/A'} | UserID: ${fb.userId ? (fb.userId._id ? fb.userId._id.toString() : fb.userId.toString()) : 'N/A'}</div>
                                    </div>
                                </div>
                                <div class="feedback-body">
                                    <p>${fb.feedback}</p>
                                </div>
                                <div class="feedback-date">
                                    ${fb.isEdited ? 'Last Edited' : 'Posted'}: ${new Date(fb.timestamp).toLocaleString()}
                                    ${fb.isEdited && fb.originalContent ? `<br><small>Original: ${new Date(fb.originalContent.timestamp).toLocaleString()}</small>` : ''}
                                </div>
                                <div class="action-buttons">
                                    <button class="delete-btn" onclick="tryDeleteFeedback('${fb._id}')">DELETE</button>
                                    ${fb.userId && fb.userId.loginMethod === 'email' ? `<button class="change-avatar-btn" onclick="tryChangeUserAvatar('${fb.userId._id}', '${userDisplayName}')">AVATAR</button>` : ''}
                                </div>
                                <div class="reply-section">
                                    <textarea id="reply-text-${fb._id}" placeholder="Admin reply..."></textarea>
                                    <button class="reply-btn" onclick="tryPostReply('${fb._id}', 'reply-text-${fb._id}')">REPLY</button>
                                    <div class="replies-display">
                                        ${fb.replies && fb.replies.length > 0 ? '<h4>Replies:</h4>' : ''}
                                        ${fb.replies.map(reply => `
                                            <div class="single-reply">
                                                <img src="${nobitaAvatarUrl}" alt="Admin" class="admin-reply-avatar-sm">
                                                <div class="reply-content-wrapper">
                                                    <span class="reply-admin-name">${reply.adminName}:</span> ${reply.text}
                                                    <span class="reply-timestamp">(${new Date(reply.timestamp).toLocaleString()})</span>
                                                </div>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                                ${fb.isEdited && fb.originalContent ? `<button class="flip-btn" onclick="flipCard('${fb._id}')">VIEW ORIGINAL</button>` : ''}
                            </div>
                `;
                // Back of the card for original content if edited
                if (fb.isEdited && fb.originalContent) {
                    html += `
                            <div class="feedback-card-back">
                                <div class="feedback-header">
                                    <div class="feedback-avatar">
                                        <img src="${(fb.originalContent.avatarUrl || fb.avatarUrl)}" alt="Original">
                                    </div>
                                    <div class="feedback-info">
                                        <h4>ORIGINAL: ${fb.originalContent.name}</h4>
                                        <div class="rating">${'★'.repeat(fb.originalContent.rating)}${'☆'.repeat(5 - fb.originalContent.rating)}</div>
                                    </div>
                                </div>
                                <div class="feedback-body">
                                    <p>${fb.originalContent.feedback}</p>
                                </div>
                                <div class="feedback-date">
                                    Originally Posted: ${new Date(fb.originalContent.timestamp).toLocaleString()}
                                </div>
                                <div style="margin-top:auto;">
                                    <button class="flip-btn" onclick="flipCard('${fb._id}')">VIEW EDITED</button>
                                </div>
                            </div>
                    `;
                }
                html += `
                        </div>
                    </div>
                `;
            }
        }
        html += `
                </div>
                <div id="adminModalOverlay" class="admin-modal-overlay">
                    <div class="admin-custom-modal">
                        <h3 id="adminModalTitle"></h3>
                        <p id="adminModalMessage"></p>
                        <div class="admin-modal-buttons">
                            <button id="adminModalOkButton">OK</button>
                            <button id="adminModalConfirmButton" style="display:none;">Confirm</button>
                            <button id="adminModalCancelButton" style="display:none;">Cancel</button>
                        </div>
                    </div>
                </div>

                <script>
                    const AUTH_HEADER = '${authHeaderValue}';
                    // Basic check for AUTH_HEADER presence, though it's set by server
                    if (!AUTH_HEADER || AUTH_HEADER === "Basic Og==") {
                        console.error("CRITICAL: AUTH_HEADER is missing or invalid in admin panel script!");
                        // Use the custom modal instead for better UX
                        showAdminModal('alert', 'Authentication Error', 'Admin authentication is not configured properly. Actions will fail.');
                    }

                    // Modal elements and functions
                    const adminModalOverlay = document.getElementById('adminModalOverlay');
                    const adminModalTitle = document.getElementById('adminModalTitle');
                    const adminModalMessage = document.getElementById('adminModalMessage');
                    const adminModalOkButton = document.getElementById('adminModalOkButton');
                    const adminModalConfirmButton = document.getElementById('adminModalConfirmButton');
                    const adminModalCancelButton = document.getElementById('adminModalCancelButton');
                    let globalConfirmCallback = null;

                    function showAdminModal(type, title, message, confirmCallbackFn = null) {
                        adminModalTitle.textContent = title;
                        adminModalMessage.textContent = message;
                        globalConfirmCallback = confirmCallbackFn;

                        adminModalOkButton.style.display = type === 'confirm' ? 'none' : 'inline-block';
                        adminModalConfirmButton.style.display = type === 'confirm' ? 'inline-block' : 'none';
                        adminModalCancelButton.style.display = type === 'confirm' ? 'inline-block' : 'none';

                        adminModalOverlay.style.display = 'flex'; // Show modal
                    }

                    adminModalOkButton.addEventListener('click', () => adminModalOverlay.style.display = 'none');
                    adminModalConfirmButton.addEventListener('click', () => {
                        adminModalOverlay.style.display = 'none';
                        if (globalConfirmCallback) globalConfirmCallback(true);
                    });
                    adminModalCancelButton.addEventListener('click', () => {
                        adminModalOverlay.style.display = 'none';
                        if (globalConfirmCallback) globalConfirmCallback(false);
                    });

                    // Function to flip feedback cards
                    function flipCard(id) {
                        document.getElementById(\`card-\${id}\`).classList.toggle('is-flipped');
                    }

                    // Function to delete a single feedback
                    async function tryDeleteFeedback(id) {
                        console.log("Attempting to delete feedback ID:", id);
                        showAdminModal('confirm', 'Delete Feedback?', 'Are you sure you want to delete this feedback? This cannot be undone.', async confirmed => {
                            if (confirmed) {
                                try {
                                    const res = await fetch(\`/api/admin/feedback/\${id}\`, {
                                        method: 'DELETE',
                                        headers: {
                                            'Authorization': AUTH_HEADER
                                        }
                                    });
                                    if (res.ok) {
                                        showAdminModal('alert', 'Deleted!', 'Feedback deleted successfully.');
                                        setTimeout(() => location.reload(), 1000); // Reload page after success
                                    } else {
                                        const err = await res.json();
                                        console.error("Delete failed response:", err);
                                        showAdminModal('alert', 'Error!', \`Failed to delete: \${err.message || res.statusText}\`);
                                    }
                                } catch (e) {
                                    console.error("Delete fetch error:", e);
                                    showAdminModal('alert', 'Fetch Error!', \`Error during delete: \${e.message}\`);
                                }
                            }
                        });
                    }

                    // Function to post a reply to a feedback
                    async function tryPostReply(fbId, txtId) {
                        const replyText = document.getElementById(txtId).value.trim();
                        console.log("Attempting to post reply to feedback ID:", fbId, "Text:", replyText);
                        if (!replyText) {
                            showAdminModal('alert', 'Empty Reply', 'Please write something to reply.');
                            return;
                        }
                        showAdminModal('confirm', 'Post Reply?', \`Confirm reply: "\${replyText.substring(0,50)}..."\`, async confirmed => {
                            if (confirmed) {
                                try {
                                    const res = await fetch(\`/api/admin/feedback/\${fbId}/reply\`, {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json',
                                            'Authorization': AUTH_HEADER
                                        },
                                        body: JSON.stringify({ replyText, adminName: '👉𝙉𝙊𝘽𝙄𝙏𝘼🤟' }) // Admin name hardcoded for now
                                    });
                                    if (res.ok) {
                                        showAdminModal('alert', 'Replied!', 'Reply posted.');
                                        setTimeout(() => location.reload(), 1000);
                                    } else {
                                        const err = await res.json();
                                        console.error("Reply failed response:", err);
                                        showAdminModal('alert', 'Error!', \`Failed to reply: \${err.message || res.statusText}\`);
                                    }
                                } catch (e) {
                                    console.error("Reply fetch error:", e);
                                    showAdminModal('alert', 'Fetch Error!', \`Error during reply: \${e.message}\`);
                                }
                            }
                        });
                    }

                    // Function to change a user's DiceBear avatar
                    async function tryChangeUserAvatar(userId, userName) {
                        console.log("Attempting to change avatar for user ID:", userId, "Name:", userName);
                        showAdminModal('confirm', 'Change Avatar?', \`Change avatar for \${userName}? This will regenerate avatar for this email user.\`, async confirmed => {
                            if (confirmed) {
                                try {
                                    const res = await fetch(\`/api/admin/user/\${userId}/change-avatar\`, {
                                        method: 'PUT',
                                        headers: {
                                            'Content-Type': 'application/json',
                                            'Authorization': AUTH_HEADER
                                        }
                                    });
                                    if (res.ok) {
                                        showAdminModal('alert', 'Avatar Changed!', 'Avatar updated for ' + userName + '.');
                                        setTimeout(() => location.reload(), 1000);
                                    } else {
                                        const err = await res.json();
                                        console.error("Change avatar failed response:", err);
                                        showAdminModal('alert', 'Error!', \`Failed to change avatar: \${err.message || res.statusText}\`);
                                    }
                                } catch (e) {
                                    console.error("Change avatar fetch error:", e);
                                    showAdminModal('alert', 'Fetch Error!', \`Error during avatar change: \${e.message}\`);
                                }
                            }
                        });
                    }
                    
                    // New functions for multi-select delete
                    function toggleSelectAll(checked) {
                        document.querySelectorAll('.feedback-checkbox').forEach(checkbox => {
                            checkbox.checked = checked;
                        });
                    }

                    async function tryDeleteSelectedFeedbacks() {
                        const selectedFeedbackIds = Array.from(document.querySelectorAll('.feedback-checkbox:checked')).map(cb => cb.value);
                        if (selectedFeedbackIds.length === 0) {
                            showAdminModal('alert', 'No Feedbacks Selected', 'Please select at least one feedback to delete.');
                            return;
                        }

                        showAdminModal('confirm', 'Delete Selected Feedbacks?', \`Are you sure you want to delete \${selectedFeedbackIds.length} selected feedback(s)? This cannot be undone.\`, async confirmed => {
                            if (confirmed) {
                                try {
                                    const res = await fetch('/api/admin/feedbacks/batch-delete', {
                                        method: 'DELETE',
                                        headers: {
                                            'Content-Type': 'application/json',
                                            'Authorization': AUTH_HEADER
                                        },
                                        body: JSON.stringify({ ids: selectedFeedbackIds })
                                    });
                                    if (res.ok) {
                                        showAdminModal('alert','Deleted!',\`\${selectedFeedbackIds.length} feedback(s) deleted successfully.\`);
                                        setTimeout(()=>location.reload(),1000);
                                    } else {
                                        const err = await res.json();
                                        console.error("Batch delete failed response:",err);
                                        showAdminModal('alert','Error!',\`Failed to delete selected feedbacks: \${err.message||res.statusText}\`);
                                    }
                                } catch (e) {
                                    console.error("Batch delete fetch error:",e);
                                    showAdminModal('alert', 'Fetch Error!', \`Error during batch delete: \${e.message}\`);
                                }
                            }
                        });
                    }

                </script>
            </body>
            </html>
        `;
        res.send(html);
    } catch (error) {
        console.error('Error generating admin panel:', error);
        res.status(500).send(`There was an issue with the admin panel! Error: ${error.message}`);
    }
});

// Admin API to delete a single feedback
app.delete('/api/admin/feedback/:id', authenticateAdmin, async (req, res) => {
    console.log(`ADMIN: Received DELETE request for feedback ID: ${req.params.id}`);
    try {
        const deletedFeedback = await Feedback.findByIdAndDelete(req.params.id);
        if (!deletedFeedback) {
            console.log(`ADMIN: Feedback ID ${req.params.id} not found for deletion.`);
            return res.status(404).json({ message: 'Feedback ID not found.' });
        }
        console.log(`ADMIN: Feedback ID ${req.params.id} deleted successfully.`);
        res.status(200).json({ message: 'Feedback deleted successfully.' });
    } catch (error) {
        console.error(`ADMIN: Error deleting feedback ID ${req.params.id}:`, error);
        res.status(500).json({ message: 'Failed to delete feedback.', error: error.message });
    }
 });

// Admin API to batch delete feedbacks
app.delete('/api/admin/feedbacks/batch-delete', authenticateAdmin, async (req, res) => {
    const { ids } = req.body;
    console.log(`ADMIN: Received BATCH DELETE request for feedback IDs:`, ids);

    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: 'No IDs provided for deletion.' });
    }

    try {
        const result = await Feedback.deleteMany({ _id: { $in: ids } });
        if (result.deletedCount === 0) {
            console.log(`ADMIN: No feedbacks found to delete for the provided IDs.`);
            return res.status(404).json({ message: 'No feedbacks found for the given IDs.' });
        }
        console.log(`ADMIN: Successfully deleted ${result.deletedCount} feedbacks.`);
        res.status(200).json({ message: `${result.deletedCount} feedbacks successfully deleted.`, deletedCount: result.deletedCount });
    } catch (error) {
        console.error(`ADMIN: Error during batch deleting feedbacks:`, error);
        res.status(500).json({ message: 'Failed to delete selected feedbacks.', error: error.message });
    }
});


// Admin API to reply to a feedback
app.post('/api/admin/feedback/:id/reply', authenticateAdmin, async (req, res) => {
    const feedbackId = req.params.id;
    const { replyText, adminName } = req.body;
    console.log(`ADMIN: Received POST request to reply to feedback ID: ${feedbackId} with text: ${replyText}`);
    if (!replyText) {
        console.log(`ADMIN: Reply text missing for feedback ID: ${feedbackId}`);
        return res.status(400).json({ message: 'Reply text is required.' });
    }
    try {
        const feedback = await Feedback.findById(feedbackId);
        if (!feedback) {
            console.log(`ADMIN: Feedback ID ${feedbackId} not found for replying.`);
            return res.status(404).json({ message: 'Feedback ID not found.' });
        }
        // Push new reply to the replies array
        feedback.replies.push({ text: replyText, adminName: adminName || 'Admin', timestamp: new Date() });
        await feedback.save();
        console.log(`ADMIN: Reply added successfully to feedback ID: ${feedbackId}`);
        res.status(200).json({ message: 'Reply posted successfully.', reply: feedback.replies[feedback.replies.length - 1] });
    } catch (error) {
        console.error(`ADMIN: Error replying to feedback ID ${feedbackId}:`, error);
        res.status(500).json({ message: 'Failed to save reply.', error: error.message });
    }
});

// Admin API to change a user's DiceBear avatar (for email-based users)
app.put('/api/admin/user/:userId/change-avatar', authenticateAdmin, async (req, res) => {
    const userId = req.params.userId;
    console.log(`ADMIN: Received PUT request to change avatar for user ID: ${userId}`);
    try {
        const userToUpdate = await User.findById(userId);
        if (!userToUpdate) {
            console.log(`ADMIN: User ID ${userId} not found for avatar change.`);
            return res.status(404).json({ message: 'User ID not found.' });
        }
        // Prevent changing avatar for Google users from admin panel
        if (userToUpdate.loginMethod === 'google') {
            console.log(`ADMIN: Attempt to change avatar for Google user ID: ${userId} denied.`);
            return res.status(400).json({ message: 'Google user avatars cannot be changed from here.' });
        }
        const userName = userToUpdate.name;
        if (!userName) {
            console.log(`ADMIN: User name missing for user ID: ${userId} for avatar generation.`);
            return res.status(400).json({ message: 'User name is missing to generate avatar.' });
        }
        // Generate a new DiceBear avatar with a fresh random seed
        const newAvatarUrl = getDiceBearAvatarUrl(userName, Date.now().toString());
        userToUpdate.avatarUrl = newAvatarUrl;
        await userToUpdate.save();
        console.log(`ADMIN: Avatar changed for user ID: ${userId} to ${newAvatarUrl}`);

        // Update all feedbacks associated with this user with the new avatar URL
        await Feedback.updateMany({ userId: userToUpdate._id }, { $set: { avatarUrl: newAvatarUrl } });
        console.log(`ADMIN: Updated avatar in feedbacks for user ID: ${userId}`);

        res.status(200).json({ message: 'Avatar changed successfully!', newAvatarUrl });
    } catch (error) {
        console.error(`ADMIN: Error changing avatar for user ID ${userId}:`, error);
        res.status(500).json({ message: 'Failed to change avatar.', error: error.message });
    }
});

// This route ensures that frontend routes (if you use React Router, Vue Router etc.)
// also serve index.html on direct access.
// If there's a specific file like /reset-password.html, express.static will serve it first.
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    // If an /api/ route is not matched, return 404
    res.status(404).json({message: "API endpoint not found."});
  }
});

app.listen(PORT, () => {
    console.log(`Nobita's server is running on port ${PORT}: http://localhost:${PORT}`);
});
