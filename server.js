// server.js - CLEANED AND ORGANIZED VERSION
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

require('./config/environment');
require('./config/database');

const app = express();
const PORT = process.env.PORT || 3000;

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
    next();
});

app.use(express.static(__dirname));

const authRoutes = require('./routes/auth');
const feedbackRoutes = require('./routes/feedback');
const adminRoutes = require('./routes/admin');
const fileManagerRoutes = require('./routes/fileManager');

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
app.get('/admin-panel', (req, res) => { res.sendFile(path.join(__dirname, 'admin-panel', 'index.html')); });
app.get('/admin-login.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'admin-login.html')); });

app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
        res.status(404).json({message: "API endpoint not found."});
    } else {
        res.sendFile(path.join(__dirname, 'public', req.path));
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Nobita's server with File Manager is running on port ${PORT}: http://localhost:${PORT}`);
});
