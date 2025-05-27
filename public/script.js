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
    
    // Page Content Elements
    const ownerInfoEl = document.querySelector('.owner-info');
    const feedbackFormContainer = document.getElementById('feedback-form-container');
    const feedbackListContainer = document.getElementById('feedback-list-container'); // This is the overall panel
    const nameInputInFeedbackForm = document.getElementById('name'); // The name input in the main feedback form
    const feedbackFormUsernameSpan = document.getElementById('feedback-form-username');
    const feedbackTextarea = document.getElementById('feedback');
    const ratingInput = document.getElementById('rating');
    const submitButton = document.getElementById('submit-feedback');
    const starsElements = document.querySelectorAll('.star');
    const mainTitle = document.getElementById('main-title'); // For Typed.js
    
    // New Feedback Panel Elements
    const overallAvgRatingEl = document.getElementById('overall-avg-rating');
    const overallAvgStarsEl = document.getElementById('overall-avg-stars');
    const overallTotalCountEl = document.getElementById('overall-total-count');
    const feedbackItemsContainer = document.getElementById('feedback-items-container');

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
        });
    }
    // Show/hide user menu when user avatar is clicked
    if (userAvatarTrigger) {
        userAvatarTrigger.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent document click from immediately closing it
            if (userMenu) { userMenu.classList.toggle('active'); console.log("User menu toggled"); }
            if (loginModal) loginModal.classList.remove('active'); // Close login modal if open
        });
    }
    // Close user menu when clicking anywhere else on the document
    document.addEventListener('click', (e) => { 
        if (userMenu && userMenu.classList.contains('active') && userAvatarTrigger && !userAvatarTrigger.contains(e.target) && !userMenu.contains(e.target)) {
            userMenu.classList.remove('active');
        }
    });
    // Close auth modals when clicking outside or on close button
    [loginModal, signupModal].forEach(modal => {
        if (modal) {
            modal.addEventListener('click', e => {
                if (e.target === modal) modal.classList.remove('active');
            });
            const closeBtn = modal.querySelector('.close-modal-btn');
            if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.remove('active'));
        }
    });
    
    // Helper for API requests
    async function apiRequest(url, method, body = null) {
        const headers = { 'Content-Type': 'application/json' };
        const token = localStorage.getItem('authToken');
        if (token) headers['Authorization'] = `Bearer ${token}`;

        // Select the correct submit button to disable/enable
        let submitBtn; 
        if(body && (url.includes('/api/auth/login'))) submitBtn = emailLoginForm.querySelector('button[type="submit"]');
        if(body && (url.includes('/api/auth/signup'))) submitBtn = emailSignupForm.querySelector('button[type="submit"]');
        
        try {
            const response = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : null });
            const data = await response.json(); 
            if (!response.ok) throw new Error(data.message || `Server error (${response.status})`);
            return data;
        } catch (error) { 
            console.error(`API request error to ${url}:`, error); 
            // Don't show popup for token validation failure on page load, it's handled by checkLoginStatus
            if (!(url.includes('/api/auth/me') && error.message && error.message.toLowerCase().includes("token valid nahi hai"))) {
                showStylishPopup('error', 'Error', error.message || 'Server communication error.');
            }
            if(submitBtn) { // Re-enable button on error
                submitBtn.disabled = false; 
                if(url.includes('login')) submitBtn.textContent = "Login";
                else if(url.includes('signup')) submitBtn.textContent = "Sign Up";
            }
            throw error; // Re-throw to be caught by specific handlers if needed
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
            const submitBtn = emailLoginForm.querySelector('button[type="submit"]');
            if(submitBtn) {submitBtn.disabled = true; submitBtn.textContent="Logging in...";}
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
            const submitBtn = emailSignupForm.querySelector('button[type="submit"]');
            if(submitBtn) {submitBtn.disabled = true; submitBtn.textContent="Signing up...";}
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
            if(userAvatarTrigger) userAvatarTrigger.style.display = 'flex';
            if(userAvatarTriggerImg) userAvatarTriggerImg.src = currentUser.avatarUrl || `https://via.placeholder.com/48/FFFFFF/6a0dad?text=${encodeURIComponent(currentUser.name.charAt(0))}`;
            
            if(menuAvatarImg) menuAvatarImg.src = currentUser.avatarUrl || `https://via.placeholder.com/60/FFFFFF/6a0dad?text=${encodeURIComponent(currentUser.name.charAt(0))}`;
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

        if(feedbackFormContainer) feedbackFormContainer.style.display = 'block'; // Form always visible
        if(nameInputInFeedbackForm) {
            nameInputInFeedbackForm.value = ''; 
            nameInputInFeedbackForm.placeholder = 'Please enter your name...';
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
    // View Profile (placeholder for future feature)
    if(menuViewProfileLink) {
        menuViewProfileLink.addEventListener('click', (e) => {
            e.preventDefault();
            if(userMenu) userMenu.classList.remove('active');
            showStylishPopup('info', 'Profile Feature', 'Your profile editing section will be available here soon!');
        });
    }
    
    // Typed.js for main title and subtitle
    if (mainTitle) {
         new Typed('#main-title', {
            strings: ["✨ NOBITA's Feedback Portal ✨", "🚀 Share Your Valuable Thoughts 🚀", "💡 Help Us Improve! 💡"],
            typeSpeed: 50,
            backSpeed: 25,
            loop: true,
            startDelay: 500,
            smartBackspace: true // Only backspace what Typed.js typed
         });
         new Typed('#typed-output', {
            strings: ["Your feedback is precious to us!", "With your opinion, we will improve.", "Every star is important to us!"],
            typeSpeed: 45,
            backSpeed: 20,
            loop: true,
            startDelay: 1500, // Start a bit after the main title
            showCursor: false // Hide the cursor for this one
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
            
            feedbackItemsContainer.innerHTML = ''; // Clear previous feedbacks

            if (data.length === 0) {
                const msgP = document.createElement('p');
                msgP.textContent = 'No feedback yet. Be the first one!';
                msgP.style.textAlign='center';
                msgP.style.padding='20px';
                feedbackItemsContainer.appendChild(msgP);
                updateOverallRating(0, 0); // Display 0 average if no feedbacks
            } else {
                const totalRatings = data.reduce((sum, fb) => sum + fb.rating, 0);
                const average = totalRatings / data.length;
                updateOverallRating(average, data.length);
                data.forEach((fb, index) => addFeedbackToDOM(fb, index));
            }
        } catch (err) {
            // Error handled by apiRequest function
            updateOverallRating(0, 0); // Reset overall rating on error
            feedbackItemsContainer.innerHTML = '<p style="text-align:center; padding:20px; color:var(--error-color);">Failed to load feedbacks. Please try again later.</p>';
        }
    }

    // Update Overall Rating Display
    function updateOverallRating(avg, count) {
        const avgNum = parseFloat(avg);
        overallAvgRatingEl.textContent = `${isNaN(avgNum) ? '0.0' : avgNum.toFixed(1)} / 5`;
        overallTotalCountEl.textContent = `${count} Reviews`;

        overallAvgStarsEl.innerHTML = ''; // Clear previous stars
        if (!isNaN(avgNum) && avgNum > 0) {
            const fullStars = Math.floor(avgNum);
            const halfStar = avgNum - fullStars >= 0.5;
            const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);

            for (let i = 0; i < fullStars; i++) {
                const star = document.createElement('i');
                star.className = 'fas fa-star';
                overallAvgStarsEl.appendChild(star);
            }
            if (halfStar) {
                const star = document.createElement('i');
                star.className = 'fas fa-star-half-alt';
                overallAvgStarsEl.appendChild(star);
            }
            for (let i = 0; i < emptyStars; i++) {
                const star = document.createElement('i');
                star.className = 'far fa-star'; // Use far for outline star
                overallAvgStarsEl.appendChild(star);
            }
        } else {
             for (let i = 0; i < 5; i++) {
                const star = document.createElement('i');
                star.className = 'far fa-star';
                overallAvgStarsEl.appendChild(star);
            }
        }
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
            showStylishPopup('success', isEditing ? 'Feedback Updated!' : 'Feedback Submitted!', data.message); 
            resetFeedbackForm(); // Clear form after submission/edit
            await fetchFeedbacks(); // Refresh feedbacks to show new/updated one
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

    // Add Feedback to DOM
    function addFeedbackToDOM(fbData, index) {
        const item = document.createElement('div');
        item.className = 'feedback-item';
        item.dataset.feedbackId = fbData._id; // Store ID for potential updates/deletions

        const avatarImgContainer = document.createElement('div');
        avatarImgContainer.className = 'user-avatar';
        const avatarImg = document.createElement('img');
        avatarImg.src = fbData.avatarUrl || `https://via.placeholder.com/55/6a0dad/FFFFFF?text=${encodeURIComponent(fbData.name && fbData.name.length > 0 ? fbData.name.charAt(0).toUpperCase() : 'X')}`;
        avatarImg.alt = (fbData.name && fbData.name.length > 0 ? fbData.name.charAt(0).toUpperCase() : 'X');
        // Fallback for broken image links
        avatarImg.onerror = function() {
            this.src = `https://via.placeholder.com/55/6a0dad/FFFFFF?text=${encodeURIComponent(fbData.name && fbData.name.length > 0 ? fbData.name.charAt(0).toUpperCase() : 'X')}`;
        };
        avatarImgContainer.appendChild(avatarImg);

        const detailsDiv = document.createElement('div');
        detailsDiv.className = 'feedback-content';

        const headerDiv = document.createElement('div');
        headerDiv.className = 'feedback-header';
        const userNameSpan = document.createElement('span');
        userNameSpan.className = 'user-name';
        userNameSpan.textContent = fbData.name;
        headerDiv.appendChild(userNameSpan);

        // Add verified tick only for logged-in users who submitted it
        // The server response includes userId and loginMethod, so we can check if it was a registered user
        // Note: The server.js code now saves loginMethod to feedback, so fbData.loginMethod will be available.
        if (fbData.loginMethod && fbData.loginMethod !== 'guest') {
            const verifiedIcon = document.createElement('i');
            verifiedIcon.className = 'fas fa-check-circle verified';
            verifiedIcon.title = `Verified ${fbData.loginMethod === 'google' ? 'Google' : 'Email'} User`;
            headerDiv.appendChild(verifiedIcon);
        }
        
        const userStarsDiv = document.createElement('div');
        userStarsDiv.className = 'user-stars';
        for(let i=0; i<5; i++) {
            const star = document.createElement('i');
            star.className = i < fbData.rating ? 'fas fa-star' : 'far fa-star';
            userStarsDiv.appendChild(star);
        }
        headerDiv.appendChild(userStarsDiv);
        detailsDiv.appendChild(headerDiv);

        if (fbData.isEdited) {
            const editedNote = document.createElement('div');
            editedNote.className = 'edited-note';
            // Kolkata time zone for edited note
            editedNote.innerHTML = `✎ Edited on ${new Date(fbData.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' })}`;
            detailsDiv.appendChild(editedNote);
        }

        const feedbackTextDiv = document.createElement('div');
        feedbackTextDiv.className = 'feedback-text';
        feedbackTextDiv.textContent = fbData.feedback;
        detailsDiv.appendChild(feedbackTextDiv);

        // Admin Reply (if exists)
        if (fbData.replies && fbData.replies.length > 0) { 
            const latestReply = fbData.replies[fbData.replies.length - 1]; // Get the most recent reply
            if (latestReply && latestReply.text) {
                const adminReplyDiv = document.createElement('div');
                adminReplyDiv.className = 'admin-reply';

                const adminMetaDiv = document.createElement('div');
                adminMetaDiv.className = 'admin-meta';

                const adminAvatarContainer = document.createElement('div');
                adminAvatarContainer.className = 'admin-avatar';
                const adminAvatarImg = document.createElement('img');
                adminAvatarImg.src = 'https://i.ibb.co/FsSs4SG/creator-avatar.png'; // Nobita's avatar
                adminAvatarImg.alt = 'Nobita';
                adminAvatarContainer.appendChild(adminAvatarImg);
                adminMetaDiv.appendChild(adminAvatarContainer);

                const adminNameSpan = document.createElement('span');
                adminNameSpan.className = 'admin-name';
                adminNameSpan.textContent = latestReply.adminName || 'Admin';
                adminMetaDiv.appendChild(adminNameSpan);

                const timestampSpan = document.createElement('span');
                timestampSpan.className = 'timestamp';
                try {
                    timestampSpan.textContent = new Date(latestReply.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
                } catch(e) {
                    timestampSpan.textContent = new Date(latestReply.timestamp).toLocaleString('en-US'); // Fallback
                }
                adminMetaDiv.appendChild(timestampSpan);
                adminReplyDiv.appendChild(adminMetaDiv);

                const replyTextDiv = document.createElement('div');
                replyTextDiv.className = 'reply-text';
                replyTextDiv.textContent = latestReply.text;
                adminReplyDiv.appendChild(replyTextDiv);
                
                detailsDiv.appendChild(adminReplyDiv);
            }
        }

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

        item.append(avatarImgContainer, detailsDiv); 
        feedbackItemsContainer.appendChild(item);
    }
    
    // Initial calls on load
    updateUIAfterLogout(); // Set initial UI state (guest mode)
    checkLoginStatus(); // Check if user is already logged in via token
});
// === END: JavaScript Code ===