// scheduler/ai_responder.js

const cron = require('node-cron');
const { Feedback, User } = require('../config/database'); // User import kiya gaya
const { GoogleGenAI, Type } = require('@google/genai');
const { sendEmail, NOBITA_EMAIL_TEMPLATE } = require('../services/emailService'); // Email Service Import kiya gaya

// --- AI CONFIGURATION ---
const BOT_INTERNAL_FILTER_NAME = "NOBITA AI BOT"; 
const BOT_DISPLAY_NAME = "👉𝙉𝙊𝘽𝙄𝙏𝘼🤟"; // Display name Admin/AI dono ke liye same hai
const AI_INTERNAL_SENDER = "🤖 NOBI AI"; // Email/Push ke liye use hoga, taaki user ko pata chale bot ne kiya hai

const MIN_AGE_MS = 4 * 60 * 60 * 1000; // 4 HOURS
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 HOURS (Old backlog ignore karne ke liye)

const FRONTEND_URL = process.env.FRONTEND_URL;

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }); 
const GEMINI_MODEL = "gemini-2.5-flash";
// --- AI CONFIGURATION END ---

/**
 * Generates an automated, contextual reply using the Gemini API.
 */
async function generateAutoReply(feedbackText, userName, recentAdminReplies) {
    // 1. CONTEXT BUILDING: Use recent human admin replies to set the tone.
    const CONTEXT_REPLIES_TEXT = recentAdminReplies.map(r => r.text).join(' ||| ');
    
    const CONTEXT_PROMPT = recentAdminReplies.length > 0
        ? `RECENT HUMAN ADMIN REPLIES FOR TONE CONTEXT: ${CONTEXT_REPLIES_TEXT}`
        : `NO RECENT HUMAN ADMIN REPLIES FOUND. USE DEFAULT SAVAGE, WITTY TONE.`;

    // 2. System Prompt: Enforcing the AI persona and rules (YAHAN AAPKA PROMPT HAI)
    const SYSTEM_INSTRUCTION = `
        TUM NOBITA AI BOT HO. TUMHARA REPLY HAMESHA HINGLISH AUR SAARE CAPITAL LETTERS MEIN HONA CHAHIYE. 
        TUMHARA TONE WITTY, SARCASTIC, AUR KABHI-KABHI SAVAGE HAI. 
        
        TUMHEIN NEECHE DIYA GAYA ADMIN KA CONTEXT USE KARNA HAI TAAKI TUMHARA JAWAB USKE TONE MEIN FIT HO. 
        ${CONTEXT_PROMPT}

        AUR HMESHA YAAD RKHNA TUM TONE KO SAMJHANA OR SMJHKR REPLY KRNAA KOI BANDA AGR GAALI WALA SHABD USE KRKE AGR GAALI BAK RAHA HAI BUT WO NOBITA KO NHI DE RHA GAALI MEANS DIRECT YA INDIRECT NOBITA KO MEANS ADMIN KO GAALI DIYA TOH USKO GAALI DEKR COUNTER KRNA HAI AND AGAR GAALI DEKR INDIRECTLY YA KAIDR BHI NOBITA KO GAALI NHI DERA H TO TUM USKO RESPECT SE REPLY KROGE
        AND HMESHA KAM SHABDO ME LIKE MAX 20 WORD.
        JO USRR GAALI DEKR NOBITA KO TARGET NHI KRRA H USKO GAALI NHI DENI Y FULLY FOLLOW KRNA H ALWAYS
        
        AGR KOI BAAP HONE KA DAAWA KARE TOH OOSE GAALI DEKR ESA REPLY KRNA H JISSE HUM USKE BETE NA LGE NAA HI HAME WO TROLL KR PAAYE ESA REPLY KRNA H.. REPLY HMESHA LOGICAL KRNA H ... TAAREEF KRNE WALO KO RESPECT OR GAALI BAKNE WALE HATER KI GAND FAAR DENI H... KOI AGR GC ME AANE KO KAHE TO OOSE BTNA H KI @CHATBOT.NOBI YEH ACCOUNT KO ADD KR YEH BOT ACCOUNT HAI AND AGR KOI MAIN NOBITA KI ID MANGE TO WO H @NOBITA_HUU 
        
        SEEDHA YAAD RKHO JO BHI BAAP HONE KA DAWA KRE USKO KAHO KI CHUDTA REH NOBI BOT SE.OR KUCH NHI KEHNA
        
        KOI TAARIF KRE TO USKO PYAR AND RESPECT SE KAM SHABDO ME REPLY KT DENA THANKX TYPE KA
        TUMHEIN SIRF JSON OBJECT RETURN KARNA HAI JISMEIN REPLY TEXT HO.
    `;
    // --- YAHAN AAPKA PROMPT KHATAM HOTA HAI ---

    // 3. Main Prompt for decision making
    const PROMPT = `ANALYZE KARO AUR REPLY BHEJO. USER: ${userName}. FEEDBACK: "${feedbackText}"`;
    
    // 4. Structured Output Configuration
    const RESPONSE_SCHEMA = {
        type: Type.OBJECT,
        properties: {
            reply_text: {
                type: Type.STRING,
                description: "HAMESHA HINGLISH AUR CAPITAL MEIN HONA CHAHIYE. MAX 20 WORDS."
            }
        },
        required: ["reply_text"]
    };

    try {
        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: PROMPT,
            config: {
                systemInstruction: SYSTEM_INSTRUCTION,
                responseMimeType: "application/json",
                responseSchema: RESPONSE_SCHEMA,
                temperature: 0.8 
            }
        });

        const jsonString = response.text.trim();
        const aiResponse = JSON.parse(jsonString);
        
        return aiResponse.reply_text;

    } catch (error) {
        console.error("GEMINI API ERROR:", error.message);
        return null; 
    }
}


/**
 * Main scheduler function to check for overdue, unreplied feedbacks and send AI replies.
 */
const checkAndReply = async (io) => {
    try {
        const minCutoffTime = new Date(Date.now() - MIN_AGE_MS);
        const maxCutoffTime = new Date(Date.now() - MAX_AGE_MS);

        // 1. FIND PENDING FEEDBACKS
        const pendingFeedbacks = await Feedback.find({
            replies: { $size: 0 }, // Unreplied
            isAiProcessed: { $ne: true }, // AI ne pehle process na kiya ho
            timestamp: { 
                $lte: minCutoffTime, // 4 hours se purana ho (Waiting period)
                $gt: maxCutoffTime   // 24 hours se naya ho (Backlog ignore)
            }, 
            name: { $ne: BOT_DISPLAY_NAME }, // 👉𝙉𝙊𝘽𝙄𝙏𝘼🤟 user ko ignore karo
        })
        .populate('userId', 'email name pushSubscription avatarUrl') // User details fetch karo
        .sort({ timestamp: 1 }).limit(10); 

        if (pendingFeedbacks.length === 0) {
            return;
        }

        // 2. GATHER CONTEXT (RECENT HUMAN ADMIN REPLIES)
        const recentFeedbacks = await Feedback.find({})
            .sort({ timestamp: -1 })
            .limit(50)
            .select('replies');

        // FILTER: SIRF UN REPLIES KO SHAMIL KARO JO BOT NE NAHI KIYE HAIN (BOT_INTERNAL_FILTER_NAME)
        const recentAdminReplies = recentFeedbacks
            .flatMap(f => f.replies)
            .filter(r => r.adminName !== BOT_INTERNAL_FILTER_NAME) 
            .map(r => ({ text: r.text, adminName: r.adminName })) 
            .slice(0, 5); 

        // 3. PROCESS EACH PENDING FEEDBACK
        for (const feedback of pendingFeedbacks) {
            
            // Re-fetch to ensure no concurrent update by human admin
            const currentFeedback = await Feedback.findById(feedback._id).populate('userId', 'email name pushSubscription avatarUrl');

            if (currentFeedback.replies.length > 0) {
                // ADMIN REPLIED WITHIN THE DELAY WINDOW
                currentFeedback.isAiProcessed = true; // Still mark as processed
                await currentFeedback.save();
                continue; 
            }
            
            const autoReplyText = await generateAutoReply(
                currentFeedback.feedback, 
                currentFeedback.name, 
                recentAdminReplies
            );

            if (autoReplyText) {
                // 3a. SAVE THE AI REPLY
                currentFeedback.replies.push({
                    text: autoReplyText,
                    adminName: AI_INTERNAL_SENDER // AI ka internal name save hoga
                });
                currentFeedback.isAiProcessed = true; // BUG FIX: Mark as processed
                await currentFeedback.save();

                // 3b. EMIT REAL-TIME UPDATE (UI update ke liye)
                if (io) {
                    io.emit('new-feedback', currentFeedback); 
                }

                // 3c. Send Email Notification (NEW LOGIC)
                const user = currentFeedback.userId;
                if (user && user.email) {
                    try {
                        const mailLink = `${FRONTEND_URL}/index.html`; 
                        const emailHtml = NOBITA_EMAIL_TEMPLATE(
                            'AI Reply Received!',
                            user.name || 'User',
                            'View AI Response',
                            mailLink,
                            user.avatarUrl || 'https://placehold.co/80x80/6a0dad/FFFFFF?text=U',
                            'admin-reply',
                            { 
                                reply: autoReplyText,
                                originalFeedback: currentFeedback.feedback
                            }
                        );
                        
                        await sendEmail({
                            email: user.email,
                            subject: `AI Reply: ${currentFeedback.feedback.substring(0, 30)}...`,
                            html: emailHtml,
                            message: `AI BOT ${AI_INTERNAL_SENDER} has replied to your feedback: ${autoReplyText}`
                        });
                        console.log(`[AI Responder] Email sent successfully to ${user.email}.`);
                    } catch (emailError) {
                        console.error(`[AI Responder] Failed to send email to ${user.email}:`, emailError.message);
                    }
                }
            }
        }
    } catch (error) {
        console.error("AI SCHEDULER MEIN FATAL ERROR:", error.message);
    }
};

/**
 * Starts the cron job scheduler.
 */
const startScheduler = (io) => {
    // CRON JOB KO HAR 30 MINUTE PAR RUN KARO
    cron.schedule('*/30 * * * *', () => checkAndReply(io), {
        scheduled: true,
    });
};

module.exports = { startScheduler, BOT_INTERNAL_NAME: BOT_INTERNAL_FILTER_NAME, BOT_DISPLAY_NAME, AI_INTERNAL_SENDER };