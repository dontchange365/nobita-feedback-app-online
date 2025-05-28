document.addEventListener('DOMContentLoaded', () => {
    const editProfileForm = document.getElementById('edit-profile-form');
    const editProfileName = document.getElementById('edit-profile-name');
    const avatarUploadZone = document.getElementById('avatar-upload-zone');
    const avatarUploadInput = document.getElementById('avatar-upload-input');
    const avatarPreview = document.getElementById('avatar-preview');

    let selectedFile = null;

    // Handle drag and drop for avatar upload
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        avatarUploadZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        avatarUploadZone.addEventListener(eventName, () => avatarUploadZone.classList.add('border-indigo-500'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        avatarUploadZone.addEventListener(eventName, () => avatarUploadZone.classList.remove('border-indigo-500'), false);
    });

    avatarUploadZone.addEventListener('drop', handleDrop, false);
    avatarUploadInput.addEventListener('change', handleFileSelect, false);
    avatarUploadZone.addEventListener('click', () => avatarUploadInput.click()); // Click zone to open file dialog

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    }

    function handleFileSelect(e) {
        const files = e.target.files;
        handleFiles(files);
    }

    function handleFiles(files) {
        if (files.length > 0) {
            selectedFile = files[0];
            const reader = new FileReader();
            reader.onload = (e) => {
                avatarPreview.src = e.target.result;
                avatarPreview.classList.remove('hidden');
            };
            reader.readAsDataURL(selectedFile);
        }
    }

    editProfileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        if (!token) {
            showToast('Session expired. Please log in again.', 'error');
            openModal(document.getElementById('auth-modal'));
            return;
        }

        const formData = new FormData();
        formData.append('name', editProfileName.value.trim());
        if (selectedFile) {
            formData.append('avatar', selectedFile);
        }

        try {
            const response = await fetch('/api/user/profile', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData // FormData sets Content-Type to multipart/form-data automatically
            });
            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('userName', data.user.name);
                localStorage.setItem('userAvatar', data.user.avatar);
                showToast('Profile updated successfully!', 'success');
                closeModal(document.getElementById('edit-profile-modal'));
                // Update UI elements that display user info
                document.getElementById('user-avatar').src = data.user.avatar;
                document.getElementById('welcome-message').textContent = `Welcome, ${data.user.name}!`;
            } else {
                showToast(data.message || 'Failed to update profile.', 'error');
                if (response.status === 401) {
                    localStorage.removeItem('token');
                    window.updateAuthUI();
                    window.openModal(document.getElementById('auth-modal'));
                }
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            showToast('An error occurred during profile update.', 'error');
        }
    });
});
