// server.js — MERGED NOBITA BOSS SERVER with FILE MANAGER 😈🔥

// --- Imports ---
// Combined imports from both the main server and the file manager.
const express = require('express');
const bodyParser = require('body-parser'); // For parsing JSON bodies in main server
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const cloudinary = require('cloudinary').v2; // Cloudinary
const multer = require('multer'); // Multer for file uploads
const webpush = require('web-push'); // Added web-push
const fs = require('fs'); // Filesystem module, used by both original and file manager
const axios = require('axios'); // Added axios for GitHub API calls
const simpleGit = require('simple-git'); // Added for GitHub pull

dotenv.config(); // Load environment variables from .env file (for local development)

const app = express();
const PORT = process.env.PORT || 3000;

// --- AGGRESSIVE DEBUGGING START (KEEP THIS FOR YOUR CONFIRMATION) ---
console.log("--- VAPID Key Debugging START ---");
console.log("process.env.VAPID_PUBLIC_KEY:", process.env.VAPID_PUBLIC_KEY);
console.log("Is VAPID_PUBLIC_KEY defined?", !!process.env.VAPID_PUBLIC_KEY);
if (!process.env.VAPID_PUBLIC_KEY) {
    console.error("CRITICAL: VAPID_PUBLIC_KEY is undefined or empty right after dotenv.config()!");
    console.error("Check your .env file or deployment environment variables.");
}
console.log("--- VAPID Key Debugging END ---");
// --- END AGGRESSIVE DEBUGGING ---

// Load environment variables (On Render, these will come from the dashboard)
const MONGODB_URI = process.env.MONGODB_URI;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const JWT_SECRET = process.env.JWT_SECRET;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_HOST = process.env.EMAIL_HOST;
const EMAIL_PORT = process.env.EMAIL_PORT;
const FRONTEND_URL = process.env.FRONTEND_URL;
const ADMIN_INITIAL_PASSWORD = process.env.ADMIN_INITIAL_PASSWORD;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // GitHub Token from .env
const GITHUB_REPO_OWNER = 'dontchange365'; // Fixed GitHub repo owner
const GITHUB_REPO_NAME = 'nobita-feedback-app-online'; // Fixed GitHub repo name
const GITHUB_BRANCH = 'main'; // Fixed GitHub branch

// Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// --- Debugging Environment Variables ---
console.log("--- Environment Variable Check (server.js start) ---");
console.log("PORT (from process.env):", process.env.PORT);
console.log("MONGODB_URI (loaded):", MONGODB_URI ? "SET" : "NOT SET");
console.log("JWT_SECRET (loaded):", JWT_SECRET ? "SET" : "NOT SET");
console.log("ADMIN_JWT_SECRET (loaded):", ADMIN_JWT_SECRET ? "SET" : "NOT SET");
console.log("FRONTEND_URL (loaded):", FRONTEND_URL ? "SET" : "NOT SET");
console.log("ADMIN_USERNAME (loaded):", ADMIN_USERNAME ? "SET" : "NOT SET");
console.log("ADMIN_PASSWORD_HASH (loaded):", ADMIN_PASSWORD_HASH ? "SET" : "NOT SET");
console.log("ADMIN_INITIAL_PASSWORD (loaded):", ADMIN_INITIAL_PASSWORD ? "SET" : "NOT SET");
console.log("GOOGLE_CLIENT_ID (loaded):", GOOGLE_CLIENT_ID ? "SET" : "NOT SET");
console.log("EMAIL_USER (loaded):", EMAIL_USER ? "SET" : "NOT SET");
console.log("EMAIL_PASS (loaded):", EMAIL_PASS ? "SET" : "NOT SET");
console.log("EMAIL_HOST (loaded):", EMAIL_HOST ? "SET" : "NOT SET");
console.log("EMAIL_PORT (loaded):", EMAIL_PORT ? "SET" : "NOT SET");
console.log("CLOUDINARY_CLOUD_NAME (loaded):", process.env.CLOUDINARY_CLOUD_NAME ? "SET" : "NOT SET");
console.log("CLOUDINARY_API_KEY (loaded):", process.env.CLOUDINARY_API_KEY ? "SET" : "NOT SET");
console.log("CLOUDINARY_API_SECRET (loaded):", process.env.CLOUDINARY_API_SECRET ? "SET" : "NOT SET");
console.log("VAPID_PUBLIC_KEY (loaded):", process.env.VAPID_PUBLIC_KEY ? "SET" : "NOT SET");
console.log("VAPID_PRIVATE_KEY (loaded):", process.env.VAPID_PRIVATE_KEY ? "SET" : "NOT SET");
console.log("VAPID_SUBJECT (loaded):", process.env.VAPID_SUBJECT ? "SET" : "NOT SET");
console.log("GITHUB_TOKEN (loaded):", GITHUB_TOKEN ? "SET" : "NOT SET (GitHub push/pull will use fallback or fail)");
console.log("--- End Environment Variable Check ---");

// Critical environment variables check
if (!MONGODB_URI || !JWT_SECRET || !FRONTEND_URL || !ADMIN_JWT_SECRET || !ADMIN_PASSWORD_HASH || !ADMIN_USERNAME) {
    console.error("CRITICAL ERROR: One or more critical environment variables (MONGODB_URI, JWT_SECRET, FRONTEND_URL, ADMIN_JWT_SECRET, ADMIN_PASSWORD_HASH, ADMIN_USERNAME) are not found.");
    process.exit(1);
}
if (!GOOGLE_CLIENT_ID) {
    console.warn("WARNING: GOOGLE_CLIENT_ID not set. Google Sign-in will not work.");
}
if (!EMAIL_USER || !EMAIL_PASS || !EMAIL_HOST || !EMAIL_PORT) {
    console.warn("WARNING: Email service environment variables (EMAIL_USER, EMAIL_PASS, EMAIL_HOST, EMAIL_PORT) are not fully set. Email functionalities may not work.");
}
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.warn("WARNING: Cloudinary environment variables are not fully set. Avatar upload will not work.");
}
if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_SUBJECT) {
    console.warn("WARNING: VAPID keys or subject not set. Push notifications will not work.");
}
if (!GITHUB_TOKEN) {
    console.warn("WARNING: GITHUB_TOKEN is not set in environment variables. GitHub push/pull functionality might use hardcoded fallback or fail.");
}


const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// --- Mongoose Schemas ---
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  username: { type: String, unique: true, sparse: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String },
  googleId: { type: String, sparse: true, unique: true },
  avatarUrl: { type: String },
  loginMethod: { type: String, enum: ['email', 'google'], required: true },
  createdAt: { type: Date, default: Date.now },
  resetPasswordToken: { type: String, default: undefined },
  resetPasswordExpires: { type: Date, default: undefined },
  isVerified: { type: Boolean, default: false },
  emailVerificationToken: { type: String, default: undefined },
  emailVerificationExpires: { type: Date, default: undefined },
  pushSubscription: {
    type: Object,
    default: null
  }
});
const User = mongoose.model('User', userSchema);

const feedbackSchema = new mongoose.Schema({
  name: { type: String, required: true },
  feedback: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  timestamp: { type: Date, default: Date.now },
  avatarUrl: { type: String },
  userIp: { type: String },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  guestId: { type: String, index: true, sparse: true, default: null },
  googleIdSubmitter: { type: String, sparse: true },
  isEdited: { type: Boolean, default: false },
  originalContent: { name: String, feedback: String, rating: Number, timestamp: Date },
  replies: [{ text: { type: String, required: true }, timestamp: { type: Date, default: Date.now }, adminName: { type: String, default: 'Admin' } }],
  isPinned: { type: Boolean, default: false },
  readByAdmin: { type: Boolean, default: false }
});
const Feedback = mongoose.model('Feedback', feedbackSchema);

const blogSchema = new mongoose.Schema({
  link: { type: String, required: true },
  title: { type: String, required: true },
  summary: { type: String, required: true },
  badge: { type: String, default: '' },
  author: { type: String, default: 'Nobita' },
  date: { type: Date, default: Date.now }
});
const Blog = mongoose.model('Blog', blogSchema);

// Subscription in-memory (now backed by DB)
let adminPushSubscription = null;

// Function to load admin push subscription from DB on startup
async function loadAdminPushSubscriptionFromDB() {
    try {
        const adminUser = await User.findOne({ username: ADMIN_USERNAME });
        if (adminUser && adminUser.pushSubscription) {
            adminPushSubscription = adminUser.pushSubscription;
            console.log("Admin push subscription loaded from DB on startup.");
        } else {
            console.warn("No admin push subscription found in DB on startup. Admin must log in and enable push notifications.");
        }
    } catch (error) {
        console.error("Error loading admin push subscription from DB:", error);
    }
}

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('MongoDB connection successful!');
    loadAdminPushSubscriptionFromDB();
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
});

// Function to generate DiceBear avatar URL
function getDiceBearAvatarUrl(name, randomSeed = '') {
    const seedName = (typeof name === 'string' && name) ? name.toLowerCase() : 'default_seed';
    const seed = encodeURIComponent(seedName + randomSeed);
    return `https://api.dicebear.com/8.x/adventurer/svg?seed=${seed}&flip=true&radius=50&doodle=true&scale=90`;
}


// --- Middleware Setup (Main Server) ---
app.use(cors({
    origin: [FRONTEND_URL, `http://localhost:${PORT}`, `http://localhost:3001`],
    methods: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(bodyParser.json()); // Parses JSON bodies
app.use(bodyParser.urlencoded({ extended: true })); // Parses URL-encoded bodies

// Custom middleware to get client IP address
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

// --- Static File Serving for File Manager (placed before other static routes) ---
app.use(express.static(__dirname));

// --- Middleware to authenticate user JWT token ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.status(401).json({ message: "Authentication token not found." });
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error("User JWT Verification Error:", err.message);
            return res.status(403).json({ message: "Invalid or expired token. Please log in again." });
        }
        req.user = { ...user, isVerified: user.isVerified };
        next();
    });
};

// --- Middleware to authenticate ADMIN JWT token ---
const authenticateAdminToken = (req, res, next) => {
    // For SSE, token is in query param
    let token = req.query.token || (req.headers['authorization'] && req.headers['authorization'].split(' ')[1]);

    if (token == null) {
        console.warn("Admin authentication attempt: No token provided.");
        return res.status(401).json({ message: "Admin authentication required." });
    }
    jwt.verify(token, ADMIN_JWT_SECRET, (err, adminUser) => {
        if (err) {
            console.error("Admin JWT Verification Error:", err.message);
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ message: "Admin session expired. Please log in again." });
            }
            return res.status(403).json({ message: "Invalid admin token." });
        }
        req.adminUser = adminUser;
        console.log(`Admin ${adminUser.username} authenticated.`);
        next();
    });
};

// --- Middleware to check if email is verified ---
const isEmailVerified = async (req, res, next) => {
    if (!req.user || !req.user.userId) {
        return res.status(401).json({ message: "Authentication required." });
    }
    try {
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }
        if (user.loginMethod === 'google' || user.isVerified) {
            next();
        } else {
            return res.status(403).json({ message: "Email not verified. Please verify your email to perform this action." });
        }
    } catch (error) {
        console.error("isEmailVerified middleware error:", error);
        res.status(500).json({ message: "Server error while checking email verification status." });
    }
};

// --- Function to send emails ---
async function sendEmail(options) {
    if (!EMAIL_USER || !EMAIL_PASS || !EMAIL_HOST || !EMAIL_PORT) {
        console.error("Email service environment variables (EMAIL_USER, EMAIL_PASS, EMAIL_HOST, EMAIL_PORT) are not fully set.");
        throw new Error("Email service is not properly configured. Please contact the administrator.");
    }
    console.log(`Attempting to send email: To: ${options.email}, Subject: ${options.subject} (Host: ${EMAIL_HOST})`);
    const transporter = nodemailer.createTransport({
        host: EMAIL_HOST, port: parseInt(EMAIL_PORT), secure: parseInt(EMAIL_PORT) === 465,
        auth: { user: EMAIL_USER, pass: EMAIL_PASS },
        tls: { rejectUnauthorized: false }
    });
    const mailOptions = { from: `"Nobita Feedback App" <${EMAIL_USER}>`, to: options.email, subject: options.subject, text: options.message, html: options.html };
    try {
        let info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully! Message ID: %s', info.messageId);
    } catch (error) {
        console.error('Error sending email with Nodemailer:', error);
        if(error.responseCode === 535 || (error.command && error.command === 'AUTH LOGIN')) {
            console.error("SMTP Authentication Error: Username/Password might be incorrect or Gmail 'less secure app access'/'App Password' is required.");
        }
        throw error;
    }
}

// Email template constant
const NOBITA_EMAIL_TEMPLATE = (heading, name, buttonText, link, avatarUrl) => `
<div style="font-family: 'Poppins',sans-serif; background: #f2f3f5; margin:0; padding: 0; min-height: 100vh; width: 100vw;">
  <table width="100%" cellspacing="0" cellpadding="0" border="0" style="background: linear-gradient(120deg, #7c3aed, #22d3ee); min-height:100vh; padding: 0; margin:0;">
    <tr>
      <td align="center" style="padding: 0; margin:0;">
        <table width="420" cellpadding="0" cellspacing="0" border="0" style="background: #fff; border-radius: 14px; overflow:hidden; margin:40px auto 32px auto; box-shadow: 0 2px 16px #22033b18;">
          <tr>
            <td align="center" style="padding: 0;">
              <img src="${avatarUrl}" alt="User Avatar" width="80" height="80" style="border-radius: 50%; margin: 28px auto 8px auto; box-shadow: 0 2px 14px #00000030; display:block;" />
              <div style="background: linear-gradient(90deg, #1877f2, #42a5f5); padding: 18px 0;">
                <h2 style="color: white; margin: 0; font-size: 1.6em;">
                  ${heading}
                </h2>
              </div>
              <div style="padding: 30px 7% 18px 7%;">
                <p style="font-size: 1.05em; color: #333;">
                  Hello <strong>${name}</strong>,<br><br>
                  ${
                    heading.includes('Password') ?
                    'We received a request to reset your password.<br>Use the button below to change it:' :
                    'Thanks for registering!<br>Click the button below to verify your email address:'
                  }
                </p>
                <a href="${link}" style="display: inline-block; padding: 13px 25px; font-size: 1em; background-color: #1877f2; color: #fff; text-decoration: none; border-radius: 6px; margin-top: 20px; font-weight: 600; letter-spacing: 0.4px;">
                  ${buttonText}
                </a>
                <p style="margin:24px 0 0 0; font-size: 0.95em; color:#777;">
                  <b>Having trouble with the button?</b><br>
                  <span style="word-break:break-all; display:inline-block; margin-top:4px;">
                    <a href="${link}" style="color: #1877f2; text-decoration: underline;">${link}</a>
                  </span>
                </p>
                <p style="font-size: 0.95em; color: #f44336; margin-top: 22px;">
                  ⚠️ This link will expire in 10 minutes. Please act fast!
                </p>
                <p style="font-style: italic; font-size: 0.91em; color: #555; margin-top: 18px;">
                  "Power doesn’t reset — it restores." — NOBI BOT 💀
                </p>
              </div>
              <div style="background-color: #f0f2f5; padding: 14px; font-size: 0.87em; color: #999;">
                &copy; 2025 NOBI BOT | Need help? <a href="mailto:support@nobibot.com" style="color:#1877f2;">Contact Support</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>
`;

// --- File Manager Configuration ---
const BASE_DIR = path.resolve(__dirname, '.');

// --- Helper Function: Get File Icon (for File Manager) ---
const getFileIcon = (file) => {
  const ext = path.extname(file).toLowerCase().replace('.', '');
  const map = {
    js: 'js', json: 'json', html: 'html', css: 'css', md: 'md', txt: 'txt',
    env: 'env', png: 'image', jpg: 'image', jpeg: 'image', svg: 'image',
    mp3: 'audio', wav: 'audio', mp4: 'video', mov: 'video', zip: 'zip', rar: 'zip',
    pdf: 'pdf', doc: 'doc', docx: 'doc', xls: 'xls', xlsx: 'xls'
  };
  return map[ext] || 'file';
};

// --- File Manager API Endpoints (NOW PROTECTED) ---
// All file manager routes are now protected by authenticateAdminToken.

// 1. List Directory Contents
app.get('/api/file-manager', authenticateAdminToken, (req, res) => {
  let currPath = req.query.path || '/';
  let fullPath = path.join(BASE_DIR, currPath);

  fs.readdir(fullPath, { withFileTypes: true }, (err, files) => {
    if (err) {
      console.error(`Error listing directory ${fullPath}:`, err);
      return res.status(500).json({ error: err.message });
    }

    let content = files.map(f => {
      let itemFullPath = path.join(fullPath, f.name);
      let stat;
      try {
        stat = fs.statSync(itemFullPath);
      } catch (statErr) {
        console.error(`Error getting stat for ${itemFullPath}:`, statErr);
        return {
          name: f.name,
          type: f.isDirectory() ? 'folder' : 'file',
          icon: f.isDirectory() ? 'folder' : getFileIcon(f.name),
          size: null,
          mtime: null,
        };
      }

      return {
        name: f.name,
        type: f.isDirectory() ? 'folder' : 'file',
        icon: f.isDirectory() ? 'folder' : getFileIcon(f.name),
        size: f.isDirectory() ? null : stat.size,
        mtime: stat.mtime,
      };
    });

    res.json({
      path: currPath,
      parent: currPath === '/' ? null : path.dirname(currPath),
      content: content
    });
  });
});

// 2. Create Folder
app.post('/api/file-manager/folder', authenticateAdminToken, (req, res) => {
  const { path: dirPath, name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Folder name is required.' });
  }
  let target = path.join(BASE_DIR, dirPath, name);

  fs.mkdir(target, { recursive: false }, (err) => {
    if (err) {
      console.error(`Error creating folder ${target}:`, err);
      return res.status(500).json({ error: err.message });
    }
    res.json({ ok: 1 });
  });
});

// 3. Create/Overwrite File
app.post('/api/file-manager/file', authenticateAdminToken, (req, res) => {
  const { path: filePath, name, content, overwrite } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'File name is required.' });
  }
  let target = path.join(BASE_DIR, filePath, name);

  if (fs.existsSync(target) && !(overwrite === true || overwrite === "true")) {
    return res.status(409).json({ error: 'File already exists.', exists: true });
  }

  fs.writeFile(target, content || '', (err) => {
    if (err) {
      console.error(`Error writing file ${target}:`, err);
      return res.status(500).json({ error: err.message });
    }
    res.json({ ok: 1 });
  });
});

// 4. Read File Content
app.get('/api/file-manager/file', authenticateAdminToken, (req, res) => {
  const { path: filePath } = req.query;
  let target = path.join(BASE_DIR, filePath);

  if (!fs.existsSync(target)) {
    return res.status(404).json({ error: 'File not found.' });
  }

  fs.readFile(target, 'utf-8', (err, data) => {
    if (err) {
      console.error(`Error reading file ${target}:`, err);
      return res.status(500).json({ error: err.message });
    }
    res.json({ content: data });
  });
});

// 5. Write/Save File (Update Content)
app.put('/api/file-manager/file', authenticateAdminToken, (req, res) => {
  const { path: filePath, content } = req.body;
  let target = path.join(BASE_DIR, filePath);

  fs.writeFile(target, content, (err) => {
    if (err) {
      console.error(`Error saving file ${target}:`, err);
      return res.status(500).json({ error: err.message });
    }
    res.json({ ok: 1 });
  });
});

// 6. Delete File/Folder
app.delete('/api/file-manager', authenticateAdminToken, (req, res) => {
  const { path: targetPath } = req.query;
  let target = path.join(BASE_DIR, targetPath);

  if (!fs.existsSync(target)) {
    return res.status(404).json({ error: 'Item not found.' });
  }

  fs.stat(target, (err, stat) => {
    if (err) {
      console.error(`Error getting stats for ${target}:`, err);
      return res.status(500).json({ error: err.message });
    }

    if (stat.isDirectory()) {
      fs.rm(target, { recursive: true, force: true }, (err) => { // Using fs.rm for newer Node.js versions
        if (err) {
          console.error(`Error deleting directory ${target}:`, err);
          return res.status(500).json({ error: err.message });
        }
        res.json({ ok: 1 });
      });
    } else {
      fs.unlink(target, (err) => {
        if (err) {
          console.error(`Error deleting file ${target}:`, err);
          return res.status(500).json({ error: err.message });
        }
        res.json({ ok: 1 });
      });
    }
  });
});

// --- NOBITA: PUSH ALL FILES TO GITHUB API ---

// Helper to recursively fetch all files (with exclusions)
function walkAllFiles(dir, base = '', arr = []) {
  fs.readdirSync(dir).forEach(file => {
    const filePath = path.join(dir, file);
    const relPath = path.join(base, file);

    // Exclude common directories/files that shouldn't be pushed to GitHub
    const excludedPaths = [
      'node_modules', '.git', '.env', 'package-lock.json', 'yarn.lock',
      'Thumbs.db', '.DS_Store', 'nbproject', // Common IDE/OS specific files
      // Add any other files/folders you want to exclude here
    ];

    // Check if the current file/directory path includes any excluded path segment
    const shouldExclude = excludedPaths.some(exclude => relPath.includes(exclude));

    if (shouldExclude) {
      console.log(`Skipping excluded path: ${relPath}`);
      return;
    }

    if (fs.statSync(filePath).isDirectory()) {
      walkAllFiles(filePath, relPath, arr);
    } else {
        // Attempt to read as UTF-8, handle potential encoding errors for binary files
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            arr.push({ path: relPath.replace(/\\/g, '/'), content: content });
        } catch (e) {
            console.warn(`Could not read file ${filePath} as UTF-8 (likely binary). Skipping for GitHub push.`);
            // You might want to handle binary files differently (e.g., read as buffer and base64 encode)
            // But for this simple implementation, we'll skip them if they cause encoding errors.
        }
    }
  });
  return arr;
}

// --- PUSH ALL FILES ENDPOINT (ADMIN Protected) ---
app.post('/api/admin/push-to-github', authenticateAdminToken, async (req, res) => {
  // Token .env se uthao, kabhi bhi yahan mat likh!
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const REPO_OWNER = GITHUB_REPO_OWNER;
  const REPO_NAME = GITHUB_REPO_NAME;
  const BRANCH = GITHUB_BRANCH;
  const pushMessage = req.body.message || 'Auto push from NOBI FILE MANAGER 😈';
  const baseDir = __dirname;

  // Safe check — .env me token hai ya nahi
  if (!GITHUB_TOKEN) {
    console.error("GitHub Token is not configured. Please set GITHUB_TOKEN in your .env file.");
    return res.status(500).json({ error: 'GitHub Token is not configured.' });
  }

  try {
    const allFiles = walkAllFiles(baseDir); // Get all files recursively

    for (const file of allFiles) {
      let sha = undefined; // Initialize SHA for file existence check

      // Step 1: Check if the file exists on GitHub to get its SHA (required for updating)
      try {
        const meta = await axios.get(
          `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodeURIComponent(file.path)}?ref=${BRANCH}`,
          {
            headers: { Authorization: `token ${GITHUB_TOKEN}` }
          }
        );
        sha = meta.data.sha; // If file exists, get its SHA
      } catch (e) {
        // If file not found (404) or any other error, it means the file doesn't exist or we can't get its SHA.
        // We will attempt to create it. If it's another error, it will fail on PUT.
        if (e.response && e.response.status === 404) {
          console.log(`File ${file.path} not found on GitHub, will create.`);
        } else {
          console.warn(`Error checking SHA for ${file.path}:`, e.response?.data || e.message);
        }
      }

      // Step 2: Push/overwrite the file to GitHub
      await axios.put(
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodeURIComponent(file.path)}`,
        {
          message: pushMessage,
          content: Buffer.from(file.content).toString('base64'), // Encode content to Base64
          branch: BRANCH,
          ...(sha ? { sha } : {}) // Include SHA if updating an existing file
        },
        {
          headers: {
  Authorization: `token ${GITHUB_TOKEN}`,
  'Content-Type': 'application/json', // Important for GitHub API PUT requests
            'Accept': 'application/vnd.github.v3+json' // Specify API version
          }
        }
      );
      console.log(`Pushed: ${file.path}`);
    }

    res.json({ success: true, totalFilesPushed: allFiles.length, message: 'All files successfully pushed to GitHub!' });
  } catch (err) {
    console.error('GitHub push error:', err.response?.data || err.message || err);
    res.status(500).json({
      error: 'GitHub push failed',
      detail: err.response?.data?.message || err.message,
      status: err.response?.status
    });
  }
});


// NOBI BOT SSE LIVE LOG (GitHub Push Stream)
app.get('/api/admin/push-to-github/stream', authenticateAdminToken, async (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  res.flushHeaders(); // Important for SSE to send headers immediately

  // Helper function to send log messages
  function sendLog(msg) {
    res.write(`data: ${msg}\n\n`);
  }

  sendLog('[Connecting to GitHub...]');

  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const REPO_OWNER = GITHUB_REPO_OWNER;
  const REPO_NAME = GITHUB_REPO_NAME;
  const BRANCH = GITHUB_BRANCH;
  const pushMessage = req.query.message || 'Auto push from NOBI FILE MANAGER 😈';
  const baseDir = __dirname;

  // Safety check for GitHub Token
  if (!GITHUB_TOKEN) {
    sendLog("[ERROR] GitHub Token is not configured. Please set GITHUB_TOKEN in your .env file.");
    sendLog('[GITHUB_DONE]');
    return res.end();
  }

  try {
    // This walkAllFiles is your file recursion function — get an array of all files
    const allFiles = walkAllFiles(baseDir); // [{ path, content }]
    sendLog(`[Found ${allFiles.length} files, pushing to GitHub...]`);
    let pushed = 0;

    for (const file of allFiles) {
      sendLog(`[PUSHING] ${file.path}`);
      // -- Check if file exists to get SHA
      let sha = undefined;
      try {
        const meta = await axios.get(
          `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodeURIComponent(file.path)}?ref=${BRANCH}`,
          { headers: { Authorization: `token ${GITHUB_TOKEN}` } }
        );
        sha = meta.data.sha;
      } catch (e) {
        // file doesn't exist, skip getting SHA (it will be a create operation)
        if (e.response && e.response.status === 404) {
          // console.log(`File ${file.path} not found on GitHub, will create.`);
        } else {
          // Log other errors but continue trying to push
          console.warn(`Error checking SHA for ${file.path}:`, e.response?.data || e.message);
        }
      }
      // -- Push file
      try {
        await axios.put(
          `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodeURIComponent(file.path)}`,
          {
            message: pushMessage,
            content: Buffer.from(file.content).toString('base64'),
            branch: BRANCH,
            ...(sha ? { sha } : {}) // Include SHA if updating an existing file
          },
          {
            headers: {
              Authorization: `token ${GITHUB_TOKEN}`,
              'Content-Type': 'application/json',
              'Accept': 'application/vnd.github.v3+json'
            }
          }
        );
        pushed++;
        sendLog(`[✅] ${file.path} (pushed)`);
      } catch (err) {
        sendLog(`[❌] ${file.path} (FAILED) — ${err.response?.data?.message || err.message}`);
      }
    }
    sendLog(`[COMPLETE] Pushed: ${pushed}/${allFiles.length} files.`);
    sendLog('[GITHUB_DONE]'); // Signal completion
    res.end(); // Close the SSE connection
  } catch (e) {
    console.error("Critical error during GitHub SSE push:", e);
    sendLog(`[ERROR] ${e.message}`);
    sendLog('[GITHUB_DONE]'); // Signal completion even on error
    res.end(); // Close the SSE connection
  }
});

// Helper function to recursively download files from GitHub
async function downloadGithubContents(owner, repo, branch, repoPath, localPath, sendLog) {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  if (!GITHUB_TOKEN) {
    throw new Error('GitHub Token is not configured for pull operations.');
  }

  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${repoPath}?ref=${branch}`;
  let response;
  try {
    response = await axios.get(url, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json'
      }
    });
  } catch (error) {
    // If a path doesn't exist on GitHub, that's fine, just skip it.
    if (error.response && error.response.status === 404) {
        sendLog(`[SKIPPED] ${repoPath} not found on GitHub.`)
        return;
    }
    throw error; // Re-throw other errors
  }


  if (Array.isArray(response.data)) { // It's a directory
    sendLog(`[PULLING DIR] ${repoPath}`);
    // Create local directory if it doesn't exist
    if (!fs.existsSync(localPath)) {
      fs.mkdirSync(localPath, { recursive: true });
    }

    for (const item of response.data) {
      const newRepoPath = item.path;
      const newLocalPath = path.join(localPath, item.name);
      await downloadGithubContents(owner, repo, branch, newRepoPath, newLocalPath, sendLog);
    }
  } else if (response.data.type === 'file') { // It's a file
    sendLog(`[PULLING FILE] ${repoPath}`);
    // Decode content from Base64 and write to local file
    const content = Buffer.from(response.data.content, 'base64').toString('utf8');
    fs.writeFileSync(localPath, content);
    sendLog(`[✅] ${repoPath} (pulled)`);
  }
}

// NOBI BOT SSE LIVE LOG (GitHub Pull Stream)
app.get('/api/admin/pull-from-github/stream', authenticateAdminToken, async (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  res.flushHeaders(); // Important for SSE to send headers immediately

  function sendLog(msg) {
    res.write(`data: ${msg}\n\n`);
  }

  sendLog('[Connecting to GitHub for pull...]');

  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const REPO_OWNER = GITHUB_REPO_OWNER;
  const REPO_NAME = GITHUB_REPO_NAME;
  const BRANCH = GITHUB_BRANCH;
  const baseDir = __dirname; // Current directory where server.js resides

  if (!GITHUB_TOKEN) {
    sendLog("[ERROR] GitHub Token is not configured. Please set GITHUB_TOKEN in your .env file.");
    sendLog('[GITHUB_DONE]');
    return res.end();
  }

  try {
    sendLog(`[Starting pull from ${REPO_OWNER}/${REPO_NAME}/${BRANCH}]`);
    // Start recursive download from the root of the repository
    await downloadGithubContents(REPO_OWNER, REPO_NAME, BRANCH, '', baseDir, sendLog);

    sendLog('[COMPLETE] GitHub pull done!');
    sendLog('[GITHUB_DONE]'); // Signal completion
    res.end(); // Close the SSE connection
  } catch (e) {
    console.error("Critical error during GitHub SSE pull:", e);
    sendLog(`[ERROR] ${e.message}`);
    sendLog('[GITHUB_DONE]'); // Signal completion even on error
    res.end(); // Close the SSE connection
  }
});


// --- Admin Authentication Route ---
app.post('/api/admin/login', async (req, res) => {
    const { username, password } = req.body;

    if (username !== ADMIN_USERNAME) {
        return res.status(401).json({ message: "Invalid username or password." });
    }

    try {
        let adminUser = await User.findOne({ username: ADMIN_USERNAME });

        if (!adminUser) {
            console.warn(`Admin user '${ADMIN_USERNAME}' not found in DB. Attempting to create it.`);
            if (!ADMIN_INITIAL_PASSWORD) {
                 console.error("CRITICAL ERROR: ADMIN_INITIAL_PASSWORD environment variable is required to create the initial admin user.");
                 return res.status(500).json({ message: "Server setup incomplete: Initial admin password not set for first-time creation." });
            }
            const initialHashedPassword = await bcrypt.hash(ADMIN_INITIAL_PASSWORD, 12);
            adminUser = new User({
                name: 'Admin User',
                username: ADMIN_USERNAME,
                email: `${ADMIN_USERNAME.toLowerCase().replace(/\s/g, '')}@admin.com`,
                password: initialHashedPassword,
                loginMethod: 'email',
                isVerified: true
            });
            await adminUser.save();
            console.log(`Admin user '${ADMIN_USERNAME}' created with default password.`);
        }

        const isMatch = await bcrypt.compare(password, adminUser.password);

        if (!isMatch) {
            return res.status(401).json({ message: "Invalid username or password." });
        }

        const adminPayload = {
            username: adminUser.username,
            userId: adminUser._id,
            loggedInAt: new Date().toISOString()
        };
        const adminToken = jwt.sign(adminPayload, ADMIN_JWT_SECRET, { expiresIn: '1h' });

        res.status(200).json({ message: "Admin login successful!", token: adminToken, admin: adminPayload });

    } catch (error) {
        console.error("Admin login error:", error);
        res.status(500).json({ message: "Server error during admin login.", error: error.message });
    }
});


// --- Auth Routes (Existing User Auth) ---
app.post('/api/auth/signup', async (req, res) => {
    const { name, email, password, linkGuestId } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: "Name, email, and password are required." });
    if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters long." });

    try {
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) return res.status(400).json({ message: "This email is already registered." });

        const hashedPassword = await bcrypt.hash(password, 12);
        const userAvatar = getDiceBearAvatarUrl(name, Date.now().toString());

        const verificationToken = crypto.randomBytes(32).toString('hex');
        const newUser = new User({
            name, email: email.toLowerCase(), password: hashedPassword,
            avatarUrl: userAvatar, loginMethod: 'email', isVerified: false,
            emailVerificationToken: verificationToken,
            emailVerificationExpires: Date.now() + 10 * 60 * 1000 // 10 minutes expiry
        });
        await newUser.save();

        if (linkGuestId) {
            console.log(`Attempting to link guest ID ${linkGuestId} to new user ${newUser._id}`);
            const updateResult = await Feedback.updateMany(
                { guestId: linkGuestId, userId: null },
                {
                    $set: {
                        userId: newUser._id,
                        name: newUser.name,
                        avatarUrl: newUser.avatarUrl,
                        guestId: null
                    }
                }
            );
            console.log(`Feedbacks updated for guest ID linking: ${updateResult.modifiedCount} modified.`);
        }

        const verifyPagePath = "/verify-email.html";
        const verifyUrl = `${FRONTEND_URL}${verifyPagePath}?token=${verificationToken}`;
        const emailSubject = 'Nobita Feedback App: Email Verification';
        const emailText = `Hello ${newUser.name},\n\nPlease click the link to verify your email:\n${verifyUrl}\n\nThank you,\nNobita Feedback App Team`;
        const emailHtml = NOBITA_EMAIL_TEMPLATE(
            "📩 Email Verification",
            newUser.name,
            "✅ Verify Your Email",
            verifyUrl,
            newUser.avatarUrl || getDiceBearAvatarUrl(newUser.name)
        );

        try {
            await sendEmail({ email: newUser.email, subject: emailSubject, message: emailText, html: emailHtml });
        } catch (emailError) {
            console.error("Error sending verification email:", emailError.message);
        }

        const userForToken = { userId: newUser._id, name: newUser.name, email: newUser.email, avatarUrl: newUser.avatarUrl, loginMethod: 'email', isVerified: newUser.isVerified };
        const appToken = jwt.sign(userForToken, JWT_SECRET, { expiresIn: '7d' });
        let responseMessage = "Account created successfully. Please verify your email.";

        res.status(201).json({ token: appToken, user: userForToken, message: responseMessage });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ message: "Something went wrong while creating the account.", error: error.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email and password are required." });
    try {
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) return res.status(401).json({ message: "Invalid email or password." });
        if (user.loginMethod === 'google' && !user.password) return res.status(401).json({ message: "You signed up with Google. Please log in with Google." });
        if (!user.password) return res.status(401).json({ message: "Invalid login credentials." });
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ message: "Invalid email or password." });
        const userForToken = { userId: user._id, name: user.name, email: user.email, avatarUrl: user.avatarUrl, loginMethod: user.loginMethod, isVerified: user.isVerified };
        const appToken = jwt.sign(userForToken, JWT_SECRET, { expiresIn: '7d' });
        res.status(200).json({ token: appToken, user: userForToken });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: "Something went wrong while logging in.", error: error.message });
    }
});

app.post('/api/auth/google-signin', async (req, res) => {
    const { token, linkGuestId } = req.body;
    if (!token) return res.status(400).json({ message: 'Google ID token not found.' });
    try {
        const ticket = await googleClient.verifyIdToken({ idToken: token, audience: GOOGLE_CLIENT_ID });
        const payload = ticket.getPayload();
        if (!payload) throw new Error("Google token payload not found.");
        const { sub: googleId, name, email, picture: googleAvatar } = payload;

        let user = await User.findOne({ googleId });
        if (!user) {
            user = await User.findOne({ email: email.toLowerCase() });
            if (user) {
                if (user.loginMethod === 'email') {
                    user.googleId = googleId;
                    user.avatarUrl = googleAvatar || user.avatarUrl;
                    user.isVerified = true;
                    user.emailVerificationToken = undefined;
                    user.emailVerificationExpires = undefined;
                }
            } else {
                user = new User({
                    googleId, name, email: email.toLowerCase(),
                    avatarUrl: googleAvatar || getDiceBearAvatarUrl(name),
                    loginMethod: 'google', isVerified: true
                });
            }
            await user.save();
        } else {
            if (user.avatarUrl !== googleAvatar && googleAvatar) { user.avatarUrl = googleAvatar; await user.save(); }
            if (!user.isVerified) { user.isVerified = true; await user.save(); }
        }

        if (linkGuestId) {
            console.log(`Attempting to link guest ID ${linkGuestId} to Google user ${user._id}`);
            const updateResult = await Feedback.updateMany(
                { guestId: linkGuestId, userId: null },
                {
                    $set: {
                        userId: user._id,
                        name: user.name,
                        avatarUrl: user.avatarUrl,
                        guestId: null
                    }
                }
            );
            console.log(`Feedbacks updated for guest ID linking (Google): ${updateResult.modifiedCount} modified.`);
        }

        const userForToken = { userId: user._id, name: user.name, email: user.email, avatarUrl: user.avatarUrl, loginMethod: 'google', isVerified: user.isVerified };
        const appToken = jwt.sign(userForToken, JWT_SECRET, { expiresIn: '7d' });
        res.status(200).json({ token: appToken, user: userForToken });
    } catch (error) {
        console.error('Google signin error:', error);
        res.status(401).json({ message: 'Google token invalid or verification failed.', error: error.message });
    }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
    res.status(200).json(req.user);
});

// --- Password Reset Routes ---
app.post('/api/auth/request-password-reset', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email address is required." });
    if (!FRONTEND_URL) return res.status(500).json({ message: "Server configuration error (FRONTEND_URL missing)." });
    try {
        const user = await User.findOne({ email: email.toLowerCase(), loginMethod: 'email', isVerified: true });
        if (!user) return res.status(200).json({ message: "If your email is in our system and linked to an email/password account, you will receive a password reset link." });
        const resetToken = crypto.randomBytes(32).toString('hex');
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = Date.now() + 3600000;
        await user.save();
        const resetPagePath = "/reset-password.html";
        const resetUrl = `${FRONTEND_URL}${resetPagePath}?token=${resetToken}`;
        const textMessage = `Hello ${user.name},\n\nPassword reset link:\n${resetUrl}\n\nNobita Feedback App Team`;
        const htmlMessage = NOBITA_EMAIL_TEMPLATE(
            "🔐 Password Reset",
            user.name,
            "🔁 Reset Your Password",
            resetUrl,
            user.avatarUrl || getDiceBearAvatarUrl(user.name)
        );
        await sendEmail({ email: user.email, subject: 'Your Password Reset Link (Nobita Feedback App)', message: textMessage, html: htmlMessage });
        res.status(200).json({ message: "A password reset link has been sent to your email (if valid and linked)." });
    } catch (error) {
        console.error('Request password reset API error:', error);
        res.status(500).json({ message: "Something went wrong processing the password reset request." });
    }
});
app.post('/api/auth/reset-password', async (req, res) => {
    const { token, password, confirmPassword } = req.body;
    if (!token) return res.status(400).json({ message: "Password reset token not found." });
    if (!password || !confirmPassword || password !== confirmPassword || password.length < 6) {
        return res.status(400).json({ message: "Invalid password details." });
    }
    try {
        const user = await User.findOne({ resetPasswordToken: token, resetPasswordExpires: { $gt: Date.now() } });
        if (!user) return res.status(400).json({ message: "Password reset token is invalid or has expired." });
        user.password = await bcrypt.hash(password, 12);
        user.resetPasswordToken = undefined; user.resetPasswordExpires = undefined;
        await user.save();
        const confirmationTextMessage = `Hello ${user.name},\n\nYour password has been reset.`;
        const confirmationHtmlMessage = `<p>Hello ${user.name},</p><p>Your password has been reset.</p>`;
        try { await sendEmail({ email: user.email, subject: 'Your Password Has Been Successfully Reset', message: confirmationTextMessage, html: confirmationHtmlMessage});
        } catch (emailError) { console.error("Error sending password reset confirmation email:", emailError); }
        res.status(200).json({ message: "Your password has been successfully reset." });
    } catch (error) {
        console.error('Reset password API error:', error);
        res.status(500).json({ message: "Something went wrong while resetting the password." });
    }
});

// --- Email Verification Routes ---
app.post('/api/auth/request-email-verification', authenticateToken, async (req, res) => {
    if (!FRONTEND_URL) return res.status(500).json({ message: "Server configuration error (FRONTEND_URL missing)." });
    try {
        const user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ message: "User not found." });
        if (user.loginMethod === 'google' || user.isVerified) return res.status(200).json({ message: "Email already verified or not applicable." });
        const verificationToken = crypto.randomBytes(32).toString('hex');
        user.emailVerificationToken = verificationToken;
        user.emailVerificationExpires = Date.now() + 10 * 60 * 1000;
        await user.save();
        const verifyPagePath = "/verify-email.html";
        const verifyUrl = `${FRONTEND_URL}${verifyPagePath}?token=${verificationToken}`;
        const textMessage = `Hello ${user.name},\n\nVerify your email:\n${verifyUrl}\n\nNobita Feedback App Team`;
        const htmlMessage = NOBITA_EMAIL_TEMPLATE(
            "📩 Email Verification",
            user.name,
            "✅ Verify Your Email",
            verifyUrl,
            user.avatarUrl || getDiceBearAvatarUrl(user.name)
        );
        await sendEmail({ email: user.email, subject: 'Your Email Verification Link (Nobita Feedback App)', message: textMessage, html: htmlMessage });
        res.status(200).json({ message: "Verification link has been sent to your email." });
    } catch (error) {
        console.error('Request email verification API error:', error);
        res.status(500).json({ message: "Something went wrong processing the email verification request." });
    }
});
app.post('/api/auth/verify-email', async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: "Email verification token not found." });
    try {
        const user = await User.findOne({ emailVerificationToken: token, emailVerificationExpires: { $gt: Date.now() } });
        if (!user) return res.status(400).json({ message: "Email verification token is invalid or has expired." });
        user.isVerified = true;
        user.emailVerificationToken = undefined; user.emailVerificationExpires = undefined;
        await user.save();
        const confirmationTextMessage = `Hello ${user.name},\n\nYour email has been verified.`;
        const confirmationHtmlMessage = `<p>Hello ${user.name},</p><p>Your email has been verified.</p>`;
        try { await sendEmail({ email: user.email, subject: 'Aapka Email Safaltapoorvak Verify Ho Gaya Hai!', message: confirmationTextMessage, html: confirmationHtmlMessage });
        } catch (emailError) { console.error("Error sending verification confirmation email:", emailError); }
        const userForToken = { userId: user._id, name: user.name, email: user.email, avatarUrl: user.avatarUrl, loginMethod: user.loginMethod, isVerified: user.isVerified };
        const newToken = jwt.sign(userForToken, JWT_SECRET, { expiresIn: '7d' });
        res.status(200).json({ message: "Your email has been successfully verified.", token: newToken, user: userForToken });
    } catch (error) {
        console.error('Verify email API error:', error);
        res.status(500).json({ message: "Something went wrong while verifying the email." });
    }
});

// Multer setup for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (req, file, cb) => { file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Only image files are allowed!'), false); } });

// --- User Profile Management Routes ---
app.put('/api/user/profile', authenticateToken, isEmailVerified, async (req, res) => {
    const { name, avatarUrl } = req.body;
    const userId = req.user.userId;

    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found.' });

        if (user.loginMethod === 'google') {
            if (typeof name !== 'undefined' && name !== user.name) {
                return res.status(400).json({ message: 'Name for Google-linked accounts cannot be changed here.' });
            }
            if (typeof avatarUrl !== 'undefined' && avatarUrl && avatarUrl !== user.avatarUrl) {
                user.avatarUrl = avatarUrl;
            }
        } else {
            if (typeof name !== 'undefined') {
                if (!name || !name.trim()) return res.status(400).json({ message: 'Name cannot be empty.' });
                user.name = name.trim();
                if (user.avatarUrl && user.avatarUrl.startsWith('https://api.dicebear.com') && name !== req.user.name && typeof avatarUrl === 'undefined') {
                    user.avatarUrl = getDiceBearAvatarUrl(name, Date.now().toString());
                }
            }
            if (typeof avatarUrl !== 'undefined' && avatarUrl) {
                user.avatarUrl = avatarUrl;
            }
        }
        await user.save();
        const shouldUpdateFeedbacks = (typeof name !== 'undefined' && user.name !== req.user.name) || (typeof avatarUrl !== 'undefined' && user.avatarUrl !== req.user.avatarUrl);

        if (shouldUpdateFeedbacks) {
            await Feedback.updateMany({ userId: user._id }, { $set: { avatarUrl: user.avatarUrl, name: user.name } });
        }

        const updatedUserForToken = { userId: user._id, name: user.name, email: user.email, avatarUrl: user.avatarUrl, loginMethod: user.loginMethod, isVerified: user.isVerified };
        const newToken = jwt.sign(updatedUserForToken, JWT_SECRET, { expiresIn: '7d' });
        res.status(200).json({ message: 'Profile updated successfully!', user: updatedUserForToken, token: newToken });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ message: 'Failed to update profile.', error: error.message });
    }
});
app.post('/api/user/change-password', authenticateToken, isEmailVerified, async (req, res) => {
    const { currentPassword, newPassword } = req.body; const userId = req.user.userId;
    if (!currentPassword || !newPassword || newPassword.length < 6) return res.status(400).json({ message: 'Invalid password details.' });
    try {
        const user = await User.findById(userId);
        if (!user || user.loginMethod === 'google' || !user.password) return res.status(400).json({ message: 'Password change not applicable or user not found.' });
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) return res.status(401).json({ message: 'Incorrect current password.' });
        user.password = await bcrypt.hash(newPassword, 12);
        await user.save();
        res.status(200).json({ message: 'Password changed successfully!' });
    } catch (error) { console.error('Password change error:', error); res.status(500).json({ message: 'Failed to change password.', error: error.message }); }
});
app.post('/api/user/upload-avatar', authenticateToken, isEmailVerified, upload.single('avatar'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) return res.status(500).json({ message: 'Avatar upload service is not configured on the server.' });
    try {
        const result = await new Promise((resolve, reject) => { cloudinary.uploader.upload_stream({ folder: 'nobita_feedback_avatars', transformation: [ { width: 150, height: 150, crop: "fill", gravity: "face", radius: "max" }, { quality: "auto:eco" } ] }, (error, result) => { if (error) return reject(new Error(error.message)); if (!result || !result.secure_url) return reject(new Error('Cloudinary did not return a URL.')); resolve(result); }).end(req.file.buffer); });
        const userId = req.user.userId; const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found.' });
        user.avatarUrl = result.secure_url; await user.save();
        await Feedback.updateMany({ userId: user._id }, { $set: { avatarUrl: user.avatarUrl } });
        const updatedUserForToken = { userId: user._id, name: user.name, email: user.email, avatarUrl: user.avatarUrl, loginMethod: user.loginMethod, isVerified: user.isVerified };
        const newToken = jwt.sign(updatedUserForToken, JWT_SECRET, { expiresIn: '7d' });
        res.status(200).json({ message: 'Avatar uploaded successfully!', avatarUrl: user.avatarUrl, token: newToken });
    } catch (error) { console.error('Avatar upload route error:', error); res.status(500).json({ message: 'Error uploading avatar.', error: error.message }); }
});


// --- Static Files & Feedback Routes (Main Server) ---
app.use(express.static(path.join(__dirname, 'public')));

app.get('/:page', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.endsWith('.js') || req.path.endsWith('.css') || req.path.endsWith('.ico') || req.path.endsWith('.png') || req.path.endsWith('.svg')) return next();

  const file = path.join(__dirname, 'public', `${req.params.page}.html`);
  fs.access(file, (err) => {
    if (err) return next();
    res.sendFile(file);
  });
});
app.get(['/index', '/index.html'], (req, res) => {
  res.redirect(301, '/');
});
app.get('/admin-panel', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-panel', 'index.html'));
});

app.get('/admin-login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
});

app.get('/api/feedbacks', async (req, res) => {
    try {
        const allFeedbacks = await Feedback.find()
            .populate({ path: 'userId', select: 'loginMethod isVerified email name avatarUrl createdAt' })
            .sort({ isPinned: -1, timestamp: -1 });

        res.status(200).json(allFeedbacks);
    } catch (error) {
        console.error("Error fetching feedbacks:", error);
        res.status(500).json({ message: 'Failed to fetch feedbacks.', error: error.message });
    }
});

app.post('/api/feedback', async (req, res) => {
    const { name: guestNameFromBody, guestId: guestIdFromBody, feedback, rating } = req.body;
    const userIp = req.clientIp;

    if (!feedback || !rating || rating === '0') {
        return res.status(400).json({ message: 'Feedback and rating are required.' });
    }

    let feedbackData = {
        feedback,
        rating: parseInt(rating),
        userIp,
        isEdited: false,
        readByAdmin: false,
    };

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    try {
        if (token) {
            let decodedUserPayload;
            try {
                decodedUserPayload = jwt.verify(token, JWT_SECRET);
            } catch (jwtError) {
                console.error("JWT Verification Error on feedback submission:", jwtError.message);
                return res.status(403).json({ message: "Your session is invalid or has expired. Please log in again to submit as a registered user, or refresh and submit as a guest." });
            }

            const loggedInUser = await User.findById(decodedUserPayload.userId);

            if (!loggedInUser) {
                console.warn(`Feedback submission: User ID ${decodedUserPayload.userId} from token not found in DB.`);
                return res.status(404).json({ message: "Authenticated user not found. Please try logging in again." });
            }

            feedbackData.name = loggedInUser.name;
            feedbackData.avatarUrl = loggedInUser.avatarUrl;
            feedbackData.userId = loggedInUser._id;
            if (loggedInUser.loginMethod === 'google' && loggedInUser.googleId) {
                feedbackData.googleIdSubmitter = loggedInUser.googleId;
            }
            feedbackData.guestId = null;

        } else {
            if (!guestNameFromBody) {
                return res.status(400).json({ message: 'Name is required for guest feedback.' });
            }
            if (!guestIdFromBody) {
                console.warn('Guest feedback submission missing guestId from frontend.');
                return res.status(400).json({ message: 'Guest identifier is missing for this session.' });
            }
            feedbackData.name = guestNameFromBody;
            feedbackData.guestId = guestIdFromBody;
            feedbackData.avatarUrl = getDiceBearAvatarUrl(guestNameFromBody, guestIdFromBody);
            feedbackData.userId = null;
        }

        const newFeedback = new Feedback(feedbackData);
        await newFeedback.save();

        sendPushNotificationToAdmin(newFeedback);

        res.status(201).json({ message: 'Your feedback has been successfully submitted!', feedback: newFeedback });

    } catch (error) {
        console.error("Feedback save error:", error);
        if (error.name === 'ValidationError') {
             return res.status(400).json({ message: `Validation Error: ${error.message}` });
        }
        res.status(500).json({ message: 'Failed to save feedback.', error: error.message });
    }
});

app.put('/api/feedback/:id', authenticateToken, isEmailVerified, async (req, res) => {
    const feedbackId = req.params.id;
    const { feedback, rating } = req.body;
    const loggedInJwtUser = req.user;
    if (!feedback || !rating || rating === '0') return res.status(400).json({ message: 'Feedback and rating are required for update!' });
    try {
        const existingFeedback = await Feedback.findById(feedbackId);
        if (!existingFeedback) return res.status(404).json({ message: 'This feedback ID was not found.' });
        if (!existingFeedback.userId || existingFeedback.userId.toString() !== loggedInJwtUser.userId) {
            return res.status(403).json({ message: 'You can only edit your own feedbacks.' });
        }
        const currentUserFromDb = await User.findById(loggedInJwtUser.userId);
        if (!currentUserFromDb) return res.status(404).json({ message: 'User attempting to edit feedback not found.' });
        const currentNameFromDb = currentUserFromDb.name;
        const currentAvatarFromDb = currentUserFromDb.avatarUrl;
        const parsedRating = parseInt(rating);
        const contentActuallyChanged = existingFeedback.feedback !== feedback || existingFeedback.rating !== parsedRating || existingFeedback.name !== currentNameFromDb || existingFeedback.avatarUrl !== currentAvatarFromDb;
        if (contentActuallyChanged) {
            if (!existingFeedback.originalContent) { existingFeedback.originalContent = { name: existingFeedback.name, feedback: existingFeedback.feedback, rating: existingFeedback.rating, timestamp: existingFeedback.timestamp }; }
            existingFeedback.name = currentNameFromDb; existingFeedback.feedback = feedback; existingFeedback.rating = parsedRating; existingFeedback.timestamp = Date.now(); existingFeedback.isEdited = true; existingFeedback.avatarUrl = currentAvatarFromDb;
        }
        await existingFeedback.save();
        res.status(200).json({ message: 'Your feedback has been updated!', feedback: existingFeedback });
    } catch (error) { console.error(`Feedback update error (ID: ${feedbackId}):`, error); res.status(500).json({ message: 'Failed to update profile.', error: error.message }); }
});

// --- Admin Panel Routes (NOW PROTECTED by authenticateAdminToken) ---
app.delete('/api/admin/feedback/:id', authenticateAdminToken, async (req, res) => { console.log(`ADMIN DEL: ${req.params.id}`); try { const fb = await Feedback.findByIdAndDelete(req.params.id); if (!fb) return res.status(404).json({ message: 'ID not found.' }); res.status(200).json({ message: 'Deleted.' }); } catch (e) { console.error(`ADMIN DEL ERR: ${req.params.id}`, e); res.status(500).json({ message: 'Failed.', error: e.message }); } });
app.delete('/api/admin/feedbacks/batch-delete', authenticateAdminToken, async (req, res) => { const { ids } = req.body; console.log(`ADMIN BATCH DEL:`, ids); if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: 'No IDs.' }); try { const r = await Feedback.deleteMany({ _id: { $in: ids } }); if (r.deletedCount === 0) return res.status(404).json({ message: 'None found.' }); res.status(200).json({ message: `${r.deletedCount} deleted.`, deletedCount: r.deletedCount }); } catch (e) { console.error(`ADMIN BATCH DEL ERR:`, e); res.status(500).json({ message: 'Failed.', error: e.message }); } });
app.post('/api/admin/feedback/:id/reply', authenticateAdminToken, async (req, res) => { const fId = req.params.id; const { replyText, adminName } = req.body; console.log(`ADMIN REPLY: ${fId}, Text: ${replyText}`); if (!replyText) return res.status(400).json({ message: 'Reply text missing.' }); try { const fb = await Feedback.findById(fId); if (!fb) return res.status(404).json({ message: 'ID not found.' }); fb.replies.push({ text: replyText, adminName: adminName || 'Admin', timestamp: new Date() }); await fb.save(); res.status(200).json({ message: 'Replied.', reply: fb.replies[fb.replies.length - 1] }); } catch (e) { console.error(`ADMIN REPLY ERR: ${fId}`, e); res.status(500).json({ message: 'Failed.', error: e.message }); } });

app.delete('/api/admin/feedback/:feedbackId/reply/:replyId', authenticateAdminToken, async (req, res) => {
    try {
        const { feedbackId, replyId } = req.params;
        const updatedFeedback = await Feedback.findByIdAndUpdate(
            feedbackId,
            { $pull: { replies: { _id: replyId } } },
            { new: true }
        );
        if (!updatedFeedback) {
            return res.status(404).json({ message: "Feedback or reply not found." });
        }
        res.status(204).send();
    } catch (error) {
        console.error("ADMIN DEL REPLY ERR:", error);
        res.status(500).json({ message: "Server error while deleting reply." });
    }
});

app.put('/api/admin/feedback/:feedbackId/reply/:replyId', authenticateAdminToken, async (req, res) => {
    try {
        const { feedbackId, replyId } = req.params;
        const { text } = req.body;
        if (!text || text.trim() === '') {
            return res.status(400).json({ message: "Reply text cannot be empty." });
        }
        const updatedFeedback = await Feedback.findOneAndUpdate(
            { "_id": feedbackId, "replies._id": replyId },
            { "$set": { "replies.$.text": text, "replies.$.timestamp": new Date() } },
            { new: true }
        );
        if (!updatedFeedback) {
            return res.status(404).json({ message: "Feedback or reply not found." });
        }
        res.status(200).json({ message: "Reply updated successfully." });
    } catch (error) {
        console.error("ADMIN EDIT REPLY ERR:", error);
        res.status(500).json({ message: "Server error while updating reply." });
    }
});

app.put('/api/admin/feedback/:id/pin', authenticateAdminToken, async (req, res) => {
    const { isPinned } = req.body;
    if (typeof isPinned !== 'boolean') {
        return res.status(400).json({ message: 'Invalid request: "isPinned" must be a boolean.' });
    }
    try {
        const feedbackToUpdate = await Feedback.findById(req.params.id).populate({ path: 'userId', select: 'loginMethod isVerified' });
        if (!feedbackToUpdate) {
            return res.status(404).json({ message: 'Feedback not found.' });
        }
        feedbackToUpdate.isPinned = isPinned;
        await feedbackToUpdate.save();
        console.log(`ADMIN PIN/UNPIN: Feedback ID ${req.params.id} set to isPinned: ${isPinned}`);
        res.status(200).json(feedbackToUpdate);
    } catch (error) {
        console.error(`ADMIN PIN/UNPIN ERR: ${req.params.id}`, error);
        res.status(500).json({ message: 'Server error while updating feedback.', error: error.message });
    }
});

app.put('/api/admin/feedback/:feedbackId/change-avatar', authenticateAdminToken, async (req, res) => {
    const { feedbackId } = req.params;
    console.log(`ADMIN AVATAR CHANGE FOR FEEDBACK: ${feedbackId}`);

    try {
        const feedback = await Feedback.findById(feedbackId);
        if (!feedback) {
            return res.status(404).json({ message: 'Feedback not found.' });
        }

        let newAvatarUrl;

        if (feedback.userId) {
            const user = await User.findById(feedback.userId);
            if (user) {
                if (!user.name) return res.status(400).json({ message: 'User name missing for avatar generation.' });

                newAvatarUrl = getDiceBearAvatarUrl(user.name, Date.now().toString());

                user.avatarUrl = newAvatarUrl;
                await user.save();

                await Feedback.updateMany({ userId: user._id }, { $set: { avatarUrl: newAvatarUrl } });

                const updatedFeedback = await Feedback.findById(feedbackId).populate({ path: 'userId', select: 'loginMethod isVerified' });
                return res.status(200).json(updatedFeedback);
            }
        }

        if (!feedback.name) return res.status(400).json({ message: 'Guest name missing for avatar generation.' });

        newAvatarUrl = getDiceBearAvatarUrl(feedback.name, Date.now().toString());
        feedback.avatarUrl = newAvatarUrl;
        await feedback.save();

        res.status(200).json(feedback);

    } catch (error) {
        console.error(`ADMIN AVATAR CHANGE ERR ON FEEDBACK ${feedbackId}:`, error);
        res.status(500).json({ message: 'Failed to change avatar due to server error.', error: error.message });
    }
});

app.patch('/api/admin/feedbacks/:id/mark-read', authenticateAdminToken, async (req, res) => {
    try {
        const feedbackId = req.params.id;
        const feedback = await Feedback.findByIdAndUpdate(
            feedbackId,
            { $set: { readByAdmin: true } },
            { new: true }
        );
        if (!feedback) {
            return res.status(404).json({ message: 'Feedback not found.' });
        }
        res.status(200).json({ success: true, message: 'Feedback marked as read.', feedback });
    } catch (error) {
        console.error(`Error marking feedback ${req.params.id} as read:`, error);
        res.status(500).json({ message: 'Failed to mark feedback as read.', error: error.message });
    }
});


// --- BLOG API ROUTES ADDED HERE (NOW PROTECTED by authenticateAdminToken) ---
app.post('/api/admin/blog', authenticateAdminToken, async (req, res) => {
  const { link, title, summary, badge } = req.body;
  if (!link || !title || !summary) return res.status(400).json({ message: 'Missing fields.' });
  try {
    const blog = new Blog({ link, title, summary, badge });
    await blog.save();
    res.status(201).json({ message: 'Blog created.', blog });
  } catch (err) {
    res.status(500).json({ message: 'Fail.', error: err.message });
  }
});

app.get('/api/blogs', async (req, res) => {
  try {
    const blogs = await Blog.find().sort({ date: -1 });
    res.json(blogs);
  } catch (error) {
    console.error("Error fetching blogs:", error);
    res.status(500).json({ message: "Failed to fetch blogs.", error: error.message });
  }
});

app.delete('/api/admin/blog/:id', authenticateAdminToken, async (req, res) => {
  try {
    const deletedBlog = await Blog.findByIdAndDelete(req.params.id);
    if (!deletedBlog) {
      return res.status(404).json({ message: 'Blog not found.' });
    }
    res.json({ message: 'Blog deleted successfully.' });
  } catch (e) {
    console.error("Delete blog error:", e);
    res.status(500).json({ message: 'Failed to delete blog.', error: e.message });
  }
});

app.put('/api/admin/blog/:id', authenticateAdminToken, async (req, res) => {
  const { link, title, summary, badge } = req.body;
  if (!link || !title || !summary) return res.status(400).json({ message: 'Missing fields for update.' });
  try {
    const blog = await Blog.findByIdAndUpdate(
      req.params.id,
      { link, title, summary, badge },
      { new: true, runValidators: true }
    );
    if (!blog) {
      return res.status(404).json({ message: 'Blog not found.' });
    }
    res.json({ message: 'Blog updated successfully.', blog });
  } catch (e) {
    console.error("Update blog error:", e);
    res.status(500).json({ message: 'Failed to update blog.', error: e.message });
  }
});

// --- Web Push Notification Setup ---
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

app.get('/api/vapid-public-key', (req, res) => {
    if (!process.env.VAPID_PUBLIC_KEY) {
        console.error("VAPID_PUBLIC_KEY is not set in environment variables when serving to frontend.");
        return res.status(500).json({ message: "VAPID public key not configured on server." });
    }
    res.send(process.env.VAPID_PUBLIC_KEY);
});

app.post('/api/admin/save-subscription', authenticateAdminToken, async (req, res) => {
    const subscription = req.body.subscription || req.body;
    if (!subscription || !subscription.endpoint) {
        return res.status(400).json({ message: 'No push subscription data provided, or endpoint missing.' });
    }
    try {
        const adminUser = await User.findOne({ username: ADMIN_USERNAME });
        if (!adminUser) {
            return res.status(404).json({ message: 'Admin user not found in database.' });
        }
        adminUser.pushSubscription = subscription;
        await adminUser.save();
        adminPushSubscription = subscription;
        console.log("Admin push subscription saved to DB and in-memory.");
        res.status(201).json({ message: 'Admin push subscription saved successfully!' });
    } catch (error) {
        console.error("Error saving admin push subscription:", error);
        res.status(500).json({ message: 'Failed to save admin push subscription.', error: error.message });
    }
});


async function sendPushNotificationToAdmin(feedback) {
  if (adminPushSubscription) {
    const payload = JSON.stringify({
      title: 'New Feedback Received!',
      body: `From: ${feedback.name} | Rating: ${feedback.rating}\n"${feedback.feedback}"`,
      icon: '/icons/icon-192x192.png'
    });

    webpush.sendNotification(adminPushSubscription, payload)
      .then(() => console.log('Push notification sent to admin!'))
      .catch(async err => {
        console.error('Error sending push notification to admin:', err);
        if (err.statusCode === 404 || err.statusCode === 410) {
            console.warn('Admin push subscription is no longer valid. Clearing it from memory and DB.');
            adminPushSubscription = null;

            try {
                const adminUserInDB = await User.findOne({ username: ADMIN_USERNAME });
                if (adminUserInDB) {
                    adminUserInDB.pushSubscription = null;
                    await adminUserInDB.save();
                    console.log('Invalid admin push subscription removed from DB.');
                }
            } catch (dbError) {
                console.error('Error removing invalid subscription from DB:', dbError);
            }
        }
      });
  } else {
    console.log('No admin push subscription found. Cannot send notification.');
  }
}

// Fallback for unmatched API routes and other static files
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({message: "API endpoint not found."});
  } else {
    res.sendFile(path.join(__dirname, 'public', req.path));
  }
});
// --- SERVER RESTART ENDPOINT (Admin protected) ---
app.post('/api/admin/restart', authenticateAdminToken, (req, res) => {
  res.json({ message: 'Server restarting now...' });
  setTimeout(() => {
    process.exit(0); // Render will auto-restart the process
  }, 800);
});

// server.js (Add this new API endpoint)

// --- API to Create a New Page from Template (Admin Protected) ---
app.post('/api/admin/create-page-from-template', authenticateAdminToken, async (req, res) => {
    const {
        pageName,
        pageTitle,
        metaDescription,
        metaKeywords,
        pageContent,
        inlineCss,
        inlineJs,
        // NEW FIELDS FROM FRONTEND
        websiteTitle,
        heroTitle,
        heroEmoji,
        heroPara
    } = req.body;

    // Validate new required fields as well
    if (!pageName || !pageTitle || !pageContent || !websiteTitle || !heroTitle || !heroPara) {
        return res.status(400).json({ message: 'Page name, title, content, website title, hero title, and hero paragraph are required.' });
    }

    // Ensure the pageName ends with .html
    const fileName = pageName.endsWith('.html') ? pageName : `${pageName}.html`;
    const filePath = path.join(__dirname, 'public', fileName);

    // Basic validation to prevent path traversal
    if (filePath.includes('..') || !filePath.startsWith(path.join(__dirname, 'public'))) {
        return res.status(400).json({ message: 'Invalid page name.' });
    }

    const templatePath = path.join(__dirname, 'template.html');

    try {
        let templateContent = await fs.promises.readFile(templatePath, 'utf8');

        // Replace placeholders in the template
        templateContent = templateContent.replace(/PAGE TITLE HERE/g, pageTitle);
        templateContent = templateContent.replace(/Meta description here/g, metaDescription || ''); // Use empty string if not provided
        templateContent = templateContent.replace(/Nobita, keywords, update, new content/g, metaKeywords || 'Nobita, custom page'); // Default for keywords if empty
        
        // Replace NEW Content Placeholders
        templateContent = templateContent.replace(/WEBSITE_TITLE_PLACEHOLDER/g, websiteTitle);
        templateContent = templateContent.replace(/HERO_TITLE_PLACEHOLDER/g, heroTitle);
        templateContent = templateContent.replace(/HERO_EMOJI_PLACEHOLDER/g, heroEmoji || ''); // Emoji can be empty
        templateContent = templateContent.replace(/HERO_PARA_PLACEHOLDER/g, heroPara);
        templateContent = templateContent.replace(/MAIN_CONTENT_PLACEHOLDER/g, pageContent);


        // Inject inline CSS if provided
        if (inlineCss) {
            templateContent = templateContent.replace('</head>', `<style>\n${inlineCss}\n</style>\n</head>`);
        }

        // Inject inline JavaScript if provided
        if (inlineJs) {
            // Find the last </body> tag (or before the last </html> if </body> is missing)
            // This is a more robust way to inject script at the end of the body
            const bodyEndIndex = templateContent.lastIndexOf('</body>');
            if (bodyEndIndex !== -1) {
                templateContent = templateContent.substring(0, bodyEndIndex) +
                                  `<script>\n${inlineJs}\n</script>\n` +
                                  templateContent.substring(bodyEndIndex);
            } else {
                // Fallback if </body> is not found (unlikely with your template)
                templateContent = templateContent.replace('</html>', `<script>\n${inlineJs}\n</script>\n</html>`);
            }
        }
        
        await fs.promises.writeFile(filePath, templateContent);

        res.status(200).json({ message: `Page "${fileName}" created successfully in public folder.` });

    } catch (error) {
        console.error('Error creating page from template:', error);
        res.status(500).json({ message: 'Failed to create page from template.', error: error.message });
    }
});


// --- Server Start ---
app.listen(PORT, () => {
    console.log(`Nobita's server with File Manager is running on port ${PORT}: http://localhost:${PORT}`);
    console.log(`File Manager UI available at http://localhost:${PORT}/admin-panel/file-manager.html`);
});
