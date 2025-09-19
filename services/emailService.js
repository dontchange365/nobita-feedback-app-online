// nobita-feedback-app-online/services/emailService.js

// Ab yeh file SendGrid use karegi. Aapko '@sendgrid/mail' install karna hoga: npm install @sendgrid/mail

const sgMail = require('@sendgrid/mail');

// Environment variable se key set karein.
// .env file se load hote waqt yeh key mil jaani chahiye.
// Note: Render jaise platforms par, ensure ki SENDGRID_API_KEY mein koi leading/trailing space na ho.
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const SENDER_EMAIL = process.env.SENDER_EMAIL;

// NOBITA_EMAIL_TEMPLATE: Yeh template purane code se aa raha hai
// Aur auth.js mein isko use kiya gaya hai. Isko dobara define aur export karna zaroori hai.
// Maine Nodemailer ke options ko SendGrid ke hisaab se adjust kiya hai.
const NOBITA_EMAIL_TEMPLATE = ({
    to, 
    subject, 
    htmlContent, 
    textContent 
}) => {
    // Basic validation
    if (!SENDER_EMAIL || !process.env.SENDGRID_API_KEY) {
        console.error("ERROR: SendGrid credentials are not fully set.");
        throw new Error("Email service is not configured correctly.");
    }
    
    return {
        to: to,
        from: SENDER_EMAIL, // Aapka SendGrid se verified sender email
        subject: subject,
        text: textContent, // Plain text body
        html: htmlContent, // HTML body
    };
};


/**
 * SendGrid ke through email bhejta hai.
 * @param {object} mailOptions - Mail options object containing to, from, subject, text, html.
 * @returns {Promise<boolean>} - Agar email successfull hua to true, warna false.
 */
const sendEmail = async (mailOptions) => {
    try {
        await sgMail.send(mailOptions);
        console.log(`Email successfully sent to ${mailOptions.to} using SendGrid.`);
        return true;
    } catch (error) {
        // Detailed error log
        console.error("SendGrid Email Error:", error.response ? error.response.body : error.message);
        
        // Agar API key ka error aata hai (jaisa ki log mein tha), toh yeh message useful hoga.
        if (error.code === 401) {
            console.error("Authentication Error: Check if SENDGRID_API_KEY is correct and starts with 'SG.'.");
        }
        
        return false;
    }
};

module.exports = { sendEmail, NOBITA_EMAIL_TEMPLATE };
