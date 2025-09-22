document.addEventListener('DOMContentLoaded', async () => {
    const responseMessageDiv = document.getElementById('response-message');
    const loadingSpinner = document.getElementById('loading-spinner');
    const initialMessageDiv = document.getElementById('initial-message');
    const loginPageLink = document.getElementById('login-page-link');
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token) {
        showMessage('error', 'Email verification link anuchit hai ya token nahi mila. Kripya sahi link ka istemal karein ya naya verification email request karein.');
        initialMessageDiv.style.display = 'none';
        loginPageLink.style.display = 'inline-block';
        return;
    }

    loadingSpinner.style.display = 'block';
    initialMessageDiv.style.display = 'block';
    responseMessageDiv.style.display = 'none';

    try {
        const response = await fetch(`/api/auth/verify-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: token })
        });
        const data = await response.json();

        if (response.ok) {
            showMessage('success', data.message + " <br>Aapko ab homepage par redirect kiya jayega...");
            initialMessageDiv.style.display = 'none';
            loginPageLink.style.display = 'inline-block';

            if (data.token && data.user) {
                localStorage.setItem('nobita_jwt', data.token);
                localStorage.setItem('nobi_user_profile', JSON.stringify(data.user));
                localStorage.setItem("nobita_last_email", data.user.email);
            }

            setTimeout(() => {
                window.location.href = '/';
            }, 4000);
        } else {
            showMessage('error', data.message || 'Email verify karne mein samasya aa gayi.');
            initialMessageDiv.style.display = 'none';
            loginPageLink.style.display = 'inline-block';
        }
    } catch (error) {
        console.error('Verify email request error:', error);
        showMessage('error', 'Network ya server error. Kripya baad mein try karein.');
        initialMessageDiv.style.display = 'none';
        loginPageLink.style.display = 'inline-block';
    } finally {
        loadingSpinner.style.display = 'none';
    }

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