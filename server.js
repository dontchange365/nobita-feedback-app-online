// server.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const { OAuth2Client } = require('google-auth-library'); // Corrected typo here
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


const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID); // Corrected typo here

mongoose.connect(MONGODB_URI)
  .then(() => console.log('MongoDB se connection safal!'))
  .catch(err => {
    console.error('MongoDB connection mein gadbad:', err);
    console.error('Ensure MONGODB_URI environment variable Render par sahi se set hai aur aapka IP whitelisted hai (agar zaroori ho).');
    process.exit(1);
});

function getDiceBearAvatarUrl(name, randomSeed = '') {
    const seedName = (typeof name === 'string' && name) ? name.toLowerCase() : 'default_seed';
    const seed = encodeURIComponent(seedName + randomSeed);
    return `https://api.dicebear.com/8.x/adventurer/svg?seed=${seed}&flip=true&radius=50&doodle=true&scale=90`;
}

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String },
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
  name: { type: String, required: true },
  feedback: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  timestamp: { type: Date, default: Date.now },
  avatarUrl: { type: String },
  userIp: { type: String },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  googleIdSubmitter: { type: String, sparse: true },
  isEdited: { type: Boolean, default: false },
  originalContent: { name: String, feedback: String, rating: Number, timestamp: Date, avatarUrl: String },
  replies: [{ text: { type: String, required: true }, timestamp: { type: Date, default: Date.now }, adminName: { type: String, default: 'Admin' } }]
});
const Feedback = mongoose.model('Feedback', feedbackSchema);

app.use(cors({
    origin: [FRONTEND_URL, `http://localhost:${PORT}`],
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
        req.user = { ...user, isVerified: user.isVerified }; 
        next();
    });
};

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
            return res.status(403).json({ message: "Email verify nahi kiya gaya hai. Kripya apna email verify karein takki yeh action kar sakein." });
        }
    } catch (error) {
        console.error("isEmailVerified middleware error:", error);
        res.status(500).json({ message: "Server error while checking email verification status." });
    }
};

async function sendEmail(options) {
    if (!EMAIL_USER || !EMAIL_PASS || !EMAIL_HOST || !EMAIL_PORT) {
        console.error("Email service ke liye environment variables (EMAIL_USER, EMAIL_PASS, EMAIL_HOST, EMAIL_PORT) poori tarah set nahi hain.");
        throw new Error("Email service theek se configure nahi hai. Administrator se contact karein.");
    }
    console.log(`Email bhejne ki koshish: To: ${options.email}, Subject: ${options.subject} (Host: ${EMAIL_HOST})`);
    const transporter = nodemailer.createTransport({
        host: EMAIL_HOST, port: parseInt(EMAIL_PORT), secure: parseInt(EMAIL_PORT) === 465,
        auth: { user: EMAIL_USER, pass: EMAIL_PASS },
    });
    const mailOptions = { from: `"Nobita Feedback App" <${EMAIL_USER}>`, to: options.email, subject: options.subject, text: options.message, html: options.html };
    try { let info = await transporter.sendMail(mailOptions); console.log('Email safaltapoorvak bheja gaya! Message ID: %s', info.messageId);
    } catch (error) { console.error('Nodemailer se email bhejne mein error:', error); if(error.responseCode === 535 || (error.command && error.command === 'AUTH LOGIN')) { console.error("SMTP Authentication Error: Username/Password galat ho sakta hai ya Gmail 'less secure app access'/'App Password' aavashyak hai."); } throw error; }
}

app.post('/api/auth/signup', async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: "Naam, email, aur password zaroori hai." });
    if (password.length < 6) return res.status(400).json({ message: "Password kam se kam 6 characters ka hona chahiye." });
    try {
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) return res.status(400).json({ message: "Yeh email pehle se register hai." });
        const hashedPassword = await bcrypt.hash(password, 12);
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
        const emailText = `Namaste ${newUser.name},\n\nAapne Nobita Feedback App par account banaya hai. Kripya apna email verify karne ke liye neeche diye gaye link par click karein:\n${verifyUrl}\n\nAgar aapne yeh request nahi ki thi, toh is email ko ignore kar dein.\n\nDhanyawad,\nNobita Feedback App Team`;
        const emailHtml = `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; padding: 20px; border: 1px solid #ddd; border-radius: 5px; background-color: #f9f9f9;"><h2 style="color: #6a0dad; border-bottom: 2px solid #FFD700; padding-bottom: 10px;">Email Verification</h2><p>Namaste ${newUser.name},</p><p>Aapne Nobita Feedback App par account banaya hai.</p><p>Kripya neeche diye gaye button par click karke apna email verify karein. Yeh link <strong>10 minute</strong> tak valid rahega:</p><p style="text-align: center; margin: 25px 0;"><a href="${verifyUrl}" style="background-color: #FFD700; color: #1A1A2E !important; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; border: 1px solid #E0C000; display: inline-block;">Email Verify Karein</a></p><p style="font-size: 0.9em;">Agar button kaam na kare, toh aap is link ko apne browser mein copy-paste kar sakte hain: <a href="${verifyUrl}" target="_blank" style="color: #3B82F6;">${verifyUrl}</a></p><p>Aapke email ki verification ke baad hi aap app ke sabhi features ka upyog kar payenge.</p><p>Agar aapne yeh request nahi ki thi, toh is email ko ignore kar dein.</p><hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;"><p style="font-size: 0.9em; color: #777;">Dhanyawad,<br/>Nobita Feedback App Team</p></div>`;
        
        try {
            await sendEmail({ email: newUser.email, subject: emailSubject, message: emailText, html: emailHtml });
        } catch (emailError) {
            console.error("Verification email bhejne mein error:", emailError);
        }

        const userForToken = { userId: newUser._id, name: newUser.name, email: newUser.email, avatarUrl: newUser.avatarUrl, loginMethod: 'email', isVerified: newUser.isVerified };
        const appToken = jwt.sign(userForToken, JWT_SECRET, { expiresIn: '7d' });
        res.status(201).json({ token: appToken, user: userForToken, message: "Account ban gaya hai. Kripya apna email verify karein." });
    } catch (error) {
        console.error('Signup mein error:', error);
        res.status(500).json({ message: "Account banane mein kuch दिक्कत aa gayi.", error: error.message });
    }
});
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email aur password zaroori hai." });
    try {
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) return res.status(401).json({ message: "Email ya password galat hai." });
        
        if (user.loginMethod === 'google' && !user.password) return res.status(401).json({ message: "Aapne Google se sign up kiya था. Kripya Google se login karein." });
        if (!user.password) return res.status(401).json({ message: "Login credentials sahi nahi hain." });
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ message: "Email ya password galat hai." });
        
        const userForToken = { userId: user._id, name: user.name, email: user.email, avatarUrl: user.avatarUrl, loginMethod: user.loginMethod, isVerified: user.isVerified };
        const appToken = jwt.sign(userForToken, JWT_SECRET, { expiresIn: '7d' });
        res.status(200).json({ token: appToken, user: userForToken });
    } catch (error) { console.error('Login mein error:', error); res.status(500).json({ message: "Login karne mein kuch दिक्कत aa gayi.", error: error.message });}
});
app.post('/api/auth/google-signin', async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: 'Google ID token nahi mila.' });
    try {
        const ticket = await googleClient.verifyIdToken({ idToken: token, audience: GOOGLE_CLIENT_ID });
        const payload = ticket.getPayload();
        if (!payload) throw new Error("Google token payload nahi mila.");
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
                    googleId, 
                    name, 
                    email: email.toLowerCase(), 
                    avatarUrl: googleAvatar || getDiceBearAvatarUrl(name), 
                    loginMethod: 'google',
                    isVerified: true
                });
            }
            await user.save();
        } else {
             if (user.avatarUrl !== googleAvatar && googleAvatar) { user.avatarUrl = googleAvatar; await user.save(); }
             if (!user.isVerified) { user.isVerified = true; await user.save(); }
        }
        const userForToken = { userId: user._id, name: user.name, email: user.email, avatarUrl: user.avatarUrl, loginMethod: 'google', isVerified: user.isVerified };
        const appToken = jwt.sign(userForToken, JWT_SECRET, { expiresIn: '7d' });
        res.status(200).json({ token: appToken, user: userForToken });
    } catch (error) { console.error('Google signin mein error:', error); res.status(401).json({ message: 'Google token invalid hai.', error: error.message });}
});
app.get('/api/auth/me', authenticateToken, (req, res) => { res.status(200).json(req.user); });

app.post('/api/auth/request-password-reset', async (req, res) => {
    const { email } = req.body; console.log(`Password reset request received for email: ${email}`);
    if (!email) return res.status(400).json({ message: "Email address zaroori hai." });
    if (!FRONTEND_URL) { console.error("CRITICAL: FRONTEND_URL .env file mein set nahi hai. Password reset link nahi banega."); return res.status(500).json({ message: "Server configuration mein error hai (FRONTEND_URL missing)." });}
    try {
        const user = await User.findOne({ email: email.toLowerCase(), loginMethod: 'email', isVerified: true });
        if (!user) { console.log(`Password reset: Email "${email}" system mein nahi mila, email/password account nahi hai, ya verified nahi hai.`); return res.status(200).json({ message: "Agar aapka email hamare system mein hai aur email/password account se juda hai, toh aapko password reset link mil jayga." });}
        const resetToken = crypto.randomBytes(32).toString('hex'); user.resetPasswordToken = resetToken; user.resetPasswordExpires = Date.now() + 3600000; await user.save();
        console.log(`Password reset token for ${user.email} generate hua. Expiry: ${new Date(user.resetPasswordExpires).toLocaleString()}`);
        const resetPagePath = "/reset-password.html"; const resetUrl = `${FRONTEND_URL}${resetPagePath}?token=${resetToken}`; console.log("Password Reset URL banaya gaya:", resetUrl);
        const textMessage = `Namaste ${user.name},\n\nAapko aapke Nobita Feedback App account ke liye password reset karne ki request mili hai.\nKripya neeche diye gaye link par click karke apna password reset karein. Yeh link 1 ghante tak valid rahega:\n${resetUrl}\n\nAgar aapne yeh request nahi ki thi, toh is email ko ignore kar dein.\n\nDhanyawad,\nNobita Feedback App Team`;
        const htmlMessage = `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; padding: 20px; border: 1px solid #ddd; border-radius: 5px; background-color: #f9f9f9;"><h2 style="color: #6a0dad; border-bottom: 2px solid #FFD700; padding-bottom: 10px;">Password Reset Request</h2><p>Namaste ${user.name},</p><p>Aapko aapke Nobita Feedback App account ke liye password reset karne ki request mili hai.</p><p>Kripya neeche diye gaye button par click karke apna password reset karein. Yeh link <strong>1 ghante</strong> tak valid rahega:</p><p style="text-align: center; margin: 25px 0;"><a href="${resetUrl}" style="background-color: #FFD700; color: #1A1A2E !important; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; border: 1px solid #E0C000; display: inline-block;">Password Reset Karein</a></p><p style="font-size: 0.9em;">Agar button kaam na kare, toh aap is link ko apne browser mein copy-paste kar sakte hain: <a href="${resetUrl}" target="_blank" style="color: #3B82F6;">${resetUrl}</a></p><p>Agar aapne yeh request nahi ki thi, toh is email ko ignore kar dein aur aapka password nahi badlega.</p><hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;"><p style="font-size: 0.9em; color: #777;">Dhanyawad,<br/>Nobita Feedback App Team</p></div>`;
        await sendEmail({ email: user.email, subject: 'Aapka Password Reset Link (Nobita Feedback App)', message: textMessage, html: htmlMessage });
        res.status(200).json({ message: "Password reset link aapke email par bhej diya gaya hai (agar email valid hai aur email/password account se juda hai)." });
    } catch (error) {
        console.error('Request password reset API mein error:', error);
        if (error.message && (error.message.includes("Email service theek se configure nahi hai") || error.message.includes("Invalid login")) || (error.code && (error.code === 'EAUTH' || error.code === 'EENVELOPE' || error.errno === -3008))) {
             res.status(500).json({ message: "Email bhejne mein kuch takniki samasya aa gayi hai. Kripya administrator se contact karein ya .env mein email settings check karein." });
        } else {
             res.status(500).json({ message: "Password reset request process karne mein kuch दिक्कत aa gayi hai." });
        }
    }
});
app.post('/api/auth/reset-password', async (req, res) => {
    const { token, password, confirmPassword } = req.body; console.log(`Password reset attempt for token: ${token ? token.substring(0,10)+'...' : 'NO TOKEN'}`);
    if (!token) return res.status(400).json({ message: "Password reset token nahi mila." });
    if (!password || !confirmPassword) return res.status(400).json({ message: "Naya password aur confirmation password zaroori hai." });
    if (password !== confirmPassword) return res.status(400).json({ message: "Passwords match nahi ho rahe." });
    if (password.length < 6) return res.status(400).json({ message: "Password kam se kam 6 characters ka hona chahiye." });
    try {
        const user = await User.findOne({ resetPasswordToken: token, resetPasswordExpires: { $gt: Date.now() } });
        if (!user) { console.log(`Password reset: Invalid or expired token "${token ? token.substring(0,10)+'...' : 'NO TOKEN'}"`); return res.status(400).json({ message: "Password reset token invalid hai ya expire ho chuka hai." });}
        
        user.password = await bcrypt.hash(password, 12); user.resetPasswordToken = undefined; user.resetPasswordExpires = undefined; await user.save();
        console.log(`Password safaltapoorvak reset hua user ke liye: ${user.email}`);
        const confirmationTextMessage = `Namaste ${user.name},\n\nAapka password Nobita Feedback App par safaltapoorvak reset ho gaya hai.\n\nAgar yeh aapne nahi kiya tha, toh kripya turant support se contact karein.`;
        const confirmationHtmlMessage = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#333"><p>Namaste ${user.name},</p><p>Aapka password Nobita Feedback App par safaltapoorvak reset ho gaya hai.</p><p>Ab aap apne naye password ke saath login kar sakte hain.</p><p>Agar yeh aapne nahi kiya tha, toh kripya turant hamari support team se contact karein.</p><hr><p>Dhanyawad,<br/>Nobita Feedback App Team</p></div>`;
        try { await sendEmail({ email: user.email, subject: 'Aapka Password Safaltapoorvak Reset Ho Gaya Hai', message: confirmationTextMessage, html: confirmationHtmlMessage});
        } catch (emailError) { console.error("Password reset confirmation email bhejne mein error:", emailError); }
        res.status(200).json({ message: "Aapka password safaltapoorvak reset ho gaya hai. Ab aap naye password se login kar sakte hain." });
    } catch (error) { console.error('Reset password API mein error:', error); res.status(500).json({ message: "Password reset karne mein kuch दिक्कत aa gayi." });}
});

app.post('/api/auth/request-email-verification', authenticateToken, async (req, res) => {
    console.log(`Email verification request received for user ID: ${req.user.userId}`);
    if (!FRONTEND_URL) {
        console.error("CRITICAL: FRONTEND_URL .env file mein set nahi hai. Verification link nahi banega.");
        return res.status(500).json({ message: "Server configuration mein error hai (FRONTEND_URL missing)." });
    }
    try {
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ message: "User nahi mila." });
        }
        if (user.loginMethod === 'google') {
            return res.status(400).json({ message: "Google accounts ko email verification ki zaroorat nahi hoti." });
        }
        if (user.isVerified) {
            return res.status(200).json({ message: "Aapka email pehle se hi verify kiya ja chuka hai." });
        }

        const verificationToken = crypto.randomBytes(32).toString('hex');
        user.emailVerificationToken = verificationToken;
        user.emailVerificationExpires = Date.now() + 10 * 60 * 1000; // 10 minutes expiry
        await user.save();

        console.log(`Email verification token for ${user.email} generate hua. Expiry: ${new Date(user.emailVerificationExpires).toLocaleString()}`);
        const verifyPagePath = "/verify-email.html";
        const verifyUrl = `${FRONTEND_URL}${verifyPagePath}?token=${verificationToken}`;
        const textMessage = `Namaste ${user.name},\n\nAapke Nobita Feedback App account ke liye email verification ki request mili hai.\nKripya neeche diye gaye link par click karke apna email verify karein. Yeh link 10 minute tak valid rahega:\n${verifyUrl}\n\nAgar aapne yeh request nahi ki thi, toh is email ko ignore kar dein.\n\nDhanyawad,\nNobita Feedback App Team`;
        const htmlMessage = `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; padding: 20px; border: 1px solid #ddd; border-radius: 5px; background-color: #f9f9f9;"><h2 style="color: #6a0dad; border-bottom: 2px solid #FFD700; padding-bottom: 10px;">Email Verification Request</h2><p>Namaste ${user.name},</p><p>Aapke Nobita Feedback App account ke liye email verification ki request mili hai.</p><p>Kripya neeche diye gaye button par click karke apna email verify karein. Yeh link <strong>10 minute</strong> tak valid rahega:</p><p style="text-align: center; margin: 25px 0;"><a href="${verifyUrl}" style="background-color: #FFD700; color: #1A1A2E !important; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; border: 1px solid #E0C000; display: inline-block;">Email Verify Karein</a></p><p style="font-size: 0.9em;">Agar button kaam na kare, toh aap is link ko apne browser mein copy-paste kar sakte hain: <a href="${verifyUrl}" target="_blank" style="color: #3B82F6;">${verifyUrl}</a></p><p>Agar aapne yeh request nahi ki thi, toh is email ko ignore kar dein.</p><hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;"><p style="font-size: 0.9em; color: #777;">Dhanyawad,<br/>Nobita Feedback App Team</p></div>`;

        await sendEmail({ email: user.email, subject: 'Aapka Email Verification Link (Nobita Feedback App)', message: textMessage, html: htmlMessage });
        res.status(200).json({ message: "Verification link aapke email par bhej diya gaya hai. Kripya apna inbox check karein." });

    } catch (error) {
        console.error('Request email verification API mein error:', error);
        res.status(500).json({ message: "Email verification request process karne mein kuch दिक्कत aa gayi." });
    }
});

app.post('/api/auth/verify-email', async (req, res) => {
    const { token } = req.body;
    console.log(`Email verification attempt for token: ${token ? token.substring(0,10)+'...' : 'NO TOKEN'}`);

    if (!token) {
        return res.status(400).json({ message: "Email verification token nahi mila." });
    }

    try {
        const user = await User.findOne({ emailVerificationToken: token, emailVerificationExpires: { $gt: Date.now() } });
        if (!user) {
            console.log(`Email verification: Invalid or expired token "${token ? token.substring(0,10)+'...' : 'NO TOKEN'}"`);
            return res.status(400).json({ message: "Email verification token invalid hai ya expire ho chuka hai." });
        }

        user.isVerified = true;
        user.emailVerificationToken = undefined;
        user.emailVerificationExpires = undefined;
        await user.save();

        console.log(`Email safaltapoorvak verify hua user ke liye: ${user.email}`);

        const confirmationTextMessage = `Namaste ${user.name},\n\nAapka email Nobita Feedback App par safaltapoorvak verify ho gaya hai.\nAb aap app ke sabhi features ka upyog kar sakte hain.\n\nDhanyawad,\nNobita Feedback App Team`;
        const confirmationHtmlMessage = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#333"><p>Namaste ${user.name},</p><p>Aapka email Nobita Feedback App par safaltapoorvak verify ho gaya hai.</p><p>Ab aap app ke sabhi features ka upyog kar sakte hain.</p><hr><p>Dhanyawad,<br/>Nobita Feedback App Team</p></div>`;
        try {
            await sendEmail({ email: user.email, subject: 'Aapka Email Safaltapoorvak Verify Ho Gaya Hai!', message: confirmationTextMessage, html: confirmationHtmlMessage });
        } catch (emailError) {
            console.error("Verification confirmation email bhejne mein error:", emailError);
        }

        const userForToken = { userId: user._id, name: user.name, email: user.email, avatarUrl: user.avatarUrl, loginMethod: user.loginMethod, isVerified: user.isVerified };
        const newToken = jwt.sign(userForToken, JWT_SECRET, { expiresIn: '7d' });

        res.status(200).json({ message: "Aapka email safaltapoorvak verify ho gaya hai.", token: newToken, user: userForToken });
    } catch (error) {
        console.error('Verify email API mein error:', error);
        res.status(500).json({ message: "Email verify karne mein kuch दिक्कत aa gayi." });
    }
});


const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

app.put('/api/user/profile', authenticateToken, isEmailVerified, async (req, res) => {
    const { name, avatarUrl } = req.body;
    const userId = req.user.userId;

    if (!name) {
        return res.status(400).json({ message: 'Name zaroori hai.' });
    }

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User nahi mila.' });
        }

        if (user.loginMethod === 'google') {
            if (name !== user.name) {
                return res.status(400).json({ message: 'Google login se jude accounts ka naam yahan se badla nahi ja sakta.' });
            }
            if (avatarUrl && avatarUrl !== user.avatarUrl) {
                user.avatarUrl = avatarUrl;
            }
        } else {
            user.name = name;
            if (avatarUrl) {
                user.avatarUrl = avatarUrl;
            } else if (user.avatarUrl && user.avatarUrl.startsWith('https://api.dicebear.com') && name !== req.user.name) {
                user.avatarUrl = getDiceBearAvatarUrl(name, Date.now().toString());
            }
        }
        
        await user.save();

        if (avatarUrl || (user.loginMethod === 'email' && name !== req.user.name)) {
            await Feedback.updateMany({ userId: user._id }, { $set: { avatarUrl: user.avatarUrl, name: user.name } });
        }

        const updatedUserForToken = { userId: user._id, name: user.name, email: user.email, avatarUrl: user.avatarUrl, loginMethod: user.loginMethod, isVerified: user.isVerified };
        const newToken = jwt.sign(updatedUserForToken, JWT_SECRET, { expiresIn: '7d' });

        res.status(200).json({ message: 'Profile safaltapoorvak update ho gaya!', user: updatedUserForToken, token: newToken });
    } catch (error) {
        console.error('Profile update mein error:', error);
        res.status(500).json({ message: 'Profile update nahi ho paya.', error: error.message });
    }
});

app.post('/api/user/change-password', authenticateToken, isEmailVerified, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.userId;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Current aur naya password zaroori hai.' });
    }
    if (newPassword.length < 6) {
        return res.status(400).json({ message: 'Naya password kam se kam 6 characters ka hona chahiye.' });
    }

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User nahi mila.' });
        }
        if (user.loginMethod === 'google') {
            return res.status(400).json({ message: 'Google login se jude accounts ka password yahan se badla nahi ja sakta.' });
        }
        if (!user.password) {
            return res.status(400).json({ message: 'Aapke account mein password set nahi hai. Kripya password reset feature ka upyog karein.' });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Current password galat hai.' });
        }

        user.password = await bcrypt.hash(newPassword, 12);
        await user.save();

        res.status(200).json({ message: 'Password safaltapoorvak badal gaya hai!' });
    } catch (error) {
        console.error('Password change mein error:', error);
        res.status(500).json({ message: 'Password badal nahi paya.', error: error.message });
    }
});

app.post('/api/user/upload-avatar', authenticateToken, isEmailVerified, upload.single('avatar'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'Koi file upload nahi ki gayi.' });
    }
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
        console.error("Cloudinary credentials missing. Cannot upload avatar.");
        return res.status(500).json({ message: 'Server par avatar upload service configured nahi hai.' });
    }

    try {
        const result = await new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream({
                folder: 'nobita_feedback_avatars',
                transformation: [
                    { width: 150, height: 150, crop: "fill", gravity: "face", radius: "max" },
                    { quality: "auto:eco" }
                ]
            }, (error, result) => {
                if (error) {
                    console.error('Cloudinary upload error:', error);
                    return reject(new Error(error.message));
                }
                if (!result || !result.secure_url) {
                    return reject(new Error('Cloudinary se URL nahi mila.'));
                }
                resolve(result);
            }).end(req.file.buffer);
        });

        const userId = req.user.userId;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User nahi mila.' });
        }

        user.avatarUrl = result.secure_url;
        await user.save();

        await Feedback.updateMany({ userId: user._id }, { $set: { avatarUrl: user.avatarUrl } });

        const updatedUserForToken = { userId: user._id, name: user.name, email: user.email, avatarUrl: user.avatarUrl, loginMethod: user.loginMethod, isVerified: user.isVerified };
        const newToken = jwt.sign(updatedUserForToken, JWT_SECRET, { expiresIn: '7d' });

        res.status(200).json({ message: 'Avatar safaltapoorvak upload ho gaya!', avatarUrl: user.avatarUrl, token: newToken });

    } catch (error) {
        console.error('Avatar upload route error:', error);
        res.status(500).json({ message: 'Avatar upload mein error.', error: error.message });
    }
});


app.use(express.static(path.join(__dirname, 'public')));
app.get('/api/feedbacks', async (req, res) => {
    try { 
        const allFeedbacks = await Feedback.find().populate({ path: 'userId', select: 'loginMethod name email isVerified' }).sort({ timestamp: -1 }); 
        res.status(200).json(allFeedbacks);
    } catch (error) { res.status(500).json({ message: 'Feedbacks fetch nahi ho paye.', error: error.message });}
});

app.post('/api/feedback', authenticateToken, async (req, res) => { 
    const { feedback, rating } = req.body; const userIp = req.clientIp;
    if (!req.user) return res.status(403).json({ message: "Feedback dene ke liye कृपया login karein." });
    if (!feedback || !rating || rating === '0') return res.status(400).json({ message: 'Feedback aur rating zaroori hai.' });
    
    try {
        const loggedInUser = await User.findById(req.user.userId);
        if (!loggedInUser) {
            return res.status(404).json({ message: "Logged-in user nahi mila." });
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
        
        if (loggedInUser.loginMethod === 'google' && loggedInUser.googleId) { 
            feedbackData.googleIdSubmitter = loggedInUser.googleId; 
        }

        const newFeedback = new Feedback(feedbackData); 
        await newFeedback.save(); 
        res.status(201).json({ message: 'Aapka feedback सफलतापूर्वक जमा ho gaya!', feedback: newFeedback });
    } catch (error) { 
        console.error("Feedback save error:", error); 
        res.status(500).json({ message: 'Feedback save nahi ho paya.', error: error.message });
    }
});

app.put('/api/feedback/:id', authenticateToken, isEmailVerified, async (req, res) => {
    const feedbackId = req.params.id; const { feedback, rating } = req.body; const loggedInJwtUser = req.user;
    if (!feedback || !rating || rating === '0') return res.status(400).json({ message: 'Update ke liye feedback aur rating zaroori hai!' });
    try {
        const existingFeedback = await Feedback.findById(feedbackId);
        if (!existingFeedback) return res.status(404).json({ message: 'Yeh feedback ID mila nahi.' });
        
        if (existingFeedback.userId.toString() !== loggedInJwtUser.userId) return res.status(403).json({ message: 'Aap sirf apne diye gaye feedbacks ko hi edit kar sakte hain.' });
        
        const currentUserFromDb = await User.findById(loggedInJwtUser.userId);
        if (!currentUserFromDb) {
            return res.status(404).json({ message: 'Feedback edit karne wala user nahi mila.' });
        }

        const currentNameFromDb = currentUserFromDb.name; 
        const currentAvatarFromDb = currentUserFromDb.avatarUrl;
        const parsedRating = parseInt(rating);
        
        const contentActuallyChanged = existingFeedback.feedback !== feedback || 
                                       existingFeedback.rating !== parsedRating || 
                                       existingFeedback.name !== currentNameFromDb ||
                                       existingFeedback.avatarUrl !== currentAvatarFromDb;
        
        if (contentActuallyChanged) {
            if (!existingFeedback.originalContent) { existingFeedback.originalContent = { name: existingFeedback.name, feedback: existingFeedback.feedback, rating: existingFeedback.rating, timestamp: existingFeedback.timestamp, avatarUrl: existingFeedback.avatarUrl };}
            existingFeedback.name = currentNameFromDb; 
            existingFeedback.feedback = feedback; 
            existingFeedback.rating = parsedRating; 
            existingFeedback.timestamp = Date.now(); 
            existingFeedback.isEdited = true; 
            existingFeedback.avatarUrl = currentAvatarFromDb;
        }
        await existingFeedback.save();
        res.status(200).json({ message: 'Aapka feedback update ho gaya!', feedback: existingFeedback });
    } catch (error) { console.error(`Feedback update error (ID: ${feedbackId}):`, error); res.status(500).json({ message: 'Feedback update nahi ho paya.', error: error.message });}
});

const authenticateAdmin = (req, res, next) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate'); res.setHeader('Pragma', 'no-cache'); res.setHeader('Expires', '0');
    const authHeader = req.headers.authorization; if (!authHeader) { res.set('WWW-Authenticate', 'Basic realm="Admin Area"'); return res.status(401).json({ message: 'UNAUTHORIZED: AUTH HEADER MISSING.' });}
    const [scheme, credentials] = authHeader.split(' '); if (scheme !== 'Basic' || !credentials) { res.set('WWW-Authenticate', 'Basic realm="Admin Area"'); return res.status(401).json({ message: 'UNAUTHORIZED: INVALID AUTH SCHEME.' });}
    const [username, password] = Buffer.from(credentials, 'base64').toString().split(':');
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) { next(); } else { res.set('WWW-Authenticate', 'Basic realm="Admin Area"'); res.status(401).json({ message: 'UNAUTHORIZED: INVALID ADMIN CREDENTIALS.' });}
};
app.get('/admin-panel-nobita', authenticateAdmin, async (req, res) => {
    console.log("Admin panel access attempt.");
    try {
        const feedbacks = await Feedback.find().populate({ path: 'userId', select: 'loginMethod name email isVerified' }).sort({ timestamp: -1 });
        const encodedCredentials = Buffer.from(`${ADMIN_USERNAME}:${ADMIN_PASSWORD}`).toString('base64');
        const authHeaderValue = `Basic ${encodedCredentials}`;
        console.log("Generated AUTH_HEADER for admin panel JS:", authHeaderValue ? "Present" : "MISSING/EMPTY");
        const nobitaAvatarUrl = 'https://i.ibb.co/FsSs4SG/creator-avatar.png';

        let html = `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>ADMIN PANEL: NOBITA'S COMMAND CENTER</title>
                <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;700&family=Montserrat:wght@400;600&display=swap" rel="stylesheet">
                <style>
                    :root {
                        --bg-dark: #1A1A2E;
                        --bg-medium: #16213E;
                        --card-bg: #222A35;
                        --text-light: #E0E0E0;
                        --text-medium: #BDC3C7;
                        --accent-yellow: #FFD700;
                        --accent-purple: #6a0dad;
                        --accent-green: #28a745; /* Changed to a standard green */
                        --accent-red: #E74C3C;
                        --accent-blue: #007bff; /* Changed to a standard blue */
                        --accent-orange: #fd7e14;
                        --border-color: #34495E;
                        --shadow-color: rgba(0,0,0,0.4);
                        --unverified-red: #dc3545; /* Specific red for unverified */
                        --verified-blue: #007bff; /* Specific blue for verified */
                    }
                    body {
                        font-family: 'Roboto', sans-serif;
                        background: linear-gradient(135deg, var(--bg-dark), var(--bg-medium));
                        color: var(--text-light);
                        margin: 0;
                        padding: 30px 20px;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        min-height: 100vh;
                        line-height: 1.6;
                        /* Subtle animated background gradient */
                        background-size: 400% 400%;
                        animation: gradientAnimation 15s ease infinite;
                    }
                    @keyframes gradientAnimation {
                        0% { background-position: 0% 50%; }
                        50% { background-position: 100% 50%; }
                        100% { background-position: 0% 50%; }
                    }
                    h1 {
                        font-family: 'Montserrat', sans-serif;
                        color: var(--accent-yellow);
                        text-align: center;
                        margin-bottom: 40px;
                        font-size: 3.2em;
                        text-shadow: 0 0 20px rgba(255,215,0,0.6);
                        letter-spacing: 2px;
                        animation: fadeInDown 1s ease-out;
                    }
                    @keyframes fadeInDown {
                        from { opacity: 0; transform: translateY(-20px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                    .nobibot-icon {
                        position: fixed;
                        top: 20px;
                        left: 20px;
                        width: 60px;
                        height: 60px;
                        border-radius: 50%;
                        background-color: rgba(255,215,0,0.2);
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        z-index: 1000;
                        box-shadow: 0 0 15px rgba(255,215,0,0.5);
                        animation: floatAnimation 3s ease-in-out infinite;
                    }
                    .nobibot-icon img {
                        width: 80%;
                        height: 80%;
                        object-fit: contain;
                    }
                    @keyframes floatAnimation {
                        0% { transform: translateY(0px); }
                        50% { transform: translateY(-10px); }
                        100% { transform: translateY(0px); }
                    }

                    .main-panel-btn-container {
                        width: 100%;
                        max-width: 1200px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 30px;
                        padding: 0 10px;
                        gap: 15px; /* Added gap for better spacing */
                        flex-wrap: wrap; /* Allow wrapping on smaller screens */
                    }
                    .search-filter-group {
                        display: flex;
                        gap: 10px;
                        flex-grow: 1;
                        max-width: 500px; /* Limit search bar width */
                    }
                    .search-input {
                        flex-grow: 1;
                        padding: 10px 15px;
                        border-radius: 8px;
                        border: 1px solid var(--border-color);
                        background-color: #34495E;
                        color: var(--text-light);
                        font-size: 1em;
                        box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);
                    }
                    .action-button {
                        padding: 12px 25px;
                        border: none;
                        border-radius: 10px;
                        font-size: 1.05em;
                        font-weight: 600;
                        cursor: pointer;
                        transition: background-color 0.3s ease, transform 0.2s, box-shadow 0.3s; /* Color transition */
                        text-transform: uppercase;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
                        background-color: var(--accent-blue);
                        color: white;
                    }
                    .action-button:hover {
                        transform: translateY(-3px) scale(1.02);
                        box-shadow: 0 6px 20px rgba(0,0,0,0.3);
                        background-color: #0056b3; /* Darker blue on hover */
                    }
                    .bulk-delete-btn {
                        background-color: var(--accent-red);
                    }
                    .bulk-delete-btn:hover {
                        background-color: #C0392B; /* Darker red on hover */
                    }
                    .filter-button {
                        background-color: #555;
                        color: white;
                    }
                    .filter-button.active {
                        background-color: var(--accent-yellow);
                        color: #1A1A2E;
                    }
                    .filter-button:hover {
                        background-color: #777;
                    }
                    .filter-button.active:hover {
                        background-color: #E0C000;
                    }
                    .export-button {
                        background-color: var(--accent-purple);
                    }
                    .export-button:hover {
                        background-color: #5a0a9a;
                    }

                    .select-all-container {
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        font-size: 1.1em;
                        color: var(--accent-yellow);
                        user-select: none; /* Prevent text selection */
                    }
                    .select-all-container input[type="checkbox"] {
                        width: 28px; /* Larger for touch */
                        height: 28px; /* Larger for touch */
                        cursor: pointer;
                        accent-color: var(--accent-yellow); /* Style checkbox */
                        min-width: 28px; /* Ensure it stays large */
                        min-height: 28px; /* Ensure it stays large */
                    }

                    .feedback-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); /* Slightly wider cards */
                        gap: 30px;
                        width: 100%;
                        max-width: 1200px;
                    }
                    .feedback-card {
                        background-color: transparent;
                        border-radius: 15px;
                        perspective: 1000px;
                        height: fit-content; /* Allow height to fit content */
                        min-height: 400px; /* Set a reasonable minimum height */
                    }
                    .feedback-card-inner {
                        position: relative;
                        width: 100%;
                        height: 100%; /* Ensure inner takes full height of parent card */
                        transition: transform 0.7s cubic-bezier(0.4, 0.2, 0.2, 1); /* Smoother flip */
                        transform-style: preserve-3d;
                        box-shadow: 0 10px 30px var(--shadow-color);
                        border-radius: 15px;
                    }
                    .feedback-card.is-flipped .feedback-card-inner {
                        transform: rotateY(180deg);
                    }
                    .feedback-card-front, .feedback-card-back {
                        position: absolute; /* Changed back to absolute for proper flip */
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%; /* Ensure both faces take full height of inner */
                        -webkit-backface-visibility: hidden;
                        backface-visibility: hidden;
                        background-color: var(--card-bg);
                        color: var(--text-medium);
                        border-radius: 15px;
                        padding: 25px;
                        box-sizing: border-box;
                        display: flex;
                        flex-direction: column;
                        justify-content: space-between;
                        max-height: none; /* Removed max-height from here */
                        overflow-y: auto; /* Allow scrolling within the face if content is too long */
                        border: 1px solid var(--border-color); /* Subtle border */
                    }
                    .feedback-card-back {
                        transform: rotateY(180deg);
                        background-color: #2C3540; /* Slightly different shade for back */
                    }
                    .feedback-header {
                        display: flex;
                        align-items: center;
                        gap: 18px; /* Increased gap */
                        margin-bottom: 20px; /* Increased margin */
                        flex-shrink: 0;
                        position: relative; /* For avatar change button positioning */
                    }
                    .feedback-avatar {
                        width: 70px; /* Larger avatar */
                        height: 70px;
                        border-radius: 50%;
                        overflow: hidden;
                        border: 4px solid var(--accent-yellow); /* Thicker border */
                        flex-shrink: 0;
                        box-shadow: 0 0 15px rgba(255,215,0,0.4);
                        position: relative;
                    }
                    .feedback-avatar img {
                        width: 100%;
                        height: 100%;
                        object-fit: cover;
                    }
                    .avatar-change-overlay {
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background-color: rgba(0, 0, 0, 0.6);
                        border-radius: 50%;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        opacity: 0;
                        transition: opacity 0.3s ease;
                        cursor: pointer;
                    }
                    .feedback-avatar:hover .avatar-change-overlay {
                        opacity: 1;
                    }
                    .avatar-change-overlay span {
                        color: white;
                        font-size: 1.8em;
                        font-weight: bold;
                    }

                    .feedback-info {
                        flex-grow: 1;
                        display: flex;
                        flex-direction: column;
                        align-items: flex-start;
                    }
                    .feedback-info h4 {
                        font-family: 'Montserrat', sans-serif;
                        margin: 0;
                        font-size: 1.4em; /* Larger name */
                        color: var(--accent-yellow);
                        text-transform: uppercase;
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        line-height: 1.2;
                    }
                    .feedback-info h4 small {
                        font-size: 0.75em;
                        color: #bbb;
                        text-transform: none;
                        margin-left: 5px;
                        display: block; /* Ensure email is on new line if needed */
                    }
                    .tag {
                        padding: 3px 8px;
                        border-radius: 5px;
                        font-size: 0.7em;
                        font-weight: bold;
                        margin-left: 8px;
                        vertical-align: middle;
                        white-space: nowrap; /* Prevent tags from breaking */
                        display: inline-flex; /* For better icon alignment */
                        align-items: center;
                        gap: 4px;
                    }
                    .google-user-tag { background-color: #4285F4; color: white; }
                    .email-user-tag { background-color: #6c757d; color: white; }
                    .verified-tag { background-color: var(--verified-blue); color: white; } /* Blue for verified */
                    .unverified-tag { background-color: var(--unverified-red); color: white; } /* Red for unverified */
                    .edited-admin-tag { background-color: #5cb85c; color: white; }

                    .feedback-info .rating {
                        font-size: 1.2em; /* Larger stars */
                        color: #F39C12;
                        margin-top: 8px;
                    }
                    .feedback-info .user-ip {
                        font-size: 0.9em;
                        color: #AAB7C8;
                        margin-top: 5px;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    }
                    .feedback-info .user-ip .copy-icon {
                        cursor: pointer;
                        color: var(--accent-blue);
                        font-size: 1.1em;
                        transition: color 0.2s ease;
                    }
                    .feedback-info .user-ip .copy-icon:hover {
                        color: var(--accent-yellow);
                    }

                    .feedback-body {
                        font-size: 1.05em; /* Slightly larger body text */
                        color: var(--text-light);
                        line-height: 1.7;
                        margin-bottom: 20px;
                        flex-grow: 1; /* Allow to grow */
                        min-height: 80px; /* Minimum height for feedback body */
                        overflow-y: auto; /* Keep scroll for long content within body */
                        word-wrap: break-word;
                        background-color: rgba(42, 51, 64, 0.7); /* Semi-transparent for glassmorphism */
                        backdrop-filter: blur(5px); /* Glassmorphism effect */
                        padding: 15px;
                        border-radius: 8px;
                        box-shadow: inset 0 1px 5px rgba(0,0,0,0.1);
                        position: relative; /* For copy button */
                    }
                    .feedback-body .copy-text-btn {
                        position: absolute;
                        top: 10px;
                        right: 10px;
                        background: rgba(255,255,255,0.1);
                        border: none;
                        border-radius: 5px;
                        color: var(--text-light);
                        font-size: 0.9em;
                        padding: 5px 8px;
                        cursor: pointer;
                        opacity: 0;
                        transition: opacity 0.2s ease;
                    }
                    .feedback-body:hover .copy-text-btn {
                        opacity: 1;
                    }
                    .feedback-date {
                        font-size: 0.85em;
                        color: #7F8C8D;
                        text-align: right;
                        margin-bottom: 15px;
                        border-top: 1px solid var(--border-color);
                        padding-top: 15px;
                        flex-shrink: 0;
                        display: flex; /* For icon alignment */
                        align-items: center;
                        justify-content: flex-end;
                        gap: 5px;
                    }
                    .feedback-date .icon {
                        font-size: 1.1em;
                        color: #7F8C8D;
                    }

                    .action-buttons {
                        display: flex;
                        gap: 12px; /* Increased gap */
                        margin-bottom: 15px;
                        flex-shrink: 0;
                    }
                    .action-buttons button {
                        flex-grow: 1;
                        padding: 12px 15px;
                        border: none;
                        border-radius: 8px;
                        font-size: 0.95em;
                        font-weight: bold;
                        cursor: pointer;
                        transition: background-color 0.3s ease, transform 0.2s;
                        text-transform: uppercase;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                    }
                    .action-buttons button:hover {
                        transform: translateY(-2px);
                        filter: brightness(1.1);
                    }
                    .delete-btn { background-color: var(--accent-red); color: white; }
                    .change-avatar-btn { background-color: var(--accent-blue); color: white; }
                    .flip-btn {
                        background-color: var(--accent-orange);
                        color: white;
                        margin-top: 15px;
                        width: 100%;
                        padding: 12px;
                        border: none;
                        border-radius: 8px;
                        font-weight: bold;
                        cursor: pointer;
                        transition: background-color 0.3s ease, transform 0.2s;
                        text-transform: uppercase;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                    }
                    .flip-btn:hover {
                        background-color: #e66800;
                        transform: translateY(-2px);
                    }

                    .reply-section {
                        border-top: 1px solid var(--border-color);
                        padding-top: 20px;
                        margin-top: 15px;
                        flex-shrink: 0;
                    }
                    .reply-section textarea {
                        width: calc(100% - 20px);
                        padding: 12px;
                        border: 1px solid #4A6070;
                        border-radius: 8px;
                        background-color: #34495E;
                        color: var(--text-light);
                        resize: vertical;
                        min-height: 60px;
                        margin-bottom: 12px;
                        font-size: 0.98em;
                        box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);
                        transition: all 0.3s ease; /* Animation for expand/collapse */
                    }
                    .reply-section textarea:focus {
                        min-height: 100px; /* Expand on focus */
                        box-shadow: 0 0 10px rgba(255,215,0,0.3);
                        border-color: var(--accent-yellow);
                    }
                    .reply-section textarea::placeholder {
                        color: #A9B7C0;
                    }
                    .smart-reply-buttons {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 8px;
                        margin-bottom: 12px;
                    }
                    .smart-reply-buttons button {
                        background-color: #4A6070;
                        color: var(--text-light);
                        border: none;
                        border-radius: 5px;
                        padding: 8px 12px;
                        font-size: 0.85em;
                        cursor: pointer;
                        transition: background-color 0.2s ease;
                    }
                    .smart-reply-buttons button:hover {
                        background-color: #5A7080;
                    }
                    .reply-btn {
                        background-color: var(--accent-green);
                        color: white;
                        width: 100%;
                        padding: 12px;
                        border: none;
                        border-radius: 8px;
                        font-weight: bold;
                        cursor: pointer;
                        transition: background-color 0.3s ease, transform 0.2s;
                        text-transform: uppercase;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                    }
                    .reply-btn:hover {
                        background-color: #229954;
                        transform: translateY(-2px);
                    }
                    .replies-display {
                        margin-top: 20px;
                        background-color: rgba(33, 48, 66, 0.7); /* Semi-transparent for glassmorphism */
                        backdrop-filter: blur(5px); /* Glassmorphism effect */
                        border-radius: 10px;
                        padding: 15px;
                        border: 1px solid #2C3E50;
                        max-height: 180px; /* Keep max-height for replies section */
                        overflow-y: auto; /* Keep scroll for very long replies */
                        box-shadow: inset 0 1px 5px rgba(0,0,0,0.1);
                    }
                    .replies-display h4 {
                        font-family: 'Montserrat', sans-serif;
                        color: #85C1E9;
                        font-size: 1.15em;
                        margin-bottom: 12px;
                        border-bottom: 1px solid #34495E;
                        padding-bottom: 10px;
                    }
                    .single-reply {
                        border-bottom: 1px solid #2C3E50;
                        padding-bottom: 12px;
                        margin-bottom: 12px;
                        font-size: 0.95em;
                        color: #D5DBDB;
                        display: flex;
                        align-items: flex-start;
                        gap: 12px;
                    }
                    .single-reply:last-child {
                        border-bottom: none;
                        margin-bottom: 0;
                    }
                    .admin-reply-avatar-sm {
                        width: 35px; /* Slightly larger */
                        height: 35px;
                        border-radius: 50%;
                        border: 2px solid #9B59B6;
                        flex-shrink: 0;
                        object-fit: cover;
                        box-shadow: 0 0 8px rgba(155,89,182,.5);
                    }
                    .reply-content-wrapper {
                        flex-grow: 1;
                        word-wrap: break-word;
                    }
                    .reply-admin-name {
                        font-weight: bold;
                        color: #9B59B6;
                        display: inline;
                        margin-right: 5px;
                    }
                    .reply-timestamp {
                        font-size: 0.8em;
                        color: #8E9A9D;
                        margin-left: 10px;
                        white-space: nowrap; /* Prevent timestamp from breaking */
                    }
                    
                    /* Custom Modal Styling */
                    .admin-modal-overlay {
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background: rgba(0,0,0,.85); /* Darker overlay */
                        display: none;
                        justify-content: center;
                        align-items: center;
                        z-index: 2000;
                        backdrop-filter: blur(5px); /* Blurred background */
                    }
                    .admin-custom-modal {
                        background: #2C3E50; /* Darker modal background */
                        padding: 40px; /* More padding */
                        border-radius: 18px; /* More rounded corners */
                        box-shadow: 0 15px 40px rgba(0,0,0,.6); /* Stronger shadow */
                        text-align: center;
                        color: var(--text-light);
                        width: 90%;
                        max-width: 550px; /* Wider modal */
                        border: 1px solid #4A6070;
                        animation: zoomIn 0.3s ease-out;
                    }
                    @keyframes zoomIn {
                        from { transform: scale(0.8); opacity: 0; }
                        to { transform: scale(1); opacity: 1; }
                    }
                    .admin-custom-modal h3 {
                        font-family: 'Montserrat', sans-serif;
                        color: var(--accent-yellow);
                        margin-top: 0;
                        margin-bottom: 20px;
                        font-size: 2.2em;
                        text-shadow: 0 0 10px rgba(255,215,0,0.3);
                    }
                    .admin-custom-modal p {
                        margin-bottom: 30px;
                        font-size: 1.15em;
                        line-height: 1.7;
                        color: #ccc;
                        word-wrap: break-word;
                    }
                    .admin-modal-buttons button {
                        background-color: var(--accent-blue);
                        color: white;
                        border: none;
                        padding: 14px 28px; /* Larger buttons */
                        border-radius: 10px;
                        cursor: pointer;
                        font-size: 1.05em;
                        margin: 8px; /* More margin */
                        transition: background-color 0.3s, transform 0.2s, box-shadow 0.3s;
                        font-weight: bold;
                        box-shadow: 0 3px 10px rgba(0,0,0,0.2);
                    }
                    .admin-modal-buttons button:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 5px 15px rgba(0,0,0,0.3);
                        filter: brightness(1.1);
                    }
                    #adminModalOkButton { background-color: var(--accent-green); }
                    #adminModalOkButton:hover { background-color: #229954; }
                    #adminModalConfirmButton { background-color: var(--accent-green); }
                    #adminModalConfirmButton:hover { background-color: #229954; }
                    #adminModalCancelButton { background-color: var(--accent-red); }
                    #adminModalCancelButton:hover { background-color: #C0392B; }

                    /* Toast Notification */
                    .toast-notification {
                        position: fixed;
                        bottom: 30px;
                        left: 50%;
                        transform: translateX(-50%);
                        background-color: rgba(50, 50, 50, 0.9);
                        color: white;
                        padding: 15px 25px;
                        border-radius: 8px;
                        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
                        z-index: 2001;
                        opacity: 0;
                        visibility: hidden;
                        transition: opacity 0.3s ease, visibility 0.3s ease;
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    }
                    .toast-notification.show {
                        opacity: 1;
                        visibility: visible;
                    }
                    .toast-notification.success { background-color: rgba(40, 167, 69, 0.9); }
                    .toast-notification.error { background-color: rgba(220, 53, 69, 0.9); }
                    .toast-notification .icon {
                        font-size: 1.5em;
                    }
                    .loader-overlay {
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background: rgba(0, 0, 0, 0.7);
                        display: none;
                        justify-content: center;
                        align-items: center;
                        z-index: 2002;
                    }
                    .loader {
                        border: 8px solid #f3f3f3; /* Light grey */
                        border-top: 8px solid var(--accent-yellow); /* Yellow */
                        border-radius: 50%;
                        width: 60px;
                        height: 60px;
                        animation: spin 1s linear infinite;
                    }
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }

                    /* Responsive Adjustments */
                    @media (max-width: 1024px) {
                        .feedback-grid {
                            grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
                            gap: 25px;
                        }
                        h1 { font-size: 2.8em; }
                    }
                    @media (max-width: 768px) {
                        body { padding: 20px 15px; }
                        h1 { font-size: 2.4em; margin-bottom: 30px; }
                        .nobibot-icon {
                            width: 50px;
                            height: 50px;
                            top: 15px;
                            left: 15px;
                        }
                        .main-panel-btn-container {
                            flex-direction: column;
                            align-items: stretch;
                            gap: 15px;
                            margin-bottom: 25px;
                        }
                        .search-filter-group {
                            flex-direction: column;
                            gap: 10px;
                            max-width: 100%;
                        }
                        .search-input { width: 100%; }
                        .select-all-container { margin-right: 0; justify-content: center; }
                        .action-button, .bulk-delete-btn, .filter-button, .export-button { width: 100%; }
                        .feedback-grid {
                            grid-template-columns: 1fr;
                            gap: 20px;
                        }
                        .feedback-card { min-height: auto; } /* Allow height to adjust */
                        .feedback-card-front, .feedback-card-back { padding: 20px; max-height: none; } /* Remove max-height on small screens */
                        .feedback-avatar { width: 60px; height: 60px; }
                        .feedback-info h4 { font-size: 1.2em; }
                        .feedback-body { font-size: 1em; padding: 12px; min-height: 60px; } /* Adjust min-height for mobile */
                        .action-buttons { flex-direction: column; gap: 10px; }
                        .action-buttons button { width: 100%; }
                        .reply-section textarea { width: calc(100% - 16px); padding: 10px; }
                        .admin-custom-modal { padding: 30px; }
                        .admin-custom-modal h3 { font-size: 1.8em; }
                        .admin-custom-modal p { font-size: 1em; }
                        .admin-modal-buttons button { padding: 10px 20px; }
                        .toast-notification {
                            width: 90%;
                            text-align: center;
                        }
                    }
                    @media (max-width: 480px) {
                        h1 { font-size: 2em; }
                        .feedback-avatar { width: 50px; height: 50px; }
                        .feedback-info h4 { font-size: 1.1em; }
                        .tag { font-size: 0.65em; padding: 2px 6px; }
                        .feedback-info .rating { font-size: 1em; }
                        .feedback-info .user-ip { font-size: 0.8em; }
                    }
                </style>
            </head>
            <body>
                <div class="nobibot-icon">
                    <img src="https://i.ibb.co/FsSs4SG/creator-avatar.png" alt="Nobibot">
                </div>
                <h1>NOBITA'S COMMAND CENTER</h1>
                <div class="main-panel-btn-container">
                    <div class="select-all-container">
                        <input type="checkbox" id="selectAllCheck" onchange="toggleSelectAll(this.checked)">
                        <label for="selectAllCheck">Select All</label>
                    </div>
                    <div class="search-filter-group">
                        <input type="text" id="searchFeedback" class="search-input" placeholder="Search by name or email...">
                        <button class="action-button filter-button" id="filterUnverified">Unverified</button>
                        <button class="action-button filter-button" id="filterEdited">Edited</button>
                        <button class="action-button filter-button" id="filterNoReplies">No Replies</button>
                        <button class="action-button filter-button" id="filterAll">All</button>
                    </div>
                    <button class="action-button bulk-delete-btn" onclick="tryDeleteSelectedFeedbacks()">Delete Selected</button>
                    <button class="action-button export-button" onclick="exportFeedbacks('csv')">Export CSV</button>
                    <button class="action-button export-button" onclick="exportFeedbacks('json')">Export JSON</button>
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
                       userTag = `<span class="tag google-user-tag" title="Google User (${fb.userId.email || ''})">Google</span>`;
                   } else if (fb.userId.loginMethod === 'email') {
                       userTag = `<span class="tag email-user-tag" title="Email User (${fb.userId.email || ''})">Email</span>`;
                   }
                   userEmailDisplay = fb.userId.email ? `<small>(${fb.userId.email})</small>` : '';

                   if (fb.userId.isVerified) {
                       userTag += `<span class="tag verified-tag" title="Email Verified">✔ Verified</span>`;
                   } else if (fb.userId.loginMethod === 'email') { // Only show unverified for email users
                       userTag += `<span class="tag unverified-tag" title="Email Not Verified">✖ Unverified</span>`;
                   }
                } else if (fb.googleIdSubmitter) {
                    // Fallback for older feedbacks submitted directly with googleId before userId population
                    userTag = `<span class="tag google-user-tag" title="Google User (Legacy)">Google</span>`;
                    userTag += `<span class="tag verified-tag" title="Email Verified">✔ Verified</span>`; // Assume legacy Google users were verified
                } else {
                    // Fallback for feedbacks without linked user or googleIdSubmitter
                    userTag = `<span class="tag email-user-tag" title="Legacy User">Unknown</span>`;
                }

                html += `
                    <div class="feedback-card" id="card-${fb._id}"
                         data-name="${userDisplayName}"
                         data-email="${fb.userId && fb.userId.email ? fb.userId.email : ''}"
                         data-is-verified="${fb.userId && fb.userId.isVerified ? 'true' : 'false'}"
                         data-is-edited="${fb.isEdited ? 'true' : 'false'}"
                         data-has-replies="${fb.replies && fb.replies.length > 0 ? 'true' : 'false'}">
                        <div class="feedback-card-inner">
                            <div class="feedback-card-front">
                                <div class="feedback-header">
                                    <input type="checkbox" class="feedback-checkbox" value="${fb._id}">
                                    <div class="feedback-avatar">
                                        <img src="${fb.avatarUrl || getDiceBearAvatarUrl(userDisplayName)}" alt="${userDisplayName.charAt(0) || 'U'}">
                                        ${fb.userId && fb.userId.loginMethod === 'email' ? `
                                            <div class="avatar-change-overlay" onclick="tryChangeUserAvatar('${fb.userId._id}', '${userDisplayName}')">
                                                <span>🔄</span>
                                            </div>
                                        ` : ''}
                                    </div>
                                    <div class="feedback-info">
                                        <h4>${userDisplayName} ${fb.isEdited ? '<span class="tag edited-admin-tag">EDITED</span>' : ''} ${userTag}</h4>
                                        <small style="font-size:0.7em; color:#bbb; text-transform:none; margin-top: 5px; display: block;">${userEmailDisplay.replace(/[()]/g, '')}</small>
                                        <div class="rating">${'★'.repeat(fb.rating)}${'☆'.repeat(5 - fb.rating)}</div>
                                        <div class="user-ip">
                                            IP: ${fb.userIp || 'N/A'}
                                            <span class="copy-icon" onclick="copyToClipboard('${fb.userIp || 'N/A'}')">📋</span>
                                            | UserID: ${fb.userId ? (fb.userId._id ? fb.userId._id.toString() : fb.userId.toString()) : 'N/A'}
                                            <span class="copy-icon" onclick="copyToClipboard('${fb.userId ? (fb.userId._id ? fb.userId._id.toString() : fb.userId.toString()) : 'N/A'}')">📋</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="feedback-body">
                                    <p>${fb.feedback}</p>
                                    <button class="copy-text-btn" onclick="copyToClipboard('${escapeHtml(fb.feedback)}')">Copy Text</button>
                                </div>
                                <div class="feedback-date">
                                    <span class="icon">🕒</span>
                                    ${fb.isEdited ? 'Last Edited' : 'Posted'}: ${new Date(fb.timestamp).toLocaleString()}
                                    ${fb.isEdited && fb.originalContent ? `<br><small>Original: ${new Date(fb.originalContent.timestamp).toLocaleString()}</small>` : ''}
                                </div>
                                <div class="action-buttons">
                                    <button class="action-button delete-btn" onclick="tryDeleteFeedback('${fb._id}')">DELETE</button>
                                    ${fb.userId && fb.userId.loginMethod === 'email' ? `<button class="action-button change-avatar-btn" onclick="tryChangeUserAvatar('${fb.userId._id}', '${userDisplayName}')">AVATAR</button>` : ''}
                                </div>
                                <div class="reply-section">
                                    <textarea id="reply-text-${fb._id}" placeholder="Admin reply..."></textarea>
                                    <div class="smart-reply-buttons">
                                        <button onclick="insertSmartReply('reply-text-${fb._id}', 'Thanks for your feedback!')">Thanks!</button>
                                        <button onclick="insertSmartReply('reply-text-${fb._id}', 'We are looking into this issue.')">Looking into it.</button>
                                        <button onclick="insertSmartReply('reply-text-${fb._id}', 'Your suggestion is valuable.')">Valuable suggestion.</button>
                                    </div>
                                    <button class="action-button reply-btn" onclick="tryPostReply('${fb._id}', 'reply-text-${fb._id}')">REPLY</button>
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
                                        <img src="${(fb.originalContent.avatarUrl || getDiceBearAvatarUrl(fb.originalContent.name || 'Original User'))}" alt="Original">
                                        ${fb.userId && fb.userId.loginMethod === 'email' ? `
                                            <div class="avatar-change-overlay" onclick="tryChangeUserAvatar('${fb.userId._id}', '${userDisplayName}')">
                                                <span>🔄</span>
                                            </div>
                                        ` : ''}
                                    </div>
                                    <div class="feedback-info">
                                        <h4>ORIGINAL: ${fb.originalContent.name}</h4>
                                        <div class="rating">${'★'.repeat(fb.originalContent.rating)}${'☆'.repeat(5 - fb.originalContent.rating)}</div>
                                        <div class="user-ip">
                                            IP: ${fb.userIp || 'N/A'}
                                            <span class="copy-icon" onclick="copyToClipboard('${fb.userIp || 'N/A'}')">📋</span>
                                            | UserID: ${fb.userId ? (fb.userId._id ? fb.userId._id.toString() : fb.userId.toString()) : 'N/A'}
                                            <span class="copy-icon" onclick="copyToClipboard('${fb.userId ? (fb.userId._id ? fb.userId._id.toString() : fb.userId.toString()) : 'N/A'}')">📋</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="feedback-body">
                                    <p>${fb.originalContent.feedback}</p>
                                    <button class="copy-text-btn" onclick="copyToClipboard('${escapeHtml(fb.originalContent.feedback)}')">Copy Text</button>
                                </div>
                                <div class="feedback-date">
                                    <span class="icon">🕒</span>
                                    Originally Posted: ${new Date(fb.originalContent.timestamp).toLocaleString()}
                                </div>
                                <div class="action-buttons">
                                    <button class="action-button delete-btn" onclick="tryDeleteFeedback('${fb._id}')">DELETE</button>
                                    ${fb.userId && fb.userId.loginMethod === 'email' ? `<button class="action-button change-avatar-btn" onclick="tryChangeUserAvatar('${fb.userId._id}', '${userDisplayName}')">AVATAR</button>` : ''}
                                </div>
                                <div class="reply-section">
                                    <textarea id="reply-text-original-${fb._id}" placeholder="Admin reply..."></textarea>
                                    <div class="smart-reply-buttons">
                                        <button onclick="insertSmartReply('reply-text-original-${fb._id}', 'Thanks for your feedback!')">Thanks!</button>
                                        <button onclick="insertSmartReply('reply-text-original-${fb._id}', 'We are looking into this issue.')">Looking into it.</button>
                                        <button onclick="insertSmartReply('reply-text-original-${fb._id}', 'Your suggestion is valuable.')">Valuable suggestion.</button>
                                    </div>
                                    <button class="action-button reply-btn" onclick="tryPostReply('${fb._id}', 'reply-text-original-${fb._id}')">REPLY</button>
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

                <div id="toastNotification" class="toast-notification">
                    <span id="toastIcon" class="icon"></span>
                    <span id="toastMessage"></span>
                </div>

                <div id="loaderOverlay" class="loader-overlay">
                    <div class="loader"></div>
                </div>

                <script>
                    // IMPORTANT: Define escapeHtml at the very top of the script block
                    function escapeHtml(text) {
                        var map = {
                            '&': '&amp;',
                            '<': '&lt;',
                            '>': '&gt;',
                            '"': '&quot;',
                            "'": '&#039;'
                        };
                        return text.replace(/[&<>"']/g, function(m) { return map[m]; });
                    }

                    const AUTH_HEADER = '${authHeaderValue}';
                    // Store all feedback data initially, will be filtered client-side
                    const allFeedbacksData = ${JSON.stringify(feedbacks)}; 

                    // --- Utility Functions ---
                    function showToast(message, type = 'success') {
                        const toast = document.getElementById('toastNotification');
                        const toastMessage = document.getElementById('toastMessage');
                        const toastIcon = document.getElementById('toastIcon');

                        toastMessage.textContent = message;
                        toast.className = 'toast-notification show ' + type; // Reset classes and add new ones

                        if (type === 'success') {
                            toastIcon.innerHTML = '✔'; // Checkmark
                        } else if (type === 'error') {
                            toastIcon.innerHTML = '✖'; // Cross
                        } else {
                            toastIcon.innerHTML = '';
                        }

                        setTimeout(() => {
                            toast.classList.remove('show');
                        }, 3000); // Hide after 3 seconds
                    }

                    function showLoader() {
                        document.getElementById('loaderOverlay').style.display = 'flex';
                    }

                    function hideLoader() {
                        document.getElementById('loaderOverlay').style.display = 'none';
                    }

                    // --- Modal Functions (from previous version, slightly adapted) ---
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

                    // --- Feedback Card Functions ---
                    function flipCard(id) {
                        document.getElementById(\`card-\${id}\`).classList.toggle('is-flipped');
                    }

                    // --- Copy to Clipboard ---
                    function copyToClipboard(text) {
                        const tempInput = document.createElement('textarea');
                        tempInput.value = text;
                        document.body.appendChild(tempInput);
                        tempInput.select();
                        document.execCommand('copy'); // Deprecated but widely supported in iframes
                        document.body.removeChild(tempInput);
                        showToast('Copied to clipboard!', 'success');
                    }

                    // --- Admin Action Functions ---
                    async function tryDeleteFeedback(id) {
                        console.log("Attempting to delete feedback ID:", id);
                        showAdminModal('confirm', 'Delete Feedback?', 'Are you sure you want to delete this feedback? This cannot be undone.', async confirmed => {
                            if (confirmed) {
                                showLoader();
                                try {
                                    const res = await fetch(\`/api/admin/feedback/\${id}\`, {
                                        method: 'DELETE',
                                        headers: {
                                            'Authorization': AUTH_HEADER
                                        }
                                    });
                                    if (res.ok) {
                                        showToast('Feedback deleted successfully!', 'success');
                                        // No longer reloading the entire page, just removing the card
                                        document.getElementById(\`card-\${id}\`).remove();
                                        // Re-apply filter to update counts/visibility if needed
                                        applyFilter(currentFilter);
                                    } else {
                                        const err = await res.json();
                                        console.error("Delete failed response:", err);
                                        showToast(\`Failed to delete: \${err.message || res.statusText}\`, 'error');
                                    }
                                } catch (e) {
                                    console.error("Delete fetch error:", e);
                                    showToast(\`Error during delete: \${e.message}\`, 'error');
                                } finally {
                                    hideLoader();
                                }
                            }
                        });
                    }

                    async function tryPostReply(fbId, txtId) {
                        const replyText = document.getElementById(txtId).value.trim();
                        console.log("Attempting to post reply to feedback ID:", fbId, "Text:", replyText);
                        if (!replyText) {
                            showToast('Please write something to reply.', 'error');
                            return;
                        }
                        showAdminModal('confirm', 'Post Reply?', \`Confirm reply: "\\\${replyText.substring(0,50)}..."\`, async confirmed => {
                            if (confirmed) {
                                showLoader();
                                try {
                                    const res = await fetch(\`/api/admin/feedback/\${fbId}/reply\`, {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json',
                                            'Authorization': AUTH_HEADER
                                        },
                                        body: JSON.stringify({ replyText, adminName: '👉𝙉𝙊𝘽𝙄𝙏𝘼🤟' })
                                    });
                                    if (res.ok) {
                                        showToast('Reply posted successfully!', 'success');
                                        // Instead of full reload, update the specific card's replies
                                        // In a real app, you'd dynamically add the reply to the DOM
                                        // For now, we'll reload to ensure consistency as dynamic update is complex
                                        setTimeout(() => location.reload(), 1000);
                                    } else {
                                        const err = await res.json();
                                        console.error("Reply failed response:", err);
                                        showToast(\`Failed to reply: \${err.message || res.statusText}\`, 'error');
                                    }
                                } catch (e) {
                                    console.error("Reply fetch error:", e);
                                    showToast(\`Error during reply: \${e.message}\`, 'error');
                                } finally {
                                    hideLoader();
                                    // If you implement dynamic update, remove this reload and update DOM here
                                }
                            }
                        });
                    }

                    async function tryChangeUserAvatar(userId, userName) {
                        console.log("Attempting to change avatar for user ID:", userId, "Name:", userName);
                        showAdminModal('confirm', 'Change Avatar?', \`Change avatar for \\\${userName}? This will regenerate avatar for this email user.\`, async confirmed => {
                            if (confirmed) {
                                showLoader();
                                try {
                                    const res = await fetch(\`/api/admin/user/\${userId}/change-avatar\`, {
                                        method: 'PUT',
                                        headers: {
                                            'Content-Type': 'application/json',
                                            'Authorization': AUTH_HEADER
                                        }
                                    });
                                    if (res.ok) {
                                        showToast('Avatar updated for ' + userName + '!', 'success');
                                        setTimeout(() => location.reload(), 1000);
                                    } else {
                                        const err = await res.json();
                                        console.error("Change avatar failed response:", err);
                                        showToast(\`Failed to change avatar: \${err.message || res.statusText}\`, 'error');
                                    }
                                } catch (e) {
                                    console.error("Change avatar fetch error:", e);
                                    showToast(\`Error during avatar change: \${e.message}\`, 'error');
                                } finally {
                                    hideLoader();
                                }
                            }
                        });
                    }
                    
                    function toggleSelectAll(checked) {
                        document.querySelectorAll('.feedback-checkbox').forEach(checkbox => {
                            checkbox.checked = checked;
                        });
                    }

                    async function tryDeleteSelectedFeedbacks() {
                        const selectedFeedbackIds = Array.from(document.querySelectorAll('.feedback-checkbox:checked')).map(cb => cb.value);
                        if (selectedFeedbackIds.length === 0) {
                            showToast('Please select at least one feedback to delete.', 'error');
                            return;
                        }

                        showAdminModal('confirm', 'Delete Selected Feedbacks?', \`Are you sure you want to delete \\\${selectedFeedbackIds.length} selected feedback(s)? This cannot be undone.\`, async confirmed => {
                            if (confirmed) {
                                showLoader();
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
                                        showToast(\`\\\${selectedFeedbackIds.length} feedback(s) deleted successfully.\`, 'success');
                                        // Remove deleted cards from DOM
                                        selectedFeedbackIds.forEach(id => {
                                            const card = document.getElementById(\`card-\${id}\`);
                                            if (card) card.remove();
                                        });
                                        applyFilter(currentFilter); // Re-apply filter
                                    } else {
                                        const err = await res.json();
                                        console.error("Batch delete failed response:", err);
                                        showToast(\`Failed to delete selected feedbacks: \\\${err.message || res.statusText}\`, 'error');
                                    }
                                } catch (e) {
                                    console.error("Batch delete fetch error:", e);
                                    showToast(\`Error during batch delete: \\\${e.message}\`, 'error');
                                } finally {
                                    hideLoader();
                                }
                            }
                        });
                    }

                    // --- Filtering Functions ---
                    let currentFilter = 'all'; // 'all', 'unverified', 'edited', 'noReplies'

                    function applyFilter(filterType) {
                        currentFilter = filterType;
                        const feedbackCards = document.querySelectorAll('.feedback-card');
                        const searchInput = document.getElementById('searchFeedback');
                        const searchTerm = searchInput.value.toLowerCase();

                        // Update active state of filter buttons
                        document.querySelectorAll('.filter-button').forEach(btn => btn.classList.remove('active'));
                        document.getElementById('filter' + filterType.charAt(0).toUpperCase() + filterType.slice(1)).classList.add('active');


                        feedbackCards.forEach(card => {
                            const name = card.dataset.name.toLowerCase();
                            const email = card.dataset.email.toLowerCase();
                            const isVerified = card.dataset.isVerified === 'true';
                            const isEdited = card.dataset.isEdited === 'true';
                            const hasReplies = card.dataset.hasReplies === 'true';

                            let matchesSearch = true;
                            if (searchTerm) {
                                matchesSearch = name.includes(searchTerm) || email.includes(searchTerm);
                            }

                            let matchesFilter = true;
                            if (filterType === 'unverified') {
                                matchesFilter = !isVerified;
                            } else if (filterType === 'edited') {
                                matchesFilter = isEdited;
                            } else if (filterType === 'noReplies') {
                                matchesFilter = !hasReplies;
                            }
                            // 'all' filter doesn't need specific matching beyond search

                            if (matchesSearch && matchesFilter) {
                                card.style.display = 'block';
                            } else {
                                card.style.display = 'none';
                            }
                        });
                    }

                    // Attach event listeners for filter buttons
                    document.getElementById('filterUnverified').addEventListener('click', () => applyFilter('unverified'));
                    document.getElementById('filterEdited').addEventListener('click', () => applyFilter('edited'));
                    document.getElementById('filterNoReplies').addEventListener('click', () => applyFilter('noReplies'));
                    document.getElementById('filterAll').addEventListener('click', () => applyFilter('all'));

                    // Initial filter application
                    applyFilter(currentFilter);

                    // Attach event listener for search input
                    document.getElementById('searchFeedback').addEventListener('input', () => applyFilter(currentFilter));


                    // --- Export Functions ---
                    function convertToCsv(data) {
                        if (data.length === 0) return '';

                        const headers = Object.keys(data[0]);
                        const csvRows = [];
                        csvRows.push(headers.join(',')); // Add header row

                        for (const row of data) {
                            const values = headers.map(header => {
                                const value = row[header] !== null && row[header] !== undefined ? String(row[header]) : '';
                                const escaped = value.replace(/"/g, '""'); // Escape double quotes
                                return '"' + escaped + '"'; // Wrap in double quotes using concatenation
                            });
                            csvRows.push(values.join(','));
                        }
                        return csvRows.join('\\n');
                    }

                    function downloadFile(filename, content, mimeType) {
                        const blob = new Blob([content], { type: mimeType });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = filename;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                    }

                    function exportFeedbacks(format) {
                        const visibleFeedbacks = [];
                        document.querySelectorAll('.feedback-card').forEach(card => {
                            if (card.style.display !== 'none') {
                                const id = card.id.replace('card-', '');
                                const feedback = allFeedbacksData.find(fb => fb._id === id);
                                if (feedback) {
                                    // Flatten the object for export
                                    visibleFeedbacks.push({
                                        _id: feedback._id,
                                        name: feedback.name,
                                        email: feedback.userId ? feedback.userId.email : 'N/A',
                                        feedback_text: feedback.feedback,
                                        rating: feedback.rating,
                                        timestamp: new Date(feedback.timestamp).toLocaleString(),
                                        avatar_url: feedback.avatarUrl,
                                        user_ip: feedback.userIp,
                                        user_id_ref: feedback.userId ? (feedback.userId._id || feedback.userId) : 'N/A',
                                        login_method: feedback.userId ? feedback.userId.loginMethod : 'N/A',
                                        is_verified: feedback.userId ? feedback.userId.isVerified : 'N/A',
                                        is_edited: feedback.isEdited,
                                        original_name: feedback.originalContent ? feedback.originalContent.name : '',
                                        original_feedback: feedback.originalContent ? feedback.originalContent.feedback : '',
                                        original_rating: feedback.originalContent ? feedback.originalContent.rating : '',
                                        original_timestamp: feedback.originalContent ? new Date(feedback.originalContent.timestamp).toLocaleString() : '',
                                        replies_count: feedback.replies ? feedback.replies.length : 0,
                                        // Corrected escaping for template literal within map
                                        replies_text: feedback.replies ? feedback.replies.map(r => '[' + r.adminName + ' @ ' + new Date(r.timestamp).toLocaleString() + '] ' + r.text).join('; ') : ''
                                    });
                                }
                            }
                        });

                        if (visibleFeedbacks.length === 0) {
                            showToast('No feedbacks to export based on current filters.', 'error');
                            return;
                        }

                        if (format === 'csv') {
                            const csv = convertToCsv(visibleFeedbacks);
                            downloadFile('feedbacks.csv', csv, 'text/csv');
                            showToast('Feedbacks exported to CSV!', 'success');
                        } else if (format === 'json') {
                            const json = JSON.stringify(visibleFeedbacks, null, 2);
                            downloadFile('feedbacks.json', json, 'application/json');
                            showToast('Feedbacks exported to JSON!', 'success');
                        }
                    }

                    // --- Smart Reply Functions ---
                    function insertSmartReply(textareaId, replyText) {
                        const textarea = document.getElementById(textareaId);
                        if (textarea) {
                            const currentText = textarea.value.trim();
                            if (currentText && !currentText.endsWith(' ')) {
                                textarea.value += ' ' + replyText + ' ';
                            } else {
                                textarea.value += replyText + ' ';
                            }
                            textarea.focus();
                        }
                    }

                    // --- Mobile Swipe for Flip (Basic) ---
                    document.querySelectorAll('.feedback-card-front').forEach(cardFront => {
                        let touchstartX = 0;
                        let touchendX = 0;

                        cardFront.addEventListener('touchstart', e => {
                            touchstartX = e.changedTouches[0].screenX;
                        }, false);

                        cardFront.addEventListener('touchend', e => {
                            touchendX = e.changedTouches[0].screenX;
                            handleGesture();
                        }, false);

                        function handleGesture() {
                            const swipeThreshold = 50; // Minimum pixels for a swipe
                            const cardId = cardFront.closest('.feedback-card').id.replace('card-', '');

                            // Ensure the card has a flip button (i.e., it's an edited feedback)
                            const flipButton = cardFront.closest('.feedback-card').querySelector('.flip-btn');
                            if (!flipButton) return;

                            if (touchendX < touchstartX - swipeThreshold) {
                                // Swiped left
                                flipCard(cardId);
                            }
                            if (touchendX > touchstartX + swipeThreshold) {
                                // Swiped right
                                flipCard(cardId);
                            }
                        }
                    });

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

app.delete('/api/admin/feedback/:id', authenticateAdmin, async (req, res) => {
    console.log(`ADMIN: Received DELETE request for feedback ID: ${req.params.id}`);
    try { const deletedFeedback = await Feedback.findByIdAndDelete(req.params.id); if (!deletedFeedback) { console.log(`ADMIN: Feedback ID ${req.params.id} not found for deletion.`); return res.status(404).json({ message: 'Feedback ID mila nahi.' });} console.log(`ADMIN: Feedback ID ${req.params.id} deleted successfully.`); res.status(200).json({ message: 'Feedback delete ho gaya.' });
    } catch (error) { console.error(`ADMIN: Error deleting feedback ID ${req.params.id}:`, error); res.status(500).json({ message: 'Feedback delete nahi ho paya.', error: error.message });}
 });

app.delete('/api/admin/feedbacks/batch-delete', authenticateAdmin, async (req, res) => {
    const { ids } = req.body;
    console.log(`ADMIN: Received BATCH DELETE request for feedback IDs:`, ids);

    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: 'Delete karne ke liye koi IDs nahi di gayi hain.' });
    }

    try {
        const result = await Feedback.deleteMany({ _id: { $in: ids } });
        if (result.deletedCount === 0) {
            console.log(`ADMIN: No feedbacks found to delete for the provided IDs.`);
            return res.status(404).json({ message: 'Diye gaye IDs ke liye koi feedbacks nahi mile.' });
        }
        console.log(`ADMIN: Successfully deleted ${result.deletedCount} feedbacks.`);
        res.status(200).json({ message: `${result.deletedCount} feedbacks safaltapoorvak delete ho gaye.`, deletedCount: result.deletedCount });
    } catch (error) {
        console.error(`ADMIN: Error during batch deleting feedbacks:`, error);
        res.status(500).json({ message: 'Selected feedbacks delete nahi ho paye.', error: error.message });
    }
});


app.post('/api/admin/feedback/:id/reply', authenticateAdmin, async (req, res) => {
    const feedbackId = req.params.id; const { replyText, adminName } = req.body; console.log(`ADMIN: Received POST request to reply to feedback ID: ${feedbackId} with text: ${replyText}`);
    if (!replyText) { console.log(`ADMIN: Reply text missing for feedback ID: ${feedbackId}`); return res.status(400).json({ message: 'Reply text daalo.' });}
    try { const feedback = await Feedback.findById(feedbackId); if (!feedback) { console.log(`ADMIN: Feedback ID ${feedbackId} not found for replying.`); return res.status(404).json({ message: 'Feedback ID mila nahi.' });}
    feedback.replies.push({ text: replyText, adminName: adminName || 'Admin', timestamp: new Date() }); await feedback.save(); console.log(`ADMIN: Reply added successfully to feedback ID: ${feedbackId}`); res.status(200).json({ message: 'Reply post ho gaya.', reply: feedback.replies[feedback.replies.length - 1] });
    } catch (error) { console.error(`ADMIN: Error replying to feedback ID ${feedbackId}:`, error); res.status(500).json({ message: 'Reply save nahi ho paya.', error: error.message });}
});
app.put('/api/admin/user/:userId/change-avatar', authenticateAdmin, async (req, res) => {
    const userId = req.params.userId; console.log(`ADMIN: Received PUT request to change avatar for user ID: ${userId}`);
    try { const userToUpdate = await User.findById(userId); if (!userToUpdate) { console.log(`ADMIN: User ID ${userId} not found for avatar change.`); return res.status(404).json({ message: 'User ID mila nahi.' });}
    if (userToUpdate.loginMethod === 'google') { console.log(`ADMIN: Attempt to change avatar for Google user ID: ${userId} denied.`); return res.status(400).json({ message: 'Google user ka avatar yahaan se change nahi kar sakte.' });}
    const userName = userToUpdate.name; if (!userName) { console.log(`ADMIN: User name missing for user ID: ${userId} for avatar generation.`); return res.status(400).json({ message: 'User ka naam nahi hai avatar generate karne ke liye.' });}
    const newAvatarUrl = getDiceBearAvatarUrl(userName, Date.now().toString()); userToUpdate.avatarUrl = newAvatarUrl; await userToUpdate.save(); console.log(`ADMIN: Avatar changed for user ID: ${userId} to ${newAvatarUrl}`);
    await Feedback.updateMany({ userId: userToUpdate._id }, { $set: { avatarUrl: newAvatarUrl } }); console.log(`ADMIN: Updated avatar in feedbacks for user ID: ${userId}`);
    res.status(200).json({ message: 'Avatar safaltapoorvak change ho gaya!', newAvatarUrl });
    } catch (error) { console.error(`ADMIN: Error changing avatar for user ID ${userId}:`, error); res.status(500).json({ message: 'Avatar change nahi ho paya.', error: error.message });}
});

app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    res.status(404).json({message: "API endpoint not found."});
  }
});

app.listen(PORT, () => {
    console.log(`Nobita ka server port ${PORT} par chalu ho gaya hai: http://localhost:${PORT}`);
});
