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

// Environment Variable Checks
console.log("--- Environment Variable Check (server.js start) ---");
console.log("MONGODB_URI (loaded):", MONGODB_URI ? "SET" : "NOT SET"); //
console.log("JWT_SECRET (loaded):", JWT_SECRET ? "SET" : "NOT SET"); //
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
  .then(() => console.log('MongoDB se connection safal!')) //
  .catch(err => {
    console.error('MongoDB connection mein gadbad:', err);
    process.exit(1);
});

if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
    cloudinary.config({ cloud_name: CLOUDINARY_CLOUD_NAME, api_key: CLOUDINARY_API_KEY, api_secret: CLOUDINARY_API_SECRET });
    console.log("Cloudinary configured successfully."); //
} else {
    console.warn("Cloudinary not configured. File uploads for avatars will not work.");
}

const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 },
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

app.use(cors({ /* ... */ }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use((req, res, next) => { /* IP logging ... */ next(); });
const authenticateToken = (req, res, next) => { /* ... */ next(); };
async function sendEmail(options) { /* ... */ }

// --- Auth Routes ---
app.post('/api/auth/signup', async (req, res) => {
    // ... (signup logic remains the same as the previous version with detailed logging)
    const requestedEmail = req.body.email || 'unknown_email_in_request';
    console.log(`[Signup - ${requestedEmail}] Attempt received.`);
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        console.log(`[Signup - ${requestedEmail}] Validation Failed: Missing fields.`);
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
        const newUser = new User({ name: trimmedName, email: lowerCaseEmail, password: hashedPassword, avatarUrl: userAvatar, loginMethod: 'email' });
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
        if (error.name === 'ValidationError') { statusCode = 400; const messages = Object.values(error.errors).map(e => e.message); errorMessageDetail = `Validation failed: ${messages.join('. ')}`; console.error(`[Signup - ${requestedEmail}] Mongoose Validation Error: ${errorMessageDetail}`);
        } else if (error.message === 'Yeh email address pehle se register hai (duplicate key).') { statusCode = 400; errorMessageDetail = error.message; console.error(`[Signup - ${requestedEmail}] Duplicate email error (from post-save hook or direct code 11000): ${errorMessageDetail}`);
        } else if (error.code === 11000) { statusCode = 400; errorMessageDetail = "Yeh email address pehle se register hai (MongoDB error code 11000)."; console.error(`[Signup - ${requestedEmail}] MongoDB Duplicate Key Error (Code 11000):`, error.keyValue);
        } else if (error.message) { errorMessageDetail = error.message; }
        console.error(`[Signup - ${requestedEmail}] Error Name: ${error.name}, Error Code: ${error.code || 'N/A'}`);
        console.error(`[Signup - ${requestedEmail}] Detailed Error Stack:`, error.stack);
        res.status(statusCode).json({ message: "Account banane mein kuch dikkat aa gayi.", error: errorMessageDetail });
    }
});

app.post('/api/auth/login', async (req, res) => { /* ... same as before ... */ });
app.post('/api/auth/google-signin', async (req, res) => { /* ... same as before ... */ });
app.get('/api/auth/me', authenticateToken, async (req, res) => { /* ... same as before ... */ });
app.post('/api/user/upload-avatar', authenticateToken, upload.single('avatar'), async (req, res) => { /* ... same as before ... */ });
app.put('/api/user/update-profile', authenticateToken, async (req, res) => { /* ... same as before ... */ });
app.post('/api/user/change-password', authenticateToken, async (req, res) => { /* ... same as before ... */ });
app.post('/api/auth/request-password-reset', async (req, res) => { /* ... same as before ... */ });
app.post('/api/auth/reset-password', async (req, res) => { /* ... same as before ... */ });

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/feedbacks', async (req, res) => {
    try {
        const allFeedbacks = await Feedback.find()
            .populate({
                path: 'userId',
                select: 'name email avatarUrl loginMethod',
                strictPopulate: false // Added to address StrictPopulateError
            })
            .sort({ timestamp: -1 });
        res.status(200).json(allFeedbacks);
    } catch (error) {
        console.error("Feedbacks fetch error:", error); //
        res.status(500).json({ message: 'Feedbacks fetch nahi ho paye.', error: error.message });
    }
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
        const populatedFeedback = await Feedback.findById(newFeedback._id)
            .populate({
                path: 'userId',
                select: 'name email avatarUrl loginMethod',
                strictPopulate: false // Added to address StrictPopulateError
            });
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
        const populatedFeedback = await Feedback.findById(existingFeedback._id)
            .populate({
                path: 'userId',
                select: 'name email avatarUrl loginMethod',
                strictPopulate: false // Added to address StrictPopulateError
            });
        res.status(200).json({ message: 'Aapka feedback update ho gaya!', feedback: populatedFeedback });
    } catch (error) { console.error(`Feedback update error (ID: ${feedbackId}):`, error); res.status(500).json({ message: 'Feedback update nahi ho paya.', error: error.message }); }
});

const { ADMIN_USERNAME_ACTUAL, ADMIN_PASSWORD_ACTUAL } = (() => { /* ... */ })();
const adminAuthenticate = (req, res, next) => { /* ... */ next(); };

app.get('/admin-panel-nobita', adminAuthenticate, async (req, res) => {
    try {
        const feedbacks = await Feedback.find()
            .populate({
                path: 'userId',
                select: 'loginMethod name email avatarUrl',
                strictPopulate: false // Added to address StrictPopulateError
            })
            .sort({ timestamp: -1 });
        // ... rest of admin panel HTML generation (same as before)
        const encodedCredentials = Buffer.from(`${ADMIN_USERNAME_ACTUAL}:${ADMIN_PASSWORD_ACTUAL}`).toString('base64');
        const authHeaderValue = `Basic ${encodedCredentials}`;
        const nobitaAvatarUrl = getGenericAvatarUrl('Nobita');
        let html = `<!DOCTYPE html><html><head>...</head><body>...`; // Structure
        if (feedbacks.length === 0) { html += `<p>No feedback yet.</p>`; }
        else { feedbacks.forEach(fb => { /* HTML for each feedback card using populated userId */ }); }
        html += `... <script>const AUTH_HEADER = '${authHeaderValue}'; /* admin JS */</script></body></html>`;
        res.send(html);
    } catch (error) { console.error('Admin panel generate karte waqt error:', error); res.status(500).send(`Admin panel mein kuch gadbad hai! Error: ${error.message}`);}
});
app.delete('/api/admin/feedback/:id', adminAuthenticate, async (req, res) => { /* ... */ });
app.post('/api/admin/feedback/:id/reply', adminAuthenticate, async (req, res) => { /* ... */ });
app.put('/api/admin/user/:userId/change-avatar', adminAuthenticate, async (req, res) => { /* ... */ });


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
    console.log(`Nobita ka server port ${PORT} par chalu ho gaya hai: ${FRONTEND_URL.startsWith('http://localhost') ? `http://localhost:${PORT}`: FRONTEND_URL }`); //
});