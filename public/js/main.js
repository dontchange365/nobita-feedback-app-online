// main.js
// --- GLOBAL CONSTANTS ---
// API Base URL from your server.js logic (if it's on Render, this is likely window.location.origin)
window.BASE_API_URL = window.location.origin;

// Google Client ID (from your provided index.html's JS block)
window.GOOGLE_CLIENT_ID = '609784004025-li543jevd5e9u3a58ihvr98a2jpqfb8b.apps.googleusercontent.com';

// --- API ENDPOINTS ---
window.API_LOGIN_URL = `${window.BASE_API_URL}/api/auth/login`;
window.API_SIGNUP_URL = `${window.BASE_API_URL}/api/auth/signup`;
window.API_GOOGLE_SIGNIN_URL = `${window.BASE_API_URL}/api/auth/google-signin`;
window.API_VALIDATE_TOKEN_URL = `${window.BASE_API_URL}/api/auth/me`;
window.API_REQUEST_RESET_URL = `${window.BASE_API_URL}/api/auth/request-password-reset`;
window.API_REQUEST_VERIFICATION_URL = `${window.BASE_API_URL}/api/auth/request-email-verification`;
window.API_UPDATE_PROFILE_URL = `${window.BASE_API_URL}/api/user/profile`;
window.API_CHANGE_PASSWORD_URL = `${window.BASE_API_URL}/api/user/change-password`;
window.API_FEEDBACK_URL = `${window.BASE_API_URL}/api/feedback`;
window.API_FETCH_FEEDBACKS_URL = `${window.BASE_API_URL}/api/feedbacks`;


// CLOUDINARY CONFIG
window.CLOUDINARY_CLOUD_NAME = 'dyv7xav3e';
window.CLOUDINARY_UPLOAD_PRESET = 'nobita_avatar_unsigned';
window.CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${window.CLOUDINARY_CLOUD_NAME}/image/upload`;


// --- GLOBAL STATE VARIABLES ---
window.currentUser = null;
window.GUEST_ID_KEY = 'nobi_guestId';
window.GUEST_NAME_KEY = 'nobi_guestName';
window.USER_PROFILE_CACHE_KEY = 'nobi_user_profile';


// Lazy loading variables
let currentPage = 1;
let isLoadingFeedbacks = false;
let hasMoreFeedbacks = true;
let allFeedbacksLoaded = false;
let totalFeedbacksCount = 0;
let currentAverageRating = 0;

// --- API Request Helper Function ---
async function apiRequest(url, method, body = null, isFormData = false, buttonToSpin = null, spinnerText = "Processing...") {
    const headers = {};
    if (!isFormData) headers['Content-Type'] = 'application/json';

    const token = localStorage.getItem('nobita_jwt');
    if (token) headers['Authorization'] = `Bearer ${token}`;

    let currentSubmitBtn = buttonToSpin || (document.activeElement?.tagName === 'BUTTON' ? document.activeElement : null);
    let originalButtonHTML;

    if(currentSubmitBtn && currentSubmitBtn.disabled) {
      currentSubmitBtn = null;
    }

    if (currentSubmitBtn) {
        originalButtonHTML = currentSubmitBtn.innerHTML;
        currentSubmitBtn.disabled = true;
        currentSubmitBtn.innerHTML = `<span class="nobi-spinner"></span> ${spinnerText}`;
    } else if (method === 'POST' && url.includes('/api/auth/google-signin')) {
        window.showFullScreenLoader();
    }

    try {
        const response = await fetch(url, {
            method,
            headers,
            body: isFormData ? body : (body ? JSON.stringify(body) : null)
        });

        let data;
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            const text = await response.text();
            if (response.ok) {
                data = text ? { message: text } : {};
            } else {
                throw new Error(data.message || `Server Error (${response.status})`);
            }
        }

        if (!response.ok) {
            const error = new Error(data.message || `Server Error (${response.status})`);
            error.status = response.status;
            error.response = data; // Attach the response data for more specific handling
            throw error;
        }

        return data;

    } catch (error) {
        console.error(`API request error at ${url}:`, error);
        let msg = "An unexpected error occurred. Please try again.";
        if (error.message.includes("Failed to fetch")) {
            msg = "Network error. Check your internet connection.";
        } else if (error.message) {
            msg = error.message;
        }

        // Only show a generic popup if it's not a special case handled elsewhere (like email verification or signup flow)
        if (!(error.message && error.message.includes("Email not verified")) && !(error.response && error.response.actionRequired === "SET_PASSWORD_FOR_GOOGLE_EMAIL")) {
            window.showStylishPopup({
                iconType: 'error',
                title: 'Request Failed',
                message: msg,
                buttons: [{text: 'OK', action: window.closeStylishPopup}]
            });
        }

        throw error;
    } finally {
        if (currentSubmitBtn) {
            currentSubmitBtn.disabled = false;
            currentSubmitBtn.innerHTML = originalButtonHTML;
        } else if (method === 'POST' && url.includes('/api/auth/google-signin')) {
            window.hideFullScreenLoader();
        }
    }
}
window.apiRequest = apiRequest;

// Saves login info to localStorage
function saveLogin(data){
  localStorage.setItem("nobita_jwt", data.token);
  // NEW: Store the full user object including password flag
  localStorage.setItem(window.USER_PROFILE_CACHE_KEY, JSON.stringify(data.user));
  localStorage.setItem("nobita_last_email", data.user.email);
}

// Handles successful authentication response (Login, Signup, Google Sign-in)
async function handleAuthResponse(data, source = "email", linkedGuestActivity = false) {
    window.closeAuthModal();

    saveLogin(data);
    window.currentUser = data.user;
    
    // FIX: Check for password existence on login
    // This logic is crucial. If the server doesn't explicitly send `user.password`
    // we need to set it to a predictable value. The server response for a
    // Google user who has set a password will contain `loginMethod: 'email'`.
    // We can assume if loginMethod is 'google' and password is NOT sent, it doesn't exist.
    if (window.currentUser.loginMethod === 'google' && !data.user.password) {
        window.currentUser.password = undefined; // Force undefined if it's not provided by the server
    } else {
        // Assume password exists for email users or Google users who have created one.
        // We'll rely on the server to send `loginMethod: 'email'` in this case.
        window.currentUser.password = true; // Use a boolean to indicate existence.
    }

    await window.checkUserVerificationStatus();
    if (linkedGuestActivity) {
        localStorage.removeItem(window.GUEST_ID_KEY);
        localStorage.removeItem(window.GUEST_NAME_KEY);
        console.log("Guest ID and Name cleared after linking activity.");
    }

    window.updateUIAfterLogin();

    if (window.currentUser.loginMethod === 'email' && !window.currentUser.isVerified) {
        let msg = `Account created for ${window.currentUser.name}! Please check your email to verify your account.`;
        if (linkedGuestActivity) msg += " Your previous guest activity has also been linked.";

        window.showStylishPopup({
            iconType: 'warning',
            title: `Welcome, ${window.currentUser.name}!`,
            message: msg,
            buttons: [{text: 'OK', action: window.closeStylishPopup}]
        });
        if (window.fetchFeedbacks) await window.fetchFeedbacks();
        return;
    }

    let msg = data.message || (source === 'google' ? 'Successfully logged in with Google!' : 'Successfully logged in!');
    if (linkedGuestActivity) {
        msg += " Your previous guest activity has been linked to this account.";
    }

    window.showStylishPopup({
        iconType: 'success',
        title: `Welcome, ${window.currentUser.name}!`,
        message: msg,
        buttons: [{text: 'Awesome!', action: window.closeStylishPopup}]
    });

    if (window.fetchFeedbacks) await window.fetchFeedbacks();
}
window.handleAuthResponse = handleAuthResponse;

// Request and display email verification options
async function requestAndShowVerificationEmail() {
    if (!window.currentUser || window.currentUser.isVerified) return;

    try {
        const data = await apiRequest(window.API_REQUEST_VERIFICATION_URL, 'POST', {});
        window.showStylishPopup({
            iconType: 'success',
            title: 'Verification Link Sent!',
            message: `${data.message} Please check your inbox (and spam folder).`,
            buttons: [{text: 'OK', action: window.closeStylishPopup}]
        });
    } catch (error) {
        // Error handling is in apiRequest, so no specific popup here
    }
}
window.requestAndShowVerificationEmail = requestAndShowVerificationEmail;

async function resendVerification(){
  let email = localStorage.getItem("nobita_last_email") || prompt("Enter your email:");
  if (!email) {
    window.showStylishPopup({
      iconType: 'error',
      title: 'Email Required',
      message: 'Please enter your email address to resend the verification link.',
      buttons: [{text:'OK', action:window.closeStylishPopup}]
    });
    return;
  }

  try {
    const response = await fetch("https://nobita-feedback-app-online.onrender.com/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    const result = await response.json();
    if (response.ok) {
      window.showStylishPopup({
        iconType: 'success',
        title: 'Verification Mail Sent!',
        message: 'Check your inbox/spam folder for the verification link.',
        buttons: [{text:'OK', action:window.closeStylishPopup}]
      });
    } else {
      window.showStylishPopup({
        iconType: 'error',
        title: 'Failed to Send!',
        message: result.message || 'Could not send verification email. Please try again later.',
        buttons: [{text:'OK', action:window.closeStylishPopup}]
      });
    }
  } catch (e) {
    window.showStylishPopup({
      iconType: 'error',
      title: 'Network Error!',
      message: 'Failed to connect to server. Check your internet and try again.',
      buttons: [{text:'OK', action:window.closeStylishPopup}]
    });
  }
}
window.resendVerification = resendVerification;

// --- NEW FORGOT PASSWORD POPUP LOGIC ---
window.NEW_API_REQUEST_RESET_URL = `${window.BASE_API_URL}/api/auth/request-password-reset`;

async function submitForgotPasswordRequest() {
    let emailInput = document.getElementById('forgotPasswordEmailInput');
    let email = emailInput ? emailInput.value.trim() : '';
    let errorBox = document.getElementById('forgotPasswordErrorBox');
    const sendBtn = document.getElementById('sendResetLinkBtn');

    if (errorBox) errorBox.style.display = "none";

    if (!email) {
        if (errorBox) {
            errorBox.textContent = "Please enter your email address.";
            errorBox.style.display = "block";
        }
        if(emailInput) emailInput.focus();
        return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        if (errorBox) {
            errorBox.textContent = "Please enter a valid email address.";
            errorBox.style.display = "block";
        }
        if(emailInput) emailInput.focus();
        return;
    }

    if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.innerHTML = `<span class="spinner"></span>Sending...`;
    }

    try {
        const data = await apiRequest(window.NEW_API_REQUEST_RESET_URL, 'POST', { email }, false, null, "Sending...");
        window.renderForgotSuccess();
        localStorage.setItem("nobita_last_email", email);
    } catch (e) {
        if (errorBox) {
            errorBox.textContent = e.message || "Failed to send reset link. Please try again.";
            errorBox.style.display = "block";
        }
        if(emailInput) emailInput.focus();
    } finally {
        if (sendBtn) {
            sendBtn.disabled = false;
            sendBtn.innerHTML = "Send Reset Link";
        }
    }
}
window.submitForgotPasswordRequest = submitForgotPasswordRequest;

// --- EVENT LISTENERS AND INITIALIZATIONS ---

document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOM fully loaded - NOBITA (Final Guest + Unverified Submit)");
    const mainTitle = document.getElementById('main-title');
    const feedbackFormContainer = document.getElementById('feedback-form-container');
    const feedbackListContainer = document.getElementById('feedback-list-container');


    if (mainTitle) {
        new Typed('#main-title', {
            strings: ["✨ Welcome to Nobita's Feedback Portal! ✨"], typeSpeed: 50, showCursor: false,
            onComplete: () => { new Typed('#typed-output', { strings: ["Share your thoughts and help us improve!", "Your valuable feedback makes a difference."], typeSpeed: 40, backSpeed: 20, loop: true, showCursor: true, cursorChar: '|', }); }
        });
    }

    // --- NAVBAR BUTTONS ---
    const navLoginIconTrigger = document.getElementById('login-icon-trigger');
    const userProfileTrigger = document.getElementById('user-profile-trigger');
    const userMenu = document.getElementById('userMenu');
    const userProfileModal = document.getElementById('userProfileModal');

    if (navLoginIconTrigger) {
        navLoginIconTrigger.addEventListener('click', e => {
            e.stopPropagation();
            window.openLoginModal();
            if (userMenu) userMenu.classList.remove('active');
            window.closeForgotPasswordNewPopup();
        });
    }

    if (userProfileTrigger) {
        userProfileTrigger.addEventListener('click', e => {
            e.stopPropagation();
            if (userMenu) userMenu.classList.toggle('active'); // Sirf menu ko toggle karega
            window.closeAuthModal();
            window.closeForgotPasswordNewPopup();
            // Focus bhi hatana hai yahan se
            if (document.activeElement && document.activeElement.blur) {
                document.activeElement.blur();
            }
        });
    }

    // Close auth modal when clicking outside
    const authModalOverlay = document.getElementById('auth-modal-overlay');
    if (authModalOverlay) {
        authModalOverlay.addEventListener('click', e => {
            if (e.target === authModalOverlay) {
                window.closeAuthModal();
            }
        });
    }

    // Close profile menu when clicking outside
    document.addEventListener('click', e => {
        if (userMenu && userMenu.classList.contains('active') &&
            userProfileTrigger && !userProfileTrigger.contains(e.target) && !userMenu.contains(e.target)) {
            userMenu.classList.remove('active');
        }
    });

    // Close Stylish Popup from its close button
    const closeStylishPopupBtn = document.getElementById('closeStylishPopupBtn');
    const stylishPopupOverlay = document.getElementById('stylishPopupOverlay');
    if (closeStylishPopupBtn) {
        closeStylishPopupBtn.addEventListener('click', window.closeStylishPopup);
    }
    // Close Stylish Popup when clicking overlay
    if (stylishPopupOverlay) {
        stylishPopupOverlay.addEventListener('click', e => {
            if (e.target === stylishPopupOverlay) {
                window.closeStylishPopup();
            }
        });
    }

    // Close NEW Forgot Password Popup when clicking overlay or ESC key
    const forgotPasswordNewOverlay = document.getElementById('forgotPasswordNewOverlay');
    if (forgotPasswordNewOverlay) {
        forgotPasswordNewOverlay.addEventListener('click', e => {
            if(e.target === forgotPasswordNewOverlay) window.closeForgotPasswordNewPopup();
        });
    }
    document.addEventListener('keydown', function(ev){
        if(ev.key==='Escape' && forgotPasswordNewOverlay && forgotPasswordNewOverlay.classList.contains('active')) {
            window.closeForgotPasswordNewPopup();
        }
    });

    // --- AUTH MODAL FORM SUBMISSIONS ---
    const busiconEmailLoginForm = document.getElementById('email-login-form');
    const busiconModalLoginEmailInput = document.getElementById('modal-login-email-user');
    const busiconModalLoginPasswordInput = document.getElementById('modal-login-password-user');
    const busiconForgotPasswordLink = document.getElementById('busicon-forgot-password-link');
    const busiconCreateAccountLink = document.getElementById('busicon-create-account-link');
    const busiconEmailSignupForm = document.getElementById('email-signup-form');
    const busiconModalSignupNameInput = document.getElementById('modal-signup-name');
    const busiconModalSignupEmailInput = document.getElementById('modal-signup-email');
    const busiconModalSignupPasswordInput = document.getElementById('modal-signup-password');
    const busiconModalSignupConfirmPasswordInput = document.getElementById('modal-signup-confirm-password');
    const busiconAlreadyAccountLink = document.getElementById('busicon-already-account-link');


    // Event listeners for opening/closing specific modals
    const closeBusiconLoginModalBtn = document.getElementById('close-busicon-login-modal-btn');
    const closeBusiconSignupModalBtn = document.getElementById('close-busicon-signup-modal-btn');
    if (closeBusiconLoginModalBtn) closeBusiconLoginModalBtn.addEventListener('click', window.closeAuthModal);
    if (closeBusiconSignupModalBtn) closeBusiconSignupModalBtn.addEventListener('click', window.closeAuthModal);

    // Links to switch between login/signup forms
    if (busiconCreateAccountLink) busiconCreateAccountLink.addEventListener('click', e => { e.preventDefault(); window.openSignupModal(); });
    if (busiconAlreadyAccountLink) busiconAlreadyAccountLink.addEventListener('click', e => { e.preventDefault(); window.openLoginModal(); });

    // Link for Forgot Password (triggers the NEW forgot password popup directly)
    if (busiconForgotPasswordLink) {
        busiconForgotPasswordLink.addEventListener('click', e => {
            e.preventDefault();
            window.openForgotModal();
        });
    }

    // Login Form Submission
    if (busiconEmailLoginForm) {
        busiconEmailLoginForm.addEventListener('submit', async function(e){
            e.preventDefault();
            const email = busiconModalLoginEmailInput.value.trim();
            const password = busiconModalLoginPasswordInput.value;

            if (!email || !password) {
                window.showStylishPopup({ iconType: 'error', title: 'Empty Fields!', message: 'Please enter both email and password.', buttons: [{text:'OK', action: window.closeStylishPopup}] });
                return;
            }

            try {
                const loginButton = busiconEmailLoginForm.querySelector('button[type="submit"]');
                const data = await apiRequest(window.API_LOGIN_URL, 'POST', { email, password }, false, loginButton, "Logging in...");
                handleAuthResponse(data, "email");
            } catch (err) {
                // Errors handled by apiRequest's showStylishPopup
            }
        });
    }

    // Signup Form Submission
    if (busiconEmailSignupForm) {
        busiconEmailSignupForm.addEventListener('submit', async function(e){
            e.preventDefault();
            const name = busiconModalSignupNameInput.value.trim();
            const email = busiconModalSignupEmailInput.value.trim();
            const password = busiconModalSignupPasswordInput.value;
            const confirmPassword = busiconModalSignupConfirmPasswordInput.value;

            if (!name || !email || !password || !confirmPassword) {
                window.showStylishPopup({ iconType: 'error', title: 'Empty Fields!', message: 'Please fill in all fields.', buttons: [{text:'OK', action: window.closeStylishPopup}] });
                return;
            }
            if (password !== confirmPassword) {
                window.showStylishPopup({ iconType: 'error', title: 'Password Mismatch!', message: 'Passwords do not match.', buttons: [{text:'OK', action: window.closeStylishPopup}] });
                return;
            }
            if (password.length < 6) {
                window.showStylishPopup({ iconType: 'error', title: 'Weak Password!', message: 'Password must be at least 6 characters long.', buttons: [{text:'OK', action: window.closeStylishPopup}] });
                return;
            }

            try {
                const signupButton = busiconEmailSignupForm.querySelector('button[type="submit"]');
                await processSignup(name, email, password, signupButton);
            } catch (err) {
                // Errors handled by apiRequest's showStylishPopup (or specific logic below)
            }
        });
    }

    // Google Sign-In/Signup Functionality - REVISED LOGIC
    window.handleCredentialResponse = async function(response) {
        window.closeStylishPopup();
        window.closeForgotPasswordNewPopup();
        window.showFullScreenLoader();

        const linkGuestId = sessionStorage.getItem('temp_linkGuestId');
        sessionStorage.removeItem('temp_linkGuestId');

        const payload = { token: response.credential };
        if (linkGuestId) {
            payload.linkGuestId = linkGuestId;
        }

        try {
            const data = await apiRequest(window.API_GOOGLE_SIGNIN_URL, 'POST', payload, false, null, "Signing in with Google...");
            handleAuthResponse(data, "google", !!linkGuestId);
        } catch (error) {
            // Error handling is already in apiRequest, so no specific popup here
        } finally {
            window.hideFullScreenLoader();
        }
    };

    async function processSignup(name, email, password, signupButton) {
        const guestId = localStorage.getItem(window.GUEST_ID_KEY);
        const guestName = localStorage.getItem(window.GUEST_NAME_KEY);

        let linkGuestId = null;
        if (guestId && guestName) {
            linkGuestId = await new Promise(resolveOuter => {
                window.showStylishPopup({
                    iconType: 'confirm',
                    title: 'Link Guest Activity?',
                    message: `You have previous activity as Guest: "${guestName}". Do you want to link this activity to your new account?`,
                    buttons: [
                        { text: 'Yes, Link', action: async () => { window.closeStylishPopup(); resolveOuter(guestId); } },
                        { text: 'No, Fresh Account', action: () => {
                            localStorage.removeItem(window.GUEST_ID_KEY);
                            localStorage.removeItem(window.GUEST_NAME_KEY);
                            window.closeStylishPopup();
                            resolveOuter(null);
                        } }
                    ]
                });
            });
        }

        const payload = { name, email, password };
        if (linkGuestId) {
            payload.linkGuestId = linkGuestId;
        }

        try {
            const data = await apiRequest(window.API_SIGNUP_URL, 'POST', payload, false, signupButton, "Signing up...");
            handleAuthResponse(data, "email", !!linkGuestId);
        } catch (error) {
            if (error.response && error.response.actionRequired === "SET_PASSWORD_FOR_GOOGLE_EMAIL") {
                window.showStylishPopup({
                    iconType: 'warning',
                    title: 'Account Exists (Google)',
                    message: `An account already exists for "${email}" linked via Google. To log in with email/password, you need to set a password.`,
                    buttons: [
                        { text: 'Set Password (Forgot Password)', action: () => {
                            window.closeStylishPopup();
                            window.openForgotModal();
                            const forgotEmailInput = document.getElementById('forgotPasswordEmailInput');
                            if (forgotEmailInput) {
                                forgotEmailInput.value = email;
                                forgotEmailInput.dispatchEvent(new Event('input'));
                            }
                        }},
                        { text: 'Log in with Google', action: () => {
                             window.closeStylishPopup();
                             window.openLoginModal();
                        }},
                        { text: 'Cancel', action: window.closeStylishPopup }
                    ]
                });
            } else {
                // For other errors, let the default error handler in apiRequest handle it
                throw error;
            }
        }
    }
    window.processSignup = processSignup;


    // --- PROFILE MENU ACTIONS ---
    const menuViewProfileLink = document.getElementById('menu-view-profile');
    const menuLogoutLink = document.getElementById('menu-logout');

    if (menuViewProfileLink) {
        menuViewProfileLink.addEventListener('click', async e => {
            e.preventDefault();
            const userMenu = document.getElementById('userMenu');
            if (userMenu) userMenu.classList.remove('active');
            const userProfileModal = document.getElementById('userProfileModal');
            if (userProfileModal) userProfileModal.classList.add('active');
            window.closeForgotPasswordNewPopup();

            window.showFullScreenLoader();
            try {
                await window.checkUserVerificationStatus();
                window.updateUIAfterLogin();
            } catch (error) {
                console.error("Error checking verification status on profile open:", error);
                window.updateUIAfterLogin();
            } finally {
                window.hideFullScreenLoader();
            }
        });
    }

    // Close profile modal when clicking overlay or specific close buttons
    const userProfileModal_main = document.getElementById('userProfileModal');
    if (userProfileModal_main) {
        userProfileModal_main.addEventListener('click', e => {
            if (e.target === userProfileModal_main) {
                userProfileModal_main.classList.remove('active');
            }
        });
        userProfileModal_main.querySelectorAll('[data-modal-close]').forEach(trigger => {
            trigger.addEventListener('click', () => {
                const targetModal = document.getElementById(trigger.getAttribute('data-modal-close'));
                if (targetModal) targetModal.classList.remove('active');
                const pwInputs = [document.getElementById('current-password'), document.getElementById('new-password-profile'), document.getElementById('confirm-new-password-profile')];
                pwInputs.forEach(input => {
                    if (input) {
                        input.value = '';
                        input.dispatchEvent(new Event('input'));
                    }
                });
            });
        });
    }

    if (menuLogoutLink) {
        menuLogoutLink.addEventListener('click', async e => {
            e.preventDefault();
            const userMenu = document.getElementById('userMenu');
            if (userMenu) userMenu.classList.remove('active');
            window.closeForgotPasswordNewPopup();

            window.showStylishPopup({
                iconType: 'confirm',
                title: 'Logout Confirmation',
                message: 'Are you sure you want to logout?',
                buttons: [
                    {
                        text: 'Logout',
                        addSpinnerOnClick: true,
                        spinnerText: 'Logging out...',
                        action: async () => {
                            await new Promise(resolve => setTimeout(resolve, 500));
                            localStorage.removeItem('nobita_jwt');
                            localStorage.removeItem(window.USER_PROFILE_CACHE_KEY);
                            localStorage.removeItem(window.GUEST_ID_KEY);
                            localStorage.removeItem(window.GUEST_NAME_KEY);
                            localStorage.removeItem('nobita_last_email');

                            window.currentUser = null;
                            if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
                                google.accounts.id.disableAutoSelect();
                            }
                            window.updateUIAfterLogout();
                            if (window.resetFeedbackForm) window.resetFeedbackForm();
                            window.closeStylishPopup();
                            window.showStylishPopup({
                                iconType: 'info',
                                title: 'Logged Out',
                                message: 'You have been successfully logged out.',
                                buttons: [{text:'OK', action: window.closeStylishPopup}]
                            });
                            if (window.fetchFeedbacks) await window.fetchFeedbacks();
                        }
                    },
                    { text: 'Cancel', action: window.closeStylishPopup }
                ]
            });
        });
    }

    if (feedbackFormContainer) setTimeout(() => feedbackFormContainer.classList.add('animate-in'), 300);
    if (feedbackListContainer) setTimeout(() => feedbackListContainer.classList.add('animate-in'), 400);

    // --- INITIAL LOGIN STATUS CHECK ---
    async function checkLoginStatus() {
    const token = localStorage.getItem('nobita_jwt');
    let userLoadedFromCache = false;

    if (token) {
        try {
            // 🔁 Try loading from cache
            const cachedUserJSON = localStorage.getItem(window.USER_PROFILE_CACHE_KEY);
            if (cachedUserJSON) {
                const cachedUser = JSON.parse(cachedUserJSON);
                if (cachedUser && typeof cachedUser === 'object' && cachedUser.userId) {
                    window.currentUser = cachedUser;
                    // FIX: Ensure password flag is properly set from cache
                    if (window.currentUser.loginMethod === 'google' && !cachedUser.password) {
                        window.currentUser.password = undefined;
                    } else if (cachedUser.password) {
                        window.currentUser.password = true;
                    } else {
                        window.currentUser.password = undefined;
                    }
                    window.updateUIAfterLogin();
                    userLoadedFromCache = true;
                } else {
                    localStorage.removeItem(window.USER_PROFILE_CACHE_KEY);
                }
            }
        } catch (e) {
            console.error("Cache reading error:", e);
            localStorage.removeItem(window.USER_PROFILE_CACHE_KEY);
        }

        try {
            // 🔥 Always fetch fresh data from API
            const freshUserData = await apiRequest(window.API_VALIDATE_TOKEN_URL, 'GET');

            window.currentUser = freshUserData.user || freshUserData; // Jisme mile, usme set kar de
            // FIX: Ensure password flag is properly set from fresh data
            if (window.currentUser.loginMethod === 'google' && !window.currentUser.password) {
                window.currentUser.password = undefined;
            } else if (window.currentUser.loginMethod === 'email' || window.currentUser.password) {
                // If a user has a password (whether email or Google-linked), set this flag.
                // The server should be sending `loginMethod: 'email'` for a Google user after they set a password.
                window.currentUser.password = true;
            }
            
            const freshUserDataJSON = JSON.stringify(window.currentUser);
            const cachedUserJSON = localStorage.getItem(window.USER_PROFILE_CACHE_KEY);

            // ⚡ Compare with cache and update if changed
            if (cachedUserJSON !== freshUserDataJSON) {
                localStorage.setItem(window.USER_PROFILE_CACHE_KEY, freshUserDataJSON);
                window.updateUIAfterLogin();
            } else if (!userLoadedFromCache) {
                window.updateUIAfterLogin(); // In case cache load fail hua but data same hai
            }

        } catch (error) {
            console.error("Token validation failed or user fetch error:", error);
            localStorage.removeItem('nobita_jwt');
            localStorage.removeItem(window.USER_PROFILE_CACHE_KEY);
            localStorage.removeItem(window.GUEST_ID_KEY);
            localStorage.removeItem(window.GUEST_NAME_KEY);
            localStorage.removeItem('nobita_last_email');
            window.currentUser = null;
            window.updateUIAfterLogout();
            if (window.resetFeedbackForm) window.resetFeedbackForm();
        }
    } else {
        // 👎 No token? Full logout kar
        localStorage.removeItem(window.USER_PROFILE_CACHE_KEY);
        window.currentUser = null;
        window.updateUIAfterLogout();
        if (window.resetFeedbackForm) window.resetFeedbackForm();
    }

    if (window.fetchFeedbacks) await window.fetchFeedbacks(); // 🗂️ Final call
}
window.checkLoginStatus = checkLoginStatus;

    // Initialize Google Sign-In client
    if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
        google.accounts.id.initialize({
            client_id: window.GOOGLE_CLIENT_ID,
            callback: window.handleCredentialResponse,
        });

        const loginModalContainer = document.getElementById('google-btn-container-login');
        const signupModalContainer = document.getElementById('google-btn-container-signup');

        // Logic to show fallback buttons if One Tap is not displayed
        const showFallbackButtons = () => {
            console.log("Google One Tap was not displayed, showing alternative buttons.");
            if(loginModalContainer) {
                loginModalContainer.innerHTML = '';
                google.accounts.id.renderButton(loginModalContainer, {
                    type: "standard",
                    theme: "filled_blue",
                    size: "large",
                    text: "continue_with",
                    shape: "pill",
                    logo_alignment: "left",
                    width: 320
                });
                loginModalContainer.style.display = 'block';
            }
            if(signupModalContainer) {
                signupModalContainer.innerHTML = '';
                google.accounts.id.renderButton(signupModalContainer, {
                    type: "standard",
                    theme: "filled_blue",
                    size: "large",
                    text: "continue_with",
                    shape: "pill",
                    logo_alignment: "left",
                    width: 320
                });
                signupModalContainer.style.display = 'block';
            }
        };

        // Try to prompt One Tap if no user token is found
        if (!localStorage.getItem('nobita_jwt')) {
            google.accounts.id.prompt((notification) => {
                if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                    showFallbackButtons();
                } else if (notification.isDismissedMoment()) {
                    // Do nothing, user dismissed it. They can still use email or click buttons later.
                }
            });
        }

    } else {
        console.error("Google Identity Services script not loaded. Google Sign-In will not work.");
    }

    checkLoginStatus();

    const ownerInfoEl = document.querySelector('.owner-info');
    if (ownerInfoEl) {
        setTimeout(() => ownerInfoEl.classList.add('animate-in'), 200);
    }

    // NEW: Service Worker registration
    async function registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('Service Worker registered:', registration);
                return registration;
            } catch (error) {
                console.error('Service Worker registration failed:', error);
                return null;
            }
        }
        return null;
    }
    await registerServiceWorker();
    
    // === SMART SCROLL TO TOP LOGIC (START) ===
    const scrollToTopBtn = document.getElementById('scrollToTopBtn');
    
    if (scrollToTopBtn) {
        // Scroll threshold (kitna scroll karne par button dikhe)
        const scrollThreshold = 300; // 300px
        
        // Window scroll event
        window.addEventListener('scroll', () => {
            if (window.scrollY > scrollThreshold) {
                scrollToTopBtn.classList.add('show');
            } else {
                scrollToTopBtn.classList.remove('show');
            }
        }, { passive: true }); // {passive: true} scroll performance behtar karta hai
        
        // Button click event
        scrollToTopBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth' // Smooth scroll!
            });
        });
    }
    // === SMART SCROLL TO TOP LOGIC (END) ===
});

// NEW: Function to subscribe a user to push notifications
async function registerUserForNotifications() {
    if (!('serviceWorker' in navigator) || !window.currentUser || !window.VAPID_PUBLIC_KEY) {
        console.warn("Cannot register for notifications: Service Worker, current user, or VAPID key not available.");
        return;
    }

    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: window.VAPID_PUBLIC_KEY
        });

        await apiRequest('/api/user/subscribe-notifications', 'POST', { subscription });

        console.log('User registered for notifications successfully!');
    } catch (error) {
        console.error('Failed to register for notifications:', error);
    }
}
window.registerUserForNotifications = registerUserForNotifications;

// AUTO URL CLEANER: .html ko URL se gayab kar deta hai + .html links ko auto clean redirect
(function() {
  // On page load, agar URL /page.html hai, toh .html hata de (browser address bar me, bina reload)
  var path = window.location.pathname;
  if (path.match(/\/([a-zA-Z0-9_-]+)\.html$/)) {
    var clean = path.replace(/\.html$/, '');
    if (clean !== path) window.history.replaceState({}, '', clean);
  }
  // Intercept all <a href="*.html"> click and clean redirect kare
  document.addEventListener('DOMContentLoaded', function() {
    document.body.addEventListener('click', function(e) {
      // OG: Anchors with .html in href
      var a = e.target.closest('a');
      if (a && a.getAttribute('href') && a.getAttribute('href').endsWith('.html')) {
        e.preventDefault();
        var newUrl = a.getAttribute('href').replace('.html', '');
        // Use location.assign for full reload (so backend serves right file)
        window.location.assign(newUrl);
      }
    });
  });
})();
// OG Index.html killer: saare anchor aur JS se index.html redirect ko handle karega
(function() {
  // Intercept all <a> clicks for any type of index.html reference
  document.body.addEventListener('click', function(e) {
    let a = e.target.closest('a');
    if (a && a.getAttribute('href')) {
      let href = a.getAttribute('href').replace(/^\.?\//, '').toLowerCase();
      if (href === 'index.html' || href === 'index' || href === './index.html' || href === '/index.html' || href === '/index') {

      }
    }
  });


      // --- ADD THE FOLLOWING LINE DIRECTLY BELOW THE ABOVE LOGIC ---
    if (window.checkUserVerificationStatus) window.checkUserVerificationStatus(); // Check user's email verification status on page load
    // --- END ADDITION ---


  // Patch window.location redirects (assign, replace, direct set)
  let origAssign = window.location.assign;
  let origReplace = window.location.replace;
  Object.defineProperty(window.location, 'href', {
    set: function(url) {
      if (typeof url === 'string' && /\/?index(\.html)?$/i.test(url)) {

      } else {
        origAssign.call(window.location, url);
      }
    },
    get: function() {
      return window.location.toString();
    }
  });
  window.location.assign = function(url) {
    if (typeof url === 'string' && /\/?index(\.html)?$/i.test(url)) {

    }
    return origAssign.apply(window.location, arguments);
  };
  window.location.replace = function(url) {
    if (typeof url === 'string' && /\/?index(\.html)?$/i.test(url)) {

    }
    return origReplace.apply(window.location, arguments);
  };
})();