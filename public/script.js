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
    let avatarUploadInProgress = false; // Flag to track upload status

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
        console.log("[showStylishPopup] Called. Type:", type, "Title:", title);
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
            'forgot_password': '<i class="fas fa-key"></i>'
        };
        if(iconsFA[type]) {
            stylishPopupIcon.innerHTML = iconsFA[type];
            stylishPopupIcon.classList.add(type); // Add class for specific coloring/styling
        }

        stylishPopupTitle.textContent = title;
        stylishPopupMessage.innerHTML = `<p>${message}</p>`;

        // Handle form HTML
        if (options.formHTML) {
            stylishPopupFormArea.innerHTML = options.formHTML;
            stylishPopupFormArea.style.display = 'block';
        } else {
            stylishPopupFormArea.innerHTML = '';
            stylishPopupFormArea.style.display = 'none';
        }
        
        // Clear existing buttons and add new ones based on options
        stylishPopupButtonContainer.innerHTML = '';
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
            confirmBtn.textContent = options.confirmText || 'OK';
            confirmBtn.className = 'popup-button primary';
            confirmBtn.id = 'stylishPopupPrimaryActionBtn';
            confirmBtn.onclick = () => {
                if (options.onConfirm) {
                    options.onConfirm();
                } else {
                   stylishPopupOverlay.classList.remove('active');
                }
            };
            stylishPopupButtonContainer.appendChild(confirmBtn);
        } else {
            const okBtn = document.createElement('button');
            okBtn.textContent = options.confirmText || 'OK';
            okBtn.className = 'popup-button primary';
            okBtn.onclick = () => {
                stylishPopupOverlay.classList.remove('active');
                if (options.onConfirm) options.onConfirm();
            };
            stylishPopupButtonContainer.appendChild(okBtn);
        }
        
        stylishPopupOverlay.classList.add('active');
        console.log("[showStyledPopup] 'active' class added. Overlay display:", getComputedStyle(stylishPopupOverlay).display);
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
            if (e.target === stylishPopupOverlay) {
                stylishPopupOverlay.classList.remove('active');
            }
        });
    }

    // --- UI Trigger Logic & Modal Control ---
    if (loginIconTrigger) {
        loginIconTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            if (loginModal) { loginModal.classList.add('active'); }
            if (userMenu) userMenu.classList.remove('active');
            if (userProfileModal) userProfileModal.classList.remove('active');
        });
    }
    if (userAvatarTrigger) {
        userAvatarTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            if (userMenu) { userMenu.classList.toggle('active'); }
            if (loginModal) loginModal.classList.remove('active');
            if (userProfileModal) userProfileModal.classList.remove('active');
        });
    }
    document.addEventListener('click', (e) => { 
        if (userMenu && userMenu.classList.contains('active') && userAvatarTrigger && !userAvatarTrigger.contains(e.target) && !userMenu.contains(e.target)) {
            userMenu.classList.remove('active');
        }
    });
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

        let submitBtn = null;
        if(url.includes('/api/auth/login')) submitBtn = emailLoginForm.querySelector('button[type="submit"]');
        else if(url.includes('/api/auth/signup')) submitBtn = emailSignupForm.querySelector('button[type="submit"]');
        else if(url.includes('/api/auth/request-password-reset')) submitBtn = stylishPopupCard.querySelector('#stylishPopupPrimaryActionBtn');
        else if(url.includes('/api/feedback')) submitBtn = submitButton;
        else if(url.includes('/api/user/profile') && method === 'PUT') submitBtn = saveProfileChangesBtn;

        try {
            if(submitBtn) {
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
            if (!(url.includes('/api/auth/me') && error.message && error.message.toLowerCase().includes("token valid nahi hai"))) {
                showStylishPopup('error', 'Error', error.message || 'Server communication error.');
            }
            throw error; // Re-throw to be caught by specific handlers
        } finally {
            if(submitBtn) {
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
    
    async function handleAuthResponse(data) { 
        if (loginModal) loginModal.classList.remove('active');
        if (signupModal) signupModal.classList.remove('active');
        localStorage.setItem('authToken', data.token);
        currentUser = data.user; 
        updateUIAfterLogin(); 
        showStylishPopup('success', `Welcome, ${currentUser.name}!`, currentUser.loginMethod === 'google' ? 'Successfully logged in with Google!' : 'Successfully logged in!');
        await fetchFeedbacks();
    }

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
            } catch (error) { }
        });
    }

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
            } catch (error) { }
        });
    }

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
    
    if (modalForgotPasswordLink) {
        modalForgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (loginModal) loginModal.classList.remove('active');
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
                            stylishPopupMessage.innerHTML = '<p style="color:var(--error-color); margin-bottom:10px;">Email address is required.</p>' + 
                                                            'Enter your registered email address. We will send you a link to reset your password.';
                            document.getElementById('popup-forgot-email').focus();
                            return;
                        }
                        try {
                            const data = await apiRequest(API_REQUEST_RESET_URL, 'POST', { email: forgotEmailVal });
                            if(data) {
                                stylishPopupOverlay.classList.remove('active');
                                showStylishPopup('success', 'Link Sent!', data.message);
                            }
                        } catch (error) { }
                    }
                }
            );
        });
    }

    const triggerGoogleSignIn = () => {
        if (loginModal) loginModal.classList.remove('active');
        if (signupModal) signupModal.classList.remove('active');
        if (userProfileModal) userProfileModal.classList.remove('active');
        google.accounts.id.prompt((notification) => {
            if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                console.warn('Google Sign-In prompt was not displayed/skipped.');
            }
        });
    };
    if (modalGoogleLoginBtn) modalGoogleLoginBtn.onclick = triggerGoogleSignIn;
    if (modalGoogleSignupBtn) modalGoogleSignupBtn.onclick = triggerGoogleSignIn;

    window.onload = function () {
        if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
            google.accounts.id.initialize({
                client_id: GOOGLE_CLIENT_ID,
                callback: handleGoogleCredentialResponse
            });
        } else {
            console.error("Google Identity Services script abhi load nahi hua hai.");
        }
        checkLoginStatus();
        if(ownerInfoEl) setTimeout(() => ownerInfoEl.classList.add('animate-in'), 200);
        if (feedbackFormContainer) setTimeout(() => feedbackFormContainer.classList.add('animate-in'), 300);
        if (feedbackListContainer) setTimeout(() => feedbackListContainer.classList.add('animate-in'), 400);
    };

    async function handleGoogleCredentialResponse(response) {
        try {
            const data = await apiRequest(API_GOOGLE_SIGNIN_URL, 'POST', { token: response.credential });
            if(data) handleAuthResponse(data);
        } catch (error) { }
    }

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
                localStorage.removeItem('authToken');
                currentUser = null;
                updateUIAfterLogout();
            }
        } else {
            updateUIAfterLogout();
        }
        await fetchFeedbacks();
    }

    function updateUIAfterLogin() {
        if (currentUser) {
            if(loginIconTrigger) loginIconTrigger.style.display = 'none';
            if(userAvatarTrigger) userAvatarTrigger.style.display = 'flex';
            if(userAvatarTriggerImg) userAvatarTriggerImg.src = currentUser.avatarUrl || getDiceBearAvatarUrl(currentUser.name);
            userAvatarTrigger.classList.add('avatar-mode');

            if(menuAvatarImg) menuAvatarImg.src = currentUser.avatarUrl || getDiceBearAvatarUrl(currentUser.name);
            if(menuUsernameSpan) menuUsernameSpan.textContent = currentUser.name;
            
            if(nameInputInFeedbackForm) nameInputInFeedbackForm.value = currentUser.name;
            if(feedbackFormUsernameSpan) feedbackFormUsernameSpan.textContent = currentUser.name;
            if(nameInputInFeedbackForm) nameInputInFeedbackForm.disabled = true;
            if(feedbackFormContainer) feedbackFormContainer.style.display = 'block';

            // Disable save changes button initially in profile edit if no file selected
            saveProfileChangesBtn.disabled = true;
        }
    }

    function updateUIAfterLogout() {
        if(loginIconTrigger) loginIconTrigger.style.display = 'flex';
        if(userAvatarTrigger) userAvatarTrigger.style.display = 'none';
        if(userMenu) userMenu.classList.remove('active');
        if(userProfileModal) userProfileModal.classList.remove('active');

        if(feedbackFormContainer) feedbackFormContainer.style.display = 'block';
        if(nameInputInFeedbackForm) {
            nameInputInFeedbackForm.value = '';
            nameInputInFeedbackForm.placeholder = 'Please enter your name...';
            nameInputInFeedbackForm.disabled = false;
        }
        if(feedbackFormUsernameSpan) feedbackFormUsernameSpan.textContent = 'Guest';
        resetFeedbackForm();
    }

    if(menuLogoutLink) {
        menuLogoutLink.addEventListener('click', (e) => {
            e.preventDefault();
            if(userMenu) userMenu.classList.remove('active');
            showStylishPopup('confirm', 'Logout Confirmation', 'Are you sure you want to logout?', {
                isConfirm: true,
                confirmText: 'Logout',
                cancelText: 'Cancel',
                onConfirm: () => {
                    localStorage.removeItem('authToken');
                    currentUser = null;
                    if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
                        google.accounts.id.disableAutoSelect();
                    }
                    updateUIAfterLogout();
                    showStylishPopup('info', 'Logged Out', 'You have been successfully logged out.');
                    fetchFeedbacks();
                }
            });
        });
    }

    if(menuViewProfileLink) {
        menuViewProfileLink.addEventListener('click', (e) => {
            e.preventDefault();
            if(userMenu) userMenu.classList.remove('active');
            if (!currentUser) {
                showStylishPopup('error', 'Login Required', 'Please login to view your profile.');
                return;
            }
            
            profileAvatarDisplay.src = currentUser.avatarUrl || getDiceBearAvatarUrl(currentUser.name);
            profileNameDisplay.textContent = currentUser.name;
            profileEmailDisplay.textContent = currentUser.email;

            profileDisplayArea.style.display = 'block';
            profileEditArea.style.display = 'none';
            profileModalTitle.textContent = 'Your Profile';
            userProfileModal.classList.add('active');
        });
    }

    if(closeProfileViewBtn) {
        closeProfileViewBtn.addEventListener('click', () => {
            userProfileModal.classList.remove('active');
        });
    }

    if(editProfileBtn) {
        editProfileBtn.addEventListener('click', () => {
            if (!currentUser) return;

            currentEditAvatarPreview.src = currentUser.avatarUrl || getDiceBearAvatarUrl(currentUser.name);
            editProfileName.value = currentUser.name;
            editProfileEmail.value = currentUser.email;

            editAvatarUpload.value = '';
            selectedFile = null;
            avatarUploadInProgress = false; // Reset upload flag
            saveProfileChangesBtn.disabled = true; // Disable save button initially in edit mode

            profileDisplayArea.style.display = 'none';
            profileEditArea.style.display = 'block';
            profileModalTitle.textContent = 'Edit Profile';

            if (currentUser.loginMethod === 'google') {
                editAvatarUpload.disabled = true;
                editAvatarUpload.parentElement.classList.add('disabled-upload');
                editAvatarUpload.nextElementSibling.textContent = 'Google users cannot change avatar here.';
                currentEditAvatarPreview.style.border = '4px solid gray';
            } else {
                editAvatarUpload.disabled = false;
                editAvatarUpload.parentElement.classList.remove('disabled-upload');
                editAvatarUpload.nextElementSibling.textContent = 'Click to choose image or drag & drop';
                currentEditAvatarPreview.style.border = '4px solid var(--secondary-color)';
            }
            // Check if name changed to enable save button
            editProfileName.addEventListener('input', updateSaveButtonState);
            updateSaveButtonState(); // Initial check
        });
    }

    if(cancelProfileEditBtn) {
        cancelProfileEditBtn.addEventListener('click', () => {
            profileDisplayArea.style.display = 'block';
            profileEditArea.style.display = 'none';
            profileModalTitle.textContent = 'Your Profile';
        });
    }

    // Function to update Save Changes button state
    function updateSaveButtonState() {
        const newName = editProfileName.value.trim();
        const originalName = currentUser.name;
        
        const nameChanged = newName !== originalName;
        const fileSelected = selectedFile !== null;
        const uploadPending = avatarUploadInProgress; // Check if upload is still in progress

        // Enable button if name changed OR a file is selected and not already uploading
        saveProfileChangesBtn.disabled = !(nameChanged || (fileSelected && !uploadPending));
    }

    if (editAvatarUpload) {
        const avatarUploadSection = editAvatarUpload.parentElement; // The div around input file

        editAvatarUpload.addEventListener('change', async (event) => {
            selectedFile = event.target.files[0];
            if (selectedFile) {
                if (selectedFile.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        currentEditAvatarPreview.src = e.target.result;
                    };
                    reader.readAsDataURL(selectedFile);
                    await uploadAvatarToCloudinary(); // Immediately try to upload
                } else {
                    showStylishPopup('error', 'Invalid File Type', 'Please choose an image file (PNG, JPG, GIF).');
                    selectedFile = null;
                    editAvatarUpload.value = ''; // Clear file input
                    updateSaveButtonState();
                }
            } else {
                selectedFile = null;
                updateSaveButtonState();
            }
        });

        // Drag and drop functionality
        if (avatarUploadSection) {
            avatarUploadSection.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (currentUser.loginMethod !== 'google') avatarUploadSection.style.borderColor = 'var(--accent-color)';
            });
            avatarUploadSection.addEventListener('dragleave', (e) => {
                e.preventDefault();
                if (currentUser.loginMethod !== 'google') avatarUploadSection.style.borderColor = 'var(--card-border)';
            });
            avatarUploadSection.addEventListener('drop', async (e) => {
                e.preventDefault();
                if (currentUser.loginMethod !== 'google') avatarUploadSection.style.borderColor = 'var(--card-border)';
                
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
                        await uploadAvatarToCloudinary(); // Immediately try to upload
                    } else {
                        showStylishPopup('error', 'Invalid File Type', 'Please drop an image file.');
                        selectedFile = null;
                        updateSaveButtonState();
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

    // New function for avatar upload to Cloudinary (client-side direct upload)
    async function uploadAvatarToCloudinary() {
        if (!selectedFile || currentUser.loginMethod === 'google') {
            return;
        }

        avatarUploadInProgress = true;
        updateSaveButtonState(); // Disable save button
        profileLoadingSpinner.style.display = 'block';
        editAvatarUpload.disabled = true; // Disable file input during upload

        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
        formData.append('folder', 'feedback_avatars'); // Optional: specify a folder
        formData.append('gravity', "face");
        formData.append('height', 150);
        formData.append('width', 150);
        formData.append('crop', "thumb");
        formData.append('quality', "auto");
        formData.append('format', "auto");

        const xhr = new XMLHttpRequest();
        xhr.open('POST', CLOUDINARY_API_URL);

        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                stylishPopupMessage.innerHTML = `<p>Uploading avatar... ${percent}%</p>`;
                stylishPopupIcon.className = 'popup-icon-area info';
                stylishPopupIcon.innerHTML = `<i class="fas fa-sync fa-spin"></i>`; // Spinner icon
                if(!stylishPopupOverlay.classList.contains('active')) {
                    showStylishPopup('info', 'Uploading Avatar', `Uploading avatar... ${percent}%`, { confirmText: 'OK', isConfirm: false });
                }
            }
        });

        xhr.onload = async () => {
            profileLoadingSpinner.style.display = 'none';
            editAvatarUpload.disabled = false;
            avatarUploadInProgress = false;

            if (xhr.status === 200) {
                const uploadData = JSON.parse(xhr.responseText);
                if (uploadData && uploadData.secure_url) {
                    showStylishPopup('success', 'Upload Complete!', 'Avatar uploaded successfully!');
                    // Update currentEditAvatarPreview with the new URL
                    currentEditAvatarPreview.src = uploadData.secure_url;
                    // We don't save to `currentUser` yet, only when Save Changes is clicked
                    // Set a temporary URL on selectedFile to be sent to server later
                    selectedFile.cloudinaryUrl = uploadData.secure_url;
                    updateSaveButtonState(); // Re-enable save button
                } else {
                    showStylishPopup('error', 'Upload Failed', 'Cloudinary response missing URL.');
                    selectedFile = null;
                    currentEditAvatarPreview.src = currentUser.avatarUrl || getDiceBearAvatarUrl(currentUser.name); // Revert preview
                    updateSaveButtonState();
                }
            } else {
                const errorData = JSON.parse(xhr.responseText);
                showStylishPopup('error', 'Upload Error', errorData.error?.message || `Avatar upload failed: ${xhr.statusText}`);
                selectedFile = null;
                currentEditAvatarPreview.src = currentUser.avatarUrl || getDiceBearAvatarUrl(currentUser.name);
                updateSaveButtonState();
            }
        };

        xhr.onerror = () => {
            profileLoadingSpinner.style.display = 'none';
            editAvatarUpload.disabled = false;
            avatarUploadInProgress = false;
            showStylishPopup('error', 'Network Error', 'Could not connect to Cloudinary. Check your internet.');
            selectedFile = null;
            currentEditAvatarPreview.src = currentUser.avatarUrl || getDiceBearAvatarUrl(currentUser.name);
            updateSaveButtonState();
        };

        xhr.send(formData);
    }


    // Save Profile Changes Button
    if(saveProfileChangesBtn) {
        saveProfileChangesBtn.addEventListener('click', async () => {
            if (!currentUser) return;

            const newName = editProfileName.value.trim();
            const originalName = currentUser.name;
            let newAvatarUrl = currentEditAvatarPreview.src; // Get URL from preview

            let nameChanged = newName !== originalName;
            let avatarChanged = selectedFile && selectedFile.cloudinaryUrl; // Check if file was selected AND successfully uploaded to Cloudinary

            if (!nameChanged && !avatarChanged) {
                userProfileModal.classList.remove('active');
                return showStylishPopup('info', 'No Changes', 'No changes detected.');
            }
            if (newName === '') {
                return showStylishPopup('error', 'Name Required', 'Name cannot be empty.');
            }
            if (avatarUploadInProgress) {
                return showStylishPopup('warning', 'Upload Pending', 'Please wait for avatar upload to complete before saving changes.');
            }

            profileLoadingSpinner.style.display = 'block';
            saveProfileChangesBtn.disabled = true;
            saveProfileChangesBtn.textContent = 'Saving...';

            try {
                // If avatar was changed and uploaded, use that URL. Otherwise, use existing one.
                const finalAvatarUrl = avatarChanged ? selectedFile.cloudinaryUrl : currentUser.avatarUrl;

                const updatePayload = {
                    name: newName,
                    avatarUrl: finalAvatarUrl
                };

                const updateData = await apiRequest(API_UPDATE_USER_PROFILE_URL, 'PUT', updatePayload);
                
                if(updateData) {
                    currentUser.name = updateData.user.name;
                    currentUser.avatarUrl = updateData.user.avatarUrl;
                    localStorage.setItem('authToken', updateData.token);

                    updateUIAfterLogin();
                    
                    userProfileModal.classList.remove('active');
                    showStylishPopup('success', 'Profile Updated!', 'Your profile has been updated successfully!');
                    await fetchFeedbacks();
                }

            } catch (error) {
                console.error('Profile update error:', error);
            } finally {
                profileLoadingSpinner.style.display = 'none';
                saveProfileChangesBtn.disabled = false;
                saveProfileChangesBtn.textContent = 'Save Changes';
                selectedFile = null; // Clear selected file after attempt
                avatarUploadInProgress = false; // Reset flag
            }
        });
    }

    // Star Rating Logic
    function updateStarVisuals(ratingToShow) {
        starsElements.forEach(star => {
            const val = parseInt(star.getAttribute('data-value'));
            star.classList.toggle('selected', val <= ratingToShow);
            star.classList.remove('highlighted');
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
            starsElements.forEach(s => s.classList.remove('highlighted'));
            updateStarVisuals(currentSelectedRating);
        });
    });
    
    async function fetchFeedbacks() {
         try {
            const data = await apiRequest(API_FETCH_FEEDBACKS_URL, 'GET', null, true);
            const h2Title = feedbackListContainer.querySelector('h2');
            feedbackListContainer.innerHTML = '';
            feedbackListContainer.appendChild(averageRatingDisplayEl);
            if(h2Title) feedbackListContainer.appendChild(h2Title);

            if (data.length === 0) {
                const msgP = document.createElement('p');
                msgP.textContent = 'No feedback yet. Be the first one!';
                msgP.style.textAlign='center';
                msgP.style.padding='20px';
                feedbackListContainer.appendChild(msgP);
                updateAverageRating(0, 0);
            } else {
                const totalRatings = data.reduce((sum, fb) => sum + fb.rating, 0);
                const average = totalRatings / data.length;
                updateAverageRating(average, data.length);
                data.forEach((fb, index) => addFeedbackToDOM(fb, index));
            }
        } catch (err) { }
    }

    function updateAverageRating(avg, count) {
        const avgNum = parseFloat(avg);
        let starsHtml = '☆☆☆☆☆';
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
        setTimeout(() => {
            const avgContainer = averageRatingDisplayEl.querySelector('.average-rating-container');
            if (avgContainer && !avgContainer.classList.contains('animate-in')) {
                avgContainer.classList.add('animate-in');
            }
        }, 50);
    }
    
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
        if (!currentUser) {
            showStylishPopup('warning', 'Login Required', 'Please login via the icon to submit feedback.');
            return;
        }

        let feedbackPayload = { feedback: feedbackContent, rating: parseInt(ratingValue) };
        const url = isEditing ? `${API_FEEDBACK_URL}/${currentEditFeedbackId}` : API_FEEDBACK_URL;
        const method = isEditing ? 'PUT' : 'POST';

        try {
            const data = await apiRequest(url, method, feedbackPayload);
            if(data) {
                showStylishPopup('success', isEditing ? 'Feedback Updated!' : 'Feedback Submitted!', data.message);
                resetFeedbackForm();
                await fetchFeedbacks();
            }
        } catch (error) { }
        finally {
            submitButton.disabled = false;
            submitButton.textContent = isEditing ? "UPDATE FEEDBACK" : "SUBMIT FEEDBACK";
        }
    });

    function resetFeedbackForm() {
        if (currentUser) {
            nameInputInFeedbackForm.value = currentUser.name;
            feedbackFormUsernameSpan.textContent = currentUser.name;
            nameInputInFeedbackForm.disabled = true;
        } else {
            nameInputInFeedbackForm.value = '';
            feedbackFormUsernameSpan.textContent = 'Guest';
            nameInputInFeedbackForm.disabled = false;
            nameInputInFeedbackForm.placeholder = 'Your name here...';
        }
        feedbackTextarea.value = '';
        ratingInput.value = '0';
        currentSelectedRating = 0;
        updateStarVisuals(0);
        submitButton.textContent = 'SUBMIT FEEDBACK';
        isEditing = false;
        currentEditFeedbackId = null;
    }

    function getDiceBearAvatarUrl(name, randomSeed = '') {
        const seedName = (typeof name === 'string' && name) ? name.toLowerCase() : 'default_seed';
        const seed = encodeURIComponent(seedName + randomSeed);
        return `https://api.dicebear.com/8.x/adventurer/svg?seed=${seed}&flip=true&radius=50&doodle=true&scale=90`;
    }

    function addFeedbackToDOM(fbData, index) {
        const item = document.createElement('div');
        item.className = 'feedback-item';
        item.dataset.feedbackId = fbData._id;

        const avatarImg = document.createElement('img');
        avatarImg.className = 'avatar-img';
        avatarImg.src = fbData.avatarUrl || getDiceBearAvatarUrl(fbData.name);
        avatarImg.alt = (fbData.name && fbData.name.length > 0 ? fbData.name.charAt(0).toUpperCase() : 'X');
        avatarImg.onerror = function() {
            this.src = getDiceBearAvatarUrl(fbData.name);
        };

        const detailsDiv = document.createElement('div');
        detailsDiv.className = 'feedback-details';

        const strongName = document.createElement('strong'); 
        let nameContent = fbData.name;
        let userTypeTag = '';
        if (fbData.googleIdSubmitter) {
            userTypeTag = `<span class="user-type-indicator google-user-indicator" title="Google User">G</span>`;
        } else if (fbData.userId) {
            userTypeTag = `<span class="user-type-indicator email-user-indicator" title="Email User">E</span>`;
        } else {
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
            timestampDiv.textContent = `Posted: ${new Date(fbData.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}`;
        } catch(e) { 
            timestampDiv.textContent = `Posted: ${new Date(fbData.timestamp).toLocaleString('en-US')}`;
        }

        detailsDiv.append(strongName, starsDiv, pFeedback, timestampDiv);

        const editButton = document.createElement('button');
        editButton.className = 'edit-feedback-btn';
        editButton.innerHTML = '<i class="fas fa-pencil-alt"></i>';
        editButton.title = 'Edit this feedback';
        editButton.disabled = !(currentUser && currentUser.userId === fbData.userId);

        editButton.addEventListener('click', (event) => { 
            event.stopPropagation();
            if (!currentUser || currentUser.userId !== fbData.userId) {
                return showStylishPopup('error', 'Permission Denied!', 'You can only edit your own feedback.');
            }
            showStylishPopup('info', 'Edit Feedback', 'Edit your feedback in the form below.');
            nameInputInFeedbackForm.value = fbData.name;
            feedbackFormUsernameSpan.textContent = fbData.name;
            nameInputInFeedbackForm.disabled = true;
            
            feedbackTextarea.value = fbData.feedback;
            currentSelectedRating = fbData.rating;
            ratingInput.value = fbData.rating;
            updateStarVisuals(fbData.rating);

            submitButton.textContent = 'UPDATE FEEDBACK';
            isEditing = true;
            currentEditFeedbackId = fbData._id;

            if(feedbackFormContainer) {
                feedbackFormContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
        item.appendChild(editButton);


        if (fbData.replies && fbData.replies.length > 0) { 
            const latestReply = fbData.replies[fbData.replies.length - 1];
            if (latestReply && latestReply.text) {
                const adminReplyDiv = document.createElement('div');
                adminReplyDiv.className = 'admin-reply';

                const adminAvatar = document.createElement('img');
                adminAvatar.className = 'admin-reply-avatar';
                adminAvatar.src = 'https://i.ibb.co/FsSs4SG/creator-avatar.png';
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
        if(feedbackListContainer.querySelector(`[data-feedback-id="${fbData._id}"]`)) {
        } else {
            feedbackListContainer.appendChild(item);
        }
    }
    
    updateUIAfterLogout();
    checkLoginStatus();
});
// === END: JavaScript Code ===