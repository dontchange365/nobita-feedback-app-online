// script.js
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
    const modalSignupUsernameInput = document.getElementById('modal-signup-username');
    const modalSignupEmailInput = document.getElementById('modal-signup-email');
    const modalSignupPasswordInput = document.getElementById('modal-signup-password');
    const modalSignupConfirmPasswordInput = document.getElementById('modal-signup-confirm-password');
    const modalLoginLink = document.getElementById('modal-login-link');

    // Feedback Form Elements
    const feedbackForm = document.getElementById('feedback-form');
    const feedbackFormUsernameSpan = document.getElementById('feedback-form-username');
    const feedbackFormNameInput = document.getElementById('name');
    const feedbackFormTextInput = document.getElementById('feedback');
    const starRatingContainer = document.getElementById('star-rating');
    const ratingInput = document.getElementById('rating');
    const submitFeedbackButton = document.getElementById('submit-feedback');

    // Feedback List Container
    const feedbackListContainer = document.getElementById('feedback-list-container');
    const averageRatingDisplay = document.getElementById('average-rating-display');

    // Profile Modal Elements
    const profileAvatarDisplay = document.getElementById('profile-avatar-display');
    const profileUsernameSpan = document.getElementById('profile-username');
    const profileEmailSpan = document.getElementById('profile-email');
    const editProfileButton = document.getElementById('edit-profile-btn');
    const changePasswordButton = document.getElementById('change-password-btn');
    const deleteAccountButton = document.getElementById('delete-account-btn');
    const editProfileForm = document.getElementById('edit-profile-form');
    const editUsernameInput = document.getElementById('edit-username');
    const editEmailInput = document.getElementById('edit-email');
    const saveChangesButton = editProfileForm.querySelector('button[type="submit"]');
    const cancelEditButton = document.getElementById('cancel-edit-btn');
    const editProfileMessage = document.getElementById('edit-profile-message');
    const changePasswordForm = document.getElementById('change-password-form');
    const currentPasswordInput = document.getElementById('current-password');
    const newPasswordInput = document.getElementById('new-password');
    const confirmNewPasswordInput = document.getElementById('confirm-new-password');
    const updatePasswordButton = changePasswordForm.querySelector('button[type="submit"]');
    const cancelPasswordChangeButton = document.getElementById('cancel-password-change-btn');
    const changePasswordMessage = document.getElementById('change-password-message');
    const avatarUploadInput = document.getElementById('avatar-upload');
    const uploadAvatarButton = document.getElementById('upload-avatar-btn');
    const avatarUploadProgressBar = document.getElementById('avatar-upload-progress');
    const avatarUploadProgressFill = avatarUploadProgressBar.querySelector('.progress-fill');
    const avatarUploadProgressText = avatarUploadProgressBar.querySelector('.progress-text');


    // Modals and Menus State
    let currentOpenModal = null;
    let userMenuOpen = false;

    // Helper Functions
    const showModal = (modal) => {
        if (currentOpenModal) {
            currentOpenModal.classList.remove('active');
        }
        modal.classList.add('active');
        currentOpenModal = modal;
    };

    const hideModal = (modal) => {
        modal.classList.remove('active');
        currentOpenModal = null;
    };

    const toggleUserMenu = (show) => {
        if (show) {
            userMenu.classList.add('active');
            userMenuOpen = true;
        } else {
            userMenu.classList.remove('active');
            userMenuOpen = false;
        }
    };

    const displayMessage = (element, message, type) => {
        element.textContent = message;
        element.className = 'message-area ' + type;
        element.style.display = 'block';
    };

    const clearMessages = () => {
        document.querySelectorAll('.message-area').forEach(msg => {
            msg.textContent = '';
            msg.className = 'message-area';
            msg.style.display = 'none';
        });
    };

    const getToken = () => localStorage.getItem('token');
    const setToken = (token) => localStorage.setItem('token', token);
    const removeToken = () => localStorage.removeItem('token');

    // Avatar generation logic (DiceBear)
    const getDiceBearAvatarUrl = (seed) => {
        const cleanedSeed = encodeURIComponent(seed.trim().toLowerCase());
        return `https://api.dicebear.com/8.x/initials/svg?seed=${cleanedSeed}&radius=50&backgroundColor=6a0dad,FFD700,3B82F6,28a745,dc3545,fd7e14&backgroundType=gradientLinear&fontFamily=Poppins`;
    };

    const generateAndSetUserAvatar = (username) => {
        if (username) {
            const avatarUrl = getDiceBearAvatarUrl(username);
            userAvatarTriggerImg.src = avatarUrl;
            profileAvatarDisplay.src = avatarUrl;
        } else {
            // Default avatar if no username
            userAvatarTriggerImg.src = getDiceBearAvatarUrl('Guest');
            profileAvatarDisplay.src = getDiceBearAvatarUrl('Guest');
        }
    };

    // UI Updates based on login status
    const updateUIAfterLogin = (username, avatarUrl) => {
        loginIconTrigger.style.display = 'none';
        userAvatarTrigger.style.display = 'flex';
        feedbackFormUsernameSpan.textContent = username;
        feedbackFormNameInput.disabled = true;
        feedbackFormNameInput.value = username; // Set input value to username
        if (avatarUrl) {
            userAvatarTriggerImg.src = avatarUrl;
            profileAvatarDisplay.src = avatarUrl;
        } else {
            generateAndSetUserAvatar(username);
        }
        clearMessages();
        hideModal(loginModal);
        hideModal(signupModal);
    };

    const updateUIAfterLogout = () => {
        loginIconTrigger.style.display = 'flex';
        userAvatarTrigger.style.display = 'none';
        feedbackFormUsernameSpan.textContent = 'User';
        feedbackFormNameInput.disabled = false;
        feedbackFormNameInput.value = ''; // Clear input value
        // Also clear any profile specific data
        profileUsernameSpan.textContent = '';
        profileEmailSpan.textContent = '';
        profileAvatarDisplay.src = '';
        // Hide profile related forms
        editProfileForm.classList.add('hidden');
        changePasswordForm.classList.add('hidden');
        hideModal(userProfileModal); // Hide profile modal on logout
        toggleUserMenu(false); // Hide user menu on logout
        clearMessages();
    };

    // Event Listeners for Modals and Menu
    loginIconTrigger.addEventListener('click', () => showModal(loginModal));
    userAvatarTrigger.addEventListener('click', () => toggleUserMenu(!userMenuOpen));

    userMenu.addEventListener('click', (e) => {
        if (e.target.id === 'menu-profile') {
            toggleUserMenu(false);
            fetchUserProfile(); // Fetch user data before showing profile modal
        } else if (e.target.id === 'menu-logout') {
            handleLogout();
            toggleUserMenu(false);
        }
    });

    document.querySelectorAll('.close-button').forEach(button => {
        button.addEventListener('click', (e) => {
            hideModal(e.target.closest('.auth-modal-overlay'));
            clearMessages();
            // Reset forms if they were open inside the profile modal
            editProfileForm.classList.add('hidden');
            changePasswordForm.classList.add('hidden');
        });
    });

    // Close modals/menu if clicked outside
    window.addEventListener('click', (e) => {
        if (currentOpenModal && !currentOpenModal.contains(e.target) && e.target !== loginIconTrigger) {
            hideModal(currentOpenModal);
            clearMessages();
            editProfileForm.classList.add('hidden');
            changePasswordForm.classList.add('hidden');
        }
        if (userMenuOpen && !userMenu.contains(e.target) && e.target !== userAvatarTrigger && !userAvatarTrigger.contains(e.target)) {
            toggleUserMenu(false);
        }
    });

    // Switch between login and signup modals
    modalCreateAccountLink.addEventListener('click', (e) => {
        e.preventDefault();
        hideModal(loginModal);
        showModal(signupModal);
        clearMessages();
    });

    modalLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        hideModal(signupModal);
        showModal(loginModal);
        clearMessages();
    });

    // --- Authentication Logic ---

    // Google Login
    const setupGoogleLogin = () => {
        if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
            google.accounts.id.initialize({
                client_id: GOOGLE_CLIENT_ID,
                callback: handleGoogleCredentialResponse
            });
            google.accounts.id.renderButton(
                modalGoogleLoginBtn,
                { type: "standard", theme: "filled_blue", size: "large", text: "signin_with", shape: "rectangular", width: "250" }
            );
            // google.accounts.id.prompt(); // You can enable auto-prompt if desired
        } else {
            console.warn("Google Sign-in script not loaded or initialized.");
        }
    };

    async function handleGoogleCredentialResponse(response) {
        if (response.credential) {
            try {
                const res = await fetch('/api/auth/google', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: response.credential })
                });
                const data = await res.json();
                if (res.ok) {
                    setToken(data.token);
                    updateUIAfterLogin(data.username, data.avatarUrl);
                    fetchFeedbacks(); // Refresh feedbacks after login
                } else {
                    displayMessage(document.getElementById('login-message'), data.message || 'Google login failed.', 'error');
                }
            } catch (error) {
                console.error('Google login error:', error);
                displayMessage(document.getElementById('login-message'), 'Server error during Google login.', 'error');
            }
        }
    }

    // Email Login
    emailLoginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearMessages();
        const email = modalLoginEmailInput.value;
        const password = modalLoginPasswordInput.value;

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (res.ok) {
                setToken(data.token);
                updateUIAfterLogin(data.username, data.avatarUrl);
                fetchFeedbacks();
            } else {
                displayMessage(document.getElementById('login-message'), data.message || 'Login failed.', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            displayMessage(document.getElementById('login-message'), 'Server error during login.', 'error');
        }
    });

    // Email Signup
    emailSignupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearMessages();
        const username = modalSignupUsernameInput.value;
        const email = modalSignupEmailInput.value;
        const password = modalSignupPasswordInput.value;
        const confirmPassword = modalSignupConfirmPasswordInput.value;

        if (password !== confirmPassword) {
            displayMessage(document.getElementById('signup-message'), 'Passwords do not match.', 'error');
            return;
        }

        try {
            const res = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password })
            });
            const data = await res.json();
            if (res.ok) {
                displayMessage(document.getElementById('signup-message'), data.message || 'Account created successfully! Please log in.', 'success');
                // Optionally auto-login or switch to login modal
                setTimeout(() => {
                    hideModal(signupModal);
                    showModal(loginModal);
                    clearMessages();
                }, 1500);
            } else {
                displayMessage(document.getElementById('signup-message'), data.message || 'Signup failed.', 'error');
            }
        } catch (error) {
            console.error('Signup error:', error);
            displayMessage(document.getElementById('signup-message'), 'Server error during signup.', 'error');
        }
    });

    // Logout
    const handleLogout = () => {
        removeToken();
        updateUIAfterLogout();
        fetchFeedbacks(); // Fetch feedbacks to show public view
        console.log('Logged out');
    };

    // Check login status on page load
    const checkLoginStatus = async () => {
        const token = getToken();
        if (token) {
            try {
                const res = await fetch('/api/auth/status', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (res.ok && data.loggedIn) {
                    updateUIAfterLogin(data.username, data.avatarUrl);
                } else {
                    removeToken();
                    updateUIAfterLogout();
                }
            } catch (error) {
                console.error('Login status check failed:', error);
                removeToken();
                updateUIAfterLogout();
            }
        } else {
            updateUIAfterLogout();
        }
        fetchFeedbacks(); // Always fetch feedbacks, logged in or not
    };

    // --- Profile Management ---

    const fetchUserProfile = async () => {
        const token = getToken();
        if (!token) {
            displayMessage(editProfileMessage, 'Aapko login karna hoga profile dekhne ke liye.', 'error');
            return;
        }
        try {
            const res = await fetch('/api/user/profile', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) {
                profileUsernameSpan.textContent = data.username;
                profileEmailSpan.textContent = data.email;
                if (data.avatarUrl) {
                    profileAvatarDisplay.src = data.avatarUrl;
                    userAvatarTriggerImg.src = data.avatarUrl; // Update main avatar
                } else {
                    generateAndSetUserAvatar(data.username);
                }
                showModal(userProfileModal);
                // Hide forms initially
                editProfileForm.classList.add('hidden');
                changePasswordForm.classList.add('hidden');
                editProfileMessage.style.display = 'none'; // Clear messages on open
                changePasswordMessage.style.display = 'none'; // Clear messages on open
            } else {
                displayMessage(editProfileMessage, data.message || 'Profile fetch failed.', 'error');
                hideModal(userProfileModal);
            }
        } catch (error) {
            console.error('Error fetching profile:', error);
            displayMessage(editProfileMessage, 'Server error while fetching profile.', 'error');
            hideModal(userProfileModal);
        }
    };

    editProfileButton.addEventListener('click', () => {
        editUsernameInput.value = profileUsernameSpan.textContent;
        editEmailInput.value = profileEmailSpan.textContent;
        editProfileForm.classList.remove('hidden');
        changePasswordForm.classList.add('hidden'); // Hide password form if open
        editProfileMessage.style.display = 'none'; // Clear message
    });

    cancelEditButton.addEventListener('click', () => {
        editProfileForm.classList.add('hidden');
        editProfileMessage.style.display = 'none'; // Clear message
    });

    changePasswordButton.addEventListener('click', () => {
        changePasswordForm.classList.remove('hidden');
        editProfileForm.classList.add('hidden'); // Hide edit profile form if open
        currentPasswordInput.value = '';
        newPasswordInput.value = '';
        confirmNewPasswordInput.value = '';
        changePasswordMessage.style.display = 'none'; // Clear message
    });

    cancelPasswordChangeButton.addEventListener('click', () => {
        changePasswordForm.classList.add('hidden');
        changePasswordMessage.style.display = 'none'; // Clear message
    });

    editProfileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearMessages();
        const token = getToken();
        if (!token) {
            displayMessage(editProfileMessage, 'Aapko login karna hoga profile update karne ke liye.', 'error');
            return;
        }

        const username = editUsernameInput.value;
        const email = editEmailInput.value;

        try {
            const res = await fetch('/api/user/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ username, email })
            });
            const data = await res.json();
            if (res.ok) {
                displayMessage(editProfileMessage, data.message || 'Profile updated successfully!', 'success');
                profileUsernameSpan.textContent = username;
                profileEmailSpan.textContent = email;
                feedbackFormUsernameSpan.textContent = username; // Update main form username
                // If username changed, update avatar as well (if using DiceBear)
                if (!profileAvatarDisplay.src.startsWith('https://res.cloudinary.com/')) { // Only update if not a cloudinary URL
                    generateAndSetUserAvatar(username);
                }
                setTimeout(() => editProfileForm.classList.add('hidden'), 1500); // Hide form after a delay
            } else {
                displayMessage(editProfileMessage, data.message || 'Profile update failed.', 'error');
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            displayMessage(editProfileMessage, 'Server error while updating profile.', 'error');
        }
    });

    changePasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearMessages();
        const token = getToken();
        if (!token) {
            displayMessage(changePasswordMessage, 'Aapko login karna hoga password change karne ke liye.', 'error');
            return;
        }

        const currentPassword = currentPasswordInput.value;
        const newPassword = newPasswordInput.value;
        const confirmNewPassword = confirmNewPasswordInput.value;

        if (newPassword !== confirmNewPassword) {
            displayMessage(changePasswordMessage, 'Naya password match nahi kar raha hai.', 'error');
            return;
        }
        if (newPassword.length < 6) {
            displayMessage(changePasswordMessage, 'Naya password kam se kam 6 akshar ka hona chahiye.', 'error');
            return;
        }

        try {
            const res = await fetch('/api/user/change-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ currentPassword, newPassword })
            });
            const data = await res.json();
            if (res.ok) {
                displayMessage(changePasswordMessage, data.message || 'Password successfully updated!', 'success');
                currentPasswordInput.value = '';
                newPasswordInput.value = '';
                confirmNewPasswordInput.value = '';
                setTimeout(() => changePasswordForm.classList.add('hidden'), 1500); // Hide form after a delay
            } else {
                displayMessage(changePasswordMessage, data.message || 'Password update failed.', 'error');
            }
        } catch (error) {
            console.error('Error changing password:', error);
            displayMessage(changePasswordMessage, 'Server error while changing password.', 'error');
        }
    });

    deleteAccountButton.addEventListener('click', async () => {
        if (!confirm('Kya aap sach mein apna account delete karna chahte hain? Yeh action revert nahi kiya ja sakta hai.')) {
            return;
        }

        const token = getToken();
        if (!token) {
            displayMessage(editProfileMessage, 'Aapko login karna hoga account delete karne ke liye.', 'error');
            return;
        }

        try {
            const res = await fetch('/api/user/delete-account', {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) {
                alert(data.message || 'Account successfully deleted!');
                handleLogout(); // Log out after deletion
                fetchFeedbacks(); // Refresh feedbacks
            } else {
                displayMessage(editProfileMessage, data.message || 'Account deletion failed.', 'error');
            }
        } catch (error) {
            console.error('Error deleting account:', error);
            displayMessage(editProfileMessage, 'Server error while deleting account.', 'error');
        }
    });

    // Avatar Upload Logic
    avatarUploadInput.addEventListener('change', (event) => {
        if (event.target.files.length > 0) {
            uploadAvatarButton.style.display = 'block';
            avatarUploadProgressBar.style.display = 'none'; // Hide progress bar until upload starts
            avatarUploadProgressFill.style.width = '0%';
            avatarUploadProgressText.textContent = '0%';
        } else {
            uploadAvatarButton.style.display = 'none';
        }
    });

    uploadAvatarButton.addEventListener('click', async () => {
        const file = avatarUploadInput.files[0];
        if (!file) {
            displayMessage(editProfileMessage, 'Kripya ek avatar file chunein.', 'error');
            return;
        }

        const token = getToken();
        if (!token) {
            displayMessage(editProfileMessage, 'Aapko login karna hoga avatar upload karne ke liye.', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('avatar', file);

        uploadAvatarButton.style.display = 'none';
        avatarUploadProgressBar.style.display = 'flex';
        displayMessage(editProfileMessage, 'Uploading avatar...', 'info');

        try {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/user/upload-avatar', true);
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);

            xhr.upload.addEventListener('progress', (event) => {
                if (event.lengthComputable) {
                    const percent = Math.round((event.loaded / event.total) * 100);
                    avatarUploadProgressFill.style.width = `${percent}%`;
                    avatarUploadProgressText.textContent = `${percent}%`;
                }
            });

            xhr.onload = () => {
                if (xhr.status === 200) {
                    const data = JSON.parse(xhr.responseText);
                    displayMessage(editProfileMessage, data.message || 'Avatar successfully uploaded!', 'success');
                    profileAvatarDisplay.src = data.newAvatarUrl;
                    userAvatarTriggerImg.src = data.newAvatarUrl;
                    avatarUploadInput.value = ''; // Clear file input
                    setTimeout(() => {
                        avatarUploadProgressBar.style.display = 'none';
                        editProfileMessage.style.display = 'none';
                    }, 1500);
                } else {
                    const errorData = JSON.parse(xhr.responseText);
                    displayMessage(editProfileMessage, errorData.message || 'Avatar upload failed.', 'error');
                    avatarUploadProgressBar.style.display = 'none';
                    uploadAvatarButton.style.display = 'block'; // Show upload button again on failure
                }
            };

            xhr.onerror = () => {
                console.error('Network error during avatar upload.');
                displayMessage(editProfileMessage, 'Network error during avatar upload.', 'error');
                avatarUploadProgressBar.style.display = 'none';
                uploadAvatarButton.style.display = 'block';
            };

            xhr.send(formData);

        } catch (error) {
            console.error('Error initiating avatar upload:', error);
            displayMessage(editProfileMessage, 'Error initiating avatar upload.', 'error');
            avatarUploadProgressBar.style.display = 'none';
            uploadAvatarButton.style.display = 'block';
        }
    });


    // --- Feedback Logic ---

    // Star Rating
    starRatingContainer.addEventListener('click', (e) => {
        const star = e.target.closest('.star');
        if (star) {
            const value = parseInt(star.dataset.value);
            ratingInput.value = value;
            document.querySelectorAll('.star').forEach(s => {
                s.classList.remove('selected');
                if (parseInt(s.dataset.value) <= value) {
                    s.classList.add('selected');
                }
            });
        }
    });

    // Submit Feedback
    submitFeedbackButton.addEventListener('click', async () => {
        clearMessages();
        const feedbackText = feedbackFormTextInput.value;
        const rating = ratingInput.value;
        const token = getToken();
        const name = feedbackFormNameInput.value;

        if (!feedbackText.trim() || rating === '0') {
            alert('Kripya apna feedback aur rating dein!');
            return;
        }

        const feedbackData = {
            feedbackText,
            rating: parseInt(rating),
            // Only send name if not logged in (disabled input)
            ...(token ? {} : { name: name || 'Anonymous' })
        };

        try {
            const headers = { 'Content-Type': 'application/json' };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const res = await fetch('/api/feedbacks', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(feedbackData)
            });

            const data = await res.json();
            if (res.ok) {
                alert(data.message || 'Feedback submitted successfully!');
                feedbackFormTextInput.value = '';
                ratingInput.value = '0';
                document.querySelectorAll('.star').forEach(s => s.classList.remove('selected'));
                fetchFeedbacks(); // Refresh feedbacks after submission
            } else {
                alert(data.message || 'Feedback submission failed.');
            }
        } catch (error) {
            console.error('Feedback submission error:', error);
            alert('Server error while submitting feedback.');
        }
    });

    // Fetch and Display Feedbacks
    const fetchFeedbacks = async () => {
        try {
            const res = await fetch('/api/feedbacks');
            const data = await res.json();

            if (res.ok) {
                feedbackListContainer.innerHTML = '<div id="average-rating-display"></div><h2>Recent Feedbacks</h2>'; // Clear existing
                const averageRatingDiv = document.getElementById('average-rating-display');

                if (data.feedbacks.length > 0) {
                    let totalRating = 0;
                    data.feedbacks.forEach(fb => totalRating += fb.rating);
                    const avg = (totalRating / data.feedbacks.length).toFixed(1);
                    averageRatingDiv.innerHTML = `Overall Average Rating: <strong>${avg} / 5</strong>`;
                } else {
                    averageRatingDiv.innerHTML = 'Koi feedback nahi mila abhi tak.';
                }

                data.feedbacks.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); // Sort by newest
                data.feedbacks.forEach(addFeedbackToDOM);
            } else {
                console.error('Failed to fetch feedbacks:', data.message);
                feedbackListContainer.innerHTML = `<p style="color: var(--error-color);">Feedbacks load nahi ho paaye: ${data.message}</p>`;
            }
        } catch (error) {
            console.error('Error fetching feedbacks:', error);
            feedbackListContainer.innerHTML = '<p style="color: var(--error-color);">Server error while fetching feedbacks.</p>';
        }
    };

    const addFeedbackToDOM = (fbData) => {
        const item = document.createElement('div');
        item.className = 'feedback-item';
        item.dataset.feedbackId = fbData._id; // Store ID for potential updates

        const avatarImg = document.createElement('img');
        avatarImg.className = 'feedback-avatar';
        avatarImg.src = fbData.avatarUrl || getDiceBearAvatarUrl(fbData.username || 'Anonymous');
        avatarImg.alt = `${fbData.username || 'Anonymous'}'s avatar`;

        const detailsDiv = document.createElement('div');
        detailsDiv.className = 'feedback-details';

        const headerDiv = document.createElement('div');
        headerDiv.className = 'feedback-header';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'feedback-username';
        nameSpan.textContent = fbData.username || 'Anonymous';

        const ratingDiv = document.createElement('div');
        ratingDiv.className = 'feedback-rating';
        for (let i = 0; i < 5; i++) {
            const star = document.createElement('span');
            star.className = 'star-display ' + (i < fbData.rating ? 'selected' : '');
            star.innerHTML = '&#9733;'; // Unicode star
            ratingDiv.appendChild(star);
        }

        const timestampSpan = document.createElement('span');
        timestampSpan.className = 'feedback-timestamp';
        let timestampText = '';
        try {
            timestampText = new Date(fbData.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle:'short', timeStyle:'short' });
        } catch(e) {
            timestampText = new Date(fbData.timestamp).toLocaleString('en-US');
        }
        timestampSpan.textContent = timestampText;

        headerDiv.append(nameSpan, ratingDiv, timestampSpan);

        const contentP = document.createElement('p');
        contentP.className = 'feedback-content';
        contentP.textContent = fbData.feedbackText;

        detailsDiv.append(headerDiv, contentP);

        // Admin Reply Section
        if (fbData.adminReply) {
            const latestReply = fbData.adminReply; // Assuming adminReply is the latest reply or a single reply object
            const adminReplyDiv = document.createElement('div');
            adminReplyDiv.className = 'admin-reply';

            const adminAvatar = document.createElement('img');
            adminAvatar.className = 'admin-avatar';
            adminAvatar.src = latestReply.adminAvatarUrl || getDiceBearAvatarUrl('Admin');
            adminAvatar.alt = 'Admin Avatar';

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

        item.append(avatarImg, detailsDiv); 
        // Check if the item already exists to prevent duplicates on re-fetch
        if(feedbackListContainer.querySelector(`[data-feedback-id=\"${fbData._id}\"]`)) {
            // If it exists, remove the old one and re-add the updated one
            const oldItem = feedbackListContainer.querySelector(`[data-feedback-id=\"${fbData._id}\"]`);
            if (oldItem) oldItem.remove();
            feedbackListContainer.appendChild(item);
        } else {
            feedbackListContainer.appendChild(item);
        }
    }
    
    // Initial calls on load
    updateUIAfterLogout(); // Set initial UI state (guest mode)
    checkLoginStatus(); // Check if user is already logged in via token
    setupGoogleLogin(); // Initialize Google Login
});
// === END: JavaScript Code ===
