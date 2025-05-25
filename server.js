// server.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ****** MongoDB Connection String ******
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://dontchange365:DtUiOMFzQVM0tG9l@nobifeedback.9ntuipc.mongodb.net/?retryWrites=true&w=majority&appName=nobifeedback';

// ****** Admin Credentials (SECURITY ALERT! USE ENVIRONMENT VARIABLES IN PRODUCTION) ******
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'samshaad365';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'shizuka123';

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => console.log('MONGODB SE CONNECTION SAFAL! DATABASE AB READY HAI!'))
  .catch(err => console.error('MONGODB CONNECTION MEIN LOHDA LAG GAYA:', err));

// Function to generate DiceBear Avatar URL (server side)
// Added a more dynamic seed for better avatar variety on change
function getDiceBearAvatarUrlServer(name, randomSeed = '') {
    const seed = encodeURIComponent(name.toLowerCase() + randomSeed);
    return `https://api.dicebear.com/8.x/adventurer/svg?seed=${seed}&flip=true&radius=50&scale=90`;
}

// Define a Schema for Feedback
const feedbackSchema = new mongoose.Schema({
  name: { type: String, required: true },
  feedback: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  timestamp: { type: Date, default: Date.now },
  avatarUrl: { type: String },
  originalFeedback: { type: String }, // To store original feedback if edited
  isEdited: { type: Boolean, default: false }, // Flag for edited feedback
  replies: [
    {
      text: { type: String, required: true },
      timestamp: { type: Date, default: Date.now },
      adminName: { type: String, default: 'Admin' }
    }
  ]
});

// Create a Model from the Schema
const Feedback = mongoose.model('Feedback', feedbackSchema);

// Middleware
app.use(cors({
    origin: ['https://nobita-feedback-app-online.onrender.com', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'DELETE', 'PUT'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Middleware for Admin Authentication
const authenticateAdmin = (req, res, next) => {
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

// STATIC FILES AUR INDEX.HTML KO SERVE KARNE WALI LINE
app.use(express.static(path.join(__dirname, 'public'), { index: 'index.html' }));


// API Endpoint to get all feedbacks (Fetch from DB)
app.get('/api/feedbacks', async (req, res) => {
    try {
        const allFeedbacks = await Feedback.find().sort({ timestamp: -1 });
        res.status(200).json(allFeedbacks);
    } catch (error) {
        console.error('FEEDBACK FETCH KARTE WAQT ERROR AAYA:', error);
        res.status(500).json({ message: 'FEEDBACK FETCH NAHI HO PAYE.', error: error.message });
    }
});

// API Endpoint to submit new feedback (Save to DB)
app.post('/api/feedback', async (req, res) => {
    const { name, feedback, rating } = req.body;
    if (!name || !feedback || rating === '0') {
        return res.status(400).json({ message: 'NAAM, FEEDBACK, AUR RATING SAB CHAHIYE, BHAI!' });
    }

    try {
        let avatarUrlToSave;

        // Check if an avatar already exists for this name (case-insensitive)
        const existingFeedback = await Feedback.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
        if (existingFeedback && existingFeedback.avatarUrl) {
            avatarUrlToSave = existingFeedback.avatarUrl;
        } else {
            avatarUrlToSave = getDiceBearAvatarUrlServer(name); // Generate new if not found
        }

        const newFeedback = new Feedback({
            name: name, // Save as provided, display as capitalized in frontend
            feedback: feedback,
            rating: parseInt(rating),
            avatarUrl: avatarUrlToSave,
            isEdited: false // New feedbacks are not edited
        });

        await newFeedback.save();

        console.log('NAYA FEEDBACK DATABASE MEIN SAVE HUA HAI:', newFeedback);
        res.status(201).json({ message: 'FEEDBACK SAFALTA-POORVAK JAMA KIYA GAYA AUR SAVE HUA!', feedback: newFeedback });
    } catch (error) {
        console.error('FEEDBACK DATABASE MEIN SAVE KARTE WAQT ERROR AAYA:', error);
        res.status(500).json({ message: 'FEEDBACK DATABASE MEIN SAVE NAHI HO PAYA.', error: error.message });
    }
});

// New API Endpoint: Edit Feedback (frontend se call hoga)
app.put('/api/feedback/:id', async (req, res) => {
    const { id } = req.params;
    const { name, feedback, rating } = req.body;

    if (!name || !feedback || rating === '0') {
        return res.status(400).json({ message: 'NAAM, FEEDBACK, AUR RATING SAB CHAHIYE, BHAI!' });
    }

    try {
        const existingFeedback = await Feedback.findById(id);
        if (!existingFeedback) {
            return res.status(404).json({ message: 'FEEDBACK NAHI MILA, BHAI. EDIT KISKO KARUN?' });
        }

        // Store original feedback if not already edited
        if (!existingFeedback.isEdited) {
            existingFeedback.originalFeedback = existingFeedback.feedback;
        }

        existingFeedback.name = name;
        existingFeedback.feedback = feedback;
        existingFeedback.rating = parseInt(rating);
        existingFeedback.isEdited = true; // Mark as edited

        await existingFeedback.save();

        res.status(200).json({ message: 'FEEDBACK SAFALTA-POORVAK UPDATE HUA!', feedback: existingFeedback });
    } catch (error) {
        console.error('FEEDBACK UPDATE KARTE WAQT ERROR AAYA:', error);
        res.status(500).json({ message: 'FEEDBACK UPDATE NAHI HO PAYA.', error: error.message });
    }
});


// ADMIN PANEL KA ROUTE - ***** YAHAN POORA BADLAV KIYA HAI DESIGN KE LIYE! *****
app.get('/admin-panel-nobita', authenticateAdmin, async (req, res) => {
    try {
        const feedbacks = await Feedback.find().sort({ timestamp: -1 });
        const encodedCredentials = Buffer.from(`${ADMIN_USERNAME}:${ADMIN_PASSWORD}`).toString('base64');
        const authHeaderValue = `Basic ${encodedCredentials}`;
        
        // Define Nobita's avatar URL for admin panel (same as owner avatar)
        const nobitaAvatarUrl = 'https://i.ibb.co/FsSs4SG/creator-avatar.png';

        let html = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>ADMIN PANEL: NOBITA'S COMMAND CENTER</title>
                <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap" rel="stylesheet">
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
                <style>
                    body {
                        font-family: 'Roboto', sans-serif;
                        background: linear-gradient(135deg, #1A1A2E, #16213E);
                        color: #E0E0E0;
                        margin: 0;
                        padding: 30px 20px;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        min-height: 100vh;
                    }
                    h1 {
                        color: #FFD700; /* Gold */
                        text-align: center;
                        margin-bottom: 40px;
                        font-size: 2.8em;
                        text-shadow: 0 0 15px rgba(255,215,0,0.5);
                    }
                    .main-panel-btn-container {
                        width: 100%;
                        max-width: 1200px;
                        display: flex;
                        justify-content: flex-start; /* Align button to the left */
                        margin-bottom: 20px;
                        padding: 0 10px; /* Add some padding if grid has padding */
                    }
                    .main-panel-btn {
                        background-color: #007bff; /* Blue */
                        color: white;
                        padding: 10px 20px;
                        border: none;
                        border-radius: 8px;
                        font-size: 1em;
                        font-weight: bold;
                        cursor: pointer;
                        transition: background-color 0.3s ease, transform 0.2s;
                        text-decoration: none; /* For anchor tag */
                        display: inline-block; /* For anchor tag */
                        text-transform: uppercase;
                    }
                    .main-panel-btn:hover {
                        background-color: #0056b3;
                        transform: translateY(-2px);
                    }
                    .feedback-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
                        gap: 30px;
                        width: 100%;
                        max-width: 1200px;
                    }
                    .feedback-card {
                        background-color: #2C3E50; /* Darker Blue-Grey */
                        border-radius: 15px;
                        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.4);
                        padding: 25px;
                        display: flex;
                        flex-direction: column;
                        justify-content: space-between;
                        border: 1px solid #34495E;
                        transition: transform 0.3s ease, box-shadow 0.3s ease;
                        position: relative; /* For flip card */
                        perspective: 1000px; /* For 3D flip */
                    }
                    .feedback-card:hover {
                        transform: translateY(-5px);
                        box-shadow: 0 12px 30px rgba(0, 0, 0, 0.6);
                    }

                    /* Flip Card Styles */
                    .flip-card-inner {
                        position: relative;
                        width: 100%;
                        height: 100%;
                        text-align: center;
                        transition: transform 0.6s;
                        transform-style: preserve-3d;
                        display: flex;
                        flex-direction: column;
                    }
                    .feedback-card.flipped .flip-card-inner {
                        transform: rotateY(180deg);
                    }
                    .flip-card-front, .flip-card-back {
                        position: absolute;
                        width: 100%;
                        height: 100%;
                        -webkit-backface-visibility: hidden; /* Safari */
                        backface-visibility: hidden;
                        display: flex;
                        flex-direction: column;
                        justify-content: space-between;
                        padding: 25px; /* Adjust padding here to match parent */
                        box-sizing: border-box; /* Include padding in dimensions */
                    }
                    .flip-card-front {
                        background-color: #2C3E50; /* Same as feedback-card */
                        border-radius: 15px;
                        z-index: 2;
                    }
                    .flip-card-back {
                        background-color: #1A2A3A; /* Slightly different for back */
                        border-radius: 15px;
                        transform: rotateY(180deg);
                        color: #E0E0E0;
                        text-align: left;
                        padding: 25px;
                    }
                    .flip-card-back p {
                        margin-top: 15px;
                        font-size: 1em;
                        color: #BDC3C7;
                        line-height: 1.6;
                        border-top: 1px dashed #34495E;
                        padding-top: 15px;
                    }
                    .flip-card-back .original-text-label {
                        color: #85C1E9;
                        font-weight: bold;
                        margin-bottom: 5px;
                        font-size: 0.9em;
                    }

                    .feedback-header {
                        display: flex;
                        align-items: center;
                        gap: 15px;
                        margin-bottom: 15px;
                    }
                    .feedback-avatar {
                        width: 60px;
                        height: 60px;
                        border-radius: 50%;
                        overflow: hidden;
                        border: 3px solid #FFD700;
                        flex-shrink: 0;
                        box-shadow: 0 0 10px rgba(255,215,0,0.3);
                    }
                    .feedback-avatar img {
                        width: 100%;
                        height: 100%;
                        object-fit: cover;
                    }
                    .feedback-info h4 {
                        margin: 0;
                        font-size: 1.4em;
                        color: #FFD700;
                        text-transform: uppercase;
                    }
                    .feedback-info .rating {
                        font-size: 1.1em;
                        color: #F39C12; /* Orange */
                        margin-top: 5px;
                    }
                    .feedback-body p {
                        font-size: 1em;
                        color: #BDC3C7; /* Light Grey */
                        line-height: 1.6;
                        margin-bottom: 15px;
                    }
                    .feedback-date {
                        font-size: 0.8em;
                        color: #7F8C8D; /* Muted Grey */
                        text-align: right;
                        margin-bottom: 20px;
                        border-top: 1px solid #34495E;
                        padding-top: 10px;
                    }
                    .action-buttons {
                        display: flex;
                        gap: 10px;
                        margin-bottom: 20px;
                    }
                    .action-buttons button {
                        flex-grow: 1;
                        padding: 12px 15px;
                        border: none;
                        border-radius: 8px;
                        font-size: 1em;
                        font-weight: bold;
                        cursor: pointer;
                        transition: background-color 0.3s ease, transform 0.2s;
                        text-transform: uppercase;
                    }
                    .action-buttons button:hover {
                        transform: translateY(-2px);
                    }
                    .delete-btn { background-color: #E74C3C; color: white; } /* Red */
                    .delete-btn:hover { background-color: #C0392B; }
                    .change-avatar-btn { background-color: #3498DB; color: white; } /* Blue */
                    .change-avatar-btn:hover { background-color: #2980B9; }
                    .flip-btn {
                        background-color: #9B59B6; /* Purple for flip */
                        color: white;
                    }
                    .flip-btn:hover { background-color: #8E44AD; }

                    /* Edited Tag */
                    .edited-tag {
                        position: absolute;
                        top: 10px;
                        left: 10px;
                        background-color: #F1C40F; /* Yellow */
                        color: #2C3E50;
                        padding: 5px 10px;
                        border-radius: 5px;
                        font-size: 0.8em;
                        font-weight: bold;
                        z-index: 10;
                    }

                    /* Reply Section */
                    .reply-section {
                        border-top: 1px solid #34495E;
                        padding-top: 20px;
                    }
                    .reply-section textarea {
                        width: calc(100% - 20px);
                        padding: 10px;
                        border: 1px solid #4A6070;
                        border-radius: 8px;
                        background-color: #34495E;
                        color: #ECF0F1;
                        resize: vertical;
                        min-height: 60px;
                        margin-bottom: 10px;
                        font-size: 0.95em;
                    }
                    .reply-section textarea::placeholder {
                        color: #A9B7C0;
                    }
                    .reply-btn {
                        background-color: #27AE60; /* Green */
                        color: white;
                        width: 100%;
                        padding: 12px;
                        border: none;
                        border-radius: 8px;
                        font-weight: bold;
                        cursor: pointer;
                        transition: background-color 0.3s ease, transform 0.2s;
                        text-transform: uppercase;
                    }
                    .reply-btn:hover { background-color: #229954; transform: translateY(-2px); }

                    .replies-display {
                        margin-top: 20px;
                        background-color: #213042; /* Even darker blue */
                        border-radius: 10px;
                        padding: 15px;
                        border: 1px solid #2C3E50;
                    }
                    .replies-display h4 {
                        color: #85C1E9; /* Light blue */
                        font-size: 1.1em;
                        margin-bottom: 10px;
                        border-bottom: 1px solid #34495E;
                        padding-bottom: 8px;
                    }
                    .single-reply {
                        border-bottom: 1px solid #2C3E50;
                        padding-bottom: 10px;
                        margin-bottom: 10px;
                        font-size: 0.9em;
                        color: #D5DBDB;
                        display: flex; /* For avatar and text */
                        align-items: flex-start;
                        gap: 10px;
                    }
                    .single-reply:last-child {
                        border-bottom: none;
                        margin-bottom: 0;
                    }
                    .admin-reply-avatar-sm { /* Small avatar for replies */
                        width: 30px;
                        height: 30px;
                        border-radius: 50%;
                        border: 2px solid #9B59B6; /* Purple border */
                        flex-shrink: 0;
                        object-fit: cover;
                        box-shadow: 0 0 5px rgba(155, 89, 182, 0.5);
                    }
                    .reply-content-wrapper { /* Wrapper for reply text and timestamp */
                        flex-grow: 1;
                    }
                    .reply-admin-name {
                        font-weight: bold;
                        color: #9B59B6; /* Purple */
                        display: inline; /* Keep on same line as text */
                        margin-right: 5px;
                    }
                    .reply-timestamp {
                        font-size: 0.75em;
                        color: #8E9A9D;
                        margin-left: 10px;
                    }

                    /* Custom Popup Alert */
                    .custom-alert-overlay {
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background: rgba(0, 0, 0, 0.7);
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        z-index: 1000;
                        opacity: 0;
                        visibility: hidden;
                        transition: opacity 0.3s ease, visibility 0.3s ease;
                    }
                    .custom-alert-overlay.show {
                        opacity: 1;
                        visibility: visible;
                    }
                    .custom-alert-box {
                        background: linear-gradient(135deg, #1A1A2E, #16213E);
                        border: 2px solid #FFD700;
                        border-radius: 15px;
                        padding: 30px;
                        text-align: center;
                        box-shadow: 0 0 20px rgba(255,215,0,0.5), 0 0 40px rgba(0,0,0,0.8);
                        max-width: 400px;
                        width: 90%;
                        transform: scale(0.8);
                        opacity: 0;
                        transition: transform 0.3s ease, opacity 0.3s ease;
                    }
                    .custom-alert-overlay.show .custom-alert-box {
                        transform: scale(1);
                        opacity: 1;
                    }
                    .custom-alert-box h3 {
                        color: #FFD700;
                        margin-bottom: 20px;
                        font-size: 1.8em;
                        text-shadow: 0 0 10px rgba(255,215,0,0.5);
                    }
                    .custom-alert-box p {
                        color: #E0E0E0;
                        font-size: 1.1em;
                        margin-bottom: 25px;
                    }
                    .custom-alert-box button {
                        background-color: #007bff;
                        color: white;
                        padding: 12px 25px;
                        border: none;
                        border-radius: 8px;
                        font-size: 1em;
                        font-weight: bold;
                        cursor: pointer;
                        transition: background-color 0.3s ease, transform 0.2s;
                    }
                    .custom-alert-box button:hover {
                        background-color: #0056b3;
                        transform: translateY(-2px);
                    }
                    .custom-alert-icon {
                        font-size: 3em;
                        color: #27AE60; /* Green for success */
                        margin-bottom: 15px;
                        animation: bounceIn 0.6s ease-out;
                    }
                    .custom-alert-icon.error {
                        color: #E74C3C; /* Red for error */
                    }
                    @keyframes bounceIn {
                        0% { transform: scale(0.5); opacity: 0; }
                        70% { transform: scale(1.1); opacity: 1; }
                        100% { transform: scale(1); }
                    }


                    @media (max-width: 768px) {
                        h1 { font-size: 2.2em; margin-bottom: 30px; }
                        .feedback-grid { grid-template-columns: 1fr; }
                        .feedback-card { padding: 20px; }
                        .action-buttons { flex-direction: column; }
                        .main-panel-btn-container { justify-content: center; } /* Center button on smaller screens */
                    }
                </style>
            </head>
            <body>
                <h1>NOBITA'S FEEDBACK COMMAND CENTER</h1>
                <div class="main-panel-btn-container">
                    <a href="/" class="main-panel-btn">← GO TO MAIN FEEDBACK PANEL</a>
                </div>
                <div class="feedback-grid">
        `;

        if (feedbacks.length === 0) {
            html += `<p class="no-feedback" style="text-align: center; color: #7F8C8D; font-size: 1.2em; grid-column: 1 / -1;">ABHI TAK KISI NE GANDI BAAT NAHI KI HAI, BHAI!</p>`;
        } else {
            feedbacks.forEach(fb => {
                html += `
                    <div class="feedback-card" id="feedback-card-${fb._id}">
                        <div class="flip-card-inner">
                            <div class="flip-card-front">
                                ${fb.isEdited ? '<span class="edited-tag">EDITED</span>' : ''}
                                <div class="feedback-header">
                                    <div class="feedback-avatar">
                                        <img src="${fb.avatarUrl}" alt="${fb.name.charAt(0).toUpperCase()}">
                                    </div>
                                    <div class="feedback-info">
                                        <h4>${fb.name}</h4>
                                        <div class="rating">${'★'.repeat(fb.rating)}${'☆'.repeat(5 - fb.rating)}</div>
                                    </div>
                                </div>
                                <div class="feedback-body">
                                    <p>${fb.feedback}</p>
                                </div>
                                <div class="feedback-date">
                                    ${new Date(fb.timestamp).toLocaleString()}
                                </div>
                                <div class="action-buttons">
                                    <button class="delete-btn" onclick="showCustomAlert('confirm_delete', '${fb._id}')">UDHA DE!</button>
                                    <button class="change-avatar-btn" onclick="changeAvatar('${fb._id}', '${fb.name}')">AVATAR BADAL!</button>
                                    ${fb.isEdited ? `<button class="flip-btn" onclick="toggleFlip('${fb._id}')">SEE ORIGINAL</button>` : ''}
                                </div>
                                
                                <div class="reply-section">
                                    <textarea id="reply-text-${fb._id}" placeholder="REPLY LIKH YAHAN..."></textarea>
                                    <button class="reply-btn" onclick="postReply('${fb._id}', 'reply-text-${fb._id}')">REPLY FEK!</button>
                                    <div class="replies-display">
                                        ${fb.replies && fb.replies.length > 0 ? '<h4>REPLIES:</h4>' : ''}
                                        ${fb.replies && fb.replies.map(reply => `
                                            <div class="single-reply">
                                                <img src="${nobitaAvatarUrl}" alt="Nobita Admin" class="admin-reply-avatar-sm">
                                                <div class="reply-content-wrapper">
                                                    <span class="reply-admin-name">${reply.adminName}:</span> ${reply.text}
                                                    <span class="reply-timestamp">(${new Date(reply.timestamp).toLocaleString()})</span>
                                                </div>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            </div>
                            ${fb.isEdited && fb.originalFeedback ? `
                                <div class="flip-card-back">
                                    <span class="edited-tag" style="background-color: #85C1E9; color: #16213E;">ORIGINAL</span>
                                    <div class="feedback-header">
                                        <div class="feedback-avatar">
                                            <img src="${fb.avatarUrl}" alt="${fb.name.charAt(0).toUpperCase()}">
                                        </div>
                                        <div class="feedback-info">
                                            <h4>${fb.name} (Original)</h4>
                                            <div class="rating">${'★'.repeat(fb.rating)}${'☆'.repeat(5 - fb.rating)}</div>
                                        </div>
                                    </div>
                                    <div class="feedback-body">
                                        <p class="original-text-label">ORIGINAL FEEDBACK WAS:</p>
                                        <p>${fb.originalFeedback}</p>
                                    </div>
                                    <div class="feedback-date">
                                        ${new Date(fb.timestamp).toLocaleString()}
                                    </div>
                                    <div class="action-buttons">
                                        <button class="flip-btn" onclick="toggleFlip('${fb._id}')">GO BACK</button>
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `;
            });
        }

        html += `
                </div>

                <div class="custom-alert-overlay" id="customAlertOverlay">
                    <div class="custom-alert-box">
                        <i class="fas custom-alert-icon" id="customAlertIcon"></i>
                        <h3 id="customAlertTitle"></h3>
                        <p id="customAlertMessage"></p>
                        <button id="customAlertConfirmBtn" style="display:none;">YES, DO IT!</button>
                        <button id="customAlertCloseBtn">OK</button>
                    </div>
                </div>

                <script>
                    const AUTH_HEADER = '${authHeaderValue}'; // ADMIN CREDENTIALS (PRODUCTION KE LIYE SAFE NAHI HAI)

                    function showCustomAlert(type, message, callback = null, feedbackId = null) {
                        const overlay = document.getElementById('customAlertOverlay');
                        const icon = document.getElementById('customAlertIcon');
                        const title = document.getElementById('customAlertTitle');
                        const msg = document.getElementById('customAlertMessage');
                        const closeBtn = document.getElementById('customAlertCloseBtn');
                        const confirmBtn = document.getElementById('customAlertConfirmBtn');

                        overlay.classList.add('show');
                        confirmBtn.style.display = 'none'; // Hide by default

                        if (type === 'success') {
                            icon.className = 'fas fa-check-circle custom-alert-icon';
                            title.textContent = 'SAFALTA MILI!';
                            msg.textContent = message;
                        } else if (type === 'error') {
                            icon.className = 'fas fa-times-circle custom-alert-icon error';
                            title.textContent = 'GADBAD HO GAYI!';
                            msg.textContent = message;
                        } else if (type === 'confirm_delete') {
                            icon.className = 'fas fa-exclamation-triangle custom-alert-icon error'; // Warning icon
                            title.textContent = 'PAKKA UDHA DENA HAI?';
                            msg.textContent = 'FIR WAPAS NAHI AAYEGA! SOCH LE!';
                            confirmBtn.style.display = 'inline-block'; // Show confirm button
                            confirmBtn.onclick = () => {
                                hideCustomAlert(); // Hide alert first
                                deleteFeedback(message); // Call delete function with feedbackId
                            };
                            closeBtn.textContent = 'NAHI, REHNE DE';
                        }
                        
                        closeBtn.onclick = () => hideCustomAlert();
                    }

                    function hideCustomAlert() {
                        document.getElementById('customAlertOverlay').classList.remove('show');
                        document.getElementById('customAlertCloseBtn').textContent = 'OK'; // Reset button text
                    }


                    async function deleteFeedback(id) {
                        try {
                            const baseUrl = window.location.origin;
                            const response = await fetch(\`\${baseUrl}/api/admin/feedback/\${id}\`, {
                                method: 'DELETE',
                                headers: {
                                    'Authorization': AUTH_HEADER
                                }
                            });
                            if (response.ok) {
                                showCustomAlert('success', 'FEEDBACK SAFALTA-POORVAK UDHA DIYA GAYA!');
                                setTimeout(() => window.location.reload(), 1500); // Reload after brief delay
                            } else {
                                const errorData = await response.json();
                                showCustomAlert('error', \`UDHANE MEIN PHADDA HUA: \${errorData.message || 'KOI ANJAAN ERROR!'}\`);
                            }
                        } catch (error) {
                            showCustomAlert('error', \`NETWORK KI LAGG GAYI: \${error.message}\`);
                        }
                    }

                    async function postReply(feedbackId, textareaId) {
                        const replyTextarea = document.getElementById(textareaId);
                        const replyText = replyTextarea.value.trim();

                        if (!replyText) {
                            showCustomAlert('error', 'REPLY KUCH LIKH TOH DE, BHAI!');
                            return;
                        }

                        try {
                            const baseUrl = window.location.origin;
                            const response = await fetch(\`\${baseUrl}/api/admin/feedback/\${feedbackId}/reply\`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': AUTH_HEADER
                                },
                                body: JSON.stringify({ replyText: replyText, adminName: '👉𝙉𝙊𝘽𝙄𝙏𝘼🤟' })
                            });

                            if (response.ok) {
                                showCustomAlert('success', 'REPLY SAFALTA-POORVAK POST HUA!');
                                setTimeout(() => window.location.reload(), 1500);
                            } else {
                                const errorData = await response.json();
                                showCustomAlert('error', \`REPLY POST KARNE MEIN PHADDA HUA: \${errorData.message || 'KOI ANJAAN ERROR!'}\`);
                            }
                        } catch (error) {
                            showCustomAlert('error', \`NETWORK KI LAGG GAYI REPLY POST KARNE MEIN: \${error.message}\`);
                        }
                    }

                    async function changeAvatar(feedbackId, userName) {
                        if (confirm(\`PAKKA \${userName} KA AVATAR BADALNA HAI? SARE \${userName} KE FEEDBACK MEIN BADAL JAYEGA!\`)) {
                            try {
                                const baseUrl = window.location.origin;
                                const response = await fetch(\`\${baseUrl}/api/admin/feedback/\${feedbackId}/change-avatar\`, {
                                    method: 'PUT',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': AUTH_HEADER
                                    }
                                });

                                if (response.ok) {
                                    showCustomAlert('success', 'AVATAR SAFALTA-POORVAK BADLA GAYA! NAYA IMAGE AB DIKHEGA!');
                                    setTimeout(() => window.location.reload(), 1500);
                                } else {
                                    const errorData = await response.json();
                                    showCustomAlert('error', \`AVATAR BADALNE MEIN PHADDA HUA: \${errorData.message || 'KOI ANJAAN ERROR!'}\`);
                                }
                            } catch (error) {
                                showCustomAlert('error', \`NETWORK KI LAGG GAYI AVATAR BADALNE MEIN: \${error.message}\`);
                            }
                        }
                    }

                    function toggleFlip(feedbackId) {
                        const card = document.getElementById(\`feedback-card-\${feedbackId}\`);
                        card.classList.toggle('flipped');
                    }
                </script>
            </body>
            </html>
        `;
        res.send(html);
    } catch (error) {
        console.error('ERROR GENERATING ADMIN PANEL:', error);
        res.status(500).send(`SAALA! ADMIN PANEL KI FATTI HAI! ERROR: ${error.message}`);
    }
});

// ADMIN DELETE API ENDPOINT
app.delete('/api/admin/feedback/:id', authenticateAdmin, async (req, res) => {
    const feedbackId = req.params.id;
    try {
        const deletedFeedback = await Feedback.findByIdAndDelete(feedbackId);
        if (!deletedFeedback) {
            return res.status(404).json({ message: 'FEEDBACK NAHI MILA, BHAI. DELETE KISKO KARUN?' });
        }
        console.log('FEEDBACK DELETE KIYA GAYA:', deletedFeedback);
        res.status(200).json({ message: 'FEEDBACK SAFALTA-POORVAK DELETE HUA!', deletedFeedback });
    } catch (error) {
        console.error('FEEDBACK DELETE KARTE WAQT ERROR AAYA:', error);
        res.status(500).json({ message: 'FEEDBACK DELETE NAHI HO PAYA.', error: error.message });
    }
});

// ADMIN REPLY KARNE KA API ENDPOINT
app.post('/api/admin/feedback/:id/reply', authenticateAdmin, async (req, res) => {
    const { id } = req.params;
    const { replyText, adminName } = req.body;

    if (!replyText) {
        return res.status(400).json({ message: 'REPLY TEXT BHEJ, BHAI! KUCH LIKHEGA YA NAHI?' });
    }

    try {
        const feedback = await Feedback.findById(id);
        if (!feedback) {
            return res.status(404).json({ message: 'FEEDBACK MILA NAHI BHAI, REPLY KAISE KARUN? GADBAD HAI!' });
        }

        feedback.replies.push({ text: replyText, adminName: adminName || 'Admin', timestamp: new Date() });
        await feedback.save();

        res.status(200).json({ message: 'REPLY SAFALTA-POORVAK JAMA HUA!', reply: feedback.replies[feedback.replies.length - 1] });
    } catch (error) {
        console.error('REPLY SAVE KARTE WAQT FATTI HAI:', error);
        res.status(500).json({ message: 'REPLY SAVE NAHI HO PAYA. SERVER KI GANDI HAALAT HAI!', error: error.message });
    }
});

// NAYA API ENDPOINT: AVATAR BADALNE KE LIYE!
app.put('/api/admin/feedback/:id/change-avatar', authenticateAdmin, async (req, res) => {
    const { id } = req.params;

    try {
        const feedbackToUpdate = await Feedback.findById(id);
        if (!feedbackToUpdate) {
            return res.status(404).json({ message: 'FEEDBACK MILA NAHI BHAI, AVATAR KAISE BADLU?' });
        }

        const userName = feedbackToUpdate.name;
        // Generate a new random seed using current timestamp for unique avatar each time
        const newAvatarUrl = getDiceBearAvatarUrlServer(userName, Date.now().toString());

        // Update all feedbacks with the same name to ensure consistent avatar
        await Feedback.updateMany({ name: userName }, { $set: { avatarUrl: newAvatarUrl } });

        res.status(200).json({ message: 'AVATAR SAFALTA-POORVAK BADLA GAYA!', newAvatarUrl: newAvatarUrl });
    } catch (error) {
        console.error('AVATAR BADALTE WAQT FATTI HAI:', error);
        res.status(500).json({ message: 'AVATAR BADAL NAHI PAYA. SERVER KI GANDI HAALAT HAI!', error: error.message });
    }
});


// Start the server
app.listen(PORT, () => {
    console.log(`SERVER CHALU HO GAYA HAI PORT ${PORT} PAR: http://localhost:${PORT}`);
    console.log('AB FRONTEND SE API CALL KAR SAKTE HAIN!');
});
