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

dotenv.config(); // Yeh local .env file ke liye hai, Render isko ignore karega

const app = express();
const PORT = process.env.PORT || 3000;

// Load from .env (Render par yeh dashboard se aayenge)
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

// Zaroori environment variables check karna
if (!MONGODB_URI || !JWT_SECRET || !FRONTEND_URL) {
    console.error("CRITICAL ERROR: MONGODB_URI, JWT_SECRET, ya FRONTEND_URL environment variable nahi mila.");
    console.error("Kripya Render dashboard ke 'Environment' section mein check karein ki yeh variables sahi Key aur Value ke saath set hain aur khaali (empty) nahi hain.");
    console.error("Changes save karne ke baad, service ko manually redeploy/restart karna na bhoolein.");
    process.exit(1); // Server start hone se rok dein
}
if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
    console.warn("WARNING: ADMIN_USERNAME ya ADMIN_PASSWORD environment variable nahi mila. Admin panel login kaam nahi karega.");
}
if (!GOOGLE_CLIENT_ID) {
    console.warn("WARNING: GOOGLE_CLIENT_ID environment variable nahi mila. Google Sign-In kaam nahi karega.");
}
if (!EMAIL_USER || !EMAIL_PASS || !EMAIL_HOST || !EMAIL_PORT) {
    console.warn("WARNING: Email service ke liye environment variables (EMAIL_USER, EMAIL_PASS, EMAIL_HOST, EMAIL_PORT) poori tarah set nahi hain. Password reset email kaam nahi karega.");
}
if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    console.warn("WARNING: Cloudinary environment variables poori tarah set nahi hain. Avatar upload kaam nahi karega.");
}


const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

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
  originalContent: { name: String, feedback: String, rating: Number, timestamp: Date },
  replies: [{ text: { type: String, required: true }, timestamp: { type: Date, default: Date.now }, adminName: { type: String, default: 'Admin' } }]
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
        const userAvatar = getDiceBearAvatarUrl(name);
        
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const newUser = new User({ 
            name, 
            email: email.toLowerCase(), 
            password: hashedPassword, 
            avatarUrl: userAvatar, 
            loginMethod: 'email',
            isVerified: false,
            emailVerificationToken: verificationToken,
            emailVerificationExpires: Date.now() + 10 * 60 * 1000
        });
        await newUser.save();

        const verifyPagePath = "/verify-email.html";
        const verifyUrl = `${FRONTEND_URL}${verifyPagePath}?token=${verificationToken}`;
        const emailSubject = 'Nobita Feedback App: Email Verification';
        const emailText = `Namaste ${newUser.name},\n\nAapne Nobita Feedback App par account banaya hai. Kripya apna email verify karne ke liye neeche diye gaye link par click karein:\n${verifyUrl}\n\nAgar aapne yeh request nahi ki thi, toh is email ko ignore kar dein.\n\nDhanyawad,\nNobita Feedback App Team`;
        const htmlMessage = `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; padding: 20px; border: 1px solid #ddd; border-radius: 5px; background-color: #f9f9f9;"><h2 style="color: #6a0dad; border-bottom: 2px solid #FFD700; padding-bottom: 10px;">Email Verification</h2><p>Namaste ${newUser.name},</p><p>Aapne Nobita Feedback App par account banaya hai.</p><p>Kripya neeche diye gaye button par click karke apna email verify karein. Yeh link <strong>10 minute</strong> tak valid rahega:</p><p style="text-align: center; margin: 25px 0;"><a href="${verifyUrl}" style="background-color: #FFD700; color: #1A1A2E !important; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; border: 1px solid #E0C000; display: inline-block;">Email Verify Karein</a></p><p style="font-size: 0.9em;">Agar button kaam na kare, toh aap is link ko apne browser mein copy-paste kar sakte hain: <a href="${verifyUrl}" target="_blank" style="color: #3B82F6;">${verifyUrl}</a></p><p>Aapke email ki verification ke baad hi aap app ke sabhi features ka upyog kar payenge.</p><p>Agar aapne yeh request nahi ki thi, toh is email ko ignore kar dein.</p><hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;"><p style="font-size: 0.9em; color: #777;">Dhanyawad,<br/>Nobita Feedback App Team</p></div>`;
        
        try {
            await sendEmail({ email: newUser.email, subject: emailSubject, message: emailText, html: htmlMessage });
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
             res.status(500).json({ message: "Password reset request process karne mein kuch दिक्कत aa gayi है." });
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
        console.log("Email Verification URL banaya gaya:", verifyUrl);

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

// User Profile Management Routes
// Profile update, password change, and avatar upload WILL require email verification
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
                user.avatarUrl = getDiceBearAvatarUrl(name);
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
        const allFeedbacks = await Feedback.find().populate({ path: 'userId', select: 'loginMethod isVerified' }).sort({ timestamp: -1 }); 
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
            if (!existingFeedback.originalContent) { existingFeedback.originalContent = { name: existingFeedback.name, feedback: existingFeedback.feedback, rating: existingFeedback.rating, timestamp: existingFeedback.timestamp };}
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

// Admin Panel Routes
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

        // --- Calculate Dashboard Stats (Statically for UI demo) ---
        const totalFeedbacksCount = feedbacks.length;
        const verifiedUsersCount = feedbacks.filter(fb => fb.userId && fb.userId.isVerified).length;
        const emailUsersCount = feedbacks.filter(fb => fb.userId && fb.userId.loginMethod === 'email').length;
        const googleUsersCount = feedbacks.filter(fb => fb.userId && fb.userId.loginMethod === 'google').length;
        const emailGoogleRatio = (emailUsersCount > 0 && googleUsersCount > 0) ? `${emailUsersCount}:${googleUsersCount}` : 'N/A';
        const unrepliedFeedbacks = feedbacks.filter(fb => !fb.replies || fb.replies.length === 0).length;


        const encodedCredentials = Buffer.from(`${ADMIN_USERNAME}:${ADMIN_PASSWORD}`).toString('base64');
        const authHeaderValue = `Basic ${encodedCredentials}`;
        console.log("Generated AUTH_HEADER for admin panel JS:", authHeaderValue ? "Present" : "MISSING/EMPTY");
        const nobitaAvatarUrl = 'https://i.ibb.co/FsSs4SG/creator-avatar.png'; // Example admin avatar

        let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>👑 NOBITA'S COMMAND CENTER 👑</title>
    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&family=Orbitron:wght@500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.9.6/lottie.min.js"></script>
    <style>
        :root {
            --dark-bg-start: #0a0a0c; /* Near pitch black */
            --dark-bg-end: #1a1a2e; /* Dark navy blue */
            --card-bg: rgba(25, 25, 40, 0.6); /* Slightly transparent dark blue/purple */
            --card-border: rgba(50, 50, 70, 0.3); /* Softer border */
            --text-color-light: #e0e0e0; /* Off-white for general text */
            --highlight-yellow: #FFD700; /* Gold/Neon Yellow */
            --highlight-cyan: #00FFFF; /* Bright Cyan */
            --highlight-purple: #9B59B6; /* Bright Purple */
            --neon-glow-color: #00FFFF; /* Cyan glow */
            --neon-glow-intensity: 0 0 5px var(--neon-glow-color), 0 0 15px var(--neon-glow-color), 0 0 30px var(--neon-glow-color);
            --delete-red: #E74C3C;
            --delete-red-hover: #C0392B;
            --success-green: #28a745;
            --success-green-hover: #229954;
            --warning-yellow: #ffc107;
            --info-blue: #3498DB;
            --info-blue-hover: #2980B9;
            --admin-reply-color: #85C1E9; /* Lighter blue for admin replies */

            /* Glassmorphism variables */
            --glass-blur: 15px;
            --glass-bg-opacity: 0.15;
            --glass-border-opacity: 0.2;
            --glass-shadow-opacity: 0.2;
        }

        /* Dark/Light Theme variables */
        body.light-theme {
            --dark-bg-start: #f0f0f5;
            --dark-bg-end: #e0e0e8;
            --card-bg: rgba(255, 255, 255, 0.7);
            --card-border: rgba(150, 150, 150, 0.3);
            --text-color-light: #333;
            --highlight-yellow: #DAA520;
            --highlight-cyan: #008B8B;
            --highlight-purple: #8A2BE2;
            --neon-glow-color: transparent; /* Neon effect off in light theme */
            --neon-glow-intensity: none;
            --delete-red: #DC3545;
            --delete-red-hover: #C82333;
            --success-green: #218838;
            --success-green-hover: #196F3D;
            --warning-yellow: #E0A800;
            --info-blue: #0069D9;
            --info-blue-hover: #0056B3;
            --admin-reply-color: #1E90FF;
            
            /* Glassmorphism adjusted for light theme */
            --glass-bg-opacity: 0.8;
            --glass-border-opacity: 0.5;
            --glass-shadow-opacity: 0.1;
        }


        body {
            font-family: 'Roboto', sans-serif;
            background: linear-gradient(135deg, var(--dark-bg-start), var(--dark-bg-end));
            color: var(--text-color-light);
            margin: 0;
            padding: 30px 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
            min-height: 100vh;
            transition: background 0.5s ease; /* Smooth theme transition */
        }

        h1 {
            font-family: 'Orbitron', sans-serif; /* Futuristic font */
            color: var(--highlight-yellow);
            text-align: center;
            margin-bottom: 40px;
            font-size: 3.5em; /* Larger, more impactful */
            text-shadow: var(--neon-glow-intensity), 0 0 20px rgba(255,215,0,0.7); /* Animated glow */
            animation: pulse-glow 2s infinite ease-in-out; /* Pulsing effect */
        }
        @keyframes pulse-glow {
            0% { text-shadow: var(--neon-glow-intensity), 0 0 20px rgba(255,215,0,0.7); }
            50% { text-shadow: var(--neon-glow-intensity), 0 0 35px rgba(255,215,0,0.9), 0 0 50px rgba(255,215,0,0.5); }
            100% { text-shadow: var(--neon-glow-intensity), 0 0 20px rgba(255,215,0,0.7); }
        }

        /* --- Glassmorphism Effect for containers --- */
        .main-container, .feedback-card, .admin-custom-modal, .dashboard-stat-card {
            background-color: rgba(25, 25, 40, var(--glass-bg-opacity)); /* Translucent background */
            backdrop-filter: blur(var(--glass-blur)); /* Frosted glass effect */
            -webkit-backdrop-filter: blur(var(--glass-blur));
            border: 1px solid rgba(var(--text-color-light), var(--glass-border-opacity)); /* Light border */
            box-shadow: 0 8px 32px 0 rgba(0, 0, 0, var(--glass-shadow-opacity)); /* Soft shadow */
            border-radius: 15px; /* Rounded corners */
            transition: background-color 0.5s ease, border-color 0.5s ease, box-shadow 0.5s ease;
        }


        .main-panel-btn-container {
            width: 100%;
            max-width: 1200px;
            display: flex;
            justify-content: space-between;
            margin-bottom: 20px;
            padding: 0 10px;
            align-items: center;
            flex-wrap: wrap; /* For responsiveness */
            gap: 15px; /* Space between buttons/elements */
        }
        .main-panel-btn {
            background-color: var(--info-blue); /* Info blue for primary action */
            color: white;
            padding: 10px 20px;
            border: none;
            border-radius: 8px;
            font-size: 1em;
            font-weight: bold;
            cursor: pointer;
            transition: background-color .3s ease,transform .2s, box-shadow .3s;
            text-decoration: none;
            display: inline-block;
            text-transform: uppercase;
            box-shadow: 0 0 5px rgba(0, 123, 255, 0.5); /* Subtle glow */
        }
        .main-panel-btn:hover {
            background-color: var(--info-blue-hover);
            transform: translateY(-2px);
            box-shadow: 0 0 15px rgba(0, 123, 255, 0.8); /* Enhanced glow on hover */
        }

        /* --- Dark/Light Mode Toggle --- */
        .theme-toggle {
            position: fixed;
            top: 20px;
            left: 20px;
            z-index: 1000;
            cursor: pointer;
            width: 50px;
            height: 25px;
            background-color: var(--card-bg);
            border-radius: 15px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 3px;
            box-shadow: var(--neon-glow-intensity);
            transition: background-color 0.3s ease, box-shadow 0.3s ease;
        }
        .theme-toggle .icon {
            font-size: 1.1em;
            width: 18px;
            height: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--highlight-yellow); /* Sun for dark, Moon for light */
            transition: color 0.3s ease;
        }
        .theme-toggle .slider {
            width: 20px;
            height: 20px;
            background-color: var(--highlight-purple);
            border-radius: 50%;
            position: absolute;
            left: 3px;
            transition: left 0.3s ease, background-color 0.3s ease;
        }
        body.light-theme .theme-toggle .slider {
            left: calc(100% - 23px);
            background-color: var(--info-blue);
        }
        body.light-theme .theme-toggle .icon.sun { color: var(--info-blue); }
        body.light-theme .theme-toggle .icon.moon { color: var(--highlight-yellow); }


        /* --- Dashboard Stats Cards --- */
        .dashboard-stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            width: 100%;
            max-width: 1200px;
            margin-bottom: 30px;
        }
        .dashboard-stat-card {
            padding: 25px;
            text-align: center;
            border-radius: 15px;
            /* Glassmorphism properties already applied from .main-container */
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 120px;
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .dashboard-stat-card:hover {
            transform: translateY(-5px) scale(1.02);
            box-shadow: var(--neon-glow-intensity);
        }
        .dashboard-stat-card .icon {
            font-size: 2.5em;
            color: var(--highlight-cyan);
            margin-bottom: 10px;
            text-shadow: 0 0 10px var(--highlight-cyan);
        }
        .dashboard-stat-card .value {
            font-family: 'Orbitron', sans-serif; /* Futuristic font for numbers */
            font-size: 2.2em;
            font-weight: 700;
            color: var(--highlight-yellow);
            text-shadow: 0 0 8px rgba(255,215,0,0.7);
        }
        .dashboard-stat-card .label {
            font-size: 0.9em;
            color: var(--text-color-light);
            margin-top: 5px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }


        /* --- Feedback Grid & Cards --- */
        .feedback-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
            gap: 30px;
            width: 100%;
            max-width: 1200px;
        }
        .feedback-card {
            position: relative;
            min-height: 500px; /* Adjust based on content */
            border-radius: 15px; /* Ensures glassmorphism is applied */
            overflow: hidden; /* For inner content */
            perspective: 1000px; /* For 3D flip */
        }
        .feedback-card-inner {
            position: absolute; /* Changed to absolute for proper flipping */
            width: 100%;
            height: 100%;
            transition: transform 0.7s cubic-bezier(0.4, 0.2, 0.2, 1.0); /* Smoother flip */
            transform-style: preserve-3d;
            box-shadow: 0 8px 25px rgba(0,0,0,.4);
            border-radius: 15px;
        }
        .feedback-card.is-flipped .feedback-card-inner {
            transform: rotateY(180deg);
        }
        .feedback-card-front, .feedback-card-back {
            position: absolute;
            width: 100%;
            height: 100%;
            -webkit-backface-visibility: hidden;
            backface-visibility: hidden;
            /* Glassmorphism properties inherited from .main-container */
            color: var(--text-color-light);
            border-radius: 15px;
            padding: 25px;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            overflow-y: auto; /* Allow scrolling for long content */
        }
        .feedback-card-back {
            transform: rotateY(180deg);
            background-color: rgba(25, 25, 40, 0.8); /* Slightly less transparent for back */
        }
        /* 3D Hover Effect */
        .feedback-card:hover .feedback-card-inner {
            transform: rotateY(0deg) scale(1.01) perspective(1000px) rotateX(2deg) rotateY(2deg); /* Slight 3D tilt */
            box-shadow: var(--neon-glow-intensity); /* Add neon glow on hover */
        }
        .feedback-card.is-flipped:hover .feedback-card-inner { /* Maintain flip on hover */
            transform: rotateY(180deg) scale(1.01) perspective(1000px) rotateX(2deg) rotateY(-2deg);
        }

        .feedback-header {
            display: flex;
            align-items: center;
            gap: 15px;
            margin-bottom: 15px;
            flex-shrink: 0;
        }
        .feedback-avatar {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            overflow: hidden;
            border: 3px solid transparent; /* For animated glow */
            box-shadow: 0 0 0 3px rgba(255,215,0,0.5); /* Default subtle glow */
            animation: avatar-glow-unverified 2s infinite ease-in-out; /* Default glow */
            flex-shrink: 0;
            position: relative; /* For proper glow positioning */
        }
        .feedback-avatar img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        /* Glowing Animated Avatar Borders */
        @keyframes avatar-glow-verified {
            0% { box-shadow: 0 0 0 3px rgba(40,167,69,0.5), 0 0 10px rgba(40,167,69,0.7); }
            50% { box-shadow: 0 0 0 3px rgba(40,167,69,0.7), 0 0 20px rgba(40,167,69,0.9); }
            100% { box-shadow: 0 0 0 3px rgba(40,167,69,0.5), 0 0 10px rgba(40,167,69,0.7); }
        }
        @keyframes avatar-glow-unverified {
            0% { box-shadow: 0 0 0 3px rgba(255,193,7,0.5), 0 0 10px rgba(255,193,7,0.7); }
            50% { box-shadow: 0 0 0 3px rgba(255,193,7,0.7), 0 0 20px rgba(255,193,7,0.9); }
            100% { box-shadow: 0 0 0 3px rgba(255,193,7,0.5), 0 0 10px rgba(255,193,7,0.7); }
        }
        @keyframes avatar-glow-google {
            0% { box-shadow: 0 0 0 3px rgba(66,133,244,0.5), 0 0 10px rgba(66,133,244,0.7); }
            50% { box-shadow: 0 0 0 3px rgba(66,133,244,0.7), 0 0 20px rgba(66,133,244,0.9); }
            100% { box-shadow: 0 0 0 3px rgba(66,133,244,0.5), 0 0 10px rgba(66,133,244,0.7); }
        }

        .feedback-info {
            flex-grow: 1;
            display: flex;
            flex-direction: column;
            align-items: flex-start;
        }
        .feedback-info h4 {
            margin: 0;
            font-size: 1.3em;
            color: var(--highlight-yellow);
            text-transform: uppercase;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .feedback-info h4 small {
            font-size: 0.7em;
            color: #bbb;
            text-transform: none;
            margin-left: 5px;
        }
        /* User Type Tags */
        .google-user-tag, .email-user-tag, .verified-tag, .unverified-tag {
            font-family: 'Roboto', sans-serif;
            font-size: 0.65em;
            padding: 2px 6px;
            border-radius: 4px;
            margin-left: 8px;
            vertical-align: middle;
            font-weight: 500;
        }
        .google-user-tag { background-color: #4285F4; color: white; }
        .email-user-tag { background-color: #6c757d; color: white; }
        .verified-tag { background-color: var(--success-green); color: white; }
        .unverified-tag { background-color: var(--warning-yellow); color: #333; }

        .feedback-info .rating {
            font-size: 1.1em;
            color: #F39C12;
            margin-top: 5px;
        }
        .feedback-info .user-ip {
            font-family: 'Orbitron', sans-serif;
            font-size: 0.8em;
            color: #AAB7B8;
            margin-top: 5px;
        }
        .feedback-body {
            font-size: 1em;
            color: var(--text-color-light);
            line-height: 1.6;
            margin-bottom: 15px;
            flex-grow: 1;
            overflow-y: auto;
            word-wrap: break-word;
        }
        .feedback-date {
            font-size: 0.8em;
            color: #7F8C8D;
            text-align: right;
            margin-bottom: 10px;
            border-top: 1px solid rgba(255,255,255,0.1);
            padding-top: 10px;
            flex-shrink: 0;
        }
        .action-buttons {
            display: flex;
            gap: 10px;
            margin-bottom: 10px;
            flex-shrink: 0;
        }
        .action-buttons button, .flip-btn {
            flex-grow: 1;
            padding: 12px 15px;
            border: none;
            border-radius: 8px;
            font-size: 0.9em;
            font-weight: bold;
            cursor: pointer;
            transition: all .3s ease-in-out;
            text-transform: uppercase;
            position: relative;
            overflow: hidden;
            background-color: rgba(25, 25, 40, 0.8); /* Slightly transparent */
            box-shadow: var(--neon-glow-intensity);
            text-shadow: 0 0 5px var(--neon-glow-color);
        }
        .action-buttons button:hover, .flip-btn:hover {
            transform: translateY(-3px) scale(1.02);
            box-shadow: var(--neon-glow-intensity), 0 0 40px var(--neon-glow-color);
            text-shadow: 0 0 10px var(--neon-glow-color), 0 0 20px var(--neon-glow-color);
        }
        .delete-btn { background-color: var(--delete-red); }
        .delete-btn:hover { background-color: var(--delete-red-hover); box-shadow: 0 0 5px var(--delete-red), 0 0 15px var(--delete-red), 0 0 30px var(--delete-red); text-shadow: 0 0 5px var(--delete-red); }
        .change-avatar-btn { background-color: var(--info-blue); }
        .change-avatar-btn:hover { background-color: var(--info-blue-hover); box-shadow: 0 0 5px var(--info-blue), 0 0 15px var(--info-blue), 0 0 30px var(--info-blue); text-shadow: 0 0 5px var(--info-blue); }
        .flip-btn { background-color: var(--highlight-purple); color: white; margin-top: 10px; }
        .flip-btn:hover { background-color: rgba(155,89,182,0.8); box-shadow: 0 0 5px var(--highlight-purple), 0 0 15px var(--highlight-purple), 0 0 30px var(--highlight-purple); text-shadow: 0 0 5px var(--highlight-purple); }


        .reply-section {
            border-top: 1px solid rgba(255,255,255,0.1);
            padding-top: 15px;
            margin-top: 10px;
            flex-shrink: 0;
        }
        .reply-section textarea {
            width: calc(100% - 20px);
            padding: 10px;
            border: 1px solid rgba(255,255,255,0.2);
            border-radius: 8px;
            background-color: rgba(50, 50, 70, 0.4);
            color: var(--text-color-light);
            resize: vertical;
            min-height: 50px;
            margin-bottom: 10px;
            font-size: .95em;
            box-shadow: inset 0 0 5px rgba(0,0,0,0.3);
        }
        .reply-section textarea::placeholder { color: #A9B7C0; }
        .reply-btn {
            background-color: var(--success-green);
            color: white;
            width: 100%;
            padding: 12px;
            border: none;
            border-radius: 8px;
            font-weight: bold;
            cursor: pointer;
            transition: background-color .3s ease,transform .2s, box-shadow .3s;
            text-transform: uppercase;
            box-shadow: 0 0 5px var(--success-green);
            text-shadow: 0 0 5px var(--success-green);
        }
        .reply-btn:hover {
            background-color: var(--success-green-hover);
            transform: translateY(-2px) scale(1.01);
            box-shadow: 0 0 15px var(--success-green), 0 0 30px var(--success-green);
            text-shadow: 0 0 10px var(--success-green);
        }

        .replies-display {
            margin-top: 15px;
            background-color: rgba(25, 25, 40, 0.4);
            border-radius: 10px;
            padding: 10px;
            border: 1px solid rgba(255,255,255,0.15);
            max-height: 150px;
            overflow-y: auto;
            box-shadow: inset 0 0 5px rgba(0,0,0,0.2);
        }
        .replies-display h4 {
            color: var(--admin-reply-color);
            font-size: 1.1em;
            margin-bottom: 10px;
            border-bottom: 1px solid rgba(255,255,255,0.1);
            padding-bottom: 8px;
        }
        .single-reply {
            border-bottom: 1px solid rgba(255,255,255,0.08);
            padding-bottom: 10px;
            margin-bottom: 10px;
            font-size: .9em;
            color: var(--text-color-light);
            display: flex;
            align-items: flex-start;
            gap: 10px;
        }
        .single-reply:last-child { border-bottom: none; margin-bottom: 0; }
        .admin-reply-avatar-sm {
            width: 30px;
            height: 30px;
            border-radius: 50%;
            border: 2px solid var(--highlight-purple);
            flex-shrink: 0;
            object-fit: cover;
            box-shadow: 0 0 5px rgba(155,89,182,.5);
        }
        .reply-content-wrapper { flex-grow: 1; word-wrap: break-word; }
        .reply-admin-name { font-weight: bold; color: var(--highlight-purple); display: inline; margin-right: 5px; }
        .reply-timestamp { font-size: .75em; color: #8E9A9D; margin-left: 10px; }
        .edited-admin-tag {
            background-color: #5cb85c;
            color: white;
            padding: 3px 8px;
            border-radius: 5px;
            font-size: .75em;
            font-weight: bold;
            vertical-align: middle;
        }
        /* Stylish Modal Popups */
        .admin-modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,.75);
            backdrop-filter: blur(5px);
            -webkit-backdrop-filter: blur(5px);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 2000;
            opacity: 0;
            transition: opacity 0.3s ease;
        }
        .admin-modal-overlay.active { opacity: 1; display: flex; }

        .admin-custom-modal {
            background-color: rgba(25, 25, 40, 0.8);
            padding: 30px;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0,0,0,.5);
            text-align: center;
            color: var(--text-color-light);
            width: 90%;
            max-width: 480px;
            border: 1px solid rgba(255,255,255,0.2);
            transform: scale(0.8);
            opacity: 0;
            transition: all 0.3s cubic-bezier(0.3, 0.7, 0.4, 1.0);
        }
        .admin-modal-overlay.active .admin-custom-modal {
            transform: scale(1);
            opacity: 1;
        }

        .admin-custom-modal h3 {
            color: var(--highlight-yellow);
            margin-top: 0;
            margin-bottom: 15px;
            font-size: 1.8em;
        }
        .admin-custom-modal p {
            margin-bottom: 25px;
            font-size: 1.1em;
            line-height: 1.6;
            color: var(--text-color-light);
            word-wrap: break-word;
        }
        .admin-modal-buttons button {
            background-color: var(--info-blue);
            color: white;
            border: none;
            padding: 12px 22px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 1em;
            margin: 5px;
            transition: background-color .3s,transform .2s, box-shadow .3s;
            font-weight: bold;
            box-shadow: 0 0 5px var(--info-blue);
        }
        .admin-modal-buttons button:hover {
            transform: translateY(-2px);
            box-shadow: 0 0 15px var(--info-blue);
        }
        #adminModalOkButton:hover { background-color: var(--info-blue-hover); }
        #adminModalConfirmButton { background-color: var(--success-green); }
        #adminModalConfirmButton:hover { background-color: var(--success-green-hover); box-shadow: 0 0 15px var(--success-green); }
        #adminModalCancelButton { background-color: var(--delete-red); }
        #adminModalCancelButton:hover { background:none; color:var(--delete-red); box-shadow: none; }
        
        .select-all-container { display: flex; align-items: center; gap: 10px; margin-right: 20px; }
        .select-all-container label { font-size: 1.1em; color: var(--highlight-yellow); }
        .select-all-container input[type="checkbox"] { width: 20px; height: 20px; cursor: pointer; }
        .bulk-delete-btn {
            background-color: var(--delete-red);
            color: white;
            padding: 10px 20px;
            border: none;
            border-radius: 8px;
            font-size: 1em;
            font-weight: bold;
            cursor: pointer;
            transition: background-color .3s ease,transform .2s, box-shadow .3s;
            text-transform: uppercase;
            margin-left: auto;
            box-shadow: 0 0 5px var(--delete-red);
            text-shadow: 0 0 5px var(--delete-red);
        }
        .bulk-delete-btn:hover {
            background-color: var(--delete-red-hover);
            transform: translateY(-2px);
            box-shadow: 0 0 15px var(--delete-red), 0 0 30px var(--delete-red);
            text-shadow: 0 0 10px var(--delete-red);
        }
        .feedback-checkbox { width: 20px; height: 20px; margin-left: 5px; cursor: pointer; align-self: flex-start; }
        
        @media (max-width:768px){
            h1{font-size:2.5em;}
            .dashboard-stats-grid { grid-template-columns: 1fr; }
            .feedback-grid{grid-template-columns:1fr;}
            .main-panel-btn-container{flex-direction:column; gap: 15px;}
            .select-all-container {margin-right: 0;}
            .bulk-delete-btn {width: 100%; margin-left: 0;}
        }
    </style>
</head>
<body>
    <div class="theme-toggle" onclick="toggleTheme()">
        <span class="icon sun"><i class="fas fa-sun"></i></span>
        <span class="icon moon"><i class="fas fa-moon"></i></span>
        <div class="slider"></div>
    </div>

    <h1 id="animated-header">👑 NOBITA'S COMMAND CENTER 👑</h1>

    <div class="dashboard-stats-grid">
        <div class="dashboard-stat-card">
            <div class="icon"><i class="fas fa-comments"></i></div>
            <div class="value" id="stat-total-feedbacks">${totalFeedbacksCount}</div>
            <div class="label">Total Feedbacks</div>
        </div>
        <div class="dashboard-stat-card">
            <div class="icon"><i class="fas fa-user-check"></i></div>
            <div class="value" id="stat-verified-users">${verifiedUsersCount}</div>
            <div class="label">Verified Users</div>
        </div>
        <div class="dashboard-stat-card">
            <div class="icon"><i class="fas fa-chart-pie"></i></div>
            <div class="value" id="stat-user-ratio">${emailGoogleRatio}</div>
            <div class="label">Email : Google Users</div>
        </div>
        <div class="dashboard-stat-card">
            <div class="icon"><i class="fas fa-inbox"></i></div>
            <div class="value" id="stat-unreplied-feedbacks">${unrepliedFeedbacks}</div>
            <div class="label">Unreplied Feedbacks</div>
        </div>
    </div>


    <div class="main-panel-btn-container">
        <a href="/" class="main-panel-btn"><i class="fas fa-arrow-left"></i> MAIN FEEDBACK PANEL</a>
        <div class="select-all-container">
            <input type="checkbox" id="selectAllFeedbacks" onchange="toggleSelectAll(this.checked)">
            <label for="selectAllFeedbacks">Select All</label>
        </div>
        <button class="bulk-delete-btn" onclick="tryDeleteSelectedFeedbacks()"><i class="fas fa-trash-alt"></i> DELETE SELECTED</button>
    </div>

    <div class="feedback-grid">`;
        if (feedbacks.length === 0) {
            html += `<p style="text-align:center;color:var(--text-color-light);font-size:1.2em;grid-column:1 / -1;">Abhi tak koi feedback nahi aaya hai!</p>`;
        } else {
            for (const fb of feedbacks) {
                let userTag = ''; 
                let userDisplayName = fb.userId && fb.userId.name ? fb.userId.name : fb.name;
                
                if (!userDisplayName) {
                    userDisplayName = 'Unknown User'; 
                }
                let userEmailDisplay = '';
                let avatarGlowClass = '';

                if (fb.userId && typeof fb.userId === 'object') {
                   if (fb.userId.loginMethod === 'google') {
                       userTag = `<span class="google-user-tag" title="Google User (${fb.userId.email || ''})">G</span>`;
                       avatarGlowClass = 'avatar-glow-google';
                   } else {
                       avatarGlowClass = fb.userId.isVerified ? 'avatar-glow-verified' : 'avatar-glow-unverified';
                   }
                   userEmailDisplay = fb.userId.email ? `<small>(${fb.userId.email})</small>` : '';

                   if (fb.userId.isVerified) {
                       userTag += `<span class="verified-tag" title="Email Verified">✔ Verified</span>`;
                   } else if (fb.userId.loginMethod === 'email') {
                       userTag += `<span class="unverified-tag" title="Email Not Verified">✖ Unverified</span>`;
                   }
                } else if (fb.googleIdSubmitter) {
                    userTag = `<span class="google-user-tag" title="Google User (Legacy)">G</span>`;
                    userTag += `<span class="verified-tag" title="Email Verified">✔ Verified</span>`;
                    avatarGlowClass = 'avatar-glow-google';
                } else {
                    userTag = `<span class="email-user-tag" title="Legacy User">U</span>`;
                    avatarGlowClass = 'avatar-glow-unverified';
                }

                html += `<div class="feedback-card" id="card-${fb._id}">
                            <div class="feedback-card-inner">
                                <div class="feedback-card-front">
                                    <div class="feedback-header">
                                        <input type="checkbox" class="feedback-checkbox" value="${fb._id}">
                                        <div class="feedback-avatar ${avatarGlowClass}">
                                            <img src="${fb.avatarUrl || getDiceBearAvatarUrl(userDisplayName)}" alt="${userDisplayName.charAt(0) || 'U'}">
                                        </div>
                                        <div class="feedback-info">
                                            <h4>${userDisplayName} ${fb.isEdited ? '<span class="edited-admin-tag">EDITED</span>' : ''} ${userTag}</h4>
                                            <small style="font-size:0.7em; color:#bbb; text-transform:none; display: block;">${userEmailDisplay.replace(/[()]/g, '')}</small>
                                            <div class="rating">${'★'.repeat(fb.rating)}${'☆'.repeat(5 - fb.rating)}</div>
                                            <div class="user-ip">IP: ${fb.userIp || 'N/A'} | UserID: ${fb.userId ? (fb.userId._id ? fb.userId._id.toString().substring(0,10) : fb.userId.toString().substring(0,10)) + '...' : 'N/A'}</div>
                                        </div>
                                    </div>
                                    <div class="feedback-body">
                                        <p>${fb.feedback}</p>
                                        <div style="text-align: right; margin-top: 10px; font-size: 1.5em;">
                                            ${fb.rating === 5 ? '😍' : fb.rating === 4 ? '👍' : fb.rating === 3 ? '😐' : fb.rating === 2 ? '👎' : '😤'}
                                        </div>
                                    </div>
                                    <div class="feedback-date">
                                        ${fb.isEdited ? 'Last Edited' : 'Posted'}: ${new Date(fb.timestamp).toLocaleString()}${fb.isEdited && fb.originalContent ? `<br><small>Original: ${new Date(fb.originalContent.timestamp).toLocaleString()}</small>` : ''}
                                    </div>
                                    <div class="action-buttons">
                                        <button class="delete-btn" onclick="tryDeleteFeedback('${fb._id}')"><i class="fas fa-trash-alt"></i> DELETE</button>
                                        ${fb.userId && fb.userId.loginMethod === 'email' ? `<button class="change-avatar-btn" onclick="tryChangeUserAvatar('${fb.userId._id}', '${userDisplayName}')"><i class="fas fa-user-circle"></i> AVATAR</button>` : ''}
                                    </div>
                                    <div class="reply-section">
                                        <textarea id="reply-text-${fb._id}" placeholder="Admin reply..."></textarea>
                                        <button class="reply-btn" onclick="tryPostReply('${fb._id}', 'reply-text-${fb._id}')"><i class="fas fa-reply"></i> REPLY</button>
                                        <div class="replies-display">
                                            ${fb.replies && fb.replies.length > 0 ? '<h4>Replies:</h4>' : ''}
                                            ${fb.replies.map(reply => `<div class="single-reply"><img src="${nobitaAvatarUrl}" alt="Admin" class="admin-reply-avatar-sm"><div class="reply-content-wrapper"><span class="reply-admin-name">${reply.adminName}:</span> ${reply.text}<span class="reply-timestamp">(${new Date(reply.timestamp).toLocaleString()})</span></div></div>`).join('')}
                                        </div>
                                    </div>
                                    ${fb.isEdited && fb.originalContent ? `<button class="flip-btn" onclick="flipCard('${fb._id}')"><i class="fas fa-sync-alt"></i> VIEW ORIGINAL</button>` : ''}
                                </div>`;
                if (fb.isEdited && fb.originalContent) {
                    html += `<div class="feedback-card-back">
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
                                        <div style="text-align: right; margin-top: 10px; font-size: 1.5em;">
                                            ${fb.originalContent.rating === 5 ? '😍' : fb.originalContent.rating === 4 ? '👍' : fb.originalContent.rating === 3 ? '😐' : fb.originalContent.rating === 2 ? '👎' : '😤'}
                                        </div>
                                    </div>
                                    <div class="feedback-date">
                                        Originally Posted: ${new Date(fb.originalContent.timestamp).toLocaleString()}
                                    </div>
                                    <div style="margin-top:auto;">
                                        <button class="flip-btn" onclick="flipCard('${fb._id}')"><i class="fas fa-sync-alt"></i> VIEW EDITED</button>
                                    </div>
                                </div>`;
                }
                html += `</div></div>`;
            }
        }
        html += `</div>

    <div id="adminModalOverlay" class="admin-modal-overlay">
        <div class="admin-custom-modal">
            <h3 id="adminModalTitle"></h3>
            <p id="adminModalMessage"></p>
            <div class="admin-modal-buttons">
                <button id="adminModalOkButton">OK</button>
                <button id="adminModalConfirmButton" style="display:none;">Confirm</button>
                <button id="adminModalCancelButton" style="display:none;">Cancel</button>
            </div>
             <div id="lottie-animation-container" style="width: 100px; height: 100px; margin: 0 auto; display: none;"></div>
        </div>
    </div>

    <script>
        const AUTH_HEADER = '${authHeaderValue}';
        if (!AUTH_HEADER || AUTH_HEADER === "Basic Og==") { console.error("CRITICAL: AUTH_HEADER is missing or invalid in admin panel script!"); alert("Admin authentication is not configured properly. Actions will fail.");}

        const adminModalOverlay=document.getElementById('adminModalOverlay');
        const adminModalTitle=document.getElementById('adminModalTitle');
        const adminModalMessage=document.getElementById('adminModalMessage');
        const adminModalOkButton=document.getElementById('adminModalOkButton');
        const adminModalConfirmButton=document.getElementById('adminModalConfirmButton');
        const adminModalCancelButton=document.getElementById('adminModalCancelButton');
        const lottieAnimationContainer = document.getElementById('lottie-animation-container');

        let globalConfirmCallback=null;
        let lottieInstance = null;

        function showAdminModal(type, title, message, confirmCallbackFn = null, lottieFile = null) {
            adminModalTitle.textContent = title;
            adminModalMessage.textContent = message;
            globalConfirmCallback = confirmCallbackFn;

            adminModalOkButton.style.display = type === 'confirm' ? 'none' : 'inline-block';
            adminModalConfirmButton.style.display = type === 'confirm' ? 'inline-block' : 'none';
            adminModalCancelButton.style.display = type === 'confirm' ? 'inline-block' : 'none';
            
            if (lottieInstance) {
                lottieInstance.destroy();
                lottieInstance = null;
            }
            if (lottieFile) {
                lottieAnimationContainer.style.display = 'block';
                lottieInstance = lottie.loadAnimation({
                    container: lottieAnimationContainer,
                    renderer: 'svg',
                    loop: false,
                    autoplay: true,
                    path: lottieFile
                });
                lottieInstance.play();
            } else {
                lottieAnimationContainer.style.display = 'none';
            }

            adminModalOverlay.classList.add('active');
        }
        
        adminModalOkButton.addEventListener('click',()=>adminModalOverlay.classList.remove('active'));
        adminModalConfirmButton.addEventListener('click',()=>{adminModalOverlay.classList.remove('active');if(globalConfirmCallback)globalConfirmCallback(true)});
        adminModalCancelButton.addEventListener('click',()=>{adminModalOverlay.classList.remove('active');if(globalConfirmCallback)globalConfirmCallback(false)});
        
        function flipCard(id){
            document.getElementById(`card-${id}`).classList.toggle('is-flipped');
        }

        async function tryDeleteFeedback(id){
            console.log("Attempting to delete feedback ID:",id);
            showAdminModal('confirm','Delete Feedback?','Are you sure you want to delete this feedback? This cannot be undone.',async confirmed=>{
                if(confirmed){
                    try{
                        const res=await fetch(`/api/admin/feedback/${id}`,{method:'DELETE',headers:{'Authorization':AUTH_HEADER}});
                        if(res.ok){
                            showAdminModal('alert','Deleted!','Feedback deleted successfully.', null, 'https://assets2.lottiefiles.com/packages/lf20_t3982e0j.json');
                            setTimeout(()=>location.reload(),1500);
                        }else{
                            const err=await res.json();
                            console.error("Delete failed response:",err);
                            showAdminModal('alert','Error!',`Failed to delete: ${err.message||res.statusText}`, null, 'https://assets4.lottiefiles.com/packages/lf20_y0u754e4.json');
                        }
                    }catch(e){
                        console.error("Delete fetch error:",e);
                        showAdminModal('alert','Fetch Error!',`Error during delete: ${e.message}`, null, 'https://assets4.lottiefiles.com/packages/lf20_y0u754e4.json');
                    }
                }
            });
        }

        async function tryPostReply(fbId,txtId){
            const replyText=document.getElementById(txtId).value.trim();
            console.log("Attempting to post reply to feedback ID:",fbId,"Text:",replyText);
            if(!replyText){
                showAdminModal('alert','Empty Reply','Please write something to reply.');
                return;
            }
            showAdminModal('confirm','Post Reply?',`Confirm reply: "${replyText.substring(0,50)}..."`,async confirmed=>{
                if(confirmed){
                    try{
                        const res=await fetch(`/api/admin/feedback/${fbId}/reply`,{
                            method:'POST',
                            headers:{'Content-Type':'application/json','Authorization':AUTH_HEADER},
                            body:JSON.stringify({replyText,adminName:'👉𝙉𝙊𝘽𝙄𝙏𝘼🤟'})
                        });
                        if(res.ok){
                            showAdminModal('alert','Replied!','Reply posted.', null, 'https://assets8.lottiefiles.com/packages/lf20_xctj7873.json');
                            setTimeout(()=>location.reload(),1500);
                        }else{
                            const err=await res.json();
                            console.error("Reply failed response:",err);
                            showAdminModal('alert','Error!',`Failed to reply: ${err.message||res.statusText}`, null, 'https://assets4.lottiefiles.com/packages/lf20_y0u754e4.json');
                        }
                    }catch(e){
                        console.error("Reply fetch error:",e);
                        showAdminModal('alert','Fetch Error!',`Error during reply: ${e.message}`, null, 'https://assets4.lottiefiles.com/packages/lf20_y0u754e4.json');
                    }
                }
            });
        }

        async function tryChangeUserAvatar(userId,userName){
            console.log("Attempting to change avatar for user ID:",userId,"Name:",userName);
            showAdminModal('confirm','Change Avatar?',`Change avatar for ${userName}? This will regenerate avatar for this email user.`,async confirmed=>{
                if(confirmed){
                    try{
                        const res=await fetch(`/api/admin/user/${userId}/change-avatar`,{
                            method:'PUT',
                            headers:{'Content-Type':'application/json','Authorization':AUTH_HEADER}
                        });
                        if(res.ok){
                            showAdminModal('alert','Avatar Changed!','Avatar updated for '+userName+'.', null, 'https://assets2.lottiefiles.com/packages/lf20_t3982e0j.json');
                            setTimeout(()=>location.reload(),1500);
                        }else{
                            const err=await res.json();
                            console.error("Change avatar failed response:",err);
                            showAdminModal('alert','Error!',`Failed to change avatar: ${err.message||res.statusText}`, null, 'https://assets4.lottiefiles.com/packages/lf20_y0u754e4.json');
                        }
                    }catch(e){
                        console.error("Change avatar fetch error:",e);
                        showAdminModal('alert','Fetch Error!',`Error during avatar change: ${e.message}`, null, 'https://assets4.lottiefiles.com/packages/lf20_y0u754e4.json');
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
                showAdminModal('alert', 'No Feedbacks Selected', 'Please select at least one feedback to delete.');
                return;
            }

            showAdminModal('confirm', 'Delete Selected Feedbacks?', `Are you sure you want to delete ${selectedFeedbackIds.length} selected feedback(s)? This cannot be undone.`, async confirmed => {
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
                            showAdminModal('alert','Deleted!',`${selectedFeedbackIds.length} feedback(s) deleted successfully.`, null, 'https://assets2.lottiefiles.com/packages/lf20_t3982e0j.json');
                            setTimeout(()=>location.reload(),1500);
                        } else {
                            const err = await res.json();
                            console.error("Batch delete failed response:",err);
                            showAdminModal('alert','Error!',`Failed to delete selected feedbacks: ${err.message||res.statusText}`, null, 'https://assets4.lottiefiles.com/packages/lf20_y0u754e4.json');
                        }
                    } catch (e) {
                        console.error("Batch delete fetch error:",e);
                        showAdminModal('alert','Fetch Error!',`Error during batch delete: ${e.message}`, null, 'https://assets4.lottiefiles.com/packages/lf20_y0u754e4.json');
                    }
                }
            });
        }

        function toggleTheme() {
            document.body.classList.toggle('light-theme');
            localStorage.setItem('adminTheme', document.body.classList.contains('light-theme') ? 'light' : 'dark');
        }

        (function() {
            const savedTheme = localStorage.getItem('adminTheme');
            if (savedTheme === 'light') {
                document.body.classList.add('light-theme');
            } else {
                document.body.classList.remove('light-theme');
            }
        })();

    </script>
</body>
</html>`;
        res.send(html);
    } catch (error) { console.error('Admin panel generate karte waqt error:', error); res.status(500).send(`Admin panel mein kuch gadbad hai! Error: ${error.message}`);}
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
    res.status(200).json({ message: 'Avatar सफलतापूर्वक change ho gaya!', newAvatarUrl });
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