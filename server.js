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
            avatarUrl: avatarUrlToSave
        });

        await newFeedback.save();

        console.log('NAYA FEEDBACK DATABASE MEIN SAVE HUA HAI:', newFeedback);
        res.status(201).json({ message: 'FEEDBACK SAFALTA-POORVAK JAMA KIYA GAYA AUR SAVE HUA!', feedback: newFeedback });
    } catch (error) {
        console.error('FEEDBACK DATABASE MEIN SAVE KARTE WAQT ERROR AAYA:', error);
        res.status(500).json({ message: 'FEEDBACK DATABASE MEIN SAVE NAHI HO PAYA.', error: error.message });
    }
});

// ADMIN PANEL KA ROUTE - ***** YAHAN POORA BADLAV KIYA HAI DESIGN KE LIYE! *****
app.get('/admin-panel-nobita', authenticateAdmin, async (req, res) => {
    try {
        const feedbacks = await Feedback.find().sort({ timestamp: -1 });
        const encodedCredentials = Buffer.from(`${ADMIN_USERNAME}:${ADMIN_PASSWORD}`).toString('base64');
        const authHeaderValue = `Basic ${encodedCredentials}`;

        let html = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>ADMIN PANEL: NOBITA'S COMMAND CENTER</title>
                <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap" rel="stylesheet">
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
                    }
                    .feedback-card:hover {
                        transform: translateY(-5px);
                        box-shadow: 0 12px 30px rgba(0, 0, 0, 0.6);
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
                    }
                    .single-reply:last-child {
                        border-bottom: none;
                        margin-bottom: 0;
                    }
                    .reply-admin-name {
                        font-weight: bold;
                        color: #9B59B6; /* Purple */
                    }
                    .reply-timestamp {
                        font-size: 0.75em;
                        color: #8E9A9D;
                        margin-left: 10px;
                    }

                    @media (max-width: 768px) {
                        h1 { font-size: 2.2em; margin-bottom: 30px; }
                        .feedback-grid { grid-template-columns: 1fr; }
                        .feedback-card { padding: 20px; }
                        .action-buttons { flex-direction: column; }
                    }
                </style>
            </head>
            <body>
                <h1>NOBITA'S FEEDBACK COMMAND CENTER</h1>
                <div class="feedback-grid">
        `;

        if (feedbacks.length === 0) {
            html += `<p class="no-feedback" style="text-align: center; color: #7F8C8D; font-size: 1.2em; grid-column: 1 / -1;">ABHI TAK KISI NE GANDI BAAT NAHI KI HAI, BHAI!</p>`;
        } else {
            feedbacks.forEach(fb => {
                html += `
                    <div class="feedback-card">
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
                            <button class="delete-btn" onclick="deleteFeedback('${fb._id}')">UDHA DE!</button>
                            <button class="change-avatar-btn" onclick="changeAvatar('${fb._id}', '${fb.name}')">AVATAR BADAL!</button>
                        </div>
                        
                        <div class="reply-section">
                            <textarea id="reply-text-${fb._id}" placeholder="REPLY LIKH YAHAN..."></textarea>
                            <button class="reply-btn" onclick="postReply('${fb._id}', 'reply-text-${fb._id}')">REPLY FEK!</button>
                            <div class="replies-display">
                                ${fb.replies && fb.replies.length > 0 ? '<h4>REPLIES:</h4>' : ''}
                                ${fb.replies && fb.replies.map(reply => `
                                    <div class="single-reply">
                                        <span class="reply-admin-name">${reply.adminName}:</span> ${reply.text}
                                        <span class="reply-timestamp">(${new Date(reply.timestamp).toLocaleString()})</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                `;
            });
        }

        html += `
                </div>
                <script>
                    const AUTH_HEADER = '${authHeaderValue}'; // ADMIN CREDENTIALS (PRODUCTION KE LIYE SAFE NAHI HAI)

                    async function deleteFeedback(id) {
                        if (confirm('PAKKA UDHA DENA HAI? FIR WAPAS NAHI AAYEGA!')) {
                            try {
                                const baseUrl = window.location.origin;
                                const response = await fetch(\`\${baseUrl}/api/admin/feedback/\${id}\`, {
                                    method: 'DELETE',
                                    headers: {
                                        'Authorization': AUTH_HEADER
                                    }
                                });
                                if (response.ok) {
                                    alert('FEEDBACK UDHA DIYA!');
                                    window.location.reload();
                                } else {
                                    const errorData = await response.json();
                                    alert(\`UDHANE MEIN PHADDA HUA: \${errorData.message || 'KOI ANJAAN ERROR!'}\`);
                                }
                            } catch (error) {
                                alert(\`NETWORK KI LAGG GAYI: \${error.message}\`);
                            }
                        }
                    }

                    async function postReply(feedbackId, textareaId) {
                        const replyTextarea = document.getElementById(textareaId);
                        const replyText = replyTextarea.value.trim();

                        if (!replyText) {
                            alert('REPLY KUCH LIKH TOH DE, BHAI!');
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
                                alert('REPLY SAFALTA-POORVAK POST HUA!');
                                window.location.reload();
                            } else {
                                const errorData = await response.json();
                                alert(\`REPLY POST KARNE MEIN PHADDA HUA: \${errorData.message || 'KOI ANJAAN ERROR!'}\`);
                            }
                        } catch (error) {
                                alert(\`NETWORK KI LAGG GAYI REPLY POST KARNE MEIN: \${error.message}\`);
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
                                    alert('AVATAR SAFALTA-POORVAK BADLA GAYA! NAYA IMAGE AB DIKHEGA!');
                                    window.location.reload();
                                } else {
                                    const errorData = await response.json();
                                    alert(\`AVATAR BADALNE MEIN PHADDA HUA: \${errorData.message || 'KOI ANJAAN ERROR!'}\`);
                                }
                            } catch (error) {
                                alert(\`NETWORK KI LAGG GAYI AVATAR BADALNE MEIN: \${error.message}\`);
                            }
                        }
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
