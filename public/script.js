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
    const modalLoginFromSignupLink = document.getElementById('modal-login-from-signup-link');

    // User Profile Modal Elements
    const avatarInput = document.getElementById('avatar-input');
    const uploadAvatarBtn = document.getElementById('upload-avatar-btn');
    const avatarUploadProgress = document.getElementById('avatar-upload-progress');
    const editProfileUsernameInput = document.getElementById('edit-profile-username');
    const currentPasswordInput = document.getElementById('current-password');
    const newPasswordInput = document.getElementById('new-password');
    const saveProfileChangesBtn = document.getElementById('save-profile-changes-btn');
    const profileSpinner = document.getElementById('profile-spinner');

    // Spinners
    const loginSpinner = document.getElementById('login-spinner');
    const signupSpinner = document.getElementById('signup-spinner');

    // Close buttons for modals
    document.querySelectorAll('.close-button').forEach(button => {
        button.addEventListener('click', () => {
            loginModal.classList.remove('active');
            signupModal.classList.remove('active');
            userProfileModal.classList.remove('active');
        });
    });

    // Toast Notification Function
    function showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.classList.add('toast', type);

        let iconClass = '';
        if (type === 'success') {
            iconClass = 'fas fa-check-circle';
        } else if (type === 'error') {
            iconClass = 'fas fa-times-circle';
        } else if (type === 'info') {
            iconClass = 'fas fa-info-circle';
        } else if (type === 'confirm') {
            iconClass = 'fas fa-exclamation-triangle';
        }

        toast.innerHTML = `<i class="icon ${iconClass}"></i><span>${message}</span>`;
        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('show');
        }, 10); // Small delay to trigger CSS transition

        setTimeout(() => {
            toast.classList.remove('show');
            toast.addEventListener('transitionend', () => toast.remove());
        }, 4000);
    }

    // Typed.js for hero section
    new Typed('.typed-text', {
        strings: ["NOBITA's Feedback Portal", "Your Valuable Feedback", "Help Us Improve"],
        typeSpeed: 70,
        backSpeed: 40,
        loop: true,
        showCursor: true,
        cursorChar: '|',
    });

    // Star Rating Logic
    const starRatingContainer = document.getElementById('star-rating');
    const ratingInput = document.getElementById('rating');
    const stars = starRatingContainer.querySelectorAll('.star');

    stars.forEach(star => {
        star.addEventListener('mouseover', () => {
            const value = parseInt(star.dataset.value);
            stars.forEach(s => {
                s.classList.toggle('hovered', parseInt(s.dataset.value) <= value);
            });
        });

        star.addEventListener('mouseout', () => {
            stars.forEach(s => s.classList.remove('hovered'));
        });

        star.addEventListener('click', () => {
            const value = parseInt(star.dataset.value);
            ratingInput.value = value;
            stars.forEach(s => {
                s.classList.toggle('selected', parseInt(s.dataset.value) <= value);
            });
        });
    });

    // --- Authentication Flow ---

    // Show Login Modal
    loginIconTrigger.addEventListener('click', () => {
        if (!localStorage.getItem('token')) {
            loginModal.classList.add('active');
        } else {
            // If logged in, show user menu
            userMenu.classList.toggle('active');
        }
    });

    // Show User Menu / Profile
    userAvatarTrigger.addEventListener('click', () => {
        userMenu.classList.toggle('active');
    });

    // Hide user menu when clicking outside
    document.addEventListener('click', (event) => {
        if (!userMenu.contains(event.target) && !userAvatarTrigger.contains(event.target) && !loginIconTrigger.contains(event.target) && !loginModal.contains(event.target) && !signupModal.contains(event.target) && !userProfileModal.contains(event.target)) {
            userMenu.classList.remove('active');
            // loginModal.classList.remove('active'); // Keep modals open if active
            // signupModal.classList.remove('active');
            // userProfileModal.classList.remove('active');
        }
    });

    // Switch to Signup
    modalCreateAccountLink.addEventListener('click', (e) => {
        e.preventDefault();
        loginModal.classList.remove('active');
        signupModal.classList.add('active');
    });

    // Switch back to Login
    modalLoginFromSignupLink.addEventListener('click', (e) => {
        e.preventDefault();
        signupModal.classList.remove('active');
        loginModal.classList.add('active');
    });

    // Google Login Handler
    const client = new google.accounts.oauth2.Overly({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response) => {
            console.log("Google ID token:", response.credential);
            try {
                loginSpinner.classList.add('active');
                const res = await fetch('/api/auth/google-login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: response.credential })
                });
                const data = await res.json();
                if (res.ok) {
                    localStorage.setItem('token', data.token);
                    showToast('Google Login Successful!', 'success');
                    loginModal.classList.remove('active');
                    checkLoginStatus(); // Update UI
                } else {
                    showToast(data.message || 'Google login failed!', 'error');
                }
            } catch (error) {
                console.error('Error during Google login:', error);
                showToast('Google login mein kuch dikkat aayi.', 'error');
            } finally {
                loginSpinner.classList.remove('active');
            }
        },
        auto_select: true
    });
    // This is the correct way to trigger Google One Tap/Popup
    // You should use google.accounts.id.renderButton or google.accounts.id.prompt
    // For direct button click, we will use a hidden div that Google renders.
    // Make sure your HTML has: <div id="g_id_onload" data-client_id="YOUR_CLIENT_ID" data-callback="handleCredentialResponse" data-auto_select="true"></div>
    // and a button: <div class="g_id_signin" data-type="standard"></div>

    // If you want to use the modalGoogleLoginBtn for a popup, you'd configure the client.
    // For simplicity with Overly (which implies a popup/redirect flow), this might be simplified.
    // Let's assume for now, it's tied to an implicit flow or that the GSI script handles the button click.
    // If you need a custom button to trigger a popup, you'd use google.accounts.id.prompt();
    modalGoogleLoginBtn.addEventListener('click', () => {
        // This will trigger the Google One Tap or popup if configured
        client.prompt(); 
    });


    // Email Login
    emailLoginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = modalLoginEmailInput.value;
        const password = modalLoginPasswordInput.value;

        try {
            loginSpinner.classList.add('active');
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (res.ok) {
                localStorage.setItem('token', data.token);
                showToast('Login Successful!', 'success');
                loginModal.classList.remove('active');
                checkLoginStatus(); // Update UI
            } else {
                showToast(data.message || 'Login failed!', 'error');
            }
        } catch (error) {
            console.error('Error during email login:', error);
            showToast('Login mein kuch dikkat aayi.', 'error');
        } finally {
            loginSpinner.classList.remove('active');
        }
    });

    // Email Signup
    emailSignupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = modalSignupUsernameInput.value;
        const email = modalSignupEmailInput.value;
        const password = modalSignupPasswordInput.value;

        try {
            signupSpinner.classList.add('active');
            const res = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: username, email, password })
            });
            const data = await res.json();
            if (res.ok) {
                showToast('Signup Successful! Ab login karein.', 'success');
                signupModal.classList.remove('active');
                loginModal.classList.add('active'); // Show login modal after signup
            } else {
                showToast(data.message || 'Signup failed!', 'error');
            }
        } catch (error) {
            console.error('Error during email signup:', error);
            showToast('Signup mein kuch dikkat aayi.', 'error');
        } finally {
            signupSpinner.classList.remove('active');
        }
    });

    // Forgot Password Link
    modalForgotPasswordLink.addEventListener('click', async (e) => {
        e.preventDefault();
        const email = modalLoginEmailInput.value; // Pre-fill with entered email

        if (!email) {
            showToast('Please enter your email in the login field first.', 'info');
            return;
        }

        const confirmReset = confirm(`Kya aap ${email} ke liye password reset karna chahte hain?`);
        if (!confirmReset) return;

        try {
            loginSpinner.classList.add('active'); // Use login spinner for this action
            const res = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const data = await res.json();
            if (res.ok) {
                showToast(data.message || 'Password reset link sent to your email!', 'success');
            } else {
                showToast(data.message || 'Failed to send password reset link.', 'error');
            }
        } catch (error) {
            console.error('Error during forgot password:', error);
            showToast('Password reset mein kuch dikkat aayi.', 'error');
        } finally {
            loginSpinner.classList.remove('active');
        }
    });

    // Logout Function
    document.getElementById('logout-menu-item').addEventListener('click', () => {
        localStorage.removeItem('token');
        showToast('Successfully logged out!', 'info');
        updateUIAfterLogout();
        userMenu.classList.remove('active'); // Hide menu after logout
        fetchFeedbacks(); // Refresh feedbacks to reflect guest mode
    });

    // View Profile
    document.getElementById('view-profile-menu-item').addEventListener('click', async () => {
        userMenu.classList.remove('active');
        userProfileModal.classList.add('active');
        profileSpinner.classList.add('active');
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                showToast('Aap logged in nahi hain.', 'error');
                return;
            }
            const res = await fetch('/api/user/profile', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) {
                populateUserProfileModal(data.user);
            } else {
                showToast(data.message || 'Profile fetch failed!', 'error');
            }
        } catch (error) {
            console.error('Error fetching profile:', error);
            showToast('Profile fetch mein kuch dikkat aayi.', 'error');
        } finally {
            profileSpinner.classList.remove('active');
        }
    });

    // Populate User Profile Modal
    async function populateUserProfileModal(user) {
        if (user) {
            document.getElementById('profile-username').textContent = user.name || 'N/A';
            document.getElementById('profile-email').textContent = user.email || 'N/A';
            document.getElementById('profile-account-type').textContent = user.googleId ? 'Google Account' : 'Email/Password';
            
            const googleIdGroup = document.querySelector('.google-id-group');
            if (user.googleId) {
                googleIdGroup.style.display = 'flex';
                document.getElementById('profile-google-id').textContent = user.googleId;
            } else {
                googleIdGroup.style.display = 'none';
            }

            // Set values for edit form
            editProfileUsernameInput.value = user.name || '';
            currentPasswordInput.value = '';
            newPasswordInput.value = '';

            // Avatar setup
            const currentAvatarUrl = user.avatarUrl || 'https://api.dicebear.com/8.x/initials/svg?seed=Nobita&backgroundType=gradientLinear';
            document.getElementById('profile-avatar-preview').src = currentAvatarUrl;
            document.getElementById('profile-avatar-preview').style.display = 'block';

            // Hide upload button and progress initially
            uploadAvatarBtn.style.display = 'none';
            avatarUploadProgress.style.display = 'none';
            avatarUploadProgress.textContent = 'Uploading: 0%';

        }
    }

    // Avatar input change listener
    avatarInput.addEventListener('change', (event) => {
        if (event.target.files.length > 0) {
            const file = event.target.files[0];
            const reader = new FileReader();
            reader.onload = (e) => {
                document.getElementById('profile-avatar-preview').src = e.target.result;
                uploadAvatarBtn.style.display = 'block'; // Show upload button when a file is chosen
            };
            reader.readAsDataURL(file);
        } else {
            // No file selected, hide upload button
            uploadAvatarBtn.style.display = 'none';
            avatarUploadProgress.style.display = 'none';
        }
    });

    // Upload Avatar button click handler
    uploadAvatarBtn.addEventListener('click', async () => {
        const file = avatarInput.files[0];
        if (!file) {
            showToast('Please select an avatar file first!', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('avatar', file);

        uploadAvatarBtn.disabled = true; // Disable button during upload
        avatarUploadProgress.style.display = 'block';
        avatarUploadProgress.textContent = 'Uploading: 0%';

        try {
            const token = localStorage.getItem('token');
            if (!token) {
                showToast('Aap logged in nahi hain.', 'error');
                uploadAvatarBtn.disabled = false;
                avatarUploadProgress.style.display = 'none';
                return;
            }

            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/upload-avatar', true);
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);

            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    const percent = Math.round((event.loaded / event.total) * 100);
                    avatarUploadProgress.textContent = `Uploading: ${percent}%`;
                }
            };

            xhr.onload = async () => {
                uploadAvatarBtn.disabled = false;
                avatarUploadProgress.style.display = 'none';
                if (xhr.status >= 200 && xhr.status < 300) {
                    const data = JSON.parse(xhr.responseText);
                    showToast(data.message || 'Avatar successfully uploaded!', 'success');
                    // Update avatar on UI after successful upload
                    const newAvatarUrl = data.newAvatarUrl;
                    userAvatarTriggerImg.src = newAvatarUrl;
                    document.getElementById('profile-avatar-preview').src = newAvatarUrl;
                    // Optionally, clear the input field after successful upload
                    avatarInput.value = '';
                    uploadAvatarBtn.style.display = 'none'; // Hide upload button after successful upload
                    checkLoginStatus(); // Re-fetch user data to ensure UI is updated
                } else {
                    const errorData = JSON.parse(xhr.responseText);
                    showToast(errorData.message || 'Avatar upload failed!', 'error');
                }
            };

            xhr.onerror = () => {
                uploadAvatarBtn.disabled = false;
                avatarUploadProgress.style.display = 'none';
                showToast('Network error during avatar upload!', 'error');
            };

            xhr.send(formData);

        } catch (error) {
            console.error('Error uploading avatar:', error);
            showToast('Avatar upload mein kuch dikkat aayi.', 'error');
            uploadAvatarBtn.disabled = false;
            avatarUploadProgress.style.display = 'none';
        }
    });


    // Save Profile Changes
    saveProfileChangesBtn.addEventListener('click', async () => {
        const newName = editProfileUsernameInput.value;
        const oldPassword = currentPasswordInput.value;
        const newPassword = newPasswordInput.value;

        if (!newName.trim()) {
            showToast('Username khali nahi ho sakta.', 'error');
            return;
        }

        if (newPassword && newPassword.length < 6) {
            showToast('Naya password kam se kam 6 characters ka hona chahiye.', 'error');
            return;
        }

        // If new password is provided, old password must also be provided
        if (newPassword && !oldPassword) {
            showToast('Naya password set karne ke liye, current password daalein.', 'error');
            return;
        }
        
        // If old password is provided, but no new password, it's an error
        if (oldPassword && !newPassword) {
            showToast('Current password diya hai, lekin naya password nahi. Agar password change karna hai, toh naya password bhi daalein.', 'error');
            return;
        }


        profileSpinner.classList.add('active');
        saveProfileChangesBtn.disabled = true;

        try {
            const token = localStorage.getItem('token');
            if (!token) {
                showToast('Aap logged in nahi hain.', 'error');
                return;
            }

            const updateData = {
                name: newName,
                oldPassword: oldPassword,
                newPassword: newPassword,
            };

            const res = await fetch('/api/user/profile', {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify(updateData)
            });
            const data = await res.json();
            if (res.ok) {
                showToast(data.message || 'Profile successfully updated!', 'success');
                userProfileModal.classList.remove('active');
                checkLoginStatus(); // Re-fetch user data to ensure UI is updated
                fetchFeedbacks(); // Refresh feedbacks to update names
            } else {
                showToast(data.message || 'Profile update failed!', 'error');
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            showToast('Profile update mein kuch dikkat aayi.', 'error');
        } finally {
            profileSpinner.classList.remove('active');
            saveProfileChangesBtn.disabled = false;
        }
    });

    // Update UI based on login status
    async function checkLoginStatus() {
        const token = localStorage.getItem('token');
        const loginIcon = loginIconTrigger.querySelector('i');

        if (token) {
            loginIcon.classList.remove('fa-lock');
            loginIcon.classList.add('fa-user');
            loginIconTrigger.title = 'Logged In';
            userAvatarTrigger.style.display = 'flex'; // Show avatar trigger
            loginIconTrigger.style.display = 'none'; // Hide login button

            try {
                const res = await fetch('/api/user/current', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (res.ok) {
                    document.getElementById('feedback-form-username').textContent = data.user.name;
                    document.getElementById('name').value = data.user.name;
                    document.getElementById('name').disabled = true; // Disable name input if logged in
                    userAvatarTriggerImg.src = data.user.avatarUrl || 'https://api.dicebear.com/8.x/initials/svg?seed=Nobita&backgroundType=gradientLinear';
                    // Update userMenu list based on admin status
                    updateUserMenu(data.user.role);
                } else {
                    console.error('Failed to fetch user data:', data.message);
                    updateUIAfterLogout(); // Fallback to logout state
                }
            } catch (error) {
                console.error('Error checking login status:', error);
                updateUIAfterLogout(); // Fallback to logout state
            }
        } else {
            updateUIAfterLogout();
        }
        fetchFeedbacks(); // Always fetch feedbacks to load current state
    }

    function updateUIAfterLogout() {
        const loginIcon = loginIconTrigger.querySelector('i');
        loginIcon.classList.remove('fa-user');
        loginIcon.classList.add('fa-lock');
        loginIconTrigger.title = 'Login / Sign Up';
        userAvatarTrigger.style.display = 'none'; // Hide avatar trigger
        loginIconTrigger.style.display = 'flex'; // Show login button

        document.getElementById('feedback-form-username').textContent = 'Guest';
        document.getElementById('name').value = ''; // Clear guest name
        document.getElementById('name').disabled = false; // Enable name input for guest
        
        // Hide admin-specific menu items
        const adminMenuItem = document.getElementById('admin-dashboard-menu-item'); // Assuming you might have one
        if (adminMenuItem) adminMenuItem.remove();
        
        userAvatarTriggerImg.src = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='; // Placeholder for guest
    }

    function updateUserMenu(userRole) {
        // Clear existing admin menu items to prevent duplicates
        const existingAdminMenuItem = document.getElementById('admin-dashboard-menu-item');
        if (existingAdminMenuItem) existingAdminMenuItem.remove();

        if (userRole === 'admin') {
            const userMenuList = document.getElementById('user-menu-list');
            const adminDashboardItem = document.createElement('li');
            adminDashboardItem.id = 'admin-dashboard-menu-item';
            adminDashboardItem.textContent = 'Admin Dashboard';
            // Insert before logout item or at the end
            const logoutItem = document.getElementById('logout-menu-item');
            userMenuList.insertBefore(adminDashboardItem, logoutItem);

            adminDashboardItem.addEventListener('click', () => {
                showToast('Admin Dashboard functionality here (e.g., redirect to /admin)', 'info');
                userMenu.classList.remove('active');
                // window.location.href = '/admin'; // Example redirect
            });
        }
    }


    // --- Feedback Submission ---
    const feedbackForm = document.getElementById('feedback-form');
    const submitFeedbackBtn = document.getElementById('submit-feedback');

    submitFeedbackBtn.addEventListener('click', async () => {
        const name = document.getElementById('name').value.trim();
        const feedbackText = document.getElementById('feedback').value.trim();
        const rating = parseInt(ratingInput.value);
        const token = localStorage.getItem('token');

        if (!name && !token) { // If not logged in, name is required
            showToast('Please enter your name.', 'error');
            return;
        }
        if (!feedbackText) {
            showToast('Please enter your feedback.', 'error');
            return;
        }
        if (rating === 0) {
            showToast('Please select a star rating.', 'error');
            return;
        }

        submitFeedbackBtn.disabled = true; // Disable button during submission
        showToast('Submitting feedback...', 'info');

        try {
            const headers = { 'Content-Type': 'application/json' };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const res = await fetch('/api/feedbacks', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ name, feedback: feedbackText, rating })
            });

            const data = await res.json();
            if (res.ok) {
                showToast(data.message || 'Feedback submitted successfully!', 'success');
                feedbackForm.reset(); // Clear form
                ratingInput.value = '0'; // Reset hidden rating
                stars.forEach(s => s.classList.remove('selected', 'hovered')); // Clear stars
                createConfetti(); // Yay!
                fetchFeedbacks(); // Refresh list to show new feedback
            } else {
                showToast(data.message || 'Failed to submit feedback.', 'error');
            }
        } catch (error) {
            console.error('Error submitting feedback:', error);
            showToast('Feedback submit karne mein kuch dikkat aayi.', 'error');
        } finally {
            submitFeedbackBtn.disabled = false; // Re-enable button
        }
    });

    // --- Fetch and Display Feedbacks ---
    const feedbackListContainer = document.getElementById('feedback-list-container');

    async function fetchFeedbacks() {
        try {
            const token = localStorage.getItem('token');
            const headers = {};
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const res = await fetch('/api/feedbacks', { headers });
            const data = await res.json();

            if (res.ok) {
                displayFeedbacks(data.feedbacks, data.userRole);
                displayAverageRating(data.averageRating);
            } else {
                showToast(data.message || 'Failed to fetch feedbacks.', 'error');
            }
        } catch (error) {
            console.error('Error fetching feedbacks:', error);
            showToast('Feedbacks fetch karne mein kuch dikkat aayi.', 'error');
        }
    }

    function displayAverageRating(averageRating) {
        const averageRatingDisplay = document.getElementById('average-rating-display');
        if (averageRating !== null && averageRating !== undefined) {
            const roundedRating = averageRating.toFixed(1);
            let starsHtml = '';
            for (let i = 1; i <= 5; i++) {
                if (i <= Math.round(averageRating)) {
                    starsHtml += '<span class="star selected">★</span>';
                } else {
                    starsHtml += '<span class="star">★</span>';
                }
            }
            averageRatingDisplay.innerHTML = `Overall Rating: ${roundedRating} ${starsHtml}`;
        } else {
            averageRatingDisplay.innerHTML = 'No ratings yet.';
        }
    }


    function displayFeedbacks(feedbacks, userRole) {
        // Clear existing feedbacks except for the heading and average rating
        const existingFeedbackItems = feedbackListContainer.querySelectorAll('.feedback-item');
        existingFeedbackItems.forEach(item => item.remove());

        if (feedbacks.length === 0) {
            feedbackListContainer.innerHTML += '<p style="text-align: center; color: var(--text-color-light); opacity: 0.8;">Koi feedback nahi hai abhi tak. Pehle feedback submit karein!</p>';
            return;
        }

        feedbacks.forEach(fbData => {
            createFeedbackItem(fbData, userRole);
        });
    }

    function createFeedbackItem(fbData, userRole) {
        const item = document.createElement('div');
        item.classList.add('feedback-item');
        item.setAttribute('data-feedback-id', fbData._id); // Add data-id for easy access

        const avatarImg = document.createElement('img');
        avatarImg.classList.add('feedback-avatar');
        avatarImg.src = fbData.avatarUrl || 'https://api.dicebear.com/8.x/initials/svg?seed=Nobita&backgroundType=gradientLinear';
        avatarImg.alt = 'User Avatar';

        const detailsDiv = document.createElement('div');
        detailsDiv.classList.add('feedback-content');

        const headerDiv = document.createElement('div');
        headerDiv.style.display = 'flex';
        headerDiv.style.alignItems = 'center';
        headerDiv.style.marginBottom = '5px';

        const nameHeading = document.createElement('h3');
        nameHeading.textContent = fbData.name;
        headerDiv.appendChild(nameHeading);

        if (fbData.isOwner) {
            const ownerBadge = document.createElement('span');
            ownerBadge.classList.add('owner-badge');
            ownerBadge.textContent = 'You';
            headerDiv.appendChild(ownerBadge);
        }
        
        // Add timestamp
        const timestampSpan = document.createElement('span');
        let timestampText = '';
        try {
            timestampText = `(${new Date(fbData.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle:'short', timeStyle:'short' })})`;
        } catch(e) {
            timestampText = `(${new Date(fbData.timestamp).toLocaleString('en-US')})`;
        }
        timestampSpan.classList.add('timestamp');
        timestampSpan.textContent = timestampText;
        headerDiv.appendChild(timestampSpan);


        detailsDiv.appendChild(headerDiv);

        const ratingDiv = document.createElement('div');
        ratingDiv.classList.add('feedback-rating');
        for (let i = 1; i <= 5; i++) {
            const star = document.createElement('span');
            star.classList.add('star');
            star.textContent = '★';
            if (i <= fbData.rating) {
                star.classList.add('selected');
            }
            ratingDiv.appendChild(star);
        }
        detailsDiv.appendChild(ratingDiv);

        const feedbackText = document.createElement('p');
        feedbackText.classList.add('feedback-text');
        feedbackText.textContent = fbData.feedback;
        detailsDiv.appendChild(feedbackText);

        // Admin Actions (Edit/Delete)
        if (userRole === 'admin') {
            const adminActionsDiv = document.createElement('div');
            adminActionsDiv.classList.add('admin-actions');

            const editButton = document.createElement('button');
            editButton.classList.add('edit-btn');
            editButton.innerHTML = '<i class="fas fa-edit"></i>';
            editButton.title = 'Edit Feedback';
            editButton.addEventListener('click', () => openEditFeedbackModal(fbData));
            adminActionsDiv.appendChild(editButton);

            const deleteButton = document.createElement('button');
            deleteButton.classList.add('delete-btn');
            deleteButton.innerHTML = '<i class="fas fa-trash-alt"></i>';
            deleteButton.title = 'Delete Feedback';
            deleteButton.addEventListener('click', () => deleteFeedback(fbData._id));
            adminActionsDiv.appendChild(deleteButton);

            item.appendChild(adminActionsDiv);
        }

        // Admin Reply Section
        const adminReplySection = document.createElement('div');
        adminReplySection.classList.add('admin-reply-section');
        detailsDiv.appendChild(adminReplySection);

        // Display existing admin replies
        if (fbData.adminReplies && fbData.adminReplies.length > 0) {
            const latestReply = fbData.adminReplies[fbData.adminReplies.length - 1]; // Display only the latest reply
            const adminReplyDiv = document.createElement('div');
            adminReplyDiv.classList.add('existing-admin-reply');

            const adminAvatar = document.createElement('img');
            adminAvatar.classList.add('admin-reply-avatar');
            adminAvatar.src = latestReply.adminAvatarUrl || 'https://api.dicebear.com/8.x/initials/svg?seed=Admin&backgroundType=gradientLinear'; // Default for admin
            adminAvatar.alt = 'Admin Avatar';

            const adminReplyContent = document.createElement('div');
            adminReplyContent.classList.add('admin-reply-content');

            let replyTimestampText = '';
            try {
                replyTimestampText = `(${new Date(latestReply.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle:'short', timeStyle:'short' })})`;
            } catch(e) {
                replyTimestampText = `(${new Date(latestReply.timestamp).toLocaleString('en-US')})`;
            }
            adminReplyContent.innerHTML = `<strong>(${(latestReply.adminName || 'Admin')}):</strong> ${latestReply.text} <span class="reply-timestamp">${replyTimestampText}</span>`;
            
            adminReplyDiv.append(adminAvatar, adminReplyContent);
            adminReplySection.appendChild(adminReplyDiv);
        }


        // Admin Reply Form (only for admins)
        if (userRole === 'admin') {
            const replyForm = document.createElement('div');
            replyForm.classList.add('admin-reply-form');

            const replyTextarea = document.createElement('textarea');
            replyTextarea.placeholder = 'Admin reply...';
            replyTextarea.value = fbData.adminReplies && fbData.adminReplies.length > 0 ? fbData.adminReplies[fbData.adminReplies.length - 1].text : ''; // Pre-fill with last reply
            
            const replyButton = document.createElement('button');
            replyButton.textContent = fbData.adminReplies && fbData.adminReplies.length > 0 ? 'Update Reply' : 'Reply';
            replyButton.disabled = false; // Enable by default

            replyButton.addEventListener('click', async () => {
                const replyContent = replyTextarea.value.trim();
                if (!replyContent) {
                    showToast('Admin reply khali nahi ho sakta.', 'error');
                    return;
                }
                replyButton.disabled = true;
                showToast('Replying...', 'info');

                try {
                    const token = localStorage.getItem('token');
                    const res = await fetch(`/api/feedbacks/${fbData._id}/reply`, {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}` 
                        },
                        body: JSON.stringify({ reply: replyContent })
                    });
                    const data = await res.json();
                    if (res.ok) {
                        showToast(data.message || 'Reply added!', 'success');
                        fetchFeedbacks(); // Refresh to show new reply
                    } else {
                        showToast(data.message || 'Reply failed!', 'error');
                    }
                } catch (error) {
                    console.error('Error sending reply:', error);
                    showToast('Reply bhejte waqt kuch dikkat aayi.', 'error');
                } finally {
                    replyButton.disabled = false;
                }
            });

            replyForm.append(replyTextarea, replyButton);
            adminReplySection.appendChild(replyForm);
        }

        item.append(avatarImg, detailsDiv); 
        // Check if the item already exists to prevent duplicates on re-fetch
        if(feedbackListContainer.querySelector(`[data-feedback-id="${fbData._id}"]`)) {
            // If it exists, remove the old one and re-add the updated one
            const oldItem = feedbackListContainer.querySelector(`[data-feedback-id="${fbData._id}"]`);
            if (oldItem) oldItem.remove();
            feedbackListContainer.appendChild(item);
        } else {
            feedbackListContainer.appendChild(item);
        }
    }
    
    // Function to handle deleting a feedback
    async function deleteFeedback(feedbackId) {
        const confirmDelete = confirm('Kya aap is feedback ko delete karna chahte hain?');
        if (!confirmDelete) return;

        showToast('Deleting feedback...', 'info');
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/feedbacks/${feedbackId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) {
                showToast(data.message || 'Feedback deleted successfully!', 'success');
                fetchFeedbacks(); // Refresh the list
            } else {
                showToast(data.message || 'Failed to delete feedback.', 'error');
            }
        } catch (error) {
            console.error('Error deleting feedback:', error);
            showToast('Feedback delete karne mein kuch dikkat aayi.', 'error');
        }
    }

    // Function to open edit feedback modal (You'd need a separate modal for this)
    // For now, let's just log and show a toast
    async function openEditFeedbackModal(feedbackData) {
        const newFeedbackText = prompt('Naya feedback daalein:', feedbackData.feedback);
        if (newFeedbackText === null || newFeedbackText.trim() === '') {
            showToast('Feedback khali nahi ho sakta ya cancel kiya gaya.', 'info');
            return;
        }

        const newRating = prompt(`Nayi rating daalein (1-5): (Current: ${feedbackData.rating})`);
        const parsedRating = parseInt(newRating);

        if (isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
            showToast('Invalid rating. Please enter a number between 1 and 5.', 'error');
            return;
        }

        showToast('Updating feedback...', 'info');
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/feedbacks/${feedbackData._id}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ feedback: newFeedbackText, rating: parsedRating })
            });
            const data = await res.json();
            if (res.ok) {
                showToast(data.message || 'Feedback updated successfully!', 'success');
                fetchFeedbacks(); // Refresh the list
            } else {
                showToast(data.message || 'Failed to update feedback.', 'error');
            }
        } catch (error) {
            console.error('Error updating feedback:', error);
            showToast('Feedback update karne mein kuch dikkat aayi.', 'error');
        }
    }


    // Confetti Effect
    function createConfetti() {
        const colors = ['var(--secondary-color)', 'var(--primary-color)', 'var(--accent-color)'];
        for (let i = 0; i < 50; i++) {
            const confetti = document.createElement('div');
            confetti.classList.add('confetti');
            confetti.style.left = `${Math.random() * 100}vw`;
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.animationDelay = `${Math.random() * 0.5}s`;
            document.body.appendChild(confetti);

            confetti.addEventListener('animationend', () => {
                confetti.remove();
            });
        }
    }


    // Initial calls on load
    updateUIAfterLogout(); // Set initial UI state (guest mode)
    checkLoginStatus(); // Check if user is already logged in via token
});
// === END: JavaScript Code ===
