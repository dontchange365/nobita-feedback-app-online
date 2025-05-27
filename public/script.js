// === START: JavaScript Code ===
document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOM Fully Loaded and Parsed");

    // Assuming GOOGLE_CLIENT_ID is hardcoded here or loaded from a meta tag
    // IMPORTANT: Replace with your actual Google Client ID
    const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com'; 
    // Check if the hardcoded GOOGLE_CLIENT_ID is the placeholder, and warn if so.
    if (GOOGLE_CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com') {
        console.warn("WARNING: GOOGLE_CLIENT_ID is not set in script.js. Google Sign-In will not work. Please replace 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com' with your actual client ID.");
    }
    
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
    const feedbackListContainerElement = document.getElementById('feedback-list-container'); // Renamed to avoid conflict
    const averageRatingDisplayEl = document.getElementById('average-rating-display');
    const nameInputInFeedbackForm = document.getElementById('name'); // The name input in the main feedback form
    const feedbackFormUsernameSpan = document.getElementById('feedback-form-username');
    const feedbackTextarea = document.getElementById('feedback');
    const ratingInput = document.getElementById('rating');
    const submitButton = document.getElementById('submit-feedback');
    const starsElements = document.querySelectorAll('.star');
    const mainTitle = document.getElementById('main-title'); // For Typed.js
    const typedOutputElement = document.getElementById('typed-output'); // For Typed.js
    
    let currentUser = null; // Stores current logged-in user data
    let currentSelectedRating = 0;
    let isEditing = false;
    let currentEditFeedbackId = null;

    // API Endpoints
    const BASE_API_URL = window.location.origin; // Assumes frontend and backend are same origin
    const API_SIGNUP_URL = `${BASE_API_URL}/api/auth/signup`;
    const API_LOGIN_URL = `${BASE_API_URL}/api/auth/login`;
    const API_GOOGLE_SIGNIN_URL = `${BASE_API_URL}/api/auth/google-signin`;
    const API_VALIDATE_TOKEN_URL = `${BASE_API_URL}/api/auth/me`;
    const API_REQUEST_RESET_URL = `${BASE_API_URL}/api/auth/request-password-reset`;
    const API_FEEDBACK_URL = `${BASE_API_URL}/api/feedback`; // For POST and PUT feedback
    const API_FETCH_FEEDBACKS_URL = `${BASE_API_URL}/api/feedbacks`; // For GET all feedbacks

    // --- Stylish Popup Functionality ---
    function showStylishPopup(type, title, message, options = {}) {
        console.log("[showStylishPopup] Called. Type:", type, "Title:", title);
        if(!stylishPopupOverlay || !stylishPopupTitle || !stylishPopupMessage || !stylishPopupIcon || !stylishPopupButtonContainer) { 
            console.error("Stylish popup core HTML elements not found!"); 
            alert(`${title}: ${message.replace(/<p>|<\/p>/gi, "\n")}`); 
            return; 
        }

        stylishPopupIcon.className = 'popup-icon-area'; 
        stylishPopupIcon.innerHTML = ''; 
        const iconsFA = {
            'success': '<i class="fas fa-check-circle"></i>', 'error': '<i class="fas fa-times-circle"></i>',
            'info': '<i class="fas fa-info-circle"></i>', 'warning':'<i class="fas fa-exclamation-triangle"></i>',
            'confirm': '<i class="fas fa-question-circle"></i>', 'forgot_password': '<i class="fas fa-key"></i>'
        };
        if(iconsFA[type]) {
            stylishPopupIcon.innerHTML = iconsFA[type];
            stylishPopupIcon.classList.add(type); 
        }

        stylishPopupTitle.textContent = title;
        stylishPopupMessage.innerHTML = `<p>${message}</p>`; 

        if (options.formHTML) {
            stylishPopupFormArea.innerHTML = options.formHTML;
            stylishPopupFormArea.style.display = 'block';
        } else {
            stylishPopupFormArea.innerHTML = '';
            stylishPopupFormArea.style.display = 'none';
        }
        
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
            confirmBtn.textContent = options.confirmText || 'Confirm';
            confirmBtn.className = 'popup-button primary';
            confirmBtn.id = 'stylishPopupPrimaryActionBtn'; 
            confirmBtn.onclick = () => {
                if (options.onConfirm) options.onConfirm();
                else stylishPopupOverlay.classList.remove('active'); 
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
        console.log("[showStylishPopup] 'active' class added. Overlay display:", getComputedStyle(stylishPopupOverlay).display);
    }

    if(closeStylishPopupBtn) {
        closeStylishPopupBtn.addEventListener('click', () => {
            if(stylishPopupOverlay) stylishPopupOverlay.classList.remove('active');
        });
    }
    if(stylishPopupOverlay) {
        stylishPopupOverlay.addEventListener('click', e => { 
            if (e.target === stylishPopupOverlay) { 
                stylishPopupOverlay.classList.remove('active');
            }
        });
    }

    // --- New UI Trigger Logic & Modal Control ---
    if (loginIconTrigger) {
        loginIconTrigger.addEventListener('click', (e) => {
            e.stopPropagation(); 
            if (loginModal) { loginModal.classList.add('active'); console.log("Login modal activated"); }
            if (userMenu) userMenu.classList.remove('active'); 
        });
    }
    if (userAvatarTrigger) {
        userAvatarTrigger.addEventListener('click', (e) => {
            e.stopPropagation(); 
            if (userMenu) { userMenu.classList.toggle('active'); console.log("User menu toggled"); }
            if (loginModal) loginModal.classList.remove('active'); 
        });
    }
    document.addEventListener('click', (e) => { 
        if (userMenu && userMenu.classList.contains('active') && userAvatarTrigger && !userAvatarTrigger.contains(e.target) && !userMenu.contains(e.target)) {
            userMenu.classList.remove('active');
        }
    });
    [loginModal, signupModal].forEach(modal => {
        if (modal) {
            modal.addEventListener('click', e => {
                if (e.target === modal) modal.classList.remove('active');
            });
            const closeBtn = modal.querySelector('.close-modal-btn');
            if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.remove('active'));
        }
    });
    
    async function apiRequest(url, method, body = null, isGetRequest = false) {
        const headers = { 'Content-Type': 'application/json' };
        const token = localStorage.getItem('authToken');
        if (token) headers['Authorization'] = `Bearer ${token}`;

        let submitBtnToManage; 
        if(emailLoginForm && emailLoginForm.contains(document.activeElement) && document.activeElement.tagName === 'BUTTON') submitBtnToManage = emailLoginForm.querySelector('button[type="submit"]');
        if(emailSignupForm && emailSignupForm.contains(document.activeElement) && document.activeElement.tagName === 'BUTTON') submitBtnToManage = emailSignupForm.querySelector('button[type="submit"]');
        
        if(submitBtnToManage) {submitBtnToManage.disabled = true; submitBtnToManage.dataset.originalText = submitBtnToManage.textContent; submitBtnToManage.textContent="Processing...";}

        try {
            const response = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : null });
            const data = await response.json(); 
            if (!response.ok) throw new Error(data.message || `Server error (${response.status})`);
            if(submitBtnToManage) {submitBtnToManage.disabled = false; submitBtnToManage.textContent = submitBtnToManage.dataset.originalText || "Submit";}
            return data;
        } catch (error) { 
            console.error(`API request error to ${url}:`, error); 
            if (!(url.includes('/api/auth/me') && error.message && error.message.toLowerCase().includes("token valid nahi hai"))) {
                showStylishPopup('error', 'Error', error.message || 'Server communication error.');
            }
            if(submitBtnToManage) { 
                submitBtnToManage.disabled = false; 
                submitBtnToManage.textContent = submitBtnToManage.dataset.originalText || (url.includes('login') ? "Login" : (url.includes('signup') ? "Sign Up" : "Submit"));
            }
            throw error; 
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
            if (!email || !password) return showStylishPopup('error', 'Empty Fields!', 'Please enter both email and password.');
            try {
                const data = await apiRequest(API_LOGIN_URL, 'POST', { email, password });
                handleAuthResponse(data);
            } catch (error) { /* Handled by apiRequest */ }
        });
    }

    if (emailSignupForm) {
        emailSignupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = modalSignupNameInput.value.trim();
            const email = modalSignupEmailInput.value.trim();
            const password = modalSignupPasswordInput.value;
            const confirmPassword = modalSignupConfirmPasswordInput.value;
            if (!name || !email || !password || !confirmPassword) return showStylishPopup('error', 'Empty Fields!', 'Please fill all fields.');
            if (password !== confirmPassword) return showStylishPopup('error', 'Password Mismatch!', 'Passwords do not match.');
            if (password.length < 6) return showStylishPopup('error', 'Weak Password!', 'Password must be at least 6 characters.');
            try {
                const data = await apiRequest(API_SIGNUP_URL, 'POST', { name, email, password });
                handleAuthResponse(data);
            } catch (error) { /* Handled by apiRequest */ }
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
                    isConfirm: true, confirmText: 'Send Reset Link', cancelText: 'Cancel',
                    onConfirm: async () => {
                        const forgotEmailVal = document.getElementById('popup-forgot-email').value.trim();
                        if (!forgotEmailVal) {
                            stylishPopupMessage.innerHTML = '<p style="color:var(--error-color); margin-bottom:10px;">Email address is required.</p>' + 
                                                            'Enter your registered email address. We will send you a link to reset your password.';
                            document.getElementById('popup-forgot-email').focus();
                            return; 
                        }
                        const primaryBtn = stylishPopupCard.querySelector('#stylishPopupPrimaryActionBtn');
                        if(primaryBtn) {primaryBtn.disabled = true; primaryBtn.textContent = "Sending...";}
                        try {
                            const data = await apiRequest(API_REQUEST_RESET_URL, 'POST', { email: forgotEmailVal });
                            stylishPopupOverlay.classList.remove('active'); 
                            showStylishPopup('success', 'Link Sent!', data.message);
                        } catch (error) {
                            if(primaryBtn) {primaryBtn.disabled = false; primaryBtn.textContent = "Send Reset Link";}
                        }
                    }
                }
            );
        });
    }

    const triggerGoogleSignIn = () => {
        if (loginModal) loginModal.classList.remove('active');
        if (signupModal) signupModal.classList.remove('active');
        if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
            google.accounts.id.prompt((notification) => {
                if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                    console.warn('Google Sign-In prompt was not displayed/skipped.');
                     showStylishPopup('info', 'Google Sign-In', 'Google Sign-In prompt was not displayed. This might be due to popup blockers or previous choices. Please try again or ensure popups are enabled.');
                }
            });
        } else {
            showStylishPopup('error', 'Google Sign-In Error', 'Google Sign-In library not loaded. Please check your internet connection or try refreshing the page.');
            console.error("Google Identity Services script not loaded for triggerGoogleSignIn.");
        }
    };
    if (modalGoogleLoginBtn) modalGoogleLoginBtn.onclick = triggerGoogleSignIn;
    if (modalGoogleSignupBtn) modalGoogleSignupBtn.onclick = triggerGoogleSignIn;

    // Google Sign-In initialization is now part of window.onload
    
    async function handleGoogleCredentialResponse(response) {
        try {
            const data = await apiRequest(API_GOOGLE_SIGNIN_URL, 'POST', { token: response.credential });
            handleAuthResponse(data);
        } catch (error) { /* Handled by apiRequest */ }
    }

    async function checkLoginStatus() {
        const token = localStorage.getItem('authToken');
        if (token) {
            try {
                const userData = await apiRequest(API_VALIDATE_TOKEN_URL, 'GET', null, true);
                currentUser = userData;
                updateUIAfterLogin();
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
            if(userAvatarTriggerImg) userAvatarTriggerImg.src = currentUser.avatarUrl || `https://via.placeholder.com/48/FFFFFF/6a0dad?text=${encodeURIComponent(currentUser.name.charAt(0))}`;
            
            if(menuAvatarImg) menuAvatarImg.src = currentUser.avatarUrl || `https://via.placeholder.com/60/FFFFFF/6a0dad?text=${encodeURIComponent(currentUser.name.charAt(0))}`;
            if(menuUsernameSpan) menuUsernameSpan.textContent = currentUser.name;
            
            if(nameInputInFeedbackForm) nameInputInFeedbackForm.value = currentUser.name; 
            if(feedbackFormUsernameSpan) feedbackFormUsernameSpan.textContent = currentUser.name; 
            if(nameInputInFeedbackForm) nameInputInFeedbackForm.disabled = true; 
            if(feedbackFormContainer) feedbackFormContainer.style.display = 'block'; 
        }
    }

    function updateUIAfterLogout() {
        if(loginIconTrigger) loginIconTrigger.style.display = 'flex';
        if(userAvatarTrigger) userAvatarTrigger.style.display = 'none';
        if(userMenu) userMenu.classList.remove('active'); 

        if(feedbackFormContainer) feedbackFormContainer.style.display = 'block'; 
        if(nameInputInFeedbackForm) {
            nameInputInFeedbackForm.value = ''; 
            nameInputInFeedbackForm.placeholder = 'Please login to submit feedback...'; // Updated placeholder
            nameInputInFeedbackForm.disabled = true; // Keep disabled for guests, encourage login
        }
        if(feedbackFormUsernameSpan) feedbackFormUsernameSpan.textContent = 'Guest'; 
    }

    if(menuLogoutLink) {
        menuLogoutLink.addEventListener('click', (e) => {
            e.preventDefault();
            if(userMenu) userMenu.classList.remove('active'); 
            showStylishPopup('confirm', 'Logout Confirmation', 'Are you sure you want to logout?', {
                isConfirm: true, confirmText: 'Logout', cancelText: 'Cancel',
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
            showStylishPopup('info', 'Profile Feature', currentUser ? `Hello ${currentUser.name}! Your full profile page is coming soon.` : 'Your profile editing section will be available here soon!');
        });
    }
    
    if (mainTitle && typeof Typed !== 'undefined') {
         new Typed('#main-title', {
            strings: ["✨ NOBITA's Feedback Portal ✨", "🚀 Share Your Valuable Thoughts 🚀", "💡 Help Us Improve! 💡"],
            typeSpeed: 50, backSpeed: 25, loop: true, startDelay: 500, smartBackspace: true
         });
        if (typedOutputElement) {
            new Typed('#typed-output', {
                strings: ["Your feedback is precious to us!", "With your opinion, we will improve.", "Every star is important to us!"],
                typeSpeed: 45, backSpeed: 20, loop: true, startDelay: 1500, showCursor: false
            });
        }
    } else if (typeof Typed === 'undefined') {
        console.warn("Typed.js library not found. Titles will not be animated.");
        if (mainTitle) mainTitle.textContent = "✨ NOBITA's Feedback Portal ✨"; // Fallback static title
        if (typedOutputElement) typedOutputElement.textContent = "Your feedback is precious to us!"; // Fallback static subtitle
    }


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
            
            const h2Title = feedbackListContainerElement.querySelector('h2'); 
            feedbackListContainerElement.innerHTML = ''; 
            if(averageRatingDisplayEl) feedbackListContainerElement.appendChild(averageRatingDisplayEl); 
            if(h2Title) feedbackListContainerElement.appendChild(h2Title); 

            if (data.length === 0) {
                const msgP = document.createElement('p');
                msgP.textContent = 'No feedback yet. Be the first one!';
                msgP.style.textAlign='center'; msgP.style.padding='20px';
                feedbackListContainerElement.appendChild(msgP);
                updateAverageRating(0, 0); 
            } else {
                const totalRatings = data.reduce((sum, fb) => sum + fb.rating, 0);
                const average = totalRatings / data.length;
                updateAverageRating(average, data.length);
                data.forEach((fb, index) => addFeedbackToDOM(fb, index));
            }
        } catch (err) { /* Handled by apiRequest */ }
    }

    function updateAverageRating(avg, count) {
        if (!averageRatingDisplayEl) return;
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
        
        if (!currentUser) {
             return showStylishPopup('warning', 'Login Required', 'Please login via the <i class="fas fa-lock" style="margin:0 4px;"></i> icon at the top right to submit your feedback. Your identity helps us value your input even more!', {
                confirmText: 'Got it!'
            });
        }
        // Name is taken from currentUser, so no need to check nameInputInFeedbackForm.value when logged in.
        if (!feedbackContent || ratingValue === '0') {
            return showStylishPopup('error', 'Empty Fields!', 'Feedback and rating are required!');
        }

        let feedbackPayload = { feedback: feedbackContent, rating: parseInt(ratingValue) };
        const url = isEditing ? `${API_FEEDBACK_URL}/${currentEditFeedbackId}` : API_FEEDBACK_URL;
        const method = isEditing ? 'PUT' : 'POST';

        const originalButtonText = submitButton.textContent;
        submitButton.disabled = true;
        submitButton.textContent = isEditing ? "Updating..." : "Submitting...";

        try { 
            const data = await apiRequest(url, method, feedbackPayload); 
            showStylishPopup('success', isEditing ? 'Feedback Updated!' : 'Feedback Submitted!', data.message); 
            resetFeedbackForm(); 
            await fetchFeedbacks(); 
        } 
        catch (error) { /* Handled by apiRequest */ }
        finally { 
            submitButton.disabled = false; 
            submitButton.textContent = originalButtonText; // Restore original text (which could be "UPDATE" or "SUBMIT")
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
            nameInputInFeedbackForm.disabled = true; // Keep disabled for guests
            nameInputInFeedbackForm.placeholder = 'Please login to submit feedback...';
        }
        feedbackTextarea.value = '';
        ratingInput.value = '0';
        currentSelectedRating = 0;
        updateStarVisuals(0); 
        if(submitButton) submitButton.textContent = 'SUBMIT FEEDBACK'; 
        isEditing = false; 
        currentEditFeedbackId = null; 
    }

    function addFeedbackToDOM(fbData, index) {
        const item = document.createElement('div');
        item.className = 'feedback-item';
        item.dataset.feedbackId = fbData._id; 

        const avatarImg = document.createElement('img');
        avatarImg.className = 'avatar-img';
        avatarImg.src = fbData.avatarUrl || `https://via.placeholder.com/50/6a0dad/FFFFFF?text=${encodeURIComponent(fbData.name && fbData.name.length > 0 ? fbData.name.charAt(0).toUpperCase() : 'X')}`;
        avatarImg.alt = (fbData.name && fbData.name.length > 0 ? fbData.name.charAt(0).toUpperCase() : 'X');
        avatarImg.onerror = function() {
            this.src = `https://via.placeholder.com/50/6a0dad/FFFFFF?text=${encodeURIComponent(fbData.name && fbData.name.length > 0 ? fbData.name.charAt(0).toUpperCase() : 'X')}`;
        };

        const detailsDiv = document.createElement('div');
        detailsDiv.className = 'feedback-details';

        const strongName = document.createElement('strong'); 
        let nameContent = fbData.name;
        let userTypeTag = '';
        // Check based on userId object structure first, then googleIdSubmitter for older entries
        if (fbData.userId && typeof fbData.userId === 'object' && fbData.userId.loginMethod) {
            userTypeTag = fbData.userId.loginMethod === 'google' 
                ? `<span class="user-type-indicator google-user-indicator" title="Google User">G</span>`
                : `<span class="user-type-indicator email-user-indicator" title="Email User">E</span>`;
        } else if (fbData.googleIdSubmitter) { // Fallback for older data structure
             userTypeTag = `<span class="user-type-indicator google-user-indicator" title="Google User (Legacy)">G</span>`;
        } else { // Default or very old entries
             userTypeTag = `<span class="user-type-indicator email-user-indicator" title="User">U</span>`;
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
        editButton.disabled = !(currentUser && fbData.userId && currentUser.userId === (typeof fbData.userId === 'object' ? fbData.userId._id : fbData.userId) );

        editButton.addEventListener('click', (event) => { 
            event.stopPropagation(); 
            if (!currentUser || !fbData.userId || currentUser.userId !== (typeof fbData.userId === 'object' ? fbData.userId._id : fbData.userId)) {
                return showStylishPopup('error', 'Permission Denied!', 'You can only edit your own feedback.');
            }
            showStylishPopup('info', 'Edit Feedback', 'Edit your feedback in the form below. Your name will remain as per your login.');
            
            nameInputInFeedbackForm.value = currentUser.name; // Use current user's name
            feedbackFormUsernameSpan.textContent = currentUser.name;
            nameInputInFeedbackForm.disabled = true; 
            
            feedbackTextarea.value = fbData.feedback;
            currentSelectedRating = fbData.rating;
            ratingInput.value = fbData.rating;
            updateStarVisuals(fbData.rating);

            if(submitButton) submitButton.textContent = 'UPDATE FEEDBACK'; 
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
        if(feedbackListContainerElement.querySelector(`[data-feedback-id="${fbData._id}"]`)) {
             // Item already exists, potentially replace it or do nothing. For now, simple append might cause duplicates on some refresh scenarios.
             // A better approach would be to clear and re-render or find and replace.
             // For simplicity, current fetchFeedbacks clears the list first.
        } else {
            feedbackListContainerElement.appendChild(item);
        }
    }
    
    window.onload = function () {
        if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
            google.accounts.id.initialize({
                client_id: GOOGLE_CLIENT_ID,
                callback: handleGoogleCredentialResponse 
            });
        } else {
            console.error("Google Identity Services script abhi load nahi hua hai. Google Sign-In kaam nahi karega.");
            // Optionally, inform the user via a non-blocking UI element if Google Sign-In is critical
            // showStylishPopup('warning', 'Google Sign-In Issue', 'Google services are currently unavailable. You can still use email login/signup.');
        }
        checkLoginStatus(); 
        if(ownerInfoEl) setTimeout(() => ownerInfoEl.classList.add('animate-in'), 200);
        if (feedbackFormContainer) setTimeout(() => feedbackFormContainer.classList.add('animate-in'), 300);
        if (feedbackListContainerElement) setTimeout(() => feedbackListContainerElement.classList.add('animate-in'), 400);
         // Make sure feedback form elements are properly initialized after login status check
        resetFeedbackForm(); 
    };
    
    // Initial calls on load (some moved to window.onload)
    // updateUIAfterLogout(); // Set initial UI state, this is now handled by checkLoginStatus effectively
    // checkLoginStatus(); // This will run in window.onload
});
// === END: JavaScript Code ===