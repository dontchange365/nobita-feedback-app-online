const admin = (req, res, next) => {
    if (req.user && req.user.isAdmin) {
        next();
    } else {
        res.status(403); // Forbidden
        throw new Error('Not authorized as an admin');
    }
};

module.exports = { admin };