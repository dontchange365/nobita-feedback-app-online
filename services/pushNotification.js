// services/pushNotification.js
const webpush = require('web-push');
const dotenv = require('dotenv');
dotenv.config();

webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

async function sendPushNotificationToAdmin(feedback) {
    const adminUser = await require('../config/database').User.findOne({ username: process.env.ADMIN_USERNAME });
    if (adminUser && adminUser.pushSubscription) {
        const payload = JSON.stringify({
            title: 'New Feedback Received!',
            body: `From: ${feedback.name} | Rating: ${feedback.rating}\n"${feedback.feedback}"`,
            icon: '/icons/icon-192x192.png'
        });
        webpush.sendNotification(adminUser.pushSubscription, payload)
            .then(() => console.log('Push notification sent to admin!'))
            .catch(async err => {
                console.error('Error sending push notification to admin:', err);
                if (err.statusCode === 404 || err.statusCode === 410) {
                    console.warn('Admin push subscription is no longer valid. Clearing it from DB.');
                    adminUser.pushSubscription = null;
                    await adminUser.save();
                }
            });
    } else {
        console.log('No admin push subscription found. Cannot send notification.');
    }
}

async function sendPushNotificationToUser(userSubscription, feedbackData) {
    if (!userSubscription) {
        console.log('User has no push subscription.');
        return;
    }
    const FRONTEND_URL = process.env.FRONTEND_URL;
    const payload = JSON.stringify({
        title: 'Admin Replied to Your Feedback! 🎉',
        body: `Admin replied to your feedback with rating ${feedbackData.rating}. Check it out!`,
        icon: '/images/notification.png',
        data: { url: `${FRONTEND_URL}/#${feedbackData._id}` }
    });
    try {
        await webpush.sendNotification(userSubscription, payload);
        console.log(`Push notification sent to user for feedback ${feedbackData._id}.`);
    } catch (err) {
        console.error(`Error sending push notification to user:`, err);
        if (err.statusCode === 410 || err.statusCode === 404) {
            console.warn('User push subscription is no longer valid. Deleting from DB.');
            await require('../config/database').NotificationSubscription.deleteOne({ 'subscription.endpoint': userSubscription.endpoint });
        }
    }
}

module.exports = {
    sendPushNotificationToAdmin,
    sendPushNotificationToUser,
    webpush
};
