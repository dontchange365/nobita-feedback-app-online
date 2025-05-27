// === START: JavaScript Code ===
document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOM Fully Loaded and Parsed");

    // Assuming GOOGLE_CLIENT_ID is hardcoded here or loaded from a meta tag
    const GOOGLE_CLIENT_ID = '609784004025-li543jevd5e9u3a58ihvr98a2jpqfb8b.apps.googleusercontent.com';
    
    // Cloudinary Configuration (Yeh values server-side honi chahiye, client-side exposed nahi)
    // Client-side upload ke liye yeh keys aapko server se deni hongi ya unsafe way mein directly yahan rakhni hongi.
    // Recommended: Server se signed upload URL ya credentials fetch karein.
    // For this exercise, we will assume dummy placeholders, you must replace them with actual values
    // if using client-side direct upload without server-side signature.
    // IMPORTANT: NEVER EXPOSE CLOUDINARY API SECRET IN CLIENT-SIDE CODE IN PRODUCTION!
    const CLOUDINARY_CLOUD_NAME = 'dlt1n3mrf'; // Replace with your Cloudinary Cloud Name
    const CLOUDINARY_UPLOAD_PRESET = 'feedback_app_preset'; // Replace with your Cloudinary Upload Preset (unsigned)
    const CLOUDINARY_API_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;


    // Corner Triggers
    const loginIconTrigger = document.getElementById('login-icon-trigger');
    const userAvatarTrigger = document.getElementById('user-avatar-trigger');
    const userAvatarTriggerImg = userAvatarTrigger.querySelector('img');

    // Auth Modals & Menu
    const loginModal = document.getElementById('loginModal');
    const signupModal = document.getElementById('signupModal');
    const userMenu = document.getElementById('userMenu');
    
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
    const userProfileModal = document.getElementById('userProfileModal');
    const profileModalTitle = document.getElementById('profile-modal-title');
    const profileDisplayArea = document.getElementById('profile-display-area');
    const profileEditArea = document.getElementById('profile-edit-area');
    const profileAvatarDisplay = document.getElementById('profile-avatar-display');
    const profileNameDisplay = document.getElementById('profile-name-display');
    const profileEmailDisplay = document.getElementById('profile-email-display');
    const editProfileBtn = document.getElementById('edit-profile-btn');
    const closeProfileViewBtn = document.getElementById('close-profile-view-btn');

    // Profile Edit Elements
    const currentEditAvatarPreview = document.getElementById('current-edit-avatar-preview');
    const editAvatarUpload = document.getElementById('edit-avatar-upload');
    const editProfileName = document.getElementById('edit-profile-name');
    const editProfileEmail = document.getElementById('edit-profile-email');
    const saveProfileChangesBtn = document.getElementById('save-profile-changes-btn');
    const cancelProfileEditBtn = document.getElementById('cancel-profile-edit-btn');
    const profileLoadingSpinner = document.getElementById('profile-loading-spinner');
    
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
    let selectedFile = null; // For avatar upload

    // API Endpoints
    const BASE_API_URL = window.location.origin;
    const API_SIGNUP_URL = `${BASE_API_URL}/api/auth/signup`;
    const API_LOGIN_URL = `${BASE_API_URL}/api/auth/login`;
    const API_GOOGLE_SIGNIN_URL = `${BASE_API_URL}/api/auth/google-signin`;
    const API_VALIDATE_TOKEN_URL = `${BASE_API_URL}/api/auth/me`;
    const API_REQUEST_RESET_URL = `${BASE_API_URL}/api/auth/request-password-reset`;
    const API_FEEDBACK_URL = `${BASE_API_URL}/api/feedback`; // For POST feedback
    const API_FETCH_FEEDBACKS_URL = `${BASE_API_URL}/api/feedbacks`; // For GET all feedbacks
    const API_UPDATE_USER_PROFILE_URL = `${BASE_API_URL}/api/user/profile`; // New endpoint for user profile update

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
            confirmBtn.textContent = options.confirmText || 'OK'; // Changed default to OK
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
    // Close auth modals & profile modal when clicking outside or on close button
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
        const token = localStorage.getItem('authToken');
        if (token) headers['Authorization'] = `Bearer ${token}`;

        let requestBody = body;
        if (!isFormData) {
            headers['Content-Type'] = 'application/json';
            requestBody = body ? JSON.stringify(body) : null;
        }

        // Select the correct submit button to disable/enable
        let submitBtn; 
        if(url.includes('/api/auth/login')) submitBtn = emailLoginForm.querySelector('button[type="submit"]');
        else if(url.includes('/api/auth/signup')) submitBtn = emailSignupForm.querySelector('button[type="submit"]');
        else if(url.includes('/api/auth/request-password-reset')) submitBtn = stylishPopupCard.querySelector('#stylishPopupPrimaryActionBtn');
        else if(url.includes('/api/feedback')) submitBtn = submitButton; // Main feedback form
        else if(url.includes('/api/user/profile') && method === 'PUT') submitBtn = saveProfileChangesBtn;


        try {
            if(submitBtn) { // Show spinner for relevant actions
                if(submitBtn === saveProfileChangesBtn || submitBtn === submitButton) profileLoadingSpinner.style.display = 'block';
                submitBtn.disabled = true; 
                submitBtn.textContent = "Processing...";
            }

            const response = await fetch(url, { method, headers, body: requestBody });
            const data = await response.json(); 
            if (!response.ok) throw new Error(data.message || `Server error (${response.status})`);
            return data;
        } catch (error) { 
            console.error(`API request error to ${url}:`, error); 
            // Don't show popup for token validation failure on page load, it's handled by checkLoginStatus
            if (!(url.includes('/api/auth/me') && error.message && error.message.toLowerCase().includes("token valid nahi hai"))) {
                showStylishPopup('error', 'Error', error.message || 'Server communication error.');
            }
        } finally {
            if(submitBtn) { // Re-enable button on error/completion
                if(submitBtn === saveProfileChangesBtn || submitBtn === submitButton) profileLoadingSpinner.style.display = 'none';
                submitBtn.disabled = false; 
                if(url.includes('login')) submitBtn.textContent = "Login";
                else if(url.includes('signup')) submitBtn.textContent = "Sign Up";
                else if(url.includes('request-password-reset')) submitBtn.textContent = "Send Reset Link";
                else if(url.includes('/api/feedback')) submitBtn.textContent = isEditing ? "UPDATE FEEDBACK" : "SUBMIT FEEDBACK";
                else if(url.includes('/api/user/profile') && method === 'PUT') submitBtn.textContent = "Save Changes";
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
                if(data) handleAuthResponse(data);
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
                if(data) handleAuthResponse(data);
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
                    formHTML: `<div class="popup-form-input-group"><label for="popup-forgot-email">Email Address:</label><input type="email" id="popup-forgot-email" placeholder="email@example.com" required></div>`,
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
                        try {
                            const data = await apiRequest(API_REQUEST_RESET_URL, 'POST', { email: forgotEmailVal });
                            if(data) {
                                stylishPopupOverlay.classList.remove('active'); // Close this popup
                                showStylishPopup('success', 'Link Sent!', data.message);
                            }
                        } catch (error) {
                            // Error already shown by apiRequest. Keep dialog open.
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
            if(data) handleAuthResponse(data);
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
                if(userData) {
                    currentUser = userData;
                    updateUIAfterLogin();
                }
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
            if(userAvatarTrigger) userAvatarTrigger.style.display = 'flex';
            if(userAvatarTriggerImg) userAvatarTriggerImg.src = currentUser.avatarUrl || getDiceBearAvatarUrl(currentUser.name);
            userAvatarTrigger.classList.add('avatar-mode'); // Add avatar specific styling

            if(menuAvatarImg) menuAvatarImg.src = currentUser.avatarUrl || getDiceBearAvatarUrl(currentUser.name);
            if(menuUsernameSpan) menuUsernameSpan.textContent = currentUser.name;
            
            if(nameInputInFeedbackForm) nameInputInFeedbackForm.value = currentUser.name; 
            if(feedbackFormUsernameSpan) feedbackFormUsernameSpan.textContent = currentUser.name; 
            if(nameInputInFeedbackForm) nameInputInFeedbackForm.disabled = true; // Disable name input when logged in
            if(feedbackFormContainer) feedbackFormContainer.style.display = 'block'; // Ensure form is visible
        }
    }

    // Update UI after logout
    function updateUIAfterLogout() {
        if(loginIconTrigger) loginIconTrigger.style.display = 'flex';
        if(userAvatarTrigger) userAvatarTrigger.style.display = 'none';
        if(userMenu) userMenu.classList.remove('active'); // Close menu on logout
        if(userProfileModal) userProfileModal.classList.remove('active'); // Close profile modal on logout

        if(feedbackFormContainer) feedbackFormContainer.style.display = 'block'; // Form always visible
        if(nameInputInFeedbackForm) {
            nameInputInFeedbackForm.value = ''; 
            nameInputInFeedbackForm.placeholder = 'Please enter your name...';
            nameInputInFeedbackForm.disabled = false; // Enable name input for guests
        }
        if(feedbackFormUsernameSpan) feedbackFormUsernameSpan.textContent = 'Guest'; 
        // Reset name in feedback form
        resetFeedbackForm();
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

    // View Profile functionality (New)
    if(menuViewProfileLink) {
        menuViewProfileLink.addEventListener('click', (e) => {
            e.preventDefault();
            if(userMenu) userMenu.classList.remove('active'); // Close user menu
            if (!currentUser) {
                showStylishPopup('error', 'Login Required', 'Please login to view your profile.');
                return;
            }
            
            // Populate profile display area
            profileAvatarDisplay.src = currentUser.avatarUrl || getDiceBearAvatarUrl(currentUser.name);
            profileNameDisplay.textContent = currentUser.name;
            profileEmailDisplay.textContent = currentUser.email;

            profileDisplayArea.style.display = 'block';
            profileEditArea.style.display = 'none';
            profileModalTitle.textContent = 'Your Profile';
            userProfileModal.classList.add('active');
        });
    }

    // Close Profile View Button
    if(closeProfileViewBtn) {
        closeProfileViewBtn.addEventListener('click', () => {
            userProfileModal.classList.remove('active');
        });
    }

    // Edit Profile Button (from view profile)
    if(editProfileBtn) {
        editProfileBtn.addEventListener('click', () => {
            if (!currentUser) return; // Should not happen if button is shown correctly

            // Populate edit profile form
            currentEditAvatarPreview.src = currentUser.avatarUrl || getDiceBearAvatarUrl(currentUser.name);
            editProfileName.value = currentUser.name;
            editProfileEmail.value = currentUser.email; // Email is disabled, just for display

            // For file input, clear previous selection
            editAvatarUpload.value = '';
            selectedFile = null;

            profileDisplayArea.style.display = 'none';
            profileEditArea.style.display = 'block';
            profileModalTitle.textContent = 'Edit Profile';

            // Disable avatar upload if login method is Google
            if (currentUser.loginMethod === 'google') {
                editAvatarUpload.disabled = true;
                editAvatarUpload.parentElement.classList.add('disabled-upload'); // Add class for styling
                editAvatarUpload.nextElementSibling.textContent = 'Google users cannot change avatar here.';
                currentEditAvatarPreview.style.border = '4px solid gray'; // Indicate it's not editable
            } else {
                editAvatarUpload.disabled = false;
                editAvatarUpload.parentElement.classList.remove('disabled-upload');
                editAvatarUpload.nextElementSibling.textContent = 'Click to choose image or drag & drop';
                currentEditAvatarPreview.style.border = '4px solid var(--secondary-color)';
            }
        });
    }

    // Cancel Profile Edit Button
    if(cancelProfileEditBtn) {
        cancelProfileEditBtn.addEventListener('click', () => {
            // Revert to view profile state
            profileDisplayArea.style.display = 'block';
            profileEditArea.style.display = 'none';
            profileModalTitle.textContent = 'Your Profile';
        });
    }

    // Handle file selection for avatar upload
    if (editAvatarUpload) {
        editAvatarUpload.addEventListener('change', (event) => {
            selectedFile = event.target.files[0];
            if (selectedFile) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    currentEditAvatarPreview.src = e.target.result;
                };
                reader.readAsDataURL(selectedFile);
            }
        });

        // Drag and drop functionality
        const avatarUploadSection = editAvatarUpload.parentElement;
        if (avatarUploadSection) {
            avatarUploadSection.addEventListener('dragover', (e) => {
                e.preventDefault();
                avatarUploadSection.style.borderColor = 'var(--accent-color)';
            });
            avatarUploadSection.addEventListener('dragleave', (e) => {
                e.preventDefault();
                avatarUploadSection.style.borderColor = 'var(--card-border)';
            });
            avatarUploadSection.addEventListener('drop', (e) => {
                e.preventDefault();
                avatarUploadSection.style.borderColor = 'var(--card-border)';
                if (currentUser.loginMethod === 'google') {
                    showStylishPopup('warning', 'Cannot Change Avatar', 'Google users cannot change avatar here.');
                    return;
                }
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    selectedFile = files[0];
                    if (selectedFile.type.startsWith('image/')) {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            currentEditAvatarPreview.src = e.target.result;
                        };
                        reader.readAsDataURL(selectedFile);
                    } else {
                        showStylishPopup('error', 'Invalid File Type', 'Please drop an image file.');
                        selectedFile = null;
                    }
                }
            });
            // Click to trigger file input
            avatarUploadSection.addEventListener('click', () => {
                if (currentUser.loginMethod !== 'google') {
                    editAvatarUpload.click();
                } else {
                    showStylishPopup('warning', 'Cannot Change Avatar', 'Google users cannot change avatar here.');
                }
            });
        }
    }


    // Save Profile Changes Button
    if(saveProfileChangesBtn) {
        saveProfileChangesBtn.addEventListener('click', async () => {
            if (!currentUser) return;

            const newName = editProfileName.value.trim();
            const originalName = currentUser.name;
            const originalAvatarUrl = currentUser.avatarUrl;
            let newAvatarUrl = originalAvatarUrl;

            let nameChanged = newName !== originalName;
            let avatarChanged = selectedFile !== null;

            if (!nameChanged && !avatarChanged) {
                userProfileModal.classList.remove('active');
                return showStylishPopup('info', 'No Changes', 'No changes detected.');
            }

            if (newName === '') {
                return showStylishPopup('error', 'Name Required', 'Name cannot be empty.');
            }

            profileLoadingSpinner.style.display = 'block';
            saveProfileChangesBtn.disabled = true;
            saveProfileChangesBtn.textContent = 'Saving...';

            try {
                // 1. Upload new avatar if selected and not a Google user
                if (avatarChanged && currentUser.loginMethod !== 'google') {
                    const formData = new FormData();
                    formData.append('file', selectedFile);
                    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
                    
                    // Show message during upload
                    showStylishPopup('info', 'Uploading Avatar', 'Please wait while your avatar is being uploaded...', { confirmText: 'OK', isConfirm: false });

                    const uploadResponse = await fetch(CLOUDINARY_API_URL, {
                        method: 'POST',
                        body: formData
                    });
                    const uploadData = await uploadResponse.json();

                    if (!uploadResponse.ok) {
                        throw new Error(uploadData.error?.message || 'Avatar upload failed.');
                    }
                    newAvatarUrl = uploadData.secure_url;
                } else if (avatarChanged && currentUser.loginMethod === 'google') {
                    // This case should be prevented by UI, but as a fallback
                    showStylishPopup('warning', 'Cannot Change Avatar', 'Google users cannot change avatar via this option.');
                    selectedFile = null; // Clear selected file as it won't be used
                }


                // 2. Update user profile on your backend
                const updatePayload = {
                    name: newName,
                    avatarUrl: newAvatarUrl // Will be original if no new avatar or Google user
                };

                const updateData = await apiRequest(API_UPDATE_USER_PROFILE_URL, 'PUT', updatePayload);
                
                if(updateData) {
                    // Update local currentUser and UI
                    currentUser.name = updateData.user.name;
                    currentUser.avatarUrl = updateData.user.avatarUrl;
                    localStorage.setItem('authToken', updateData.token); // Update token if it changed

                    updateUIAfterLogin(); // Refresh all UI elements that display user info
                    
                    // Close profile modal and show success
                    userProfileModal.classList.remove('active');
                    showStylishPopup('success', 'Profile Updated!', 'Your profile has been updated successfully!');
                    await fetchFeedbacks(); // Re-fetch feedbacks to update avatar/name in list
                }

            } catch (error) {
                console.error('Profile update error:', error);
                // Error message already shown by apiRequest or custom upload error
                // If the error was from avatar upload, reset preview/selection
                if (error.message.includes('Avatar upload failed')) {
                    currentEditAvatarPreview.src = currentUser.avatarUrl || getDiceBearAvatarUrl(currentUser.name);
                    selectedFile = null;
                }
            } finally {
                profileLoadingSpinner.style.display = 'none';
                saveProfileChangesBtn.disabled = false;
                saveProfileChangesBtn.textContent = 'Save Changes';
                selectedFile = null; // Clear selected file after attempt
            }
        });
    }

    // Star Rating Logic
    function updateStarVisuals(ratingToShow) {
        starsElements.forEach(star => {
            const val = parseInt(star.getAttribute('data-value'));
            star.classList.toggle('selected', val <= ratingToShow);
            star.classList.remove('highlighted'); // Remove highlight on update
        });
    }
    starsElements.forEach(star => {
        star.addEventListener('click', () => {
            currentSelectedRating = parseInt(star.getAttribute('data-value'));
            ratingInput.value = currentSelectedRating;
            updateStarVisuals(currentSelectedRating);
        });
        star.addEventListener('mouseenter', () => {
            const hoverVal = parseInt(star.getAttribute('data-value'));
            starsElements.forEach(s => s.classList.toggle('highlighted', parseInt(s.getAttribute('data-value')) <= hoverVal));
        });
        star.addEventListener('mouseleave', () => {
            // Revert to selected state or no state if no rating
            starsElements.forEach(s => s.classList.remove('highlighted'));
            updateStarVisuals(currentSelectedRating);
        });
    });
    
    // Fetch and Display Feedbacks
    async function fetchFeedbacks() {
         try {
            const data = await apiRequest(API_FETCH_FEEDBACKS_URL, 'GET', null, true); // No body needed for GET
            // Clear previous feedbacks before adding new ones
            const h2Title = feedbackListContainer.querySelector('h2'); // Keep the H2 title
            feedbackListContainer.innerHTML = ''; // Clear all content
            feedbackListContainer.appendChild(averageRatingDisplayEl); // Add average rating div back
            if(h2Title) feedbackListContainer.appendChild(h2Title); // Add H2 title back

            if (data.length === 0) {
                const msgP = document.createElement('p');
                msgP.textContent = 'No feedback yet. Be the first one!';
                msgP.style.textAlign='center';
                msgP.style.padding='20px';
                feedbackListContainer.appendChild(msgP);
                updateAverageRating(0, 0); // Display 0 average if no feedbacks
            } else {
                const totalRatings = data.reduce((sum, fb) => sum + fb.rating, 0);
                const average = totalRatings / data.length;
                updateAverageRating(average, data.length);
                data.forEach((fb, index) => addFeedbackToDOM(fb, index));
            }
        } catch (err) {
            // Error handled by apiRequest function
        }
    }

    // Update Average Rating Display
    function updateAverageRating(avg, count) {
        const avgNum = parseFloat(avg);
        let starsHtml = '☆☆☆☆☆'; // Default to empty stars
        if (!isNaN(avgNum) && avgNum > 0) {
            const fullStars = Math.floor(avgNum);
            starsHtml = '★'.repeat(fullStars) + '☆'.repeat(5 - fullStars);
        }
        averageRatingDisplayEl.innerHTML = `
            <div class="average-rating-container">
                <h3>Overall Average Rating</h3>
                <div class="average-number">${isNaN(avgNum) ? '0.0' : avgNum.toFixed(1)}</div>
                <div class="average-stars">${starsHtml}</div>
                <div class="total-feedbacks-count">(${count} feedbacks)</div>
            </div>
        `;
        // Animate the average rating container in if it's new/hidden
        setTimeout(() => {
            const avgContainer = averageRatingDisplayEl.querySelector('.average-rating-container');
            if (avgContainer && !avgContainer.classList.contains('animate-in')) {
                avgContainer.classList.add('animate-in');
            }
        }, 50);
    }
    
    // Submit/Edit Feedback
    if(submitButton) submitButton.addEventListener('click', async () => {
        const feedbackContent = feedbackTextarea.value.trim(); 
        const ratingValue = ratingInput.value;
        let nameValue = nameInputInFeedbackForm.value.trim();

        if (!currentUser && !nameValue) {
            return showStylishPopup('error', 'Name Required', 'If you are not logged in, please enter your name.');
        }
        if (!feedbackContent || ratingValue === '0') {
            return showStylishPopup('error', 'Empty Fields!', 'Feedback and rating are required!');
        }
        // If not logged in, prompt to log in via the icon
        if (!currentUser) {
            showStylishPopup('warning', 'Login Required', 'Please login via the icon to submit feedback.');
            return;
        }

        let feedbackPayload = { feedback: feedbackContent, rating: parseInt(ratingValue) };
        // If editing, use PUT method and existing ID
        const url = isEditing ? `${API_FEEDBACK_URL}/${currentEditFeedbackId}` : API_FEEDBACK_URL;
        const method = isEditing ? 'PUT' : 'POST';

        submitButton.disabled = true;
        submitButton.textContent = "Submitting...";

        try { 
            const data = await apiRequest(url, method, feedbackPayload); 
            if(data) {
                showStylishPopup('success', isEditing ? 'Feedback Updated!' : 'Feedback Submitted!', data.message); 
                resetFeedbackForm(); // Clear form after submission/edit
                await fetchFeedbacks(); // Refresh feedbacks to show new/updated one
            }
        } 
        catch (error) { 
            // Error handled by apiRequest function
        }
        finally { 
            submitButton.disabled = false; 
            submitButton.textContent = isEditing ? "UPDATE FEEDBACK" : "SUBMIT FEEDBACK"; 
        }
    });

    // Reset Feedback Form
    function resetFeedbackForm() { 
        if (currentUser) {
            nameInputInFeedbackForm.value = currentUser.name;
            feedbackFormUsernameSpan.textContent = currentUser.name;
            nameInputInFeedbackForm.disabled = true; // Keep disabled if logged in
        } else {
            nameInputInFeedbackForm.value = '';
            feedbackFormUsernameSpan.textContent = 'Guest';
            nameInputInFeedbackForm.disabled = false;
            nameInputInFeedbackForm.placeholder = 'Your name here...';
        }
        feedbackTextarea.value = '';
        ratingInput.value = '0';
        currentSelectedRating = 0;
        updateStarVisuals(0); // Reset stars
        submitButton.textContent = 'SUBMIT FEEDBACK'; // Reset button text
        isEditing = false; // Reset editing state
        currentEditFeedbackId = null; // Clear edit ID
    }

    // Function to generate DiceBear avatar URL (client-side for placeholders)
    function getDiceBearAvatarUrl(name, randomSeed = '') {
        const seedName = (typeof name === 'string' && name) ? name.toLowerCase() : 'default_seed';
        const seed = encodeURIComponent(seedName + randomSeed);
        return `https://api.dicebear.com/8.x/adventurer/svg?seed=${seed}&flip=true&radius=50&doodle=true&scale=90`;
    }

    // Add Feedback to DOM
    function addFeedbackToDOM(fbData, index) {
        const item = document.createElement('div');
        item.className = 'feedback-item';
        item.dataset.feedbackId = fbData._id; // Store ID for potential updates/deletions

        const avatarImg = document.createElement('img');
        avatarImg.className = 'avatar-img';
        avatarImg.src = fbData.avatarUrl || getDiceBearAvatarUrl(fbData.name);
        avatarImg.alt = (fbData.name && fbData.name.length > 0 ? fbData.name.charAt(0).toUpperCase() : 'X');
        // Fallback for broken image links
        avatarImg.onerror = function() {
            this.src = getDiceBearAvatarUrl(fbData.name); // Fallback to DiceBear
        };

        const detailsDiv = document.createElement('div');
        detailsDiv.className = 'feedback-details';

        const strongName = document.createElement('strong'); 
        let nameContent = fbData.name;
        let userTypeTag = '';
        // If googleIdSubmitter is present, it's a Google user. Otherwise, it's email/password or guest.
        // For guest, googleIdSubmitter won't be set and userId might be absent or not populate.
        // Simplified check based on existing data in feedback object.
        if (fbData.googleIdSubmitter) {
            userTypeTag = `<span class="user-type-indicator google-user-indicator" title="Google User">G</span>`;
        } else if (fbData.userId) { // If userId exists and no googleId, assume email user
            userTypeTag = `<span class="user-type-indicator email-user-indicator" title="Email User">E</span>`;
        } else { // Fallback for old/guest feedbacks without userId/googleIdSubmitter
            userTypeTag = `<span class="user-type-indicator email-user-indicator" title="Guest/Unknown User">U</span>`;
        }
        strongName.innerHTML = `${nameContent} ${userTypeTag}`;


        if (fbData.isEdited) {
            const editedTag = document.createElement('span');
            editedTag.className = 'edited-tag';
            editedTag.textContent = 'Edited';
            strongName.appendChild(editedTag);
        }

        const starsDiv = document.createElement('div');
        starsDiv.className = 'feedback-stars';
        starsDiv.textContent = '★'.repeat(fbData.rating) + '☆'.repeat(5 - fbData.rating);

        const pFeedback = document.createElement('p');
        pFeedback.textContent = fbData.feedback;

        const timestampDiv = document.createElement('div');
        timestampDiv.className = 'feedback-timestamp';
        try {
            // Indian Time Zone for timestamp
            timestampDiv.textContent = `Posted: ${new Date(fbData.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}`;
        } catch(e) { 
            timestampDiv.textContent = `Posted: ${new Date(fbData.timestamp).toLocaleString('en-US')}`; // Fallback
        }

        detailsDiv.append(strongName, starsDiv, pFeedback, timestampDiv);

        // Edit Button
        const editButton = document.createElement('button');
        editButton.className = 'edit-feedback-btn';
        editButton.innerHTML = '<i class="fas fa-pencil-alt"></i>';
        editButton.title = 'Edit this feedback';
        // Disable edit button if not the current user's feedback
        editButton.disabled = !(currentUser && currentUser.userId === fbData.userId);

        editButton.addEventListener('click', (event) => { 
            event.stopPropagation(); // Prevent bubbling to parent if it has a click handler
            if (!currentUser || currentUser.userId !== fbData.userId) {
                return showStylishPopup('error', 'Permission Denied!', 'You can only edit your own feedback.');
            }
            showStylishPopup('info', 'Edit Feedback', 'Edit your feedback in the form below.');
            // Populate the form for editing
            nameInputInFeedbackForm.value = fbData.name;
            feedbackFormUsernameSpan.textContent = fbData.name;
            nameInputInFeedbackForm.disabled = true; // Keep disabled as user is logged in
            
            feedbackTextarea.value = fbData.feedback;
            currentSelectedRating = fbData.rating;
            ratingInput.value = fbData.rating;
            updateStarVisuals(fbData.rating);

            submitButton.textContent = 'UPDATE FEEDBACK'; // Change button text
            isEditing = true; // Set editing mode
            currentEditFeedbackId = fbData._id; // Store ID of feedback being edited

            // Smooth scroll to the form
            if(feedbackFormContainer) {
                feedbackFormContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
        item.appendChild(editButton);


        // Admin Reply (if exists)
        if (fbData.replies && fbData.replies.length > 0) { 
            const latestReply = fbData.replies[fbData.replies.length - 1]; // Get the most recent reply
            if (latestReply && latestReply.text) {
                const adminReplyDiv = document.createElement('div');
                adminReplyDiv.className = 'admin-reply';

                const adminAvatar = document.createElement('img');
                adminAvatar.className = 'admin-reply-avatar';
                adminAvatar.src = 'https://i.ibb.co/FsSs4SG/creator-avatar.png'; // Nobita's avatar
                adminAvatar.alt = 'Nobita';

                const adminReplyContent = document.createElement('div');
                adminReplyContent.className = 'admin-reply-content';
                let replyTimestampText = '';
                try {
                    replyTimestampText = `(${new Date(latestReply.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle:'short', timeStyle:'short' })})`;
                } catch(e) {
                    replyTimestampText = `(${new Date(latestReply.timestamp).toLocaleString('en-US')})`;
                }
                adminReplyContent.innerHTML = `<strong>(${(latestReply.adminName || 'Admin')}):</strong> ${latestReply.text} <span class="reply-timestamp">${replyTimestampText}</span>`;
                
                adminReplyDiv.append(adminAvatar, adminReplyContent);
                detailsDiv.appendChild(adminReplyDiv);
            }
        }

        item.append(avatarImg, detailsDiv); 
        // Check if the item already exists to prevent duplicates on re-fetch
        if(feedbackListContainer.querySelector(`[data-feedback-id="${fbData._id}"]`)) {
            // If it exists, you might want to update it instead of re-adding, or do nothing
            // For now, if it exists, we assume it's already rendered correctly, or a full refresh is desired
        } else {
            feedbackListContainer.appendChild(item);
        }
    }
    
    // Initial calls on load
    updateUIAfterLogout(); // Set initial UI state (guest mode)
    checkLoginStatus(); // Check if user is already logged in via token
});
// === END: JavaScript Code ===