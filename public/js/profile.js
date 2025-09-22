// profile.js
// This file contains all the JavaScript logic specific to the user profile and modals.
// It is designed to be loaded alongside main.js.

// The main `currentUser` object will be available globally from `main.js`.
// The API constants (like API_UPDATE_PROFILE_URL, API_CHANGE_PASSWORD_URL, CLOUDINARY_UPLOAD_URL) are also available.
// The utility functions (`apiRequest`, `showStylishPopup`, `closeStylishPopup`, etc.) are globally available.

// --- Profile Modal UI Functions ---
function updateProfileModalUI(user) {
    if (!user) return;
    const profileNameInput = document.getElementById('profile-name');
    const profileEmailInput = document.getElementById('profile-email');
    const saveProfileChangesBtn = document.getElementById('save-profile-changes-btn');
    const avatarUploadInput = document.getElementById('avatar-upload-input');
    const uploadAvatarNowBtn = document.getElementById('upload-avatar-now-btn');
    const changePasswordForm = document.getElementById('change-password-form');
    const changePasswordBtn = document.getElementById('change-password-btn');
    const currentPasswordGroup = document.getElementById('current-password-group');
    const profileDisplayAvatar = document.getElementById('profile-display-avatar');
    const chooseDefaultAvatarBtn = document.getElementById('choose-default-avatar-btn');

    const isEmailUserUnverified = user.loginMethod === 'email' && !user.isVerified;
    const isGoogleUser = user.loginMethod === 'google';
    const hasCustomAvatar = user.hasCustomAvatar;

    // FIX: Simplified logic to check if a password has been set.
    // We now directly check for the existence of the user.password property.
    const hasPasswordSet = user.hasPassword;

    if (profileNameInput) {
        profileNameInput.value = user.name;
        profileNameInput.disabled = (isGoogleUser && !hasCustomAvatar) || isEmailUserUnverified;
        profileNameInput.title = isGoogleUser ? (hasCustomAvatar ? "You can change your name, but it may reset if you log in with Google again." : "Your name is managed by Google.") : (isEmailUserUnverified ? "Verify your email to edit your name." : "Edit your name");
    }
    if (profileEmailInput) profileEmailInput.value = user.email;

    if (saveProfileChangesBtn) {
        // Updated logic: Save button is disabled if name hasn't changed, regardless of login method
        saveProfileChangesBtn.disabled = (profileNameInput && profileNameInput.value.trim() === user.name) || isEmailUserUnverified;
    }
    if (avatarUploadInput) avatarUploadInput.disabled = isEmailUserUnverified;
    if (uploadAvatarNowBtn) uploadAvatarNowBtn.style.display = 'none';

    // NEW LOGIC FOR PASSWORD SECTION
    if (changePasswordForm) {
        // Always show the form now, as a user can always set or change a password.
        changePasswordForm.style.display = 'block';

        // Show/hide current password field based on whether a password exists
        if (currentPasswordGroup) {
            currentPasswordGroup.style.display = hasPasswordSet ? 'block' : 'none';
        }

        // Set button text dynamically
        changePasswordBtn.textContent = hasPasswordSet ? "Change Password" : "Create Password";

        // Disable button if email isn't verified (if applicable)
        changePasswordBtn.disabled = isEmailUserUnverified;
    }

    if (profileDisplayAvatar) profileDisplayAvatar.src = user.avatarUrl || `https://placehold.co/120x120/6a0dad/FFFFFF?text=${encodeURIComponent(user.name.charAt(0).toUpperCase())}`;

    if (chooseDefaultAvatarBtn) {
        chooseDefaultAvatarBtn.classList.remove('popup-button', 'primary');
        chooseDefaultAvatarBtn.classList.add('profile-avatar-action-btn');
    }
}
window.updateProfileModalUI = updateProfileModalUI;

function updateProfileModalUILogout() {
    const saveProfileChangesBtn = document.getElementById('save-profile-changes-btn');
    const changePasswordBtn = document.getElementById('change-password-btn');
    const uploadAvatarNowBtn = document.getElementById('upload-avatar-now-btn');
    const avatarUploadInput = document.getElementById('avatar-upload-input');
    const profileDisplayAvatar = document.getElementById('profile-display-avatar');

    [saveProfileChangesBtn, changePasswordBtn, uploadAvatarNowBtn, avatarUploadInput].forEach(el => {
        if (el) el.disabled = true;
    });

    if (profileDisplayAvatar) profileDisplayAvatar.src = 'https://placehold.co/120x120/6a0dad/FFFFFF?text=U';

    // Reset password inputs
    const pwInputs = [document.getElementById('current-password'), document.getElementById('new-password-profile'), document.getElementById('confirm-new-password-profile')];
    pwInputs.forEach(input => {
        if (input) {
            input.value = '';
            input.dispatchEvent(new Event('input'));
        }
    });

    // Hide avatar upload button and progress bar
    if (uploadAvatarNowBtn) uploadAvatarNowBtn.style.display = 'none';
    const uploadProgressBar = document.getElementById('upload-progress-bar');
    if (uploadProgressBar) uploadProgressBar.style.display = 'none';
}
window.updateProfileModalUILogout = updateProfileModalUILogout;


document.addEventListener('DOMContentLoaded', () => {
    // --- PROFILE MODAL FORMS ---

    // Send Verification Email button in profile modal
    const sendVerificationEmailBtn = document.getElementById('send-verification-email-btn');
    if (sendVerificationEmailBtn) {
        sendVerificationEmailBtn.addEventListener('click', async () => {
            if (window.requestAndShowVerificationEmail) {
                await window.requestAndShowVerificationEmail();
            }
        });
    }

    // Profile Edit Form Submission
    const profileEditForm = document.getElementById('profile-edit-form');
    const profileNameInput = document.getElementById('profile-name');
    const profileEmailInput = document.getElementById('profile-email');
    const saveProfileChangesBtn = document.getElementById('save-profile-changes-btn');
    const userProfileModal = document.getElementById('userProfileModal'); // Add modal element here

    if (profileEditForm) {
        profileEditForm.addEventListener('input', () => {
            const isEmailVerifiedAndEditable = window.currentUser && window.currentUser.loginMethod === 'email' && window.currentUser.isVerified;
            const isGoogleWithCustomAvatar = window.currentUser && window.currentUser.loginMethod === 'google' && window.currentUser.hasCustomAvatar;
            const isNameChanged = profileNameInput.value.trim() !== window.currentUser.name;

            if (isEmailVerifiedAndEditable || isGoogleWithCustomAvatar) {
                saveProfileChangesBtn.disabled = !isNameChanged;
            } else {
                saveProfileChangesBtn.disabled = true;
            }
        });

        profileEditForm.addEventListener('submit', async e => {
            e.preventDefault();
            if (!window.currentUser) {
                return window.showStylishPopup({ iconType: 'error', title: 'Not Logged In', message: 'You must be logged in to save changes.', buttons: [{text:'OK', action: window.closeStylishPopup}] });
            }
            if (window.currentUser.loginMethod === 'email' && !window.currentUser.isVerified) {
                return window.showStylishPopup({
                    iconType: 'warning',
                    title: 'Email Verification Required',
                    message: 'Please verify your email to update your profile. Would you like to resend the verification email?',
                    buttons: [
                        { text: 'Send Verification Email', addSpinnerOnClick: true, spinnerText: 'Sending...', action: async () => await window.requestAndShowVerificationEmail() },
                        { text: 'Later', action: window.closeStylishPopup }
                    ]
                });
            }

            const newName = profileNameInput.value.trim();
            if (!newName) {
                return window.showStylishPopup({ iconType: 'error', title: 'Name Required', message: 'Name cannot be empty.', buttons: [{text:'OK', action: window.closeStylishPopup}] });
            }

            if (window.currentUser.loginMethod === 'google' && !window.currentUser.hasCustomAvatar && newName !== window.currentUser.name) {
                return window.showStylishPopup({ iconType: 'info', title: 'Google User', message: 'Your name is managed by your Google account and cannot be changed here.', buttons: [{text:'OK', action: window.closeStylishPopup}] });
            }

            if (newName === window.currentUser.name) {
                saveProfileChangesBtn.disabled = true;
                return;
            }

            try {
                const data = await window.apiRequest(API_UPDATE_PROFILE_URL, 'PUT', { name: newName }, false, saveProfileChangesBtn, "Saving...");
                if (data.token) localStorage.setItem('nobita_jwt', data.token);
                window.currentUser = { ...window.currentUser, ...data.user };
                localStorage.setItem('nobi_user_profile', JSON.stringify(window.currentUser));

                const profileDisplayAvatar = document.getElementById('profile-display-avatar');
                if (profileDisplayAvatar) profileDisplayAvatar.src = window.currentUser.avatarUrl || `https://placehold.co/120x120/6a0dad/FFFFFF?text=${encodeURIComponent(window.currentUser.name.charAt(0).toUpperCase())}`;

                if (window.updateUIAfterLogin) window.updateUIAfterLogin();
                window.showStylishPopup({ iconType: 'success', title: 'Profile Updated!', message: data.message || 'Your profile name has been updated successfully!', buttons: [{text:'OK', action: window.closeStylishPopup}] });
                if(userProfileModal) userProfileModal.classList.remove('active'); // Auto-close modal on success
            } catch (error) {
                // Error handled by apiRequest
            }
        });
    }

    const avatarUploadInput = document.getElementById('avatar-upload-input');
    const uploadAvatarNowBtn = document.getElementById('upload-avatar-now-btn');
    const profileDisplayAvatar = document.getElementById('profile-display-avatar');
    const uploadProgressBar = document.getElementById('upload-progress-bar');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');

    if (avatarUploadInput) {
        avatarUploadInput.addEventListener('change', () => {
            if (avatarUploadInput.files.length > 0) {
                if (window.currentUser && window.currentUser.loginMethod === 'email' && !window.currentUser.isVerified) {
                    window.showStylishPopup({
                        iconType: 'warning',
                        title: 'Email Verification Required',
                        message: 'Please verify your email to upload a new avatar. Would you like to resend the verification email?',
                        buttons: [
                            { text: 'Send Email', addSpinnerOnClick: true, spinnerText:'Sending...', action: async () => await window.requestAndShowVerificationEmail() },
                            { text: 'Later', action: window.closeStylishPopup }
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
                if (window.currentUser) {
                    if (profileDisplayAvatar) profileDisplayAvatar.src = window.currentUser.avatarUrl || `https://placehold.co/120x120/6a0dad/FFFFFF?text=${encodeURIComponent(window.currentUser.name.charAt(0).toUpperCase())}`;
                    if (profileEditForm) profileEditForm.dispatchEvent(new Event('input'));
                }
            }
        });
    }

    if (uploadAvatarNowBtn) {
        uploadAvatarNowBtn.addEventListener('click', async () => {
            if (!window.currentUser) {
                return window.showStylishPopup({ iconType: 'error', title: 'Not Logged In', message: 'You must be logged in to upload an avatar.', buttons: [{text:'OK', action: window.closeStylishPopup}] });
            }
            if (window.currentUser.loginMethod === 'email' && !window.currentUser.isVerified) {
                return window.showStylishPopup({ iconType: 'warning', title: 'Email Verification Required!', message: 'Please verify your email to upload an avatar.', buttons: [{text:'OK', action: window.closeStylishPopup}]});
            }

            if (avatarUploadInput.files.length === 0) {
                return window.showStylishPopup({ iconType: 'warning', title: 'No File Selected', message: 'Please select an image file to upload.', buttons: [{text:'OK', action: window.closeStylishPopup}] });
            }
            
            const file = avatarUploadInput.files[0];
            const formData = new FormData();
            formData.append('avatar', file); // 'avatar' is the field name on backend

            const originalBtnHTML = uploadAvatarNowBtn.innerHTML;
            uploadAvatarNowBtn.disabled = true;
            uploadAvatarNowBtn.innerHTML = `<span class="nobi-spinner"></span> Uploading...`;
            if(uploadProgressBar) uploadProgressBar.style.display = 'block';
            if(progressFill) progressFill.style.width = '0%';
            if(progressText) progressText.textContent = '0%';
            
            try {
                const xhr = new XMLHttpRequest();
                xhr.open('POST', '/api/user/upload-avatar', true);
                
                const token = localStorage.getItem('nobita_jwt');
                if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

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
                            const data = JSON.parse(xhr.responseText);
                            if (data.token) localStorage.setItem('nobita_jwt', data.token);
                            
                            window.currentUser = { ...window.currentUser, ...data.user };
                            localStorage.setItem('nobi_user_profile', JSON.stringify(window.currentUser));
                            
                            if (profileDisplayAvatar) profileDisplayAvatar.src = window.currentUser.avatarUrl;
                            if (window.updateUIAfterLogin) window.updateUIAfterLogin();
                            if (window.fetchFeedbacks) await window.fetchFeedbacks();
                            
                            avatarUploadInput.value = '';
                            if(uploadAvatarNowBtn) uploadAvatarNowBtn.style.display = 'none';

                            window.showStylishPopup({ iconType: 'success', title: 'Avatar Updated!', message: 'Your new avatar has been uploaded and saved.', buttons: [{text:'OK', action: window.closeStylishPopup}] });
                            if(userProfileModal) userProfileModal.classList.remove('active');
                            resolve();
                        } else {
                            const errRes = JSON.parse(xhr.responseText);
                            reject(new Error(errRes.message || 'Avatar upload failed.'));
                        }
                    };

                    xhr.onerror = () => reject(new Error('Network error during avatar upload.'));
                    xhr.send(formData);
                });

            } catch (error) {
                window.showStylishPopup({ iconType: 'error', title: 'Upload Error!', message: error.message || 'Failed to upload avatar. Please try again.', buttons: [{text:'OK', action: window.closeStylishPopup}] });
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
            if (!window.currentUser) {
                return window.showStylishPopup({ iconType: 'error', title: 'Not Logged In', message: 'You must be logged in to change your password.', buttons: [{text:'OK', action: window.closeStylishPopup}] });
            }

            const curPw = currentPasswordInput.value;
            const newPw = newPasswordProfileInput.value;
            const confNewPw = confirmNewPasswordProfileInput.value;

            // NEW: Check if this is a "Create Password" flow
            const isCreatePassword = !window.currentUser.hasPassword;

            if (!newPw || !confNewPw) {
                return window.showStylishPopup({ iconType: 'error', title: 'Empty Fields!', message: 'All password fields are required.', buttons: [{text:'OK', action: window.closeStylishPopup}] });
            }
            if (!isCreatePassword && !curPw) {
                return window.showStylishPopup({ iconType: 'error', title: 'Empty Fields!', message: 'Current password is required to change password.', buttons: [{text:'OK', action: window.closeStylishPopup}] });
            }
            if (newPw !== confNewPw) {
                return window.showStylishPopup({ iconType: 'error', title: 'Password Mismatch!', message: 'The new passwords do not match.', buttons: [{text:'OK', action: window.closeStylishPopup}] });
            }
            if (newPw.length < 6) {
                return window.showStylishPopup({ iconType: 'error', title: 'Weak Password!', message: 'Your new password must be at least 6 characters long.', buttons: [{text:'OK', action: window.closeStylishPopup}] });
            }

            try {
                const payload = { newPassword: newPw };
                if (!isCreatePassword) {
                    payload.currentPassword = curPw;
                }

                const data = await window.apiRequest(API_CHANGE_PASSWORD_URL, 'POST', payload, false, changePasswordBtn, isCreatePassword ? "Creating Password..." : "Changing Password...");
                window.showStylishPopup({ iconType: 'success', title: 'Password Updated!', message: data.message || 'Your password has been successfully saved.', buttons: [{text:'OK', action: window.closeStylishPopup}] });

                // Update the global state and local storage with the new user data and token
                if (data.token) localStorage.setItem('nobita_jwt', data.token);
                window.currentUser = { ...window.currentUser, ...data.user };
                localStorage.setItem('nobi_user_profile', JSON.stringify(window.currentUser));

                if(userProfileModal) userProfileModal.classList.remove('active'); // Auto-close modal on success
                [currentPasswordInput, newPasswordProfileInput, confirmNewPasswordProfileInput].forEach(inp => {
                    if (inp) {
                        inp.value = '';
                        inp.dispatchEvent(new Event('input'));
                    }
                });
                if (window.updateUIAfterLogin) window.updateUIAfterLogin();
            } catch (error) {
                // Error handled by apiRequest
            }
        });
    }

    // --- NEW: DEFAULT AVATAR SELECTION LOGIC ---
    const defaultAvatarModal = document.getElementById('defaultAvatarModal');
    const chooseDefaultAvatarBtn = document.getElementById('choose-default-avatar-btn');
    const defaultAvatarDisplay = document.getElementById('default-avatar-display');
    const prevDefaultAvatarBtn = document.getElementById('prevDefaultAvatarBtn');
    const nextDefaultAvatarBtn = document.getElementById('nextDefaultAvatarBtn');
    const saveDefaultAvatarBtn = document.getElementById('saveDefaultAvatarBtn');
    const closeDefaultModalBtns = document.querySelectorAll('.close-default-modal-btn');
    
    // NOTE: Removed hard-coded defaultAvatarUrls array here.
    let defaultAvatarUrls = [];
    let currentAvatarIndex = 0;

    // New function to fetch avatars from the backend
    async function fetchDefaultAvatars() {
        if (defaultAvatarUrls.length > 0) return; // Already fetched
        try {
            const response = await window.apiRequest('/api/avatars/default', 'GET');
            defaultAvatarUrls = response.urls;
        } catch (error) {
            console.error('Failed to fetch default avatars:', error);
            window.showStylishPopup({
                iconType: 'error',
                title: 'Error',
                message: 'Failed to load default avatars. Please try again.',
                buttons: [{ text: 'OK', action: window.closeStylishPopup }]
            });
        }
    }

    function showDefaultAvatar(index) {
        if (defaultAvatarDisplay && defaultAvatarUrls.length > 0) {
            defaultAvatarDisplay.src = defaultAvatarUrls[index];
            currentAvatarIndex = index;
        }
    }

    async function showDefaultAvatarModal() {
        if (window.currentUser && window.currentUser.loginMethod === 'email' && !window.currentUser.isVerified) {
            return window.showStylishPopup({
                iconType: 'warning',
                title: 'Email Verification Required',
                message: 'Please verify your email to change your avatar.',
                buttons: [{ text: 'OK', action: window.closeStylishPopup }]
            });
        }
        if (defaultAvatarModal) {
            window.showFullScreenLoader();
            await fetchDefaultAvatars();
            window.hideFullScreenLoader();

            if (defaultAvatarUrls.length > 0) {
                // FIX: Set the initial avatar to the user's current avatar if it's in the default list
                if (window.currentUser && window.currentUser.avatarUrl) {
                    const foundIndex = defaultAvatarUrls.findIndex(url => url === window.currentUser.avatarUrl);
                    currentAvatarIndex = foundIndex !== -1 ? foundIndex : 0;
                } else {
                    currentAvatarIndex = 0;
                }
                showDefaultAvatar(currentAvatarIndex);
                defaultAvatarModal.classList.add('active');
            } else {
                 window.showStylishPopup({
                    iconType: 'error',
                    title: 'Error',
                    message: 'No default avatars available. Please try again later.',
                    buttons: [{ text: 'OK', action: window.closeStylishPopup }]
                });
            }
        }
    }

    function hideDefaultAvatarModal() {
        if (defaultAvatarModal) {
            defaultAvatarModal.classList.remove('active');
        }
    }

    if (chooseDefaultAvatarBtn) {
        chooseDefaultAvatarBtn.addEventListener('click', showDefaultAvatarModal);
    }

    if (prevDefaultAvatarBtn) {
        prevDefaultAvatarBtn.addEventListener('click', () => {
            currentAvatarIndex = (currentAvatarIndex - 1 + defaultAvatarUrls.length) % defaultAvatarUrls.length;
            showDefaultAvatar(currentAvatarIndex);
        });
    }

    if (nextDefaultAvatarBtn) {
        nextDefaultAvatarBtn.addEventListener('click', () => {
            currentAvatarIndex = (currentAvatarIndex + 1) % defaultAvatarUrls.length;
            showDefaultAvatar(currentAvatarIndex);
        });
    }

    if (saveDefaultAvatarBtn) {
        saveDefaultAvatarBtn.addEventListener('click', async () => {
            if (!window.currentUser) {
                return window.showStylishPopup({ iconType: 'error', title: 'Not Logged In', message: 'You must be logged in to save an avatar.', buttons: [{text:'OK', action: window.closeStylishPopup}] });
            }

            const selectedAvatarUrl = defaultAvatarUrls[currentAvatarIndex];

            try {
                const beRes = await window.apiRequest(API_UPDATE_PROFILE_URL, 'PUT', { avatarUrl: selectedAvatarUrl }, false, saveDefaultAvatarBtn, "Saving...");

                if (beRes.token) localStorage.setItem('nobita_jwt', beRes.token);
                window.currentUser = { ...window.currentUser, ...beRes.user };
                localStorage.setItem('nobi_user_profile', JSON.stringify(window.currentUser));

                if (profileDisplayAvatar) profileDisplayAvatar.src = window.currentUser.avatarUrl;
                if (window.updateUIAfterLogin) window.updateUIAfterLogin();
                if (window.fetchFeedbacks) await window.fetchFeedbacks();

                window.showStylishPopup({ iconType: 'success', title: 'Avatar Updated!', message: 'Your new avatar has been set successfully.', buttons: [{text:'OK', action: window.closeStylishPopup}] });
                hideDefaultAvatarModal();
            } catch (error) {
                window.showStylishPopup({ iconType: 'error', title: 'Save Error!', message: error.message || 'Failed to save avatar. Please try again.', buttons: [{text:'OK', action: window.closeStylishPopup}] });
            }
        });
    }

    if (closeDefaultModalBtns.length > 0) {
        closeDefaultModalBtns.forEach(btn => {
            btn.addEventListener('click', hideDefaultAvatarModal);
        });
    }

    if (defaultAvatarModal) {
        defaultAvatarModal.addEventListener('click', (e) => {
            if (e.target === defaultAvatarModal) {
                hideDefaultAvatarModal();
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
});
