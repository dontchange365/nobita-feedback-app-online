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
const FRONTEND_URL = process.env.FRONTEND_URL || `http://localhost:${PORT}`; // Default if not set
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_HOST = process.env.EMAIL_HOST;
const EMAIL_PORT = process.env.EMAIL_PORT;
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin"; // Default admin username
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "password"; // Default admin password


console.log("--- Environment Variable Check (server.js start) ---");
console.log("PORT (from process.env):", process.env.PORT, "Effective PORT:", PORT);
console.log("MONGODB_URI (loaded):", MONGODB_URI ? "SET" : "NOT SET");
console.log("JWT_SECRET (loaded):", JWT_SECRET ? "SET" : "NOT SET");
console.log("FRONTEND_URL (loaded):", process.env.FRONTEND_URL, "Effective FRONTEND_URL:", FRONTEND_URL);
console.log("GOOGLE_CLIENT_ID (loaded):", GOOGLE_CLIENT_ID ? "SET" : "NOT SET");
console.log("EMAIL_USER (loaded):", EMAIL_USER ? "SET" : "NOT SET");
console.log("EMAIL_PASS (loaded):", EMAIL_PASS ? "SET (value hidden)" : "NOT SET");
console.log("EMAIL_HOST (loaded):", EMAIL_HOST ? "SET" : "NOT SET");
console.log("EMAIL_PORT (loaded):", EMAIL_PORT ? "SET" : "NOT SET");
console.log("CLOUDINARY_CLOUD_NAME (loaded):", CLOUDINARY_CLOUD_NAME ? "SET" : "NOT SET");
console.log("CLOUDINARY_API_KEY (loaded):", CLOUDINARY_API_KEY ? "SET" : "NOT SET");
console.log("CLOUDINARY_API_SECRET (loaded):", CLOUDINARY_API_SECRET ? "SET (value hidden)" : "NOT SET");
console.log("ADMIN_USERNAME (loaded):", process.env.ADMIN_USERNAME ? "SET" : "NOT SET (using default)");
console.log("ADMIN_PASSWORD (loaded):", process.env.ADMIN_PASSWORD ? "SET (value hidden)" : "NOT SET (using default)");
console.log("--- End Environment Variable Check ---");


if (!MONGODB_URI || !JWT_SECRET ) {
    console.error("CRITICAL ERROR: MONGODB_URI or JWT_SECRET environment variable nahi mila.");
    process.exit(1);
}
if (!GOOGLE_CLIENT_ID) console.warn("WARNING: GOOGLE_CLIENT_ID missing. Google Sign-In might fail.");
if (!EMAIL_USER || !EMAIL_PASS || !EMAIL_HOST || !EMAIL_PORT) console.warn("WARNING: Email service variables missing. Password reset/notifications might fail.");
if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) console.warn("WARNING: Cloudinary variables missing. Avatar upload will fail.");


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
        else cb(new Error('Invalid file type. Only JPEG, PNG, GIF images allowed.'), false);
    }
});

function getGenericAvatarUrl(name) {
    if (!name || typeof name !== 'string' || name.trim() === '') name = 'User';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6a0dad&color=ffd700&bold=true&size=128&format=png`;
}

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String }, // Not required for Google sign-in
  googleId: { type: String, sparse: true, unique: true, default: null },
  avatarUrl: { type: String },
  loginMethod: { type: String, enum: ['email', 'google'], required: true },
  createdAt: { type: Date, default: Date.now },
  resetPasswordToken: { type: String, default: undefined },
  resetPasswordExpires: { type: Date, default: undefined }
});
const User = mongoose.model('User', userSchema);

const feedbackSchema = new mongoose.Schema({
  name: { type: String, required: true }, // Name of the submitter at the time of feedback
  feedback: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  timestamp: { type: Date, default: Date.now },
  avatarUrl: { type: String }, // Avatar of the submitter at the time of feedback
  userIp: { type: String },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Link to the User model
  isEdited: { type: Boolean, default: false },
  originalContent: { name: String, feedback: String, rating: Number, timestamp: Date, avatarUrl: String }, // Store original state if edited
  replies: [{
      text: { type: String, required: true },
      timestamp: { type: Date, default: Date.now },
      adminName: { type: String, default: 'Admin' },
      adminAvatarUrl: { type: String } // Optional: if admin has a specific avatar
  }]
});
const Feedback = mongoose.model('Feedback', feedbackSchema);

app.use(cors({
    origin: [FRONTEND_URL, `http://localhost:${PORT}`, 'https://accounts.google.com', 'https://*.google.com'], // Added localhost for local dev
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
        req.user = user; // This user is the payload from JWT
        next();
    });
};

async function sendEmail(options) {
    if (!EMAIL_USER || !EMAIL_PASS || !EMAIL_HOST || !EMAIL_PORT) {
        console.error("Email service environment variables incomplete.");
        throw new Error("Email service theek se configure nahi hai. Administrator se contact karein.");
    }
    console.log(`Email bhejne ki koshish: To: ${options.email}, Subject: ${options.subject}`);
    const transporter = nodemailer.createTransport({
        host: EMAIL_HOST, port: parseInt(EMAIL_PORT), secure: parseInt(EMAIL_PORT) === 465, // true for 465, false for other ports
        auth: { user: EMAIL_USER, pass: EMAIL_PASS },
        tls: { rejectUnauthorized: false } // Added for some environments, be cautious
    });
    const mailOptions = { from: `"Nobita Feedback App" <${EMAIL_USER}>`, to: options.email, subject: options.subject, text: options.message, html: options.html };
    try {
        let info = await transporter.sendMail(mailOptions);
        console.log('Email safaltapoorvak bheja gaya! Message ID: %s', info.messageId);
    } catch (error) {
        console.error('Nodemailer se email bhejne mein error:', error);
        throw error; // Re-throw to be handled by caller
    }
}

// --- Auth Routes ---
app.post('/api/auth/signup', async (req, res) => {
    console.log("Signup attempt received for email:", req.body.email);
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: "Naam, email, aur password zaroori hai." });
    if (password.length < 6) return res.status(400).json({ message: "Password kam se kam 6 characters ka hona chahiye." });

    try {
        console.log("Step 1: Checking for existing user...");
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            console.log("Signup failed: Email already registered -", email);
            return res.status(400).json({ message: "Yeh email pehle se register hai." });
        }
        console.log("Step 2: Hashing password...");
        const hashedPassword = await bcrypt.hash(password, 12);
        console.log("Step 3: Generating avatar URL...");
        const userAvatar = getGenericAvatarUrl(name); // Using new generic avatar

        console.log("Step 4: Creating new user object...");
        const newUser = new User({
            name,
            email: email.toLowerCase(),
            password: hashedPassword,
            avatarUrl: userAvatar,
            loginMethod: 'email'
        });
        console.log("Step 5: Saving new user to DB...");
        await newUser.save();
        console.log("New user saved successfully:", newUser.email);

        const userForToken = { userId: newUser._id, name: newUser.name, email: newUser.email, avatarUrl: newUser.avatarUrl, loginMethod: 'email' };
        console.log("Step 6: Generating JWT token...");
        const appToken = jwt.sign(userForToken, JWT_SECRET, { expiresIn: '7d' });

        console.log("Signup successful for:", newUser.email);
        res.status(201).json({ token: appToken, user: userForToken });

    } catch (error) {
        console.error('Signup mein error:', error);
        console.error('Error details:', error.message, error.stack); // More detailed logging
        res.status(500).json({ message: "Account banane mein kuch dikkat aa gayi.", error: error.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email aur password zaroori hai." });
    try {
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) return res.status(401).json({ message: "Email ya password galat hai." });
        if (user.loginMethod === 'google' && !user.password) return res.status(401).json({ message: "Aapne Google se sign up kiya tha. Kripya Google se login karein ya password reset karein agar aap email login chahte hain (feature not fully implemented for this transition)." });
        if (!user.password) return res.status(401).json({ message: "Is account ke liye password set nahi hai. Kripya Google se login karein ya support se contact karein."});

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

        if (!user) { // New Google user or existing email user linking with Google
            user = await User.findOne({ email: email.toLowerCase() });
            if (user) { // Existing email user
                user.googleId = googleId;
                user.avatarUrl = googleAvatar || user.avatarUrl || getGenericAvatarUrl(name); // Prioritize Google avatar
                user.loginMethod = 'google'; // Update login method
                if (!user.name && name) user.name = name; // Update name if missing and Google provides it
            } else { // Completely new user
                user = new User({
                    googleId,
                    name,
                    email: email.toLowerCase(),
                    avatarUrl: googleAvatar || getGenericAvatarUrl(name),
                    loginMethod: 'google'
                });
            }
            await user.save();
        } else { // Existing Google user, update avatar if changed
             if (user.avatarUrl !== googleAvatar && googleAvatar) { user.avatarUrl = googleAvatar; await user.save(); }
        }
        const userForToken = { userId: user._id, name: user.name, email: user.email, avatarUrl: user.avatarUrl, loginMethod: 'google' };
        const appToken = jwt.sign(userForToken, JWT_SECRET, { expiresIn: '7d' });
        res.status(200).json({ token: appToken, user: userForToken });
    } catch (error) { console.error('Google signin mein error:', error); res.status(401).json({ message: 'Google token invalid hai ya server error.', error: error.message });}
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
    try {
        // req.user is from JWT. Fetch fresh user data from DB to ensure it's current.
        const userFromDb = await User.findById(req.user.userId).select('-password -resetPasswordToken -resetPasswordExpires');
        if (!userFromDb) {
            return res.status(404).json({ message: "User not found in database." });
        }
        // Re-construct payload for response to match JWT structure, ensuring sensitive data isn't accidentally included.
        const userPayload = {
            userId: userFromDb._id,
            name: userFromDb.name,
            email: userFromDb.email,
            avatarUrl: userFromDb.avatarUrl,
            loginMethod: userFromDb.loginMethod
        };
        res.status(200).json(userPayload);
    } catch (error) {
        console.error("Error fetching user details for /me route:", error);
        res.status(500).json({ message: "Error fetching user details.", error: error.message });
    }
});


// --- User Profile Routes ---
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
            folder: `nobita_avatars`,
            public_id: `user_${req.user.userId}_${Date.now()}`,
            overwrite: true,
            invalidate: true,
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

            res.status(200).json({
                message: 'Profile picture safaltapoorvak upload aur update ho gayi!',
                newAvatarUrl: userMakingRequest.avatarUrl,
                token: newAppToken // Send new token with updated avatar
            });
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

        // If name changed for an email user and they don't have a custom Cloudinary avatar, update their default avatar
        if (nameChanged && user.loginMethod === 'email' && (!user.avatarUrl || !user.avatarUrl.includes('cloudinary.com'))) {
            user.avatarUrl = getGenericAvatarUrl(user.name);
        }

        if (nameChanged) {
            await user.save();
            // Update name in existing feedbacks (and avatar if it was default and changed)
            const feedbackUpdateFields = { name: user.name };
            if (user.loginMethod === 'email' && (!req.user.avatarUrl || !req.user.avatarUrl.includes('cloudinary.com'))) {
                 // if old avatar in JWT was also default then update feedback avatar
                 feedbackUpdateFields.avatarUrl = user.avatarUrl;
            }
            await Feedback.updateMany({ userId: user._id }, { $set: feedbackUpdateFields });
        }

        const userForToken = { userId: user._id, name: user.name, email: user.email, avatarUrl: user.avatarUrl, loginMethod: user.loginMethod };
        const appToken = jwt.sign(userForToken, JWT_SECRET, { expiresIn: '7d' });

        res.status(200).json({
            message: 'Profile updated successfully!',
            user: userForToken, // Send back the updated user object for the token
            token: appToken      // Send back the new token with updated name/avatar
        });
    } catch (error) {
        console.error("Error updating profile:", error);
        res.status(500).json({ message: "Profile update karne mein error.", error: error.message });
    }
});

app.post('/api/user/change-password', authenticateToken, async (req, res) => {
    const { currentPassword, newPassword, confirmNewPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmNewPassword) {
        return res.status(400).json({ message: "Saare password fields zaroori hain." });
    }
    if (newPassword.length < 6) {
        return res.status(400).json({ message: "Naya password kam se kam 6 characters ka hona chahiye." });
    }
    if (newPassword !== confirmNewPassword) {
        return res.status(400).json({ message: "Naye passwords match nahi ho rahe." });
    }

    try {
        const user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ message: "User nahi mila." });
        if (user.loginMethod === 'google') {
            return res.status(400).json({ message: "Google users apna password Google se manage karein." });
        }
        if (!user.password) { // Edge case: email user without a password set (e.g. old account or error)
             console.warn(`User ${user.email} (email login) has no password set. Allowing password set.`);
             // In this case, we can allow them to set a password without verifying currentPassword
        } else {
            const isMatch = await bcrypt.compare(currentPassword, user.password);
            if (!isMatch) return res.status(401).json({ message: "Aapka current password galat hai." });
        }

        if (currentPassword === newPassword) {
            return res.status(400).json({ message: "Naya password current password jaisa nahi ho sakta." });
        }

        user.password = await bcrypt.hash(newPassword, 12);
        await user.save();

        try {
            await sendEmail({
                email: user.email,
                subject: 'Aapka Password Safaltapoorvak Change Ho Gaya Hai - Nobita Feedback',
                message: `Namaste ${user.name},\n\nAapka password Nobita Feedback App par safaltapoorvak change ho gaya hai.\nAgar yeh aapne nahi kiya tha, toh kripya turant support se contact karein.\n\nDhanyawad,\nNobita Feedback App Team`,
                html: `<p>Namaste ${user.name},</p><p>Aapka password Nobita Feedback App par safaltapoorvak change ho gaya hai.</p><p>Agar yeh aapne nahi kiya tha, toh kripya turant hamari support team se contact karein.</p><hr><p>Dhanyawad,<br/>Nobita Feedback App Team</p>`
            });
        } catch (emailError) {
            console.error("Password change confirmation email bhejne mein error:", emailError);
            // Don't fail the whole request for this, but log it.
        }

        res.status(200).json({ message: "Aapka password safaltapoorvak change ho gaya hai.", reloginRequired: false }); // Set reloginRequired to true if you want to force re-login

    } catch (error) {
        console.error('Password change mein error:', error);
        res.status(500).json({ message: "Password change karne mein kuch dikkat aa gayi.", error: error.message });
    }
});


// --- Password Reset Routes (Forgot Password) ---
app.post('/api/auth/request-password-reset', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email address zaroori hai." });
    if (!FRONTEND_URL) { console.error("CRITICAL: FRONTEND_URL missing."); return res.status(500).json({ message: "Server configuration error (FRONTEND_URL)." });}

    try {
        const user = await User.findOne({ email: email.toLowerCase(), loginMethod: 'email' }); // Only for email users
        if (!user) {
            // Don't reveal if email exists for security reasons
            return res.status(200).json({ message: "Agar aapka email hamare system mein hai aur email/password account se juda hai, toh aapko password reset link mil jayega." });
        }
        const resetToken = crypto.randomBytes(32).toString('hex');
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
        await user.save();

        const resetPagePath = "/reset-password.html";
        const resetUrl = `${FRONTEND_URL.replace(/\/$/, '')}${resetPagePath}?token=${resetToken}`; // Ensure no double slash
        const textMessage = `Namaste ${user.name},\n\nAapko aapke Nobita Feedback App account ke liye password reset karne ki request mili hai.\nKripya neeche diye gaye link par click karke apna password reset karein. Yeh link 1 ghante tak valid rahega:\n${resetUrl}\n\nAgar aapne yeh request nahi ki thi, toh is email ko ignore kar dein.\n\nDhanyawad,\nNobita Feedback App Team`;
        const htmlMessage = `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; padding: 20px; border: 1px solid #ddd; border-radius: 5px; background-color: #f9f9f9;"><h2 style="color: #6a0dad; border-bottom: 2px solid #FFD700; padding-bottom: 10px;">Password Reset Request</h2><p>Namaste ${user.name},</p><p>Aapko aapke Nobita Feedback App account ke liye password reset karne ki request mili hai.</p><p>Kripya neeche diye gaye button par click karke apna password reset karein. Yeh link <strong>1 ghante</strong> tak valid rahega:</p><p style="text-align: center; margin: 25px 0;"><a href="${resetUrl}" style="background-color: #FFD700; color: #1A1A2E !important; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; border: 1px solid #E0C000; display: inline-block;">Password Reset Karein</a></p><p style="font-size: 0.9em;">Agar button kaam na kare, toh aap is link ko apne browser mein copy-paste kar sakte hain: <a href="${resetUrl}" target="_blank" style="color: #3B82F6;">${resetUrl}</a></p><p>Agar aapne yeh request nahi ki thi, toh is email ko ignore kar dein aur aapka password nahi badlega.</p><hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;"><p style="font-size: 0.9em; color: #777;">Dhanyawad,<br/>Nobita Feedback App Team</p></div>`;

        await sendEmail({ email: user.email, subject: 'Aapka Password Reset Link (Nobita Feedback App)', message: textMessage, html: htmlMessage });
        res.status(200).json({ message: "Password reset link aapke email par bhej diya gaya hai (agar email valid hai aur email/password account se juda hai)." });
    } catch (error) {
        console.error('Request password reset API mein error:', error);
        res.status(500).json({ message: "Password reset request process karne mein kuch dikkat aa gayi hai." });
    }
});

app.post('/api/auth/reset-password', async (req, res) => {
    const { token, password, confirmPassword } = req.body;
    if (!token) return res.status(400).json({ message: "Password reset token nahi mila." });
    if (!password || !confirmPassword) return res.status(400).json({ message: "Naya password aur confirmation password zaroori hai." });
    if (password !== confirmPassword) return res.status(400).json({ message: "Passwords match nahi ho rahe." });
    if (password.length < 6) return res.status(400).json({ message: "Password kam se kam 6 characters ka hona chahiye." });

    try {
        const user = await User.findOne({ resetPasswordToken: token, resetPasswordExpires: { $gt: Date.now() } });
        if (!user) return res.status(400).json({ message: "Password reset token invalid hai ya expire ho chuka hai." });

        user.password = await bcrypt.hash(password, 12);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        const confirmationTextMessage = `Namaste ${user.name},\n\nAapka password Nobita Feedback App par safaltapoorvak reset ho gaya hai.\n\nAgar yeh aapne nahi kiya tha, toh kripya turant support se contact karein.`;
        const confirmationHtmlMessage = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#333"><p>Namaste ${user.name},</p><p>Aapka password Nobita Feedback App par safaltapoorvak reset ho gaya hai.</p><p>Ab aap apne naye password ke saath login kar sakte hain.</p><p>Agar yeh aapne nahi kiya tha, toh kripya turant hamari support team se contact karein.</p><hr><p>Dhanyawad,<br/>Nobita Feedback App Team</p></div>`;
        try { await sendEmail({ email: user.email, subject: 'Aapka Password Safaltapoorvak Reset Ho Gaya Hai', message: confirmationTextMessage, html: confirmationHtmlMessage});
        } catch (emailError) { console.error("Password reset confirmation email bhejne mein error:", emailError); }

        res.status(200).json({ message: "Aapka password safaltapoorvak reset ho gaya hai. Ab aap naye password se login kar sakte hain." });
    } catch (error) { console.error('Reset password API mein error:', error); res.status(500).json({ message: "Password reset karne mein kuch dikkat aa gayi." });}
});


// --- Feedback Routes ---
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/feedbacks', async (req, res) => {
    try {
        const allFeedbacks = await Feedback.find()
            .populate({ path: 'userId', select: 'name email avatarUrl loginMethod' }) // Populate user details
            .sort({ timestamp: -1 });
        res.status(200).json(allFeedbacks);
    } catch (error) {
        console.error("Feedbacks fetch error:", error);
        res.status(500).json({ message: 'Feedbacks fetch nahi ho paye.', error: error.message });
    }
});

app.post('/api/feedback', authenticateToken, async (req, res) => {
    const { feedback, rating } = req.body;
    const userIp = req.clientIp;

    if (!req.user || !req.user.userId) return res.status(403).json({ message: "Feedback dene ke liye कृपया login karein." });
    if (!feedback || !rating || rating === '0') return res.status(400).json({ message: 'Feedback aur rating zaroori hai.' });

    try {
        // Fetch the latest user details to ensure name and avatar are current for the feedback entry
        const submitter = await User.findById(req.user.userId);
        if (!submitter) return res.status(404).json({ message: "Submitter user not found." });

        let feedbackData = {
            name: submitter.name, // Use current name from DB
            avatarUrl: submitter.avatarUrl, // Use current avatar from DB
            userId: submitter._id,
            feedback,
            rating: parseInt(rating),
            userIp,
            isEdited: false
        };

        const newFeedback = new Feedback(feedbackData);
        await newFeedback.save();
        // For response, populate userId to match GET /api/feedbacks structure if needed by client immediately
        const populatedFeedback = await Feedback.findById(newFeedback._id).populate({ path: 'userId', select: 'name email avatarUrl loginMethod' });

        res.status(201).json({ message: 'Aapka feedback सफलतापूर्वक jama ho gaya!', feedback: populatedFeedback });
    } catch (error) {
        console.error("Feedback save error:", error);
        res.status(500).json({ message: 'Feedback save nahi ho paya.', error: error.message });
    }
});

app.put('/api/feedback/:id', authenticateToken, async (req, res) => {
    const feedbackId = req.params.id;
    const { feedback, rating } = req.body;
    const loggedInJwtUser = req.user; // Payload from JWT

    if (!feedback || !rating || rating === '0') return res.status(400).json({ message: 'Update ke liye feedback aur rating zaroori hai!' });

    try {
        const existingFeedback = await Feedback.findById(feedbackId);
        if (!existingFeedback) return res.status(404).json({ message: 'Yeh feedback ID mila nahi.' });
        if (existingFeedback.userId.toString() !== loggedInJwtUser.userId) return res.status(403).json({ message: 'Aap sirf apne diye gaye feedbacks ko hi edit kar sakte hain.' });

        // Fetch fresh user data to ensure latest name/avatar is used if feedback is being edited
        const currentUserFromDb = await User.findById(loggedInJwtUser.userId);
        if (!currentUserFromDb) return res.status(404).json({ message: "Editor user account not found." });


        const contentActuallyChanged = existingFeedback.feedback !== feedback || existingFeedback.rating !== parseInt(rating) || existingFeedback.name !== currentUserFromDb.name || existingFeedback.avatarUrl !== currentUserFromDb.avatarUrl;

        if (contentActuallyChanged) {
            if (!existingFeedback.originalContent) { // Save original only once
                existingFeedback.originalContent = {
                    name: existingFeedback.name,
                    feedback: existingFeedback.feedback,
                    rating: existingFeedback.rating,
                    timestamp: existingFeedback.timestamp,
                    avatarUrl: existingFeedback.avatarUrl
                };
            }
            existingFeedback.name = currentUserFromDb.name; // Use current name from DB
            existingFeedback.avatarUrl = currentUserFromDb.avatarUrl; // Use current avatar from DB
            existingFeedback.feedback = feedback;
            existingFeedback.rating = parseInt(rating);
            existingFeedback.timestamp = Date.now(); // Update timestamp to reflect edit time
            existingFeedback.isEdited = true;
        }

        await existingFeedback.save();
        const populatedFeedback = await Feedback.findById(existingFeedback._id).populate({ path: 'userId', select: 'name email avatarUrl loginMethod' });

        res.status(200).json({ message: 'Aapka feedback update ho gaya!', feedback: populatedFeedback });
    } catch (error) {
        console.error(`Feedback update error (ID: ${feedbackId}):`, error);
        res.status(500).json({ message: 'Feedback update nahi ho paya.', error: error.message });
    }
});


// --- Admin Panel Routes --- (Copied from original, with minor adjustments for consistency if any)
const authenticateAdmin = (req, res, next) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate'); res.setHeader('Pragma', 'no-cache'); res.setHeader('Expires', '0');
    const authHeader = req.headers.authorization; if (!authHeader) { res.set('WWW-Authenticate', 'Basic realm="Admin Area"'); return res.status(401).json({ message: 'UNAUTHORIZED: AUTH HEADER MISSING.' });}
    const [scheme, credentials] = authHeader.split(' '); if (scheme !== 'Basic' || !credentials) { res.set('WWW-Authenticate', 'Basic realm="Admin Area"'); return res.status(401).json({ message: 'UNAUTHORIZED: INVALID AUTH SCHEME.' });}
    const [username, password] = Buffer.from(credentials, 'base64').toString().split(':');
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) { next(); } else { res.set('WWW-Authenticate', 'Basic realm="Admin Area"'); res.status(401).json({ message: 'UNAUTHORIZED: INVALID ADMIN CREDENTIALS.' });}
};

app.get('/admin-panel-nobita', authenticateAdmin, async (req, res) => {
    try {
        const feedbacks = await Feedback.find().populate({ path: 'userId', select: 'loginMethod name email avatarUrl' }).sort({ timestamp: -1 });
        const encodedCredentials = Buffer.from(`${ADMIN_USERNAME}:${ADMIN_PASSWORD}`).toString('base64');
        const authHeaderValue = `Basic ${encodedCredentials}`;
        const nobitaAvatarUrl = getGenericAvatarUrl('Nobita'); // Admin avatar

        let html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>ADMIN PANEL: NOBITA'S COMMAND CENTER</title><link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap" rel="stylesheet"><style>body{font-family:'Roboto',sans-serif;background:linear-gradient(135deg, #1A1A2E, #16213E);color:#E0E0E0;margin:0;padding:30px 20px;display:flex;flex-direction:column;align-items:center;min-height:100vh}h1{color:#FFD700;text-align:center;margin-bottom:40px;font-size:2.8em;text-shadow:0 0 15px rgba(255,215,0,0.5)}.main-panel-btn-container{width:100%;max-width:1200px;display:flex;justify-content:flex-start;margin-bottom:20px;padding:0 10px}.main-panel-btn{background-color:#007bff;color:white;padding:10px 20px;border:none;border-radius:8px;font-size:1em;font-weight:bold;cursor:pointer;transition:background-color .3s ease,transform .2s;text-decoration:none;display:inline-block;text-transform:uppercase}.main-panel-btn:hover{background-color:#0056b3;transform:translateY(-2px)}.feedback-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(350px,1fr));gap:30px;width:100%;max-width:1200px}.feedback-card{background-color:transparent;border-radius:15px;perspective:1000px;min-height:500px}.feedback-card-inner{position:relative;width:100%;height:100%;transition:transform .7s;transform-style:preserve-3d;box-shadow:0 8px 25px rgba(0,0,0,.4);border-radius:15px}.feedback-card.is-flipped .feedback-card-inner{transform:rotateY(180deg)}.feedback-card-front,.feedback-card-back{position:absolute;width:100%;height:100%;-webkit-backface-visibility:hidden;backface-visibility:hidden;background-color:#2C3E50;color:#E0E0E0;border-radius:15px;padding:25px;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;overflow-y:auto}.feedback-card-back{transform:rotateY(180deg);background-color:#34495E}.feedback-header{display:flex;align-items:center;gap:15px;margin-bottom:15px;flex-shrink:0}.feedback-avatar{width:60px;height:60px;border-radius:50%;overflow:hidden;border:3px solid #FFD700;flex-shrink:0;box-shadow:0 0 10px rgba(255,215,0,.3)}.feedback-avatar img{width:100%;height:100%;object-fit:cover}.feedback-info{flex-grow:1;display:flex;flex-direction:column;align-items:flex-start}.feedback-info h4{margin:0;font-size:1.3em;color:#FFD700;text-transform:uppercase;display:flex;align-items:center;gap:8px}.feedback-info h4 small{font-size:0.7em; color:#bbb; text-transform:none; margin-left:5px;}.google-user-tag{background-color:#4285F4;color:white;padding:2px 6px;border-radius:4px;font-size:.7em;margin-left:8px;vertical-align:middle}.email-user-tag{background-color:#6c757d;color:white;padding:2px 6px;border-radius:4px;font-size:.7em;margin-left:8px;vertical-align:middle}.feedback-info .rating{font-size:1.1em;color:#F39C12;margin-top:5px}.feedback-info .user-ip{font-size:.9em;color:#AAB7B8;margin-top:5px}.feedback-body{font-size:1em;color:#BDC3C7;line-height:1.6;margin-bottom:15px;flex-grow:1;overflow-y:auto;word-wrap:break-word}.feedback-date{font-size:.8em;color:#7F8C8D;text-align:right;margin-bottom:10px;border-top:1px solid #34495E;padding-top:10px;flex-shrink:0}.action-buttons{display:flex;gap:10px;margin-bottom:10px;flex-shrink:0}.action-buttons button,.flip-btn{flex-grow:1;padding:10px 12px;border:none;border-radius:8px;font-size:.9em;font-weight:bold;cursor:pointer;transition:background-color .3s ease,transform .2s;text-transform:uppercase}.action-buttons button:hover,.flip-btn:hover{transform:translateY(-2px)}.delete-btn{background-color:#E74C3C;color:white}.delete-btn:hover{background-color:#C0392B}.change-avatar-btn{background-color:#3498DB;color:white}.change-avatar-btn:hover{background-color:#2980B9}.flip-btn{background-color:#fd7e14;color:white;margin-top:10px;flex-grow:0;width:100%}.flip-btn:hover{background-color:#e66800}.reply-section{border-top:1px solid #34495E;padding-top:15px;margin-top:10px;flex-shrink:0}.reply-section textarea{width:calc(100% - 20px);padding:10px;border:1px solid #4A6070;border-radius:8px;background-color:#34495E;color:#ECF0F1;resize:vertical;min-height:50px;margin-bottom:10px;font-size:.95em}.reply-section textarea::placeholder{color:#A9B7C0}.reply-btn{background-color:#27AE60;color:white;width:100%;padding:10px;border:none;border-radius:8px;font-weight:bold;cursor:pointer;transition:background-color .3s ease,transform .2s;text-transform:uppercase}.reply-btn:hover{background-color:#229954;transform:translateY(-2px)}.replies-display{margin-top:15px;background-color:#213042;border-radius:10px;padding:10px;border:1px solid #2C3E50;max-height:150px;overflow-y:auto}.replies-display h4{color:#85C1E9;font-size:1.1em;margin-bottom:10px;border-bottom:1px solid #34495E;padding-bottom:8px}.single-reply{border-bottom:1px solid #2C3E50;padding-bottom:10px;margin-bottom:10px;font-size:.9em;color:#D5DBDB;display:flex;align-items:flex-start;gap:10px}.single-reply:last-child{border-bottom:none;margin-bottom:0}.admin-reply-avatar-sm{width:30px;height:30px;border-radius:50%;border:2px solid #9B59B6;flex-shrink:0;object-fit:cover;box-shadow:0 0 5px rgba(155,89,182,.5)}.reply-content-wrapper{flex-grow:1;word-wrap:break-word}.reply-admin-name{font-weight:bold;color:#9B59B6;display:inline;margin-right:5px}.reply-timestamp{font-size:.75em;color:#8E9A9D;margin-left:10px}.edited-admin-tag{background-color:#5cb85c;color:white;padding:3px 8px;border-radius:5px;font-size:.75em;font-weight:bold;vertical-align:middle}.admin-modal-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.75);display:none;justify-content:center;align-items:center;z-index:2000}.admin-custom-modal{background:#222a35;padding:30px;border-radius:15px;box-shadow:0 10px 30px rgba(0,0,0,.5);text-align:center;color:#f0f0f0;width:90%;max-width:480px;border:1px solid #445}.admin-custom-modal h3{color:#FFD700;margin-top:0;margin-bottom:15px;font-size:1.8em}.admin-custom-modal p{margin-bottom:25px;font-size:1.1em;line-height:1.6;color:#ccc;word-wrap:break-word}.admin-modal-buttons button{background-color:#007bff;color:white;border:none;padding:12px 22px;border-radius:8px;cursor:pointer;font-size:1em;margin:5px;transition:background-color .3s,transform .2s;font-weight:bold}.admin-modal-buttons button:hover{transform:translateY(-2px)}#adminModalOkButton:hover{background-color:#0056b3}#adminModalConfirmButton{background-color:#28a745}#adminModalConfirmButton:hover{background-color:#1e7e34}#adminModalCancelButton{background-color:#dc3545}#adminModalCancelButton:hover{background-color:#b02a37}@media (max-width:768px){h1{font-size:2.2em}.feedback-grid{grid-template-columns:1fr}.main-panel-btn-container{justify-content:center}}</style></head><body><h1>NOBITA'S FEEDBACK COMMAND CENTER</h1><div class="main-panel-btn-container"><a href="/" class="main-panel-btn">&larr; MAIN FEEDBACK PANEL</a></div><div class="feedback-grid">`;
        if (feedbacks.length === 0) {
            html += `<p style="text-align:center;color:#7F8C8D;font-size:1.2em;grid-column:1 / -1;">Abhi tak koi feedback nahi aaya hai!</p>`;
        } else {
            for (const fb of feedbacks) {
                let userTag = ''; let userDisplayName = fb.name; let userEmailDisplay = '';
                let fbUserAvatar = fb.avatarUrl; // Avatar stored with the feedback
                if (fb.userId) { // If feedback is linked to a user
                   userTag = fb.userId.loginMethod === 'google' ? `<span class="google-user-tag" title="Google User (${fb.userId.email || ''})">G</span>` : `<span class="email-user-tag" title="Email User (${fb.userId.email || ''})">E</span>`;
                   userDisplayName = fb.userId.name || fb.name; // Prefer name from User model
                   userEmailDisplay = fb.userId.email ? `<small>(${fb.userId.email})</small>` : '';
                   fbUserAvatar = fb.userId.avatarUrl || fb.avatarUrl || getGenericAvatarUrl(userDisplayName); // Prefer User model avatar
                } else { // Legacy or unlinked feedback
                    userTag = `<span class="email-user-tag" title="User">U</span>`;
                    fbUserAvatar = fb.avatarUrl || getGenericAvatarUrl(userDisplayName);
                }

                html += `<div class="feedback-card" id="card-${fb._id}"><div class="feedback-card-inner"><div class="feedback-card-front"><div class="feedback-header"><div class="feedback-avatar"><img src="${fbUserAvatar}" alt="${userDisplayName.charAt(0)}"></div><div class="feedback-info"><h4>${userDisplayName} ${userEmailDisplay} ${fb.isEdited ? '<span class="edited-admin-tag">EDITED</span>' : ''} ${userTag}</h4><div class="rating">${'★'.repeat(fb.rating)}${'☆'.repeat(5 - fb.rating)}</div><div class="user-ip">IP: ${fb.userIp || 'N/A'} | UserID: ${fb.userId ? (fb.userId._id ? fb.userId._id.toString() : 'N/A') : 'N/A'}</div></div></div><div class="feedback-body"><p>${fb.feedback}</p></div><div class="feedback-date">${fb.isEdited ? 'Last Edited' : 'Posted'}: ${new Date(fb.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata'})}${fb.isEdited && fb.originalContent ? `<br><small>Original: ${new Date(fb.originalContent.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata'})}</small>` : ''}</div><div class="action-buttons"><button class="delete-btn" onclick="tryDeleteFeedback('${fb._id}')">DELETE</button>${fb.userId && fb.userId.loginMethod === 'email' ? `<button class="change-avatar-btn" onclick="tryChangeUserAvatar('${fb.userId._id}', '${userDisplayName}')">AVATAR</button>` : ''}</div><div class="reply-section"><textarea id="reply-text-${fb._id}" placeholder="Admin reply..."></textarea><button class="reply-btn" onclick="tryPostReply('${fb._id}', 'reply-text-${fb._id}')">REPLY</button><div class="replies-display">${fb.replies && fb.replies.length > 0 ? '<h4>Replies:</h4>' : ''}${fb.replies.map(reply => `<div class="single-reply"><img src="${reply.adminAvatarUrl || nobitaAvatarUrl}" alt="${reply.adminName}" class="admin-reply-avatar-sm"><div class="reply-content-wrapper"><span class="reply-admin-name">${reply.adminName}:</span> ${reply.text}<span class="reply-timestamp">(${new Date(reply.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata'})})</span></div></div>`).join('')}</div></div>${fb.isEdited && fb.originalContent ? `<button class="flip-btn" onclick="flipCard('${fb._id}')">VIEW ORIGINAL</button>` : ''}</div>`;
                if (fb.isEdited && fb.originalContent) {
                    const originalAvatar = fb.originalContent.avatarUrl || fbUserAvatar; // Use current avatar if original didn't have one
                    html += `<div class="feedback-card-back"><div class="feedback-header"><div class="feedback-avatar"><img src="${originalAvatar}" alt="Original"></div><div class="feedback-info"><h4>ORIGINAL: ${fb.originalContent.name}</h4><div class="rating">${'★'.repeat(fb.originalContent.rating)}${'☆'.repeat(5 - fb.originalContent.rating)}</div></div></div><div class="feedback-body"><p>${fb.originalContent.feedback}</p></div><div class="feedback-date">Originally Posted: ${new Date(fb.originalContent.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata'})}</div><div style="margin-top:auto;"><button class="flip-btn" onclick="flipCard('${fb._id}')">VIEW EDITED</button></div></div>`;
                }
                html += `</div></div>`;
            }
        }
        html += `</div><div id="adminModalOverlay" class="admin-modal-overlay"><div class="admin-custom-modal"><h3 id="adminModalTitle"></h3><p id="adminModalMessage"></p><div class="admin-modal-buttons"><button id="adminModalOkButton">OK</button><button id="adminModalConfirmButton" style="display:none;">Confirm</button><button id="adminModalCancelButton" style="display:none;">Cancel</button></div></div></div>`;
        html += `<script>const AUTH_HEADER = '${authHeaderValue}';
            if (!AUTH_HEADER || AUTH_HEADER === "Basic Og==") { console.error("CRITICAL: AUTH_HEADER is missing or invalid in admin panel script!"); alert("Admin authentication is not configured properly. Actions will fail.");}
            const adminModalOverlay=document.getElementById('adminModalOverlay');const adminModalTitle=document.getElementById('adminModalTitle');const adminModalMessage=document.getElementById('adminModalMessage');const adminModalOkButton=document.getElementById('adminModalOkButton');const adminModalConfirmButton=document.getElementById('adminModalConfirmButton');const adminModalCancelButton=document.getElementById('adminModalCancelButton');let globalConfirmCallback=null;function showAdminModal(type,title,message,confirmCallbackFn=null){adminModalTitle.textContent=title;adminModalMessage.innerHTML=message;globalConfirmCallback=confirmCallbackFn;adminModalOkButton.style.display=type==='confirm'?'none':'inline-block';adminModalConfirmButton.style.display=type==='confirm'?'inline-block':'none';adminModalCancelButton.style.display=type==='confirm'?'inline-block':'none';adminModalOverlay.style.display='flex'}
            adminModalOkButton.addEventListener('click',()=>adminModalOverlay.style.display='none');adminModalConfirmButton.addEventListener('click',()=>{adminModalOverlay.style.display='none';if(globalConfirmCallback)globalConfirmCallback(true)});adminModalCancelButton.addEventListener('click',()=>{adminModalOverlay.style.display='none';if(globalConfirmCallback)globalConfirmCallback(false)});function flipCard(id){document.getElementById(\`card-\${id}\`).classList.toggle('is-flipped')}
            async function tryDeleteFeedback(id){showAdminModal('confirm','Delete Feedback?','Are you sure you want to delete this feedback? This cannot be undone.',async confirmed=>{if(confirmed){try{const res=await fetch(\`/api/admin/feedback/\${id}\`,{method:'DELETE',headers:{'Authorization':AUTH_HEADER}});if(res.ok){showAdminModal('alert','Deleted!','Feedback deleted successfully.');setTimeout(()=>location.reload(),1000)}else{const err=await res.json();showAdminModal('alert','Error!',\`Failed to delete: \${err.message||res.statusText}\`)}}catch(e){showAdminModal('alert','Fetch Error!',\`Error during delete: \${e.message}\`)}}})}
            async function tryPostReply(fbId,txtId){const replyText=document.getElementById(txtId).value.trim();if(!replyText){showAdminModal('alert','Empty Reply','Please write something to reply.');return}showAdminModal('confirm','Post Reply?',\`Confirm reply: "\${replyText.substring(0,50)}..."\`,async confirmed=>{if(confirmed){try{const res=await fetch(\`/api/admin/feedback/\${fbId}/reply\`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':AUTH_HEADER},body:JSON.stringify({replyText,adminName:'👉𝙉𝙊𝘽𝙄𝙏𝘼🤟', adminAvatarUrl:'${nobitaAvatarUrl}'})});if(res.ok){showAdminModal('alert','Replied!','Reply posted.');setTimeout(()=>location.reload(),1000)}else{const err=await res.json();showAdminModal('alert','Error!',\`Failed to reply: \${err.message||res.statusText}\`)}}catch(e){showAdminModal('alert','Fetch Error!',\`Error during reply: \${e.message}\`)}}})}
            async function tryChangeUserAvatar(userId,userName){showAdminModal('confirm','Change Avatar?',\`Change avatar for \${userName}? This will regenerate a default avatar for this email user.\`,async confirmed=>{if(confirmed){try{const res=await fetch(\`/api/admin/user/\${userId}/change-avatar\`,{method:'PUT',headers:{'Content-Type':'application/json','Authorization':AUTH_HEADER}});if(res.ok){showAdminModal('alert','Avatar Changed!','Avatar updated for '+userName+'.');setTimeout(()=>location.reload(),1000)}else{const err=await res.json();showAdminModal('alert','Error!',\`Failed to change avatar: \${err.message||res.statusText}\`)}}catch(e){showAdminModal('alert','Fetch Error!',\`Error during avatar change: \${e.message}\`)}}})}
        </script></body></html>`;
        res.send(html);
    } catch (error) { console.error('Admin panel generate karte waqt error:', error); res.status(500).send(`Admin panel mein kuch gadbad hai! Error: ${error.message}`);}
});

app.delete('/api/admin/feedback/:id', authenticateAdmin, async (req, res) => {
    try { const deletedFeedback = await Feedback.findByIdAndDelete(req.params.id); if (!deletedFeedback) return res.status(404).json({ message: 'Feedback ID mila nahi.' }); res.status(200).json({ message: 'Feedback delete ho gaya.' });
    } catch (error) { console.error(`ADMIN: Error deleting feedback ID ${req.params.id}:`, error); res.status(500).json({ message: 'Feedback delete nahi ho paya.', error: error.message });}
 });

app.post('/api/admin/feedback/:id/reply', authenticateAdmin, async (req, res) => {
    const feedbackId = req.params.id; const { replyText, adminName, adminAvatarUrl } = req.body;
    if (!replyText) return res.status(400).json({ message: 'Reply text daalo.' });
    try { const feedback = await Feedback.findById(feedbackId); if (!feedback) return res.status(404).json({ message: 'Feedback ID mila nahi.' });
    feedback.replies.push({ text: replyText, adminName: adminName || 'Admin', adminAvatarUrl: adminAvatarUrl || getGenericAvatarUrl('Nobita'), timestamp: new Date() }); await feedback.save(); res.status(200).json({ message: 'Reply post ho gaya.', reply: feedback.replies[feedback.replies.length - 1] });
    } catch (error) { console.error(`ADMIN: Error replying to feedback ID ${feedbackId}:`, error); res.status(500).json({ message: 'Reply save nahi ho paya.', error: error.message });}
});

app.put('/api/admin/user/:userId/change-avatar', authenticateAdmin, async (req, res) => {
    const userId = req.params.userId;
    try { const userToUpdate = await User.findById(userId); if (!userToUpdate) return res.status(404).json({ message: 'User ID mila nahi.' });
    if (userToUpdate.loginMethod === 'google') return res.status(400).json({ message: 'Google user ka avatar yahaan se change nahi kar sakte.' });
    const userName = userToUpdate.name; if (!userName) return res.status(400).json({ message: 'User ka naam nahi hai avatar generate karne ke liye.' });

    const newAvatarUrl = getGenericAvatarUrl(userName); // Generate new default avatar
    userToUpdate.avatarUrl = newAvatarUrl; await userToUpdate.save();
    await Feedback.updateMany({ userId: userToUpdate._id }, { $set: { avatarUrl: newAvatarUrl } });
    res.status(200).json({ message: 'Avatar सफलतापूर्वक change ho gaya!', newAvatarUrl });
    } catch (error) { console.error(`ADMIN: Error changing avatar for user ID ${userId}:`, error); res.status(500).json({ message: 'Avatar change nahi ho paya.', error: error.message });}
});


// Fallback for SPA - Serves index.html for non-API routes, and reset-password.html specifically
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({message: "API endpoint not found."}); // API routes not found
  }
  if (req.path.toLowerCase() === '/reset-password.html') {
    res.sendFile(path.join(__dirname, 'public', 'reset-password.html'));
  } else {
    res.sendFile(path.join(__dirname, 'public', 'index.html')); // Default to main site
  }
});

app.listen(PORT, () => {
    console.log(`Nobita ka server port ${PORT} par chalu ho gaya hai: ${FRONTEND_URL.startsWith('http://localhost') ? `http://localhost:${PORT}`: FRONTEND_URL }`);
});