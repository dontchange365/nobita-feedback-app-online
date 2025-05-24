// server.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv'); // Environment variables ke liye
const path = require('path'); // ***** YEH LINE MISSING THI! AB ADD KI HAI! *****

// .env file se variables load karega (agar deployment pe use karna hai)
dotenv.config();

const app = express();
// Process.env.PORT Render jaise hosting platforms provide karte hain
// Warna local pe 3000 port use hoga
const PORT = process.env.PORT || 3000;

// ****** MongoDB Connection String ******
// IMPORTANT: PRODUCTION MEIN YE .env FILE SE AANA CHAHIYE!
// Yahan hardcoded hai, par Render par hum isko Environment Variable mein set karenge.
const MONGODB_URI = process.env.MONGO_URI || 'mongodb+srv://dontchange365:DtUiOMFzQVM0tG9l@nobifeedback.9ntuipc.mongodb.net/?retryWrites=true&w=majority&appName=nobifeedback';

// ****** Admin Credentials (SECURITY ALERT!) ******
// BAHUT ZAROORI: REAL PRODUCTION MEIN INKO HARDCODE MAT KARNA!
// Render par inko Environment Variables (ADMIN_USERNAME, ADMIN_PASSWORD) mein set karna hoga.
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'samshaad365'; // TERA ADMIN USERNAME
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'shizuka123'; // TERA ADMIN PASSWORD

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => console.log('MONGODB SE CONNECTION SAFAL! DATABASE AB READY HAI!'))
  .catch(err => console.error('MONGODB CONNECTION MEIN LOHDA LAG GAYA:', err));

// Define a Schema for Feedback
const feedbackSchema = new mongoose.Schema({
  name: { type: String, required: true },
  feedback: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  timestamp: { type: Date, default: Date.now }
});

// Create a Model from the Schema
const Feedback = mongoose.model('Feedback', feedbackSchema);

// Middleware
// CORS ko update kiya hai takki Admin Panel bhi access kar sake
app.use(cors({
    origin: ['https://nobita-feedback-app-online.onrender.com', 'http://localhost:3000', 'YOUR_ADMIN_PANEL_URL_HERE'], // Yahan apni admin panel ka URL dalna agar alag hosting pe hai
    methods: ['GET', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Middleware for Admin Authentication
const authenticateAdmin = (req, res, next) => {
    // Basic Auth: Authorization header se username/password check kar
    // Production me JWT token use karte hain. Abhi ke liye simple rakha hai.
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ message: 'UNAUTHORIZED: AUTHORIZATION HEADER MISSING.' });
    }

    const [scheme, credentials] = authHeader.split(' '); // Expected format: Basic <base64_credentials>

    if (scheme !== 'Basic' || !credentials) {
        return res.status(401).json({ message: 'UNAUTHORIZED: INVALID AUTHORIZATION SCHEME.' });
    }

    const [username, password] = Buffer.from(credentials, 'base64').toString().split(':');

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        next(); // Admin hai, aage badho
    } else {
        res.status(401).json({ message: 'UNAUTHORIZED: SAHI ADMIN CREDENTIALS NAHI HAIN, BHAI!' });
    }
};

// ***** YEH HAI WOH JAADUI LINE! *****
// Serve static files from the 'public' directory, aur root '/' par 'index.html' ko serve kar
app.use(express.static(path.join(__dirname, 'public'), { index: 'index.html' }));


// API Endpoint to get all feedbacks (Fetch from DB)
app.get('/api/feedbacks', async (req, res) => {
    try {
        const allFeedbacks = await Feedback.find().sort({ timestamp: -1 }); // Get latest first
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

        await newFeedback.save(); // Save to MongoDB

        console.log('NAYA FEEDBACK DATABASE MEIN SAVE HUA HAI:', newFeedback);
        res.status(201).json({ message: 'FEEDBACK SAFALTA-POORVAK JAMA KIYA GAYA AUR SAVE HUA!', feedback: newFeedback });
    } catch (error) {
        console.error('FEEDBACK DATABASE MEIN SAVE KARTE WAQT ERROR AAYA:', error);
        res.status(500).json({ message: 'FEEDBACK DATABASE MEIN SAVE NAHI HO PAYA.', error: error.message });
    }
});

// ****** NEW ADMIN DELETE API ENDPOINT ******
// Is endpoint ko hit karne ke liye 'authenticateAdmin' middleware chalega pehle
app.delete('/api/admin/feedback/:id', authenticateAdmin, async (req, res) => {
    const feedbackId = req.params.id; // URL se ID lega (e.g., /api/admin/feedback/60d0fe4a1234567890abcdef)

    try {
        // Mongoose se ID ke through delete karna
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


// Start the server
app.listen(PORT, () => {
    console.log(`SERVER CHALU HO GAYA HAI PORT ${PORT} PAR: http://localhost:${PORT}`);
    console.log('AB FRONTEND SE API CALL KAR SAKTE HAIN!');
});
