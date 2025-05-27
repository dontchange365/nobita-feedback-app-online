// script.js (COMPLETE, FIXED, WORKING FOR YOUR BACKEND)
// IMPORTANT: API_BASE set to your backend Render URL below!
const API_BASE = "https://nobita-feedback-app-online.onrender.com";

document.addEventListener('DOMContentLoaded', async () => {
    // DOM elements
    const loginIconTrigger = document.getElementById('login-icon-trigger');
    const userAvatarTrigger = document.getElementById('user-avatar-trigger');
    const userAvatarTriggerImg = userAvatarTrigger.querySelector('img');
    const loginModal = document.getElementById('loginModal');
    const signupModal = document.getElementById('signupModal');
    const userMenu = document.getElementById('userMenu');
    const userProfileModal = document.getElementById('userProfileModal');
    const emailLoginForm = document.getElementById('email-login-form');
    const modalLoginEmailInput = document.getElementById('modal-login-email');
    const modalLoginPasswordInput = document.getElementById('modal-login-password');
    const modalForgotPasswordLink = document.getElementById('modal-forgot-password-link');
    const modalCreateAccountLink = document.getElementById('modal-create-account-link');
    const modalGoogleLoginBtn = document.getElementById('modal-google-login-btn');
    const emailSignupForm = document.getElementById('email-signup-form');
    const modalSignupUsernameInput = document.getElementById('modal-signup-username');
    const modalSignupEmailInput = document.getElementById('modal-signup-email');
    const modalSignupPasswordInput = document.getElementById('modal-signup-password');
    const modalSignupConfirmPasswordInput = document.getElementById('modal-signup-confirm-password');
    const modalLoginLink = document.getElementById('modal-login-link');
    const feedbackForm = document.getElementById('feedback-form');
    const feedbackFormUsernameSpan = document.getElementById('feedback-form-username');
    const feedbackFormNameInput = document.getElementById('name');
    const feedbackFormTextInput = document.getElementById('feedback');
    const starRatingContainer = document.getElementById('star-rating');
    const ratingInput = document.getElementById('rating');
    const submitFeedbackButton = document.getElementById('submit-feedback');
    const feedbackListContainer = document.getElementById('feedback-list-container');
    const averageRatingDisplay = document.getElementById('average-rating-display');
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

    let currentOpenModal = null;
    let userMenuOpen = false;

    // --- Helper Functions ---
    const showModal = (modal) => {
        if (currentOpenModal) currentOpenModal.classList.remove('active');
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
    // DiceBear Avatar Utility
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
        feedbackFormNameInput.value = username;
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
        feedbackFormNameInput.value = '';
        profileUsernameSpan.textContent = '';
        profileEmailSpan.textContent = '';
        profileAvatarDisplay.src = '';
        editProfileForm.classList.add('hidden');
        changePasswordForm.classList.add('hidden');
        hideModal(userProfileModal);
        toggleUserMenu(false);
        clearMessages();
    };

    // --- Modal/Menu Events ---
    loginIconTrigger.addEventListener('click', () => showModal(loginModal));
    userAvatarTrigger.addEventListener('click', () => toggleUserMenu(!userMenuOpen));
    userMenu.addEventListener('click', (e) => {
        if (e.target.id === 'menu-profile') {
            toggleUserMenu(false);
            fetchUserProfile();
        } else if (e.target.id === 'menu-logout') {
            handleLogout();
            toggleUserMenu(false);
        }
    });
    document.querySelectorAll('.close-button').forEach(button => {
        button.addEventListener('click', (e) => {
            hideModal(e.target.closest('.auth-modal-overlay'));
            clearMessages();
            editProfileForm.classList.add('hidden');
            changePasswordForm.classList.add('hidden');
        });
    });
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

    // === AUTH (LOGIN/SIGNUP/LOGOUT) ===
    emailLoginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearMessages();
        const email = modalLoginEmailInput.value;
        const password = modalLoginPasswordInput.value;
        try {
            const res = await fetch(`${API_BASE}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (res.ok) {
                setToken(data.token);
                updateUIAfterLogin(data.user.name, data.user.avatarUrl);
                fetchFeedbacks();
            } else {
                displayMessage(document.getElementById('login-message'), data.message || 'Login failed.', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            displayMessage(document.getElementById('login-message'), 'Server error during login.', 'error');
        }
    });
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
            const res = await fetch(`${API_BASE}/api/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: username, email, password })
            });
            const data = await res.json();
            if (res.ok) {
                displayMessage(document.getElementById('signup-message'), data.message || 'Account created successfully! Please log in.', 'success');
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
    const handleLogout = () => {
        removeToken();
        updateUIAfterLogout();
        fetchFeedbacks();
        console.log('Logged out');
    };
    // Check login status on page load
    const checkLoginStatus = async () => {
        const token = getToken();
        if (token) {
            try {
                const res = await fetch(`${API_BASE}/api/auth/me`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (res.ok && data.name) {
                    updateUIAfterLogin(data.name, data.avatarUrl);
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
        fetchFeedbacks();
    };

    // === PROFILE (VIEW/EDIT) ===
    const fetchUserProfile = async () => {
        const token = getToken();
        if (!token) {
            displayMessage(editProfileMessage, 'Aapko login karna hoga profile dekhne ke liye.', 'error');
            return;
        }
        try {
            const res = await fetch(`${API_BASE}/api/auth/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) {
                profileUsernameSpan.textContent = data.name;
                profileEmailSpan.textContent = data.email;
                if (data.avatarUrl) {
                    profileAvatarDisplay.src = data.avatarUrl;
                    userAvatarTriggerImg.src = data.avatarUrl;
                } else {
                    generateAndSetUserAvatar(data.name);
                }
                showModal(userProfileModal);
                editProfileForm.classList.add('hidden');
                changePasswordForm.classList.add('hidden');
                editProfileMessage.style.display = 'none';
                changePasswordMessage.style.display = 'none';
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
        changePasswordForm.classList.add('hidden');
        editProfileMessage.style.display = 'none';
    });
    cancelEditButton.addEventListener('click', () => {
        editProfileForm.classList.add('hidden');
        editProfileMessage.style.display = 'none';
    });
    changePasswordButton.addEventListener('click', () => {
        changePasswordForm.classList.remove('hidden');
        editProfileForm.classList.add('hidden');
        currentPasswordInput.value = '';
        newPasswordInput.value = '';
        confirmNewPasswordInput.value = '';
        changePasswordMessage.style.display = 'none';
    });
    cancelPasswordChangeButton.addEventListener('click', () => {
        changePasswordForm.classList.add('hidden');
        changePasswordMessage.style.display = 'none';
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
        try {
            const res = await fetch(`${API_BASE}/api/user/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name: username })
            });
            const data = await res.json();
            if (res.ok) {
                displayMessage(editProfileMessage, data.message || 'Profile updated successfully!', 'success');
                profileUsernameSpan.textContent = username;
                feedbackFormUsernameSpan.textContent = username;
                if (!profileAvatarDisplay.src.startsWith('https://res.cloudinary.com/')) {
                    generateAndSetUserAvatar(username);
                }
                setTimeout(() => editProfileForm.classList.add('hidden'), 1500);
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
            const res = await fetch(`${API_BASE}/api/user/change-password`, {
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
                setTimeout(() => changePasswordForm.classList.add('hidden'), 1500);
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
            const res = await fetch(`${API_BASE}/api/user/delete-account`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) {
                alert(data.message || 'Account successfully deleted!');
                handleLogout();
                fetchFeedbacks();
            } else {
                displayMessage(editProfileMessage, data.message || 'Account deletion failed.', 'error');
            }
        } catch (error) {
            console.error('Error deleting account:', error);
            displayMessage(editProfileMessage, 'Server error while deleting account.', 'error');
        }
    });

    // === FEEDBACK LOGIC ===
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
            feedback: feedbackText,
            rating: parseInt(rating),
            ...(token ? {} : { name: name || 'Anonymous' })
        };
        try {
            const headers = { 'Content-Type': 'application/json' };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            const res = await fetch(`${API_BASE}/api/feedback`, {
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
                fetchFeedbacks();
            } else {
                alert(data.message || 'Feedback submission failed.');
            }
        } catch (error) {
            console.error('Feedback submission error:', error);
            alert('Server error while submitting feedback.');
        }
    });
    const fetchFeedbacks = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/feedbacks`);
            const data = await res.json();
            if (res.ok) {
                feedbackListContainer.innerHTML = '<div id="average-rating-display"></div><h2>Recent Feedbacks</h2>';
                const averageRatingDiv = document.getElementById('average-rating-display');
                if (data.length > 0) {
                    let totalRating = 0;
                    data.forEach(fb => totalRating += fb.rating);
                    const avg = (totalRating / data.length).toFixed(1);
                    averageRatingDiv.innerHTML = `Overall Average Rating: <strong>${avg} / 5</strong>`;
                } else {
                    averageRatingDiv.innerHTML = 'Koi feedback nahi mila abhi tak.';
                }
                data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                data.forEach(addFeedbackToDOM);
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
        item.dataset.feedbackId = fbData._id;
        const avatarImg = document.createElement('img');
        avatarImg.className = 'feedback-avatar';
        avatarImg.src = fbData.avatarUrl || getDiceBearAvatarUrl(fbData.name || 'Anonymous');
        avatarImg.alt = `${fbData.name || 'Anonymous'}'s avatar`;
        const detailsDiv = document.createElement('div');
        detailsDiv.className = 'feedback-details';
        const headerDiv = document.createElement('div');
        headerDiv.className = 'feedback-header';
        const nameSpan = document.createElement('span');
        nameSpan.className = 'feedback-username';
        nameSpan.textContent = fbData.name || 'Anonymous';
        const ratingDiv = document.createElement('div');
        ratingDiv.className = 'feedback-rating';
        for (let i = 0; i < 5; i++) {
            const star = document.createElement('span');
            star.className = 'star-display ' + (i < fbData.rating ? 'selected' : '');
            star.innerHTML = '&#9733;';
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
        contentP.textContent = fbData.feedback;
        detailsDiv.append(headerDiv, contentP);
        // Admin Reply (if any)
        if (fbData.replies && fbData.replies.length > 0) {
            fbData.replies.forEach(latestReply => {
                const adminReplyDiv = document.createElement('div');
                adminReplyDiv.className = 'admin-reply';
                const adminAvatar = document.createElement('img');
                adminAvatar.className = 'admin-avatar';
                adminAvatar.src = getDiceBearAvatarUrl('Admin');
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
            });
        }
        item.append(avatarImg, detailsDiv);
        if(feedbackListContainer.querySelector(`[data-feedback-id="${fbData._id}"]`)) {
            const oldItem = feedbackListContainer.querySelector(`[data-feedback-id="${fbData._id}"]`);
            if (oldItem) oldItem.remove();
            feedbackListContainer.appendChild(item);
        } else {
            feedbackListContainer.appendChild(item);
        }
    };

    // === INIT ===
    updateUIAfterLogout();
    checkLoginStatus();
});