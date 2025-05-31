const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minlength: 3
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        match: [/.+@.+\..+/, 'Please use a valid email address']
    },
    password: {
        type: String,
        required: function() {
            // Password is not required if signed up via Google
            return !this.googleId;
        },
        minlength: [6, 'Password must be at least 6 characters long'],
        select: false // Do not return password by default on queries
    },
    profilePicture: {
        type: String,
        default: 'https://res.cloudinary.com/dyv7xav3e/image/upload/v1717171717/default-avatar.png' // Default avatar
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    googleId: String, // To store Google user ID
    isAdmin: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Pre-save hook to hash password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('password') || !this.password) { // Only hash if password field is modified and exists
        return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Method to compare passwords
userSchema.methods.matchPassword = async function(enteredPassword) {
    if (!this.password) return false; // No password to match if signed up via Google
    return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = User;