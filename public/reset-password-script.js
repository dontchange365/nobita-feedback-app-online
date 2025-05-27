document.addEventListener('DOMContentLoaded', () => {
    const resetPasswordForm = document.getElementById('reset-password-form');
    const newPasswordInput = document.getElementById('new-password');
    const confirmPasswordInput = document.getElementById('confirm-password');
    const responseMessageDiv = document.getElementById('response-message');
    const loadingSpinner = document.getElementById('loading-spinner');
    const resetSubmitBtn = document.getElementById('reset-submit-btn');
    const loginPageLink = document.getElementById('login-page-link');

    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token) {
        showMessage('error', 'Password reset link anuchit hai ya token nahi mila. Kripya sahi link ka istemal karein ya naya reset request karein.');
        if(resetSubmitBtn) {
            resetSubmitBtn.disabled = true;
            resetSubmitBtn.textContent = 'Anuchit Link';
        }
        if(loginPageLink) loginPageLink.style.display = 'inline-block';
        if(resetPasswordForm) resetPasswordForm.style.display = 'none'; // Hide form if token is invalid
        return;
    }

    if(resetPasswordForm) {
        resetPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newPassword = newPasswordInput.value;
            const confirmPassword = confirmPasswordInput.value;

            // Clear previous messages
            responseMessageDiv.style.display = 'none';
            responseMessageDiv.textContent = '';


            if (!newPassword || !confirmPassword) {
                showMessage('error', 'Dono password fields bharna zaroori hai.');
                return;
            }
            if (newPassword !== confirmPassword) {
                showMessage('error', 'Passwords match nahi ho rahe.');
                return;
            }
            if (newPassword.length < 6) {
                showMessage('error', 'Password kam se kam 6 characters ka hona chahiye.');
                return;
            }

            if(loadingSpinner) loadingSpinner.style.display = 'block';
            if(resetSubmitBtn) {
                resetSubmitBtn.disabled = true;
                resetSubmitBtn.textContent = 'Processing...';
            }
            
            try {
                const response = await fetch(`/api/auth/reset-password`, { // Assuming same origin
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: token, password: newPassword, confirmPassword: confirmPassword })
                });
                const data = await response.json();

                if (response.ok) {
                    showMessage('success', data.message + " Aapko ab login page par redirect kiya jayega...");
                    if(resetPasswordForm) resetPasswordForm.style.display = 'none'; // Hide form
                    if(loginPageLink) loginPageLink.style.display = 'inline-block'; // Show login link
                    setTimeout(() => {
                        window.location.href = '/'; // Redirect to home/login page
                    }, 4000);
                } else {
                    showMessage('error', data.message || 'Password reset karne mein samasya aa gayi.');
                    if(resetSubmitBtn) {
                        resetSubmitBtn.disabled = false;
                        resetSubmitBtn.textContent = 'Password Reset Karein';
                    }
                }
            } catch (error) {
                console.error('Reset password request error:', error);
                showMessage('error', 'Network ya server error. Kripya baad mein try karein.');
                if(resetSubmitBtn) {
                    resetSubmitBtn.disabled = false;
                    resetSubmitBtn.textContent = 'Password Reset Karein';
                }
            } finally {
                if(loadingSpinner) loadingSpinner.style.display = 'none';
            }
        });
    }

    function showMessage(type, message) {
        if(responseMessageDiv) {
            responseMessageDiv.textContent = message;
            responseMessageDiv.className = `message-area ${type}`; // Reset classes and apply new ones
            responseMessageDiv.style.display = 'block';
        }
    }
});