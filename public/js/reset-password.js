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

    resetSubmitBtn.addEventListener('click', function(e){
        const btn = this;
        let ripple = btn.querySelector('.ripple-anim');
        if(ripple) ripple.remove();
        ripple = document.createElement('span');
        ripple.className = 'ripple-anim';
        ripple.style.position = 'absolute';
        ripple.style.zIndex = 2;
        ripple.style.background = 'rgba(255,255,255,.13)';
        ripple.style.borderRadius = '50%';
        ripple.style.pointerEvents = 'none';
        ripple.style.left = (e.offsetX - 70) + 'px';
        ripple.style.top = (e.offsetY - 70) + 'px';
        ripple.style.width = ripple.style.height = '140px';
        ripple.style.opacity = 1;
        ripple.animate([
            {opacity:1,transform:"scale(.2)"},
            {opacity:.47,transform:"scale(1.16)"},
            {opacity:0,transform:"scale(1.7)"}
        ],{duration:600,easing:"cubic-bezier(.45,2.4,.46,1.01)"});
        setTimeout(()=>{ if(ripple) ripple.remove(); },580);
        btn.appendChild(ripple);
    });

    if (!token) {
        showMessage('error', 'Password reset link anuchit hai ya token nahi mila. Kripya sahi link ka istemal karein ya naya reset request karein.');
        resetSubmitBtn.disabled = true;
        resetSubmitBtn.innerHTML = '<i class="fa fa-ban"></i> Anuchit Link';
        loginPageLink.style.display = 'inline-block';
        return;
    }

    resetPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newPassword = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;
        if (!newPassword || !confirmPassword) {
            showMessage('error', 'Dono password fields bharna zaroori hai.');
            return;
        }
        if (newPassword !== confirmPassword) {
            showMessage('error', 'Passwords match nahi ho rahe.');
            confirmPasswordInput.focus();
            return;
        }
        if (newPassword.length < 6) {
            showMessage('error', 'Password kam se kam 6 characters ka hona chahiye.');
            newPasswordInput.focus();
            return;
        }
        loadingSpinner.style.display = 'block';
        resetSubmitBtn.disabled = true;
        resetSubmitBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Processing...';
        responseMessageDiv.style.display = 'none';

        try {
            const response = await fetch(`/api/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: token, password: newPassword, confirmPassword: confirmPassword })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                showMessage('success', data.message + " <br>Aapko ab homepage par redirect kiya jayega...");
                resetPasswordForm.style.display = 'none';
                loginPageLink.style.display = 'inline-block';

                if (data.token && data.user) {
                    localStorage.setItem('nobita_jwt', data.token);
                    localStorage.setItem('nobi_user_profile', JSON.stringify(data.user));
                    localStorage.setItem("nobita_last_email", data.user.email);
                }

                setTimeout(() => {
                    window.location.href = '/';
                }, 3500);
            } else {
                showMessage('error', data.message || 'Password reset karne mein samasya aa gayi.');
                resetSubmitBtn.disabled = false;
                resetSubmitBtn.innerHTML = '<i class="fa fa-lock"></i> Password Reset Karein';
            }
        } catch (error) {
            console.error('Reset password request error:', error);
            showMessage('error', 'Network ya server error. Kripya baad mein try karein.');
            resetSubmitBtn.disabled = false;
            resetSubmitBtn.innerHTML = '<i class="fa fa-lock"></i> Password Reset Karein';
        } finally {
            loadingSpinner.style.display = 'none';
        }
    });

    function showMessage(type, message) {
        responseMessageDiv.innerHTML = message;
        responseMessageDiv.className = `message-area ${type}`;
        responseMessageDiv.style.display = 'block';
        setTimeout(() => {
            responseMessageDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 130);
        if (window.navigator && window.navigator.vibrate) {
            if (type === 'error') window.navigator.vibrate([100, 50, 90]);
            else window.navigator.vibrate(45);
        }
    }
});