require('dotenv').config(); // Load environment variables first
const express = require('express');
const cors = require('cors');
const fileUpload = require('express-fileupload'); // For handling file uploads
const connectDB = require('./config/db');
const cloudinaryConfig = require('./config/cloudinary'); // To ensure cloudinary is configured
const errorHandler = require('./middleware/errorHandler');

// Route Imports
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const feedbackRoutes = require('./routes/feedbackRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

// Connect to Database
connectDB();

// Cloudinary Configuration (initializes cloudinary.config())
cloudinaryConfig();

// Middleware
app.use(express.json()); // Body parser for JSON
app.use(fileUpload({
    useTempFiles: true, // Use temp files for file uploads
    tempFileDir: '/tmp/' // Directory for temp files (important for Render)
}));

// CORS Configuration
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'; // Fallback for local dev
app.use(cors({
    origin: frontendUrl,
    credentials: true
}));


// Basic route for testing
app.get('/', (req, res) => {
    res.send('Nobi Bot Backend is running!');
});

// Route Mounts
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/admin', adminRoutes);

// Error Handling Middleware (must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

