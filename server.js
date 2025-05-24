// server.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv'); // Environment variables ke liye
const path = require('path'); // Static files serve karne ke liye

// .env file se variables load karega (agar deployment pe use karna hai)
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ****** MongoDB Connection String ******
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://dontchange365:DtUiOMFzQVM0tG9l@nobifeedback.9ntuipc.mongodb.net/?retryWrites=true&w=majority&appName=nobifeedback';

// ****** Admin Credentials (SECURITY ALERT!) ******
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'samshaad365';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'shammu@love';

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => console.log('MONGODB SE CONNECTION SAFAL! DATABASE AB READY HAI!'))
  .catch(err => console.error('MONGODB CONNECTION MEIN LOHDA LAG GAYA:', err));

// Define a Schema for Feedback
const feedbackSchema = new mongoose.Schema({
  name: { type: String, required: true },
  feedback: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  timestamp: { type: Date, default: Date.now },
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
        const newFeedback = new Feedback({
            name: name.toUpperCase(),
            feedback: feedback,
            rating: parseInt(rating)
        });
        await newFeedback.save();
        console.log('NAYA FEEDBACK DATABASE MEIN SAVE HUA HAI:', newFeedback);
        res.status(201).json({ message: 'FEEDBACK SAFALTA-POORVAK JAMA KIYA GAYA AUR SAVE HUA!', feedback: newFeedback });
    } catch (error) {
        console.error('FEEDBACK DATABASE MEIN SAVE KARTE WAQT ERROR AAYA:', error);
        res.status(500).json({ message: 'FEEDBACK DATABASE MEIN SAVE NAHI HO PAYA.', error: error.message });
    }
});

// ADMIN PANEL KA ROUTE
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
                <title>ADMIN PANEL: GANDI BAATEIN</title>
                <style>
                    body { font-family: 'Inter', sans-serif; background-color: #1a1a1a; color: #f0f0f0; margin: 20px; }
                    h1 { color: #ff4500; text-align: center; margin-bottom: 30px; }
                    .feedback-list { display: flex; flex-wrap: wrap; justify-content: center; gap: 20px; }
                    .feedback-item {
                        background-color: #333;
                        padding: 20px;
                        border-radius: 10px;
                        width: 300px;
                        box-shadow: 0 0 15px rgba(0, 0, 0, 0.6);
                        position: relative;
                        display: flex;
                        flex-direction: column;
                        justify-content: space-between;
                        margin-bottom: 20px;
                    }
                    .feedback-item h4 { margin: 0 0 8px; font-size: 1.2em; color: #3b82f6; }
                    .feedback-item p { margin: 5px 0; font-size: 0.95em; color: #ccc; }
                    .feedback-item .rating { font-size: 1.1em; color: #ffd700; }
                    .feedback-item .date { font-size: 0.75em; color: #aaa; margin-top: 10px; }
                    .feedback-item button {
                        background-color: #dc3545;
                        color: white;
                        border: none;
                        padding: 10px 15px;
                        border-radius: 5px;
                        cursor: pointer;
                        margin-top: 15px;
                        transition: background-color 0.3s;
                        font-weight: bold;
                        width: 100%;
                    }
                    .feedback-item button:hover {
                        background-color: #c82333;
                    }
                    /* Reply Section Styles */
                    .reply-section {
                        margin-top: 15px;
                        border-top: 1px solid #555;
                        padding-top: 15px;
                    }
                    .reply-section textarea {
                        width: calc(100% - 20px);
                        padding: 8px;
                        border: 1px solid #777;
                        border-radius: 4px;
                        background-color: #444;
                        color: #f0f0f0;
                        resize: vertical;
                        min-height: 50px;
                        margin-bottom: 10px;
                        font-size: 0.9em;
                    }
                    .reply-section button {
                        background-color: #28a745;
                        margin-top: 0;
                    }
                    .reply-section button:hover {
                        background-color: #218838;
                    }
                    .replies-display {
                        margin-top: 10px;
                        background-color: #2a2a2a;
                        border-radius: 5px;
                        padding: 10px;
                        border: 1px solid #444;
                    }
                    .single-reply {
                        border-bottom: 1px solid #3a3a3a;
                        padding-bottom: 8px;
                        margin-bottom: 8px;
                        font-size: 0.85em;
                        color: #bbb;
                    }
                    .single-reply:last-child {
                        border-bottom: none;
                        margin-bottom: 0;
                    }
                    .reply-admin-name {
                        font-weight: bold;
                        color: #00bcd4;
                    }
                    .reply-timestamp {
                        font-size: 0.75em;
                        color: #888;
                        margin-left: 10px;
                    }

                </style>
            </head>
            <body>
                <h1>ADMIN PANEL: GANDI BAATEIN LOG</h1>
                <div class="feedback-list">
        `;

        if (feedbacks.length === 0) {
            html += `<p class="no-feedback">ABHI TAK KISI NE GANDI BAAT NAHI KI HAI.</p>`;
        } else {
            feedbacks.forEach(fb => {
                html += `
                    <div class="feedback-item">
                        <div>
                            <h4>BY: ${fb.name}</h4>
                            <p class="rating">RATING: ${'★'.repeat(fb.rating) + '☆'.repeat(5 - fb.rating)}</p>
                            <p>FEEDBACK: ${fb.feedback}</p>
                            <p class="date">DATE: ${new Date(fb.timestamp).toLocaleString()}</p>
                        </div>
                        <button onclick="deleteFeedback('${fb._id}')">UDHA DE!</button>
                        
                        <div class="reply-section">
                            <textarea id="reply-text-${fb._id}" placeholder="REPLY LIKH YAHAN..."></textarea>
                            <button onclick="postReply('${fb._id}', 'reply-text-${fb._id}')">REPLY FEK!</button>
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
                                // ***** YAHAN BADLAV KIYA HAI! ADMIN NAME AB '👉𝙉𝙊𝘽𝙄𝙏𝘼🤟' JAYEGA! *****
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

// ADMIN DELETE API ENDPOINT (YE WAHI PURANA HAI)
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

// NAYA API ENDPOINT: ADMIN REPLY KARNE KE LIYE!
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


// Start the server
app.listen(PORT, () => {
    console.log(`SERVER CHALU HO GAYA HAI PORT ${PORT} PAR: http://localhost:${PORT}`);
    console.log('AB FRONTEND SE API CALL KAR SAKTE HAIN!');
});
