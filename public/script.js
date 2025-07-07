// --- GLOBAL CONSTANTS ---
// API Base URL from your server.js logic (if it's on Render, this is likely window.location.origin)
const BASE_API_URL = window.location.origin;

// Google Client ID (from your provided index.html's JS block)
const GOOGLE_CLIENT_ID = '609784004025-li543jevd5e9u3a58ihvr98a2jpqfb8b.apps.googleusercontent.com';

// --- API ENDPOINTS ---
const API_LOGIN_URL = `${BASE_API_URL}/api/auth/login`;
const API_SIGNUP_URL = `${BASE_API_URL}/api/auth/signup`;
const API_GOOGLE_SIGNIN_URL = `${BASE_API_URL}/api/auth/google-signin`;
const API_VALIDATE_TOKEN_URL = `${BASE_API_URL}/api/auth/me`;
const API_REQUEST_RESET_URL = `${BASE_API_URL}/api/auth/request-password-reset`;
const API_REQUEST_VERIFICATION_URL = `${BASE_API_URL}/api/auth/request-email-verification`;
const API_UPDATE_PROFILE_URL = `${BASE_API_URL}/api/user/profile`;
const API_CHANGE_PASSWORD_URL = `${BASE_API_URL}/api/user/change-password`;
const API_FEEDBACK_URL = `${BASE_API_URL}/api/feedback`;
const API_FETCH_FEEDBACKS_URL = `${BASE_API_URL}/api/feedbacks`;


// CLOUDINARY CONFIG
const CLOUDINARY_CLOUD_NAME = 'dyv7xav3e';
const CLOUDINARY_UPLOAD_PRESET = 'nobita_avatar_unsigned';
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;


// --- GLOBAL STATE VARIABLES ---
let currentUser = null;
const GUEST_ID_KEY = 'nobi_guestId';
const GUEST_NAME_KEY = 'nobi_guestName';
const USER_PROFILE_CACHE_KEY = 'nobi_user_profile';
const FEEDBACKS_CACHE_KEY = 'nobi_feedbacks';

let currentSelectedRating = 0;
let isEditing = false;
let currentEditFeedbackId = null;


// --- UTILITY FUNCTIONS ---

// --- GLOBAL CONSTANTS ---
// Breadcrumb trail ko local storage mein store karne ke liye key
const BREADCRUMB_STORAGE_KEY = 'nobitaBreadcrumbTrail';

// --- HELPER FUNCTIONS ---
// Segment name se ".html" remove karna aur capitalize karna
function getCleanTitle(segment) {
    let displayText = segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');
    if (displayText.toLowerCase().endsWith('.html')) {
        displayText = displayText.slice(0, -5); // Remove ".html" extension
    }
    return displayText;
}

// URL path ko normalize karega: .html hataega, trailing slash add/remove karega
function normalizePath(path) {
    // 1. .html extension remove karein
    let normalized = path.replace(/\.html$/i, '');

    // 2. Trailing slash (/) ko handle karein. Root '/' ko chhodkar.
    // Agar path sirf '/' hai, toh use वैसा ही rehne dein.
    // Agar normalized path empty string ban gaya hai (jaise sirf '.html' tha), toh '/' return karein.
    if (normalized.length > 1 && normalized.endsWith('/')) {
        normalized = normalized.slice(0, -1);
    }
    // Agar path '/index' ya 'index' ya empty string tha toh use '/' bana dein
    if (normalized === '' || normalized.toLowerCase() === '/index') {
        return '/';
    }
    return normalized;
}

// Inferred parent relationships ke liye mapping
// Agar aapki files flat structure mein hain (jaise 'rdp-connect.html' root mein),
// aur aap chahte hain ki breadcrumb mein uska koi 'parent' dikhe jo URL mein nahi hai,
// toh yahan us relation ko define karein.
const INFERRED_HIERARCHY_MAP = {
    // 'child-page-normalized-name': { title: 'Parent Category Name', normalizedUrl: '/parent-category-normalized-url' },
    // Dhyan dein: yahan key aur url normalized hone chahiye
    'rdp-connect': { title: 'RDP', normalizedUrl: '/rdp' },
    // Example: agar aapke paas 'about-us.html' hai aur aap usko 'Company > About Us' dikhana chahte hain
    // aur 'company.html' bhi hai: 'about-us': { title: 'Company', normalizedUrl: '/company' },
};


// --- MAIN BREADCRUMB LOGIC ---
function generateDynamicBreadcrumbs() {
    // Purane breadcrumbs container ko hata dein taaki duplicate na bane
    const existingBreadcrumbs = document.getElementById('dynamic-breadcrumbs');
    if (existingBreadcrumbs) {
        existingBreadcrumbs.remove();
    }

    const currentPathname = window.location.pathname;
    // Current URL path ko normalize karein
    const normalizedCurrentPath = normalizePath(currentPathname);

    const isHomePage = (normalizedCurrentPath === '/');

    let breadcrumbTrail = JSON.parse(localStorage.getItem(BREADCRUMB_STORAGE_KEY)) || [];
    let updatedTrail = [];

    // Current page ki information taiyar karein (normalized URL aur title ke saath)
    const currentPageFileName = normalizedCurrentPath.split('/').pop(); // Normalized path ka last segment
    const currentPageInfo = {
        url: normalizedCurrentPath,
        title: getCleanTitle(currentPageFileName || 'Home')
    };
    if (isHomePage) {
        currentPageInfo.title = 'Home';
        currentPageInfo.url = '/'; // Home page ka URL consistent rakhein
    }

    // 1. Trail Management Logic
    if (isHomePage) {
        // Agar current page Home hai, toh trail ko sirf Home par reset karein
        updatedTrail = [{ title: 'Home', url: '/' }];
    } else {
        // Current page ko trail mein dhoondein (normalized URL ke basis par)
        const existingIndex = breadcrumbTrail.findIndex(item => item.url === currentPageInfo.url);

        if (existingIndex !== -1) {
            // Agar page trail mein mil gaya (yaani back/forward button se aaye ya dubara visit kiya),
            // toh trail ko us point tak truncate karein
            updatedTrail = breadcrumbTrail.slice(0, existingIndex + 1);
        } else {
            // Page naya hai trail mein
            updatedTrail = [...breadcrumbTrail]; // Existing trail copy karein

            // Inferred parent add karein agar applicable hai
            // yahan key normalizedCurrentPath ke filename part ka use karein
            const currentNormalizedFileName = normalizedCurrentPath.split('/').pop();
            if (INFERRED_HIERARCHY_MAP[currentNormalizedFileName.toLowerCase()]) {
                const inferredParent = INFERRED_HIERARCHY_MAP[currentNormalizedFileName.toLowerCase()];
                // Check karein ki inferred parent trail mein already nahi hai (normalized URL ke basis par)
                const parentInTrail = updatedTrail.some(item => item.url === inferredParent.normalizedUrl);

                // Agar inferred parent trail mein nahi hai aur hum Home se seedhe is inferred child par aaye hain,
                // toh inferred parent ko Home ke baad add karein.
                if (!parentInTrail && updatedTrail.length > 0 && updatedTrail[updatedTrail.length - 1].url === '/') {
                    updatedTrail.push({
                        title: inferredParent.title,
                        url: inferredParent.normalizedUrl
                    });
                }
            }

            // Current page ko trail mein add karein, ensure no duplicates at the very end
            // Dhyan dein: yahan check normalizedCurrentPath/currentPageInfo.url se hoga
            if (updatedTrail.length === 0 || updatedTrail[updatedTrail.length - 1].url !== currentPageInfo.url) {
                updatedTrail.push(currentPageInfo);
            }
        }
    }

    // Local storage mein updated trail save karein
    localStorage.setItem(BREADCRUMB_STORAGE_KEY, JSON.stringify(updatedTrail));

    // 2. Breadcrumb Rendering Logic
    renderBreadcrumbs(updatedTrail);
}

// Separate function to render the breadcrumbs HTML
function renderBreadcrumbs(trailToRender) {
    const breadcrumbContainer = document.createElement('nav');
    breadcrumbContainer.id = 'dynamic-breadcrumbs';
    breadcrumbContainer.style.cssText = `
        margin: 10px 0 5px 0; /* Upar, daayen, neeche, baayen ke liye margins */
        padding: 0 0px; /* Thoda left padding taaki bilkul edge se na chipke, right side se bhi */
        background-color: transparent; /* Koi background color nahi */
        border-radius: 0; /* Koi gol corners nahi */
        box-shadow: none; /* Koi shadow nahi */
        font-family: 'Poppins', sans-serif;
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        font-size: 0.9em; /* Font size thoda chhota */
        width: 100%; /* Apne container ki poori width le */
        box-sizing: border-box; /* Padding bhi width mein shamil ho */
    `;

    const breadcrumbList = document.createElement('ol');
    breadcrumbList.style.cssText = `
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        width: 100%;
        justify-content: flex-start; /* Left align karein */
    `;

    trailToRender.forEach((item, index) => {
        // Separator '>' add karein har item se pehle, Home ke baad
        if (index > 0) {
            const separator = document.createElement('li');
            separator.textContent = '>';
            separator.style.cssText = `
                margin: 0 6px;
                color: #6c757d;
                font-weight: 600;
                user-select: none;
            `;
            breadcrumbList.appendChild(separator);
        }

        const listItem = document.createElement('li');
        // Aakhri item (current page) non-clickable span hoga
        if (index === trailToRender.length - 1) {
            const span = document.createElement('span');
            span.textContent = item.title;
            span.style.cssText = `
                color: #495057; /* Current page ke liye thoda dark color */
                font-weight: 600;
                cursor: default;
                white-space: nowrap;
            `;
            listItem.appendChild(span);
        } else { // Intermediate items clickable link honge
            const link = document.createElement('a');
            link.href = item.url; // Use the normalized URL for links
            link.textContent = item.title;
            link.style.cssText = `
                text-decoration: none;
                color: #007bff;
                font-weight: 500;
                transition: color 0.3s ease;
                white-space: nowrap;
            `;
            link.onmouseover = function() { this.style.color = '#0056b3'; };
            link.onmouseout = function() { this.style.color = '#007bff'; };
            listItem.appendChild(link);
        }
        breadcrumbList.appendChild(listItem);
    });

    // --- NEW LOGIC FOR HOME PAGE 'Home >' ---
    // Agar trail mein sirf Home hai, toh ek additional '>' separator add karein
    if (trailToRender.length === 1 && trailToRender[0].url === '/') {
        const separator = document.createElement('li');
        separator.textContent = '>';
        separator.style.cssText = `
            margin: 0 6px;
            color: #6c757d;
            font-weight: 600;
            user-select: none;
        `;
        breadcrumbList.appendChild(separator);
    }
    // --- END NEW LOGIC ---

    breadcrumbContainer.appendChild(breadcrumbList);

    // Injection logic: Breadcrumbs ko 'fancy-divider' ke baad ya 'hero-section' se pehle inject karein
    const fancyDivider = document.querySelector('.fancy-divider');
    const heroSection = document.querySelector('.hero-section');

    if (fancyDivider) {
        fancyDivider.insertAdjacentElement('afterend', breadcrumbContainer);
    } else if (heroSection && heroSection.parentNode) {
        heroSection.parentNode.insertBefore(breadcrumbContainer, heroSection);
    } else {
        document.body.prepend(breadcrumbContainer); // Fallback agar koi specific element na mile
    }
}

// --- EVENT LISTENERS ---
// Function ko DOM fully load hone par call karein initial page load ke liye
document.addEventListener('DOMContentLoaded', generateDynamicBreadcrumbs);

// Browser ke back/forward buttons (History API) ko handle karne ke liye popstate event sunein.
window.addEventListener('popstate', generateDynamicBreadcrumbs);
// Shows fullscreen loading spinner
function showFullScreenLoader() {
    const loader = document.getElementById('nobi-fullscreen-loader');
    if (loader) loader.style.display = 'flex';
}

// Hides fullscreen loading spinner
function hideFullScreenLoader() {
    const loader = document.getElementById('nobi-fullscreen-loader');
    if (loader) loader.style.display = 'none';
}

// Opens the login modal
function openLoginModal() {
    const authModalOverlay = document.getElementById('auth-modal-overlay');
    const busiconLoginContainer = document.getElementById('busicon-login-container');
    const busiconSignupContainer = document.getElementById('busicon-signup-container');

    if (authModalOverlay && busiconLoginContainer && busiconSignupContainer) {
        authModalOverlay.classList.add('active');
        busiconLoginContainer.style.display = 'block';
        busiconSignupContainer.style.display = 'none';

        const busiconModalLoginEmailInput = document.getElementById('modal-login-email');
        if (busiconModalLoginEmailInput) busiconModalLoginEmailInput.focus();
    }
}

// Opens the signup modal
function openSignupModal() {
    const authModalOverlay = document.getElementById('auth-modal-overlay');
    const busiconLoginContainer = document.getElementById('busicon-login-container');
    const busiconSignupContainer = document.getElementById('busicon-signup-container');

    if (authModalOverlay && busiconLoginContainer && busiconSignupContainer) {
        authModalOverlay.classList.add('active');
        busiconLoginContainer.style.display = 'none';
        busiconSignupContainer.style.display = 'block';

        const busiconModalSignupNameInput = document.getElementById('modal-signup-name');
        if (busiconModalSignupNameInput) busiconModalSignupNameInput.focus();
    }
}

// Closes the main authentication modal (both login/signup containers)
function closeAuthModal() {
    const authModalOverlay = document.getElementById('auth-modal-overlay');
    const busiconLoginContainer = document.getElementById('busicon-login-container');
    const busiconSignupContainer = document.getElementById('busicon-signup-container');

    if (authModalOverlay) {
        authModalOverlay.classList.remove('active');
        if (busiconLoginContainer) busiconLoginContainer.style.display = 'none';
        if (busiconSignupContainer) busiconSignupContainer.style.display = 'none';
    }
}
window.closeAuthModal = closeAuthModal;

// Toggles password visibility in input fields
function togglePass(id, el) {
  const inp = document.getElementById(id);
  if (!inp || !el) return;
  if (inp.type === "password") {
    inp.type = "text";
    el.innerHTML = '<i class="fas fa-eye"></i>';
  } else {
    inp.type = "password";
    el.innerHTML = '<i class="fas fa-eye-slash"></i>';
  }
}
window.togglePass = togglePass;

// Custom Stylish Popup display function
function showStylishPopup(options = {}) {
    const stylishPopupOverlay = document.getElementById('stylishPopupOverlay');
    const stylishPopupTitleEl = document.getElementById('stylishPopupTitle');
    const stylishPopupMessageEl = document.getElementById('stylishPopupMessage');
    const stylishPopupIconEl = document.getElementById('stylishPopupIcon');
    const stylishPopupButtonContainer = document.getElementById('stylishPopupButtonContainer');
    const stylishPopupFormArea = document.getElementById('stylishPopupFormArea');

    if (!stylishPopupOverlay || !stylishPopupTitleEl || !stylishPopupMessageEl || !stylishPopupIconEl || !stylishPopupButtonContainer) {
        const simpleMessage = (options.message || '').replace(/<p>|<\/p>|<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, '');
        alert(`${options.title || 'Notice'}:\n${simpleMessage}`);
        if (options.buttons && options.buttons.length === 1 && typeof options.buttons[0].action === 'function' && !options.buttons[0].addSpinnerOnClick) options.buttons[0].action();
        else if (!options.buttons && options.onConfirm && typeof options.onConfirm === 'function') options.onConfirm();
        return;
    }

    // Resetting the class list to prevent double icons
    stylishPopupIconEl.className = 'popup-icon-area'; // Keep base class

    // Mapping iconType to Font Awesome classes
    const iconsFA = {
        'success': 'fa-check-circle',
        'error': 'fa-times-circle',
        'info': 'fa-info-circle',
        'warning': 'fa-exclamation-triangle',
        'confirm': 'fa-question-circle',
        'forgot_password': 'fa-key',
        'verify_email': 'fa-envelope-open-text',
        'celebrate': 'fa-star',
        'user-lock': 'fa-user-lock',
        'google': 'fa-google'
    };

    // Determine the icon class to use
    let iconClassToUse = options.icon || iconsFA[options.iconType] || 'fa-info-circle';

    // Add the determined icon class to the element
    stylishPopupIconEl.innerHTML = `<i class="fas ${iconClassToUse}"></i>`;


    stylishPopupTitleEl.textContent = options.title || 'Notice';
    stylishPopupMessageEl.innerHTML = (options.message || '').startsWith('<p>') ? options.message : `<p>${options.message || ''}</p>`;

    if (stylishPopupFormArea) {
        stylishPopupFormArea.innerHTML = options.formHTML || '';
        stylishPopupFormArea.style.display = options.formHTML ? 'block' : 'none';
    }

    stylishPopupButtonContainer.innerHTML = '';
    if (options.buttons && options.buttons.length > 0) {
        options.buttons.forEach(btnConfig => {
            const button = document.createElement('button');
            button.textContent = btnConfig.text;
            button.className = `popup-button ${btnConfig.className || ''}`.trim();
            if (btnConfig.id) button.id = btnConfig.id;
            
            button.onclick = async () => {
                let originalBtnHTML;
                if (btnConfig.addSpinnerOnClick) {
                    originalBtnHTML = button.innerHTML;
                    button.disabled = true;
                    button.innerHTML = `<span class="nobi-spinner"></span> ${btnConfig.spinnerText || 'Processing...'}`;
                }
                try {
                    await btnConfig.action(button);
                } catch (e) {
                    console.error("Error in popup button action:", e);
                } finally {
                    if (btnConfig.addSpinnerOnClick && stylishPopupOverlay.classList.contains('active') && document.body.contains(button)) {
                        button.disabled = false;
                        button.innerHTML = originalBtnHTML;
                    }
                }
            };
            stylishPopupButtonContainer.appendChild(button);
        });
    } else {
        const okBtn = document.createElement('button');
        okBtn.textContent = options.confirmText || 'OK';
        okBtn.className = 'popup-button';
        okBtn.id = 'stylishPopupPrimaryActionBtn';
        okBtn.onclick = () => {
            if (stylishPopupOverlay) stylishPopupOverlay.classList.remove('active');
            if (options.onConfirm) options.onConfirm();
        };
        stylishPopupButtonContainer.appendChild(okBtn);
    }
    
    if (stylishPopupOverlay) stylishPopupOverlay.classList.add('active');
}
window.showStylishPopup = showStylishPopup;

// Closes the Stylish Popup
function closeStylishPopup() {
    const stylishPopupOverlay = document.getElementById('stylishPopupOverlay');
    if (stylishPopupOverlay) {
        stylishPopupOverlay.classList.remove('active');
    }
}
window.closeStylishPopup = closeStylishPopup;

// --- User Profile and Verification Status Handling ---

/**
 * Fetches the user's current verification status from the backend
 * and updates the visibility of the email verification prompt on the UI.
 * This should be called on page load and after any user authentication event.
 */
async function checkUserVerificationStatus() {
    const verificationPrompt = document.getElementById('feedback-verification-prompt');
    if (!verificationPrompt) {
        console.warn("Email verification prompt element not found (ID: feedback-verification-prompt).");
        return; // Exit if the element doesn't exist
    }

    const token = localStorage.getItem('nobita_jwt');
    if (!token) {
        // User is not logged in, ensure the prompt is hidden
        verificationPrompt.style.display = 'none';
        return;
    }

    try {
        // Use the existing apiRequest helper to call the API_VALIDATE_TOKEN_URL
        // This assumes API_VALIDATE_TOKEN_URL points to an endpoint like /api/auth/me
        const response = await apiRequest(API_VALIDATE_TOKEN_URL, 'GET');

        if (response.success && response.user) {
            // Update the global currentUser object with fresh data
            currentUser = response.user;
            // Also update localStorage cache if you're using it for user profile
            localStorage.setItem(USER_PROFILE_CACHE_KEY, JSON.stringify(currentUser));

            if (currentUser.isVerified) {
                verificationPrompt.style.display = 'none'; // Hide if user is verified
            } else {
                verificationPrompt.style.display = 'block'; // Show if user is not verified
            }
        } else {
            // If token is invalid or user data cannot be fetched, hide the prompt
            console.warn("Failed to validate token or retrieve user profile:", response.message || "Unknown error.");
            verificationPrompt.style.display = 'none';
            // Optionally, handle token expiration/invalidity here (e.g., clear token, show login modal)
            // localStorage.removeItem('nobita_jwt');
        }
    } catch (error) {
        console.error('Error in checkUserVerificationStatus:', error);
        // On network error or other API issues, decide whether to show or hide.
        // For safety, defaulting to showing if API call fails or there's an issue.
        verificationPrompt.style.display = 'block';
    }
}
window.checkUserVerificationStatus = checkUserVerificationStatus; // Make it globally accessible if needed by other parts of your app

// Function to handle "Forgot Password" link click (opens the NEW forgot password popup)
function openForgotModal() {
    closeAuthModal();
    closeStylishPopup();

    const forgotPasswordNewOverlay = document.getElementById('forgotPasswordNewOverlay');
    if (forgotPasswordNewOverlay) {
        forgotPasswordNewOverlay.classList.add('active');
        renderForgotForm();
    }
}
window.openForgotModal = openForgotModal;


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
        showFullScreenLoader();
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
                throw new Error(text || `Server Error (${response.status})`);
            }
        }

        if (!response.ok) {
            throw new Error(data.message || `Server Error (${response.status})`);
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

        if (!(error.message && error.message.includes("Email not verified"))) {
            showStylishPopup({
                iconType: 'error',
                title: 'Request Failed',
                message: msg,
                buttons: [{text: 'OK', action: closeStylishPopup}]
            });
        }
        
        throw error;
    } finally {
        if (currentSubmitBtn) {
            currentSubmitBtn.disabled = false;
            currentSubmitBtn.innerHTML = originalButtonHTML;
        } else if (method === 'POST' && url.includes('/api/auth/google-signin')) {
            hideFullScreenLoader();
        }
    }
}

// Saves login info to localStorage
function saveLogin(data){
  localStorage.setItem("nobita_jwt", data.token);
  localStorage.setItem(USER_PROFILE_CACHE_KEY, JSON.stringify(data.user));
  
  localStorage.setItem("nobita_last_email", data.user.email);
}

// Handles successful authentication response (Login, Signup, Google Sign-in)
async function handleAuthResponse(data, source = "email", linkedGuestActivity = false) {
    closeAuthModal();

    saveLogin(data);
    currentUser = data.user;

    await checkUserVerificationStatus(); // <-- ADD THIS LINE HERE
    if (linkedGuestActivity) {
        localStorage.removeItem(GUEST_ID_KEY);
        localStorage.removeItem(GUEST_NAME_KEY);
        console.log("Guest ID and Name cleared after linking activity.");
    }

    updateUIAfterLogin();

    // Removed the redirection to verify-email.html here
    if (currentUser.loginMethod === 'email' && !currentUser.isVerified) {
        let msg = `Account created for ${currentUser.name}! Please check your email to verify your account.`;
        if (linkedGuestActivity) msg += " Your previous guest activity has also been linked.";
        
        showStylishPopup({
            iconType: 'warning',
            title: `Welcome, ${currentUser.name}!`,
            message: msg,
            buttons: [{text: 'OK', action: closeStylishPopup}] // Changed to OK to close popup
        });
        await fetchFeedbacks(); // Still fetch feedbacks
        return;
    }

    let msg = data.message || (source === 'google' ? 'Successfully logged in with Google!' : 'Successfully logged in!');
    if (linkedGuestActivity) {
        msg += " Your previous guest activity has been linked to this account.";
    }

    showStylishPopup({
        iconType: 'success',
        title: `Welcome, ${currentUser.name}!`,
        message: msg,
        buttons: [{text: 'Awesome!', action: closeStylishPopup}]
    });

    await fetchFeedbacks();
}

// Updates UI elements after a user logs in
function updateUIAfterLogin() {
    const navLoginIconTrigger = document.getElementById('login-icon-trigger');
    const userProfileTrigger = document.getElementById('user-profile-trigger');
    const userProfileAvatarImg = document.getElementById('user-profile-avatar');
    const userProfileNameSpan = document.getElementById('user-profile-name');
    const menuAvatarImg = document.getElementById('menu-avatar');
    const menuUsernameSpan = document.getElementById('menu-username');
    const menuVerifyEmailOption = document.getElementById('menu-verify-email-option');
    const nameInputInFeedbackForm = document.getElementById('name');


    if (!currentUser) return;

    if (navLoginIconTrigger) navLoginIconTrigger.classList.add('hidden');
    if (userProfileTrigger) {
        userProfileTrigger.classList.remove('hidden');
        if (userProfileAvatarImg) {
            userProfileAvatarImg.src = currentUser.avatarUrl || `https://placehold.co/40x40/6a0dad/FFFFFF?text=${encodeURIComponent(currentUser.name.charAt(0).toUpperCase())}`;
        }
        if (userProfileNameSpan) userProfileNameSpan.textContent = currentUser.name;
    }

    if (menuAvatarImg) menuAvatarImg.src = currentUser.avatarUrl || `https://placehold.co/82x82/FFD700/23235a?text=${encodeURIComponent(currentUser.name.charAt(0).toUpperCase())}`;
    if (menuUsernameSpan) menuUsernameSpan.textContent = currentUser.name;

    if (nameInputInFeedbackForm) {
        nameInputInFeedbackForm.value = currentUser.name;
        nameInputInFeedbackForm.disabled = true;
        nameInputInFeedbackForm.dispatchEvent(new Event('input'));
    }

    const isEmailUserUnverified = currentUser.loginMethod === 'email' && !currentUser.isVerified;
    
    const emailVerificationPrompt = document.getElementById('email-verification-prompt');
    const feedbackVerificationPrompt = document.getElementById('feedback-verification-prompt');

    const commonPromptDisplay = isEmailUserUnverified ? 'flex' : 'none';

    if (emailVerificationPrompt) {
        emailVerificationPrompt.style.display = commonPromptDisplay;
    }
    if (feedbackVerificationPrompt) {
        feedbackVerificationPrompt.style.display = commonPromptDisplay;
    }

    if (menuVerifyEmailOption) {
        menuVerifyEmailOption.style.display = isEmailUserUnverified ? 'list-item' : 'none';
    }

    const profileNameInput = document.getElementById('profile-name');
    const profileEmailInput = document.getElementById('profile-email');
    const saveProfileChangesBtn = document.getElementById('save-profile-changes-btn');
    const avatarUploadInput = document.getElementById('avatar-upload-input');
    const uploadAvatarNowBtn = document.getElementById('upload-avatar-now-btn');
    const changePasswordForm = document.getElementById('change-password-form');
    const changePasswordBtn = document.getElementById('change-password-btn');
    const profileDisplayAvatar = document.getElementById('profile-display-avatar');
    const submitButton = document.getElementById('submit-feedback');

    if (profileNameInput) {
        profileNameInput.value = currentUser.name;
        profileNameInput.disabled = (currentUser.loginMethod === 'google') || isEmailUserUnverified;
        profileNameInput.title = currentUser.loginMethod === 'google' ? "Your name is managed by Google." : (isEmailUserUnverified ? "Verify your email to edit your name." : "Edit your name");
    }
    if (profileEmailInput) profileEmailInput.value = currentUser.email;

    if (saveProfileChangesBtn) {
        saveProfileChangesBtn.disabled = (currentUser.loginMethod === 'google') || isEmailUserUnverified || (profileNameInput && profileNameInput.value.trim() === currentUser.name);
    }
    if (avatarUploadInput) avatarUploadInput.disabled = isEmailUserUnverified;
    if (uploadAvatarNowBtn) uploadAvatarNowBtn.style.display = 'none';

    if (changePasswordForm) changePasswordForm.style.display = currentUser.loginMethod === 'google' ? 'none' : 'block';
    if (changePasswordBtn) changePasswordBtn.disabled = isEmailUserUnverified;

    if (profileDisplayAvatar) profileDisplayAvatar.src = currentUser.avatarUrl || `https://placehold.co/120x120/6a0dad/FFFFFF?text=${encodeURIComponent(currentUser.name.charAt(0).toUpperCase())}`;
    
    if (submitButton) submitButton.disabled = false;
}

// Updates UI elements after a user logs out
function updateUIAfterLogout() {
    const navLoginIconTrigger = document.getElementById('login-icon-trigger');
    const userProfileTrigger = document.getElementById('user-profile-trigger');
    const userProfileAvatarImg = document.getElementById('user-profile-avatar');
    const userProfileNameSpan = document.getElementById('user-profile-name');
    const userMenu = document.getElementById('userMenu');
    const userProfileModal = document.getElementById('userProfileModal');
    const emailVerificationPrompt = document.getElementById('email-verification-prompt');
    const menuVerifyEmailOption = document.getElementById('menu-verify-email-option');
    const nameInputInFeedbackForm = document.getElementById('name');
    const feedbackVerificationPrompt = document.getElementById('feedback-verification-prompt');
    const feedbackFormContainer = document.getElementById('feedback-form-container');


    if (navLoginIconTrigger) navLoginIconTrigger.classList.remove('hidden');
    if (userProfileTrigger) {
        userProfileTrigger.classList.add('hidden');
        if (userProfileAvatarImg) userProfileAvatarImg.src = '[https://i.ibb.co/VpjRLsv/sample-user.png](https://i.ibb.co/VpjRLsv/sample-user.png)';
        if (userProfileNameSpan) userProfileNameSpan.textContent = 'User Name';
    }

    if (userMenu) userMenu.classList.remove('active');
    if (userProfileModal) userProfileModal.classList.remove('active');

    if (emailVerificationPrompt) emailVerificationPrompt.style.display = 'none';
    if (feedbackVerificationPrompt) feedbackVerificationPrompt.style.display = 'none';
    if (menuVerifyEmailOption) menuVerifyEmailOption.style.display = 'none';

    if (nameInputInFeedbackForm) {
        const storedGuestName = localStorage.getItem(GUEST_NAME_KEY);
        nameInputInFeedbackForm.value = storedGuestName || '';
        nameInputInFeedbackForm.disabled = false;
        nameInputInFeedbackForm.placeholder = ' ';
        nameInputInFeedbackForm.dispatchEvent(new Event('input'));
    }
    if (feedbackFormContainer) feedbackFormContainer.style.display = 'block';


    const saveProfileChangesBtn = document.getElementById('save-profile-changes-btn');
    const changePasswordBtn = document.getElementById('change-password-btn');
    const uploadAvatarNowBtn = document.getElementById('upload-avatar-now-btn');
    const avatarUploadInput = document.getElementById('avatar-upload-input');
    const submitButton = document.getElementById('submit-feedback');
    
    [saveProfileChangesBtn, changePasswordBtn, uploadAvatarNowBtn, avatarUploadInput].forEach(el => {
        if (el) el.disabled = true;
    });

    if (submitButton) submitButton.disabled = false;

    const profileDisplayAvatar = document.getElementById('profile-display-avatar');
    if (profileDisplayAvatar) profileDisplayAvatar.src = '[https://placehold.co/120x120/6a0dad/FFFFFF?text=U](https://placehold.co/120x120/6a0dad/FFFFFF?text=U)';
}

// Resets feedback form
function resetFeedbackForm() {
    const nameInputInFeedbackForm = document.getElementById('name');
    const feedbackTextarea = document.getElementById('feedback');
    const ratingInput = document.getElementById('rating');
    const submitButton = document.getElementById('submit-feedback');
    const feedbackVerificationPrompt = document.getElementById('feedback-verification-prompt');
    const starsElements = document.querySelectorAll('.star');

    if (currentUser) {
        if (nameInputInFeedbackForm) {
            nameInputInFeedbackForm.value = currentUser.name;
            nameInputInFeedbackForm.disabled = true;
            nameInputInFeedbackForm.dispatchEvent(new Event('input'));
        }
    } else {
        if (nameInputInFeedbackForm) {
            const storedGuestName = localStorage.getItem(GUEST_NAME_KEY);
            nameInputInFeedbackForm.value = storedGuestName || '';
            nameInputInFeedbackForm.disabled = false;
            nameInputInFeedbackForm.placeholder = ' ';
            nameInputInFeedbackForm.dispatchEvent(new Event('input'));
        }
    }
    if (feedbackTextarea) {
        feedbackTextarea.value = '';
        feedbackTextarea.dispatchEvent(new Event('input'));
    }
    if (ratingInput) ratingInput.value = '0';
    currentSelectedRating = 0;
    updateStarVisuals(0);
    if (submitButton) {
        submitButton.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Feedback';
        submitButton.disabled = false;
    }
    isEditing = false;
    currentEditFeedbackId = null;
    if (feedbackVerificationPrompt && (!currentUser || (currentUser && currentUser.isVerified))) {
        feedbackVerificationPrompt.style.display = 'none';
    }
}


// Request and display email verification options
async function requestAndShowVerificationEmail() {
    if (!currentUser || currentUser.isVerified) return;

    try {
        const data = await apiRequest(API_REQUEST_VERIFICATION_URL, 'POST', {});
        showStylishPopup({
            iconType: 'success',
            title: 'Verification Link Sent!',
            message: `${data.message} Please check your inbox (and spam folder).`,
            buttons: [{text: 'OK', action: closeStylishPopup}]
        });
    } catch (error) {
        // Error handling is in apiRequest, so no specific popup here
    }
}

async function resendVerification(){
  let email = localStorage.getItem("nobita_last_email") || prompt("Enter your email:");
  if (!email) {
    showStylishPopup({
      iconType: 'error',
      title: 'Email Required',
      message: 'Please enter your email address to resend the verification link.',
      buttons: [{text:'OK', action:closeStylishPopup}]
    });
    return;
  }

  try {
    const response = await fetch("[https://nobita-feedback-app-online.onrender.com/api/auth/resend-verification](https://nobita-feedback-app-online.onrender.com/api/auth/resend-verification)", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    const result = await response.json();
    if (response.ok) {
      showStylishPopup({
        iconType: 'success',
        title: 'Verification Mail Sent!',
        message: 'Check your inbox/spam folder for the verification link.',
        buttons: [{text:'OK', action:closeStylishPopup}]
      });
    } else {
      showStylishPopup({
        iconType: 'error',
        title: 'Failed to Send!',
        message: result.message || 'Could not send verification email. Please try again later.',
        buttons: [{text:'OK', action:closeStylishPopup}]
      });
    }
  } catch (e) {
    showStylishPopup({
      iconType: 'error',
      title: 'Network Error!',
      message: 'Failed to connect to server. Check your internet and try again.',
      buttons: [{text:'OK', action:closeStylishPopup}]
    });
  }
}
window.resendVerification = resendVerification;

// --- NEW FORGOT PASSWORD POPUP LOGIC ---
const NEW_API_REQUEST_RESET_URL = `${BASE_API_URL}/api/auth/request-password-reset`;

function closeForgotPasswordNewPopup() {
    const forgotPasswordNewOverlay = document.getElementById('forgotPasswordNewOverlay');
    if (forgotPasswordNewOverlay) {
        forgotPasswordNewOverlay.classList.remove('active');
        const popupContentDiv = document.getElementById('forgotPasswordNewPopupContent');
        if (popupContentDiv) popupContentDiv.innerHTML = '';
    }
}

function renderForgotForm(emailValue = '', errorText = '') {
    const popupContentDiv = document.getElementById('forgotPasswordNewPopupContent');
    if (!popupContentDiv) return;

    popupContentDiv.innerHTML = `
        <button class="close" onclick="closeForgotPasswordNewPopup()">&times;</button>
        <div class="icon">🔑</div>
        <h2>Forgot Password?</h2>
        <p>Enter your registered email address below.<br>We’ll send you a reset link!</p>
        <div class="input-wrapper">
            <span class="mail-icon">
                <svg width="21" height="21" viewBox="0 0 20 20" fill="none">
                    <rect x="3" y="5" width="14" height="10" rx="2.5" stroke="#7b2ff2" stroke-width="1.6"/>
                    <path d="M4.5 6.5L10 11L15.5 6.5" stroke="#7b2ff2" stroke-width="1.6" stroke-linecap="round"/>
                </svg>
            </span>
            <input type="email" placeholder="Email Address" id="forgotPasswordEmailInput" autocomplete="off" value="${emailValue.replace(/\"/g,'&quot;')}" />
        </div>
        <div class="error-message" id="forgotPasswordErrorBox" style="display:${errorText?'block':'none'};">${errorText||''}</div>
        <button class="submit-btn" id="sendResetLinkBtn" onclick="submitForgotPasswordRequest()">Send Reset Link</button>
    `;
    setTimeout(() => document.getElementById('forgotPasswordEmailInput')?.focus(), 40);
}

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
        const data = await apiRequest(NEW_API_REQUEST_RESET_URL, 'POST', { email }, false, null, "Sending...");
        renderForgotSuccess();
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

function renderForgotSuccess() {
    const popupContentDiv = document.getElementById('forgotPasswordNewPopupContent');
    if (!popupContentDiv) return;

    popupContentDiv.innerHTML = `
        <button class="close" onclick="closeForgotPasswordNewPopup()">&times;</button>
        <div class="success-bg"></div>
        <div class="success-box">
            <span class="success-icon">
                <svg width="44" height="44" viewBox="0 0 52 52" fill="none">
                    <circle cx="26" cy="26" r="25" stroke="white" stroke-width="3" fill="none"/>
                    <path d="M15 27l8 8 14-16" stroke="white" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </span>
            <div class="success-msg">Reset Link Sent</div>
            <div class="success-sub">We’ve sent a password reset link to your email.<br>Please check your inbox & spam.</div>
            <button class="okay-btn" onclick="closeForgotPasswordNewPopup()">OKAY</button>
        </div>
    `;
}

// --- Feedback Specific Functions ---
function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

const starsElements = document.querySelectorAll('.star');
const ratingInput = document.getElementById('rating');

starsElements.forEach(star => {
    star.addEventListener('click', () => {
        const value = parseInt(star.dataset.value);
        currentSelectedRating = value;
        if (ratingInput) ratingInput.value = value;
        updateStarVisuals(value);
    });
    star.addEventListener('mouseover', () => {
        const value = parseInt(star.dataset.value);
        updateStarVisuals(value, true);
    });
    star.addEventListener('mouseout', () => {
        updateStarVisuals(currentSelectedRating);
    });
});

function updateStarVisuals(val, isHover = false) {
    starsElements.forEach(s => {
        const sVal = parseInt(s.dataset.value);
        if (isHover) {
            if (sVal <= val) s.classList.add('highlighted');
            else s.classList.remove('highlighted');
            s.classList.remove('selected');
        } else {
            if (sVal <= val) s.classList.add('selected');
            else s.classList.remove('selected');
            s.classList.remove('highlighted');
        }
    });
}

function renderFeedbackData(feedbacksArray) {
    const feedbackListContainer = document.getElementById('feedback-list-container');
    const averageRatingDisplayEl = document.getElementById('average-rating-display');

    if (!feedbackListContainer) return;

    const childrenToRemove = Array.from(feedbackListContainer.children).filter(child => child.id !== 'average-rating-display' && child.tagName.toLowerCase() !== 'h2');
    childrenToRemove.forEach(child => child.remove());

    if (!feedbackListContainer.querySelector('#average-rating-display') && averageRatingDisplayEl) {
        feedbackListContainer.prepend(averageRatingDisplayEl);
    }

    let h2Title = feedbackListContainer.querySelector('h2.section-title');
    if (!h2Title) {
        h2Title = document.createElement('h2');
        h2Title.textContent = 'Recent Feedbacks';
        h2Title.classList.add('section-title');
        const firstFbOrAvgRating = feedbackListContainer.querySelector('.feedback-item') || (averageRatingDisplayEl ? averageRatingDisplayEl.nextSibling : null);
        feedbackListContainer.insertBefore(h2Title, firstFbOrAvgRating || null);
    }

    const existingMsgP = feedbackListContainer.querySelector('p.no-feedback-message');
    if (existingMsgP) existingMsgP.remove();

    if (feedbacksArray.length === 0) {
        const msgP = document.createElement('p');
        msgP.textContent = 'No feedbacks yet. Be the first to share your thoughts!';
        msgP.className = 'no-feedback-message';
        msgP.style.cssText = 'text-align:center; padding:20px; color:rgba(255,255,255,0.7); grid-column: 1 / -1;';
        feedbackListContainer.appendChild(msgP);
        updateAverageRating(0, 0);
    } else {
        const totalRatings = feedbacksArray.reduce((sum, fb) => sum + (parseInt(fb.rating) || 0), 0);
        updateAverageRating(totalRatings / feedbacksArray.length, feedbacksArray.length);
        feedbacksArray.forEach(addFeedbackToDOM);
    }
}

async function fetchFeedbacks() {
    const feedbackListContainer = document.getElementById('feedback-list-container');

    try {
        const cachedFeedbacksJSON = localStorage.getItem(FEEDBACKS_CACHE_KEY);
        if (cachedFeedbacksJSON) {
            const cachedFeedbacks = JSON.parse(cachedFeedbacksJSON);
            if (cachedFeedbacks && cachedFeedbacks.data && Array.isArray(cachedFeedbacks.data)) {
                renderFeedbackData(cachedFeedbacks.data);
            } else {
                localStorage.removeItem(FEEDBACKS_CACHE_KEY);
            }
        }
    } catch (e) {
        console.error("Error reading feedbacks from cache:", e);
        localStorage.removeItem(FEEDBACKS_CACHE_KEY);
    }

    try {
        const freshFeedbacksArray = await apiRequest(API_FETCH_FEEDBACKS_URL, 'GET');
        const freshFeedbacksJSON = JSON.stringify({ data: freshFeedbacksArray, timestamp: Date.now() });
        const cachedFeedbacksJSON = localStorage.getItem(FEEDBACKS_CACHE_KEY);

        let needsServerRender = true;
        if (cachedFeedbacksJSON) {
            try {
                const cachedData = JSON.parse(cachedFeedbacksJSON);
                if (JSON.stringify(cachedData.data) === JSON.stringify(freshFeedbacksArray)) {
                    needsServerRender = false;
                }
            } catch (e) { /* Error parsing cached JSON, force re-render */ }
        }

        if (needsServerRender) {
            renderFeedbackData(freshFeedbacksArray);
        }
        localStorage.setItem(FEEDBACKS_CACHE_KEY, freshFeedbacksJSON);
    } catch (err) {
        if (!localStorage.getItem(FEEDBACKS_CACHE_KEY)) {
            renderFeedbackData([]);
        }
    }
}

function updateAverageRating(avg, count) {
    const averageRatingDisplayEl = document.getElementById('average-rating-display');
    if(!averageRatingDisplayEl) return;

    const avgNum = parseFloat(avg);
    let starsHtml = '☆☆☆☆☆';

    if (!isNaN(avgNum) && avgNum > 0) {
        const full = Math.floor(avgNum);
        const halfVal = avgNum % 1;
        let halfChar = '';
        if (halfVal >= 0.25 && halfVal < 0.75) halfChar = '◐';
        else if (halfVal >= 0.75) halfChar = '★';
        starsHtml = '★'.repeat(full) + halfChar + '☆'.repeat(Math.max(0, 5 - full - (halfChar ? 1 : 0)));
    }

    averageRatingDisplayEl.innerHTML = `
        <div class="average-rating-container animate-in">
            <h3>Overall Average Rating</h3>
            <div class="average-number">${isNaN(avgNum) ? '0.0' : avgNum.toFixed(1)}</div>
            <div class="average-stars">${starsHtml}</div>
            <div class="total-feedbacks-count">Based on ${count} Feedback${count === 1 ? '' : 's'} <span class="badge-total">+${count}</span></div>
        </div>
    `;
}

function addFeedbackToDOM(fbData) {
    const feedbackListContainer = document.getElementById('feedback-list-container');
    if (!feedbackListContainer) return;

    const item = document.createElement('div');
    item.className = `feedback-item ${fbData.isPinned ? 'pinned' : ''}`;
    item.dataset.feedbackId = fbData._id;

    const avatarImg = document.createElement('img');
    avatarImg.className = 'avatar-img';
    const charForAvatar = (fbData.name?.[0]?.toUpperCase() || 'G');
    let avatarSource = fbData.avatarUrl;
    if (!avatarSource && fbData.guestId) {
        avatarSource = `https://api.dicebear.com/8.x/adventurer/svg?seed=${encodeURIComponent((fbData.name || 'guest').toLowerCase() + fbData.guestId)}&flip=true&radius=50&scale=90`;
    } else if (!avatarSource) {
        avatarSource = `https://placehold.co/50x50/6a0dad/FFFFFF?text=${encodeURIComponent(charForAvatar)}`;
    }
    avatarImg.src = avatarSource;
    avatarImg.alt = fbData.name || 'User Avatar';
    avatarImg.onerror = function() { this.src = `https://placehold.co/50x50/6a0dad/FFFFFF?text=${encodeURIComponent(charForAvatar)}`; };

    const detailsDiv = document.createElement('div');
    detailsDiv.className = 'feedback-details';
    const strongName = document.createElement('strong');
    let nameDisplay = fbData.name || 'Guest';
    let typeTag = '', verTag = '';

    if (fbData.userId && typeof fbData.userId === 'object') {
        nameDisplay = fbData.userId.name || fbData.name;
        if (fbData.userId.isVerified) avatarImg.classList.add('verified-user');
        if (fbData.userId.loginMethod === 'google') typeTag = `<span class="user-type-indicator google-user-indicator" title="Logged in with Google">G</span>`;
        if (fbData.userId.isVerified) {
            verTag = `<span class="verified-tag-feedback" title="Email Verified"><i class="fas fa-check-circle"></i></span>`;
        } else if (fbData.userId.loginMethod === 'email') {
            verTag = `<span class="unverified-tag-feedback" title="Email Not Verified">✖ Unverified</span>`;
        }
    } else {
        nameDisplay = fbData.name || 'Guest';
        verTag = `<span class="unverified-tag-feedback" title="Guest Submission${fbData.guestId ? ` (ID: ${fbData.guestId.substring(0,6)}...)` : ''}">Guest</span>`;
    }

    strongName.innerHTML = `${nameDisplay} ${typeTag} ${verTag}`;

    if (fbData.rating) strongName.classList.add(`rating-${fbData.rating}`);
    if (fbData.isEdited && fbData.userId) {
        const edited = document.createElement('span');
        edited.className = 'edited-tag';
        edited.textContent = 'Edited';
        strongName.appendChild(edited);
    }

    const starsDiv = document.createElement('div');
    starsDiv.className = 'feedback-stars';
    starsDiv.textContent = '★'.repeat(fbData.rating) + '☆'.repeat(5 - fbData.rating);
    const pFb = document.createElement('p');
    pFb.textContent = fbData.feedback;
    const tsDiv = document.createElement('div');
    tsDiv.className = 'feedback-timestamp';
    try {
        tsDiv.innerHTML = `<i class="far fa-clock"></i> Posted: ${new Date(fbData.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}`;
    } catch (e) {
        tsDiv.innerHTML = `<i class="far fa-clock"></i> Posted: ${new Date(fbData.timestamp).toLocaleString('en-US')}`;
    }
    detailsDiv.append(strongName, starsDiv, pFb, tsDiv);
    
    item.append(avatarImg, detailsDiv);

    const isFeedbackOwner = currentUser && fbData.userId && typeof fbData.userId === 'object' && fbData.userId._id === currentUser.userId;
    const canEdit = isFeedbackOwner && (currentUser.loginMethod === 'google' || (currentUser.loginMethod === 'email' && currentUser.isVerified));
    
    if (fbData.userId && typeof fbData.userId === 'object') {
        const editBtn = document.createElement('button');
        editBtn.className = 'edit-feedback-btn';
        editBtn.innerHTML = '<i class="fas fa-pencil-alt"></i>';
        editBtn.title = 'Edit your feedback';
        editBtn.disabled = !canEdit;

        if (isFeedbackOwner && currentUser.loginMethod === 'email' && !currentUser.isVerified) {
            editBtn.title = "Verify your email to edit this feedback.";
        }
        
        editBtn.onclick = e => {
            e.stopPropagation();
            if (!isFeedbackOwner) {
                return showStylishPopup({ iconType: 'error', title: 'Permission Denied', message: 'You can only edit your own feedback.', buttons: [{ text: 'OK', action: closeStylishPopup }] });
            }
            if (currentUser.loginMethod === 'email' && !currentUser.isVerified) {
                return showStylishPopup({ iconType: 'warning', title: 'Email Verification Required', message: 'Please verify your email to *edit* your feedback. Resend verification email?', buttons: [{ text: 'Send Email', addSpinnerOnClick: true, spinnerText: 'Sending...', action: async () => { await requestAndShowVerificationEmail(); } }, { text: 'Later', action: closeStylishPopup }] });
            }
            if (document.getElementById('name')) { document.getElementById('name').value = fbData.userId.name || fbData.name; document.getElementById('name').disabled = true; document.getElementById('name').dispatchEvent(new Event('input')); }
            if (document.getElementById('feedback')) { document.getElementById('feedback').value = fbData.feedback; document.getElementById('feedback').dispatchEvent(new Event('input')); }
            currentSelectedRating = fbData.rating; if (document.getElementById('rating')) document.getElementById('rating').value = fbData.rating; updateStarVisuals(fbData.rating);
            if (document.getElementById('submit-feedback')) document.getElementById('submit-feedback').innerHTML = '<i class="fas fa-paper-plane"></i> Update Feedback';
            isEditing = true; currentEditFeedbackId = fbData._id;
            if (document.getElementById('feedback-form-container')) document.getElementById('feedback-form-container').scrollIntoView({ behavior: 'smooth', block: 'start' });
            showStylishPopup({ iconType: 'info', title: 'Editing Feedback', message: 'The form has been pre-filled. Make changes and click "Update Feedback".', buttons: [{ text: 'Got it!', action: closeStylishPopup }] });
        };
        item.appendChild(editBtn);
    }
    
    if (fbData.replies?.length > 0) {
        const reply = fbData.replies[fbData.replies.length - 1];
        if (reply?.text) {
            const replyDiv = document.createElement('div');
            replyDiv.className = 'admin-reply';
            const adminAva = document.createElement('img');
            adminAva.className = 'admin-reply-avatar';
            adminAva.src = 'https://i.ibb.co/FsSs4SG/creator-avatar.png'; // Image of Admin Creator
            adminAva.alt = 'Admin';
            const replyContent = document.createElement('div');
            replyContent.className = 'admin-reply-content';
            let replyTs = '';
            try { replyTs = `(${new Date(reply.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short' })})`; } catch (e) { replyTs = `(${new Date(reply.timestamp).toLocaleString('en-US')})`; }
            replyContent.innerHTML = `<strong>(${(reply.adminName || 'Admin')}):</strong> ${reply.text} <span class="reply-timestamp">${replyTs}</span>`;
            replyDiv.append(adminAva, replyContent);
            detailsDiv.appendChild(replyDiv);
        }
    }

    if (fbData.isPinned) {
        const pinnedBadgeHTML = `
        <div class="pinned-badge">
            <span class="pin-svg">
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none" xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)">
                <path d="M14 4H16V6H14V4ZM14 2H6V4H14V2ZM12 18V10H8V18H6V8H4V6H6V4C6 2.9 6.9 2 8 2H12C13.1 2 14 2.9 14 4V6H16V8H14V18H12Z" fill="#332400"/>
            </svg>
            </span>
            Pinned
        </div>`;
        item.insertAdjacentHTML('afterbegin', pinnedBadgeHTML);
    }
    
    feedbackListContainer.appendChild(item);
}


// --- EVENT LISTENERS AND INITIALIZATIONS ---
let googleLoginPopupTimeout;

document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOM fully loaded - NOBITA (Final Guest + Unverified Submit)");
    const mainTitle = document.getElementById('main-title');
    const feedbackFormContainer = document.getElementById('feedback-form-container');
    const feedbackListContainer = document.getElementById('feedback-list-container');
    const nameInputInFeedbackForm = document.getElementById('name');
    const feedbackTextarea = document.getElementById('feedback');
    const submitButton = document.getElementById('submit-feedback');
    const enhanceFeedbackBtn = document.getElementById('enhance-feedback-btn');
    const sendVerificationEmailBtnForm = document.getElementById('send-verification-email-btn-form');


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
            openLoginModal();
            if (userMenu) userMenu.classList.remove('active');
            closeForgotPasswordNewPopup();
        });
    }

    if (userProfileTrigger) {
        userProfileTrigger.addEventListener('click', e => {
            e.stopPropagation();
            if (userMenu) userMenu.classList.toggle('active');
            closeAuthModal();
            closeForgotPasswordNewPopup();
        });
    }

    // Close auth modal when clicking outside
    const authModalOverlay = document.getElementById('auth-modal-overlay');
    if (authModalOverlay) {
        authModalOverlay.addEventListener('click', e => {
            if (e.target === authModalOverlay) {
                closeAuthModal();
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
        closeStylishPopupBtn.addEventListener('click', closeStylishPopup);
    }
    // Close Stylish Popup when clicking overlay
    if (stylishPopupOverlay) {
        stylishPopupOverlay.addEventListener('click', e => {
            if (e.target === stylishPopupOverlay) {
                closeStylishPopup();
            }
        });
    }

    // Close NEW Forgot Password Popup when clicking overlay or ESC key
    const forgotPasswordNewOverlay = document.getElementById('forgotPasswordNewOverlay');
    if (forgotPasswordNewOverlay) {
        forgotPasswordNewOverlay.addEventListener('click', e => {
            if(e.target === forgotPasswordNewOverlay) closeForgotPasswordNewPopup();
        });
    }
    document.addEventListener('keydown', function(ev){
        if(ev.key==='Escape' && forgotPasswordNewOverlay && forgotPasswordNewOverlay.classList.contains('active')) {
            closeForgotPasswordNewPopup();
        }
    });

    // --- AUTH MODAL FORM SUBMISSIONS ---
    const busiconEmailLoginForm = document.getElementById('email-login-form');
    const busiconModalLoginEmailInput = document.getElementById('modal-login-email');
    const busiconModalLoginPasswordInput = document.getElementById('modal-login-password');
    const busiconForgotPasswordLink = document.getElementById('busicon-forgot-password-link');
    const busiconCreateAccountLink = document.getElementById('busicon-create-account-link');
    const busiconGoogleLoginBtn = document.getElementById('busicon-google-login-btn');
    const busiconEmailSignupForm = document.getElementById('email-signup-form');
    const busiconModalSignupNameInput = document.getElementById('modal-signup-name');
    const busiconModalSignupEmailInput = document.getElementById('modal-signup-email');
    const busiconModalSignupPasswordInput = document.getElementById('modal-signup-password');
    const busiconModalSignupConfirmPasswordInput = document.getElementById('modal-signup-confirm-password');
    const busiconAlreadyAccountLink = document.getElementById('busicon-already-account-link');
    const busiconGoogleSignupBtn = document.getElementById('busicon-google-signup-btn');


    // Event listeners for opening/closing specific modals
    const closeBusiconLoginModalBtn = document.getElementById('close-busicon-login-modal-btn');
    const closeBusiconSignupModalBtn = document.getElementById('close-busicon-signup-modal-btn');
    if (closeBusiconLoginModalBtn) closeBusiconLoginModalBtn.addEventListener('click', closeAuthModal);
    if (closeBusiconSignupModalBtn) closeBusiconSignupModalBtn.addEventListener('click', closeAuthModal);

    // Links to switch between login/signup forms
    if (busiconCreateAccountLink) busiconCreateAccountLink.addEventListener('click', e => { e.preventDefault(); openSignupModal(); });
    if (busiconAlreadyAccountLink) busiconAlreadyAccountLink.addEventListener('click', e => { e.preventDefault(); openLoginModal(); });

    // Link for Forgot Password (triggers the NEW forgot password popup directly)
    if (busiconForgotPasswordLink) {
        busiconForgotPasswordLink.addEventListener('click', e => {
            e.preventDefault();
            openForgotModal();
        });
    }

    // Login Form Submission
    if (busiconEmailLoginForm) {
        busiconEmailLoginForm.addEventListener('submit', async function(e){
            e.preventDefault();
            const email = busiconModalLoginEmailInput.value.trim();
            const password = busiconModalLoginPasswordInput.value;

            if (!email || !password) {
                showStylishPopup({ iconType: 'error', title: 'Empty Fields!', message: 'Please enter both email and password.', buttons: [{text:'OK', action: closeStylishPopup}] });
                return;
            }

            try {
                const loginButton = busiconEmailLoginForm.querySelector('button[type="submit"]');
                const data = await apiRequest(API_LOGIN_URL, 'POST', { email, password }, false, loginButton, "Logging in...");
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
                showStylishPopup({ iconType: 'error', title: 'Empty Fields!', message: 'Please fill in all fields.', buttons: [{text:'OK', action: closeStylishPopup}] });
                return;
            }
            if (password !== confirmPassword) {
                showStylishPopup({ iconType: 'error', title: 'Password Mismatch!', message: 'Passwords do not match.', buttons: [{text:'OK', action: closeStylishPopup}] });
                return;
            }
            if (password.length < 6) {
                showStylishPopup({ iconType: 'error', title: 'Weak Password!', message: 'Password must be at least 6 characters long.', buttons: [{text:'OK', action: closeStylishPopup}] });
                return;
            }

            try {
                const signupButton = busiconEmailSignupForm.querySelector('button[type="submit"]');
                await processSignup(name, email, password, signupButton);
            } catch (err) {
                // Errors handled by apiRequest's showStylishPopup
            }
        });
    }

    // Google Sign-In/Signup Functionality
    const triggerGoogleSignIn = (isSignupContext = false) => {
        closeAuthModal();
        if (userProfileModal) userProfileModal.classList.remove('active');
        closeForgotPasswordNewPopup();

        const guestId = localStorage.getItem(GUEST_ID_KEY);
        const guestName = localStorage.getItem(GUEST_NAME_KEY);

        const showGooglePrompt = (linkGuestIdForGoogle = null) => {
            showStylishPopup({
                iconType: 'google',
                icon: 'fa-google',
                title: 'Connecting with Google...',
                message: 'The Google sign-in prompt should appear shortly. <br><br>If it doesn\'t, please ensure popups are not blocked by your browser.',
                buttons: [{ text: 'Cancel', action: () => {
                    clearTimeout(googleLoginPopupTimeout);
                    closeStylishPopup();
                    console.log("Google Sign-In attempt cancelled by user.");
                    sessionStorage.removeItem('temp_linkGuestId');
                }}]
            });

            googleLoginPopupTimeout = setTimeout(() => {
                console.warn('Google Sign-In prompt timeout. It might not have appeared or was dismissed outside our callback.');
                if (stylishPopupOverlay && stylishPopupOverlay.classList.contains('active')) {
                    closeStylishPopup();
                    showStylishPopup({
                        iconType: 'warning',
                        title: 'Google Sign-In Issue',
                        message: 'The Google Sign-In prompt could not be displayed. This might be due to browser settings, ad blockers, or trying too frequently. Please try again later or use email login.',
                        buttons: [{text: 'OK', action: closeStylishPopup}]
                    });
                }
            }, 7000);

            if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
                sessionStorage.setItem('temp_linkGuestId', linkGuestIdForGoogle || '');
                google.accounts.id.prompt(notification => {
                    clearTimeout(googleLoginPopupTimeout);
                    if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                        console.warn('Google Sign-In prompt not displayed or skipped.', notification.getNotDisplayedReason(), notification.getSkippedReason());
                        closeStylishPopup();
                        showStylishPopup({
                            iconType: 'warning',
                            title: 'Google Sign-In Issue',
                            message: 'The Google Sign-In prompt could not be displayed. This might be due to browser settings, ad blockers, or trying too frequently. Please try again later or use email login.',
                            buttons: [{text: 'OK', action: closeStylishPopup}]
                        });
                        sessionStorage.removeItem('temp_linkGuestId');
                    } else if (notification.isDismissedMoment()) {
                        console.log("Google Sign-In prompt dismissed by user.");
                        closeStylishPopup();
                        sessionStorage.removeItem('temp_linkGuestId');
                    }
                });
            } else {
                clearTimeout(googleLoginPopupTimeout);
                closeStylishPopup();
                showStylishPopup({
                    iconType: 'error',
                    title: 'Google Sign-In Error',
                    message: 'Google Sign-In is not available at the moment. Please try again later or use email login.',
                    buttons: [{text: 'OK', action: closeStylishPopup}]
                });
            }
        };

        if (guestId && guestName && isSignupContext) {
            showStylishPopup({
                iconType: 'confirm',
                title: 'Link Guest Activity?',
                message: `You have previous activity as Guest: "${guestName}". Do you want to link this activity to your Google account?`,
                buttons: [
                    { text: 'Yes, Link', action: () => { closeStylishPopup(); showGooglePrompt(guestId); } },
                    { text: 'No, Fresh Account', action: () => {
                        localStorage.removeItem(GUEST_ID_KEY);
                        localStorage.removeItem(GUEST_NAME_KEY);
                        closeStylishPopup();
                        showGooglePrompt(null);
                    } }
                ]
            });
        } else {
            showGooglePrompt(null);
        }
    };

    if (busiconGoogleLoginBtn) busiconGoogleLoginBtn.onclick = () => triggerGoogleSignIn(false);
    if (busiconGoogleSignupBtn) busiconGoogleSignupBtn.onclick = () => triggerGoogleSignIn(true);

    window.handleGoogleCredentialResponse = async function(response) {
        closeStylishPopup();
        closeForgotPasswordNewPopup();
        showFullScreenLoader();

        const linkGuestId = sessionStorage.getItem('temp_linkGuestId');
        sessionStorage.removeItem('temp_linkGuestId');

        const payload = { token: response.credential };
        if (linkGuestId) {
            payload.linkGuestId = linkGuestId;
        }

        try {
            const data = await apiRequest(API_GOOGLE_SIGNIN_URL, 'POST', payload, false, null, "Signing in with Google...");
            handleAuthResponse(data, "google", !!linkGuestId);
        } catch (error) {
            // Error handling is already in apiRequest, so no specific popup here
        } finally {
            hideFullScreenLoader();
        }
    };
    
    async function processSignup(name, email, password, signupButton) {
        const guestId = localStorage.getItem(GUEST_ID_KEY);
        const guestName = localStorage.getItem(GUEST_NAME_KEY);

        if (guestId && guestName) {
            return new Promise(resolveOuter => {
                showStylishPopup({
                    iconType: 'confirm',
                    title: 'Link Guest Activity?',
                    message: `You have previous activity as Guest: "${guestName}". Do you want to link this activity to your new account?`,
                    buttons: [
                        { text: 'Yes, Link', action: async () => {
                            closeStylishPopup();
                            resolveOuter(guestId);
                        } },
                        { text: 'No, Fresh Account', action: () => {
                            localStorage.removeItem(GUEST_ID_KEY);
                            localStorage.removeItem(GUEST_NAME_KEY);
                            closeStylishPopup();
                            resolveOuter(null);
                        } }
                    ]
                });
            }).then(async (idToLink) => {
                const payload = { name, email, password };
                if (idToLink) {
                    payload.linkGuestId = idToLink;
                }
                const data = await apiRequest(API_SIGNUP_URL, 'POST', payload, false, signupButton, "Signing up...");
                handleAuthResponse(data, "email", !!idToLink);
            });
        } else {
            const data = await apiRequest(API_SIGNUP_URL, 'POST', { name, email, password }, false, signupButton, "Signing up...");
            handleAuthResponse(data, "email", false);
        }
    }


    // --- PROFILE MENU ACTIONS ---
    const menuViewProfileLink = document.getElementById('menu-view-profile');
    const menuLogoutLink = document.getElementById('menu-logout');

 if (menuViewProfileLink) {
    menuViewProfileLink.addEventListener('click', async e => { // async lagana mat bhoolna
        e.preventDefault();
        if (userMenu) userMenu.classList.remove('active');
        if (userProfileModal) userProfileModal.classList.add('active');
        closeForgotPasswordNewPopup();

        showFullScreenLoader(); // Loading dikhane ke liye
        try {
            await checkUserVerificationStatus(); // Sabse pehle latest status fetch karo
            updateUIAfterLogin(); // Fir UI ko update karo
        } catch (error) {
            console.error("Error checking verification status on profile open:", error);
            updateUIAfterLogin(); // Error hone par bhi UI update karne ki koshish karo
        } finally {
            hideFullScreenLoader(); // Loading chhupane ke liye
        }
    });
}
    // Close profile modal when clicking overlay or specific close buttons
    if (userProfileModal) {
        userProfileModal.addEventListener('click', e => {
            if (e.target === userProfileModal) {
                userProfileModal.classList.remove('active');
            }
        });
        userProfileModal.querySelectorAll('[data-modal-close]').forEach(trigger => {
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
            if (userMenu) userMenu.classList.remove('active');
            closeForgotPasswordNewPopup();

            showStylishPopup({
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
                            localStorage.removeItem(USER_PROFILE_CACHE_KEY);
                            localStorage.removeItem(GUEST_ID_KEY);
                            localStorage.removeItem(GUEST_NAME_KEY);
                            localStorage.removeItem('nobita_last_email');
                            
                            currentUser = null;
                            if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
                                google.accounts.id.disableAutoSelect();
                            }
                            updateUIAfterLogout();
                            resetFeedbackForm();
                            closeStylishPopup();
                            showStylishPopup({
                                iconType: 'info',
                                title: 'Logged Out',
                                message: 'You have been successfully logged out.',
                                buttons: [{text:'OK', action: closeStylishPopup}]
                            });
                            await fetchFeedbacks();
                        }
                    },
                    { text: 'Cancel', action: closeStylishPopup }
                ]
            });
        });
    }

    // --- PROFILE MODAL FORMS ---

    // Send Verification Email button
    const sendVerificationEmailBtn = document.getElementById('send-verification-email-btn');
    if (sendVerificationEmailBtn) {
        sendVerificationEmailBtn.addEventListener('click', async () => {
            await requestAndShowVerificationEmail();
        });
    }
    if (sendVerificationEmailBtnForm) {
        sendVerificationEmailBtnForm.addEventListener('click', async () => {
            await requestAndShowVerificationEmail();
        });
    }

    // Profile Edit Form Submission
    const profileEditForm = document.getElementById('profile-edit-form');
    const profileNameInput = document.getElementById('profile-name');
    const profileEmailInput = document.getElementById('profile-email');
    const saveProfileChangesBtn = document.getElementById('save-profile-changes-btn');

    if (profileEditForm) {
        profileEditForm.addEventListener('input', () => {
            if (currentUser && currentUser.loginMethod === 'email' && currentUser.isVerified) {
                saveProfileChangesBtn.disabled = (profileNameInput.value.trim() === currentUser.name);
            } else {
                saveProfileChangesBtn.disabled = true;
            }
        });

        profileEditForm.addEventListener('submit', async e => {
            e.preventDefault();
            if (!currentUser) {
                return showStylishPopup({ iconType: 'error', title: 'Not Logged In', message: 'You must be logged in to save changes.', buttons: [{text:'OK', action: closeStylishPopup}] });
            }
            if (currentUser.loginMethod === 'email' && !currentUser.isVerified) {
                return showStylishPopup({
                    iconType: 'warning',
                    title: 'Email Verification Required',
                    message: 'Please verify your email to update your profile. Would you like to resend the verification email?',
                    buttons: [
                        { text: 'Send Verification Email', addSpinnerOnClick: true, spinnerText: 'Sending...', action: async () => await requestAndShowVerificationEmail() },
                        { text: 'Later', action: closeStylishPopup }
                    ]
                });
            }

            const newName = profileNameInput.value.trim();
            if (!newName) {
                return showStylishPopup({ iconType: 'error', title: 'Name Required', message: 'Name cannot be empty.', buttons: [{text:'OK', action: closeStylishPopup}] });
            }

            if (currentUser.loginMethod === 'google' && newName !== currentUser.name) {
                return showStylishPopup({ iconType: 'info', title: 'Google User', message: 'Your name is managed by your Google account and cannot be changed here.', buttons: [{text:'OK', action: closeStylishPopup}] });
            }

            if (newName === currentUser.name) {
                saveProfileChangesBtn.disabled = true;
                return;
            }

            try {
                const data = await apiRequest(API_UPDATE_PROFILE_URL, 'PUT', { name: newName }, false, saveProfileChangesBtn, "Saving...");
                if (data.token) localStorage.setItem('nobita_jwt', data.token);
                currentUser = { ...currentUser, ...data.user };
                localStorage.setItem(USER_PROFILE_CACHE_KEY, JSON.stringify(currentUser));

                const profileDisplayAvatar = document.getElementById('profile-display-avatar');
                if (profileDisplayAvatar) profileDisplayAvatar.src = currentUser.avatarUrl || `https://placehold.co/120x120/6a0dad/FFFFFF?text=${encodeURIComponent(currentUser.name.charAt(0).toUpperCase())}`;

                updateUIAfterLogin();
                showStylishPopup({ iconType: 'success', title: 'Profile Updated!', message: data.message || 'Your profile name has been updated successfully!', buttons: [{text:'OK', action: closeStylishPopup}] });
            } catch (error) {
                // Error handled by apiRequest
            }
        });
    }

    // Avatar Upload Logic
    const avatarUploadInput = document.getElementById('avatar-upload-input');
    const uploadAvatarNowBtn = document.getElementById('upload-avatar-now-btn');
    const profileDisplayAvatar = document.getElementById('profile-display-avatar');
    const uploadProgressBar = document.getElementById('upload-progress-bar');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');

    if (avatarUploadInput) {
        avatarUploadInput.addEventListener('change', () => {
            if (avatarUploadInput.files.length > 0) {
                if (currentUser && currentUser.loginMethod === 'email' && !currentUser.isVerified) {
                    showStylishPopup({
                        iconType: 'warning',
                        title: 'Email Verification Required',
                        message: 'Please verify your email to upload a new avatar. Would you like to resend the verification email?',
                        buttons: [
                            { text: 'Send Email', addSpinnerOnClick: true, spinnerText:'Sending...', action: async () => await requestAndShowVerificationEmail() },
                            { text: 'Later', action: closeStylishPopup }
                        ]
                    });
                    avatarUploadInput.value = '';
                    return;
                }

                const file = avatarUploadInput.files[0];
                const reader = new FileReader();
                reader.onload = e => {
                    if (profileDisplayAvatar) profileDisplayAvatar.src = e.target.result;
                };
                reader.readAsDataURL(file);

                if (uploadAvatarNowBtn) {
                    uploadAvatarNowBtn.style.display = 'block';
                    uploadAvatarNowBtn.disabled = false;
                    uploadAvatarNowBtn.innerHTML = '<i class="fas fa-upload"></i> Upload Avatar';
                }
                if (saveProfileChangesBtn) saveProfileChangesBtn.disabled = true;
            } else {
                if (uploadAvatarNowBtn) uploadAvatarNowBtn.style.display = 'none';
                if (currentUser) {
                    if (profileDisplayAvatar) profileDisplayAvatar.src = currentUser.avatarUrl || `https://placehold.co/120x120/6a0dad/FFFFFF?text=${encodeURIComponent(currentUser.name.charAt(0).toUpperCase())}`;
                    if (document.getElementById('profile-edit-form')) document.getElementById('profile-edit-form').dispatchEvent(new Event('input'));
                }
            }
        });
    }

    if (uploadAvatarNowBtn) {
        uploadAvatarNowBtn.addEventListener('click', async () => {
            if (!currentUser) {
                return showStylishPopup({ iconType: 'error', title: 'Not Logged In', message: 'You must be logged in to upload an avatar.', buttons: [{text:'OK', action: closeStylishPopup}] });
            }
            if (currentUser.loginMethod === 'email' && !currentUser.isVerified) {
                return showStylishPopup({ iconType: 'warning', title: 'Email Verification Required!', message: 'Please verify your email to upload an avatar.', buttons: [{text:'OK', action: closeStylishPopup}]});
            }

            if (avatarUploadInput.files.length === 0) {
                return showStylishPopup({ iconType: 'warning', title: 'No File Selected', message: 'Please select an image file to upload.', buttons: [{text:'OK', action: closeStylishPopup}] });
            }

            const file = avatarUploadInput.files[0];
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);


            const originalBtnHTML = uploadAvatarNowBtn.innerHTML;
            uploadAvatarNowBtn.disabled = true;
            uploadAvatarNowBtn.innerHTML = `<span class="nobi-spinner"></span> Uploading...`;
            if(uploadProgressBar) uploadProgressBar.style.display = 'block';
            if(progressFill) progressFill.style.width = '0%';
            if(progressText) progressText.textContent = '0%';

            try {
                const xhr = new XMLHttpRequest();
                xhr.open('POST', CLOUDINARY_UPLOAD_URL, true);

                xhr.upload.onprogress = e => {
                    if (e.lengthComputable) {
                        const percent = (e.loaded / e.total) * 100;
                        if(progressFill) progressFill.style.width = percent + '%';
                        if(progressText) progressText.textContent = Math.round(percent) + '%';
                    }
                };

                await new Promise((resolve, reject) => {
                    xhr.onload = async () => {
                        if (xhr.status >= 200 && xhr.status < 300) {
                            const cloudRes = JSON.parse(xhr.responseText);
                            const imgUrl = cloudRes.secure_url;

                            try {
                                const beRes = await apiRequest(API_UPDATE_PROFILE_URL, 'PUT', { avatarUrl: imgUrl }, false);
                                
                                if (beRes.token) localStorage.setItem('nobita_jwt', beRes.token);
                                currentUser = { ...currentUser, ...beRes.user };
                                localStorage.setItem(USER_PROFILE_CACHE_KEY, JSON.stringify(currentUser));

                                if (profileDisplayAvatar) profileDisplayAvatar.src = currentUser.avatarUrl;
                                updateUIAfterLogin();
                                await fetchFeedbacks();

                                avatarUploadInput.value = '';
                                if(uploadAvatarNowBtn) uploadAvatarNowBtn.style.display = 'none';

                                showStylishPopup({ iconType: 'success', title: 'Avatar Updated!', message: 'Your new avatar has been uploaded and saved.', buttons: [{text:'OK', action: closeStylishPopup}] });
                                resolve();
                            } catch (beError) {
                                reject(beError);
                            }
                        } else {
                            const errRes = JSON.parse(xhr.responseText);
                            reject(new Error(errRes.error.message || 'Cloudinary upload failed.'));
                        }
                    };

                    xhr.onerror = () => reject(new Error('Network error during avatar upload.'));
                    xhr.send(formData);
                });

            } catch (error) {
                showStylishPopup({ iconType: 'error', title: 'Upload Error!', message: error.message || 'Failed to upload avatar. Please try again.', buttons: [{text:'OK', action: closeStylishPopup}] });
            } finally {
                uploadAvatarNowBtn.disabled = false;
                uploadAvatarNowBtn.innerHTML = originalBtnHTML;
                if(uploadProgressBar) uploadProgressBar.style.display = 'none';
            }
        });
    }

    // Change Password Form Submission
    const changePasswordForm = document.getElementById('change-password-form');
    const currentPasswordInput = document.getElementById('current-password');
    const newPasswordProfileInput = document.getElementById('new-password-profile');
    const confirmNewPasswordProfileInput = document.getElementById('confirm-new-password-profile');
    const changePasswordBtn = document.getElementById('change-password-btn');

    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', async e => {
            e.preventDefault();
            if (!currentUser) {
                return showStylishPopup({ iconType: 'error', title: 'Not Logged In', message: 'You must be logged in to change your password.', buttons: [{text:'OK', action: closeStylishPopup}] });
            }
            if (currentUser.loginMethod === 'google') {
                return showStylishPopup({ iconType: 'info', title: 'Google User', message: 'Password changes for Google accounts are managed through Google.', buttons: [{text:'OK', action: closeStylishPopup}] });
            }
            if (currentUser.loginMethod === 'email' && !currentUser.isVerified) {
                return showStylishPopup({
                    iconType: 'warning',
                    title: 'Email Verification Required',
                    message: 'Please verify your email to change your password. Resend verification email?',
                    buttons: [
                        { text: 'Send Email', addSpinnerOnClick: true, spinnerText:'Sending...', action: async () => await requestAndShowVerificationEmail() },
                        { text: 'Later', action: closeStylishPopup }
                    ]
                });
            }

            const curPw = currentPasswordInput.value;
            const newPw = newPasswordProfileInput.value;
            const confNewPw = confirmNewPasswordProfileInput.value;

            if (!curPw || !newPw || !confNewPw) {
                return showStylishPopup({ iconType: 'error', title: 'Empty Fields!', message: 'All password fields are required.', buttons: [{text:'OK', action: closeStylishPopup}] });
            }
            if (newPw !== confNewPw) {
                return showStylishPopup({ iconType: 'error', title: 'Password Mismatch!', message: 'The new passwords do not match.', buttons: [{text:'OK', action: closeStylishPopup}] });
            }
            if (newPw.length < 6) {
                return showStylishPopup({ iconType: 'error', title: 'Weak Password!', message: 'Your new password must be at least 6 characters long.', buttons: [{text:'OK', action: closeStylishPopup}] });
            }
            if (curPw === newPw) {
                return showStylishPopup({ iconType: 'warning', title: 'Same Password!', message: 'Your new password cannot be the same as your current password.', buttons: [{text:'OK', action: closeStylishPopup}] });
            }

            try {
                const data = await apiRequest(API_CHANGE_PASSWORD_URL, 'POST', { currentPassword: curPw, newPassword: newPw }, false, changePasswordBtn, "Changing Password...");
                showStylishPopup({ iconType: 'success', title: 'Password Changed!', message: data.message || 'Your password has been successfully changed.', buttons: [{text:'OK', action: closeStylishPopup}] });
                [currentPasswordInput, newPasswordProfileInput, confirmNewPasswordProfileInput].forEach(inp => {
                    if (inp) {
                        inp.value = '';
                        inp.dispatchEvent(new Event('input'));
                    }
                });
            } catch (error) {
                // Error handled by apiRequest
            }
        });
    }

    if (enhanceFeedbackBtn) {
        enhanceFeedbackBtn.addEventListener('click', async () => {
            const originalFeedback = feedbackTextarea.value.trim();
            if (!originalFeedback) {
                return showStylishPopup({iconType: 'warning', title: 'Empty Feedback', message: 'Write some feedback first, then enhance it!', buttons: [{text:'OK', action: closeStylishPopup}]});
            }
            const originalBtnText = enhanceFeedbackBtn.innerHTML;
            enhanceFeedbackBtn.disabled = true;
            enhanceFeedbackBtn.innerHTML = `<span class="nobi-spinner"></span> Enhancing...`;
            try {
                const prompt = `Refine and enhance the following user feedback. Make it more constructive, clear, and polite, while maintaining the original sentiment. Keep it concise. Original Feedback: "${originalFeedback}"`;
                const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }] };
                const apiKey = "";
                const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
                const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                if (!response.ok) {
                    const errorData = await response.json();
                    console.error("Gemini API error:", errorData);
                    throw new Error(errorData.error?.message || "Failed to enhance feedback due to API error.");
                }
                const result = await response.json();
                let enhancedText = originalFeedback;
                if (result.candidates && result.candidates[0]?.content?.parts?.[0]?.text) {
                    enhancedText = result.candidates[0].content.parts[0].text;
                    showStylishPopup({iconType: 'success', title: 'Feedback Enhanced!', message: 'AI has helped refine your feedback.', buttons: [{text:'OK', action: closeStylishPopup}]});
                } else {
                    console.warn("Gemini API response issue or no text found:", result);
                    showStylishPopup({iconType: 'warning', title: 'Enhancement Issue', message: 'Could not get a refined version from AI. Using original feedback.', buttons: [{text:'OK', action: closeStylishPopup}]});
                }
                feedbackTextarea.value = enhancedText;
                feedbackTextarea.dispatchEvent(new Event('input'));
            } catch (error) {
                console.error("Error enhancing feedback:", error);
                showStylishPopup({iconType: 'error', title: 'Enhancement Failed', message: `An error occurred: ${error.message}. Please try again later.`, buttons: [{text:'OK', action: closeStylishPopup}]});
            } finally {
                enhanceFeedbackBtn.disabled = false;
                enhanceFeedbackBtn.innerHTML = originalBtnText;
            }
        });
    } else {
        console.error("Enhance feedback button not found!");
    }


    if (submitButton) submitButton.addEventListener('click', async () => {
        const feedbackContent = feedbackTextarea.value.trim();
        const ratingValue = ratingInput.value;
        let nameValue;
        let guestId = localStorage.getItem(GUEST_ID_KEY);
        let storedGuestName = localStorage.getItem(GUEST_NAME_KEY);

        if (currentUser) {
            nameValue = currentUser.name;
        } else {
            nameValue = nameInputInFeedbackForm.value.trim();
            if (!nameValue) {
                return showStylishPopup({ iconType: 'error', title: 'Name Required', message: 'Please enter your name to submit feedback as a guest.', buttons: [{text:'OK', action: closeStylishPopup}] });
            }
            if (!guestId || (guestId && storedGuestName !== nameValue)) {
                guestId = generateUUID();
                localStorage.setItem(GUEST_ID_KEY, guestId);
                localStorage.setItem(GUEST_NAME_KEY, nameValue);
                storedGuestName = nameValue;
                console.log(`New/Updated Guest Session: ID=${guestId}, Name=${nameValue}`);
            }
            if (nameInputInFeedbackForm.value !== nameValue) nameInputInFeedbackForm.value = nameValue;
        }

        if (!feedbackContent || ratingValue === '0') {
            return showStylishPopup({ iconType: 'error', title: 'Missing Information', message: 'Please provide your name (if guest), feedback, and select a rating.', buttons: [{text:'OK', action: closeStylishPopup}] });
        }

        let feedbackPayload = { name: nameValue, feedback: feedbackContent, rating: parseInt(ratingValue) };
        if (!currentUser && guestId) feedbackPayload.guestId = guestId;

        const isSubmissionByLoggedInUser = !!currentUser;
        const url = (isEditing && isSubmissionByLoggedInUser) ? `${API_FEEDBACK_URL}/${currentEditFeedbackId}` : API_FEEDBACK_URL;
        const method = (isEditing && isSubmissionByLoggedInUser) ? 'PUT' : 'POST';

        if (isEditing && isSubmissionByLoggedInUser && currentUser.loginMethod === 'email' && !currentUser.isVerified) {
            return showStylishPopup({ iconType: 'warning', title: 'Email Verification Required', message: 'Please verify your email to *edit* your feedback.', buttons: [{text:'OK', action: closeStylishPopup}] });
        }

        const spinnerText = (isEditing && isSubmissionByLoggedInUser) ? "Updating Feedback..." : "Submitting Feedback...";
        try {
            const data = await apiRequest(url, method, feedbackPayload, false, submitButton, spinnerText);
            showStylishPopup({ iconType: 'success', title: (isEditing && isSubmissionByLoggedInUser) ? 'Feedback Updated!' : 'Feedback Submitted!', message: data.message || 'Thank you for your feedback!', buttons: [{text:'Great!', action: closeStylishPopup}] });
            resetFeedbackForm();
            await fetchFeedbacks();
        } catch (error) {
            // Error handled by apiRequest
        }
    });

    // --- INITIAL LOGIN STATUS CHECK ---
    async function checkLoginStatus() {
    const token = localStorage.getItem('nobita_jwt');
    let userLoadedFromCache = false;

    if (token) {
        try {
            // 🔁 Try loading from cache
            const cachedUserJSON = localStorage.getItem(USER_PROFILE_CACHE_KEY);
            if (cachedUserJSON) {
                const cachedUser = JSON.parse(cachedUserJSON);
                if (cachedUser && typeof cachedUser === 'object' && cachedUser.userId) {
                    currentUser = cachedUser;
                    updateUIAfterLogin();
                    userLoadedFromCache = true;
                } else {
                    localStorage.removeItem(USER_PROFILE_CACHE_KEY);
                }
            }
        } catch (e) {
            console.error("Cache reading error:", e);
            localStorage.removeItem(USER_PROFILE_CACHE_KEY);
        }

        try {
            // 🔥 Always fetch fresh data from API
            const freshUserData = await apiRequest(API_VALIDATE_TOKEN_URL, 'GET');

            currentUser = freshUserData.user || freshUserData; // Jisme mile, usme set kar de
            const freshUserDataJSON = JSON.stringify(currentUser);
            const cachedUserJSON = localStorage.getItem(USER_PROFILE_CACHE_KEY);

            // ⚡ Compare with cache and update if changed
            if (cachedUserJSON !== freshUserDataJSON) {
                localStorage.setItem(USER_PROFILE_CACHE_KEY, freshUserDataJSON);
                updateUIAfterLogin();
            } else if (!userLoadedFromCache) {
                updateUIAfterLogin(); // In case cache load fail hua but data same hai
            }

        } catch (error) {
            console.error("Token validation failed or user fetch error:", error);
            localStorage.removeItem('nobita_jwt');
            localStorage.removeItem(USER_PROFILE_CACHE_KEY);
            localStorage.removeItem(GUEST_ID_KEY);
            localStorage.removeItem(GUEST_NAME_KEY);
            localStorage.removeItem('nobita_last_email');
            currentUser = null;
            updateUIAfterLogout();
            resetFeedbackForm();
        }
    } else {
        // 👎 No token? Full logout kar
        localStorage.removeItem(USER_PROFILE_CACHE_KEY);
        currentUser = null;
        updateUIAfterLogout();
        resetFeedbackForm();
    }

    await fetchFeedbacks(); // 🗂️ Final call
}

    // Initialize Google Sign-In client
    if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
        google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: window.handleGoogleCredentialResponse
        });
    } else {
        console.error("Google Identity Services script not loaded. Google Sign-In will not work.");
    }
    
    checkLoginStatus();

    const ownerInfoEl = document.querySelector('.owner-info');
    if (ownerInfoEl) {
        setTimeout(() => ownerInfoEl.classList.add('animate-in'), 200);
    }

    if (feedbackFormContainer) setTimeout(() => feedbackFormContainer.classList.add('animate-in'), 300);
    if (feedbackListContainer) setTimeout(() => feedbackListContainer.classList.add('animate-in'), 400);

});
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
  
  
  
      // --- Canvas Starfield ---
        const canvas = document.getElementById('starfield-canvas');
        const ctx = canvas ? canvas.getContext('2d') : null; // Check if canvas exists
        let stars = [];
        const numStars = 150; // Increased number of stars for denser field

        function resizeCanvas() {
            if (!canvas || !ctx) return; // Ensure canvas and context exist
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
            initStars();
        }

        function initStars() {
            stars = [];
            for (let i = 0; i < numStars; i++) {
                stars.push({
                    x: Math.random() * canvas.width,
                    y: Math.random() * canvas.height,
                    radius: Math.random() * 1.5 + 0.5, // 0.5 to 2
                    alpha: Math.random(), // 0 to 1
                    velocity: Math.random() * 0.2 + 0.1 // Slower, subtle movement
                });
            }
        }

        function drawStars() {
            if (!canvas || !ctx) return; // Ensure canvas and context exist
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            for (let i = 0; i < numStars; i++) {
                const star = stars[i];
                ctx.beginPath();
                ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2, false);
                ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
                ctx.shadowColor = `rgba(255, 255, 255, ${star.alpha})`;
                ctx.shadowBlur = star.radius * 2;
                ctx.fill();

                star.x -= star.velocity; // Move stars horizontally
                if (star.x < -star.radius) { // Reset if off screen
                    star.x = canvas.width + star.radius;
                    star.y = Math.random() * canvas.height;
                    star.alpha = Math.random();
                }

                // Twinkle effect (subtle alpha change)
                star.alpha += (Math.random() - 0.5) * 0.02; // Small random change
                if (star.alpha > 1) star.alpha = 1;
                if (star.alpha < 0) star.alpha = 0;
            }
            requestAnimationFrame(drawStars); // Use drawStars for recursive call
        }


        // --- Floating Bouncing Glowing Bubbles ---
        const bubbleContainer = document.getElementById('bubble-container');
        // Increased bubble sizes and adjusted number for better visibility and bounce effect
        const numBubbles = 5; // User's preferred number of bubbles
        const bubbleSizes = [70, 90, 110, 130]; // Larger bubble sizes

        function createBubble() {
            const bubble = document.createElement('div');
            bubble.classList.add('bubble');
            const size = bubbleSizes[Math.floor(Math.random() * bubbleSizes.length)];
            bubble.style.width = `${size}px`;
            bubble.style.height = `${size}px`;
            const radius = size / 2; // Calculate radius of the bubble

            const animatedVideoContainer = document.getElementById('animated-video-container');
            if (!animatedVideoContainer) {
                console.error("Animated video container not found for bubble placement.");
                return;
            }

            // Get the actual dimensions of the container
            const containerWidth = animatedVideoContainer.offsetWidth;
            const containerHeight = animatedVideoContainer.offsetHeight;

            // Define min/max pixel coordinates for the bubble's CENTER
            // This ensures the bubble's edge stays within the container
            const minX = radius;
            const maxX = containerWidth - radius;
            const minY = radius;
            const maxY = containerHeight - radius;

            // Generate 4 random points for the animation path in pixels
            const generatePointInPixels = () => ({
                x: Math.random() * (maxX - minX) + minX,
                y: Math.random() * (maxY - minY) + minY,
                scale: Math.random() * 0.4 + 0.8 // Scale between 0.8 and 1.2 for smoother size changes
            });

            const pStart = generatePointInPixels();
            const p1 = generatePointInPixels();
            const p2 = generatePointInPixels();
            const p3 = generatePointInPixels();

            // Convert pixel coordinates to percentages for CSS variables
            bubble.style.setProperty('--x-start', `${(pStart.x / containerWidth) * 100}%`);
            bubble.style.setProperty('--y-start', `${(pStart.y / containerHeight) * 100}%`);
            bubble.style.setProperty('--scale-start', pStart.scale);

            bubble.style.setProperty('--x-point1', `${(p1.x / containerWidth) * 100}%`);
            bubble.style.setProperty('--y-point1', `${(p1.y / containerHeight) * 100}%`);
            bubble.style.setProperty('--scale-point1', p1.scale);

            bubble.style.setProperty('--x-point2', `${(p2.x / containerWidth) * 100}%`);
            bubble.style.setProperty('--y-point2', `${(p2.y / containerHeight) * 100}%`);
            bubble.style.setProperty('--scale-point2', p2.scale);

            bubble.style.setProperty('--x-point3', `${(p3.x / containerWidth) * 100}%`);
            bubble.style.setProperty('--y-point3', `${(p3.y / containerHeight) * 100}%`);
            bubble.style.setProperty('--scale-point3', p3.scale);


            // Random animation duration and delay
            bubble.style.animationDuration = `${Math.random() * 20 + 30}s`; // User's preferred slow motion (30-50s)
            bubble.style.animationDelay = `${Math.random() * 8}s`; // 0-8 seconds delay for more desynchronization

            const randomColorIndex = Math.floor(Math.random() * 3); // For shadow consistency
            let shadowColor;
            if (randomColorIndex === 0) shadowColor = 'rgba(0, 123, 255, 0.8)';
            else if (randomColorIndex === 1) shadowColor = 'rgba(255, 215, 0, 0.8)';
            else shadowColor = 'rgba(255, 99, 71, 0.8)';
            bubble.style.setProperty('--bubble-color-shadow', shadowColor);

            if (bubbleContainer) { // Ensure container exists
                bubbleContainer.appendChild(bubble);
            }
        }

        // Generate bubbles
        document.addEventListener('DOMContentLoaded', () => {
            // Wait for the container to be rendered and sized before creating bubbles
            const animatedVideoContainer = document.getElementById('animated-video-container');
            if (animatedVideoContainer) {
                // Use a small timeout to ensure layout is stable
                setTimeout(() => {
                    if (bubbleContainer) {
                        for (let i = 0; i < numBubbles; i++) {
                            createBubble();
                        }
                    }
                }, 100); // Small delay
            }
        });

        // Re-generate bubbles on resize to ensure they stay within bounds
        window.addEventListener('resize', () => {
            if (bubbleContainer) {
                bubbleContainer.innerHTML = ''; // Clear existing bubbles
                for (let i = 0; i < numBubbles; i++) {
                    createBubble();
                }
            }
        });


        // --- Blog Content Cycling & Animation ---
        let allBlogs = [];
        let currentBlogIndex = 0;
        const blogDisplayElement = document.getElementById('blog-content-display');
        const blogTitleElement = blogDisplayElement ? blogDisplayElement.querySelector('.animated-blog-title') : null;
        const blogSummaryElement = blogDisplayElement ? blogDisplayElement.querySelector('.animated-blog-summary') : null;
        const blogButtonElement = document.getElementById('blog-read-more-btn'); // Get the new button element
        let blogCycleInterval;

        const animationClasses = ['fade-in-slide-up', 'fade-in-scale']; // Different entry animations

        function applyExitAnimation(element, animationClass) {
            return new Promise(resolve => {
                if (!element) {
                    resolve();
                    return;
                }
                const exitClass = animationClass.replace('in', 'out');
                element.classList.add(exitClass);
                const onAnimationEnd = () => {
                    element.classList.remove(exitClass);
                    element.removeEventListener('animationend', onAnimationEnd);
                    resolve();
                };
                element.addEventListener('animationend', onAnimationEnd);
                // Fallback for cases where animationend might not fire (e.g., element hidden quickly)
                setTimeout(() => {
                    if (element.classList.contains(exitClass)) {
                        element.classList.remove(exitClass);
                        resolve();
                    }
                }, 800); // Animation duration is 0.8s
            });
        }

        async function displayNextBlog() {
            if (!blogDisplayElement || !blogTitleElement || !blogSummaryElement || !blogButtonElement) {
                console.warn("Blog display elements or button not found. Cannot display blogs.");
                return;
            }

            if (!allBlogs.length) {
                blogTitleElement.textContent = "No blogs available yet.";
                blogSummaryElement.textContent = "Check back soon for new content!";
                blogButtonElement.style.display = 'none'; // Hide button if no blogs
                return;
            }

            const nextBlog = allBlogs[currentBlogIndex];
            const currentAnimationClass = animationClasses[Math.floor(Math.random() * animationClasses.length)];

            // Apply exit animation if content is visible and not initial loading message
            if (blogTitleElement.textContent !== "Loading Latest Content..." && blogTitleElement.textContent !== "No blogs available yet." && blogTitleElement.textContent !== "Failed to load content.") {
                await applyExitAnimation(blogDisplayElement, currentAnimationClass);
            }
            blogDisplayElement.classList.remove(...animationClasses.map(cls => cls.replace('in', 'out')));


            // Update content and button link
            blogTitleElement.textContent = nextBlog.title;
            blogSummaryElement.textContent = nextBlog.summary;
            blogButtonElement.href = nextBlog.link || '#'; // Set the link for the button
            blogButtonElement.style.display = 'inline-flex'; // Show the button
            if (nextBlog.link) {
                 blogButtonElement.onclick = (event) => {
                    event.stopPropagation(); // Prevent the container's onclick from firing
                    window.open(nextBlog.link, '_blank'); // Open blog in new tab
                };
            } else {
                blogButtonElement.onclick = null; // No action if no link
            }


            // Apply entry animation
            blogDisplayElement.classList.add(currentAnimationClass);
            const onAnimationEnd = () => {
                blogDisplayElement.classList.remove(currentAnimationClass);
                blogDisplayElement.removeEventListener('animationend', onAnimationEnd);
            };
            blogDisplayElement.addEventListener('animationend', onAnimationEnd);

            currentBlogIndex = (currentBlogIndex + 1) % allBlogs.length;
        }

        // Main blog fetch logic, now only populates allBlogs for animated container
        async function loadBlogs() {
            // Show initial loading message in the animated container
            if (blogTitleElement) {
                blogTitleElement.textContent = "Loading Latest Content...";
                blogSummaryElement.textContent = "Please wait while we fetch the freshest updates for you.";
                if(blogButtonElement) blogButtonElement.style.display = 'none'; // Hide button during initial load
            }

            let cachedBlogs = [];
            // Try to load from local storage first
            if(localStorage.getItem('nobi_blogs')){
                try {
                    cachedBlogs = JSON.parse(localStorage.getItem('nobi_blogs'));
                    if (cachedBlogs.length > 0) {
                        allBlogs = cachedBlogs; // Set blogs for animated container
                        displayNextBlog(); // Display first blog in animated container
                        blogCycleInterval = setInterval(displayNextBlog, 7000); // Cycle every 7 seconds
                    }
                } catch(e) {
                    console.error("Error parsing cached blogs:", e);
                    localStorage.removeItem('nobi_blogs');
                }
            }

            // Always try to fetch latest from server
            try {
                const res = await fetch('/api/blogs');
                if(res.ok) {
                    const latest = await res.json();
                    // Only update cache and re-render if new data is different
                    if (JSON.stringify(latest) !== localStorage.getItem('nobi_blogs')) {
                        localStorage.setItem('nobi_blogs', JSON.stringify(latest));
                        allBlogs = latest; // Update blogs for animated container
                        if (blogDisplayElement && allBlogs.length > 0) {
                            clearInterval(blogCycleInterval); // Clear existing interval
                            currentBlogIndex = 0; // Reset index to start from first new blog
                            displayNextBlog(); // Display first blog of new set
                            blogCycleInterval = setInterval(displayNextBlog, 7000);
                        } else if (blogDisplayElement && allBlogs.length === 0) { // If no blogs received
                            clearInterval(blogCycleInterval);
                            blogTitleElement.textContent = "No blogs available yet.";
                            blogSummaryElement.textContent = "Check back soon for new content!";
                            if(blogButtonElement) blogButtonElement.style.display = 'none';
                        }
                    } else if (cachedBlogs.length === 0 && latest.length > 0) {
                        // If nothing was in cache initially but server has data, use it
                        allBlogs = latest;
                        if (blogDisplayElement) {
                            displayNextBlog();
                            blogCycleInterval = setInterval(displayNextBlog, 7000);
                        }
                    } else if (latest.length === 0 && cachedBlogs.length > 0) {
                        // If server returns no blogs, but cache had some, clear cache and update UI
                        localStorage.removeItem('nobi_blogs');
                        allBlogs = []; // Clear for animated container
                        clearInterval(blogCycleInterval);
                        if (blogDisplayElement) {
                            blogTitleElement.textContent = "Network Error.";
                            blogSummaryElement.textContent = "Could not load content.";
                            if(blogButtonElement) blogButtonElement.style.display = 'none';
                        }
                    }
                } else {
                    console.error("Failed to fetch latest blogs from server:", res.status, res.statusText);
                    if (blogDisplayElement && !allBlogs.length) { // Also update animated container if empty
                        blogTitleElement.textContent = "Failed to load content.";
                        blogSummaryElement.textContent = "Please try refreshing the page.";
                        if(blogButtonElement) blogButtonElement.style.display = 'none';
                    }
                }
            } catch (error) {
                console.error("Network error fetching blogs:", error);
                if (blogDisplayElement && !allBlogs.length) { // Also update animated container if empty
                    blogTitleElement.textContent = "Network Error.";
                    blogSummaryElement.textContent = "Could not load content.";
                    if(blogButtonElement) blogButtonElement.style.display = 'none';
                }
            }
        }

        // script.js (Locate this existing block in your file)

document.addEventListener('DOMContentLoaded', () => {
    loadBlogs();
    // Start starfield animation after canvas is ready
    if (canvas) { // Check if canvas element exists before initializing
        resizeCanvas();
        drawStars(); // Call drawStars to start the animation loop
    }

    // --- ADD THE FOLLOWING LINE DIRECTLY BELOW THE ABOVE LOGIC ---
    checkUserVerificationStatus(); // Check user's email verification status on page load
    // --- END ADDITION ---
});
  
  
  

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

