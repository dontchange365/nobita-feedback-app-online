// utils/avatarGenerator.js

const { avatarUrls } = require('../services/cloudinaryAvatars');
const { AvatarUsage } = require('../config/database');

async function getLeastUsedAvatarUrl() {
    const leastUsedAvatars = await AvatarUsage.find().sort({ usageCount: 1 }).limit(10);
    
    const usedUrls = new Set(leastUsedAvatars.map(item => item.url));
    const unusedUrls = avatarUrls.filter(url => !usedUrls.has(url));

    if (unusedUrls.length > 0) {
        const randomIndex = Math.floor(Math.random() * unusedUrls.length);
        const selectedUrl = unusedUrls[randomIndex];
        await AvatarUsage.create({ url: selectedUrl, usageCount: 1 });
        return selectedUrl;
    }

    if (leastUsedAvatars.length > 0) {
        const minUsageCount = leastUsedAvatars[0].usageCount;
        const candidates = leastUsedAvatars.filter(item => item.usageCount === minUsageCount);
        const randomIndex = Math.floor(Math.random() * candidates.length);
        const selectedUrl = candidates[randomIndex].url;

        await AvatarUsage.findOneAndUpdate({ url: selectedUrl }, { $inc: { usageCount: 1 } });
        
        return selectedUrl;
    }

    const randomIndex = Math.floor(Math.random() * avatarUrls.length);
    return avatarUrls[randomIndex];
}

async function getAndIncrementAvatarUsage(url) {
    if (!url) return;
    await AvatarUsage.findOneAndUpdate({ url }, { $inc: { usageCount: 1 } }, { upsert: true, new: true });
}

async function initializeAvatarUsage() {
    for (const url of avatarUrls) {
        await AvatarUsage.findOneAndUpdate({ url }, {}, { upsert: true, new: true, setDefaultsOnInsert: true });
    }
}
initializeAvatarUsage();

module.exports = { getLeastUsedAvatarUrl, getAndIncrementAvatarUsage };
