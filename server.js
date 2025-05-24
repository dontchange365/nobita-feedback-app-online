// server.js

// .env file se environment variables load karta hai (jaise MONGODB_URI, PORT, PHONE_IP).
// Ye secret details ko code se alag rakhta hai.
require('dotenv').config(); 

const express = require('express');   // Express.js framework import kiya server banane ke liye
const mongoose = require('mongoose'); // Mongoose import kiya MongoDB se interact karne ke liye
const cors = require('cors');         // CORS import kiya cross-origin requests allow karne ke liye (bahut zaroori hai jab frontend aur backend alag alag jagah se aa rahe hon)

const app = express(); // Express app instance banaya
// Server ka port define kiya. Agar .env mein PORT set hai, toh woh use hoga, nahi toh 3000.
const PORT = process.env.PORT || 3000; 

// --- Middleware Setup ---
// Ye functions hain jo har incoming request pe chalte hain.
app.use(cors()); // CORS enable kiya. Ye har origin se requests ko allow karta hai. Production mein isko restrict karte hain.
app.use(express.json()); // Ye server ko JSON format mein aane wale request bodies ko parse karne ki permission deta hai.

// Static files serve karna: 'public' folder ke andar jo bhi files (jaise index.html, CSS, client-side JS) hain,
// unko web browser ke liye available banata hai. Jab koi root URL (/) request karega,
// toh server public/index.html bhej dega.
app.use(express.static('public'));

// --- MongoDB Connection ---
// MongoDB connection string .env file se liya. Ye tera database access karne ki chabhi hai.
const mongoURI = process.env.MONGODB_URI; 

// Agar MongoDB URI .env file mein nahi mili, toh error throw karo aur server band kar do.
if (!mongoURI) {
    console.error('FATAL ERROR: MONGODB_URI environment variable .env file mein nahi mili!');
    process.exit(1); // Server ko exit kar do
}

// Mongoose ko MongoDB se connect karo.
mongoose.connect(mongoURI)
.then(() => console.log('✅ MONGODB SE SAFALTA-POORVAK JUD GAYA! KAMAAL KAR DIYA!'))
.catch(err => console.error('❌ MONGODB SE JUDNE MEIN GHANTA LAGA! ERROR: ', err));

// --- MongoDB Schema aur Model ---
// Feedback data ka structure define karte hain.
// 'name', 'feedback' string honge aur required hain.
// 'rating' number hoga, 1 se 5 ke beech, aur required hai.
// 'date' automatically current date time lega.
const feedbackSchema = new mongoose.Schema({
    name: { type: String, required: true },
    feedback: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 }, 
    date: { type: Date, default: Date.now } 
});

// 'Feedback' naam ka Mongoose Model banaya 'feedbackSchema' ka use karke.
// Ye model database mein 'feedbacks' collection se interact karega.
const Feedback = mongoose.model('Feedback', feedbackSchema);

// --- API Routes ---

// 1. Naya feedback submit karne ke liye route (POST request)
// Jab client (teri website) '/api/feedback' par POST request bhejega, toh ye code chalega.
app.post('/api/feedback', async (req, res) => {
    console.log('NAYA FEEDBACK SERVER PAR PAHUNCH GAYA:', req.body); // Console pe incoming data dikhao

    // Request body se name, feedback, aur rating nikalo.
    const { name, feedback, rating } = req.body;

    // Input validation: Agar koi bhi field missing hai, toh 400 Bad Request error bhej do.
    if (!name || !feedback || !rating) {
        return res.status(400).json({ message: 'BHAI, SAARI FIELDS BHARNA ZAROORI HAI: NAAM, FEEDBACK AUR RATING!' });
    }

    try {
        // Naya Feedback document banao Mongoose model ka use karke.
        const newFeedback = new Feedback({ name, feedback, rating });
        await newFeedback.save(); // Is feedback ko database mein save karo.

        // Agar feedback successfully save ho gaya, toh 201 Created status aur success message bhej do.
        res.status(201).json({ message: 'FEEDBACK SAFALTA-POORVAK JAMA KIYA GAYA!', feedback: newFeedback });
    } catch (error) {
        // Agar database save karte waqt koi error aaya, toh 500 Internal Server Error bhej do.
        console.error('SERVER PE FEEDBACK SAVE KARNE MEIN FATAL ERROR AAYA:', error);
        res.status(500).json({ message: 'SERVER KI GADBAD: FEEDBACK SAVE NAHI HO PAYA.', error: error.message });
    }
});

// 2. Saare feedbacks fetch karne ke liye route (GET request)
// Jab client (teri website) '/api/feedbacks' par GET request bhejega, toh ye code chalega.
app.get('/api/feedbacks', async (req, res) => {
    try {
        // Database se saare feedbacks nikalo, aur unko latest date ke hisaab se sort karo (-1 descending order hai).
        const feedbacks = await Feedback.find().sort({ date: -1 }); 
        // Feedbacks ko JSON format mein client ko bhej do (200 OK status ke saath).
        res.status(200).json(feedbacks);
    } catch (error) {
        // Agar feedbacks fetch karte waqt koi error aaya, toh 500 Internal Server Error bhej do.
        console.error('SERVER PE FEEDBACKS FETCH KARNE MEIN FATAL ERROR AAYA:', error);
        res.status(500).json({ message: 'SERVER KI GADBAD: FEEDBACKS FETCH NAHI HO PAYE.', error: error.message });
    }
});

// --- Server Start Karo ---
// Server ko defined PORT par sunna shuru karo. Jab server start ho jaye, toh callback function chalega.
app.listen(PORT, () => {
    console.log(`🚀 SERVER CHALU HAI PORT ${PORT} PAR! AB WEBSITE KO BHI JALA DE!`);
    // Ye URLs hain jahan se tu apni website access kar sakta hai.
    // process.env.PHONE_IP .env file se aayega.
    console.log(`🌐 BROWSER MEIN YE KHOL: http://localhost:${PORT} YA PHIR YE: http://${process.env.PHONE_IP || 'TERA_ACTUAL_IP_YA_RENDER_URL'}:${PORT}`);
});