// config/environment.js
const dotenv = require('dotenv');
dotenv.config();

const requiredEnvVars = [
    'MONGODB_URI', 'JWT_SECRET', 'ADMIN_JWT_SECRET', 
    'FRONTEND_URL', 'ADMIN_USERNAME', 'ADMIN_PASSWORD_HASH'
];

console.log("--- Environment Variable Check ---");
requiredEnvVars.forEach(varName => {
    if (!process.env[varName]) {
        console.error(`❌ CRITICAL ERROR: Missing required environment variable: ${varName}`);
        process.exit(1);
    } else {
        console.log(`✅ ${varName} is set.`);
    }
});

const optionalEnvVars = [
    'GOOGLE_CLIENT_ID', 'EMAIL_USER', 'EMAIL_PASS', 'EMAIL_HOST', 'EMAIL_PORT', 
    'GITHUB_TOKEN', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 
    'CLOUDINARY_API_SECRET', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'
];
optionalEnvVars.forEach(varName => {
    if (!process.env[varName]) {
        console.warn(`⚠️ WARNING: Optional environment variable ${varName} is not set. Related features may not work.`);
    } else {
        console.log(`✅ ${varName} is set.`);
    }
});
console.log("--- End Environment Variable Check ---");
