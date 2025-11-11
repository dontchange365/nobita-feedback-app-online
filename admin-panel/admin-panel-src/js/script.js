//admin-panel-src/js/script.js

const ADMIN_AVATAR = 'https://i.ibb.co/FsSs4SG/creator-avatar.png';
let ADMIN_NAME = '👉𝙉𝙊𝘽𝙄𝙏𝘼🤟';

// Global variables for other modules are declared here for clarity.
let lastFeedbackId = null;

// Notification system globals
let notificationList = [];
let unreadNotifCount = 0;
let lastSeenFeedbackTimestamp = null;
const socket = io();

// --- Consolidated Service Worker Registration Function ---
async function setupServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            const reg = await navigator.serviceWorker.register('/sw.js');
            console.log('Service worker registered:', reg.scope);

            navigator.serviceWorker.addEventListener('message', (event) => {
                console.log("Push message in foreground:", event.data);
                if (event.data && event.data.type === 'new-feedback') {
                    const {
                        title,
                        body,
                        avatarUrl,
                        feedback
                    } = event.data;
                    // Removed onNewFeedbackReceivedFromSW function call
                } else if (event.data && event.data.type === 'toast') {
                    showToast(event.data.message, event.data.toastType, event.data.avatarUrl, event.data.icon);
                }
            });

            return reg;
        } catch (err) {
            console.error('Service worker registration failed:', err);
        }
    }
    return null;
}

// --- Session Checker Function ---
function checkSession() {
    const adminToken = localStorage.getItem('adminToken');
    const adminUser = JSON.parse(localStorage.getItem('adminLoggedInUser'));
    const now = new Date();

    // Invalidate session after 24 hours of login
    const sessionTimeout = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    if (!adminToken || !adminUser || !adminUser.loggedInAt || (now - new Date(adminUser.loggedInAt) > sessionTimeout)) {
        console.log("Session invalid or expired. Logging out.");
        logoutAdmin(true); // 'true' to force a redirect
        return false;
    }
    return true;
}

// --- Authentication Check on Load ---
document.addEventListener('DOMContentLoaded', async () => {
    // Initial session check on page load
    if (!checkSession()) {
        return;
    }

    const adminUser = JSON.parse(localStorage.getItem('adminLoggedInUser'));
    ADMIN_NAME = '👉𝙉𝙊𝘽𝙄𝙏𝘼🤟';
    document.getElementById('admin-username-display').textContent = ADMIN_NAME;
    try {
        const loginDate = new Date(adminUser.loggedInAt);
        document.getElementById('admin-login-timestamp-display').textContent = loginDate.toLocaleString();
    } catch (e) {
        document.getElementById('admin-login-timestamp-display').textContent = 'N/A';
    }

    // Initialize all modules after authentication
    setupEventListeners();
    applyInitialTheme();
    initFeedbackModule();
    initBlogModule();
    initPageModule();
    setupWebSocketListeners();

    const swRegistration = await setupServiceWorker();
    if (swRegistration) {
        // Removed push notification subscription
    }

    // Start periodic session check
    setInterval(checkSession, 5 * 60 * 1000); // Check every 5 minutes
});

// --- NEW CODE: Scroll Position Management ---
window.addEventListener('pageshow', (event) => {
    // Check if the page is being restored from the browser's cache
    if (event.persisted) {
        const scrollPosition = sessionStorage.getItem('mainScrollPosition');
        if (scrollPosition) {
            window.scrollTo(0, parseInt(scrollPosition, 10));
        }
    }
});

window.addEventListener('pagehide', () => {
    // Save the current scroll position before leaving the page
    sessionStorage.setItem('mainScrollPosition', window.scrollY);
});

function setupEventListeners() {
    document.getElementById('theme-toggle').addEventListener('change', toggleTheme);

    // Event listener for general stat cards
    document.querySelectorAll('.stat-btn').forEach(card => {
        card.addEventListener('click', function() {
            let type = this.getAttribute('data-type');
            if (type !== 'addblog') {
                showStatModal(type);
            }
        });
    });

    // Dedicated event listeners for the new stat cards
    document.getElementById('logout-btn').addEventListener('click', () => logoutAdmin(true));
    document.getElementById('createPageBtn').addEventListener('click', () => {
        document.getElementById('createPageModal').style.display = 'flex';
    });
    
    // Notification button
    document.getElementById('notification-btn').addEventListener('click', openNotifModal);


    document.getElementById('filter-buttons').addEventListener('click', e => {
        if (e.target.tagName === 'BUTTON') {
            currentFilter = e.target.dataset.filter;
            updateActiveFilterButton();
            renderList();
        }
    });

    document.querySelectorAll('.stat-btn').forEach(card => {
        card.addEventListener('click', function() {
            let type = this.getAttribute('data-type');
            if (type !== 'addblog') {
                showStatModal(type);
            }
        });
    });
}

// Notification Functions
function setupWebSocketListeners() {
    socket.on('connect', () => {
        console.log('Connected to WebSocket server.');
    });

    socket.on('new-feedback', (feedback) => {
        console.log('New feedback received via socket:', feedback);
        // Display toast notification
        showToast(`New feedback from ${feedback.name}`, 'info', feedback.avatarUrl);
        // Increment and display badge count
        unreadNotifCount++;
        updateNotifBadge();
        // Add the new feedback to the main list
        addFeedbackLive(feedback);
    });

    // Initial check for unseen feedbacks
    fetchUnreadNotifCount();
}

function addFeedbackLive(newFeedback) {
    const pinnedCount = allFeedbacks.filter(fb => fb.isPinned).length;
    if (pinnedCount > 0) {
        // Insert after the last pinned item
        allFeedbacks.splice(pinnedCount, 0, newFeedback);
    } else {
        // No pinned items, add to the top
        allFeedbacks.unshift(newFeedback);
    }
    renderList();
}

async function fetchUnreadNotifCount() {
    try {
        const response = await performApiAction('/api/admin/notifications');
        unreadNotifCount = response.length;
        if (response.length > 0) {
            lastSeenFeedbackTimestamp = new Date(response[0].timestamp).toISOString();
        }
        updateNotifBadge();
        notificationList = response;
    } catch (err) {
        console.error('Failed to fetch unread notifications count:', err);
    }
}

function updateNotifBadge() {
    const badge = document.getElementById('notification-count');
    if (unreadNotifCount > 0) {
        badge.textContent = unreadNotifCount;
        badge.style.display = 'block';
    } else {
        badge.style.display = 'none';
    }
}

function openNotifModal() {
    const modal = document.getElementById('notif-modal');
    const list = document.getElementById('notif-list');

    modal.style.display = 'flex';
    list.innerHTML = `<div style="color:#ccc;text-align:center;margin:2rem 0;">Loading notifications...</div>`;

    performApiAction('/api/admin/notifications').then(notifications => {
        notificationList = notifications;
        if (notificationList.length === 0) {
            list.innerHTML = `<div class="empty-state">No new notifications.</div>`;
        } else {
            // Use the centralized render function to ensure consistency
            list.innerHTML = notificationList.map(notif => renderFeedbackCard({
                _id: notif.id,
                name: notif.name,
                avatarUrl: notif.avatarUrl,
                rating: notif.rating,
                feedback: notif.feedback,
                timestamp: notif.timestamp,
                userId: notif.userId // Pass user info for verification badge
            })).join('');

            // Apply event listeners to the newly rendered cards
            document.querySelectorAll('#notif-list .feedback-card').forEach(card => {
                card.addEventListener('click', () => {
                    // Navigate to detail screen if clicked
                    navigateToDetail(card.dataset.id);
                    // Hide the notification modal after navigation
                    modal.style.display = 'none';
                });
            });
        }
        markNotificationsAsSeen();
    }).catch(err => {
        console.error('Failed to fetch notifications for modal:', err);
        list.innerHTML = `<div class="empty-state" style="color:var(--error);">Failed to load notifications.</div>`;
    });
}

async function markNotificationsAsSeen() {
    try {
        await performApiAction('/api/admin/notifications/mark-seen', { method: 'POST' });
        unreadNotifCount = 0;
        updateNotifBadge();
    } catch (err) {
        console.error('Failed to mark notifications as seen:', err);
    }
}

function applyInitialTheme() {
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    document.body.classList.toggle('dark-mode', isDarkMode);
    document.getElementById('theme-toggle').checked = isDarkMode;
}

function toggleTheme(e) {
    document.body.classList.toggle('dark-mode', e.target.checked);
    localStorage.setItem('darkMode', e.target.checked);
}

function logoutAdmin(redirect = false) {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminLoggedInUser');
    showToast('Logged out successfully.', 'info');
    if (redirect) {
        setTimeout(() => {
            window.location.href = '/admin-login.html';
        }, 500);
    }
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

async function performApiAction(url, options = {}) {
    const adminToken = localStorage.getItem('adminToken');
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    if (adminToken) {
        headers['Authorization'] = `Bearer ${adminToken}`;
    }
    try {
        const response = await fetch(url, {
            ...options,
            headers: headers,
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({
                message: `HTTP ${response.status}: ${response.statusText}`
            }));
            if (response.status === 401 || response.status === 403) {
                showToast(errorData.message || 'Admin session expired or unauthorized. Please log in again.', 'error');
                logoutAdmin(true);
                return;
            }
            throw new Error(`HTTP Error: ${response.statusText}`);
        }
        return response.status === 204 ? true : await response.json();
    } catch (error) {
        console.error('API Action Failed:', error);
        if (error.message !== "Admin session invalidated.") {
            showToast(error.message, 'error');
        }
        throw error;
    }
}

function showCustomConfirm(message, title = "Confirm Action") {
    return new Promise(resolve => {
        const modal = document.getElementById('custom-confirm-modal');
        const titleEl = document.getElementById('modal-title');
        const messageEl = document.getElementById('modal-message');
        const confirmBtn = document.getElementById('modal-confirm-btn');
        const cancelBtn = document.getElementById('modal-cancel-btn');
        titleEl.textContent = title;
        messageEl.textContent = message;
        modal.style.display = 'flex';
        confirmBtn.onclick = () => {
            modal.style.display = 'none';
            resolve(true);
        };
        cancelBtn.onclick = () => {
            modal.style.display = 'none';
            resolve(false);
        };
    });
}

/**
 * Displays a consistent toast notification.
 * This is the central function for all toast messages.
 * @param {string} message - The message to display.
 * @param {string} type - The type of toast ('success', 'error', 'warning', 'info').
 * @param {string|null} avatarUrl - Optional URL for an avatar image.
 * @param {string|null} icon - Optional emoji or icon character.
 */
function showToast(message, type = 'success', avatarUrl = null, icon = null) {
    const container = document.getElementById('toast-container');
    if (!container) {
        console.error('Toast container not found!');
        return;
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    if (avatarUrl) {
        const avatarImg = document.createElement('img');
        avatarImg.src = avatarUrl;
        avatarImg.className = 'toast-avatar';
        toast.appendChild(avatarImg);
    } else if (icon) {
        const iconSpan = document.createElement('span');
        iconSpan.className = 'toast-icon';
        iconSpan.textContent = icon;
        toast.appendChild(iconSpan);
    }
    const textSpan = document.createElement('span');
    textSpan.textContent = message;
    toast.appendChild(textSpan);
    
    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3500);
}

function showCustomMessage(message, type = 'info') {
    const msgArea = document.getElementById('msg-area');
    msgArea.textContent = message;
    msgArea.style.color = type === 'success' ? '#22c59e' : (type === 'error' ? '#f43f5e' : '#FFD700');
    setTimeout(() => {
        msgArea.textContent = '';
    }, 3000);
}

// --- NEW FUNCTION DEFINITION ---
function closeStatModal() {
    const modalOverlay = document.getElementById('stat-modal-overlay');
    if (modalOverlay) {
        modalOverlay.style.display = 'none';
    }
}
// --- END NEW FUNCTION DEFINITION ---

// --- MODIFIED showStatModal FUNCTION (Removed existing function body and replaced with new structure) ---
async function showStatModal(type) {
    const modalTitleEl = document.getElementById('stat-modal-title');
    const modalBodyEl = document.getElementById('stat-modal-body');
    const modalOverlay = document.getElementById('stat-modal-overlay');
    
    // Clear previous content
    modalTitleEl.innerHTML = '';
    modalBodyEl.innerHTML = '<div class="loading-indicator"><span class="spinner"></span> Loading data...</div>';
    modalOverlay.style.display = 'flex';

    if (type === 'analytics') {
        await renderAnalyticsModal(modalTitleEl, modalBodyEl);
    } else {
        // Handle existing stats (Non-analytics card loading is simpler)
        let body = '';
        let title = '';
        if (type === 'total') {
            title = 'Total Feedbacks';
            body = `<span class="stat-value" style="color:var(--primary-color);">${document.getElementById('stats-total').textContent}</span>
                <p class="stat-description">This is the <b>total number</b> of feedbacks received from users so far. More feedbacks mean more engagement!</p>`;
        } else if (type === 'average') {
            title = 'Average Rating';
            body = `<span class="stat-value" style="color:gold;">${document.getElementById('stats-avg-rating').textContent}</span>
                    <p class="stat-description"><b>Average rating</b> calculated from all feedbacks received. High average = Happy users!</p>`;
        } else if (type === 'replies') {
            title = 'Total Replies';
            body = `<span class="stat-value" style="color:limegreen;">${document.getElementById('stats-replies').textContent}</span>
                    <p class="stat-description">Total <b>admin replies</b> given to all feedbacks. Quick responses boost credibility.</p>`;
        } else if (type === 'pinned') {
            title = 'Pinned Items';
            body = `<span class="stat-value" style="color:deepskyblue;">${document.getElementById('stats-pinned').textContent}</span>
                <p class="stat-description"><b>Pinned feedbacks</b> are marked important for future review or showcase.</p>`;
        } else if (type === 'session') {
            title = 'Admin Session Detail';
            body = `<div style="font-size:1.09rem;">
                        <b>Logged in as:</b> <span style="color:var(--accent-pink);">${document.getElementById('admin-username-display').textContent}</span><br>
                        <b>Login Time:</b> <span>${document.getElementById('admin-login-timestamp-display').textContent}</span><br>
                        <b>Browser:</b> <span>${navigator.userAgent}</span>
                    </div>`;
        } else {
            title = "More Info";
            body = "No data available.";
        }
        modalTitleEl.innerHTML = title;
        modalBodyEl.innerHTML = body;
    }
}
// --- END MODIFIED showStatModal FUNCTION ---


// --- NEW ANALYTICS RENDER FUNCTION (UPDATED FOR SKELETON) ---
async function renderAnalyticsModal(titleEl, bodyEl) {
    titleEl.innerHTML = `<i class="fas fa-chart-area"></i> Website Visits Analytics`;

    const periods = [
        { key: 'today', name: 'Today' },
        { key: 'yesterday', name: 'Yesterday' },
        { key: 'last7days', name: 'Last 7 Days' },
        { key: 'last30days', name: 'Last 30 Days' },
        { key: 'all', name: 'All Time' }
    ];
    
    // Skeleton HTML Structure - REFINED
    const skeletonHTML = `
        <div id="analytics-results" class="skeleton-analytics-grid">
            <div class="skeleton-card">
                <div class="skeleton-line skeleton-header"></div>
                <div class="skeleton-line skeleton-value"></div>
                <div class="skeleton-line skeleton-description" style="width: 90%;"></div>
                <div class="skeleton-line skeleton-description" style="width: 70%;"></div>
            </div>
            <div class="skeleton-card">
                <div class="skeleton-line skeleton-header"></div>
                <div class="skeleton-line skeleton-value"></div>
                <div class="skeleton-line skeleton-description" style="width: 90%;"></div>
                <div class="skeleton-line skeleton-description" style="width: 70%;"></div>
            </div>
        </div>
    `;

    let filterHtml = `
        <div style="text-align:center; margin-bottom:15px;">
            <select id="analytics-period-filter" style="padding: 10px; border-radius: 8px; font-size: 1em; background: var(--background); color: var(--on-surface);">
                ${periods.map(p => `<option value="${p.key}">${p.name}</option>`).join('')}
            </select>
        </div>
        <div id="analytics-results">${skeletonHTML}</div>
    `;

    bodyEl.innerHTML = filterHtml; // Display filter and skeleton immediately
    
    const resultsEl = document.getElementById('analytics-results');
    const filterEl = document.getElementById('analytics-period-filter');
    
    async function fetchData(period) {
        // Show skeleton while fetching
        resultsEl.innerHTML = skeletonHTML; 
        
        try {
            const data = await performApiAction(`/api/admin/analytics?period=${period}`);
            
            // Format numbers with commas
            const formatNum = (num) => num.toLocaleString('en-IN'); 

            resultsEl.innerHTML = `
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; text-align:center; padding:10px;">
                    <div class="stat-card" style="box-shadow:none; border:1px solid #00c9ff;">
                        <p class="title" style="color:var(--info);">Total Visits</p>
                        <span class="stat-value" style="color:#00c9ff; font-size:2.5em;">${formatNum(data.totalVisits)}</span>
                        <p class="stat-description">Total number of all recorded visits. (IP repeat allowed)</p>
                    </div>
                    <div class="stat-card" style="box-shadow:none; border:1px solid #22c55e;">
                        <p class="title" style="color:var(--success);">Unique Visitors</p>
                        <span class="stat-value" style="color:#22c55e; font-size:2.5em;">${formatNum(data.uniqueVisits)}</span>
                        <p class="stat-description">Unique users based on recorded IP addresses.</p>
                    </div>
                </div>
            `;
        } catch (e) {
            resultsEl.innerHTML = `<div style="color:var(--error); text-align:center; padding:20px;">Failed to fetch analytics: ${e.message}</div>`;
        }
    }

    // Initial fetch for All Time
    await fetchData('all');
    
    // Add change listener
    filterEl.addEventListener('change', (e) => fetchData(e.target.value));
}
// --- END NEW ANALYTICS RENDER FUNCTION ---

/**
 * A helper function to run an async action while showing a spinner on a button.
 * It handles the loading state and restores the button's state on completion or error.
 * @param {HTMLElement} btn - The button element to show the spinner on.
 * @param {Function} action - An async function containing the API call and DOM update logic.
 */
window.withSpinner = async function(btn, action) {
    if (!btn) return;
    const oldHtml = btn.innerHTML;
    const originalDisabledState = btn.disabled;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';
    try {
        await action();
    } catch (err) {
        console.error('API Action Failed:', err);
        showToast(err.message || 'An unexpected error occurred.', 'error');
    } finally {
        btn.innerHTML = oldHtml;
        btn.disabled = originalDisabledState;
    }
}