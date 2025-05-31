// public/js/auth.js

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const forgotPasswordForm = document.getElementById('forgot-password-form');
    const resetPasswordForm = document.getElementById('reset-password-form');

    // --- Login Form Submission ---
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ email, password }),
                });

                const data = await response.json();

                if (response.ok) {
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('isAdmin', data.isAdmin);
                    window.location.href = '/account.html'; // Redirect to account page
                } else {
                    alert(data.message || 'Login failed');
                }
            } catch (error) {
                console.error('Login error:', error);
                alert('An error occurred during login');
            }
        });
    }

    // --- Signup Form Submission ---
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            try {
                const response = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ username, email, password }),
                });

                const data = await response.json();

                if (response.ok) {
                    alert(data.message || 'Registration successful. Please check your email.');
                    window.location.href = '/login.html'; // Redirect to login page
                } else {
                    alert(data.message || 'Registration failed');
                }
            } catch (error) {
                console.error('Signup error:', error);
                alert('An error occurred during registration');
            }
        });
    }

    // --- Forgot Password Form Submission ---
    if (forgotPasswordForm) {
        forgotPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const messageDiv = document.getElementById('forgot-password-message');

            try {
                const response = await fetch('/api/auth/forgot-password', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ email }),
                });

                const data = await response.json();

                if (response.ok) {
                    messageDiv.textContent = data.message || 'Password reset email sent successfully.';
                    messageDiv.style.display = 'block';
                    forgotPasswordForm.reset();
                } else {
                    messageDiv.textContent = data.message || 'Failed to send reset email.';
                    messageDiv.style.display = 'block';
                }
            } catch (error) {
                console.error('Forgot password error:', error);
                messageDiv.textContent = 'An error occurred while requesting password reset.';
                messageDiv.style.display = 'block';
            }
        });
    }

    // --- Reset Password Form Submission ---
    if (resetPasswordForm) {
        resetPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            const resetToken = document.getElementById('resetToken').value;
            const messageDiv = document.getElementById('reset-password-message');

            if (newPassword !== confirmPassword) {
                alert('Passwords do not match');
                return;
            }

            try {
                const response = await fetch('/api/auth/reset-password', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ token: resetToken, newPassword }),
                });

                const data = await response.json();

                if (response.ok) {
                    messageDiv.textContent = data.message || 'Password reset successful. You can now login.';
                    messageDiv.style.display = 'block';
                    resetPasswordForm.reset();
                    setTimeout(() => {
                        window.location.href = '/login.html'; // Redirect to login after reset
                    }, 3000);
                } else {
                    alert(data.message || 'Password reset failed');
                }
            } catch (error) {
                console.error('Reset password error:', error);
                alert('An error occurred during password reset');
            }
        });
    }

    // --- Google Login Button (Placeholder - Needs actual Google Sign-In Library) ---
    const googleLoginBtn = document.getElementById('google-login-btn');
    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', () => {
            alert('Google login functionality needs integration with Google Sign-In library and backend endpoint.');
            // In a real implementation, you would trigger the Google Sign-In flow here
            // and send the Google ID token to your backend's /api/auth/google-login endpoint.
        });
    }

    // --- Google Signup Button (Placeholder - Needs actual Google Sign-In Library) ---
    const googleSignupBtn = document.getElementById('google-signup-btn');
    if (googleSignupBtn) {
        googleSignupBtn.addEventListener('click', () => {
            alert('Google signup functionality needs integration with Google Sign-In library and backend endpoint.');
            // Similar to Google login, you'd handle the Google Sign-Up flow here.
        });
    }
});