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
const webpush = require('web-push'); // Added web-push

dotenv.config(); // This is for local .env file, Render will ignore it

const app = express();
const PORT = process.env.PORT || 3000; // Default to 3000 if not set

// --- AGGRESSIVE DEBUGGING START (KEEP THIS FOR YOUR CONFIRMATION) ---
console.log("--- VAPID Key Debugging START ---");
console.log("process.env.VAPID_PUBLIC_KEY:", process.env.VAPID_PUBLIC_KEY);
console.log("Is VAPID_PUBLIC_KEY defined?", !!process.env.VAPID_PUBLIC_KEY);
if (!process.env.VAPID_PUBLIC_KEY) {
    console.error("CRITICAL: VAPID_PUBLIC_KEY is undefined or empty right after dotenv.config()!");
    console.error("Check your .env file or deployment environment variables.");
}
console.log("--- VAPID Key Debugging END ---");
// --- END AGGRESSIVE DEBUGGING ---

// Load from .env (On Render, these will come from the dashboard)
const MONGODB_URI = process.env.MONGODB_URI;
// Removed ADMIN_USERNAME and ADMIN_PASSWORD as they are replaced by hashed password
const ADMIN_USERNAME = process.env.ADMIN_USERNAME; // Used for initial login check
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH; // New: Hashed admin password
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET; // New: Secret for admin JWT
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const JWT_SECRET = process.env.JWT_SECRET; // User JWT secret
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_HOST = process.env.EMAIL_HOST;
const EMAIL_PORT = process.env.EMAIL_PORT;
const FRONTEND_URL = process.env.FRONTEND_URL;
// NEW: For initial admin user creation if it doesn't exist in DB
const ADMIN_INITIAL_PASSWORD = process.env.ADMIN_INITIAL_PASSWORD;

// Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// --- Debugging Environment Variables ---
console.log("--- Environment Variable Check (server.js start) ---");
console.log("PORT (from process.env):", process.env.PORT);
console.log("MONGODB_URI (loaded):", MONGODB_URI ? "SET" : "NOT SET");
console.log("JWT_SECRET (loaded):", JWT_SECRET ? "SET" : "NOT SET");
console.log("ADMIN_JWT_SECRET (loaded):", ADMIN_JWT_SECRET ? "SET" : "NOT SET"); // New Check
console.log("FRONTEND_URL (loaded):", FRONTEND_URL ? "SET" : "NOT SET");
console.log("ADMIN_USERNAME (loaded):", ADMIN_USERNAME ? "SET" : "NOT SET"); // Still useful for initial check
console.log("ADMIN_PASSWORD_HASH (loaded):", ADMIN_PASSWORD_HASH ? "SET" : "NOT SET"); // New Check
console.log("ADMIN_INITIAL_PASSWORD (loaded):", ADMIN_INITIAL_PASSWORD ? "SET" : "NOT SET"); // NEW CHECK
console.log("GOOGLE_CLIENT_ID (loaded):", GOOGLE_CLIENT_ID ? "SET" : "NOT SET");
console.log("EMAIL_USER (loaded):", EMAIL_USER ? "SET" : "NOT SET");
console.log("EMAIL_PASS (loaded):", EMAIL_PASS ? "SET" : "NOT SET");
console.log("EMAIL_HOST (loaded):", EMAIL_HOST ? "SET" : "NOT SET");
console.log("EMAIL_PORT (loaded):", EMAIL_PORT ? "SET" : "NOT SET");
console.log("CLOUDINARY_CLOUD_NAME (loaded):", process.env.CLOUDINARY_CLOUD_NAME ? "SET" : "NOT SET");
console.log("CLOUDINARY_API_KEY (loaded):", process.env.CLOUDINARY_API_KEY ? "SET" : "NOT SET");
console.log("CLOUDINARY_API_SECRET (loaded):", process.env.CLOUDINARY_API_SECRET ? "SET" : "NOT SET");
console.log("VAPID_PUBLIC_KEY (loaded):", process.env.VAPID_PUBLIC_KEY ? "SET" : "NOT SET"); // Added VAPID checks
console.log("VAPID_PRIVATE_KEY (loaded):", process.env.VAPID_PRIVATE_KEY ? "SET" : "NOT SET");
console.log("VAPID_SUBJECT (loaded):", process.env.VAPID_SUBJECT ? "SET" : "NOT SET");
console.log("--- End Environment Variable Check ---");

// Critical environment variables check
if (!MONGODB_URI || !JWT_SECRET || !FRONTEND_URL || !ADMIN_JWT_SECRET || !ADMIN_PASSWORD_HASH || !ADMIN_USERNAME) { // Added new admin variables
    console.error("CRITICAL ERROR: One or more critical environment variables (MONGODB_URI, JWT_SECRET, FRONTEND_URL, ADMIN_JWT_SECRET, ADMIN_PASSWORD_HASH, ADMIN_USERNAME) are not found.");
    process.exit(1);
}
if (!GOOGLE_CLIENT_ID) {
    console.warn("WARNING: GOOGLE_CLIENT_ID not set. Google Sign-in will not work.");
}
if (!EMAIL_USER || !EMAIL_PASS || !EMAIL_HOST || !EMAIL_PORT) {
    console.warn("WARNING: Email service environment variables (EMAIL_USER, EMAIL_PASS, EMAIL_HOST, EMAIL_PORT) are not fully set. Email functionalities may not work.");
}
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.warn("WARNING: Cloudinary environment variables are not fully set. Avatar upload will not work.");
}
if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_SUBJECT) { // Added VAPID warning
    console.warn("WARNING: VAPID keys or subject not set. Push notifications will not work.");
}


const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// Mongoose Schemas
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  username: { type: String, unique: true, sparse: true }, // NEW: Added username field
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
  emailVerificationExpires: { type: Date, default: undefined },
  pushSubscription: { // NEW: Field to store push subscription
    type: Object,
    default: null
  }
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
  isPinned: { type: Boolean, default: false },
  readByAdmin: { type: Boolean, default: false } // NEW: Field to track if admin has read the feedback
});
const Feedback = mongoose.model('Feedback', feedbackSchema);

// BLOG SCHEMA ADDED HERE
const blogSchema = new mongoose.Schema({
  link: { type: String, required: true }, // e.g. rdp.html
  title: { type: String, required: true },
  summary: { type: String, required: true },
  badge: { type: String, default: '' },
  author: { type: String, default: 'Nobita' },
  date: { type: Date, default: Date.now }
});
const Blog = mongoose.model('Blog', blogSchema);

// Subscription in-memory (now backed by DB)
// This is the ONLY declaration for adminPushSubscription
let adminPushSubscription = null;

// Function to load admin push subscription from DB on startup
async function loadAdminPushSubscriptionFromDB() {
    try {
        // Assuming your admin user is identified by ADMIN_USERNAME
        const adminUser = await User.findOne({ username: ADMIN_USERNAME });
        if (adminUser && adminUser.pushSubscription) {
            adminPushSubscription = adminUser.pushSubscription;
            console.log("Admin push subscription loaded from DB on startup.");
        } else {
            console.warn("No admin push subscription found in DB on startup. Admin must log in and enable push notifications.");
        }
    } catch (error) {
        console.error("Error loading admin push subscription from DB:", error);
    }
}

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('MongoDB connection successful!');
    loadAdminPushSubscriptionFromDB(); // Call to load subscription on successful DB connection
  })
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


// Middleware Setup
app.use(cors({
    origin: [FRONTEND_URL, `http://localhost:${PORT}`, `http://localhost:3001`], // Added 3001 if you test frontend from there
    methods: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH'], // Added PATCH
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

// Middleware to authenticate user JWT token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.status(401).json({ message: "Authentication token not found." });
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error("User JWT Verification Error:", err.message);
            return res.status(403).json({ message: "Invalid or expired token. Please log in again." });
        }
        req.user = { ...user, isVerified: user.isVerified };
        next();
    });
};

// NEW: Middleware to authenticate ADMIN JWT token
const authenticateAdminToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) {
        console.warn("Admin authentication attempt: No token provided.");
        return res.status(401).json({ message: "Admin authentication required." });
    }
    jwt.verify(token, ADMIN_JWT_SECRET, (err, adminUser) => {
        if (err) {
            console.error("Admin JWT Verification Error:", err.message);
            // Specifically check for TokenExpiredError for better client-side handling
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ message: "Admin session expired. Please log in again." });
            }
            return res.status(403).json({ message: "Invalid admin token." });
        }
        req.adminUser = adminUser; // Attach admin user payload to request
        console.log(`Admin ${adminUser.username} authenticated.`);
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
        tls: { rejectUnauthorized: false } // Required for some hosts, be careful in production
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

// Email template constant
const NOBITA_EMAIL_TEMPLATE = (heading, name, buttonText, link, avatarUrl) => `
<div style="font-family: 'Poppins',sans-serif; background: #f2f3f5; margin:0; padding: 0; min-height: 100vh; width: 100vw;">
  <table width="100%" cellspacing="0" cellpadding="0" border="0" style="background: linear-gradient(120deg, #7c3aed, #22d3ee); min-height:100vh; padding: 0; margin:0;">
    <tr>
      <td align="center" style="padding: 0; margin:0;">
        <table width="420" cellpadding="0" cellspacing="0" border="0" style="background: #fff; border-radius: 14px; overflow:hidden; margin:40px auto 32px auto; box-shadow: 0 2px 16px #22033b18;">
          <tr>
            <td align="center" style="padding: 0;">
              <img src="${avatarUrl}" alt="User Avatar" width="80" height="80" style="border-radius: 50%; margin: 28px auto 8px auto; box-shadow: 0 2px 14px #00000030; display:block;" />
              <div style="background: linear-gradient(90deg, #1877f2, #42a5f5); padding: 18px 0;">
                <h2 style="color: white; margin: 0; font-size: 1.6em;">
                  ${heading}
                </h2>
              </div>
              <div style="padding: 30px 7% 18px 7%;">
                <p style="font-size: 1.05em; color: #333;">
                  Hello <strong>${name}</strong>,<br><br>
                  ${
                    heading.includes('Password') ?
                    'We received a request to reset your password.<br>Use the button below to change it:' :
                    'Thanks for registering!<br>Click the button below to verify your email address:'
                  }
                </p>
                <a href="${link}" style="display: inline-block; padding: 13px 25px; font-size: 1em; background-color: #1877f2; color: #fff; text-decoration: none; border-radius: 6px; margin-top: 20px; font-weight: 600; letter-spacing: 0.4px;">
                  ${buttonText}
                </a>
                <p style="margin:24px 0 0 0; font-size: 0.95em; color:#777;">
                  <b>Having trouble with the button?</b><br>
                  <span style="word-break:break-all; display:inline-block; margin-top:4px;">
                    <a href="${link}" style="color: #1877f2; text-decoration: underline;">${link}</a>
                  </span>
                </p>
                <p style="font-size: 0.95em; color: #f44336; margin-top: 22px;">
                  ⚠️ This link will expire in 10 minutes. Please act fast!
                </p>
                <p style="font-style: italic; font-size: 0.91em; color: #555; margin-top: 18px;">
                  "Power doesn’t reset — it restores." — NOBI BOT 💀
                </p>
              </div>
              <div style="background-color: #f0f2f5; padding: 14px; font-size: 0.87em; color: #999;">
                &copy; 2025 NOBI BOT | Need help? <a href="mailto:support@nobibot.com" style="color:#1877f2;">Contact Support</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>
`;

// --- Admin Authentication Route (NEW) ---
app.post('/api/admin/login', async (req, res) => {
    const { username, password } = req.body;

    // Use specific admin username from env for authentication
    if (username !== ADMIN_USERNAME) {
        return res.status(401).json({ message: "Invalid username or password." });
    }

    try {
        let adminUser = await User.findOne({ username: ADMIN_USERNAME });

        // If admin user does not exist, create it (ONLY for the first time setup)
        if (!adminUser) {
            console.warn(`Admin user '${ADMIN_USERNAME}' not found in DB. Attempting to create it.`);
            if (!ADMIN_INITIAL_PASSWORD) { // A temporary initial password for setup
                 console.error("CRITICAL ERROR: ADMIN_INITIAL_PASSWORD environment variable is required to create the initial admin user.");
                 return res.status(500).json({ message: "Server setup incomplete: Initial admin password not set for first-time creation." });
            }
            const initialHashedPassword = await bcrypt.hash(ADMIN_INITIAL_PASSWORD, 12);
            adminUser = new User({
                name: 'Admin User', // Default name for the admin
                username: ADMIN_USERNAME, // Set username
                email: `${ADMIN_USERNAME.toLowerCase().replace(/\s/g, '')}@admin.com`, // Default email, can be changed later
                password: initialHashedPassword,
                loginMethod: 'email',
                isVerified: true // Admin is always verified
            });
            await adminUser.save();
            console.log(`Admin user '${ADMIN_USERNAME}' created with default password.`);
        }

        // Compare the provided password with the hashed password from the found/created adminUser
        const isMatch = await bcrypt.compare(password, adminUser.password);

        if (!isMatch) {
            return res.status(401).json({ message: "Invalid username or password." });
        }

        // Generate admin JWT
        const adminPayload = {
            username: adminUser.username, // Use username from the found/created user
            userId: adminUser._id, // Now adminUser is guaranteed to exist and have an _id
            loggedInAt: new Date().toISOString()
        };
        const adminToken = jwt.sign(adminPayload, ADMIN_JWT_SECRET, { expiresIn: '1h' }); // Token expires in 1 hour

        res.status(200).json({ message: "Admin login successful!", token: adminToken, admin: adminPayload });

    } catch (error) {
        console.error("Admin login error:", error);
        res.status(500).json({ message: "Server error during admin login.", error: error.message });
    }
});


// --- Auth Routes (Existing User Auth) ---
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
        const emailHtml = NOBITA_EMAIL_TEMPLATE(
            "📩 Email Verification",
            newUser.name,
            "✅ Verify Your Email",
            verifyUrl,
            newUser.avatarUrl || getDiceBearAvatarUrl(newUser.name)
        );

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
        const htmlMessage = NOBITA_EMAIL_TEMPLATE(
            "🔐 Password Reset",
            user.name,
            "🔁 Reset Your Password",
            resetUrl,
            user.avatarUrl || getDiceBearAvatarUrl(user.name)
        );
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
        const htmlMessage = NOBITA_EMAIL_TEMPLATE(
            "📩 Email Verification",
            user.name,
            "✅ Verify Your Email",
            verifyUrl,
            user.avatarUrl || getDiceBearAvatarUrl(user.name)
        );
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
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) return res.status(500).json({ message: 'Avatar upload service is not configured on the server.' });
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
app.use(express.static(path.join(__dirname, 'public'))); // Existing public static server

// Admin Panel Static Route - Now requires admin authentication via middleware before serving the actual index.html
// For simplicity, we will rely on client-side JS to redirect if no token.
app.get('/admin-panel', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-panel', 'index.html'));
});

// Redirect /admin to /admin-panel for consistency (optional)
app.get('/admin', (req, res) => {
    res.redirect('/admin-panel');
});

// Admin Login Page Route (publicly accessible)
app.get('/admin-login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
});

app.get('/api/feedbacks', async (req, res) => {
    try {
        const allFeedbacks = await Feedback.find()
            .populate({ path: 'userId', select: 'loginMethod isVerified email name avatarUrl createdAt' })
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
        readByAdmin: false, // New feedbacks are unread by default
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

        // Call push notification here after successful feedback submission
        sendPushNotificationToAdmin(newFeedback);

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
    } catch (error) { console.error(`Feedback update error (ID: ${feedbackId}):`, error); res.status(500).json({ message: 'Failed to update profile.', error: error.message }); }
});

// --- Admin Panel Routes (NOW PROTECTED by authenticateAdminToken) ---
app.delete('/api/admin/feedback/:id', authenticateAdminToken, async (req, res) => { console.log(`ADMIN DEL: ${req.params.id}`); try { const fb = await Feedback.findByIdAndDelete(req.params.id); if (!fb) return res.status(404).json({ message: 'ID not found.' }); res.status(200).json({ message: 'Deleted.' }); } catch (e) { console.error(`ADMIN DEL ERR: ${req.params.id}`, e); res.status(500).json({ message: 'Failed.', error: e.message }); } });
app.delete('/api/admin/feedbacks/batch-delete', authenticateAdminToken, async (req, res) => { const { ids } = req.body; console.log(`ADMIN BATCH DEL:`, ids); if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: 'No IDs.' }); try { const r = await Feedback.deleteMany({ _id: { $in: ids } }); if (r.deletedCount === 0) return res.status(404).json({ message: 'None found.' }); res.status(200).json({ message: `${r.deletedCount} deleted.`, deletedCount: r.deletedCount }); } catch (e) { console.error(`ADMIN BATCH DEL ERR:`, e); res.status(500).json({ message: 'Failed.', error: e.message }); } });
app.post('/api/admin/feedback/:id/reply', authenticateAdminToken, async (req, res) => { const fId = req.params.id; const { replyText, adminName } = req.body; console.log(`ADMIN REPLY: ${fId}, Text: ${replyText}`); if (!replyText) return res.status(400).json({ message: 'Reply text missing.' }); try { const fb = await Feedback.findById(fId); if (!fb) return res.status(404).json({ message: 'ID not found.' }); fb.replies.push({ text: replyText, adminName: adminName || 'Admin', timestamp: new Date() }); await fb.save(); res.status(200).json({ message: 'Replied.', reply: fb.replies[fb.replies.length - 1] }); } catch (e) { console.error(`ADMIN REPLY ERR: ${fId}`, e); res.status(500).json({ message: 'Failed.', error: e.message }); } });

// NEW: DELETE a specific admin reply
app.delete('/api/admin/feedback/:feedbackId/reply/:replyId', authenticateAdminToken, async (req, res) => {
    try {
        const { feedbackId, replyId } = req.params;
        const updatedFeedback = await Feedback.findByIdAndUpdate(
            feedbackId,
            { $pull: { replies: { _id: replyId } } },
            { new: true }
        );
        if (!updatedFeedback) {
            return res.status(404).json({ message: "Feedback or reply not found." });
        }
        res.status(204).send(); // 204 No Content is appropriate for a successful delete
    } catch (error) {
        console.error("ADMIN DEL REPLY ERR:", error);
        res.status(500).json({ message: "Server error while deleting reply." });
    }
});

// NEW: UPDATE (edit) a specific admin reply
app.put('/api/admin/feedback/:feedbackId/reply/:replyId', authenticateAdminToken, async (req, res) => {
    try {
        const { feedbackId, replyId } = req.params;
        const { text } = req.body;
        if (!text || text.trim() === '') {
            return res.status(400).json({ message: "Reply text cannot be empty." });
        }
        const updatedFeedback = await Feedback.findOneAndUpdate(
            { "_id": feedbackId, "replies._id": replyId },
            { "$set": { "replies.$.text": text, "replies.$.timestamp": new Date() } },
            { new: true }
        );
        if (!updatedFeedback) {
            return res.status(404).json({ message: "Feedback or reply not found." });
        }
        res.status(200).json({ message: "Reply updated successfully." });
    } catch (error) {
        console.error("ADMIN EDIT REPLY ERR:", error);
        res.status(500).json({ message: "Server error while updating reply." });
    }
});


app.put('/api/admin/feedback/:id/pin', authenticateAdminToken, async (req, res) => {
    const { isPinned } = req.body;
    if (typeof isPinned !== 'boolean') {
        return res.status(400).json({ message: 'Invalid request: "isPinned" must be a boolean.' });
    }
    try {
        const feedbackToUpdate = await Feedback.findById(req.params.id).populate({ path: 'userId', select: 'loginMethod isVerified' });
        if (!feedbackToUpdate) {
            return res.status(404).json({ message: 'Feedback not found.' });
        }
        feedbackToUpdate.isPinned = isPinned;
        await feedbackToUpdate.save();
        console.log(`ADMIN PIN/UNPIN: Feedback ID ${req.params.id} set to isPinned: ${isPinned}`);
        res.status(200).json(feedbackToUpdate);
    } catch (error) {
        console.error(`ADMIN PIN/UNPIN ERR: ${req.params.id}`, error);
        res.status(500).json({ message: 'Server error while updating feedback.', error: error.message });
    }
});

app.put('/api/admin/feedback/:feedbackId/change-avatar', authenticateAdminToken, async (req, res) => {
    const { feedbackId } = req.params;
    console.log(`ADMIN AVATAR CHANGE FOR FEEDBACK: ${feedbackId}`);

    try {
        const feedback = await Feedback.findById(feedbackId);
        if (!feedback) {
            return res.status(404).json({ message: 'Feedback not found.' });
        }

        let newAvatarUrl;

        if (feedback.userId) {
            const user = await User.findById(feedback.userId);
            if (user) {
                if (!user.name) return res.status(400).json({ message: 'User name missing for avatar generation.' });

                newAvatarUrl = getDiceBearAvatarUrl(user.name, Date.now().toString());

                user.avatarUrl = newAvatarUrl;
                await user.save();

                await Feedback.updateMany({ userId: user._id }, { $set: { avatarUrl: newAvatarUrl } });

                // Fetch the updated feedback to return the full object
                const updatedFeedback = await Feedback.findById(feedbackId).populate({ path: 'userId', select: 'loginMethod isVerified' });
                return res.status(200).json(updatedFeedback);
            }
        }

        // Fallback for guests or if user was deleted
        if (!feedback.name) return res.status(400).json({ message: 'Guest name missing for avatar generation.' });

        newAvatarUrl = getDiceBearAvatarUrl(feedback.name, Date.now().toString());
        feedback.avatarUrl = newAvatarUrl;
        await feedback.save();

        res.status(200).json(feedback);

    } catch (error) {
        console.error(`ADMIN AVATAR CHANGE ERR ON FEEDBACK ${feedbackId}:`, error);
        res.status(500).json({ message: 'Failed to change avatar due to server error.', error: error.message });
    }
});

// NEW: PATCH route to mark feedback as read
app.patch('/api/admin/feedbacks/:id/mark-read', authenticateAdminToken, async (req, res) => {
    try {
        const feedbackId = req.params.id;
        const feedback = await Feedback.findByIdAndUpdate(
            feedbackId,
            { $set: { readByAdmin: true } },
            { new: true } // Return the updated document
        );
        if (!feedback) {
            return res.status(404).json({ message: 'Feedback not found.' });
        }
        res.status(200).json({ success: true, message: 'Feedback marked as read.', feedback });
    } catch (error) {
        console.error(`Error marking feedback ${req.params.id} as read:`, error);
        res.status(500).json({ message: 'Failed to mark feedback as read.', error: error.message });
    }
});


// BLOG API ROUTES ADDED HERE (NOW PROTECTED by authenticateAdminToken)
// Add new blog (ADMIN)
app.post('/api/admin/blog', authenticateAdminToken, async (req, res) => {
  const { link, title, summary, badge } = req.body;
  if (!link || !title || !summary) return res.status(400).json({ message: 'Missing fields.' });
  try {
    const blog = new Blog({ link, title, summary, badge });
    await blog.save();
    res.status(201).json({ message: 'Blog created.', blog });
  } catch (err) {
    res.status(500).json({ message: 'Fail.', error: err.message });
  }
});

// Get all blogs (PUBLIC) - This remains public as it's for the frontend blog display
app.get('/api/blogs', async (req, res) => {
  try {
    const blogs = await Blog.find().sort({ date: -1 });
    res.json(blogs);
  } catch (error) {
    console.error("Error fetching blogs:", error);
    res.status(500).json({ message: "Failed to fetch blogs.", error: error.message });
  }
});

// DELETE blog by ID (ADMIN)
app.delete('/api/admin/blog/:id', authenticateAdminToken, async (req, res) => {
  try {
    const deletedBlog = await Blog.findByIdAndDelete(req.params.id);
    if (!deletedBlog) {
      return res.status(404).json({ message: 'Blog not found.' });
    }
    res.json({ message: 'Blog deleted successfully.' });
  } catch (e) {
    console.error("Delete blog error:", e);
    res.status(500).json({ message: 'Failed to delete blog.', error: e.message });
  }
});

// UPDATE blog by ID (ADMIN)
app.put('/api/admin/blog/:id', authenticateAdminToken, async (req, res) => {
  const { link, title, summary, badge } = req.body;
  if (!link || !title || !summary) return res.status(400).json({ message: 'Missing fields for update.' });
  try {
    const blog = await Blog.findByIdAndUpdate(
      req.params.id,
      { link, title, summary, badge },
      { new: true, runValidators: true } // new: true returns the updated document, runValidators ensures schema validation
    );
    if (!blog) {
      return res.status(404).json({ message: 'Blog not found.' });
    }
    res.json({ message: 'Blog updated successfully.', blog });
  } catch (e) {
    console.error("Update blog error:", e);
    res.status(500).json({ message: 'Failed to update blog.', error: e.message });
  }
});

// --- Web Push Notification Setup ---
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// NEW: Endpoint to provide VAPID Public Key to the frontend
app.get('/api/vapid-public-key', (req, res) => {
    if (!process.env.VAPID_PUBLIC_KEY) {
        console.error("VAPID_PUBLIC_KEY is not set in environment variables when serving to frontend.");
        return res.status(500).json({ message: "VAPID public key not configured on server." });
    }
    res.send(process.env.VAPID_PUBLIC_KEY);
});


// Existing endpoint to save admin push subscription
app.post('/api/admin/save-subscription', authenticateAdminToken, async (req, res) => {
    // FIXED: Correctly parse the subscription object, allowing for nested or direct payload
    const subscription = req.body.subscription || req.body; 
    if (!subscription || !subscription.endpoint) {
        return res.status(400).json({ message: 'No push subscription data provided, or endpoint missing.' });
    }
    try {
        const adminUser = await User.findOne({ username: ADMIN_USERNAME });
        if (!adminUser) {
            return res.status(404).json({ message: 'Admin user not found in database.' });
        }
        adminUser.pushSubscription = subscription;
        await adminUser.save();
        adminPushSubscription = subscription; // Update in-memory as well
        console.log("Admin push subscription saved to DB and in-memory.");
        res.status(201).json({ message: 'Admin push subscription saved successfully!' });
    } catch (error) {
        console.error("Error saving admin push subscription:", error);
        res.status(500).json({ message: 'Failed to save admin push subscription.', error: error.message });
    }
});


// Function to send push notification to admin
async function sendPushNotificationToAdmin(feedback) { // Make this function async
  // Always use the latest loaded subscription
  if (adminPushSubscription) { // Check if it's set
    const payload = JSON.stringify({
      title: 'New Feedback Received!',
      body: `From: ${feedback.name} | Rating: ${feedback.rating}\n"${feedback.feedback}"`,
      icon: '/icons/icon-192x192.png' // Optional: Add an icon for the notification
    });

    webpush.sendNotification(adminPushSubscription, payload)
      .then(() => console.log('Push notification sent to admin!'))
      .catch(async err => { // Make this async to use await with DB operations if needed for cleanup
        console.error('Error sending push notification to admin:', err);
        // If subscription is no longer valid, clear it from memory and DB
        if (err.statusCode === 404 || err.statusCode === 410) {
            console.warn('Admin push subscription is no longer valid. Clearing it from memory and DB.');
            adminPushSubscription = null; // Clear from memory

            // Also clear from DB
            try {
                // Find the admin user by username and clear their subscription
                const adminUserInDB = await User.findOne({ username: ADMIN_USERNAME });
                if (adminUserInDB) {
                    adminUserInDB.pushSubscription = null;
                    await adminUserInDB.save();
                    console.log('Invalid admin push subscription removed from DB.');
                }
            } catch (dbError) {
                console.error('Error removing invalid subscription from DB:', dbError);
            }
        }
      });
  } else {
    console.log('No admin push subscription found. Cannot send notification.');
  }
}


// Fallback for unmatched API routes and other static files
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({message: "API endpoint not found."});
  } else {
    // Serve static files from the 'public' directory
    // This will handle requests like /index.html, /verify-email.html etc.
    res.sendFile(path.join(__dirname, 'public', req.path));
  }
});


app.listen(PORT, () => {
    console.log(`Nobita's server is running on port ${PORT}: http://localhost:${PORT}`);
});