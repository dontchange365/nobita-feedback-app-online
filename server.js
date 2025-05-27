const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises; // Use promises version of fs
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');
const bcrypt = require('bcrypt');

const app = express();
const port = process.env.PORT || 3000;

// --- Database Setup ---
const db = new sqlite3.Database('feedback.db', (err) => {
    if (err) {
        console.error("Could not connect to database", err);
        process.exit(1);
    } else {
        console.log("Connected to database");
        db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password TEXT NOT NULL,
                avatar TEXT,
                authType TEXT DEFAULT 'email'
            )
        `);
        db.run(`
            CREATE TABLE IF NOT EXISTS feedbacks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId INTEGER NOT NULL,
                name TEXT NOT NULL,
                feedback TEXT NOT NULL,
                rating INTEGER NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                edited BOOLEAN DEFAULT 0,
                FOREIGN KEY (userId) REFERENCES users(id)
            )
        `);
    }
});

// --- Multer Setup for Avatar Uploads ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'public', 'uploads');
        fs.mkdir(uploadDir, { recursive: true }) // Ensure directory exists
          .then(() => cb(null, uploadDir))
          .catch(err => cb(err));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});

const upload = multer({ storage: storage });

// --- Express Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'your-secret-key', // Replace with a strong, random secret
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 30 * 60 * 1000 // Session expires after 30 minutes of inactivity
    }
}));

// --- Authentication Middleware ---
function isAuthenticated(req, res, next) {
    if (req.session.userId) {
        next();
    } else {
        res.status(401).json({ success: false, message: 'Unauthorized' });
    }
}

// --- Routes ---

// Serve reset-password.html
app.get('/reset-password', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'reset-password.html'));
});

// Avatar Upload Endpoint
app.post('/upload-avatar', isAuthenticated, upload.single('avatar'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const avatarUrl = `/uploads/${req.file.filename}`;
    db.run('UPDATE users SET avatar = ? WHERE id = ?', [avatarUrl, req.session.userId], (err) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ success: false, message: 'Failed to update avatar.', error: err.message });
        }
        res.json({ success: true, avatarUrl: avatarUrl });
    });
});

// User Registration Endpoint
app.post('/signup', (req, res) => {
    const { name, email, password } = req.body;
    bcrypt.hash(password, 10, (err, hashedPassword) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ success: false, message: 'Failed to hash password.' });
        }
        db.run('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', [name, email, hashedPassword], function(err) {
            if (err) {
                console.error(err);
                if (err.errno === 19) { // SQLITE_CONSTRAINT, likely email already exists
                    return res.status(409).json({ success: false, message: 'Email already exists.' });
                }
                return res.status(500).json({ success: false, message: 'Failed to register user.' });
            }
            req.session.userId = this.lastID;
            res.json({ success: true, message: 'Registration successful.' });
        });
    });
});

// User Login Endpoint
app.post('/login', (req, res) => {
    const { email, password } = req.body;
    db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ success: false, message: 'Login failed.' });
        }
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }
        bcrypt.compare(password, user.password, (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ success: false, message: 'Login failed.' });
            }
            if (result) {
                req.session.userId = user.id;
                res.json({ success: true, message: 'Login successful.' });
            } else {
                res.status(401).json({ success: false, message: 'Invalid credentials.' });
            }
        });
    });
});

// User Logout Endpoint
app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error(err);
            return res.status(500).json({ success: false, message: 'Logout failed.' });
        }
        res.json({ success: true, message: 'Logout successful.' });
    });
});

// Get User Data Endpoint
app.get('/user', isAuthenticated, (req, res) => {
    db.get('SELECT id, name, email, avatar FROM users WHERE id = ?', [req.session.userId], (err, user) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ success: false, message: 'Failed to retrieve user data.' });
        }
        if (!user) {
             return res.status(404).json({ success: false, message: 'User not found.' });
        }
        res.json({ success: true, user: user });
    });
});

// Update User Profile Endpoint
app.post('/update-profile', isAuthenticated, upload.single('avatar'), (req, res) => {
    const { name } = req.body;
    let avatarUrl = null;
    if (req.file) {
        avatarUrl = `/uploads/${req.file.filename}`;
    }

    let query = 'UPDATE users SET name = ?';
    let params = [name];
    if (avatarUrl) {
        query += ', avatar = ?';
        params.push(avatarUrl);
    }
    query += ' WHERE id = ?';
    params.push(req.session.userId);

    db.run(query, params, (err) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ success: false, message: 'Failed to update profile.', error: err.message });
        }
        res.json({ success: true, message: 'Profile updated successfully.' });
    });
});

// Change Password Endpoint
app.post('/change-password', isAuthenticated, (req, res) => {
    const { currentPassword, newPassword } = req.body;
    db.get('SELECT password FROM users WHERE id = ?', [req.session.userId], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ success: false, message: 'Failed to change password.' });
        }
        if (!result) {
            return res.status(400).json({ success: false, message: 'User not found.' });
        }
        bcrypt.compare(currentPassword, result.password, (err, match) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ success: false, message: 'Failed to compare passwords.' });
            }
            if (!match) {
                return res.status(401).json({ success: false, message: 'Incorrect current password.' });
            }
            bcrypt.hash(newPassword, 10, (err, hashedPassword) => {
                if (err) {
                    console.error(err);
                    return res.status(500).json({ success: false, message: 'Failed to hash new password.' });
                }
                db.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, req.session.userId], (err) => {
                    if (err) {
                        console.error(err);
                        return res.status(500).json({ success: false, message: 'Failed to update password.' });
                    }
                    res.json({ success: true, message: 'Password changed successfully.' });
                });
            });
        });
    });
});

// Submit Feedback Endpoint
app.post('/submit-feedback', (req, res) => {
    const { name, feedback, rating } = req.body;
    const userId = req.session.userId || null; // Use null for guest users

    db.run('INSERT INTO feedbacks (userId, name, feedback, rating) VALUES (?, ?, ?, ?)', [userId, name, feedback, rating], function(err) {
        if (err) {
            console.error(err);
            return res.status(500).json({ success: false, message: 'Failed to submit feedback.' });
        }
        // Fetch the newly inserted feedback with user details for response
        db.get('SELECT feedbacks.*, users.name AS userName, users.avatar AS userAvatar, users.authType AS userAuthType FROM feedbacks LEFT JOIN users ON feedbacks.userId = users.id WHERE feedbacks.id = ?', [this.lastID], (err, feedback) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ success: false, message: 'Failed to retrieve feedback data.' });
            }

            // Structure the response to match what the client expects
            const formattedFeedback = {
                id: feedback.id,
                user: {
                    id: feedback.userId, // Can be null for guest
                    name: feedback.userName || feedback.name, // Use guest name if no user
                    avatar: feedback.userAvatar,
                    authType: feedback.userAuthType
                },
                feedback: feedback.feedback,
                rating: feedback.rating,
                timestamp: feedback.timestamp,
                edited: feedback.edited
            };
            res.json({ success: true, feedback: formattedFeedback });
        });
    });
});

// Get All Feedbacks Endpoint
app.get('/feedbacks', (req, res) => {
    db.all('SELECT feedbacks.*, users.name AS userName, users.avatar AS userAvatar, users.authType AS userAuthType FROM feedbacks LEFT JOIN users ON feedbacks.userId = users.id ORDER BY timestamp DESC', [], (err, feedbacks) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ success: false, message: 'Failed to retrieve feedbacks.' });
        }
        // Format the feedback data to match what the client expects
        const formattedFeedbacks = feedbacks.map(feedback => ({
            id: feedback.id,
            user: {
                id: feedback.userId, // Can be null for guest
                name: feedback.userName || feedback.name, // Use guest name if no user
                avatar: feedback.userAvatar,
                authType: feedback.userAuthType
            },
            feedback: feedback.feedback,
            rating: feedback.rating,
            timestamp: feedback.timestamp,
            edited: feedback.edited
        }));
        res.json({ success: true, feedbacks: formattedFeedbacks });
    });
});

// --- Server Start ---
app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
