const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const path = require('path');
const cookieParser = require('cookie-parser'); // For JWT in cookies if desired

// Load environment variables (from Render directly, no .env file needed as per instruction)
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID; // For OAuth2
const FRONTEND_URL = process.env.FRONTEND_URL;

// Import routes
const authRoutes = require('./routes/auth');
const feedbackRoutes = require('./routes/feedback');
const userRoutes = require('./routes/user');
const adminRoutes = require('./routes/admin'); // For admin-specific actions

const app = express();

// Middleware
app.use(cors({
    origin: FRONTEND_URL, // Allow only your frontend to access
    credentials: true // Allow cookies/headers to be sent
}));
app.use(express.json()); // For parsing application/json
app.use(express.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded
app.use(cookieParser()); // If using cookies for JWT

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, '../public')));

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
    .then(() => console.log('MongoDB Connected Successfully'))
    .catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes); // Protected admin routes

// Google OAuth Callback Route (This needs to be handled carefully with your frontend)
// This is a simplified example. A full OAuth flow involves state and token exchange.
app.get('/api/auth/google/callback', async (req, res) => {
    // This is a direct redirect from Google. Your Google console should point to this URL.
    // In a real app, you'd exchange the code for a token and then get user info.
    // For this demonstration, we'll assume the frontend receives params from the server
    // after successful backend processing.
    // The instructions say environment variables are configured in Render,
    // so a server-side OAuth flow is implied.
    try {
        // Here you would typically:
        // 1. Get the 'code' from req.query
        // 2. Exchange 'code' for access_token and id_token with Google's OAuth endpoint
        // 3. Decode id_token to get user info (email, name, picture)
        // 4. Find or create user in your DB
        // 5. Generate your own JWT token for the user
        // 6. Redirect to frontend with your JWT and user info

        // Placeholder for a simple, direct token pass for demo purposes
        // Assuming your Google strategy on the backend issues tokens and redirects
        const { token, userName, userAvatar, userId, isAdmin } = req.query; // These would be passed by your Google Auth strategy

        if (token && userName) {
            // Redirect to frontend with token in URL parameters
            // Frontend will then store this token in localStorage
            return res.redirect(`${FRONTEND_URL}?token=${token}&userName=${encodeURIComponent(userName)}&userAvatar=${encodeURIComponent(userAvatar || '')}&userId=${userId}&isAdmin=${isAdmin}`);
        } else {
            return res.redirect(`${FRONTEND_URL}?error=google_auth_failed`);
        }

    } catch (error) {
        console.error("Google OAuth callback error:", error);
        return res.redirect(`${FRONTEND_URL}?error=google_auth_failed`);
    }
});


// Error Handling Middleware (Keep at the end)
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.statusCode || 500).json({
        message: err.message || 'Something went wrong!',
        status: err.statusCode || 500
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
