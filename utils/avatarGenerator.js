// utils/avatarGenerator.js

const { avatarUrls } = require('../services/cloudinaryAvatars');

function getRandomCloudinaryAvatarUrl() {
    const randomIndex = Math.floor(Math.random() * avatarUrls.length);
    return avatarUrls[randomIndex];
}

module.exports = { getRandomCloudinaryAvatarUrl };
