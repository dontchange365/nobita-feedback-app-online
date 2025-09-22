// utils/helpers.js
function createUserPayload(user) {
    return {
        userId: user._id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        loginMethod: user.loginMethod,
        isVerified: user.isVerified,
        hasCustomAvatar: user.hasCustomAvatar,
        hasPassword: !!user.password
    };
}
module.exports = { createUserPayload };
