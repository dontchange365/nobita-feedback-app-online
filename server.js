// Complete Server File with Configuration

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

// Load Environment Variables
dotenv.config();

const app = express();
app.use(express.json());
app.use(cors({ origin: process.env.FRONTEND_URL }));

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.error('MongoDB Connection Error:', err));

// Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Nodemailer setup
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// User Schema
const UserSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  avatarUrl: String
});
const User = mongoose.model('User', UserSchema);

// JWT Middleware
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ message: 'Token invalid or expired' });
    req.userId = decoded.userId;
    next();
  });
};

// Avatar upload setup
const storage = multer.memoryStorage();
const upload = multer({ storage });

app.post('/api/user/upload-avatar', authMiddleware, upload.single('avatar'), async (req, res) => {
  try {
    const result = await cloudinary.uploader.upload_stream({ folder: 'avatars' }, (error, result) => {
      if (error) return res.status(400).json({ message: 'Cloudinary error', error });
      User.findByIdAndUpdate(req.userId, { avatarUrl: result.secure_url }, { new: true }, (err, user) => {
        if (err || !user) return res.status(400).json({ message: 'User update error' });
        res.json({ avatarUrl: user.avatarUrl });
      });
    });
    result.end(req.file.buffer);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

// Server listen
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
