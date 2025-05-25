// server.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const http = require('http'); // HTTP MODULE ADD KAR
const { Server } = require("socket.io"); // SOCKET.IO SERVER IMPORT KAR

dotenv.config();

const app = express();
const server = http.createServer(app); // EXPRESS APP SE HTTP SERVER BANA
const io = new Server(server, { // SOCKET.IO KO HTTP SERVER SE ATTACH KAR
  cors: {
    origin: ['https://nobita-feedback-app-online.onrender.com', 'http://localhost:3000', `http://localhost:${process.env.PORT || 3000}`], // CORS CONFIG SOCKET.IO KE LIYE
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// ****** MongoDB Connection String ******
// ... (baaki MONGODB_URI, ADMIN_USERNAME, ADMIN_PASSWORD waise hi)
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://dontchange365:DtUiOMFzQVM0tG9l@nobifeedback.9ntuipc.mongodb.net/?retryWrites=true&w=majority&appName=nobifeedback';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'samshaad365';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'shizuka123';


mongoose.connect(MONGODB_URI)
  .then(() => console.log('MONGODB SE CONNECTION SAFAL! DATABASE AB READY HAI!'))
  .catch(err => console.error('MONGODB CONNECTION MEIN LOHDA LAG GAYA:', err));

function getDiceBearAvatarUrlServer(name, randomSeed = '') {
    const seedName = (typeof name === 'string' && name) ? name.toLowerCase() : 'default_seed';
    const seed = encodeURIComponent(seedName + randomSeed);
    return `https://api.dicebear.com/8.x/adventurer/svg?seed=${seed}&flip=true&radius=50&doodle=true&scale=90`;
}

const feedbackSchema = new mongoose.Schema({
  name: { type: String, required: true },
  feedback: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  timestamp: { type: Date, default: Date.now }, 
  avatarUrl: { type: String },
  userIp: { type: String },
  isEdited: { type: Boolean, default: false },
  originalContent: { 
    name: String,
    feedback: String,
    rating: Number,
    timestamp: Date 
  },
  replies: [
    {
      text: { type: String, required: true },
      timestamp: { type: Date, default: Date.now },
      adminName: { type: String, default: 'Admin' }
    }
  ]
});

const Feedback = mongoose.model('Feedback', feedbackSchema);

app.use(cors({
    origin: ['https://nobita-feedback-app-online.onrender.com', 'http://localhost:3000', `http://localhost:${PORT}`],
    methods: ['GET', 'POST', 'DELETE', 'PUT'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use((req, res, next) => { /* ... IP middleware unchanged ... */ 
    req.clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    if (req.clientIp === '::1' || req.clientIp === '::ffff:127.0.0.1') { 
        req.clientIp = '127.0.0.1';
    }
    if (req.clientIp && req.clientIp.includes(',')) {
        req.clientIp = req.clientIp.split(',')[0].trim();
    }
    next();
});
const authenticateAdmin = (req, res, next) => { /* ... unchanged ... */ 
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

app.use(express.static(path.join(__dirname, 'public'), { index: 'index.html' }));

app.get('/api/feedbacks', async (req, res) => { /* ... unchanged ... */ 
    try {
        const allFeedbacks = await Feedback.find().sort({ timestamp: -1 });
        res.status(200).json(allFeedbacks);
    } catch (error) {
        console.error('FEEDBACK FETCH KARTE WAQT ERROR AAYA:', error);
        res.status(500).json({ message: 'FEEDBACK FETCH NAHI HO PAYE.', error: error.message });
    }
});

app.post('/api/feedback', async (req, res) => {
    const { name, feedback, rating } = req.body;
    const userIp = req.clientIp;
    if (!name || !feedback || !rating || rating === '0') { 
        return res.status(400).json({ message: 'NAAM, FEEDBACK, AUR RATING SAB CHAHIYE, BHAI!' });
    }
    try {
        let avatarUrlToSave;
        const existingFeedbackByName = await Feedback.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
        if (existingFeedbackByName && existingFeedbackByName.avatarUrl) {
            avatarUrlToSave = existingFeedbackByName.avatarUrl;
        } else {
            avatarUrlToSave = getDiceBearAvatarUrlServer(name);
        }
        const newFeedback = new Feedback({
            name: name,
            feedback: feedback,
            rating: parseInt(rating),
            avatarUrl: avatarUrlToSave,
            userIp: userIp,
            isEdited: false
        });
        await newFeedback.save();
        console.log('NAYA FEEDBACK DATABASE MEIN SAVE HUA HAI:', newFeedback);
        
        // SOCKET.IO EVENT EMIT KAR YAHAN SE
        io.emit('new_feedback', newFeedback); // SAB CONNECTED CLIENTS KO BHEJEGA
        
        res.status(201).json({ message: 'FEEDBACK SAFALTA-POORVAK JAMA KIYA GAYA AUR SAVE HUA!', feedback: newFeedback });
    } catch (error) {
        console.error('FEEDBACK DATABASE MEIN SAVE KARTE WAQT ERROR AAYA:', error);
        res.status(500).json({ message: 'FEEDBACK DATABASE MEIN SAVE NAHI HO PAYA.', error: error.message });
    }
});

app.put('/api/feedback/:id', async (req, res) => {
    // ... (console.log wala PUT route unchanged from previous response) ...
    // ISKE ANDAR BHI `io.emit('updated_feedback', existingFeedback);` DAALNA HOGA `await existingFeedback.save();` KE BAAD
    const feedbackId = req.params.id;
    const { name, feedback, rating } = req.body;
    const clientIp = req.clientIp;

    if (!name || !feedback || !rating || rating === '0') {
        return res.status(400).json({ message: 'NAAM, FEEDBACK, AUR RATING SAB CHAHIYE UPDATE KE LIYE!' });
    }

    try {
        const existingFeedback = await Feedback.findById(feedbackId);
        if (!existingFeedback) {
            return res.status(404).json({ message: 'FEEDBACK MILA NAHI BHAI, UPDATE KISKO KARUN?' });
        }
        if (existingFeedback.userIp !== clientIp) {
            return res.status(403).json({ message: 'TUM SIRF APNA FEEDBACK EDIT KAR SAKTE HO, DOOSRE KA NAHI!' });
        }

        const parsedRating = parseInt(rating);
        const contentActuallyChanged = existingFeedback.name !== name || existingFeedback.feedback !== feedback || existingFeedback.rating !== parsedRating;
        
        console.log(`[EDIT CHECK] Feedback ID: ${feedbackId}, Content Changed: ${contentActuallyChanged}, OriginalContent Exists: ${!!existingFeedback.originalContent}`);

        if (contentActuallyChanged) {
            if (!existingFeedback.originalContent) { 
                existingFeedback.originalContent = {
                    name: existingFeedback.name,
                    feedback: existingFeedback.feedback,
                    rating: existingFeedback.rating,
                    timestamp: existingFeedback.timestamp 
                };
                console.log(`[EDIT ACTION] Storing NEW original content for feedback ID ${feedbackId}`);
            }
            existingFeedback.name = name;
            existingFeedback.feedback = feedback;
            existingFeedback.rating = parsedRating;
            existingFeedback.timestamp = Date.now(); 
            existingFeedback.isEdited = true;
            console.log(`[EDIT ACTION] Feedback ID ${feedbackId} marked as edited.`);
        } else {
            console.log(`[EDIT INFO] No actual content change for feedback ID ${feedbackId}.`);
        }

        const savedFeedback = await existingFeedback.save(); // Get the saved document
        console.log('[EDIT ACTION] Feedback saved successfully.');
        io.emit('updated_feedback', savedFeedback); // Emit event with the final saved feedback
        res.status(200).json({ message: 'FEEDBACK SAFALTA-POORVAK UPDATE HUA!', feedback: savedFeedback });

    } catch (error) {
        console.error(`FEEDBACK UPDATE KARTE WAQT ERROR AAYA (ID: ${feedbackId}):`, error);
        res.status(500).json({ message: 'FEEDBACK UPDATE NAHI HO PAYA.', error: error.message });
    }
});


app.get('/admin-panel-nobita', authenticateAdmin, async (req, res) => { /* ... Admin panel HTML generation unchanged from previous full server.js ... */
    // ISKE ANDAR BHI SOCKET.IO CLIENT SCRIPT DAALNA HOGA AGAR ADMIN PANEL KO BHI LIVE KARNA HAI
    // AUR ADMIN PANEL KE JAVASCRIPT MEIN BHI SOCKET LISTENERS ADD KARNE HONGE
    // ABHI KE LIYE MAIN ISKO CHHED NAHI RAHA HUN, FOCUS MAIN PAGE PE HAI
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
                <script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>
                <style>
                    /* ... (Admin Panel CSS from previous server.js response) ... */
                    body { font-family: 'Roboto', sans-serif; background: linear-gradient(135deg, #1A1A2E, #16213E); color: #E0E0E0; margin: 0; padding: 30px 20px; display: flex; flex-direction: column; align-items: center; min-height: 100vh; }
                    h1 { color: #FFD700; text-align: center; margin-bottom: 40px; font-size: 2.8em; text-shadow: 0 0 15px rgba(255,215,0,0.5); }
                    .main-panel-btn-container { width: 100%; max-width: 1200px; display: flex; justify-content: flex-start; margin-bottom: 20px; padding: 0 10px; }
                    .main-panel-btn { background-color: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 8px; font-size: 1em; font-weight: bold; cursor: pointer; transition: background-color 0.3s ease, transform 0.2s; text-decoration: none; display: inline-block; text-transform: uppercase; }
                    .main-panel-btn:hover { background-color: #0056b3; transform: translateY(-2px); }
                    .feedback-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 30px; width: 100%; max-width: 1200px; }
                    .feedback-card { background-color: transparent; border-radius: 15px; perspective: 1000px; min-height: 450px; }
                    .feedback-card-inner { position: relative; width: 100%; height: 100%; transition: transform 0.7s; transform-style: preserve-3d; box-shadow: 0 8px 25px rgba(0, 0, 0, 0.4); border-radius: 15px; }
                    .feedback-card.is-flipped .feedback-card-inner { transform: rotateY(180deg); }
                    .feedback-card-front, .feedback-card-back { position: absolute; width: 100%; height: 100%; -webkit-backface-visibility: hidden; backface-visibility: hidden; background-color: #2C3E50; color: #E0E0E0; border-radius: 15px; padding: 25px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; overflow-y: auto; }
                    .feedback-card-back { transform: rotateY(180deg); background-color: #34495E; }
                    .feedback-header { display: flex; align-items: center; gap: 15px; margin-bottom: 15px; flex-shrink: 0; }
                    .feedback-avatar { width: 60px; height: 60px; border-radius: 50%; overflow: hidden; border: 3px solid #FFD700; flex-shrink: 0; box-shadow: 0 0 10px rgba(255,215,0,0.3); }
                    .feedback-avatar img { width: 100%; height: 100%; object-fit: cover; }
                    .feedback-info { flex-grow: 1; display: flex; flex-direction: column; align-items: flex-start; }
                    .feedback-info h4 { margin: 0; font-size: 1.4em; color: #FFD700; text-transform: uppercase; display: flex; align-items: center; gap: 8px; }
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
                <div class="main-panel-btn-container">
                    <a href="/" class="main-panel-btn">← GO TO MAIN FEEDBACK PANEL</a>
                </div>
                <div class="feedback-grid">
        `;
        // ... (Loop for feedbacks with charAt fixes as in previous response)
        if (feedbacks.length === 0) {
            html += `<p class="no-feedback" style="text-align: center; color: #7F8C8D; font-size: 1.2em; grid-column: 1 / -1;">ABHI TAK KISI NE GANDI BAAT NAHI KI HAI, BHAI!</p>`;
        } else {
            feedbacks.forEach(fb => {
                const fbNameInitial = (typeof fb.name === 'string' && fb.name.length > 0) ? fb.name.charAt(0).toUpperCase() : 'X';
                const fbAvatar = fb.avatarUrl || getDiceBearAvatarUrlServer(fb.name || 'Anonymous');

                html += `
                    <div class="feedback-card" id="card-${fb._id}">
                        <div class="feedback-card-inner">
                            <div class="feedback-card-front">
                                <div class="feedback-header">
                                    <div class="feedback-avatar"><img src="${fbAvatar}" alt="${fbNameInitial}"></div>
                                    <div class="feedback-info">
                                        <h4>${fb.name || 'NAAM NAHI HAI'} ${fb.isEdited ? '<span class="edited-admin-tag">EDITED</span>' : ''}</h4>
                                        <div class="rating">${'★'.repeat(fb.rating)}${'☆'.repeat(5 - fb.rating)}</div>
                                        <div class="user-ip">IP: ${fb.userIp || 'N/A'}</div>
                                    </div>
                                </div>
                                <div class="feedback-body"><p>${fb.feedback}</p></div>
                                <div class="feedback-date">
                                    ${fb.isEdited ? 'Last Edited' : 'Posted'}: ${new Date(fb.timestamp).toLocaleString()}
                                    ${fb.isEdited && fb.originalContent && fb.originalContent.timestamp ? `<br><small>Original Post: ${new Date(fb.originalContent.timestamp).toLocaleString()}</small>` : ''}
                                </div>
                                <div class="action-buttons">
                                    <button class="delete-btn" onclick="tryDeleteFeedback('${fb._id}')">UDHA DE!</button>
                                    <button class="change-avatar-btn" onclick="tryChangeAvatar('${fb._id}', '${fb.name || ''}')">AVATAR BADAL!</button>
                                </div>
                                <div class="reply-section">
                                    <textarea id="reply-text-${fb._id}" placeholder="REPLY LIKH YAHAN..."></textarea>
                                    <button class="reply-btn" onclick="tryPostReply('${fb._id}', 'reply-text-${fb._id}')">REPLY FEK!</button>
                                    <div class="replies-display">
                                        ${fb.replies && fb.replies.length > 0 ? '<h4>REPLIES:</h4>' : ''}
                                        ${fb.replies.map(reply => `
                                            <div class="single-reply">
                                                <img src="${nobitaAvatarUrl}" alt="Nobita Admin" class="admin-reply-avatar-sm">
                                                <div class="reply-content-wrapper">
                                                    <span class="reply-admin-name">${reply.adminName}:</span> ${reply.text}
                                                    <span class="reply-timestamp">(${new Date(reply.timestamp).toLocaleString()})</span>
                                                </div>
                                            </div>`).join('')}
                                    </div>
                                </div>
                                ${fb.isEdited && fb.originalContent ? `<button class="flip-btn" onclick="flipCard('${fb._id}')">ORIGINAL DEKH BHAI!</button>` : ''}
                            </div>`;
                if (fb.isEdited && fb.originalContent) {
                    const originalNameInitial = (fb.originalContent && typeof fb.originalContent.name === 'string' && fb.originalContent.name.length > 0) ? fb.originalContent.name.charAt(0).toUpperCase() : 'X';
                    const originalAvatar = fb.avatarUrl || getDiceBearAvatarUrlServer(fb.originalContent.name || 'Anonymous'); // Use same avatar as front for consistency or a different logic if original avatar was stored
                    html += `
                            <div class="feedback-card-back">
                                <div class="feedback-header">
                                    <div class="feedback-avatar"><img src="${originalAvatar}" alt="${originalNameInitial}"></div>
                                    <div class="feedback-info">
                                        <h4>ORIGINAL: ${fb.originalContent.name || 'NAAM NAHI HAI'}</h4>
                                        <div class="rating">${'★'.repeat(fb.originalContent.rating || 0)}${'☆'.repeat(5 - (fb.originalContent.rating || 0))}</div>
                                    </div>
                                </div>
                                <div class="feedback-body"><p>${fb.originalContent.feedback || 'FEEDBACK NAHI HAI'}</p></div>
                                <div class="feedback-date">Originally Posted: ${fb.originalContent.timestamp ? new Date(fb.originalContent.timestamp).toLocaleString() : 'N/A'}</div>
                                <div style="margin-top: auto;"> 
                                   <button class="flip-btn" onclick="flipCard('${fb._id}')">EDITED DEKH BHAI!</button>
                                </div>
                            </div>`;
                }
                html += `
                        </div> 
                    </div>`;
            });
        }

        html += `
                </div> 
                <div id="adminModalOverlay" class="admin-modal-overlay"> /* ... (Admin Modal HTML unchanged) ... */ </div>
                <script>
                    // ADMIN PANEL SOCKET.IO CLIENT LOGIC
                    const adminSocket = io('${process.env.BASE_URL || `http://localhost:${PORT}`}'); // Connect to server
                    adminSocket.on('connect', () => { console.log('Admin panel connected to WebSocket server'); });

                    function fetchAdminFeedbacks() { window.location.reload(); /* Simplest way to refresh for now */ }

                    adminSocket.on('new_feedback', (feedback) => {
                        console.log('Admin Panel: New feedback received via WebSocket', feedback);
                        showAdminModal('alert', 'NAYA FEEDBACK!', \`User '\${feedback.name}' ne feedback diya hai. Page refresh karo.\`);
                        // For a better UX, you would dynamically add the new feedback card to the DOM here
                        // fetchAdminFeedbacks(); // Or reload
                    });
                    adminSocket.on('updated_feedback', (feedback) => {
                        console.log('Admin Panel: Feedback updated via WebSocket', feedback);
                        showAdminModal('alert', 'FEEDBACK UPDATE!', \`Feedback ID '\${feedback._id}' update hua hai. Page refresh karo.\`);
                        // Dynamically update the specific card
                        // fetchAdminFeedbacks(); // Or reload
                    });
                     adminSocket.on('deleted_feedback', (feedbackId) => {
                        console.log('Admin Panel: Feedback deleted via WebSocket', feedbackId);
                        const card = document.getElementById(\`card-\${feedbackId}\`);
                        if (card) card.remove();
                        showAdminModal('alert', 'FEEDBACK GAYAB!', \`Feedback ID '\${feedbackId}' delete ho gaya hai.\`);
                    });
                    adminSocket.on('new_reply', (feedback) => {
                        console.log('Admin Panel: New reply via WebSocket', feedback);
                         showAdminModal('alert', 'NAYA REPLY!', \`Feedback ID '\${feedback._id}' pe reply aaya hai. Page refresh karo.\`);
                        // fetchAdminFeedbacks(); // Or reload
                    });

                    // ... (Rest of Admin Panel JS: AUTH_HEADER, modal functions, flipCard, tryDeleteFeedback etc. unchanged) ...
                    const AUTH_HEADER = '${authHeaderValue}';
                    const adminModalOverlay = document.getElementById('adminModalOverlay');
                    const adminModalTitle = document.getElementById('adminModalTitle');
                    const adminModalMessage = document.getElementById('adminModalMessage');
                    const adminModalOkButton = document.getElementById('adminModalOkButton');
                    const adminModalConfirmButton = document.getElementById('adminModalConfirmButton');
                    const adminModalCancelButton = document.getElementById('adminModalCancelButton');
                    let globalConfirmCallback = null;

                    function showAdminModal(type, title, message, confirmCallbackFn = null) { /* ... unchanged ... */ }
                    adminModalOkButton.addEventListener('click', () => { /* ... unchanged ... */ });
                    adminModalConfirmButton.addEventListener('click', () => { /* ... unchanged ... */ });
                    adminModalCancelButton.addEventListener('click', () => { /* ... unchanged ... */ });
                    function flipCard(feedbackId) { /* ... unchanged ... */ }
                    async function tryDeleteFeedback(id) { /* ... unchanged, but will emit from server ... */ }
                    async function tryPostReply(feedbackId, textareaId) { /* ... unchanged, but will emit from server ... */ }
                    async function tryChangeAvatar(feedbackId, userName) { /* ... unchanged, can emit 'avatar_changed' from server ... */ }
                </script>
            </body>
            </html>
        `;
        res.send(html);
    } catch (error) { 
        console.error('ERROR GENERATING ADMIN PANEL:', error);
        res.status(500).send(`SAALA! ADMIN PANEL KI FATTI HAI! ERROR MESSAGE: ${error.message}. STACK: ${error.stack}`);
    }
});

app.delete('/api/admin/feedback/:id', authenticateAdmin, async (req, res) => {
    const feedbackId = req.params.id;
    try {
        const deletedFeedback = await Feedback.findByIdAndDelete(feedbackId);
        if (!deletedFeedback) {
            return res.status(404).json({ message: 'FEEDBACK NAHI MILA, BHAI. DELETE KISKO KARUN?' });
        }
        console.log('FEEDBACK DELETE KIYA GAYA:', deletedFeedback);
        io.emit('deleted_feedback', feedbackId); // EMIT EVENT
        res.status(200).json({ message: 'FEEDBACK SAFALTA-POORVAK DELETE HUA!', deletedFeedback });
    } catch (error) {
        console.error('FEEDBACK DELETE KARTE WAQT ERROR AAYA:', error);
        res.status(500).json({ message: 'FEEDBACK DELETE NAHI HO PAYA.', error: error.message });
    }
});

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
        const updatedFeedback = await feedback.save();
        io.emit('new_reply', updatedFeedback); // EMIT EVENT
        res.status(200).json({ message: 'REPLY SAFALTA-POORVAK JAMA HUA!', reply: updatedFeedback.replies[updatedFeedback.replies.length - 1] });
    } catch (error) {
        console.error('REPLY SAVE KARTE WAQT FATTI HAI:', error);
        res.status(500).json({ message: 'REPLY SAVE NAHI HO PAYA. SERVER KI GANDI HAALAT HAI!', error: error.message });
    }
});

app.put('/api/admin/feedback/:id/change-avatar', authenticateAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const feedbackToUpdate = await Feedback.findById(id);
        if (!feedbackToUpdate) {
            return res.status(404).json({ message: 'FEEDBACK MILA NAHI BHAI, AVATAR KAISE BADLU?' });
        }
        const userName = feedbackToUpdate.name;
        if (typeof userName !== 'string' || !userName) {
             console.error(`[AVATAR CHANGE ERROR] User name is invalid for feedback ID ${id}:`, userName);
             return res.status(400).json({ message: 'USER KA NAAM THEEK NAHI HAI AVATAR GENERATE KARNE KE LIYE.' });
        }
        const newAvatarUrl = getDiceBearAvatarUrlServer(userName, Date.now().toString());
        await Feedback.updateMany({ name: userName }, { $set: { avatarUrl: newAvatarUrl } });
        console.log(`[AVATAR CHANGE] Avatar updated for user ${userName} (triggered by feedback ID ${id}) to ${newAvatarUrl}`);
        // Emitting a general event; clients might need to re-fetch or smartly update.
        io.emit('avatar_changed', { userName: userName, newAvatarUrl: newAvatarUrl });
        res.status(200).json({ message: 'AVATAR SAFALTA-POORVAK BADLA GAYA!', newAvatarUrl: newAvatarUrl });
    } catch (error) {
        console.error(`AVATAR BADALTE WAQT FATTI HAI (ID: ${id}):`, error);
        res.status(500).json({ message: 'AVATAR BADAL NAHI PAYA. SERVER KI GANDI HAALAT HAI!', error: error.message });
    }
});

// SOCKET.IO CONNECTION HANDLER
io.on('connection', (socket) => {
  console.log('EK USER CONNECT HUA SOCKET SE:', socket.id);
  socket.on('disconnect', () => {
    console.log('USER DISCONNECT HO GAYA:', socket.id);
  });
  // YAHAN AUR BHI CUSTOM EVENTS HANDLE KAR SAKTE HO
});

// APP.LISTEN KE BADLE SERVER.LISTEN USE KARO
server.listen(PORT, () => {
    console.log(`SERVER CHALU HO GAYA HAI PORT ${PORT} PAR (SOCKET.IO KE SAATH): http://localhost:${PORT}`);
    console.log('AB FRONTEND SE API CALL AUR SOCKET EVENTS DONO CHALENGE!');
});
