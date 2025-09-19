// utils/emailService.js

const sgMail = require('@sendgrid/mail');

// API Key ko set karein, yeh automatically environment variable se utha lega.
// Humne yeh key .env mein rakhi hai, aur 'config/environment.js' mein load ki hogi.
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const SENDER_EMAIL = process.env.SENDER_EMAIL;

/**
 * SendGrid ke through email bhejta hai.
 * @param {string} to - Recipient ka email address.
 * @param {string} subject - Email ka subject.
 * @param {string} text - Plain text body.
 * @param {string} html - HTML body.
 * @returns {Promise<boolean>} - Agar email successfull hua to true, warna false.
 */
const sendEmail = async (to, subject, text, html) => {
    // Agar SENDER_EMAIL set nahi hai, toh error dega.
    if (!SENDER_EMAIL) {
        console.error("ERROR: SENDER_EMAIL environment variable is not set.");
        return false;
    }

    const msg = {
        to: to,
        from: SENDER_EMAIL, // Aapka SendGrid se verified sender email
        subject: subject,
        text: text,
        html: html,
    };

    try {
        await sgMail.send(msg);
        console.log(`Email successfully sent to ${to} using SendGrid.`);
        return true;
    } catch (error) {
        console.error("SendGrid Email Error:", error.response ? error.response.body : error.message);

        // Debugging ke liye detailed error log
        if (error.response) {
             // API Response error: check details in console.log
        }
        return false;
    }
};

module.exports = {
    sendEmail
};
module.exports = { sendEmail, NOBITA_EMAIL_TEMPLATE };
