// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer');
const nodemailer = require('nodemailer');
const { OAuth2Client } = require('google-auth-library');
const cloudinary = require('cloudinary').v2;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files (put your frontend files in /public)
app.use(express.static(path.join(__dirname, 'public')));

// Fallback route for SPA frontend
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ message: 'API not found' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('MongoDB connected')).catch(err => {
  console.error('MongoDB error:', err);
  process.exit(1);
});

// Models
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true, required: true },
  passwordHash: String,
  avatar: { type: String, default: 'https://i.ibb.co/FsSs4SG/creator-avatar.png' },
  googleId: String,
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  resetToken: String,
  resetTokenExpire: Date,
});
const User = mongoose.model('User', userSchema);

const feedbackSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  username: { type: String, required: true },
  avatar: { type: String, required: true },
  rating: { type: Number, min: 1, max: 5, required: true },
  text: { type: String, maxlength: 500, required: true },
  date: { type: Date, default: Date.now },
  adminReply: { type: String, default: '' },
});
const Feedback = mongoose.model('Feedback', feedbackSchema);

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Unauthorized: No token' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ message: 'Unauthorized: Invalid token' });
  }
}

function adminAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Basic ')) return res.status(401).json({ message: 'Unauthorized' });
  const base64 = auth.split(' ')[1];
  const [user, pass] = Buffer.from(base64, 'base64').toString().split(':');
  if (user === process.env.ADMIN_USERNAME && pass === process.env.ADMIN_PASSWORD) next();
  else res.status(401).json({ message: 'Unauthorized: Invalid admin credentials' });
}

const upload = multer({ storage: multer.memoryStorage() });

// --- Routes ---

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'All fields required' });
    if (await User.findOne({ email })) return res.status(400).json({ message: 'Email already registered' });
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, passwordHash });
    const token = jwt.sign({ id: user._id, role: user.role, name: user.name, avatar: user.avatar }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, avatar: user.avatar } });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'All fields required' });
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid email or password' });
    if (!(await bcrypt.compare(password, user.passwordHash))) return res.status(400).json({ message: 'Invalid email or password' });
    const token = jwt.sign({ id: user._id, role: user.role, name: user.name, avatar: user.avatar }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, avatar: user.avatar } });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/auth/google', async (req, res) => {
  try {
    const { tokenId } = req.body;
    const ticket = await googleClient.verifyIdToken({ idToken: tokenId, audience: process.env.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    if (!payload.email_verified) return res.status(400).json({ message: 'Google email not verified' });
    let user = await User.findOne({ email: payload.email });
    if (!user) user = await User.create({ name: payload.name, email: payload.email, avatar: payload.picture || 'https://i.ibb.co/FsSs4SG/creator-avatar.png', googleId: payload.sub });
    const token = jwt.sign({ id: user._id, role: user.role, name: user.name, avatar: user.avatar }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, avatar: user.avatar } });
  } catch {
    res.status(500).json({ message: 'Google login failed' });
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email required' });
    const user = await User.findOne({ email });
    if (!user) return res.json({ message: 'If email exists, reset link sent' });
    const resetToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    user.resetToken = resetToken;
    user.resetTokenExpire = Date.now() + 3600000;
    await user.save();
    const resetLink = `${process.env.FRONTEND_URL}/reset-password.html?token=${resetToken}`;
    await transporter.sendMail({
      from: `"Nobi Bot Feedback" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: 'Password Reset Link',
      html: `<p>Reset password <a href="${resetLink}">here</a>. Link valid for 1 hour.</p>`,
    });
    res.json({ message: 'If email exists, reset link sent' });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ message: 'Token and new password required' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({ _id: decoded.id, resetToken: token, resetTokenExpire: { $gt: Date.now() } });
    if (!user) return res.status(400).json({ message: 'Invalid or expired token' });
    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.resetToken = undefined;
    user.resetTokenExpire = undefined;
    await user.save();
    res.json({ message: 'Password reset successful' });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ id: user._id, name: user.name, email: user.email, avatar: user.avatar, role: user.role });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/user/avatar', authMiddleware, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({ folder: 'avatars' }, (error, result) => {
        if (error) reject(error);
        else resolve(result);
      });
      stream.end(req.file.buffer);
    });
    await User.findByIdAndUpdate(req.user.id, { avatar: result.secure_url });
    res.json({ avatarUrl: result.secure_url });
  } catch {
    res.status(500).json({ message: 'Upload failed' });
  }
});

app.post('/api/feedback', async (req, res) => {
  try {
    let user = null;
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        user = await User.findById(payload.id);
      } catch {}
    }
    const { rating, text } = req.body;
    if (!rating || !text || text.trim().length === 0) return res.status(400).json({ message: 'Rating and text required' });
    if (text.length > 500) return res.status(400).json({ message: 'Text max 500 chars' });
    const feedback = await Feedback.create({
      userId: user?._id || null,
      username: user?.name || 'Guest',
      avatar: user?.avatar || 'https://i.ibb.co/FsSs4SG/creator-avatar.png',
      rating,
      text,
    });
    res.json({ feedback });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/feedback', async (req, res) => {
  try {
    const feedbacks = await Feedback.find().sort({ date: -1 }).limit(100).lean();
    res.json({ feedbacks });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/feedback/:id', authMiddleware, async (req, res) => {
  try {
    const fb = await Feedback.findById(req.params.id);
    if (!fb) return res.status(404).json({ message: 'Feedback not found' });
    if (!fb.userId || fb.userId.toString() !== req.user.id) return res.status(403).json({ message: 'Forbidden' });
    const { rating, text } = req.body;
    if (!rating || !text || text.trim().length === 0) return res.status(400).json({ message: 'Rating and text required' });
    if (text.length > 500) return res.status(400).json({ message: 'Text max 500 chars' });
    fb.rating = rating;
    fb.text = text;
    await fb.save();
    res.json({ feedback: fb });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

app.delete('/api/feedback/:id', authMiddleware, async (req, res) => {
  try {
    const fb = await Feedback.findById(req.params.id);
    if (!fb) return res.status(404).json({ message: 'Feedback not found' });
    const user = await User.findById(req.user.id);
    if (!user) return res.status(401).json({ message: 'Unauthorized' });
    if (fb.userId && fb.userId.toString() === req.user.id) {
      await fb.remove();
      return res.json({ message: 'Feedback deleted' });
    }
    if (user.role === 'admin') {
      await fb.remove();
      return res.json({ message: 'Feedback deleted by admin' });
    }
    res.status(403).json({ message: 'Forbidden' });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/admin/feedback/:id/reply', adminAuth, async (req, res) => {
  try {
    const { replyText } = req.body;
    if (!replyText || replyText.trim().length === 0) return res.status(400).json({ message: 'Reply text required' });
    const fb = await Feedback.findById(req.params.id);
    if (!fb) return res.status(404).json({ message: 'Feedback not found' });
    fb.adminReply = replyText;
    await fb.save();
    res.json({ message: 'Reply saved', feedback: fb });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/admin/users', adminAuth, async (req, res) => {
  try {
    const users = await User.find().select('-passwordHash -resetToken -resetTokenExpire').lean();
    res.json({ users });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/admin/user/:id/avatar', adminAuth, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({ folder: 'avatars' }, (error, result) => {
        if (error) reject(error);
        else resolve(result);
      });
      stream.end(req.file.buffer);
    });
    await User.findByIdAndUpdate(req.params.id, { avatar: result.secure_url });
    res.json({ avatarUrl: result.secure_url });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));