// services/emailService.js
const dotenv = require('dotenv');
// const nodemailer = require('nodemailer'); // <-- No longer needed for direct send
// const { google } = require('googleapis'); // <-- No longer needed for direct send
dotenv.config();

// Vercel Serverless Function का URL जहाँ से ईमेल भेजे जाएंगे
const EMAIL_API_URL = process.env.VERCEL_EMAIL_API_URL; 
const EMAIL_API_KEY = process.env.VERCEL_EMAIL_API_KEY; // Security key

const NOBITA_EMAIL_TEMPLATE = (heading, name, buttonText, link, avatarUrl, type = "generic", replyText = "") => {
  // ... (NOBITA_EMAIL_TEMPLATE is unchanged)
  // यह टेम्पलेट HTML अभी भी यहीं रहेगा
  let messageHTML = '';
  if (type === 'reset-request') { messageHTML = `A password reset request has been initiated for your account.<br>Click the button below to reset your password.`; } 
  else if (type === 'reset-confirm') { messageHTML = `Your password has been successfully reset.<br>You can now log in with your new password.`; } 
  else if (type === 'verify-request') { messageHTML = `Your account has been successfully created.<br>Click the button below to verify your email and unlock all features.`; } 
  else if (type === 'verify-confirm') { messageHTML = `Your email has been successfully verified.<br>Welcome to the NOBITA empire! 🔥`; } 
  else if (type === 'admin-reply') { 
      messageHTML = `
        Good news! The Admin (👉𝙉𝙊𝘽𝙄𝙏𝘼🤟) has replied to your feedback.
        <br><br>
        <strong>Your Feedback:</strong> "${replyText.originalFeedback}"
        <br>
        <strong>Admin's Reply:</strong> <span style="background-color: #000a1a; padding: 5px 10px; border-radius: 4px; display: inline-block; border: 1px solid #ff3399;">"${replyText.reply}"</span>
        <br><br>
        Click the button below to view the full thread and reply back.
      `; 
  }
  // NEW TEMPLATE TYPE: Feedback Liked Notification
  else if (type === 'feedback-liked') { 
      messageHTML = `
        Someone liked your feedback! That's awesome.<br><br>
        <strong>Your Feedback:</strong> "${replyText.originalFeedback}"
        <br>
        <span style="font-size: 1.5em; color: #00ffdd;">👍 You now have ${replyText.newUpvoteCount} total likes on this feedback!</span>
        <br><br>
        Click the button below to see the activity on your post.
      `; 
  }
  else { messageHTML = `This is a confirmation that your request was completed successfully.<br>Click the button below to continue.`; }
  return `
<div style="font-family: 'Poppins',sans-serif; background: #f2f3f5; margin:0; padding: 0; min-height: 100vh; width: 100vw;">
  <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; background: linear-gradient(to bottom right, #000011, #001122); min-height: 100vh;">
    <tr>
      <td align="center" style="padding: 0 10px;">
        <table cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; background: #001133; border: 2px solid #00ffdd; border-radius: 12px; overflow: hidden; margin: 40px auto; box-shadow: 0 0 16px #00ffdd88;">
          <tr>
            <td align="center" style="padding: 0;">
              <img src="${avatarUrl}" alt="User Avatar" style="border-radius: 50%; margin: 24px auto 14px auto; display:block; width: 80px; height: 80px; object-fit: cover; border: 4px solid #00ffdd; box-shadow: 0 0 12px #00ffdd90;" onerror="this.src='https://placehold.co/80x80/1E90FF/FFFFFF?text=USER';"/>
              <div style="background: linear-gradient(90deg, #00c9ff, #92fe9d); padding: 16px 0; text-align:center;">
                <h2 style="color: black; margin: 0; font-size: 1.6em; text-transform: uppercase; letter-spacing: 1px;">${heading}</h2>
              </div>
              <div style="padding: 26px 6% 20px 6%; color: #cdeaff;">
                <p style="font-size: 1em; text-align: left;">
                  Hello <strong>${name}</strong>,<br><br>
                  ${messageHTML}
                </p>
                <a href="${link}" style="display: inline-block; width: 100%; max-width: 90%; padding: 12px; font-size: 1em; background-color: #ff3399; color: #fff; text-decoration: none; border-radius: 6px; margin-top: 18px; font-weight: bold; text-align:center; box-shadow: 0 0 10px #ff339955;">
                  ✅ ${buttonText}
                </a>
                <div style="margin-top: 24px; background: #000814; border: 1px dashed #00ffdd; padding: 12px; font-size: 0.9em; word-break: break-word;">
                  <p style="margin: 0 0 6px;">⚠️ Button malfunctioning? Use this backup link:</p>
                  <a href="${link}" style="color: #00ffdd; text-decoration: underline;">${link}</a>
                </div>
                <p style="font-size: 0.93em; color: #ff6666; margin-top: 20px;">
                  ⚠️ This link will self-destruct in 10 minutes.
                </p>
                <p style="font-style: italic; font-size: 0.91em; color: #cccccc; margin-top: 16px;">
                  "Power doesn't reset — it regenerates." — NOBI BOT 👾
                </p>
              </div>
              <div style="background-color: #000a1a; padding: 14px; font-size: 0.86em; color: #778899; text-align:center;">
                &copy; 2025 NOBI BOT | Need help? <a href="mailto:nobibot.host@gmail.com" style="color:#00ffdd;">Contact Support</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>`;
};


async function sendEmail(options) {
    if (!EMAIL_API_URL || !EMAIL_API_KEY) {
        console.error("Vercel Email API Configuration is missing.");
        throw new Error("Email service is not properly configured (Vercel API Missing ENV). Please contact the administrator.");
    }
    
    // Nobita App (Render) Vercel API को कॉल करेगा
    try {
        const response = await fetch(EMAIL_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Authorization header security key के लिए 
                'Authorization': `Bearer ${EMAIL_API_KEY}`
            },
            body: JSON.stringify({
                to: options.email,
                subject: options.subject,
                html: options.html,
                text: options.message || 'This is a fallback text message.'
                // From address Vercel Function में hardcode/ENV से लिया जाएगा
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Unknown Vercel API Error' }));
            throw new Error(`Failed to send email via Vercel API. Status: ${response.status}. Message: ${errorData.message}`);
        }

        const successData = await response.json();
        console.log('Email successfully requested via Vercel API! ID: %s', successData.messageId || 'N/A');
    } catch (error) {
        console.error('Error sending email via Vercel API:', error);
        throw error;
    }
}

module.exports = { sendEmail, NOBITA_EMAIL_TEMPLATE };