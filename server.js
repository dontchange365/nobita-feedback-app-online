// server.js

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Add these two lines to create and use an http server
const { createServer } = require('http');
const { Server } = require('socket.io');

require('./config/environment');
require('./config/database');

const app = express();
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
    // Add the io instance to the request object so it's accessible in all routes
    req.io = io;
    next();
});

// Admin panel pages need to be served from a specific directory.
// Let's create a new static route for just the admin panel assets
// This will allow us to protect the main HTML file with middleware.
app.use('/admin-panel-src', express.static(path.join(__dirname, 'admin-panel')));
app.use(express.static(__dirname));

const authRoutes = require('./routes/auth');
const feedbackRoutes = require('./routes/feedback');
const adminRoutes = require('./routes/admin');
const fileManagerRoutes = require('./routes/fileManager');
const { authenticateAdminToken } = require('./middleware/auth');

app.use('/', authRoutes);
app.use('/', feedbackRoutes);
app.use('/', adminRoutes);
app.use('/', fileManagerRoutes);

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
app.get('/admin-panel', authenticateAdminToken, (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-panel', 'index.html'));
});

// NEW ROUTE: Protect the file manager's main HTML page
app.get('/admin-panel/file-manager.html', authenticateAdminToken, (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-panel', 'file-manager.html'));
});

app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
        res.status(404).json({message: "API endpoint not found."});
    } else {
        res.sendFile(path.join(__dirname, 'public', req.path));
    }
});

// Change from app.listen to server.listen
server.listen(PORT, () => {
    console.log(`🚀 Nobita's server with File Manager is running on port ${PORT}: http://localhost:${PORT}`);
});