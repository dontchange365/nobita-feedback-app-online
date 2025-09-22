// services/emailService.js
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
dotenv.config();

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

async function sendEmail(options) {
    const { EMAIL_USER, EMAIL_PASS, EMAIL_HOST, EMAIL_PORT } = process.env;
    if (!EMAIL_USER || !EMAIL_PASS || !EMAIL_HOST || !EMAIL_PORT) {
        console.error("Email service environment variables are not fully set.");
        throw new Error("Email service is not properly configured. Please contact the administrator.");
    }
    const transporter = nodemailer.createTransport({
        host: EMAIL_HOST, 
        port: parseInt(EMAIL_PORT), 
        secure: parseInt(EMAIL_PORT) === 465,
        auth: { user: EMAIL_USER, pass: EMAIL_PASS },
        tls: { rejectUnauthorized: false }
    });
    const mailOptions = { 
        from: `"Nobita Feedback App" <${EMAIL_USER}>`, 
        to: options.email, 
        subject: options.subject, 
        text: options.message, 
        html: options.html 
    };
    try {
        let info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully! Message ID: %s', info.messageId);
    } catch (error) {
        console.error('Error sending email with Nodemailer:', error);
        throw error;
    }
}

module.exports = { sendEmail, NOBITA_EMAIL_TEMPLATE };
