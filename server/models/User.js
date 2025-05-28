const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        // Password is not required if logging in via Google
    },
    avatar: {
        type: String,
        default: 'https://res.cloudinary.com/dyv7xav3e/image/upload/v1700000000/default-avatar.png' // Default Cloudinary avatar
    },
    googleId: {
        type: String,
        unique: true,
        sparse: true // Allows null values
    },
    isAdmin: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function (next) {
    if (this.isModified('password') && this.password) { // Only hash if password exists and is modified
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    }
    next();
});

// Method to compare passwords
userSchema.methods.matchPassword = async function (enteredPassword) {
    if (!this.password) return false; // If user has no password (e.g., Google login), cannot match
    return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);
module.exports = User;
