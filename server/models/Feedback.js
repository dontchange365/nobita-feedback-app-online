const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    comment: {
        type: String,
        required: true,
        trim: true,
        maxlength: 500
    },
    adminReply: {
        text: {
            type: String,
            trim: true,
            maxlength: 500
        },
        adminId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        adminAvatar: { // Store admin avatar for consistent display
            type: String,
            default: 'https://res.cloudinary.com/dyv7xav3e/image/upload/v1700000000/admin-avatar.png' // Static admin avatar
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }
}, { timestamps: true });

const Feedback = mongoose.model('Feedback', feedbackSchema);
module.exports = Feedback;
