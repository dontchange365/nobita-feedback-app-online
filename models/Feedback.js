const mongoose = require('mongoose');

const feedbackSchema = mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User' // Reference to the User model
    },
    name: { // User's name at the time of feedback
        type: String,
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
        required: true
    },
    media: [{ // Array of media URLs from Cloudinary
        type: String
    }]
}, {
    timestamps: true // Adds createdAt and updatedAt fields
});

const Feedback = mongoose.model('Feedback', feedbackSchema);

module.exports = Feedback;