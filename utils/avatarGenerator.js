// utils/avatarGenerator.js

const { avatarUrls } = require('../services/cloudinaryAvatars');
const { AvatarUsage } = require('../config/database');

async function getLeastUsedAvatarUrl() {
    // Sabse kam usage count wale avatars ko dhoondhenge
    const leastUsedAvatars = await AvatarUsage.find().sort({ usageCount: 1 }).limit(10);
    
    // Agar koi avatar database mein nahi hai, ya sare avatars ka usage count 0 hai,
    // to sabse pehle un avatars ko chune jo abhi tak database me nahi hai.
    const usedUrls = new Set(leastUsedAvatars.map(item => item.url));
    const unusedUrls = avatarUrls.filter(url => !usedUrls.has(url));

    if (unusedUrls.length > 0) {
        const randomIndex = Math.floor(Math.random() * unusedUrls.length);
        const selectedUrl = unusedUrls[randomIndex];
        // FIX: 'create' ki jagah 'findOneAndUpdate' use karein taaki duplicate key error na aaye
        await AvatarUsage.findOneAndUpdate({ url: selectedUrl }, { $inc: { usageCount: 1 } }, { upsert: true, new: true });
        return selectedUrl;
    }

    // Agar saare avatars database me hain, to unmein se randomly chuno jo least used hai
    if (leastUsedAvatars.length > 0) {
        const minUsageCount = leastUsedAvatars[0].usageCount;
        const candidates = leastUsedAvatars.filter(item => item.usageCount === minUsageCount);
        const randomIndex = Math.floor(Math.random() * candidates.length);
        const selectedUrl = candidates[randomIndex].url;

        // Usage count ko update karo
        await AvatarUsage.findOneAndUpdate({ url: selectedUrl }, { $inc: { usageCount: 1 } });
        
        return selectedUrl;
    }

    // Fallback: Agar upar kuch bhi nahi chala (jaise database empty ya error), to purana random logic
    const randomIndex = Math.floor(Math.random() * avatarUrls.length);
    return avatarUrls[randomIndex];
}

async function getAndIncrementAvatarUsage(url) {
    if (!url) return;
    // FIX: Usage count ko 1 se increment karein ya naya document banaye
    await AvatarUsage.findOneAndUpdate({ url }, { $inc: { usageCount: 1 } }, { upsert: true, new: true });
}

async function initializeAvatarUsage() {
    for (const url of avatarUrls) {
        // FIX: upsert: true, setDefaultsOnInsert: true se duplicate keys se bacha ja sakta hai
        await AvatarUsage.findOneAndUpdate({ url }, {}, { upsert: true, new: true, setDefaultsOnInsert: true });
    }
}
initializeAvatarUsage();

module.exports = { getLeastUsedAvatarUrl, getAndIncrementAvatarUsage };