// routes/avatars.js

const express = require('express');
const router = express.Router();
const { avatarUrls } = require('../services/cloudinaryAvatars');

// New endpoint to get the list of all default avatars
router.get('/api/avatars/default', (req, res) => {
    try {
        res.status(200).json({ urls: avatarUrls });
    } catch (error) {
        console.error("Error fetching default avatars:", error);
        res.status(500).json({ message: "Failed to fetch default avatars." });
    }
});

module.exports = router;
