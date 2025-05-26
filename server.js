// server.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs'); // Password hashing ke liye

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://dontchange365:DtUiOMFzQVM0tG9l@nobifeedback.9ntuipc.mongodb.net/?retryWrites=true&w=majority&appName=nobifeedback';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'samshaad365';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'shizuka123';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '609784004025-li543jevd5e9u3a58ihvr98a2jpqfb8b.apps.googleusercontent.com';
const JWT_SECRET = process.env.JWT_SECRET || 'YAHAN_EK_BAHUT_HI_STRONG_AUR_SECRET_KEY_DAALO_BHAI';

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

mongoose.connect(MONGODB_URI)
  .then(() => console.log('MongoDB se connection safal!'))
  .catch(err => console.error('MongoDB connection mein gadbad:', err));

function getDiceBearAvatarUrl(name, randomSeed = '') {
    const seedName = (typeof name === 'string' && name) ? name.toLowerCase() : 'default_seed';
    const seed = encodeURIComponent(seedName + randomSeed);
    return `https://api.dicebear.com/8.x/adventurer/svg?seed=${seed}&flip=true&radius=50&doodle=true&scale=90`;
}

// User Schema (Naya)
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String }, // Hashed password, Google users ke liye optional
  googleId: { type: String, sparse: true, unique: true, default: null },
  avatarUrl: { type: String },
  loginMethod: { type: String, enum: ['email', 'google'], required: true },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Feedback Schema (Updated: userId add kiya gaya)
const feedbackSchema = new mongoose.Schema({
  name: { type: String, required: true }, // Yeh user ka naam hoga jo JWT se aayega
  feedback: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  timestamp: { type: Date, default: Date.now },
  avatarUrl: { type: String }, // User ka avatar
  userIp: { type: String },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Link to User model
  googleIdSubmitter: { type: String, sparse: true }, // Agar Google se login karke submit kiya tha toh (optional, mainly userId use hoga)
  isEdited: { type: Boolean, default: false },
  originalContent: {
    name: String,
    feedback: String,
    rating: Number,
    timestamp: Date
  },
  replies: [{
    text: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    adminName: { type: String, default: 'Admin' }
  }]
});

const Feedback = mongoose.model('Feedback', feedbackSchema);

app.use(cors({
    origin: ['https://nobita-feedback-app-online.onrender.com', 'http://localhost:3000', `http://localhost:${PORT}`, 'https://accounts.google.com', 'https://*.google.com'],
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
        if (err) {
            console.error("JWT Verification Error:", err.message);
            return res.status(403).json({ message: "Token valid nahi hai ya expire ho gaya hai." });
        }
        req.user = user; // Ab req.user mein { userId, name, email, avatarUrl, loginMethod } hoga
        next();
    });
};

const authenticateTokenOptional = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token) {
        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (!err) req.user = user;
            next();
        });
    } else {
        next();
    }
};

// --- Naye Auth Routes ---
// SIGNUP
app.post('/api/auth/signup', async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ message: "Naam, email, aur password zaroori hai." });
    }
    if (password.length < 6) {
        return res.status(400).json({ message: "Password kam se kam 6 characters ka hona chahiye." });
    }

    try {
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({ message: "Yeh email pehle se register hai." });
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const userAvatar = getDiceBearAvatarUrl(name);

        const newUser = new User({
            name,
            email: email.toLowerCase(),
            password: hashedPassword,
            avatarUrl: userAvatar,
            loginMethod: 'email'
        });
        await newUser.save();

        const userForToken = {
            userId: newUser._id,
            name: newUser.name,
            email: newUser.email,
            avatarUrl: newUser.avatarUrl,
            loginMethod: 'email'
        };
        const appToken = jwt.sign(userForToken, JWT_SECRET, { expiresIn: '7d' });

        res.status(201).json({ token: appToken, user: userForToken });

    } catch (error) {
        console.error('Signup mein error:', error);
        res.status(500).json({ message: "Account banane mein kuch dikkat aa gayi.", error: error.message });
    }
});

// LOGIN (Email/Password)
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: "Email aur password zaroori hai." });
    }

    try {
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(401).json({ message: "Email ya password galat hai." });
        }
        if (user.loginMethod === 'google' && !user.password) {
            return res.status(401).json({ message: "Aapne Google se sign up kiya tha. Kripya Google se login karein." });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Email ya password galat hai." });
        }

        const userForToken = {
            userId: user._id,
            name: user.name,
            email: user.email,
            avatarUrl: user.avatarUrl,
            loginMethod: user.loginMethod // Should be 'email' here
        };
        const appToken = jwt.sign(userForToken, JWT_SECRET, { expiresIn: '7d' });
        res.status(200).json({ token: appToken, user: userForToken });

    } catch (error) {
        console.error('Login mein error:', error);
        res.status(500).json({ message: "Login karne mein kuch dikkat aa gayi.", error: error.message });
    }
});

// Google Sign-In (Updated)
app.post('/api/auth/google-signin', async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: 'Google ID token nahi mila.' });

    try {
        const ticket = await googleClient.verifyIdToken({
            idToken: token,
            audience: GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        if (!payload) throw new Error("Google token payload nahi mila.");

        const { sub: googleId, name, email, picture: googleAvatar } = payload;

        let user = await User.findOne({ googleId });

        if (!user) { // Agar Google ID se user nahi mila
            user = await User.findOne({ email: email.toLowerCase() }); // Email se check karo
            if (user) { // User email se mila
                if (user.loginMethod === 'email') {
                    // Email user pehle se hai, Google ID link kar do
                    user.googleId = googleId;
                    user.avatarUrl = googleAvatar || user.avatarUrl; // Google avatar prefer karo
                    user.loginMethod = 'google'; // Ya 'both' if you want to allow both logins
                }
                // Agar email se user mila aur woh already Google user hai, toh kuch karne ki zaroorat nahi (upar googleId se mil jayega)
            } else { // Naya user
                user = new User({
                    googleId,
                    name,
                    email: email.toLowerCase(),
                    avatarUrl: googleAvatar || getDiceBearAvatarUrl(name), // Fallback to DiceBear if no Google picture
                    loginMethod: 'google'
                });
            }
            await user.save();
        } else { // User Google ID se mil gaya, ensure avatar is up-to-date
             if (user.avatarUrl !== googleAvatar && googleAvatar) {
                user.avatarUrl = googleAvatar;
                await user.save();
            }
        }

        const userForToken = {
            userId: user._id,
            name: user.name,
            email: user.email,
            avatarUrl: user.avatarUrl,
            loginMethod: 'google' // Ya user.loginMethod agar aap multiple methods allow kar rahe hain
        };
        const appToken = jwt.sign(userForToken, JWT_SECRET, { expiresIn: '7d' });

        res.status(200).json({ token: appToken, user: userForToken });
    } catch (error) {
        console.error('Google token verification mein problem:', error);
        res.status(401).json({ message: 'Google token invalid hai.', error: error.message });
    }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
    res.status(200).json(req.user); // req.user ab JWT se directly aata hai
});

app.use(express.static(path.join(__dirname, 'public'), { index: 'index.html' }));

app.get('/api/feedbacks', async (req, res) => {
    try {
        const allFeedbacks = await Feedback.find().sort({ timestamp: -1 });
        res.status(200).json(allFeedbacks);
    } catch (error) {
        res.status(500).json({ message: 'Feedbacks fetch nahi ho paye.', error: error.message });
    }
});

// Submit New Feedback (Updated)
app.post('/api/feedback', authenticateTokenOptional, async (req, res) => {
    const { feedback, rating, name: formName } = req.body; // Form se naam aa sakta hai agar user logged in nahi
    const userIp = req.clientIp;

    if (!feedback || !rating || rating === '0') {
        return res.status(400).json({ message: 'Feedback aur rating zaroori hai.' });
    }

    let feedbackData = {
        feedback: feedback,
        rating: parseInt(rating),
        userIp: userIp,
        isEdited: false,
    };

    if (req.user) { // User logged in hai (chahe email se ya Google se)
        feedbackData.name = req.user.name;
        feedbackData.avatarUrl = req.user.avatarUrl;
        feedbackData.userId = req.user.userId;
        if (req.user.loginMethod === 'google') {
            const loggedInUser = await User.findById(req.user.userId);
            if (loggedInUser && loggedInUser.googleId) {
                 feedbackData.googleIdSubmitter = loggedInUser.googleId;
            }
        }
    } else { // User logged in nahi hai (Anonymous) - ISKO ABHI HUM SUPPORT NAHI KAR RAHE HAIN FULLY NAYE SYSTEM MEIN
            // Agar anonymous feedback allow karna hai, toh User schema mein ek 'anonymous' user type banakar
            // ya bina userId ke feedback save karna padega. Abhi ke liye, hum assume kar rahe hain ki user logged in hona chahiye.
            // For simplicity, let's require login. If not, then need a default userId or handle no userId.
            // YA, agar form se naam aa raha hai for non-logged in user (jaise pehle tha)
        if (!formName) {
             return res.status(400).json({ message: 'Login nahi kiya hai toh naam daalna zaroori hai.' });
        }
        // Agar anonymous allow karna hai, toh yahan default 'anonymous' user ki ID ya placeholder use karein.
        // Abhi ke liye, is flow ko restricted rakhte hain to logged-in users for simplicity.
        // Forcing login for new feedback system
        return res.status(403).json({ message: "Feedback dene ke liye कृपया login karein." });
    }


    try {
        const newFeedback = new Feedback(feedbackData);
        await newFeedback.save();
        res.status(201).json({ message: 'Aapka feedback सफलतापूर्वक jama ho gaya!', feedback: newFeedback });
    } catch (error) {
        res.status(500).json({ message: 'Feedback save nahi ho paya.', error: error.message });
    }
});

// Update Existing Feedback (Updated)
app.put('/api/feedback/:id', authenticateToken, async (req, res) => {
    const feedbackId = req.params.id;
    const { feedback, rating } = req.body;
    const loggedInJwtUser = req.user; // Contains { userId, name, email, avatarUrl, loginMethod }

    if (!feedback || !rating || rating === '0') {
        return res.status(400).json({ message: 'Update ke liye feedback aur rating zaroori hai!' });
    }

    try {
        const existingFeedback = await Feedback.findById(feedbackId);
        if (!existingFeedback) {
            return res.status(404).json({ message: 'Yeh feedback ID mila nahi.' });
        }

        // Authorization: Sirf feedback ka owner hi edit kar sakta hai
        if (existingFeedback.userId.toString() !== loggedInJwtUser.userId) {
            return res.status(403).json({ message: 'Aap sirf apne diye gaye feedbacks ko hi edit kar sakte hain.' });
        }

        // User ka current name aur avatar use karo JWT se
        const currentNameFromJwt = loggedInJwtUser.name;
        // const currentAvatarFromJwt = loggedInJwtUser.avatarUrl; // Avatar update nahi kar rahe yahan

        const parsedRating = parseInt(rating);
        const contentActuallyChanged = existingFeedback.feedback !== feedback || existingFeedback.rating !== parsedRating || existingFeedback.name !== currentNameFromJwt;

        if (contentActuallyChanged) {
            if (!existingFeedback.originalContent) {
                existingFeedback.originalContent = {
                    name: existingFeedback.name,
                    feedback: existingFeedback.feedback,
                    rating: existingFeedback.rating,
                    timestamp: existingFeedback.timestamp
                };
            }
            existingFeedback.name = currentNameFromJwt; // Hamesha current JWT user ka naam use karo
            existingFeedback.feedback = feedback;
            existingFeedback.rating = parsedRating;
            existingFeedback.timestamp = Date.now();
            existingFeedback.isEdited = true;
            // existingFeedback.avatarUrl = currentAvatarFromJwt; // Agar avatar bhi update karna hai
        }

        await existingFeedback.save();
        res.status(200).json({ message: 'Aapka feedback update ho gaya!', feedback: existingFeedback });

    } catch (error) {
        res.status(500).json({ message: 'Feedback update nahi ho paya.', error: error.message });
    }
});


// --- Admin Panel Routes (Pehle Jaise Hi) ---
const authenticateAdmin = (req, res, next) => {
    // ... (Admin authentication logic pehle jaisa hi)
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate'); 
    res.setHeader('Pragma', 'no-cache'); 
    res.setHeader('Expires', '0');

    const authHeader = req.headers.authorization;
    if (!authHeader) {
        res.set('WWW-Authenticate', 'Basic realm="Admin Area"');
        return res.status(401).json({ message: 'UNAUTHORIZED: AUTHORIZATION HEADER MISSING.' });
    }
    const [scheme, credentials] = authHeader.split(' ');
    if (scheme !== 'Basic' || !credentials) {
        res.set('WWW-Authenticate', 'Basic realm="Admin Area"');
        return res.status(401).json({ message: 'UNAUTHORIZED: INVALID AUTHORIZATION SCHEME.' });
    }
    const [username, password] = Buffer.from(credentials, 'base64').toString().split(':');
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        next();
    } else {
        res.set('WWW-Authenticate', 'Basic realm="Admin Area"');
        res.status(401).json({ message: 'UNAUTHORIZED: SAHI ADMIN CREDENTIALS NAHI HAIN, BHAI!' });
    }
};

app.get('/admin-panel-nobita', authenticateAdmin, async (req, res) => {
    try {
        const feedbacks = await Feedback.find().sort({ timestamp: -1 });
        const encodedCredentials = Buffer.from(`${ADMIN_USERNAME}:${ADMIN_PASSWORD}`).toString('base64');
        const authHeaderValue = `Basic ${encodedCredentials}`;
        const nobitaAvatarUrl = 'https://i.ibb.co/FsSs4SG/creator-avatar.png';

        let html = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>ADMIN PANEL: NOBITA'S COMMAND CENTER</title>
                <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap" rel="stylesheet">
                <style>
                    body { font-family: 'Roboto', sans-serif; background: linear-gradient(135deg, #1A1A2E, #16213E); color: #E0E0E0; margin: 0; padding: 30px 20px; display: flex; flex-direction: column; align-items: center; min-height: 100vh; }
                    h1 { color: #FFD700; text-align: center; margin-bottom: 40px; font-size: 2.8em; text-shadow: 0 0 15px rgba(255,215,0,0.5); }
                    .main-panel-btn-container { width: 100%; max-width: 1200px; display: flex; justify-content: flex-start; margin-bottom: 20px; padding: 0 10px; }
                    .main-panel-btn { background-color: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 8px; font-size: 1em; font-weight: bold; cursor: pointer; transition: background-color 0.3s ease, transform 0.2s; text-decoration: none; display: inline-block; text-transform: uppercase; }
                    .main-panel-btn:hover { background-color: #0056b3; transform: translateY(-2px); }
                    .feedback-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 30px; width: 100%; max-width: 1200px; }
                    .feedback-card { background-color: transparent; border-radius: 15px; perspective: 1000px; min-height: 480px; }
                    .feedback-card-inner { position: relative; width: 100%; height: 100%; transition: transform 0.7s; transform-style: preserve-3d; box-shadow: 0 8px 25px rgba(0, 0, 0, 0.4); border-radius: 15px; }
                    .feedback-card.is-flipped .feedback-card-inner { transform: rotateY(180deg); }
                    .feedback-card-front, .feedback-card-back { position: absolute; width: 100%; height: 100%; -webkit-backface-visibility: hidden; backface-visibility: hidden; background-color: #2C3E50; color: #E0E0E0; border-radius: 15px; padding: 25px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; overflow-y: auto; }
                    .feedback-card-back { transform: rotateY(180deg); background-color: #34495E; }
                    .feedback-header { display: flex; align-items: center; gap: 15px; margin-bottom: 15px; flex-shrink: 0; }
                    .feedback-avatar { width: 60px; height: 60px; border-radius: 50%; overflow: hidden; border: 3px solid #FFD700; flex-shrink: 0; box-shadow: 0 0 10px rgba(255,215,0,0.3); }
                    .feedback-avatar img { width: 100%; height: 100%; object-fit: cover; }
                    .feedback-info { flex-grow: 1; display: flex; flex-direction: column; align-items: flex-start; }
                    .feedback-info h4 { margin: 0; font-size: 1.4em; color: #FFD700; text-transform: uppercase; display: flex; align-items: center; gap: 8px; }
                    .google-user-tag { background-color: #4285F4; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.7em; margin-left: 8px; vertical-align: middle;}
                    .email-user-tag { background-color: #6c757d; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.7em; margin-left: 8px; vertical-align: middle;}
                    .feedback-info .rating { font-size: 1.1em; color: #F39C12; margin-top: 5px; }
                    .feedback-info .user-ip { font-size: 0.9em; color: #AAB7B8; margin-top: 5px; }
                    .feedback-body { font-size: 1em; color: #BDC3C7; line-height: 1.6; margin-bottom: 15px; flex-grow: 1; overflow-y: auto; word-wrap: break-word; }
                    .feedback-date { font-size: 0.8em; color: #7F8C8D; text-align: right; margin-bottom: 10px; border-top: 1px solid #34495E; padding-top: 10px; flex-shrink: 0; }
                    .action-buttons { display: flex; gap: 10px; margin-bottom: 10px; flex-shrink: 0;}
                    .action-buttons button, .flip-btn { flex-grow: 1; padding: 10px 12px; border: none; border-radius: 8px; font-size: 0.9em; font-weight: bold; cursor: pointer; transition: background-color 0.3s ease, transform 0.2s; text-transform: uppercase; }
                    .action-buttons button:hover, .flip-btn:hover { transform: translateY(-2px); }
                    .delete-btn { background-color: #E74C3C; color: white; } .delete-btn:hover { background-color: #C0392B; }
                    .change-avatar-btn { background-color: #3498DB; color: white; } .change-avatar-btn:hover { background-color: #2980B9; }
                    .flip-btn { background-color: #fd7e14; color: white; margin-top:10px; flex-grow:0; width:100%;} .flip-btn:hover { background-color: #e66800; }
                    .reply-section { border-top: 1px solid #34495E; padding-top: 15px; margin-top:10px; flex-shrink: 0;}
                    .reply-section textarea { width: calc(100% - 20px); padding: 10px; border: 1px solid #4A6070; border-radius: 8px; background-color: #34495E; color: #ECF0F1; resize: vertical; min-height: 50px; margin-bottom: 10px; font-size: 0.95em; }
                    .reply-section textarea::placeholder { color: #A9B7C0; }
                    .reply-btn { background-color: #27AE60; color: white; width: 100%; padding: 10px; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; transition: background-color 0.3s ease, transform 0.2s; text-transform: uppercase; }
                    .reply-btn:hover { background-color: #229954; transform: translateY(-2px); }
                    .replies-display { margin-top: 15px; background-color: #213042; border-radius: 10px; padding: 10px; border: 1px solid #2C3E50; max-height: 150px; overflow-y: auto;}
                    .replies-display h4 { color: #85C1E9; font-size: 1.1em; margin-bottom: 10px; border-bottom: 1px solid #34495E; padding-bottom: 8px; }
                    .single-reply { border-bottom: 1px solid #2C3E50; padding-bottom: 10px; margin-bottom: 10px; font-size: 0.9em; color: #D5DBDB; display: flex; align-items: flex-start; gap: 10px; }
                    .single-reply:last-child { border-bottom: none; margin-bottom: 0; }
                    .admin-reply-avatar-sm { width: 30px; height: 30px; border-radius: 50%; border: 2px solid #9B59B6; flex-shrink: 0; object-fit: cover; box-shadow: 0 0 5px rgba(155, 89, 182, 0.5); }
                    .reply-content-wrapper { flex-grow: 1; word-wrap: break-word; } .reply-admin-name { font-weight: bold; color: #9B59B6; display: inline; margin-right: 5px; }
                    .reply-timestamp { font-size: 0.75em; color: #8E9A9D; margin-left: 10px; }
                    .edited-admin-tag { background-color: #5cb85c; color: white; padding: 3px 8px; border-radius: 5px; font-size: 0.75em; font-weight: bold; vertical-align: middle; }
                    /* ... (baaki admin panel CSS pehle jaisa) ... */
                </style>
            </head>
            <body>
                <h1>NOBITA'S FEEDBACK COMMAND CENTER</h1>
                <div class="main-panel-btn-container"> <a href="/" class="main-panel-btn">← MAIN FEEDBACK PANEL</a> </div>
                <div class="feedback-grid">
        `;

        if (feedbacks.length === 0) {
            html += `<p style="text-align: center; color: #7F8C8D; font-size: 1.2em; grid-column: 1 / -1;">Abhi tak koi feedback nahi aaya hai!</p>`;
        } else {
            for (const fb of feedbacks) { // Use for...of for async operations if any inside (not here, but good practice)
                let userTag = '';
                // Optional: Fetch user details if you want to show loginMethod on admin panel
                // const feedbackUser = await User.findById(fb.userId);
                // if (feedbackUser) {
                //    userTag = feedbackUser.loginMethod === 'google' ? '<span class="google-user-tag">Google User</span>' : '<span class="email-user-tag">Email User</span>';
                // }
                // For now, using googleIdSubmitter to differentiate if needed
                if (fb.googleIdSubmitter) {
                    userTag = '<span class="google-user-tag">Google User</span>';
                } else {
                    userTag = '<span class="email-user-tag">User</span>'; // General tag
                }


                html += `
                    <div class="feedback-card" id="card-${fb._id}">
                        <div class="feedback-card-inner">
                            <div class="feedback-card-front">
                                <div class="feedback-header">
                                    <div class="feedback-avatar"><img src="${fb.avatarUrl || getDiceBearAvatarUrl(fb.name)}" alt="${fb.name.charAt(0)}"></div>
                                    <div class="feedback-info">
                                        <h4>${fb.name} ${fb.isEdited ? '<span class="edited-admin-tag">EDITED</span>' : ''} ${userTag}</h4>
                                        <div class="rating">${'★'.repeat(fb.rating)}${'☆'.repeat(5 - fb.rating)}</div>
                                        <div class="user-ip">IP: ${fb.userIp || 'N/A'} | UserID: ${fb.userId ? fb.userId.toString().substring(0,10) + '...' : 'N/A'}</div>
                                    </div>
                                </div>
                                <div class="feedback-body"><p>${fb.feedback}</p></div>
                                <div class="feedback-date">
                                    ${fb.isEdited ? 'Last Edited' : 'Posted'}: ${new Date(fb.timestamp).toLocaleString()}
                                    ${fb.isEdited && fb.originalContent ? `<br><small>Original: ${new Date(fb.originalContent.timestamp).toLocaleString()}</small>` : ''}
                                </div>
                                <div class="action-buttons">
                                    <button class="delete-btn" onclick="tryDeleteFeedback('${fb._id}')">DELETE</button>
                                    ${!fb.googleIdSubmitter ? `<button class="change-avatar-btn" onclick="tryChangeAvatar('${fb.userId}', '${fb.name}')">AVATAR</button>` : ''} 
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
                                            </div>`).join('')}
                                    </div>
                                </div>
                                ${fb.isEdited && fb.originalContent ? `<button class="flip-btn" onclick="flipCard('${fb._id}')">VIEW ORIGINAL</button>` : ''}
                            </div>`;
                if (fb.isEdited && fb.originalContent) {
                    html += `
                            <div class="feedback-card-back">
                                <div class="feedback-header">
                                    <div class="feedback-avatar"><img src="${(fb.originalContent.avatarUrl || fb.avatarUrl)}" alt="Original"></div>
                                    <div class="feedback-info">
                                        <h4>ORIGINAL: ${fb.originalContent.name}</h4>
                                        <div class="rating">${'★'.repeat(fb.originalContent.rating)}${'☆'.repeat(5 - fb.originalContent.rating)}</div>
                                    </div>
                                </div>
                                <div class="feedback-body"><p>${fb.originalContent.feedback}</p></div>
                                <div class="feedback-date">Originally Posted: ${new Date(fb.originalContent.timestamp).toLocaleString()}</div>
                                <div style="margin-top: auto;"> <button class="flip-btn" onclick="flipCard('${fb._id}')">VIEW EDITED</button> </div>
                            </div>`;
                }
                html += `</div></div>`;
            }
        }
        html += `</div> <div id="adminModalOverlay" class="admin-modal-overlay"> <div class="admin-custom-modal"> <h3 id="adminModalTitle"></h3> <p id="adminModalMessage"></p> <div class="admin-modal-buttons"> <button id="adminModalOkButton">OK</button> <button id="adminModalConfirmButton" style="display:none;">Confirm</button> <button id="adminModalCancelButton" style="display:none;">Cancel</button> </div> </div> </div>
                <script>
                    const AUTH_HEADER = '${authHeaderValue}';
                    // ... (baaki admin panel JavaScript pehle jaisa hi) ...
                    // Note: tryChangeAvatar function ab user ID use karega agar aap usko modify karte hain backend mein
                     async function tryChangeAvatar(userId, userName) { // fbId ki jagah userId
                         showAdminModal('confirm', 'Change Avatar?', \`Change avatar for \${userName}? This will regenerate avatar for this user if they are not a Google user.\`, async (confirmed) => {
                            if(confirmed) {
                                // Backend API ko /api/admin/user/\${userId}/change-avatar jaisa banana padega
                                // Abhi ke liye, purana endpoint use kar raha hoon, lekin isko update karna hoga
                                // const res = await fetch(\`/api/admin/user/\${userId}/change-avatar\`, {method:'PUT',headers:{'Content-Type':'application/json', 'Authorization':AUTH_HEADER}});
                                // if(res.ok) { showAdminModal('alert', 'Avatar Changed!', 'Avatar updated.'); setTimeout(()=>location.reload(),1000); }
                                // else { const err = await res.json(); showAdminModal('alert', 'Error!', \`Failed to change avatar: \${err.message}\`);}
                                showAdminModal('alert', 'Info', 'Avatar change functionality for non-Google users needs backend update for User model.');
                            }
                        });
                    }
                    // Baaki functions tryDeleteFeedback, tryPostReply pehle jaise hi रहेंगे
                     function showAdminModal(type, title, message, confirmCallbackFn = null) { 
                        adminModalTitle.textContent = title; adminModalMessage.textContent = message; globalConfirmCallback = confirmCallbackFn;
                        adminModalOkButton.style.display = type === 'confirm' ? 'none' : 'inline-block';
                        adminModalConfirmButton.style.display = type === 'confirm' ? 'inline-block' : 'none';
                        adminModalCancelButton.style.display = type === 'confirm' ? 'inline-block' : 'none';
                        adminModalOverlay.style.display = 'flex';
                    }
                    adminModalOkButton.addEventListener('click', () => adminModalOverlay.style.display = 'none');
                    adminModalConfirmButton.addEventListener('click', () => { adminModalOverlay.style.display = 'none'; if (globalConfirmCallback) globalConfirmCallback(true); });
                    adminModalCancelButton.addEventListener('click', () => { adminModalOverlay.style.display = 'none'; if (globalConfirmCallback) globalConfirmCallback(false); });
                    function flipCard(id) { document.getElementById(\`card-\${id}\`).classList.toggle('is-flipped'); }
                    async function tryDeleteFeedback(id) { 
                        showAdminModal('confirm', 'Delete Feedback?', 'Are you sure you want to delete this feedback? This cannot be undone.', async (confirmed) => {
                            if(confirmed) {
                                const res = await fetch(\`/api/admin/feedback/\${id}\`, { method: 'DELETE', headers: { 'Authorization': AUTH_HEADER }});
                                if(res.ok) { showAdminModal('alert', 'Deleted!', 'Feedback deleted successfully.'); setTimeout(()=>location.reload(),1000); }
                                else { const err = await res.json(); showAdminModal('alert', 'Error!', \`Failed to delete: \${err.message}\`);}
                            }
                        });
                    }
                    async function tryPostReply(fbId, txtId) { 
                        const replyText = document.getElementById(txtId).value.trim(); if(!replyText) {showAdminModal('alert', 'Empty Reply', 'Please write something to reply.'); return;}
                        showAdminModal('confirm', 'Post Reply?', \`Confirm reply: "\${replyText.substring(0,50)}..."\`, async (confirmed) => {
                            if(confirmed) {
                                const res = await fetch(\`/api/admin/feedback/\${fbId}/reply\`, {method:'POST',headers:{'Content-Type':'application/json', 'Authorization':AUTH_HEADER}, body:JSON.stringify({replyText, adminName:'👉𝙉𝙊𝘽𝙄𝙏𝘼🤟'})});
                                if(res.ok) { showAdminModal('alert', 'Replied!', 'Reply posted.'); setTimeout(()=>location.reload(),1000); }
                                else { const err = await res.json(); showAdminModal('alert', 'Error!', \`Failed to reply: \${err.message}\`);}
                            }
                        });
                    }
                </script>
            </body></html>
        `;
        res.send(html);
    } catch (error) {
        console.error('Admin panel generate karte waqt error:', error);
        res.status(500).send(`Admin panel mein kuch gadbad hai! Error: ${error.message}`);
    }
});

app.delete('/api/admin/feedback/:id', authenticateAdmin, async (req, res) => {
    try {
        const deletedFeedback = await Feedback.findByIdAndDelete(req.params.id);
        if (!deletedFeedback) return res.status(404).json({ message: 'Feedback ID mila nahi.' });
        res.status(200).json({ message: 'Feedback delete ho gaya.' });
    } catch (error) {
        res.status(500).json({ message: 'Feedback delete nahi ho paya.', error: error.message });
    }
});

app.post('/api/admin/feedback/:id/reply', authenticateAdmin, async (req, res) => {
    const { replyText, adminName } = req.body;
    if (!replyText) return res.status(400).json({ message: 'Reply text daalo.' });
    try {
        const feedback = await Feedback.findById(req.params.id);
        if (!feedback) return res.status(404).json({ message: 'Feedback ID mila nahi.' });
        feedback.replies.push({ text: replyText, adminName: adminName || 'Admin', timestamp: new Date() });
        await feedback.save();
        res.status(200).json({ message: 'Reply post ho gaya.', reply: feedback.replies[feedback.replies.length - 1] });
    } catch (error) {
        res.status(500).json({ message: 'Reply save nahi ho paya.', error: error.message });
    }
});

// Admin API: Change Avatar for non-Google users (Needs update for User model)
// Yeh functionality ab User model se avatar update karne ke liye alag endpoint banani padegi,
// kyunki ab feedback mein direct avatar nahi, balki user ka avatar link hoga.
// Abhi ke liye, yeh endpoint shayad sahi se kaam na kare email users ke liye.
app.put('/api/admin/feedback/:id/change-avatar', authenticateAdmin, async (req, res) => {
    // Is route ko User model ke hisaab se update karna hoga.
    // Ab avatar User model mein hai. Admin ko User ka avatar update karna chahiye, na ki feedback entry ka.
    // Eg: /api/admin/user/:userId/change-avatar
    // For now, this might not work as expected for non-Google users.
    return res.status(400).json({ message: 'Avatar change functionality needs to be updated for the new User model. Google user avatars are updated via Google.' });
});


app.listen(PORT, () => {
    console.log(`Nobita ka server port ${PORT} par chalu ho gaya hai: http://localhost:${PORT}`);
});