// --- REQUIRED MODULES ---
const express = require('express');
const multer = require('multer'); // For handling file uploads
const path = require('path');    // For working with file paths
const fs = require('fs');        // For file system operations (like creating directories)

// --- EXPRESS APP INITIALIZATION ---
const app = express();
const PORT = process.env.PORT || 3000; // Render usually sets the PORT environment variable

// --- MIDDLEWARE ---
// Serve static files from the 'public' directory (HTML, CSS, client-side JS, images)
// __dirname is the directory where the current module (server.js) is located.
app.use(express.static(path.join(__dirname, 'public')));

// Middleware to parse JSON bodies (useful for other API routes you might add)
app.use(express.json());
// Middleware to parse URL-encoded bodies (useful for traditional form submissions)
app.use(express.urlencoded({ extended: true }));

// --- MULTER CONFIGURATION FOR AVATAR UPLOADS ---
// Define the path for avatar uploads within the 'public' folder, so they are web-accessible
const avatarUploadPath = path.join(__dirname, 'public', 'uploads', 'avatars');

// Ensure the upload directory exists, create it if it doesn't
// This is crucial for multer to save files without errors.
if (!fs.existsSync(avatarUploadPath)) {
    try {
        fs.mkdirSync(avatarUploadPath, { recursive: true }); // 'recursive: true' creates parent directories if they don't exist
        console.log(`SUCCESS: Upload directory created at ${avatarUploadPath}`);
    } catch (err) {
        console.error(`ERROR: Could not create upload directory at ${avatarUploadPath}. Please check permissions.`, err);
        // Optionally, you might want to exit if the upload directory can't be created
        // process.exit(1);
    }
}

// Configure how files are stored (destination and filename)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, avatarUploadPath); // Files will be saved in 'public/uploads/avatars/'
    },
    filename: function (req, file, cb) {
        // Create a unique filename to prevent overwriting: originalname-timestamp.extension
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = path.extname(file.originalname); // Get file extension
        cb(null, file.fieldname + '-' + uniqueSuffix + extension);
    }
});

// Filter to accept only image files
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) { // Check if MIME type is an image
        cb(null, true); // Accept file
    } else {
        cb(new Error('INVALID_FILE_TYPE: Not an image! Please upload only images (e.g., PNG, JPG).'), false); // Reject file
    }
};

// Initialize multer with the storage, file size limits, and file filter
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5 MB file size limit
    },
    fileFilter: fileFilter
});

// --- API ROUTES ---

// POST route for avatar upload
// Client-side JavaScript should make a POST request to '/api/upload-avatar'
// The file should be sent in a field named 'avatar' (matching 'upload.single('avatar')')
app.post('/api/upload-avatar', (req, res) => {
    // Use the 'upload.single('avatar')' middleware to handle the file upload
    upload.single('avatar')(req, res, function (err) {
        // --- Error Handling for Multer ---
        if (err instanceof multer.MulterError) {
            // A Multer error occurred (e.g., file too large, too many files)
            console.error('Multer Upload Error:', err.message);
            let friendlyMessage = `Upload error: ${err.message}.`;
            if (err.code === 'LIMIT_FILE_SIZE') {
                friendlyMessage = 'File is too large! Maximum size is 5MB.';
            }
            return res.status(400).json({ success: false, message: friendlyMessage });
        } else if (err) {
            // An unknown error occurred or an error from fileFilter
            console.error('Unknown Upload Error or Invalid File Type:', err.message);
            if (err.message && err.message.startsWith('INVALID_FILE_TYPE')) {
                 return res.status(400).json({ success: false, message: 'Invalid file type. Please upload images only (PNG, JPG, etc.).' });
            }
            return res.status(500).json({ success: false, message: `Server error during upload: ${err.message}` });
        }

        // --- Success Case ---
        if (!req.file) {
            // This case might happen if fileFilter rejected the file but didn't throw an error that multer caught above.
            console.warn('Upload attempt with no file or rejected file that did not error out earlier.');
            return res.status(400).json({ success: false, message: 'No file uploaded or file was rejected by filter.' });
        }

        // If file is uploaded successfully, req.file contains information about the file
        const avatarUrl = `/uploads/avatars/${req.file.filename}`; // Construct web-accessible URL path

        // IMPORTANT: In a real application, you would now save this 'avatarUrl'
        // to your database, associating it with the logged-in user.
        // For example: await updateUserProfileInDB(req.user.id, { avatarUrl: avatarUrl });

        res.status(200).json({
            success: true,
            message: 'Avatar uploaded successfully! BAM! 🚀',
            avatarUrl: avatarUrl // Send the URL back to the client
        });
    });
});

// --- BASIC HTML SERVING (Handled by express.static for '/') ---
// Your index.html from the public folder will be served at the root URL '/'
// If you need specific routes for other HTML pages:
// app.get('/reset-password-page', (req, res) => {
//    res.sendFile(path.join(__dirname, 'public', 'reset-password.html'));
// });


// --- WILDCARD ROUTE FOR CLIENT-SIDE ROUTING (Optional) ---
// If you have a Single Page Application (SPA) using client-side routing (e.g., React Router, Vue Router),
// this route will serve your index.html for any routes not matched above.
// This allows your client-side router to take over.
// app.get('*', (req, res) => {
//    res.sendFile(path.join(__dirname, 'public', 'index.html'));
// });


// --- START THE SERVER ---
app.listen(PORT, () => {
    console.log(`======================================================`);
    console.log(`🚀 SERVER IS UP AND BLASTING ON PORT ${PORT}!! 🔥`);
    console.log(`🎮 Feedback Website Accessible at: http://localhost:${PORT}`);
    console.log(`📂 Static files served from: ${path.join(__dirname, 'public')}`);
    console.log(`📸 Avatars will be uploaded to: ${avatarUploadPath}`);
    console.log(`======================================================`);
});
