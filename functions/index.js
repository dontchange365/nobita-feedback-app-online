// index.js

const functions = require('firebase-functions');
const nodemailer = require('nodemailer');
const { google } = require('googleapis');

// Google Service Account key ko environment variable se load karein
const serviceAccountKey = functions.config().firebase_service_account_key;
if (!serviceAccountKey) {
    console.error('FATAL ERROR: FIREBASE_SERVICE_ACCOUNT_KEY not found in environment variables.');
    throw new Error('Firebase service account key is not configured.');
}
const key = JSON.parse(serviceAccountKey);

// Nodemailer transporter banaein
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        type: 'OAuth2',
        user: key.client_email, // Yahan client_email hi use karein
        serviceClient: key.client_id,
        privateKey: key.private_key,
    }
});

exports.sendEmailRelay = functions.https.onRequest(async (req, res) => {
    // Sirf POST requests ko allow karein
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    const { to, subject, html } = req.body;

    if (!to || !subject || !html) {
        return res.status(400).send('Bad Request: `to`, `subject`, and `html` fields are required.');
    }

    const mailOptions = {
        from: '"Nobita Feedback App" <' + key.client_email + '>',
        to: to,
        subject: subject,
        html: html,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Email sent successfully via Firebase!');
        res.status(200).send('Email sent successfully!');
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).send('Error sending email.');
    }
});
