document.addEventListener('DOMContentLoaded', () => {
    const loginIcon = document.getElementById('login-icon');
    const authModal = document.getElementById('auth-modal');
    const userAvatarContainer = document.getElementById('user-avatar-container');
    const userAvatar = document.getElementById('user-avatar');
    const userDropdown = document.getElementById('user-dropdown');
    const loginForm = document.getElementById('login-form');
    const loginEmail = document.getElementById('login-email');
    const loginPassword = document.getElementById('login-password');
    const togglePassword = document.getElementById('toggle-password');
    const welcomeMessage = document.getElementById('welcome-message');
    const feedbackSection = document.getElementById('feedback-section');

    const logoutBtn = document.getElementById('logout-btn');
    const viewProfileBtn = document.getElementById('view-profile-btn');
    const editProfileBtn = document.getElementById('edit-profile-btn');

    // Google Login - This requires a backend endpoint for OAuth2 callback
    const googleLoginBtn = document.getElementById('google-login-btn');

    // --- Event Listeners ---
    loginIcon.addEventListener('click', () => {
        openModal(authModal);
    });

    togglePassword.addEventListener('click', () => {
        const type = loginPassword.getAttribute('type') === 'password' ? 'text' : 'password';
        loginPassword.setAttribute('type', type);
        togglePassword.querySelector('i').setAttribute('data-lucide', type === 'password' ? 'eye' : 'eye-off');
        lucide.createIcons();
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = loginEmail.value;
        const password = loginPassword.value;

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('userName', data.user.name);
                localStorage.setItem('userAvatar', data.user.avatar || '/images/default-avatar.png');
                localStorage.setItem('userId', data.user._id); // Store user ID
                localStorage.setItem('isAdmin', data.user.isAdmin); // Store isAdmin status
                showToast('Login successful!', 'success');
                closeModal(authModal);
                updateAuthUI();
                await fetchFeedbacks(); // Refresh feedbacks after login
                if (data.user.isAdmin) {
                    showToast('Admin logged in!', 'warning');
                    // Render admin specific UI or redirect
                }
            } else {
                showToast(data.message || 'Login failed.', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            showToast('An error occurred during login. Please try again.', 'error');
        }
    });

    // Logout
    logoutBtn.addEventListener('click', async () => {
        localStorage.removeItem('token');
        localStorage.removeItem('userName');
        localStorage.removeItem('userAvatar');
        localStorage.removeItem('userId');
        localStorage.removeItem('isAdmin');
        showToast('Logged out successfully!', 'success');
        updateAuthUI();
        window.location.reload(); // Simple reload for full UI reset
    });

    // Profile View & Edit Profile
    viewProfileBtn.addEventListener('click', async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            showToast('Session expired. Please log in again.', 'error');
            openModal(authModal);
            return;
        }

        try {
            const response = await fetch('/api/user/profile', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();

            if (response.ok) {
                document.getElementById('profile-avatar-display').src = data.user.avatar || '/images/default-avatar.png';
                document.getElementById('profile-name-display').textContent = data.user.name;
                document.getElementById('profile-email-display').textContent = data.user.email;
                document.getElementById('profile-joined-on').textContent = new Date(data.user.createdAt).toLocaleDateString();
                openModal(profileViewModal);
            } else {
                showToast(data.message || 'Failed to fetch profile.', 'error');
                if (response.status === 401) { // Unauthorized
                    localStorage.removeItem('token');
                    updateAuthUI();
                    openModal(authModal);
                }
            }
        } catch (error) {
            console.error('Error fetching profile:', error);
            showToast('An error occurred while fetching profile.', 'error');
        }
        closeUserDropdown();
    });

    editProfileBtn.addEventListener('click', () => {
        document.getElementById('edit-profile-name').value = localStorage.getItem('userName') || '';
        document.getElementById('avatar-preview').src = localStorage.getItem('userAvatar') || '/images/default-avatar.png';
        document.getElementById('avatar-preview').classList.remove('hidden'); // Show preview
        openModal(editProfileModal);
        closeUserDropdown();
    });

    // Handle user avatar dropdown
    userAvatar.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent document click from closing it immediately
        userDropdown.classList.toggle('opacity-0');
        userDropdown.classList.toggle('scale-95');
        userDropdown.classList.toggle('hidden');
    });

    // Close dropdown if clicked outside
    document.addEventListener('click', (e) => {
        if (!userAvatarContainer.contains(e.target) && !userDropdown.classList.contains('hidden')) {
            closeUserDropdown();
        }
    });

    function closeUserDropdown() {
        userDropdown.classList.add('opacity-0');
        userDropdown.classList.add('scale-95');
        setTimeout(() => userDropdown.classList.add('hidden'), 200); // Match transition duration
    }

    // --- UI Update Function ---
    function updateAuthUI() {
        const token = localStorage.getItem('token');
        const userName = localStorage.getItem('userName');
        const userAvatarUrl = localStorage.getItem('userAvatar');

        if (token && userName) {
            loginIcon.classList.add('hidden');
            userAvatarContainer.classList.remove('hidden');
            userAvatar.src = userAvatarUrl;
            welcomeMessage.textContent = `Welcome, ${userName}!`;
            welcomeMessage.classList.remove('hidden');
            feedbackSection.classList.remove('hidden'); // Show feedback form if logged in
        } else {
            loginIcon.classList.remove('hidden');
            userAvatarContainer.classList.add('hidden');
            welcomeMessage.classList.add('hidden');
            feedbackSection.classList.add('hidden'); // Hide feedback form if not logged in
        }
        lucide.createIcons(); // Re-render icons if UI changes
    }

    // Initial UI update on page load
    updateAuthUI();


    // --- Google Login (Frontend part, needs backend handling) ---
    googleLoginBtn.addEventListener('click', () => {
        // Redirect to your backend's Google OAuth initiation endpoint
        window.location.href = 'https://nobita-feedback-app-online.onrender.com/api/auth/google';
    });

    // Check for Google OAuth callback parameters on page load
    const urlParams = new URLSearchParams(window.location.search);
    const googleToken = urlParams.get('token');
    const googleUserName = urlParams.get('userName');
    const googleUserAvatar = urlParams.get('userAvatar');
    const googleUserId = urlParams.get('userId');
    const googleIsAdmin = urlParams.get('isAdmin');

    if (googleToken && googleUserName) {
        localStorage.setItem('token', googleToken);
        localStorage.setItem('userName', googleUserName);
        localStorage.setItem('userAvatar', googleUserAvatar || '/images/default-avatar.png');
        localStorage.setItem('userId', googleUserId);
        localStorage.setItem('isAdmin', googleIsAdmin);
        showToast('Google login successful!', 'success');
        // Clear URL parameters to avoid re-processing on refresh
        window.history.replaceState({}, document.title, window.location.pathname);
        updateAuthUI();
        fetchFeedbacks();
    }
});
