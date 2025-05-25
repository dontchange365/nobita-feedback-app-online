// server.js const express = require('express'); const bodyParser = require('body-parser'); const cors = require('cors'); const mongoose = require('mongoose'); const dotenv = require('dotenv'); const path = require('path'); const fetch = require('node-fetch');  // npm install node-fetch@2

dotenv.config();

const app = express(); const PORT = process.env.PORT || 3000; const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://dontchange365:DtUiOMFzQVM0tG9l@nobifeedback.9ntuipc.mongodb.net/?retryWrites=true&w=majority&appName=nobifeedback';

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'samshaad365'; const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'shizuka123';

// Connect to MongoDB tmongoose.connect(MONGODB_URI) .then(() => console.log('✅ Connected to MongoDB')) .catch(err => console.error('❌ MongoDB connection error:', err));

// Define Feedback schema and model const feedbackSchema = new mongoose.Schema({ name:       { type: String, required: true }, feedback:   { type: String, required: true }, rating:     { type: Number, required: true, min: 1, max: 5 }, timestamp:  { type: Date, default: Date.now }, avatarUrl:  { type: String, required: true }, replies: [{ text:      { type: String, required: true }, timestamp: { type: Date, default: Date.now }, adminName: { type: String, default: 'Admin' } }] }); const Feedback = mongoose.model('Feedback', feedbackSchema);

// Middleware app.use(cors({ origin: ['https://nobita-feedback-app-online.onrender.com', 'http://localhost:3000'], methods: ['GET','POST','DELETE','PUT'], allowedHeaders: ['Content-Type','Authorization'] })); app.use(bodyParser.json()); app.use(express.static(path.join(__dirname, 'public'), { index: 'index.html' }));

// Admin authentication middleware const authenticateAdmin = (req, res, next) => { const authHeader = req.headers.authorization; if (!authHeader) { res.set('WWW-Authenticate','Basic realm="Admin Area"'); return res.status(401).json({ message: 'AUTH HEADER MISSING' }); } const [scheme, creds] = authHeader.split(' '); if (scheme !== 'Basic' || !creds) { res.set('WWW-Authenticate','Basic realm="Admin Area"'); return res.status(401).json({ message: 'INVALID AUTH SCHEME' }); } const [user, pass] = Buffer.from(creds, 'base64').toString().split(':'); if (user === ADMIN_USERNAME && pass === ADMIN_PASSWORD) { return next(); } res.set('WWW-Authenticate','Basic realm="Admin Area"'); return res.status(401).json({ message: 'BAD CREDENTIALS' }); };

// Fetch all feedbacks\ app.get('/api/feedbacks', async (req, res) => { try { const feedbacks = await Feedback.find().sort({ timestamp: -1 }); res.status(200).json(feedbacks); } catch (err) { console.error('FETCH ERROR:', err); res.status(500).json({ message: 'COULD NOT FETCH FEEDBACKS', error: err.message }); } });

// Submit feedback + AI avatar via nekos.best app.post('/api/feedback', async (req, res) => { const { name, feedback, rating } = req.body; if (!name || !feedback || !rating || rating === '0') { return res.status(400).json({ message: 'NAME, FEEDBACK & RATING REQUIRED' }); } try { const upper = name.toUpperCase(); let existing = await Feedback.findOne({ name: upper }); let avatarUrl; if (existing && existing.avatarUrl) { avatarUrl = existing.avatarUrl; } else { const apiRes = await fetch('https://nekos.best/api/v2/neko'); const json = await apiRes.json(); avatarUrl = json.results[0].url; } const newFb = new Feedback({ name: upper, feedback, rating: parseInt(rating, 10), avatarUrl }); await newFb.save(); res.status(201).json({ message: 'FEEDBACK & AVATAR SAVED', feedback: newFb }); } catch (err) { console.error('SAVE ERROR:', err); res.status(500).json({ message: 'SERVER ERROR', error: err.message }); } });

// Admin panel route app.get('/admin-panel-nobita', authenticateAdmin, async (req, res) => { try { const feedbacks = await Feedback.find().sort({ timestamp: -1 }); const creds = Buffer.from(${ADMIN_USERNAME}:${ADMIN_PASSWORD}).toString('base64'); const authVal = Basic ${creds};

let html = `<!DOCTYPE html><html lang="en"><head>... your admin panel HTML ...</head><body>...`;
// (Paste your full admin-panel HTML here, including scripts for delete, reply, changeAvatar)
res.send(html);

} catch (err) { console.error('ADMIN PANEL ERROR:', err); res.status(500).send(ERROR LOADING ADMIN PANEL: ${err.message}); } });

// Admin DELETE feedback\app.delete('/api/admin/feedback/:id', authenticateAdmin, async (req, res) => { try { const deleted = await Feedback.findByIdAndDelete(req.params.id); if (!deleted) return res.status(404).json({ message: 'FEEDBACK NOT FOUND' }); res.json({ message: 'DELETED', feedback: deleted }); } catch (err) { res.status(500).json({ message: 'DELETE FAILED', error: err.message }); } });

// Admin reply\ app.post('/api/admin/feedback/:id/reply', authenticateAdmin, async (req, res) => { const { replyText, adminName } = req.body; if (!replyText) return res.status(400).json({ message: 'REPLY TEXT REQUIRED' }); try { const fb = await Feedback.findById(req.params.id); if (!fb) return res.status(404).json({ message: 'FEEDBACK NOT FOUND' }); fb.replies.push({ text: replyText, adminName: adminName || 'Admin' }); await fb.save(); res.json({ message: 'REPLY SAVED', reply: fb.replies.slice(-1)[0] }); } catch (err) { res.status(500).json({ message: 'REPLY FAILED', error: err.message }); } });

// Admin change avatar\ app.put('/api/admin/feedback/:id/change-avatar', authenticateAdmin, async (req, res) => { try { const fb = await Feedback.findById(req.params.id); if (!fb) return res.status(404).json({ message: 'FEEDBACK NOT FOUND' }); const apiRes = await fetch('https://nekos.best/api/v2/neko'); const json = await apiRes.json(); const newUrl = json.results[0].url; await Feedback.updateMany({ name: fb.name }, { $set: { avatarUrl: newUrl } }); res.json({ message: 'AVATAR UPDATED', newAvatarUrl: newUrl }); } catch (err) { res.status(500).json({ message: 'AVATAR CHANGE FAILED', error: err.message }); } });

// Start server app.listen(PORT, () => { console.log(Server running on port ${PORT}); });

