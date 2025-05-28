require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { OAuth2Client } = require('google-auth-library');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// --- MongoDB Connection ---
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB connected')).catch(err => console.error(err));

// --- Cloudinary config ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// --- Nodemailer setup ---
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// --- Google OAuth Client ---
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// --- Models ---

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String },
  avatarUrl: { type: String, default: 'https://i.ibb.co/FsSs4SG/creator-avatar.png' },
  googleId: { type: String },
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  isAdmin: { type: Boolean, default: false }
}, { timestamps: true });

const FeedbackSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  originalText: { type: String, required: true },
  editedText: { type: String }, // User can edit feedback later
  replies: [{
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    text: String,
    createdAt: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date }
});

const User = mongoose.model('User', UserSchema);
const Feedback = mongoose.model('Feedback', FeedbackSchema);

// --- Middleware ---

const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Unauthorized: Token missing' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Forbidden: Token invalid' });
    req.user = user;
    next();
  });
};

const adminAuthenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ message: 'Unauthorized' });

  const basicAuth = authHeader.split(' ')[1];
  if (!basicAuth) return res.status(401).json({ message: 'Unauthorized' });

  const [username, password] = Buffer.from(basicAuth, 'base64').toString().split(':');
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    next();
  } else {
    res.status(403).json({ message: 'Forbidden: Admin creds wrong' });
  }
};

// --- Utils ---

async function sendResetEmail(email, token) {
  const resetLink = `${process.env.FRONTEND_URL}/reset-password.html?token=${token}`;
  await transporter.sendMail({
    from: `"Nobi Bot" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Password Reset Request",
    html: `<p>Tere account ke liye password reset karne ke liye, niche link pe click kar:</p><a href="${resetLink}">${resetLink}</a><p>Yeh link 1 ghante ke liye valid hai.</p>`
  });
}

// --- Routes ---

// Register User
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if(!name || !email || !password) return res.status(400).json({ message: 'Saare fields bhar, bhenchod!' });

    const existing = await User.findOne({ email });
    if(existing) return res.status(400).json({ message: 'Email pehle se register hai!' });

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = new User({ name, email, passwordHash });
    await user.save();

    res.status(201).json({ message: 'Register ho gaya, ab login kar!' });
  } catch(err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Login User
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if(!email || !password) return res.status(400).json({ message: 'Email aur password do!' });

    const user = await User.findOne({ email });
    if(!user) return res.status(400).json({ message: 'Email ya password galat hai!' });
    if(!user.passwordHash) return res.status(400).json({ message: 'Google login se banaya gaya account hai, password nahi hai!' });

    const validPass = await bcrypt.compare(password, user.passwordHash);
    if(!validPass) return res.status(400).json({ message: 'Email ya password galat hai!' });

    const token = jwt.sign({ id: user._id, email: user.email, isAdmin: user.isAdmin }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({ token, user: { id: user._id, name: user.name, email: user.email, avatarUrl: user.avatarUrl } });
  } catch(err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Google Login
app.post('/api/google-login', async (req, res) => {
  try {
    const { tokenId } = req.body;
    const ticket = await googleClient.verifyIdToken({ idToken: tokenId, audience: process.env.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();

    let user = await User.findOne({ email: payload.email });
    if(!user) {
      user = new User({
        name: payload.name,
        email: payload.email,
        googleId: payload.sub,
        avatarUrl: payload.picture,
      });
      await user.save();
    }

    const token = jwt.sign({ id: user._id, email: user.email, isAdmin: user.isAdmin }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, avatarUrl: user.avatarUrl } });
  } catch(err) {
    res.status(500).json({ message: 'Google login failed' });
  }
});

// Forgot password - generate token and send mail
app.post('/api/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if(!email) return res.status(400).json({ message: 'Email de!' });

    const user = await User.findOne({ email });
    if(!user) return res.status(400).json({ message: 'Email registered nahi hai' });

    const resetToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    await sendResetEmail(email, resetToken);
    res.json({ message: 'Password reset link mail kar diya' });
  } catch(err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Reset password
app.post('/api/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if(!token || !newPassword) return res.status(400).json({ message: 'Token aur naya password de!' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({
      _id: decoded.id,
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });
    if(!user) return res.status(400).json({ message: 'Invalid ya expired token' });

    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    res.json({ message: 'Password reset ho gaya, ab login kar!' });
  } catch(err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user profile
app.get('/api/profile', authenticateToken, async (req, res) => {
  const user = await User.findById(req.user.id).select('-passwordHash -resetPasswordToken -resetPasswordExpires');
  if(!user) return res.status(404).json({ message: 'User nahi mila' });
  res.json(user);
});

// Update profile avatar
const upload = multer();
app.post('/api/profile/avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
  if(!req.file) return res.status(400).json({ message: 'Avatar file bhej!' });

  // Upload to cloudinary stream
  let streamUpload = (req) => {
    return new Promise((resolve, reject) => {
      let stream = cloudinary.uploader.upload_stream(
        { folder: 'avatars' },
        (error, result) => {
          if(result) resolve(result);
          else reject(error);
        }
      );
      streamifier.createReadStream(req.file.buffer).pipe(stream);
    });
  };

  try {
    const result = await streamUpload(req);
    const user = await User.findById(req.user.id);
    user.avatarUrl = result.secure_url;
    await user.save();
    res.json({ avatarUrl: result.secure_url });
  } catch(e) {
    res.status(500).json({ message: 'Cloudinary upload failed' });
  }
});

// --- Feedback CRUD ---

// Create feedback
app.post('/api/feedback', authenticateToken, async (req, res) => {
  const { text } = req.body;
  if(!text) return res.status(400).json({ message: 'Feedback text de!' });

  const feedback = new Feedback({
    user: req.user.id,
    originalText: text,
    editedText: text,
  });
  await feedback.save();
  res.status(201).json(feedback);
});

// Get all feedbacks (for user - own only)
app.get('/api/feedback', authenticateToken, async (req, res) => {
  const feedbacks = await Feedback.find({ user: req.user.id }).sort({ createdAt: -1 });
  res.json(feedbacks);
});

// Update feedback (only own)
app.put('/api/feedback/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { editedText } = req.body;

  const feedback = await Feedback.findById(id);
  if(!feedback) return res.status(404).json({ message: 'Feedback nahi mila' });
  if(feedback.user.toString() !== req.user.id) return res.status(403).json({ message: 'Tu apna feedback hi edit kar sakta hai!' });

  feedback.editedText = editedText;
  feedback.updatedAt = new Date();
  await feedback.save();

  res.json(feedback);
});

// Delete feedback (only own)
app.delete('/api/feedback/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  const feedback = await Feedback.findById(id);
  if(!feedback) return res.status(404).json({ message: 'Feedback nahi mila' });
  if(feedback.user.toString() !== req.user.id) return res.status(403).json({ message: 'Tu apna feedback hi delete kar sakta hai!' });

  await Feedback.deleteOne({ _id: id });
  res.json({ message: 'Feedback delete ho gaya' });
});

// --- Admin routes ---

// Admin login not needed, use basic auth middleware

// Get all users with avatars (admin)
app.get('/api/admin/users', adminAuthenticate, async (req, res) => {
  const users = await User.find({}, 'name email avatarUrl isAdmin createdAt');
  res.json(users);
});

// Update user avatar (admin)
app.put('/api/admin/users/:id/avatar', adminAuthenticate, async (req, res) => {
  const { id } = req.params;
  const { avatarUrl } = req.body;
  if(!avatarUrl) return res.status(400).json({ message: 'Naya avatar url de!' });

  const user = await User.findById(id);
  if(!user) return res.status(404).json({ message: 'User nahi mila' });

  user.avatarUrl = avatarUrl;
  await user.save();
  res.json({ message: 'User avatar update ho gaya' });
});

// Get all feedbacks with user info (admin)
app.get('/api/admin/feedbacks', adminAuthenticate, async (req, res) => {
  const feedbacks = await Feedback.find()
    .populate('user', 'name email avatarUrl')
    .populate('replies.adminId', 'name email')
    .sort({ createdAt: -1 });
  res.json(feedbacks);
});

// Admin reply on feedback
app.post('/api/admin/feedbacks/:id/reply', adminAuthenticate, async (req, res) => {
  const { id } = req.params;
  const { text } = req.body;
  if(!text) return res.status(400).json({ message: 'Reply text de!' });

  const feedback = await Feedback.findById(id);
  if(!feedback) return res.status(404).json({ message: 'Feedback nahi mila' });

  feedback.replies.push({ adminId: null, text, createdAt: new Date() }); // adminId null for now
  await feedback.save();
  res.json({ message: 'Reply add ho gaya' });
});

// --- Start server ---
app.listen(PORT, () => {
  console.log(`Server chal raha hai port ${PORT}`);
});
