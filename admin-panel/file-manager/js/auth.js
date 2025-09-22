// auth.js
// Is file mein sirf authentication aur API call se related logic hai

// Ye script page load hote hi run hoga.
const adminToken = localStorage.getItem('adminToken');
const adminLoggedInUser = JSON.parse(localStorage.getItem('adminLoggedInUser'));

if (!adminToken || !adminLoggedInUser || !adminLoggedInUser.username || !adminLoggedInUser.userId) {
    console.warn("Admin token ya user data missing/invalid. Redirecting to login.");
    // window.location.replace() use karein taki back button se protected page par wapis na aa saken.
    window.location.replace('/admin-login.html');
}

// --- Helper Functions for Authentication and UI (Global scope mein) ---

// Logout function
function logoutAdmin() {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminLoggedInUser');
    localStorage.removeItem('adminUsername'); // 'Remember Me' ke liye
    localStorage.removeItem('adminRememberMe'); // 'Remember Me' ke liye
    showToast('Logged out successfully.', 'info');
    setTimeout(() => {
        window.location.replace('/admin-login.html'); // Redirect to login page after logout
    }, 500);
}

// --- API Action Helper Function (Authentication ke saath) ---
// Ye function har API call ko wrap karega aur Authorization header add karega.
async function performFileManagerApiAction(path, opts = {}) {
    const adminToken = localStorage.getItem('adminToken');
    if (!adminToken) {
        showToast('Session expired. Please log in again.', 'error');
        logoutAdmin();
        throw new Error('Authentication required.');
    }

    const url = '/api/file-manager' + path;
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`, // JWT token add kiya
        ...(opts.headers || {}) // Aur koi custom headers hain to unhe merge kar do
    };

    const finalOpts = {
        ...opts,
        headers: headers,
    };

    // Agar body object hai to JSON.stringify karein
    if (finalOpts.body && typeof finalOpts.body !== 'string') {
        finalOpts.body = JSON.stringify(finalOpts.body);
    }

    try {
        const res = await fetch(url, finalOpts);

        if (res.status === 401 || res.status === 403) {
            // Agar session expired ya unauthorized hai, to logout kar do
            const errorData = await res.json().catch(() => ({ message: 'Authentication failed or session expired.' }));
            showToast(errorData.message || 'Session expired. Please log in again.', 'error');
            logoutAdmin();
            throw new Error(errorData.message || 'Unauthorized access');
        }

        if (!res.ok) {
            // Normal HTTP errors
            let msg = 'Error: ' + res.status;
            try { let js = await res.json(); msg = js.error || msg; } catch{}
            throw new Error(msg);
        }

        // DELETE operations ke liye response empty ho sakta hai, isliye handle karein
        if (opts.method === 'DELETE') {
             // Depend karta hai backend kya return karta hai, yahan generic success
             return res.status === 204 ? {} : await res.json().catch(() => ({ success: true }));
        }

        return await res.json();
    } catch (error) {
        console.error("File Manager API Error:", error);
        // showToast function already error display kar chuki hai
        throw error; // Re-throw error taki calling function bhi handle kar sake agar zaroori ho
    }
}