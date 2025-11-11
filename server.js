// server.js

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
// --- RATE LIMITING & SCHEDULER IMPORTS ---
const rateLimit = require('express-rate-limit'); 
const { startScheduler } = require('./scheduler/ai_responder'); 
// --- RATE LIMITING & SCHEDULER IMPORTS ---
// --- NEW: Visit Model Import ---
const { Visit } = require('./config/database');
// --- END NEW IMPORT ---

// Add these two lines to create and use an http server
const { createServer } = require('http');
const { Server } = require('socket.io');

require('./config/environment');
require('./config/database');

const app = express();
// --- FIX: TRUST PROXY HEADERS START ---
// YEH LINE 'X-Forwarded-For' ERROR KO THEEK KAREGI TAAKI RATE LIMITING SAHI KAAM KARE.
app.set('trust proxy', 1); // FIX: true se 1 kiya taaki rate limit bypass na ho
// --- FIX: TRUST PROXY HEADERS END ---

const PORT = process.env.PORT || 3000;

// Create an HTTP server and pass the Express app to it
const server = createServer(app);

// Initialize Socket.IO with the server
const io = new Server(server, {
    cors: {
        origin: [process.env.FRONTEND_URL, `http://localhost:${PORT}`, `http://localhost:3001`],
        methods: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }
});

// Store the Socket.IO instance on the Express app
app.io = io;

app.use(cors({
    origin: [process.env.FRONTEND_URL, `http://localhost:${PORT}`, `http://localhost:3001`],
    methods: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH'],
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
    req.io = io;
    next();
});

// --- NEW ANALYTICS MIDDLEWARE ---
app.use(async (req, res, next) => {
    // Only track public visits, exclude API calls and static files
    if (req.path.startsWith('/api/') || req.path.includes('.') || req.path.startsWith('/admin-panel')) {
        return next();
    }
    
    // Log the visit to the database
    if (req.clientIp && req.clientIp !== 'UNKNOWN_IP') {
        try {
            await Visit.create({ 
                timestamp: Date.now(), 
                ipAddress: req.clientIp 
            });
        } catch (e) {
            console.error("Error logging visit:", e.message);
        }
    }
    next();
});
// --- END NEW ANALYTICS MIDDLEWARE ---


// --- RATE LIMITING MIDDLEWARE START ---
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per windowMs
    message: "Too many requests from this IP, please try again after 15 minutes."
});

const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 60 minutes
    max: 10, // 10 requests per hour
    message: "Too many authentication attempts from this IP, please try again after an hour."
});

const feedbackLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30, // 30 submissions per IP every 15 minutes
    message: "Too many feedback submissions from this IP, please wait a while."
});

app.locals.apiLimiter = apiLimiter;
app.locals.authLimiter = authLimiter;
app.locals.feedbackLimiter = feedbackLimiter;

// Apply the general API limiter to all requests starting with /api/
app.use('/api/', apiLimiter); 
// --- RATE LIMITING MIDDLEWARE END ---


// Serve admin panel static files properly
app.use('/admin-panel', express.static(path.join(__dirname, 'admin-panel')));

// Serve frontend static files properly
app.use(express.static(path.join(__dirname, 'public')));

const authRoutes = require('./routes/auth');
const feedbackRoutes = require('./routes/feedback');
const adminRoutes = require('./routes/admin');
const fileManagerRoutes = require('./routes/fileManager');
const avatarRoutes = require('./routes/avatars'); // New import for avatar routes
const { authenticateAdminToken } = require('./middleware/auth');

app.use('/', authRoutes);
app.use('/', feedbackRoutes);
app.use('/', adminRoutes);
app.use('/', fileManagerRoutes);
app.use('/', avatarRoutes); // Use the new avatar router

app.get('/:page', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.endsWith('.js') || req.path.endsWith('.css') || req.path.endsWith('.ico') || req.path.endsWith('.png') || req.path.endsWith('.svg')) return next();
    const file = path.join(__dirname, 'public', `${req.params.page}.html`);
    fs.access(file, (err) => {
        if (err) return next();
        res.sendFile(file);
    });
});

app.get(['/index', '/index.html'], (req, res) => { res.redirect(301, '/'); });
app.get('/admin-login.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'admin-login.html')); });

// NEW ROUTE: Protect the admin panel's main HTML page
app.get('/admin-panel/index.html', authenticateAdminToken, (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-panel', 'index.html'));
});

// NEW ROUTE: Protect the file manager's main HTML page
app.get('/admin-panel/file-manager.html', authenticateAdminToken, (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-panel', 'file-manager.html'));
});

// NEW ROUTE: Protect the avatar uploader page
app.get('/admin-panel/upload-avatars.html', authenticateAdminToken, (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-panel', 'upload-avatars.html'));
});

// Catch-all route to serve index.html for frontend SPA
app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
        res.status(404).json({ message: "API endpoint not found." });
    } else if (req.path.startsWith('/admin-panel')) {
        // serve admin-panel index.html if someone hits /admin-panel directly
        res.sendFile(path.join(__dirname, 'admin-panel', 'index.html'));
    } else {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
});

// Start server with 0.0.0.0 bind for RDP/local access
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Nobita's server with File Manager is running on port ${PORT}: http://localhost:${PORT}`);
    // --- SCHEDULER START ---
    // Start the AI scheduler once the server is listening
    startScheduler(io); 
    // --- SCHEDULER END ---
});