// middleware/auth.js
const jwt = require('jsonwebtoken');
const { User } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET;

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.status(401).json({ message: "Authentication token not found." });
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error("User JWT Verification Error:", err.message);
            return res.status(403).json({ message: "Invalid or expired token. Please log in again." });
        }
        req.user = { ...user, isVerified: user.isVerified, hasCustomAvatar: user.hasCustomAvatar };
        next();
    });
};

const authenticateAdminToken = (req, res, next) => {
    let token = req.query.token || (req.headers['authorization'] && req.headers['authorization'].split(' ')[1]);
    if (token == null) {
        console.warn("Admin authentication attempt: No token provided.");
        return res.status(401).json({ message: "Admin authentication required." });
    }
    jwt.verify(token, ADMIN_JWT_SECRET, (err, adminUser) => {
        if (err) {
            console.error("Admin JWT Verification Error:", err.message);
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ message: "Admin session expired. Please log in again." });
            }
            return res.status(403).json({ message: "Invalid admin token." });
        }
        req.adminUser = adminUser;
        console.log(`Admin ${adminUser.username} authenticated.`);
        next();
    });
};

const isEmailVerified = async (req, res, next) => {
    if (!req.user || !req.user.userId) {
        return res.status(401).json({ message: "Authentication required." });
    }
    try {
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }
        if (user.loginMethod === 'google' || user.isVerified) {
            next();
        } else {
            return res.status(403).json({ message: "Email not verified. Please verify your email to perform this action." });
        }
    } catch (error) {
        console.error("isEmailVerified middleware error:", error);
        res.status(500).json({ message: "Server error while checking email verification status." });
    }
};

module.exports = {
    authenticateToken,
    authenticateAdminToken,
    isEmailVerified
};
