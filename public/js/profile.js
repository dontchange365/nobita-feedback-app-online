// public/js/profile.js

document.addEventListener('DOMContentLoaded', () => {
    const profileInfoDiv = document.getElementById('profile-info');
    const updateProfileForm = document.getElementById('update-profile-form');
    const changePasswordForm = document.getElementById('change-password-form');
    const uploadAvatarForm = document.getElementById('upload-avatar-form');
    const logoutButton = document.getElementById('logout-button');
    const logoutConfirmDiv = document.getElementById('logout-confirm');
    const confirmLogoutButton = document.getElementById('confirm-logout');
    const cancelLogoutButton = document.getElementById('cancel-logout');
    const avatarPreviewDiv = document.getElementById('avatar-preview');

    let currentUser = null;

    // Function to fetch user profile
    async function fetchProfile() {
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = '/login.html'; // Redirect if not logged in
            return;
        }

        try {
            const response = await fetch('/api/users/profile', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            const data = await response.json();

            if (response.ok) {
                currentUser = data;
                profileInfoDiv.innerHTML = `
                    <p><strong>Username:</strong> ${data.username}</p>
                    <p><strong>Email:</strong> ${data.email}</p>
                    <p><strong>Admin:</strong> ${data.isAdmin ? 'Yes' : 'No'}</p>
                    <img src="${data.profilePicture}" alt="Profile Picture" style="width: 100px; height: auto; border-radius: 50%;">
                `;
                if (updateProfileForm) {
                    updateProfileForm.querySelector('#username').value = data.username;
                    updateProfileForm.querySelector('#email').value = data.email;
                }
                if (avatarPreviewDiv && data.profilePicture) {
                    avatarPreviewDiv.innerHTML = `<img src="${data.profilePicture}" alt="Current Avatar" style="max-width: 100px; height: auto; border-radius: 50%;">`;
                }
            } else {
                alert(data.message || 'Failed to fetch profile information.');
            }
        } catch (error) {
            console.error('Error fetching profile:', error);
            alert('An error occurred while fetching your profile.');
        }
    }

    // Fetch profile when the page loads
    fetchProfile();

    // --- Update Profile Form Submission ---
    if (updateProfileForm) {
        updateProfileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = updateProfileForm.querySelector('#username').value;
            const email = updateProfileForm.querySelector('#email').value;
            const token = localStorage.getItem('token');

            try {
                const response = await fetch('/api/users/profile', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                    body: JSON.stringify({ username, email }),
                });

                const data = await response.json();

                if (response.ok) {
                    alert('Profile updated successfully!');
                    fetchProfile(); // Refresh profile info
                } else {
                    alert(data.message || 'Failed to update profile.');
                }
            } catch (error) {
                console.error('Error updating profile:', error);
                alert('An error occurred while updating your profile.');
            }
        });
    }

    // --- Change Password Form Submission ---
    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const currentPassword = changePasswordForm.querySelector('#currentPassword').value;
            const newPassword = changePasswordForm.querySelector('#newPassword').value;
            const confirmPassword = changePasswordForm.querySelector('#confirmPassword').value;
            const token = localStorage.getItem('token');

            if (newPassword !== confirmPassword) {
                alert('New passwords do not match.');
                return;
            }

            try {
                const response = await fetch('/api/users/change-password', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                    body: JSON.stringify({ currentPassword, newPassword }),
                });

                const data = await response.json();

                if (response.ok) {
                    alert('Password changed successfully!');
                    changePasswordForm.reset();
                } else {
                    alert(data.message || 'Failed to change password.');
                }
            } catch (error) {
                console.error('Error changing password:', error);
                alert('An error occurred while changing your password.');
            }
        });
    }

    // --- Upload Avatar Form Submission ---
    if (uploadAvatarForm) {
        uploadAvatarForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const profilePictureFile = uploadAvatarForm.querySelector('#profilePicture').files[0];
            const token = localStorage.getItem('token');

            if (!profilePictureFile) {
                alert('Please select a profile picture to upload.');
                return;
            }

            const formData = new FormData();
            formData.append('profilePicture', profilePictureFile);

            try {
                const response = await fetch('/api/users/profile-picture', {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                    body: formData,
                });

                const data = await response.json();

                if (response.ok) {
                    alert('Profile picture updated successfully!');
                    fetchProfile(); // Refresh profile info and image
                    uploadAvatarForm.reset();
                } else {
                    alert(data.message || 'Failed to update profile picture.');
                }
            } catch (error) {
                console.error('Error uploading avatar:', error);
                alert('An error occurred while uploading your profile picture.');
            }
        });

        // --- Avatar Preview (Optional) ---
        const avatarInput = document.getElementById('profilePicture');
        if (avatarInput) {
            avatarInput.addEventListener('change', (event) => {
                const file = event.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        avatarPreviewDiv.innerHTML = `<img src="${e.target.result}" alt="New Avatar Preview" style="max-width: 100px; height: auto; border-radius: 50%;">`;
                    };
                    reader.readAsDataURL(file);
                } else {
                    // Restore current avatar if no new file selected
                    if (currentUser && currentUser.profilePicture) {
                        avatarPreviewDiv.innerHTML = `<img src="${currentUser.profilePicture}" alt="Current Avatar" style="max-width: 100px; height: auto; border-radius: 50%;">`;
                    } else {
                        avatarPreviewDiv.innerHTML = '';
                    }
                }
            });
        }
    }

    // --- Logout Functionality ---
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            logoutConfirmDiv.style.display = 'block';
        });
    }

    if (cancelLogoutButton) {
        cancelLogoutButton.addEventListener('click', () => {
            logoutConfirmDiv.style.display = 'none';
        });
    }

    if (confirmLogoutButton) {
        confirmLogoutButton.addEventListener('click', () => {
            localStorage.removeItem('token');
            localStorage.removeItem('isAdmin');
            window.location.href = '/'; // Redirect to homepage after logout
        });
    }
});