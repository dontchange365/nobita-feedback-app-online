// This file contains all UI-related functions to keep main.js clean.
// It relies on functions from main.js (like apiRequest, handleAuthResponse etc.)

// Shows fullscreen loading spinner
function showFullScreenLoader() {
    const loader = document.getElementById('nobi-fullscreen-loader');
    if (loader) loader.style.display = 'flex';
}
window.showFullScreenLoader = showFullScreenLoader;

// Hides fullscreen loading spinner
function hideFullScreenLoader() {
    const loader = document.getElementById('nobi-fullscreen-loader');
    if (loader) loader.style.display = 'none';
}
window.hideFullScreenLoader = hideFullScreenLoader;

// Opens the login modal
function openLoginModal() {
    if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
    }

    const authModalOverlay = document.getElementById('auth-modal-overlay');
    const busiconLoginContainer = document.getElementById('busicon-login-container');
    const busiconSignupContainer = document.getElementById('busicon-signup-container');
    const googleLoginBtnContainer = document.getElementById('google-btn-container-login');

    if (authModalOverlay && busiconLoginContainer && busiconSignupContainer) {
        authModalOverlay.classList.add('active');
        busiconLoginContainer.style.display = 'block';
        busiconSignupContainer.style.display = 'none';
        
        // Re-render Google button
        if (googleLoginBtnContainer) {
            googleLoginBtnContainer.innerHTML = ''; 
            google.accounts.id.renderButton(googleLoginBtnContainer, {
                type: "standard",
                theme: "filled_blue",
                size: "large",
                text: "continue_with",
                shape: "pill",
                logo_alignment: "left",
                width: 320
            });
            googleLoginBtnContainer.style.display = 'block';
        }
    }
}
window.openLoginModal = openLoginModal;

// Opens the signup modal
function openSignupModal() {
    if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
    }
    
    const authModalOverlay = document.getElementById('auth-modal-overlay');
    const busiconLoginContainer = document.getElementById('busicon-login-container');
    const busiconSignupContainer = document.getElementById('busicon-signup-container');
    const googleSignupBtnContainer = document.getElementById('google-btn-container-signup');

    if (authModalOverlay && busiconLoginContainer && busiconSignupContainer) {
        authModalOverlay.classList.add('active');
        busiconLoginContainer.style.display = 'none';
        busiconSignupContainer.style.display = 'block';
        
        // Re-render Google button
        if (googleSignupBtnContainer) {
            googleSignupBtnContainer.innerHTML = '';
            google.accounts.id.renderButton(googleSignupBtnContainer, {
                type: "standard",
                theme: "filled_blue",
                size: "large",
                text: "continue_with",
                shape: "pill",
                logo_alignment: "left",
                width: 320
            });
            googleSignupBtnContainer.style.display = 'block';
        }
    }
}
window.openSignupModal = openSignupModal;

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
        const response = await window.apiRequest(window.API_VALIDATE_TOKEN_URL, 'GET');

        if (response.success && response.user) {
            // Update the global currentUser object with fresh data
            window.currentUser = response.user;
            // Also update localStorage cache if you're using it for user profile
            localStorage.setItem(window.USER_PROFILE_CACHE_KEY, JSON.stringify(window.currentUser));

            if (window.currentUser.isVerified) {
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
window.checkUserVerificationStatus = checkUserVerificationStatus;

// Function to handle "Forgot Password" link click (opens the NEW forgot password popup)
function openForgotModal() {
    window.closeAuthModal();
    window.closeStylishPopup();
    
    // NEW: Close the profile modal as well
    const userProfileModal = document.getElementById('userProfileModal');
    if (userProfileModal) userProfileModal.classList.remove('active');

    const forgotPasswordNewOverlay = document.getElementById('forgotPasswordNewOverlay');
    if (forgotPasswordNewOverlay) {
        forgotPasswordNewOverlay.classList.add('active');
        window.renderForgotForm();
    }
}
window.openForgotModal = openForgotModal;

function closeForgotPasswordNewPopup() {
    const forgotPasswordNewOverlay = document.getElementById('forgotPasswordNewOverlay');
    if (forgotPasswordNewOverlay) {
        forgotPasswordNewOverlay.classList.remove('active');
        const popupContentDiv = document.getElementById('forgotPasswordNewPopupContent');
        if (popupContentDiv) popupContentDiv.innerHTML = '';
    }
}
window.closeForgotPasswordNewPopup = closeForgotPasswordNewPopup;

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
        <button class="submit-btn" id="sendResetLinkBtn" onclick="window.submitForgotPasswordRequest()">Send Reset Link</button>
    `;
    // Removed the automatic focus line
}
window.renderForgotForm = renderForgotForm;

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
window.renderForgotSuccess = renderForgotSuccess;

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
    const feedbackVerificationPrompt = document.getElementById('feedback-verification-prompt');
    const profileForgotPasswordLink = document.getElementById('profile-forgot-password-link'); // NEW: Get the forgot password link

    if (!window.currentUser) return;

    if (navLoginIconTrigger) navLoginIconTrigger.classList.add('hidden');
    if (userProfileTrigger) {
        userProfileTrigger.classList.remove('hidden');
        if (userProfileAvatarImg) {
            userProfileAvatarImg.src = window.currentUser.avatarUrl || `https://placehold.co/40x40/6a0dad/FFFFFF?text=${encodeURIComponent(window.currentUser.name.charAt(0).toUpperCase())}`;
        }
        if (userProfileNameSpan) userProfileNameSpan.textContent = window.currentUser.name;
    }

    if (menuAvatarImg) menuAvatarImg.src = window.currentUser.avatarUrl || `https://placehold.co/82x82/FFD700/23235a?text=${encodeURIComponent(window.currentUser.name.charAt(0).toUpperCase())}`;
    
    // CHANGE START: Check for verified user and add icon to menu username
    if (menuUsernameSpan) {
        menuUsernameSpan.textContent = window.currentUser.name;
        if (window.currentUser.isVerified) {
            const verifiedIcon = document.createElement('img');
            verifiedIcon.src = '/images/blue-tick.svg';
            verifiedIcon.alt = 'Verified';
            verifiedIcon.className = 'menu-verified-icon';
            verifiedIcon.style.cssText = 'height:18px; width:18px; margin-left: 5px; vertical-align: middle;';
            menuUsernameSpan.appendChild(verifiedIcon);
        }
    }
    // CHANGE END
    
    if (nameInputInFeedbackForm) {
        nameInputInFeedbackForm.value = window.currentUser.name;
        nameInputInFeedbackForm.disabled = true;
        nameInputInFeedbackForm.dispatchEvent(new Event('input'));
    }

    const isEmailUserUnverified = window.currentUser.loginMethod === 'email' && !window.currentUser.isVerified;
    
    const emailVerificationPrompt = document.getElementById('email-verification-prompt');
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

    // Call the profile-specific update function
    if(window.updateProfileModalUI) {
        window.updateProfileModalUI(window.currentUser);
    }
    // Call the feedback-specific update function
    if(window.updateFeedbackFormForUser) {
        window.updateFeedbackFormForUser(window.currentUser);
    }
    
    const submitButton = document.getElementById('submit-feedback');
    if (submitButton) submitButton.disabled = false;
    
    // NEW: Add event listener to the profile forgot password link
    if(profileForgotPasswordLink) {
        profileForgotPasswordLink.addEventListener('click', e => {
            e.preventDefault();
            
            // Pass the user's email to the render function to pre-fill the input
            window.openForgotModal(window.currentUser.email);
        });
    }
}
window.updateUIAfterLogin = updateUIAfterLogin;

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
    const profileForgotPasswordLink = document.getElementById('profile-forgot-password-link');

    if (navLoginIconTrigger) navLoginIconTrigger.classList.remove('hidden');
    if (userProfileTrigger) {
        userProfileTrigger.classList.add('hidden');
        if (userProfileAvatarImg) userProfileAvatarImg.src = 'https://i.ibb.co/VpjRLsv/sample-user.png';
        if (userProfileNameSpan) userProfileNameSpan.textContent = 'User Name';
    }

    if (userMenu) userMenu.classList.remove('active');
    if (userProfileModal) userProfileModal.classList.remove('active');

    if (emailVerificationPrompt) emailVerificationPrompt.style.display = 'none';
    if (feedbackVerificationPrompt) feedbackVerificationPrompt.style.display = 'none';
    if (menuVerifyEmailOption) menuVerifyEmailOption.style.display = 'none';

    if (nameInputInFeedbackForm) {
        const storedGuestName = localStorage.getItem(window.GUEST_NAME_KEY);
        nameInputInFeedbackForm.value = storedGuestName || '';
        nameInputInFeedbackForm.disabled = false;
        nameInputInFeedbackForm.placeholder = ' ';
        nameInputInFeedbackForm.dispatchEvent(new Event('input'));
    }
    if (feedbackFormContainer) feedbackFormContainer.style.display = 'block';

    // Call the profile-specific logout function
    if(window.updateProfileModalUILogout) {
        window.updateProfileModalUILogout();
    }
    // Call the feedback-specific logout function
    if(window.updateFeedbackFormForGuest) {
        window.updateFeedbackFormForGuest();
    }

    const submitButton = document.getElementById('submit-feedback');
    if (submitButton) submitButton.disabled = false;
    
    // NEW: Remove event listener on logout to prevent memory leaks
    if(profileForgotPasswordLink) {
        // Need to add an event listener here to remove it
    }
}
window.updateUIAfterLogout = updateUIAfterLogout;
