document.addEventListener('DOMContentLoaded', () => {
    const navToggle = document.querySelector('.nav-toggle');
    const navLinks = document.querySelector('.nav-links');
    const logoutLink = document.getElementById('logout-link');
    const accountLink = document.getElementById('account-link');
    const loginSignupLink = document.getElementById('login-signup-link');
    const adminLink = document.getElementById('admin-link');

    if (navToggle) {
        navToggle.addEventListener('click', () => {
            navLinks.classList.toggle('open');
        });
    }

    // Check for token in local storage to update navigation
    const token = localStorage.getItem('token');
    const isAdmin = localStorage.getItem('isAdmin') === 'true'; // Store as string

    if (token) {
        if (accountLink) accountLink.style.display = 'block';
        if (logoutLink) {
            logoutLink.style.display = 'block';
            logoutLink.addEventListener('click', () => {
                localStorage.removeItem('token');
                localStorage.removeItem('isAdmin');
                window.location.href = '/'; // Redirect to homepage after logout
            });
        }
        if (loginSignupLink) loginSignupLink.style.display = 'none';
        if (adminLink) adminLink.style.display = isAdmin ? 'block' : 'none';
    } else {
        if (accountLink) accountLink.style.display = 'none';
        if (logoutLink) logoutLink.style.display = 'none';
        if (loginSignupLink) loginSignupLink.style.display = 'block';
        if (adminLink) adminLink.style.display = 'none';
    }
});