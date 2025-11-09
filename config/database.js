// config/database.js
const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const dotenv = require('dotenv');
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  username: { type: String, unique: true, sparse: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String },
  googleId: { type: String, sparse: true, unique: true },
  avatarUrl: { type: String },
  publicId: { type: String, default: null }, // NEW: publicId field add karein
  hasCustomAvatar: { type: Boolean, default: false },
  loginMethod: { type: String, enum: ['email', 'google'], required: true },
  createdAt: { type: Date, default: Date.now },
  resetPasswordToken: { type: String, default: undefined },
  resetPasswordExpires: { type: Date, default: undefined },
  isVerified: { type: Boolean, default: false },
  emailVerificationToken: { type: String, default: undefined },
  emailVerificationExpires: { type: Date, default: undefined },
  pushSubscription: { type: Object, default: null }
});

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
  readByAdmin: { type: Boolean, default: false },
  
  // NEW FIELD: AI processing flag for scheduler
  isAiProcessed: { type: Boolean, default: false },
  
  // NEW FIELD: Tracking upvote count for the last email sent
  lastEmailUpvoteCount: { 
      type: Number, 
      default: 0 // Shuruat mein 0 set hoga
  },
  
  // --- UPDATED VOTE FIELDS (Upvote Only) START ---
  upvotes: [{ // User IDs who upvoted
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false
  }],
  upvoteGuests: [{ // Guest IDs who upvoted
      type: String, 
      required: false
  }],
  upvoteCount: { // Total upvote count
      type: Number,
      default: 0
  }
  // --- UPDATED VOTE FIELDS (Upvote Only) END ---
});

// Add the pagination plugin to the schema
feedbackSchema.plugin(mongoosePaginate);

const blogSchema = new mongoose.Schema({
  link: { type: String, required: true },
  title: { type: String, required: true },
  summary: { type: String, required: true },
  badge: { type: String, default: '' },
  author: { type: String, default: 'Nobita' },
  date: { type: Date, default: Date.now }
});

const notificationSubscriptionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  subscription: { type: Object, required: true },
  createdAt: { type: Date, default: Date.now }
});

// New schema for admin's last seen feedback
const adminSettingsSchema = new mongoose.Schema({
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  lastSeenFeedbackTimestamp: { type: Date, default: Date.now }
});

// NEW SCHEMA for tracking avatar usage
const avatarUsageSchema = new mongoose.Schema({
  url: { type: String, required: true, unique: true },
  usageCount: { type: Number, default: 0 }
});


mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB connection successful!');
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
});

module.exports = {
  User: mongoose.model('User', userSchema),
  Feedback: mongoose.model('Feedback', feedbackSchema),
  Blog: mongoose.model('Blog', blogSchema),
  NotificationSubscription: mongoose.model('NotificationSubscription', notificationSubscriptionSchema),
  AdminSettings: mongoose.model('AdminSettings', adminSettingsSchema),
  AvatarUsage: mongoose.model('AvatarUsage', avatarUsageSchema)
};
