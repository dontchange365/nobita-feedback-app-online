// downloads/public/js/admin.js
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('admin-login-form');
    const loginFormContainer = document.getElementById('login-form-container');
    const usernameInput = document.getElementById('admin-username');
    const passwordInput = document.getElementById('admin-password');
    const rememberMeCheckbox = document.getElementById('remember-me');
    const togglePassword = document.getElementById('toggle-password');
    const themeToggle = document.getElementById('theme-toggle');
    const loginButton = document.getElementById('login-button');
    const redirectPopup = document.getElementById('redirect-popup');
    const gotoAdminHubBtn = document.getElementById('goto-admin-hub');
    const gotoFileManagerBtn = document.getElementById('goto-file-manager');

    applyInitialTheme();
    loadRememberedCredentials();

    // Check if the user is already authenticated based on a valid token
    async function checkSession() {
        const token = localStorage.getItem('adminToken');
        if (!token) {
            return false;
        }
        try {
            // Send a request to a protected endpoint to validate the token
            const response = await fetch('/api/admin/notifications', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            return response.ok;
        } catch (error) {
            console.error('Session check failed:', error);
            return false;
        }
    }

    checkSession().then(isValid => {
        if (isValid) {
            console.log("Existing session detected. Showing redirect choice.");
            loginFormContainer.style.display = 'none';
            redirectPopup.style.display = 'flex';
        } else {
            console.log("No active session. Displaying login form.");
            loginFormContainer.style.display = 'block';
            redirectPopup.style.display = 'none';
        }
    });

    togglePassword.addEventListener('click', () => {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        togglePassword.textContent = type === 'password' ? 'Show' : 'Hide';
    });

    themeToggle.addEventListener('change', toggleTheme);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginButton.classList.add('loading');
        loginButton.disabled = true;

        const username = usernameInput.value;
        const password = passwordInput.value;
        const rememberMe = rememberMeCheckbox.checked;

        if (rememberMe) {
            localStorage.setItem('adminUsername', username);
            localStorage.setItem('adminRememberMe', 'true');
        } else {
            localStorage.removeItem('adminUsername');
            localStorage.removeItem('adminRememberMe');
        }

        try {
            const response = await fetch('/api/admin/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('adminToken', data.token);
                localStorage.setItem('adminLoggedInUser', JSON.stringify(data.admin));
                showToast('Login successful!', 'success');
                loginFormContainer.style.display = 'none';
                redirectPopup.style.display = 'flex';
            } else {
                showToast(data.message || 'Login failed. Please check your credentials.', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            showToast('Network error or server unavailable.', 'error');
        } finally {
            loginButton.classList.remove('loading');
            loginButton.disabled = false;
        }
    });

    gotoAdminHubBtn.addEventListener('click', () => {
        redirectPopup.style.display = 'none';
        const token = localStorage.getItem('adminToken');
        if (token) {
            window.location.href = `/admin-panel?token=${token}`;
        } else {
            window.location.href = '/admin-panel';
        }
    });

    gotoFileManagerBtn.addEventListener('click', () => {
        redirectPopup.style.display = 'none';
        const token = localStorage.getItem('adminToken');
        if (token) {
            window.location.href = `/admin-panel/file-manager.html?token=${token}`;
        } else {
            window.location.href = '/admin-panel/file-manager.html';
        }
    });
});

function applyInitialTheme() {
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    document.body.classList.toggle('dark-mode', isDarkMode);
    document.getElementById('theme-toggle').checked = isDarkMode;
}

function toggleTheme(e) {
    document.body.classList.toggle('dark-mode', e.target.checked);
    localStorage.setItem('darkMode', e.target.checked);
}

function loadRememberedCredentials() {
    if (localStorage.getItem('adminRememberMe') === 'true') {
        document.getElementById('admin-username').value = localStorage.getItem('adminUsername') || '';
        document.getElementById('remember-me').checked = true;
    }
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    if (type === 'success') {
         setTimeout(() => { toast.remove(); }, 2000);
    } else {
        setTimeout(() => { toast.remove(); }, 3500);
    }
}