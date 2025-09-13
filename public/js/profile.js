// js/profile.js

import { showStylishPopup } from './ui.js';
import { defaultAvatars } from './defaultAvatars.js';

let profileUpdateTimeout;
let selectedDefaultAvatarUrl = null;

const profileModal = document.getElementById('userProfileModal');
const profileEditForm = document.getElementById('profile-edit-form');
const saveChangesBtn = document.getElementById('save-profile-changes-btn');
const profileNameInput = document.getElementById('profile-name');
const profileAvatarDisplay = document.getElementById('profile-display-avatar');
const avatarUploadInput = document.getElementById('avatar-upload-input');
const uploadAvatarNowBtn = document.getElementById('upload-avatar-now-btn');
const uploadProgressBar = document.getElementById('upload-progress-bar');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');
const currentPasswordGroup = document.getElementById('current-password-group');
const changePasswordForm = document.getElementById('change-password-form');
const changePasswordBtn = document.getElementById('change-password-btn');

// NEW: Avatar Gallery elements
const avatarGalleryContainer = document.getElementById('avatarGallerySection');
const showGalleryBtn = document.getElementById('showAvatarGalleryBtn');

document.addEventListener('DOMContentLoaded', () => {
    // Check if the user is on a page where the profile feature is available
    if (!profileModal) return;

    // Existing event listeners...
    document.addEventListener('click', (e) => {
        if (e.target.matches('[data-modal-close]')) {
            const modalId = e.target.getAttribute('data-modal-close');
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.classList.remove('active');
                if (modalId === 'userProfileModal') {
                    resetProfileModalState();
                }
            }
        }
    });

    profileEditForm.addEventListener('input', () => {
        clearTimeout(profileUpdateTimeout);
        profileUpdateTimeout = setTimeout(() => {
            const user = JSON.parse(localStorage.getItem('user'));
            const currentName = user ? user.name : '';
            const currentAvatar = user ? user.avatarUrl : '';

            const isNameChanged = profileNameInput.value.trim() !== currentName;
            const isAvatarChanged = profileAvatarDisplay.src !== currentAvatar;

            if (isNameChanged || isAvatarChanged) {
                saveChangesBtn.style.display = 'block';
            } else {
                saveChangesBtn.style.display = 'none';
            }
        }, 300);
    });

    profileEditForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newName = profileNameInput.value.trim();
        const newAvatar = profileAvatarDisplay.src;
        await updateProfile(newName, newAvatar);
    });

    avatarUploadInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = function(e) {
                profileAvatarDisplay.src = e.target.result;
                uploadAvatarNowBtn.style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    });

    uploadAvatarNowBtn.addEventListener('click', async () => {
        const file = avatarUploadInput.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('avatar', file);

        await uploadAvatar(formData);
    });

    changePasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password-profile').value;
        const confirmNewPassword = document.getElementById('confirm-new-password-profile').value;
        await changePassword(currentPassword, newPassword, confirmNewPassword);
    });

    // NEW: Show/Hide Avatar Gallery
    if (showGalleryBtn) {
        showGalleryBtn.addEventListener('click', () => {
            if (avatarGalleryContainer.style.display === 'block') {
                avatarGalleryContainer.style.display = 'none';
                showGalleryBtn.innerHTML = `<i class="fas fa-images"></i> Choose Default Avatar`;
            } else {
                renderDefaultAvatars();
                avatarGalleryContainer.style.display = 'block';
                showGalleryBtn.innerHTML = `<i class="fas fa-times-circle"></i> Hide Gallery`;
            }
        });
    }
});

// NEW: Function to render default avatars
function renderDefaultAvatars() {
    const defaultAvatarsGrid = document.createElement('div');
    defaultAvatarsGrid.className = 'default-avatars-grid';

    // Get current user avatar to show it first
    const currentUser = JSON.parse(localStorage.getItem('user'));
    let currentAvatarUrl = currentUser.avatarUrl;

    // Check if the current avatar is one of the default ones
    const isCurrentAvatarDefault = defaultAvatars.some(avatar => avatar.url === currentAvatarUrl);

    // Filter out the current avatar if it's in the default list
    const filteredAvatars = defaultAvatars.filter(avatar => avatar.url !== currentAvatarUrl);

    // If the current avatar is a default one, show it first
    if (isCurrentAvatarDefault) {
        const currentAvatarItem = document.createElement('div');
        currentAvatarItem.className = 'default-avatar-item selected';
        currentAvatarItem.dataset.avatarUrl = currentAvatarUrl;
        currentAvatarItem.innerHTML = `<img src="${currentAvatarUrl}" alt="Selected Avatar">`;
        defaultAvatarsGrid.appendChild(currentAvatarItem);
    }

    // Add remaining default avatars
    filteredAvatars.forEach(avatar => {
        const avatarItem = document.createElement('div');
        avatarItem.className = 'default-avatar-item';
        avatarItem.dataset.avatarUrl = avatar.url;
        avatarItem.innerHTML = `<img src="${avatar.url}" alt="Default Avatar">`;
        defaultAvatarsGrid.appendChild(avatarItem);
    });

    // Handle clicks on avatars in the gallery
    defaultAvatarsGrid.addEventListener('click', (e) => {
        const selectedAvatarItem = e.target.closest('.default-avatar-item');
        if (selectedAvatarItem) {
            // Remove 'selected' class from all other items
            document.querySelectorAll('.default-avatar-item').forEach(item => item.classList.remove('selected'));
            // Add 'selected' class to the clicked item
            selectedAvatarItem.classList.add('selected');
            // Update the main profile display with the new avatar
            const newAvatarUrl = selectedAvatarItem.dataset.avatarUrl;
            profileAvatarDisplay.src = newAvatarUrl;
            selectedDefaultAvatarUrl = newAvatarUrl;
            // Hide custom upload elements if a default avatar is selected
            avatarUploadInput.value = '';
            uploadAvatarNowBtn.style.display = 'none';
            // Show Save Changes button
            saveChangesBtn.style.display = 'block';
        }
    });

    // Clear and append the new grid
    avatarGalleryContainer.innerHTML = '';
    const galleryTitle = document.createElement('h4');
    galleryTitle.textContent = "Choose a default avatar";
    avatarGalleryContainer.appendChild(galleryTitle);
    avatarGalleryContainer.appendChild(defaultAvatarsGrid);
}

// Function to update user profile
async function updateProfile(newName, newAvatarUrl) {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        showStylishPopup('Error', 'Please log in to update your profile.', 'error');
        return;
    }
    const token = localStorage.getItem('token');
    const oldAvatarUrl = user.avatarUrl;

    // Use selectedDefaultAvatarUrl if a default avatar was chosen, otherwise use the current display avatar.
    const finalAvatarUrl = selectedDefaultAvatarUrl || newAvatarUrl;

    if (newName === user.name && finalAvatarUrl === oldAvatarUrl) {
        showStylishPopup('Info', 'No changes detected.', 'info');
        return;
    }

    const payload = {
        name: newName,
        avatarUrl: finalAvatarUrl
    };

    saveChangesBtn.disabled = true;
    saveChangesBtn.innerHTML = `<span class="nobi-spinner"></span> Saving...`;

    try {
        const response = await fetch('/api/user/profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (response.ok) {
            localStorage.setItem('user', JSON.stringify(data.user));
            localStorage.setItem('token', data.token);
            updateProfileUI(data.user);
            showStylishPopup('Success!', data.message, 'success');
        } else {
            showStylishPopup('Error!', data.message, 'error');
        }
    } catch (error) {
        console.error('Update profile error:', error);
        showStylishPopup('Error!', 'An error occurred while updating profile.', 'error');
    } finally {
        saveChangesBtn.disabled = false;
        saveChangesBtn.innerHTML = `Save Changes`;
        saveChangesBtn.style.display = 'none';
        selectedDefaultAvatarUrl = null; // Reset the selected URL
    }
}

// Function to upload avatar
async function uploadAvatar(formData) {
    const token = localStorage.getItem('token');
    uploadAvatarNowBtn.disabled = true;
    uploadAvatarNowBtn.innerHTML = `<span class="nobi-spinner"></span> Uploading...`;
    uploadProgressBar.style.display = 'block';
    progressFill.style.width = '0%';
    progressText.textContent = '0%';

    try {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/user/upload-avatar', true);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);

        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percentComplete = (e.loaded / e.total) * 100;
                progressFill.style.width = percentComplete.toFixed(0) + '%';
                progressText.textContent = percentComplete.toFixed(0) + '%';
            }
        });

        const response = await new Promise((resolve, reject) => {
            xhr.onload = () => {
                const data = JSON.parse(xhr.responseText);
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve(data);
                } else {
                    reject(data);
                }
            };
            xhr.onerror = () => reject(new Error('Network error.'));
            xhr.send(formData);
        });

        localStorage.setItem('user', JSON.stringify(response.user));
        localStorage.setItem('token', response.token);
        updateProfileUI(response.user);
        showStylishPopup('Success!', response.message, 'success');

    } catch (error) {
        console.error('Upload avatar error:', error);
        showStylishPopup('Error!', error.message || 'An error occurred during upload.', 'error');
    } finally {
        uploadAvatarNowBtn.disabled = false;
        uploadAvatarNowBtn.innerHTML = `<i class="fas fa-upload"></i> Upload Avatar`;
        uploadAvatarNowBtn.style.display = 'none';
        uploadProgressBar.style.display = 'none';
    }
}

// Function to handle password change
async function changePassword(currentPassword, newPassword, confirmNewPassword) {
    // Basic validation
    if (!newPassword || newPassword.length < 6) {
        showStylishPopup('Error', 'New password must be at least 6 characters long.', 'error');
        return;
    }
    if (newPassword !== confirmNewPassword) {
        showStylishPopup('Error', 'New passwords do not match.', 'error');
        return;
    }

    const user = JSON.parse(localStorage.getItem('user'));
    if (user.loginMethod === 'email' && user.hasPassword === false) {
        // If user is Google login but needs to set a password
    } else {
        if (!currentPassword) {
            showStylishPopup('Error', 'Current password is required to change password.', 'error');
            return;
        }
    }

    const token = localStorage.getItem('token');
    const payload = { currentPassword, newPassword };

    changePasswordBtn.disabled = true;
    changePasswordBtn.innerHTML = `<span class="nobi-spinner"></span> Updating...`;

    try {
        const response = await fetch('/api/user/change-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (response.ok) {
            localStorage.setItem('user', JSON.stringify(data.user));
            localStorage.setItem('token', data.token);
            updateProfileUI(data.user);
            showStylishPopup('Success!', data.message, 'success');
            changePasswordForm.reset();
        } else {
            showStylishPopup('Error!', data.message, 'error');
        }
    } catch (error) {
        console.error('Change password error:', error);
        showStylishPopup('Error!', 'An error occurred while changing password.', 'error');
    } finally {
        changePasswordBtn.disabled = false;
        changePasswordBtn.innerHTML = `Change Password`;
    }
}

// Function to update the UI with new user data
function updateProfileUI(user) {
    if (user && user.isVerified) {
        document.getElementById('email-verification-prompt').style.display = 'none';
        document.getElementById('feedback-verification-prompt')?.style.display = 'none';
        document.getElementById('send-verification-email-btn-form')?.disabled = true;
    } else {
        document.getElementById('email-verification-prompt').style.display = 'flex';
        document.getElementById('feedback-verification-prompt')?.style.display = 'flex';
        document.getElementById('send-verification-email-btn-form')?.disabled = false;
    }
    document.getElementById('profile-name').value = user.name;
    document.getElementById('profile-email').value = user.email;
    document.getElementById('profile-display-avatar').src = user.avatarUrl;
    document.getElementById('menu-avatar').src = user.avatarUrl;
    document.getElementById('user-profile-avatar').src = user.avatarUrl;
    document.getElementById('menu-username').textContent = user.name;
    document.getElementById('user-profile-name').textContent = user.name;
    const currentPasswordInput = document.getElementById('current-password');
    if (currentPasswordInput) {
        if (user.loginMethod === 'google' && !user.hasPassword) {
            currentPasswordGroup.style.display = 'none';
            document.getElementById('new-password-profile').placeholder = 'Create new password';
            document.getElementById('confirm-new-password-profile').placeholder = 'Confirm new password';
            document.getElementById('change-password-btn').textContent = 'Create Password';
        } else {
            currentPasswordGroup.style.display = 'flex';
            document.getElementById('new-password-profile').placeholder = '';
            document.getElementById('confirm-new-password-profile').placeholder = '';
            document.getElementById('change-password-btn').textContent = 'Change Password';
        }
    }
}

function resetProfileModalState() {
    saveChangesBtn.style.display = 'none';
    uploadAvatarNowBtn.style.display = 'none';
    uploadProgressBar.style.display = 'none';
    profileEditForm.reset();
    changePasswordForm.reset();
    selectedDefaultAvatarUrl = null;
    // Hide the gallery section when closing the modal
    if (avatarGalleryContainer) {
        avatarGalleryContainer.style.display = 'none';
        showGalleryBtn.innerHTML = `<i class="fas fa-images"></i> Choose Default Avatar`;
    }
}

export { updateProfileUI };
