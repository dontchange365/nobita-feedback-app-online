// server.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const session = require('express-session');
const MongoStore = require('connect-mongo');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const MONGODB_URI = process.env.MONGODB_URI;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const JWT_SECRET = process.env.JWT_SECRET;
const SESSION_SECRET = process.env.SESSION_SECRET;

if (!MONGODB_URI || !GOOGLE_CLIENT_ID || !JWT_SECRET || !SESSION_SECRET || !ADMIN_USERNAME || !ADMIN_PASSWORD) {
    console.error("MAHATVAPOORN ENVIRONMENT VARIABLES MISSING HAIN! .env file check karo.");
    process.exit(1);
}

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

mongoose.connect(MONGODB_URI)
  .then(() => console.log('MongoDB se connection safal! Database ab taiyaar hai!'))
  .catch(err => {
    console.error('MongoDB connection mein gadbad ho gayi:', err);
    process.exit(1);
  });

// --- Session Setup for Admin Panel ---
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: MONGODB_URI,
        ttl: 14 * 24 * 60 * 60, // 14 days
        collectionName: 'admin_sessions',
        autoRemove: 'interval',
        autoRemoveInterval: 10 // In minutes. Default
    }),
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 // 1 day
    }
}));

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
  googleId: { type: String, sparse: true },
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

// Middlewares
app.use(cors({
    origin: (process.env.NODE_ENV === 'production' ? 'https://nobita-feedback-app-online.onrender.com' : ['http://localhost:3000', `http://localhost:${PORT}`]).split(',').concat(['https://accounts.google.com', 'https://*.google.com']),
    credentials: true, // Important for sessions
    methods: ['GET', 'POST', 'DELETE', 'PUT'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// IP Address Middleware
app.use((req, res, next) => {
    let clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    if (clientIp) {
        if (clientIp.substr(0, 7) === "::ffff:") { clientIp = clientIp.substr(7); }
        if (clientIp === '::1') { clientIp = '127.0.0.1'; }
        if (clientIp.includes(',')) { clientIp = clientIp.split(',')[0].trim(); }
    }
    req.clientIp = clientIp || 'UNKNOWN_IP';
    next();
});

// --- JWT Auth Middlewares for Main Site Users ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.status(401).json({ message: "Authentication token nahi mila." });
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: "Token valid nahi hai ya expire ho gaya hai." });
        req.user = user;
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

// --- Main Site Auth Routes ---
app.post('/api/auth/google-signin', async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: 'Google ID token nahi mila.' });
    try {
        const ticket = await googleClient.verifyIdToken({ idToken: token, audience: GOOGLE_CLIENT_ID });
        const payload = ticket.getPayload();
        if (!payload) throw new Error("Google token payload nahi mila.");
        const { sub, name, email, picture } = payload;
        const userForToken = { googleId: sub, name, email, picture };
        const appToken = jwt.sign(userForToken, JWT_SECRET, { expiresIn: '7d' });
        res.status(200).json({ token: appToken, user: userForToken });
    } catch (error) {
        console.error('Google token verification mein problem:', error);
        res.status(401).json({ message: 'Google token invalid hai.', error: error.message });
    }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
    res.status(200).json(req.user);
});

// --- Admin Authentication Middleware (Session Based) ---
const checkAdminSession = (req, res, next) => {
    if (req.session && req.session.isAdminAuthenticated) {
        return next();
    } else {
        req.session.returnTo = req.originalUrl; // Store original URL
        res.redirect('/admin-login');
    }
};

// --- Admin Login Routes ---
app.get('/admin-login', (req, res) => {
    if (req.session && req.session.isAdminAuthenticated) {
        return res.redirect('/admin-panel-nobita');
    }
    res.sendFile(path.join(__dirname, 'admin-login.html'));
});

app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        req.session.isAdminAuthenticated = true;
        req.session.adminUsername = username; // Store username in session if needed
        const returnTo = req.session.returnTo || '/admin-panel-nobita';
        delete req.session.returnTo;
        res.redirect(returnTo);
    } else {
        res.redirect('/admin-login?error=1');
    }
});

app.get('/api/admin/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error("Admin session destroy error:", err);
            return res.status(500).send('Logout mein problem aa gayi.');
        }
        res.clearCookie('connect.sid'); // Default session cookie name
        res.redirect('/admin-login');
    });
});

// Static Files for main site (e.g., index.html in root)
app.use(express.static(__dirname, { index: false })); // Serve static files from root, but don't default to index.html yet

// --- Feedback API Routes ---
app.get('/api/feedbacks', async (req, res) => {
    try {
        const allFeedbacks = await Feedback.find().sort({ timestamp: -1 });
        res.status(200).json(allFeedbacks);
    } catch (error) {
        res.status(500).json({ message: 'Feedbacks fetch nahi ho paye.', error: error.message });
    }
});

app.post('/api/feedback', authenticateTokenOptional, async (req, res) => {
    const { name, feedback, rating } = req.body;
    const userIp = req.clientIp;

    if (!req.user && !name) return res.status(400).json({ message: 'Naam daalna zaroori hai.' });
    if (!feedback || !rating || rating === '0') return res.status(400).json({ message: 'Feedback aur rating zaroori hai.' });

    let feedbackData = {
        name: req.user ? req.user.name : name,
        feedback: feedback,
        rating: parseInt(rating),
        userIp: userIp,
        isEdited: false,
        avatarUrl: req.user ? req.user.picture : getDiceBearAvatarUrlServer(name)
    };
    if (req.user) feedbackData.googleId = req.user.googleId;

    try {
        const newFeedback = new Feedback(feedbackData);
        await newFeedback.save();
        res.status(201).json({ message: 'Aapka feedback सफलतापूर्वक jama ho gaya!', feedback: newFeedback });
    } catch (error) {
        res.status(500).json({ message: 'Feedback database mein save nahi ho paya.', error: error.message });
    }
});

app.put('/api/feedback/:id', authenticateToken, async (req, res) => {
    const feedbackId = req.params.id;
    const { feedback, rating } = req.body;
    const loggedInUser = req.user;

    if (!feedback || !rating || rating === '0') return res.status(400).json({ message: 'Update ke liye feedback aur rating zaroori hai!' });

    try {
        const existingFeedback = await Feedback.findById(feedbackId);
        if (!existingFeedback) return res.status(404).json({ message: 'Yeh feedback ID mila nahi.' });
        if (!existingFeedback.googleId || existingFeedback.googleId !== loggedInUser.googleId) {
            return res.status(403).json({ message: 'Aap sirf apne Google account se diye gaye feedbacks ko hi edit kar sakte hain.' });
        }

        const parsedRating = parseInt(rating);
        if (existingFeedback.feedback !== feedback || existingFeedback.rating !== parsedRating || existingFeedback.name !== loggedInUser.name) {
            if (!existingFeedback.originalContent) {
                existingFeedback.originalContent = { name: existingFeedback.name, feedback: existingFeedback.feedback, rating: existingFeedback.rating, timestamp: existingFeedback.timestamp };
            }
            existingFeedback.name = loggedInUser.name;
            existingFeedback.feedback = feedback;
            existingFeedback.rating = parsedRating;
            existingFeedback.timestamp = Date.now();
            existingFeedback.isEdited = true;
        }
        await existingFeedback.save();
        res.status(200).json({ message: 'Aapka feedback सफलतापूर्वक update ho gaya!', feedback: existingFeedback });
    } catch (error) {
        res.status(500).json({ message: 'Feedback update nahi ho paya.', error: error.message });
    }
});

// --- Admin Panel Route (Now uses session auth) ---
app.get('/admin-panel-nobita', checkAdminSession, async (req, res) => {
    try {
        const feedbacks = await Feedback.find().sort({ timestamp: -1 });
        const nobitaAvatarUrl = 'https://i.ibb.co/FsSs4SG/creator-avatar.png';
        // HTML for Admin Panel - ensure JS fetch calls DO NOT include Authorization headers anymore
        let html = `
            <!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>ADMIN PANEL: NOBITA'S COMMAND CENTER</title><link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap" rel="stylesheet">
            <style>
                body{font-family:'Roboto',sans-serif;background:linear-gradient(135deg, #1A1A2E, #16213E);color:#E0E0E0;margin:0;padding:30px 20px;display:flex;flex-direction:column;align-items:center;min-height:100vh}
                .admin-header-controls{width:100%;max-width:1200px;display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;padding:0 10px}
                h1{color:#FFD700;text-align:center;font-size:2.5em;margin:0 auto} /* Centered h1 */
                .main-panel-btn,.admin-logout-btn{background-color:#007bff;color:white;padding:10px 20px;border:none;border-radius:8px;font-size:1em;font-weight:bold;cursor:pointer;text-decoration:none;display:inline-block;text-transform:uppercase;transition:background-color .3s ease,transform .2s}
                .admin-logout-btn{background-color:#dc3545}
                .main-panel-btn:hover,.admin-logout-btn:hover{transform:translateY(-2px)}
                .main-panel-btn:hover{background-color:#0056b3}
                .admin-logout-btn:hover{background-color:#c82333}
                .feedback-grid{display:grid;grid-template-columns:repeat(auto-fill, minmax(350px, 1fr));gap:30px;width:100%;max-width:1200px}
                .feedback-card{background-color:transparent;border-radius:15px;perspective:1000px;min-height:480px}
                .feedback-card-inner{position:relative;width:100%;height:100%;transition:transform .7s;transform-style:preserve-3d;box-shadow:0 8px 25px rgba(0,0,0,.4);border-radius:15px}
                .feedback-card.is-flipped .feedback-card-inner{transform:rotateY(180deg)}
                .feedback-card-front,.feedback-card-back{position:absolute;width:100%;height:100%;-webkit-backface-visibility:hidden;backface-visibility:hidden;background-color:#2C3E50;color:#E0E0E0;border-radius:15px;padding:25px;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;overflow-y:auto}
                .feedback-card-back{transform:rotateY(180deg);background-color:#34495E}
                .feedback-header{display:flex;align-items:center;gap:15px;margin-bottom:15px;flex-shrink:0}
                .feedback-avatar{width:60px;height:60px;border-radius:50%;overflow:hidden;border:3px solid #FFD700;flex-shrink:0;box-shadow:0 0 10px rgba(255,215,0,.3)}
                .feedback-avatar img{width:100%;height:100%;object-fit:cover}
                .feedback-info{flex-grow:1;display:flex;flex-direction:column;align-items:flex-start}
                .feedback-info h4{margin:0;font-size:1.4em;color:#FFD700;text-transform:uppercase;display:flex;align-items:center;gap:8px}
                .google-user-tag{background-color:#4285F4;color:white;padding:2px 6px;border-radius:4px;font-size:.7em;margin-left:8px;vertical-align:middle}
                .feedback-info .rating{font-size:1.1em;color:#F39C12;margin-top:5px}
                .feedback-info .user-ip{font-size:.9em;color:#AAB7B8;margin-top:5px}
                .feedback-body{font-size:1em;color:#BDC3C7;line-height:1.6;margin-bottom:15px;flex-grow:1;overflow-y:auto;word-wrap:break-word}
                .feedback-date{font-size:.8em;color:#7F8C8D;text-align:right;margin-bottom:10px;border-top:1px solid #34495E;padding-top:10px;flex-shrink:0}
                .action-buttons{display:flex;gap:10px;margin-bottom:10px;flex-shrink:0}
                .action-buttons button,.flip-btn{flex-grow:1;padding:10px 12px;border:none;border-radius:8px;font-size:.9em;font-weight:bold;cursor:pointer;transition:background-color .3s ease,transform .2s;text-transform:uppercase}
                .action-buttons button:hover,.flip-btn:hover{transform:translateY(-2px)}
                .delete-btn{background-color:#E74C3C;color:white}.delete-btn:hover{background-color:#C0392B}
                .change-avatar-btn{background-color:#3498DB;color:white}.change-avatar-btn:hover{background-color:#2980B9}
                .flip-btn{background-color:#fd7e14;color:white;margin-top:10px;flex-grow:0;width:100%}.flip-btn:hover{background-color:#e66800}
                .reply-section{border-top:1px solid #34495E;padding-top:15px;margin-top:10px;flex-shrink:0}
                .reply-section textarea{width:calc(100% - 20px);padding:10px;border:1px solid #4A6070;border-radius:8px;background-color:#34495E;color:#ECF0F1;resize:vertical;min-height:50px;margin-bottom:10px;font-size:.95em}
                .reply-section textarea::placeholder{color:#A9B7C0}
                .reply-btn{background-color:#27AE60;color:white;width:100%;padding:10px;border:none;border-radius:8px;font-weight:bold;cursor:pointer;transition:background-color .3s ease,transform .2s;text-transform:uppercase}
                .reply-btn:hover{background-color:#229954;transform:translateY(-2px)}
                .replies-display{margin-top:15px;background-color:#213042;border-radius:10px;padding:10px;border:1px solid #2C3E50;max-height:150px;overflow-y:auto}
                .replies-display h4{color:#85C1E9;font-size:1.1em;margin-bottom:10px;border-bottom:1px solid #34495E;padding-bottom:8px}
                .single-reply{border-bottom:1px solid #2C3E50;padding-bottom:10px;margin-bottom:10px;font-size:.9em;color:#D5DBDB;display:flex;align-items:flex-start;gap:10px}
                .single-reply:last-child{border-bottom:none;margin-bottom:0}
                .admin-reply-avatar-sm{width:30px;height:30px;border-radius:50%;border:2px solid #9B59B6;flex-shrink:0;object-fit:cover;box-shadow:0 0 5px rgba(155,89,182,.5)}
                .reply-content-wrapper{flex-grow:1;word-wrap:break-word}.reply-admin-name{font-weight:bold;color:#9B59B6;display:inline;margin-right:5px}
                .reply-timestamp{font-size:.75em;color:#8E9A9D;margin-left:10px}
                .edited-admin-tag{background-color:#5cb85c;color:white;padding:3px 8px;border-radius:5px;font-size:.75em;font-weight:bold;vertical-align:middle}
                .admin-modal-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.75);display:none;justify-content:center;align-items:center;z-index:2000}
                .admin-custom-modal{background:#222a35;padding:30px;border-radius:15px;box-shadow:0 10px 30px rgba(0,0,0,.5);text-align:center;color:#f0f0f0;width:90%;max-width:480px;border:1px solid #445}
                .admin-custom-modal h3{color:#FFD700;margin-top:0;margin-bottom:15px;font-size:1.8em}
                .admin-custom-modal p{margin-bottom:25px;font-size:1.1em;line-height:1.6;color:#ccc;word-wrap:break-word}
                .admin-modal-buttons button{background-color:#007bff;color:white;border:none;padding:12px 22px;border-radius:8px;cursor:pointer;font-size:1em;margin:5px;transition:background-color .3s,transform .2s;font-weight:bold}
                .admin-modal-buttons button:hover{transform:translateY(-2px)}
                #adminModalOkButton:hover{background-color:#0056b3}
                #adminModalConfirmButton{background-color:#28a745}#adminModalConfirmButton:hover{background-color:#1e7e34}
                #adminModalCancelButton{background-color:#dc3545}#adminModalCancelButton:hover{background-color:#b02a37}
                @media (max-width:768px){h1{font-size:2.2em}.feedback-grid{grid-template-columns:1fr}.admin-header-controls{flex-direction:column;gap:10px;}}
            </style></head><body>
            <div class="admin-header-controls">
                <a href="/" class="main-panel-btn">← MAIN WEBSITE</a>
                <h1>NOBITA'S COMMAND CENTER</h1>
                <a href="/api/admin/logout" class="admin-logout-btn">LOGOUT ADMIN</a>
            </div><div class="feedback-grid">`;
        if (feedbacks.length === 0) {
            html += `<p style="text-align:center;color:#7F8C8D;font-size:1.2em;grid-column:1 / -1;">Abhi tak koi feedback nahi aaya hai!</p>`;
        } else {
            feedbacks.forEach(fb => {
                const fbNameInitial = (fb.name && fb.name.length > 0) ? fb.name.charAt(0).toUpperCase() : 'X';
                const googleUserTag = fb.googleId ? `<span class="google-user-tag">Google User</span>` : '';
                html += `
                    <div class="feedback-card" id="card-${fb._id}"><div class="feedback-card-inner">
                    <div class="feedback-card-front">
                        <div class="feedback-header">
                            <div class="feedback-avatar"><img src="${fb.avatarUrl || getDiceBearAvatarUrlServer(fb.name, fb._id.toString())}" alt="${fbNameInitial}"></div>
                            <div class="feedback-info"><h4>${fb.name} ${fb.isEdited ? '<span class="edited-admin-tag">EDITED</span>' : ''} ${googleUserTag}</h4><div class="rating">${'★'.repeat(fb.rating)}${'☆'.repeat(5-fb.rating)}</div><div class="user-ip">IP: ${fb.userIp||'N/A'} ${fb.googleId ? `| G-ID: ${fb.googleId.substring(0,10)}...`:''}</div></div>
                        </div>
                        <div class="feedback-body"><p>${fb.feedback.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p></div>
                        <div class="feedback-date">${fb.isEdited?'Last Edited':'Posted'}: ${new Date(fb.timestamp).toLocaleString()}${fb.isEdited && fb.originalContent?`<br><small>Original: ${new Date(fb.originalContent.timestamp).toLocaleString()}</small>`:''}</div>
                        <div class="action-buttons">
                            <button class="delete-btn" onclick="tryDeleteFeedback('${fb._id}')">DELETE</button>
                            ${!fb.googleId?`<button class="change-avatar-btn" onclick="tryChangeAvatar('${fb._id}','${fb.name}')">AVATAR</button>`:''}
                        </div>
                        <div class="reply-section">
                            <textarea id="reply-text-${fb._id}" placeholder="Admin reply..."></textarea>
                            <button class="reply-btn" onclick="tryPostReply('${fb._id}','reply-text-${fb._id}')">REPLY</button>
                            <div class="replies-display">${fb.replies && fb.replies.length > 0 ? '<h4>Replies:</h4>' : ''}${fb.replies.map(reply =>`<div class="single-reply"><img src="${nobitaAvatarUrl}" alt="Admin" class="admin-reply-avatar-sm"><div class="reply-content-wrapper"><span class="reply-admin-name">${reply.adminName}:</span> ${reply.text.replace(/</g, "&lt;").replace(/>/g, "&gt;")} <span class="reply-timestamp">(${new Date(reply.timestamp).toLocaleString()})</span></div></div>`).join('')}</div>
                        </div>
                        ${fb.isEdited && fb.originalContent?`<button class="flip-btn" onclick="flipCard('${fb._id}')">VIEW ORIGINAL</button>`:''}
                    </div>`;
                if(fb.isEdited && fb.originalContent){
                    html += `<div class="feedback-card-back">
                        <div class="feedback-header"><div class="feedback-avatar"><img src="${fb.originalContent.avatarUrl || getDiceBearAvatarUrlServer(fb.originalContent.name, fb._id.toString() + 'orig')}" alt="Original"></div><div class="feedback-info"><h4>ORIGINAL: ${fb.originalContent.name}</h4><div class="rating">${'★'.repeat(fb.originalContent.rating)}${'☆'.repeat(5-fb.originalContent.rating)}</div></div></div>
                        <div class="feedback-body"><p>${fb.originalContent.feedback.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p></div>
                        <div class="feedback-date">Originally Posted: ${new Date(fb.originalContent.timestamp).toLocaleString()}</div>
                        <div style="margin-top:auto;"><button class="flip-btn" onclick="flipCard('${fb._id}')">VIEW EDITED</button></div>
                    </div>`;
                }
                html += `</div></div>`;
            });
        }
        html += `</div>
        <div id="adminModalOverlay" class="admin-modal-overlay"><div class="admin-custom-modal"><h3 id="adminModalTitle"></h3><p id="adminModalMessage"></p><div class="admin-modal-buttons"><button id="adminModalOkButton">OK</button><button id="adminModalConfirmButton" style="display:none;">Confirm</button><button id="adminModalCancelButton" style="display:none;">Cancel</button></div></div></div>
        <script>
            const adminModalOverlay=document.getElementById('adminModalOverlay');const adminModalTitle=document.getElementById('adminModalTitle');const adminModalMessage=document.getElementById('adminModalMessage');const adminModalOkButton=document.getElementById('adminModalOkButton');const adminModalConfirmButton=document.getElementById('adminModalConfirmButton');const adminModalCancelButton=document.getElementById('adminModalCancelButton');let globalConfirmCallback=null;
            function showAdminModal(type,title,message,confirmCallbackFn=null){adminModalTitle.textContent=title;adminModalMessage.textContent=message;globalConfirmCallback=confirmCallbackFn;adminModalOkButton.style.display=type==='confirm'?'none':'inline-block';adminModalConfirmButton.style.display=type==='confirm'?'inline-block':'none';adminModalCancelButton.style.display=type==='confirm'?'inline-block':'none';adminModalOverlay.style.display='flex'}
            adminModalOkButton.addEventListener('click',()=>adminModalOverlay.style.display='none');adminModalConfirmButton.addEventListener('click',()=>{adminModalOverlay.style.display='none';if(globalConfirmCallback)globalConfirmCallback(true)});adminModalCancelButton.addEventListener('click',()=>{adminModalOverlay.style.display='none';if(globalConfirmCallback)globalConfirmCallback(false)});function flipCard(id){document.getElementById(\`card-\${id}\`).classList.toggle('is-flipped')}
            async function tryDeleteFeedback(id){showAdminModal('confirm','Delete Feedback?', 'Are you sure you want to delete this feedback? This cannot be undone.',async(confirmed)=>{if(confirmed){const res=await fetch(\`/api/admin/feedback/\${id}\`,{method:'DELETE'});if(res.ok){showAdminModal('alert','Deleted!','Feedback deleted successfully.');setTimeout(()=>location.reload(),1000)}else{const err=await res.json();showAdminModal('alert','Error!',\`Failed to delete: \${err.message}\`)}}})}
            async function tryPostReply(fbId,txtId){const replyText=document.getElementById(txtId).value.trim();if(!replyText){showAdminModal('alert','Empty Reply','Please write something to reply.');return}showAdminModal('confirm','Post Reply?',\`Confirm reply: "\${replyText.substring(0,50)}..."\`,async(confirmed)=>{if(confirmed){const res=await fetch(\`/api/admin/feedback/\${fbId}/reply\`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({replyText,adminName:'👉𝙉𝙊𝘽𝙄𝙏𝘼🤟'})});if(res.ok){showAdminModal('alert','Replied!','Reply posted.');setTimeout(()=>location.reload(),1000)}else{const err=await res.json();showAdminModal('alert','Error!',\`Failed to reply: \${err.message}\`)}}})}
            async function tryChangeAvatar(fbId,uName){showAdminModal('confirm','Change Avatar?',\`Change avatar for \${uName}? This will regenerate avatar for all non-Google feedbacks by this user.\`,async(confirmed)=>{if(confirmed){const res=await fetch(\`/api/admin/feedback/\${fbId}/change-avatar\`,{method:'PUT',headers:{'Content-Type':'application/json'}});if(res.ok){showAdminModal('alert','Avatar Changed!','Avatar updated.');setTimeout(()=>location.reload(),1000)}else{const err=await res.json();showAdminModal('alert','Error!',\`Failed to change avatar: \${err.message}\`)}}})}
        </script></body></html>`;
        res.send(html);
    } catch (error) {
        console.error('Admin panel generate karte waqt error:', error);
        res.status(500).send(`Admin panel mein kuch gadbad hai! Error: ${error.message}`);
    }
});

// --- Admin API Routes (Uses session auth) ---
app.delete('/api/admin/feedback/:id', checkAdminSession, async (req, res) => {
    try {
        const deletedFeedback = await Feedback.findByIdAndDelete(req.params.id);
        if (!deletedFeedback) return res.status(404).json({ message: 'Feedback ID mila nahi.' });
        res.status(200).json({ message: 'Feedback सफलतापूर्वक delete ho gaya.' });
    } catch (error) {
        res.status(500).json({ message: 'Feedback delete nahi ho paya.', error: error.message });
    }
});

app.post('/api/admin/feedback/:id/reply', checkAdminSession, async (req, res) => {
    const { replyText, adminName } = req.body;
    if (!replyText) return res.status(400).json({ message: 'Reply text toh daalo.' });
    try {
        const feedback = await Feedback.findById(req.params.id);
        if (!feedback) return res.status(404).json({ message: 'Feedback ID mila nahi.' });
        feedback.replies.push({ text: replyText, adminName: adminName || 'Admin', timestamp: new Date() });
        await feedback.save();
        res.status(200).json({ message: 'Reply सफलतापूर्वक post ho gaya.', reply: feedback.replies[feedback.replies.length - 1] });
    } catch (error) {
        res.status(500).json({ message: 'Reply save nahi ho paya.', error: error.message });
    }
});

app.put('/api/admin/feedback/:id/change-avatar', checkAdminSession, async (req, res) => {
    try {
        const feedbackToUpdate = await Feedback.findById(req.params.id);
        if (!feedbackToUpdate) return res.status(404).json({ message: 'Feedback ID mila nahi.' });
        if (feedbackToUpdate.googleId) return res.status(400).json({ message: 'Google user ka avatar yahaan se change nahi kar sakte.' });
        const userName = feedbackToUpdate.name;
        if (!userName) return res.status(400).json({ message: 'User ka naam nahi hai avatar generate karne ke liye.' });
        const newAvatarUrl = getDiceBearAvatarUrlServer(userName, Date.now().toString());
        await Feedback.updateMany({ name: userName, googleId: null }, { $set: { avatarUrl: newAvatarUrl } });
        res.status(200).json({ message: 'Avatar सफलतापूर्वक change ho gaya!', newAvatarUrl });
    } catch (error) {
        res.status(500).json({ message: 'Avatar change nahi ho paya.', error: error.message });
    }
});

// Main website index.html route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Nobita ka server port ${PORT} par chalu ho gaya hai: http://localhost:${PORT}`);
});
