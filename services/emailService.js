// services/emailService.js (MODIFIED for Vercel Microservice)
const axios = require('axios'); // <-- NEW: Axios is required to call Vercel API
const dotenv = require('dotenv');
// Note: nodemailer is no longer required in this file, but axios is added.

dotenv.config();

// Render Environment Variable: Vercel API का URL जो तुम Render ENV में सेट करोगे
const VERCEL_EMAIL_API = process.env.VERCEL_EMAIL_API_URL; 

// ----------------------------------------------------------------------
// 💡 Original NOBITA_EMAIL_TEMPLATE (Preserved)
// ----------------------------------------------------------------------
const NOBITA_EMAIL_TEMPLATE = (heading, name, buttonText, link, avatarUrl, type = "generic") => {
  let messageHTML = '';
  if (type === 'reset-request') { messageHTML = `A password reset request has been initiated for your account.<br>Click the button below to reset your password.`; } 
  else if (type === 'reset-confirm') { messageHTML = `Your password has been successfully reset.<br>You can now log in with your new password.`; } 
  else if (type === 'verify-request') { messageHTML = `Your account has been successfully created.<br>Click the button below to verify your email and unlock all features.`; } 
  else if (type === 'verify-confirm') { messageHTML = `Your email has been successfully verified.<br>Welcome to the NOBITA empire! 🔥`; } 
  else { messageHTML = `This is a confirmation that your request was completed successfully.<br>Click the button below to continue.`; }
  return `
<div style="font-family: 'Poppins',sans-serif; background: #f2f3f5; margin:0; padding: 0; min-height: 100vh; width: 100vw;">
  <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; background: linear-gradient(to bottom right, #000011, #001122); min-height: 100vh;">
    <tr>
      <td align="center" style="padding: 0 10px;">
        <table cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; background: #001133; border: 2px solid #00ffdd; border-radius: 12px; overflow: hidden; margin: 40px auto; box-shadow: 0 0 16px #00ffdd88;">
          <tr>
            <td align="center" style="padding: 0;">
              <img src="${avatarUrl}" alt="User Avatar" style="border-radius: 50%; margin: 24px auto 14px auto; display:block; max-width: 80px; width: 30%; height: auto; box-shadow: 0 0 12px #00ffdd90;" onerror="this.src='https://placehold.co/75x75/1E90FF/FFFFFF?text=USER';"/>
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


// ----------------------------------------------------------------------
// 💡 sendEmail FUNCTION (Uses Vercel API)
// ----------------------------------------------------------------------
async function sendEmail(options) {
    if (!VERCEL_EMAIL_API) {
        console.error("❌ VERCEL_EMAIL_API_URL is not set in Render environment. Email service disabled.");
        throw new Error("Email service is disabled. VERCEL_EMAIL_API_URL environment variable is missing.");
    }

    // Payload jo hum Vercel ko bhejenge
    const payload = {
        recipient: options.email,
        subject: options.subject,
        html: options.html,
        message: options.message || options.subject,
    };
    
    try {
        console.log(`📡 Sending email request to Vercel API for: ${options.email}`);
        
        // Render se Vercel ko POST request (Axios use karke)
        const response = await axios.post(VERCEL_EMAIL_API, payload);

        // Vercel ka response.data = { success: true, message: ..., messageId: ... }
        if (response.data.success) {
            console.log('✅ Email successfully offloaded to Vercel and sent.');
            // Tumhara main app ab is success ko aage use kar sakta hai
            return response.data; 
        } else {
            // Vercel ne 200 OK diya, par email Bhejane mein fail hua
            console.error('❌ Vercel reported failure:', response.data.message);
            throw new Error(`Email failed: ${response.data.message}`);
        }

    } catch (error) {
        // Network error ya Vercel ne 500/400 status code diya
        const errMsg = error.response?.data?.details || error.message;
        console.error('🔥 CRITICAL ERROR hitting Vercel API:', errMsg);
        // Throw error taaki tumhara auth route isko catch kar sake
        throw new Error(`Vercel API connection or server error: ${errMsg}`);
    }
}

module.exports = { sendEmail, NOBITA_EMAIL_TEMPLATE };
