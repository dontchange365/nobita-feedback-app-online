// === START: JavaScript Code ===
document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOM Fully Loaded and Parsed");

    // Assuming GOOGLE_CLIENT_ID is hardcoded here or loaded from a meta tag
    const GOOGLE_CLIENT_ID = '609784004025-li543jevd5e9u3a58ihvr98a2jpqfb8b.apps.googleusercontent.com';
    
    // Corner Triggers
    const loginIconTrigger = document.getElementById('login-icon-trigger');
    const userAvatarTrigger = document.getElementById('user-avatar-trigger');
    const userAvatarTriggerImg = userAvatarTrigger.querySelector('img');

    // Auth Modals & Menu
    const loginModal = document.getElementById('loginModal');
    const signupModal = document.getElementById('signupModal');
    const userMenu = document.getElementById('userMenu');
    const userProfileModal = document.getElementById('userProfileModal'); // New Profile Modal
    
    // Login Modal Elements
    const emailLoginForm = document.getElementById('email-login-form');
    const modalLoginEmailInput = document.getElementById('modal-login-email');
    const modalLoginPasswordInput = document.getElementById('modal-login-password');
    const modalForgotPasswordLink = document.getElementById('modal-forgot-password-link');
    const modalCreateAccountLink = document.getElementById('modal-create-account-link');
    const modalGoogleLoginBtn = document.getElementById('modal-google-login-btn');
    
    // Signup Modal Elements
    const emailSignupForm = document.getElementById('email-signup-form');
    const modalSignupNameInput = document.getElementById('modal-signup-name');
    const modalSignupEmailInput = document.getElementById('modal-signup-email');
    const modalSignupPasswordInput = document.getElementById('modal-signup-password');
    const modalSignupConfirmPasswordInput = document.getElementById('modal-signup-confirm-password');
    const modalAlreadyAccountLink = document.getElementById('modal-already-account-link');
    const modalGoogleSignupBtn = document.getElementById('modal-google-signup-btn');

    // User Menu Content Elements
    const menuAvatarImg = document.getElementById('menu-avatar');
    const menuUsernameSpan = document.getElementById('menu-username');
    const menuViewProfileLink = document.getElementById('menu-view-profile');
    const menuLogoutLink = document.getElementById('menu-logout');

    // Universal Stylish Popup Elements
    const stylishPopupOverlay = document.getElementById('stylishPopupOverlay');
    const stylishPopupCard = document.getElementById('stylishPopupCard'); // For overlay click check
    const closeStylishPopupBtn = document.getElementById('closeStylishPopupBtn');
    const stylishPopupIcon = document.getElementById('stylishPopupIcon');
    const stylishPopupTitle = document.getElementById('stylishPopupTitle');
    const stylishPopupMessage = document.getElementById('stylishPopupMessage');
    const stylishPopupFormArea = document.getElementById('stylishPopupFormArea');
    const stylishPopupButtonContainer = document.getElementById('stylishPopupButtonContainer');

    // User Profile Modal Elements (New)
    const profileDisplayAvatar = document.getElementById('profile-display-avatar');
    const avatarUploadInput = document.getElementById('avatar-upload-input');
    const uploadProgressBar = document.getElementById('upload-progress-bar');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    const profileEditForm = document.getElementById('profile-edit-form');
    const profileNameInput = document.getElementById('profile-name');
    const profileEmailInput = document.getElementById('profile-email');
    const saveProfileChangesBtn = document.getElementById('save-profile-changes-btn');
    const changePasswordForm = document.getElementById('change-password-form');
    const currentPasswordInput = document.getElementById('current-password');
    const newPasswordProfileInput = document.getElementById('new-password-profile');
    const confirmNewPasswordProfileInput = document.getElementById('confirm-new-password-profile');
    const changePasswordBtn = document.getElementById('change-password-btn');

    // New: direct avatar upload btn and close password modal btn
    const directAvatarUploadBtn = document.getElementById('direct-avatar-upload-btn');
    const closeProfileModalBtn = document.getElementById('close-profile-modal-btn');
    
    // Page Content Elements
    const ownerInfoEl = document.querySelector('.owner-info');
    const feedbackFormContainer = document.getElementById('feedback-form-container');
    const feedbackListContainer = document.getElementById('feedback-list-container');
    const averageRatingDisplayEl = document.getElementById('average-rating-display');
    const nameInputInFeedbackForm = document.getElementById('name'); // The name input in the main feedback form
    const feedbackFormUsernameSpan = document.getElementById('feedback-form-username');
    const feedbackTextarea = document.getElementById('feedback');
    const ratingInput = document.getElementById('rating');
    const submitButton = document.getElementById('submit-feedback');
    const starsElements = document.querySelectorAll('.star');
    const mainTitle = document.getElementById('main-title'); // For Typed.js
    
    let currentUser = null; // Stores current logged-in user data
    let currentSelectedRating = 0;
    let isEditing = false;
    let currentEditFeedbackId = null;

    // API Endpoints
    const BASE_API_URL = window.location.origin;
    const API_SIGNUP_URL = `${BASE_API_URL}/api/auth/signup`;
    const API_LOGIN_URL = `${BASE_API_URL}/api/auth/login`;
    const API_GOOGLE_SIGNIN_URL = `${BASE_API_URL}/api/auth/google-signin`;
    const API_VALIDATE_TOKEN_URL = `${BASE_API_URL}/api/auth/me`;
    const API_REQUEST_RESET_URL = `${BASE_API_URL}/api/auth/request-password-reset`;
    const API_FEEDBACK_URL = `${BASE_API_URL}/api/feedback`; // For POST feedback
    const API_FETCH_FEEDBACKS_URL = `${BASE_API_URL}/api/feedbacks`; // For GET all feedbacks
    const API_UPDATE_PROFILE_URL = `${BASE_API_URL}/api/user/profile`; // New endpoint for profile update
    const API_CHANGE_PASSWORD_URL = `${BASE_API_URL}/api/user/change-password`; // New endpoint for password change
    const API_UPLOAD_AVATAR_URL = `${BASE_API_URL}/api/user/upload-avatar`; // New endpoint for avatar upload

    // --- Stylish Popup Functionality ---
    // Generic function to show a styled popup for various messages (success, error, info, confirm, etc.)
    function showStylishPopup(type, title, message, options = {}) {
        console.log("[showStylishPopup] Called. Type:", type, "Title:", title); // DEBUG log
        if(!stylishPopupOverlay || !stylishPopupTitle || !stylishPopupMessage || !stylishPopupIcon || !stylishPopupButtonContainer) { 
            console.error("Stylish popup core HTML elements not found!"); 
            alert(`${title}: ${message.replace(/<p>|<\/p>/gi, "\n")}`); // Fallback to basic alert
            return; 
        }

        // Reset icon and add type-specific class
        stylishPopupIcon.className = 'popup-icon-area'; // Reset classes
        stylishPopupIcon.innerHTML = ''; // Clear existing icon
        const iconsFA = {
            'success': '<i class="fas fa-check-circle"></i>',
            'error': '<i class="fas fa-times-circle"></i>',
            'info': '<i class="fas fa-info-circle"></i>',
            'warning':'<i class="fas fa-exclamation-triangle"></i>',
            'confirm': '<i class="fas fa-question-circle"></i>',
            'forgot_password': '<i class="fas fa-key"></i>' // Specific icon for forgot password
        };
        if(iconsFA[type]) {
            stylishPopupIcon.innerHTML = iconsFA[type];
            stylishPopupIcon.classList.add(type); // Add class for specific coloring/styling
        }

        stylishPopupTitle.textContent = title;
        stylishPopupMessage.innerHTML = `<p>${message}</p>`; // Ensure message is wrapped in p for styling

        // Handle form HTML
        if (options.formHTML) {
            stylishPopupFormArea.innerHTML = options.formHTML;
            stylishPopupFormArea.style.display = 'block';
        } else {
            stylishPopupFormArea.innerHTML = '';
            stylishPopupFormArea.style.display = 'none';
        }
        
        // Clear existing buttons and add new ones based on options
        stylishPopupButtonContainer.innerHTML = ''; // Clear existing buttons
        if (options.isConfirm) {
            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = options.cancelText || 'Cancel';
            cancelBtn.className = 'popup-button secondary';
            cancelBtn.onclick = () => {
                stylishPopupOverlay.classList.remove('active');
                if (options.onCancel) options.onCancel();
            };
            stylishPopupButtonContainer.appendChild(cancelBtn);

            const confirmBtn = document.createElement('button');
            confirmBtn.textContent = options.confirmText || 'OK'; // Changed to OK for consistency
            confirmBtn.className = 'popup-button primary';
            confirmBtn.id = 'stylishPopupPrimaryActionBtn'; // Add an ID for easy access if needed
            confirmBtn.onclick = () => {
                // Let onConfirm decide if popup should be closed or if it handles it
                if (options.onConfirm) {
                    options.onConfirm();
                } else {
                   stylishPopupOverlay.classList.remove('active'); // Default close if no onConfirm
                }
            };
            stylishPopupButtonContainer.appendChild(confirmBtn);
        } else {
            const okBtn = document.createElement('button');
            okBtn.textContent = options.confirmText || 'OK';
            okBtn.className = 'popup-button primary';
            okBtn.onclick = () => {
                stylishPopupOverlay.classList.remove('active');
                if (options.onConfirm) options.onConfirm(); // Call onConfirm even for OK, useful for chaining
            };
            stylishPopupButtonContainer.appendChild(okBtn);
        }
        
        stylishPopupOverlay.classList.add('active');
        console.log("[showStyledPopup] 'active' class added. Overlay display:", getComputedStyle(stylishPopupOverlay).display); // DEBUG log
    }

    // Close popup on close button click
    if(closeStylishPopupBtn) {
        closeStylishPopupBtn.addEventListener('click', () => {
            if(stylishPopupOverlay) stylishPopupOverlay.classList.remove('active');
        });
    }
    // Close popup on overlay click (if not clicking the card itself)
    if(stylishPopupOverlay) {
        stylishPopupOverlay.addEventListener('click', e => { 
            if (e.target === stylishPopupOverlay) { // Only close if clicking the background, not the card
                stylishPopupOverlay.classList.remove('active');
            }
        });
    }

    // --- New UI Trigger Logic & Modal Control ---
    // Show login modal when login icon is clicked
    if (loginIconTrigger) {
        loginIconTrigger.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent document click from immediately closing it
            if (loginModal) { loginModal.classList.add('active'); console.log("Login modal activated"); }
            if (userMenu) userMenu.classList.remove('active'); // Close user menu if open
            if (userProfileModal) userProfileModal.classList.remove('active'); // Close profile modal if open
        });
    }
    // Show/hide user menu when user avatar is clicked
    if (userAvatarTrigger) {
        userAvatarTrigger.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent document click from immediately closing it
            if (userMenu) { userMenu.classList.toggle('active'); console.log("User menu toggled"); }
            if (loginModal) loginModal.classList.remove('active'); // Close login modal if open
            if (userProfileModal) userProfileModal.classList.remove('active'); // Close profile modal if open
        });
    }
    // Close user menu when clicking anywhere else on the document
    document.addEventListener('click', (e) => { 
        if (userMenu && userMenu.classList.contains('active') && userAvatarTrigger && !userAvatarTrigger.contains(e.target) && !userMenu.contains(e.target)) {
            userMenu.classList.remove('active');
        }
    });
    // Close auth modals (login, signup, profile) when clicking outside or on close button
    [loginModal, signupModal, userProfileModal].forEach(modal => {
        if (modal) {
            modal.addEventListener('click', e => {
                if (e.target === modal) modal.classList.remove('active');
            });
            const closeBtn = modal.querySelector('.close-modal-btn');
            if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.remove('active'));
        }
    });
    
    // Helper for API requests
    async function apiRequest(url, method, body = null, isFormData = false) {
        const headers = {};
        if (!isFormData) {
            headers['Content-Type'] = 'application/json';
        }
        
        const token = localStorage.getItem('authToken');
        if (token) headers['Authorization'] = `Bearer ${token}`;

        let submitBtn; 
        if(url.includes('/api/auth/login')) submitBtn = emailLoginForm.querySelector('button[type="submit"]');
        else if(url.includes('/api/auth/signup')) submitBtn = emailSignupForm.querySelector('button[type="submit"]');
        else if(url.includes('/api/user/profile') && method === 'PUT') submitBtn = saveProfileChangesBtn;
        else if(url.includes('/api/user/change-password')) submitBtn = changePasswordBtn;
        else if(url.includes('/api/feedback')) submitBtn = submitButton;

        if(submitBtn) {submitBtn.disabled = true; submitBtn.textContent = (submitBtn.textContent.includes('...')) ? submitBtn.textContent : "Processing...";}

        try {
            const response = await fetch(url, { method, headers, body: isFormData ? body : (body ? JSON.stringify(body) : null) });
            const data = await response.json(); 
            if (!response.ok) throw new Error(data.message || `Server error (${response.status})`);
            return data;
        } catch (error) { 
            console.error(`API request error to ${url}:`, error); 
            if (!(url.includes('/api/auth/me') && error.message && error.message.toLowerCase().includes("token valid nahi hai"))) {
                showStylishPopup('error', 'Error', error.message || 'Server communication error.');
            }
            // Re-enable button on error, setting original text
            if(submitBtn) {
                submitBtn.disabled = false; 
                if(url.includes('login')) submitBtn.textContent = "Login";
                else if(url.includes('signup')) submitBtn.textContent = "Sign Up";
                else if(url.includes('/api/user/profile') && method === 'PUT') submitBtn.textContent = "Save Changes";
                else if(url.includes('/api/user/change-password')) submitBtn.textContent = "Change Password";
                else if(url.includes('/api/feedback')) submitBtn.textContent = isEditing ? "UPDATE FEEDBACK" : "SUBMIT FEEDBACK";
            }
            throw error; 
        } finally {
            // This finally block ensures buttons are re-enabled even if an error occurs but wasn't caught by a specific handler
            // However, the try-catch above handles button re-enabling on error effectively.
            // This is left here for clarity, but the more robust logic is within the catch block for specific buttons.
            if(submitBtn && submitBtn.disabled && (submitBtn.textContent.includes('Processing...') || submitBtn.textContent.includes('Submitting...'))) {
                // Only reset text if it was set by this function, otherwise it might override manual changes.
                if(url.includes('login')) submitBtn.textContent = "Login";
                else if(url.includes('signup')) submitBtn.textContent = "Sign Up";
                else if(url.includes('/api/user/profile') && method === 'PUT') submitBtn.textContent = "Save Changes";
                else if(url.includes('/api/user/change-password')) submitBtn.textContent = "Change Password";
                else if(url.includes('/api/feedback')) submitBtn.textContent = isEditing ? "UPDATE FEEDBACK" : "SUBMIT FEEDBACK";
                submitBtn.disabled = false;
            }
        }
    }
    
    // Function to handle common actions after successful authentication
    async function handleAuthResponse(data) { 
        if (loginModal) loginModal.classList.remove('active');
        if (signupModal) signupModal.classList.remove('active');
        localStorage.setItem('authToken', data.token);
        currentUser = data.user; 
        updateUIAfterLogin(); 
        showStylishPopup('success', `Welcome, ${currentUser.name}!`, currentUser.loginMethod === 'google' ? 'Successfully logged in with Google!' : 'Successfully logged in!');
        await fetchFeedbacks(); // Refresh feedbacks after login
    }

    // Email Login Form Submission
    if (emailLoginForm) {
        emailLoginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = modalLoginEmailInput.value.trim();
            const password = modalLoginPasswordInput.value;
            if (!email || !password) {
                return showStylishPopup('error', 'Empty Fields!', 'Please enter both email and password.');
            }
            try {
                const data = await apiRequest(API_LOGIN_URL, 'POST', { email, password });
                handleAuthResponse(data);
            } catch (error) { 
                // Error handled by apiRequest function already, so nothing explicit here
            }
        });
    }

    // Email Signup Form Submission
    if (emailSignupForm) {
        emailSignupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = modalSignupNameInput.value.trim();
            const email = modalSignupEmailInput.value.trim();
            const password = modalSignupPasswordInput.value;
            const confirmPassword = modalSignupConfirmPasswordInput.value;
            if (!name || !email || !password || !confirmPassword) {
                return showStylishPopup('error', 'Empty Fields!', 'Please fill all fields.');
            }
            if (password !== confirmPassword) {
                return showStylishPopup('error', 'Password Mismatch!', 'Passwords do not match.');
            }
            if (password.length < 6) {
                return showStylishPopup('error', 'Weak Password!', 'Password must be at least 6 characters.');
            }
            try {
                const data = await apiRequest(API_SIGNUP_URL, 'POST', { name, email, password });
                handleAuthResponse(data);
            } catch (error) { 
                // Error handled
            }
        });
    }

    // Navigation between login/signup modals
    if (modalCreateAccountLink) {
        modalCreateAccountLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (loginModal) loginModal.classList.remove('active');
            if (signupModal) signupModal.classList.add('active');
        });
    }
    if (modalAlreadyAccountLink) {
        modalAlreadyAccountLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (signupModal) signupModal.classList.remove('active');
            if (loginModal) loginModal.classList.add('active');
        });
    }
    
    // Forgot Password Link Handler
    if (modalForgotPasswordLink) {
        modalForgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (loginModal) loginModal.classList.remove('active'); // Close login modal first
            showStylishPopup('forgot_password', 'Forgot Password?', 
                'Enter your registered email address. We will send you a link to reset your password.', 
                {
                    formHTML: `<div class="popup-form-input-group"><label for="popup-forgot-email">Email Address:</label><input type="email" id="popup-forgot-email" placeholder="email@example.com" req[...]
                    isConfirm: true,
                    confirmText: 'Send Reset Link',
                    cancelText: 'Cancel',
                    onConfirm: async () => {
                        const forgotEmailVal = document.getElementById('popup-forgot-email').value.trim();
                        if (!forgotEmailVal) {
                            // Update message in current popup
                            stylishPopupMessage.innerHTML = '<p style="color:var(--error-color); margin-bottom:10px;">Email address is required.</p>' + 
                                                            'Enter your registered email address. We will send you a link to reset your password.';
                            document.getElementById('popup-forgot-email').focus();
                            return; // Keep popup open
                        }
                        // Disable button and show loading state
                        const primaryBtn = stylishPopupCard.querySelector('#stylishPopupPrimaryActionBtn');
                        if(primaryBtn) {primaryBtn.disabled = true; primaryBtn.textContent = "Sending...";}
                        try {
                            const data = await apiRequest(API_REQUEST_RESET_URL, 'POST', { email: forgotEmailVal });
                            stylishPopupOverlay.classList.remove('active'); // Close this popup
                            showStylishPopup('success', 'Link Sent!', data.message);
                        } catch (error) {
                            // Error already shown by apiRequest, just re-enable button if it exists
                            if(primaryBtn) {primaryBtn.disabled = false; primaryBtn.textContent = "Send Reset Link";}
                            // Optionally, to keep the forgot password dialog open on API error:
                            // Do not call stylishPopupOverlay.classList.remove('active');
                            // showStylishPopup was already called by apiRequest for the error.
                        }
                    }
                }
            );
        });
    }


    // Google Sign-In Initialization and Callback
    const triggerGoogleSignIn = () => {
        // Hide existing modals before showing Google prompt
        if (loginModal) loginModal.classList.remove('active');
        if (signupModal) signupModal.classList.remove('active');
        if (userProfileModal) userProfileModal.classList.remove('active');
        google.accounts.id.prompt((notification) => {
            // Optional: Handle notification for UX, e.g., if prompt is not displayed
            if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                console.warn('Google Sign-In prompt was not displayed/skipped.');
            }
        });
    };
    if (modalGoogleLoginBtn) modalGoogleLoginBtn.onclick = triggerGoogleSignIn;
    if (modalGoogleSignupBtn) modalGoogleSignupBtn.onclick = triggerGoogleSignIn;

    window.onload = function () {
        // Initialize Google Sign-In only if the script is loaded
        if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
            google.accounts.id.initialize({
                client_id: GOOGLE_CLIENT_ID,
                callback: handleGoogleCredentialResponse // Our custom callback
            });
        } else {
            console.error("Google Identity Services script abhi load nahi hua hai.");
        }
        checkLoginStatus(); // Check user's login status on page load
        // Animate elements in
        if(ownerInfoEl) setTimeout(() => ownerInfoEl.classList.add('animate-in'), 200);
        if (feedbackFormContainer) setTimeout(() => feedbackFormContainer.classList.add('animate-in'), 300);
        if (feedbackListContainer) setTimeout(() => feedbackListContainer.classList.add('animate-in'), 400);
    };

    async function handleGoogleCredentialResponse(response) {
        try {
            const data = await apiRequest(API_GOOGLE_SIGNIN_URL, 'POST', { token: response.credential });
            handleAuthResponse(data);
        } catch (error) { 
            // Error handled by apiRequest
        }
    }

    // Check Login Status from local storage and validate token
    async function checkLoginStatus() {
        const token = localStorage.getItem('authToken');
        if (token) {
            try {
                const userData = await apiRequest(API_VALIDATE_TOKEN_URL, 'GET');
                currentUser = userData;
                updateUIAfterLogin();
            } catch (error) {
                // Token invalid or expired, clear and update UI
                localStorage.removeItem('authToken');
                currentUser = null;
                updateUIAfterLogout();
            }
        } else {
            updateUIAfterLogout();
        }
        await fetchFeedbacks(); // Always fetch feedbacks regardless of login status
    }

    // Update UI based on logged in user
    function updateUIAfterLogin() {
        if (currentUser) {
            if(loginIconTrigger) loginIconTrigger.style.display = 'none';
            if(userAvatarTrigger) {
                userAvatarTrigger.style.display = 'flex';
                userAvatarTrigger.classList.add('avatar-mode'); // Apply round styling
            }
            if(userAvatarTriggerImg) userAvatarTriggerImg.src = currentUser.avatarUrl || `https://via.placeholder.com/48/FFFFFF/6a0dad?text=${encodeURIComponent(currentUser.name.charAt(0))}`;
            
            if(menuAvatarImg) menuAvatarImg.src = currentUser.avatarUrl || `https://via.placeholder.com/70/FFFFFF/6a0dad?text=${encodeURIComponent(currentUser.name.charAt(0))}`;
            if(menuUsernameSpan) menuUsernameSpan.textContent = currentUser.name;
            
            if(nameInputInFeedbackForm) nameInputInFeedbackForm.value = currentUser.name; 
            if(feedbackFormUsernameSpan) feedbackFormUsernameSpan.textContent = currentUser.name; 
            if(nameInputInFeedbackForm) nameInputInFeedbackForm.disabled = true; // Disable name input when logged in

            if(profileNameInput) profileNameInput.value = currentUser.name;
            if(profileEmailInput) profileEmailInput.value = currentUser.email;
            if (profileDisplayAvatar) profileDisplayAvatar.src = currentUser.avatarUrl || `https://via.placeholder.com/120/FFFFFF/6a0dad?text=${encodeURIComponent(currentUser.name.charAt(0))}`;

            // Disable profile edit for Google users' name and password as they log in via Google
            if (currentUser.loginMethod === 'google') {
                if(profileNameInput) profileNameInput.disabled = true;
                if(profileNameInput) profileNameInput.title = "Name is managed by your Google account.";
                if(profileEditForm) saveProfileChangesBtn.disabled = true; // Disable save changes for Google users (only name can be changed, not email or password)
                if(changePasswordForm) changePasswordForm.style.display = 'none'; // Hide password change form for Google users
            } else {
                if(profileNameInput) profileNameInput.disabled = false;
                if(profileNameInput) profileNameInput.title = "";
                if(profileEditForm) saveProfileChangesBtn.disabled = false;
                if(changePasswordForm) changePasswordForm.style.display = 'block';
            }
            
            // Re-enable save changes button only if input fields are changed (handled by event listeners)
            saveProfileChangesBtn.disabled = true; // Initially disabled until changes are made
        }
    }

    // Update UI after logout
    function updateUIAfterLogout() {
        if(loginIconTrigger) loginIconTrigger.style.display = 'flex';
        if(userAvatarTrigger) {
            userAvatarTrigger.style.display = 'none';
            userAvatarTrigger.classList.remove('avatar-mode'); // Remove round styling
        }
        if(userMenu) userMenu.classList.remove('active'); // Close menu on logout
        if(userProfileModal) userProfileModal.classList.remove('active'); // Close profile modal on logout

        if(feedbackFormContainer) feedbackFormContainer.style.display = 'block'; // Form always visible
        if(nameInputInFeedbackForm) {
            nameInputInFeedbackForm.value = ''; 
            nameInputInFeedbackForm.placeholder = 'Your name here if not logged in...';
            nameInputInFeedbackForm.disabled = false; // Enable name input for guests
        }
        if(feedbackFormUsernameSpan) feedbackFormUsernameSpan.textContent = 'Guest'; 
    }

    // Logout functionality
    if(menuLogoutLink) {
        menuLogoutLink.addEventListener('click', (e) => {
            e.preventDefault();
            if(userMenu) userMenu.classList.remove('active'); // Close menu
            showStylishPopup('confirm', 'Logout Confirmation', 'Are you sure you want to logout?', {
                isConfirm: true,
                confirmText: 'Logout',
                cancelText: 'Cancel',
                onConfirm: () => {
                    localStorage.removeItem('authToken');
                    currentUser = null;
                    // Also disable Google's auto-select for future logins
                    if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
                        google.accounts.id.disableAutoSelect();
                    }
                    updateUIAfterLogout(); 
                    showStylishPopup('info', 'Logged Out', 'You have been successfully logged out.'); 
                    fetchFeedbacks(); // Refresh feedbacks after logout
                }
            });
        });
    }

    // View Profile Link Handler (New)
    if(menuViewProfileLink) {
        menuViewProfileLink.addEventListener('click', (e) => {
            e.preventDefault();
            if(userMenu) userMenu.classList.remove('active'); // Close user menu
            if(userProfileModal) userProfileModal.classList.add('active'); // Open profile modal
            updateUIAfterLogin(); // Refresh profile data in modal
        });
    }

    // Profile Edit Form - Save Changes
    if(profileEditForm) {
        profileEditForm.addEventListener('input', () => {
            // Enable save button if any change detected
            if (currentUser && currentUser.loginMethod !== 'google') { // Only for email users
                const nameChanged = profileNameInput.value.trim() !== currentUser.name;
                saveProfileChangesBtn.disabled = !(nameChanged || avatarUploadInput.files.length > 0);
            }
        });

        profileEditForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentUser) return showStylishPopup('error', 'Error', 'You must be logged in to update your profile.');
            
            const newName = profileNameInput.value.trim();
            if (!newName) {
                return showStylishPopup('error', 'Name Required', 'Name cannot be empty.');
            }
            if (currentUser.loginMethod === 'google' && newName !== currentUser.name) {
                return showStylishPopup('warning', 'Google User', 'Google users cannot change their name directly from here. It is managed by your Google account.');
            }

            const formData = new FormData();
            formData.append('name', newName);

            let newAvatarFile = null;
            if (avatarUploadInput.files.length > 0) {
                newAvatarFile = avatarUploadInput.files[0];
                formData.append('avatar', newAvatarFile);
            }
            
            saveProfileChangesBtn.disabled = true;
            saveProfileChangesBtn.textContent = "Saving...";

            try {
                // If avatar is being uploaded, do it first to get the URL
                if (newAvatarFile) {
                    const xhr = new XMLHttpRequest();
                    xhr.open('POST', API_UPLOAD_AVATAR_URL, true);
                    xhr.setRequestHeader('Authorization', `Bearer ${localStorage.getItem('authToken')}`);

                    xhr.upload.addEventListener('progress', (event) => {
                        if (event.lengthComputable) {
                            const percent = (event.loaded / event.total) * 100;
                            uploadProgressBar.style.display = 'block';
                            progressFill.style.width = percent + '%';
                            progressText.textContent = Math.round(percent) + '%';
                        }
                    });

                    await new Promise((resolve, reject) => {
                        xhr.onload = () => {
                            uploadProgressBar.style.display = 'none';
                            if (xhr.status >= 200 && xhr.status < 300) {
                                const response = JSON.parse(xhr.responseText);
                                showStylishPopup('success', 'Avatar Uploaded!', 'Your new avatar has been uploaded successfully.');
                                // Update currentUser and UI with new avatar URL
                                currentUser.avatarUrl = response.avatarUrl;
                                updateUIAfterLogin(); // To update avatar display immediately
                                formData.delete('avatar'); // Remove file from formData if successful
                                formData.append('avatarUrl', response.avatarUrl); // Add URL instead
                                resolve();
                            } else {
                                const errorResponse = JSON.parse(xhr.responseText);
                                showStylishPopup('error', 'Upload Error!', errorResponse.message || 'Avatar upload failed.');
                                reject(new Error(errorResponse.message));
                            }
                        };
                        xhr.onerror = () => {
                            uploadProgressBar.style.display = 'none';
                            showStylishPopup('error', 'Network Error!', 'Avatar upload failed due to network issues.');
                            reject(new Error('Network error during avatar upload.'));
                        };
                        xhr.send(new FormData().append('avatar', newAvatarFile)); // Send only the avatar file
                    });
                }
                
                // Now send profile data (name and possibly new avatarUrl)
                const data = await apiRequest(API_UPDATE_PROFILE_URL, 'PUT', { 
                    name: newName, 
                    avatarUrl: currentUser.avatarUrl // Ensure latest avatar URL is sent
                });
                
                currentUser.name = data.user.name; // Update current user name
                currentUser.avatarUrl = data.user.avatarUrl; // Update current user avatar URL
                updateUIAfterLogin(); // Refresh main UI elements and profile modal
                showStylishPopup('success', 'Profile Updated!', data.message);

            } catch (error) {
                // Error handled by apiRequest already
            } finally {
                saveProfileChangesBtn.disabled = true; // Disable after saving
                saveProfileChangesBtn.textContent = "Save Changes";
                avatarUploadInput.value = ''; // Clear file input
                uploadProgressBar.style.display = 'none'; // Hide progress bar
            }
        });
    }

    // Avatar Upload Input Change Listener
    if (avatarUploadInput) {
        avatarUploadInput.addEventListener('change', () => {
            if (avatarUploadInput.files.length > 0) {
                // Display selected image immediately
                const reader = new FileReader();
                reader.onload = (e) => {
                    profileDisplayAvatar.src = e