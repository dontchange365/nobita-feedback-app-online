// server.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');

dotenv.config(); // .env file se variables load karega

const app = express();
const PORT = process.env.PORT || 3000;

// Environment Variables se configuration load karna
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://dontchange365:DtUiOMFzQVM0tG9l@nobifeedback.9ntuipc.mongodb.net/?retryWrites=true&w=majority&appName=nobifeedback'; // Apna MongoDB URI daalein
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'samshaad365';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'shizuka123';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '609784004025-li543jevd5e9u3a58ihvr98a2jpqfb8b.apps.googleusercontent.com'; // Aapka Google Client ID
const JWT_SECRET = process.env.JWT_SECRET || 'YAHAN_EK_BAHUT_HI_STRONG_AUR_SECRET_KEY_DAALO_BHAI'; // IMPORTANT: Production mein .env file mein rakho!

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// MongoDB Connection
mongoose.connect(MONGODB_URI)
  .then(() => console.log('MongoDB se connection safal! Database ab taiyaar hai!'))
  .catch(err => console.error('MongoDB connection mein gadbad ho gayi:', err));

// DiceBear Avatar URL Generator
function getDiceBearAvatarUrlServer(name, randomSeed = '') {
    const seedName = (typeof name === 'string' && name) ? name.toLowerCase() : 'default_seed';
    const seed = encodeURIComponent(seedName + randomSeed);
    return `https://api.dicebear.com/8.x/adventurer/svg?seed=${seed}&flip=true&radius=50&doodle=true&scale=90`;
}

// Feedback Schema
const feedbackSchema = new mongoose.Schema({
  name: { type: String, required: true },
  feedback: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  timestamp: { type: Date, default: Date.now },
  avatarUrl: { type: String },
  userIp: { type: String },
  googleId: { type: String, sparse: true }, // Google User's unique ID
  isEdited: { type: Boolean, default: false },
  originalContent: { // Store original content if edited
    name: String,
    feedback: String,
    rating: Number,
    timestamp: Date
  },
  replies: [ // Admin replies
    {
      text: { type: String, required: true },
      timestamp: { type: Date, default: Date.now },
      adminName: { type: String, default: 'Admin' }
    }
  ]
});

const Feedback = mongoose.model('Feedback', feedbackSchema);

// Middlewares
app.use(cors({
    origin: ['https://nobita-feedback-app-online.onrender.com', 'http://localhost:3000', `http://localhost:${PORT}`, 'https://accounts.google.com', 'https://*.google.com'], // Allowed origins
    methods: ['GET', 'POST', 'DELETE', 'PUT'], //
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'] //
}));
app.use(bodyParser.json()); //
app.use(bodyParser.urlencoded({ extended: true })); //

// IP Address Middleware
app.use((req, res, next) => {
    let clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress; //
    if (clientIp) {
        if (clientIp.substr(0, 7) === "::ffff:") { //
            clientIp = clientIp.substr(7); //
        }
        if (clientIp === '::1') { //
            clientIp = '127.0.0.1'; //
        }
        if (clientIp.includes(',')) { //
            clientIp = clientIp.split(',')[0].trim(); //
        }
    }
    req.clientIp = clientIp || 'UNKNOWN_IP'; //
    next();
});

// JWT Authentication Middleware (Strict: Blocks if no/invalid token)
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization']; //
    const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer TOKEN"

    if (token == null) return res.status(401).json({ message: "Authentication token nahi mila." }); //

    jwt.verify(token, JWT_SECRET, (err, user) => { //
        if (err) {
            console.error("JWT Verification Error:", err.message); //
            return res.status(403).json({ message: "Token valid nahi hai ya expire ho gaya hai." }); //
        }
        req.user = user; // Decoded user info from token //
        next();
    });
};

// JWT Authentication Middleware (Optional: Sets req.user if token is valid, but doesn't block if no token)
const authenticateTokenOptional = (req, res, next) => {
    const authHeader = req.headers['authorization']; //
    const token = authHeader && authHeader.split(' ')[1]; //

    if (token) {
        jwt.verify(token, JWT_SECRET, (err, user) => { //
            if (!err) {
                req.user = user; // Set user if token is valid //
            }
            // Even if there's an error (e.g., expired token), proceed without user
            next();
        });
    } else {
        next(); // No token, proceed without user
    }
};

// --- Authentication Routes ---
// Google Sign-In: Verifies Google token, returns app's JWT and user info
app.post('/api/auth/google-signin', async (req, res) => {
    const { token } = req.body; //
    if (!token) return res.status(400).json({ message: 'Google ID token nahi mila.' }); //

    try {
        const ticket = await googleClient.verifyIdToken({ //
            idToken: token, //
            audience: GOOGLE_CLIENT_ID, //
        });
        const payload = ticket.getPayload(); //
        if (!payload) throw new Error("Google token payload nahi mila."); //

        const { sub, name, email, picture } = payload; //
        const userForToken = { googleId: sub, name, email, picture }; //

        // App ka JWT generate karna
        const appToken = jwt.sign(userForToken, JWT_SECRET, { expiresIn: '7d' }); // Token 7 din tak valid rahega //

        res.status(200).json({ token: appToken, user: userForToken }); //
    } catch (error) {
        console.error('Google token verification mein problem:', error); //
        res.status(401).json({ message: 'Google token invalid hai.', error: error.message }); //
    }
});

// Validate App Token & Get User Info (Client page load par call karega)
app.get('/api/auth/me', authenticateToken, (req, res) => {
    // authenticateToken middleware req.user set kar dega agar token valid hai
    res.status(200).json(req.user); //
});

// Static Files (Frontend)
app.use(express.static(path.join(__dirname, 'public'), { index: 'index.html' })); // Assuming index.html is in 'public' folder //
// Agar index.html root mein hai: app.use(express.static(__dirname, { index: 'index.html' }));

// --- Feedback API Routes ---
// Get All Feedbacks
app.get('/api/feedbacks', async (req, res) => {
    try {
        const allFeedbacks = await Feedback.find().sort({ timestamp: -1 }); //
        res.status(200).json(allFeedbacks); //
    } catch (error) {
        console.error('Sabhi feedbacks fetch karte waqt error:', error); //
        res.status(500).json({ message: 'Feedbacks fetch nahi ho paye.', error: error.message }); //
    }
});

// Submit New Feedback (Handles both anonymous and authenticated users)
app.post('/api/feedback', authenticateTokenOptional, async (req, res) => { //
    // authenticateTokenOptional req.user set karega agar valid token mila
    const { name, feedback, rating } = req.body; // Name from form //
    const userIp = req.clientIp; //

    // Agar authenticated nahi hai aur naam bhi nahi diya, toh error
    if (!req.user && !name) { //
        return res.status(400).json({ message: 'Agar login nahi kiya hai toh naam daalna zaroori hai, bhai!' }); //
    }
    if (!feedback || !rating || rating === '0') { //
        return res.status(400).json({ message: 'Feedback aur rating toh daal de, yaar!' }); //
    }

    let feedbackData = {
        name: req.user ? req.user.name : name, // Agar JWT se user hai toh uska naam, warna form wala naam //
        feedback: feedback, //
        rating: parseInt(rating), //
        userIp: userIp, //
        isEdited: false, //
        avatarUrl: req.user ? req.user.picture : getDiceBearAvatarUrlServer(name) // JWT user ka picture, warna DiceBear //
    };

    if (req.user) {
        feedbackData.googleId = req.user.googleId; //
    }

    try {
        const newFeedback = new Feedback(feedbackData); //
        await newFeedback.save(); //
        console.log('Naya feedback database mein save hua:', newFeedback); //
        res.status(201).json({ message: 'Aapka feedback सफलतापूर्वक jama ho gaya!', feedback: newFeedback }); //
    } catch (error) {
        console.error('Feedback database mein save karte waqt error:', error); //
        res.status(500).json({ message: 'Feedback database mein save nahi ho paya.', error: error.message }); //
    }
});

// Update Existing Feedback (Strictly for authenticated Google users owning the feedback)
app.put('/api/feedback/:id', authenticateToken, async (req, res) => { //
    const feedbackId = req.params.id; //
    const { feedback, rating } = req.body; // Naam JWT se liya jayega //
    const loggedInUser = req.user; // JWT se mila user data { googleId, name, email, picture } //

    if (!feedback || !rating || rating === '0') { //
        return res.status(400).json({ message: 'Update ke liye feedback aur rating zaroori hai!' }); //
    }

    try {
        const existingFeedback = await Feedback.findById(feedbackId); //
        if (!existingFeedback) {
            return res.status(404).json({ message: 'Yeh feedback ID mila nahi, update kaise karun?' }); //
        }

        // Authorization: Sirf Google user jo feedback ka owner hai, wahi edit kar sakta hai
        if (!existingFeedback.googleId || existingFeedback.googleId !== loggedInUser.googleId) { //
            return res.status(403).json({ message: 'Aap sirf apne Google account se diye gaye feedbacks ko hi edit kar sakte hain.' }); //
        }

        const parsedRating = parseInt(rating); //
        const contentActuallyChanged = existingFeedback.feedback !== feedback || existingFeedback.rating !== parsedRating || existingFeedback.name !== loggedInUser.name; //

        if (contentActuallyChanged) {
            if (!existingFeedback.originalContent) { // Pehli baar edit ho raha hai toh original content save karo //
                existingFeedback.originalContent = { //
                    name: existingFeedback.name, //
                    feedback: existingFeedback.feedback, //
                    rating: existingFeedback.rating, //
                    timestamp: existingFeedback.timestamp //
                };
            }
            existingFeedback.name = loggedInUser.name; // Hamesha current JWT user ka naam use karo (Google profile update ho sakta hai) //
            existingFeedback.feedback = feedback; //
            existingFeedback.rating = parsedRating; //
            existingFeedback.timestamp = Date.now(); // Edit ka naya timestamp //
            existingFeedback.isEdited = true; //
        }
        // Agar sirf Google profile naam change hua hai, toh bhi update kar sakte hain upar wale block mein

        await existingFeedback.save(); //
        console.log('Feedback update hua:', existingFeedback); //
        res.status(200).json({ message: 'Aapka feedback सफलतापूर्वक update ho gaya!', feedback: existingFeedback }); //

    } catch (error) {
        console.error(`Feedback update karte waqt error (ID: ${feedbackId}):`, error); //
        res.status(500).json({ message: 'Feedback update nahi ho paya.', error: error.message }); //
    }
});

// --- Admin Panel Routes (Basic Auth for Admin) ---
const authenticateAdmin = (req, res, next) => {
    const authHeader = req.headers.authorization; //
    if (!authHeader) {
        res.set('WWW-Authenticate', 'Basic realm="Admin Area"'); //
        return res.status(401).json({ message: 'UNAUTHORIZED: AUTHORIZATION HEADER MISSING.' }); //
    }
    const [scheme, credentials] = authHeader.split(' '); //
    if (scheme !== 'Basic' || !credentials) { //
        res.set('WWW-Authenticate', 'Basic realm="Admin Area"'); //
        return res.status(401).json({ message: 'UNAUTHORIZED: INVALID AUTHORIZATION SCHEME.' }); //
    }
    const [username, password] = Buffer.from(credentials, 'base64').toString().split(':'); //
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) { //
        next();
    } else {
        res.set('WWW-Authenticate', 'Basic realm="Admin Area"'); //
        res.status(401).json({ message: 'UNAUTHORIZED: SAHI ADMIN CREDENTIALS NAHI HAIN, BHAI!' }); //
    }
};

app.get('/admin-panel-nobita', authenticateAdmin, async (req, res) => { //
    // Cache-Control headers to attempt to force re-authentication
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate'); // HTTP 1.1.
    res.setHeader('Pragma', 'no-cache'); // HTTP 1.0.
    res.setHeader('Expires', '0'); // Proxies.

    try {
        const feedbacks = await Feedback.find().sort({ timestamp: -1 }); //
        const encodedCredentials = Buffer.from(`${ADMIN_USERNAME}:${ADMIN_PASSWORD}`).toString('base64'); //
        const authHeaderValue = `Basic ${encodedCredentials}`; //
        const nobitaAvatarUrl = 'https://i.ibb.co/FsSs4SG/creator-avatar.png'; //

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
                    .feedback-card { background-color: transparent; border-radius: 15px; perspective: 1000px; min-height: 480px; } /* Increased min-height slightly */
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
                    .admin-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.75); display: none; justify-content: center; align-items: center; z-index: 2000; }
                    .admin-custom-modal { background: #222a35; padding: 30px; border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); text-align: center; color: #f0f0f0; width: 90%; max-width: 480px; border: 1px solid #445; }
                    .admin-custom-modal h3 { color: #FFD700; margin-top: 0; margin-bottom: 15px; font-size: 1.8em; }
                    .admin-custom-modal p { margin-bottom: 25px; font-size: 1.1em; line-height: 1.6; color: #ccc; word-wrap: break-word;}
                    .admin-modal-buttons button { background-color: #007bff; color: white; border: none; padding: 12px 22px; border-radius: 8px; cursor: pointer; font-size: 1em; margin: 5px; transition: background-color 0.3s, transform 0.2s; font-weight: bold; }
                    .admin-modal-buttons button:hover { transform: translateY(-2px); }
                    #adminModalOkButton:hover { background-color: #0056b3; }
                    #adminModalConfirmButton { background-color: #28a745; } #adminModalConfirmButton:hover { background-color: #1e7e34; }
                    #adminModalCancelButton { background-color: #dc3545; } #adminModalCancelButton:hover { background-color: #b02a37; }
                    @media (max-width: 768px) { h1 { font-size: 2.2em; } .feedback-grid { grid-template-columns: 1fr; } .main-panel-btn-container { justify-content: center; } }
                </style>
            </head>
            <body>
                <h1>NOBITA'S FEEDBACK COMMAND CENTER</h1>
                <div class="main-panel-btn-container"> <a href="/" class="main-panel-btn">← MAIN FEEDBACK PANEL</a> </div>
                <div class="feedback-grid">
        `; //

        if (feedbacks.length === 0) {
            html += `<p style="text-align: center; color: #7F8C8D; font-size: 1.2em; grid-column: 1 / -1;">Abhi tak koi feedback nahi aaya hai!</p>`; //
        } else {
            feedbacks.forEach(fb => { //
                const fbNameInitial = (fb.name && fb.name.length > 0) ? fb.name.charAt(0).toUpperCase() : 'X'; //
                const googleUserTag = fb.googleId ? '<span class="google-user-tag">Google User</span>' : ''; //
                html += `
                    <div class="feedback-card" id="card-${fb._id}">
                        <div class="feedback-card-inner">
                            <div class="feedback-card-front">
                                <div class="feedback-header">
                                    <div class="feedback-avatar"><img src="${fb.avatarUrl || getDiceBearAvatarUrlServer(fb.name)}" alt="${fbNameInitial}"></div>
                                    <div class="feedback-info">
                                        <h4>${fb.name} ${fb.isEdited ? '<span class="edited-admin-tag">EDITED</span>' : ''} ${googleUserTag}</h4>
                                        <div class="rating">${'★'.repeat(fb.rating)}${'☆'.repeat(5 - fb.rating)}</div>
                                        <div class="user-ip">IP: ${fb.userIp || 'N/A'} ${fb.googleId ? `| G-ID: ${fb.googleId.substring(0,10)}...`:''}</div>
                                    </div>
                                </div>
                                <div class="feedback-body"><p>${fb.feedback}</p></div>
                                <div class="feedback-date">
                                    ${fb.isEdited ? 'Last Edited' : 'Posted'}: ${new Date(fb.timestamp).toLocaleString()}
                                    ${fb.isEdited && fb.originalContent ? `<br><small>Original: ${new Date(fb.originalContent.timestamp).toLocaleString()}</small>` : ''}
                                </div>
                                <div class="action-buttons">
                                    <button class="delete-btn" onclick="tryDeleteFeedback('${fb._id}')">DELETE</button>
                                    ${!fb.googleId ? `<button class="change-avatar-btn" onclick="tryChangeAvatar('${fb._id}', '${fb.name}')">AVATAR</button>` : ''}
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
                            </div>`; //
                if (fb.isEdited && fb.originalContent) { //
                    html += `
                            <div class="feedback-card-back">
                                <div class="feedback-header">
                                    <div class="feedback-avatar"><img src="${fb.originalContent.avatarUrl || fb.avatarUrl}" alt="Original"></div>
                                    <div class="feedback-info">
                                        <h4>ORIGINAL: ${fb.originalContent.name}</h4>
                                        <div class="rating">${'★'.repeat(fb.originalContent.rating)}${'☆'.repeat(5 - fb.originalContent.rating)}</div>
                                    </div>
                                </div>
                                <div class="feedback-body"><p>${fb.originalContent.feedback}</p></div>
                                <div class="feedback-date">Originally Posted: ${new Date(fb.originalContent.timestamp).toLocaleString()}</div>
                                <div style="margin-top: auto;"> <button class="flip-btn" onclick="flipCard('${fb._id}')">VIEW EDITED</button> </div>
                            </div>`; //
                }
                html += `</div></div>`; //
            });
        }
        html += `</div> <div id="adminModalOverlay" class="admin-modal-overlay"> <div class="admin-custom-modal"> <h3 id="adminModalTitle"></h3> <p id="adminModalMessage"></p> <div class="admin-modal-buttons"> <button id="adminModalOkButton">OK</button> <button id="adminModalConfirmButton" style="display:none;">Confirm</button> <button id="adminModalCancelButton" style="display:none;">Cancel</button> </div> </div> </div>
                <script>
                    // Admin Panel JavaScript (pehle jaisa hi, AUTH_HEADER use karega)
                    const AUTH_HEADER = '${authHeaderValue}';
                    const adminModalOverlay = document.getElementById('adminModalOverlay');
                    const adminModalTitle = document.getElementById('adminModalTitle');
                    const adminModalMessage = document.getElementById('adminModalMessage');
                    const adminModalOkButton = document.getElementById('adminModalOkButton');
                    const adminModalConfirmButton = document.getElementById('adminModalConfirmButton');
                    const adminModalCancelButton = document.getElementById('adminModalCancelButton');
                    let globalConfirmCallback = null;

                    function showAdminModal(type, title, message, confirmCallbackFn = null) { /* ... (same as before) ... */ 
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
                    async function tryDeleteFeedback(id) { /* ... (same as before) ... */ 
                        showAdminModal('confirm', 'Delete Feedback?', 'Are you sure you want to delete this feedback? This cannot be undone.', async (confirmed) => {
                            if(confirmed) {
                                const res = await fetch(\`/api/admin/feedback/\${id}\`, { method: 'DELETE', headers: { 'Authorization': AUTH_HEADER }});
                                if(res.ok) { showAdminModal('alert', 'Deleted!', 'Feedback deleted successfully.'); setTimeout(()=>location.reload(),1000); }
                                else { const err = await res.json(); showAdminModal('alert', 'Error!', \`Failed to delete: \${err.message}\`);}
                            }
                        });
                    }
                    async function tryPostReply(fbId, txtId) { /* ... (same as before) ... */ 
                        const replyText = document.getElementById(txtId).value.trim(); if(!replyText) {showAdminModal('alert', 'Empty Reply', 'Please write something to reply.'); return;}
                        showAdminModal('confirm', 'Post Reply?', \`Confirm reply: "\${replyText.substring(0,50)}..."\`, async (confirmed) => {
                            if(confirmed) {
                                const res = await fetch(\`/api/admin/feedback/\${fbId}/reply\`, {method:'POST',headers:{'Content-Type':'application/json', 'Authorization':AUTH_HEADER}, body:JSON.stringify({replyText, adminName:'👉𝙉𝙊𝘽𝙄𝙏𝘼🤟'})});
                                if(res.ok) { showAdminModal('alert', 'Replied!', 'Reply posted.'); setTimeout(()=>location.reload(),1000); }
                                else { const err = await res.json(); showAdminModal('alert', 'Error!', \`Failed to reply: \${err.message}\`);}
                            }
                        });
                    }
                    async function tryChangeAvatar(fbId, uName) { /* ... (same as before) ... */
                         showAdminModal('confirm', 'Change Avatar?', \`Change avatar for \${uName}? This will regenerate avatar for all non-Google feedbacks by this user.\`, async (confirmed) => {
                            if(confirmed) {
                                const res = await fetch(\`/api/admin/feedback/\${fbId}/change-avatar\`, {method:'PUT',headers:{'Content-Type':'application/json', 'Authorization':AUTH_HEADER}});
                                if(res.ok) { showAdminModal('alert', 'Avatar Changed!', 'Avatar updated.'); setTimeout(()=>location.reload(),1000); }
                                else { const err = await res.json(); showAdminModal('alert', 'Error!', \`Failed to change avatar: \${err.message}\`);}
                            }
                        });
                    }
                </script>
            </body></html>
        `; //
        res.send(html); //
    } catch (error) {
        console.error('Admin panel generate karte waqt error:', error); //
        res.status(500).send(`Admin panel mein kuch gadbad hai! Error: ${error.message}`); //
    }
});

// Admin API: Delete Feedback
app.delete('/api/admin/feedback/:id', authenticateAdmin, async (req, res) => { //
    try {
        const deletedFeedback = await Feedback.findByIdAndDelete(req.params.id); //
        if (!deletedFeedback) return res.status(404).json({ message: 'Feedback ID mila nahi.' }); //
        res.status(200).json({ message: 'Feedback सफलतापूर्वक delete ho gaya.' }); //
    } catch (error) {
        res.status(500).json({ message: 'Feedback delete nahi ho paya.', error: error.message }); //
    }
});

// Admin API: Post Reply to Feedback
app.post('/api/admin/feedback/:id/reply', authenticateAdmin, async (req, res) => { //
    const { replyText, adminName } = req.body; //
    if (!replyText) return res.status(400).json({ message: 'Reply text toh daalo.' }); //
    try {
        const feedback = await Feedback.findById(req.params.id); //
        if (!feedback) return res.status(404).json({ message: 'Feedback ID mila nahi.' }); //
        feedback.replies.push({ text: replyText, adminName: adminName || 'Admin', timestamp: new Date() }); //
        await feedback.save(); //
        res.status(200).json({ message: 'Reply सफलतापूर्वक post ho gaya.', reply: feedback.replies[feedback.replies.length - 1] }); //
    } catch (error) {
        res.status(500).json({ message: 'Reply save nahi ho paya.', error: error.message }); //
    }
});

// Admin API: Change Avatar for non-Google user feedbacks
app.put('/api/admin/feedback/:id/change-avatar', authenticateAdmin, async (req, res) => { //
    try {
        const feedbackToUpdate = await Feedback.findById(req.params.id); //
        if (!feedbackToUpdate) return res.status(404).json({ message: 'Feedback ID mila nahi.' }); //
        if (feedbackToUpdate.googleId) return res.status(400).json({ message: 'Google user ka avatar yahaan se change nahi kar sakte.' }); //

        const userName = feedbackToUpdate.name; //
        if (!userName) return res.status(400).json({ message: 'User ka naam nahi hai avatar generate karne ke liye.' }); //

        const newAvatarUrl = getDiceBearAvatarUrlServer(userName, Date.now().toString()); //
        await Feedback.updateMany({ name: userName, googleId: null }, { $set: { avatarUrl: newAvatarUrl } }); // Sirf non-Google feedbacks ka avatar update karo //
        res.status(200).json({ message: 'Avatar सफलतापूर्वक change ho gaya!', newAvatarUrl }); //
    } catch (error) {
        res.status(500).json({ message: 'Avatar change nahi ho paya.', error: error.message }); //
    }
});

// Server Start
app.listen(PORT, () => {
    console.log(`Nobita ka server port ${PORT} par chalu ho gaya hai: http://localhost:${PORT}`); //
    console.log('Ab frontend se API call kar sakte ho!'); //
});
