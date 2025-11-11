// downloads/public/js/admin.js
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('admin-login-form');
    const otpForm = document.getElementById('admin-otp-form'); // New
    const loginFormContainer = document.getElementById('login-form-container');
    const otpFormContainer = document.getElementById('otp-form-container'); // New
    const usernameInput = document.getElementById('admin-username');
    const passwordInput = document.getElementById('admin-password');
    const otpInput = document.getElementById('admin-otp'); // New
    const rememberMeCheckbox = document.getElementById('remember-me');
    const togglePassword = document.getElementById('toggle-password');
    const themeToggle = document.getElementById('theme-toggle');
    const loginButton = document.getElementById('login-button');
    const otpVerifyButton = document.getElementById('otp-verify-button'); // New
    const otpResendButton = document.getElementById('otp-resend-button'); // New
    const otpBackButton = document.getElementById('otp-back-button'); // New
    const redirectPopup = document.getElementById('redirect-popup');
    const gotoAdminHubBtn = document.getElementById('goto-admin-hub');
    const gotoFileManagerBtn = document.getElementById('goto-file-manager');
    
    let currentUsername = ''; // To store username temporarily
    let isResendingOtp = false; // To prevent resend spam

    applyInitialTheme();
    loadRememberedCredentials();

    async function checkSession() {
        const token = localStorage.getItem('adminToken');
        if (!token) {
            return false;
        }
        try {
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
            otpFormContainer.style.display = 'none';
            redirectPopup.style.display = 'flex';
        } else {
            console.log("No active session. Displaying login form.");
            loginFormContainer.style.display = 'block';
            otpFormContainer.style.display = 'none';
            redirectPopup.style.display = 'none';
        }
    });

    togglePassword.addEventListener('click', () => {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        togglePassword.textContent = type === 'password' ? 'Show' : 'Hide';
    });

    themeToggle.addEventListener('change', toggleTheme);

    // --- MAIN LOGIN FORM SUBMISSION (STEP 1) ---
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginButton.classList.add('loading');
        loginButton.disabled = true;

        const username = usernameInput.value;
        const password = passwordInput.value;
        currentUsername = username; // Store username temporarily
        
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

            if (response.ok && data.step === "OTP_REQUIRED") {
                showToast(data.message || 'OTP sent to your email.', 'info');
                loginFormContainer.style.display = 'none';
                otpFormContainer.style.display = 'block';
                otpInput.value = ''; // Clear input field
                otpInput.focus();
            } else if (response.ok) {
                 // Fallback for non-2FA legacy login (shouldn't happen with updated routes but kept for safety)
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

    // --- OTP FORM SUBMISSION (STEP 2) ---
    otpForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        otpVerifyButton.classList.add('loading');
        otpVerifyButton.disabled = true;
        
        const otp = otpInput.value.toUpperCase();

        if (otp.length !== 6) {
            showToast('OTP must be 6 characters long.', 'warning');
            otpVerifyButton.classList.remove('loading');
            otpVerifyButton.disabled = false;
            return;
        }

        try {
            const response = await fetch('/api/admin/verify-otp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username: currentUsername, otp })
            });
            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('adminToken', data.token);
                localStorage.setItem('adminLoggedInUser', JSON.stringify(data.admin));
                showToast('Verification successful!', 'success');
                otpFormContainer.style.display = 'none';
                redirectPopup.style.display = 'flex';
            } else {
                showToast(data.message || 'OTP verification failed.', 'error');
                otpInput.value = ''; // Clear OTP input on failure
            }
        } catch (error) {
            console.error('OTP verification error:', error);
            showToast('Network error or server unavailable.', 'error');
        } finally {
            otpVerifyButton.classList.remove('loading');
            otpVerifyButton.disabled = false;
        }
    });

    // --- RESEND OTP BUTTON ---
    otpResendButton.addEventListener('click', async () => {
        if (isResendingOtp) return;
        
        isResendingOtp = true;
        otpResendButton.disabled = true;
        const originalText = otpResendButton.textContent;
        otpResendButton.textContent = 'Sending...';

        // Re-use the login route with old credentials to trigger a new OTP email
        try {
            const response = await fetch('/api/admin/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    username: currentUsername, 
                    password: passwordInput.value // Use the password already entered 
                })
            });
            const data = await response.json();

            if (response.ok && data.step === "OTP_REQUIRED") {
                showToast('New OTP sent!', 'success');
            } else {
                showToast(data.message || 'Failed to resend OTP. Please try again.', 'error');
            }
        } catch (error) {
            showToast('Network error during resend.', 'error');
        } finally {
            otpResendButton.textContent = 'Resent (Wait 60s)';
            setTimeout(() => {
                otpResendButton.textContent = originalText;
                otpResendButton.disabled = false;
                isResendingOtp = false;
            }, 60000); // 60 seconds wait time for resend
        }
    });
    
    // --- BACK TO PASSWORD BUTTON ---
    otpBackButton.addEventListener('click', () => {
        otpFormContainer.style.display = 'none';
        loginFormContainer.style.display = 'block';
        passwordInput.value = ''; // Clear password for security
        loginButton.focus();
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