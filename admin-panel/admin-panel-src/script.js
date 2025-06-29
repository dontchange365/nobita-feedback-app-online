let allFeedbacks = [];
        let currentFilter = 'all';
        let currentSearchTerm = '';
        const ADMIN_AVATAR = 'https://i.ibb.co/FsSs4SG/creator-avatar.png'; // Example Admin Avatar
        let ADMIN_NAME = 'Admin'; // Will be updated from localStorage

        // NEW: Global state for notifications
        let notificationList = []; // List of new feedback notifications
        let unreadNotifCount = 0;  // Kitne unread
        let lastFeedbackId = null; // To track the latest feedback fetched for polling

        // NEW: Blog management variables
        let blogList = []; // To store blog data

        // --- Step 1: Consolidated Service Worker Registration Function ---
        async function setupServiceWorker() {
            if ('serviceWorker' in navigator) {
                try {
                    const reg = await navigator.serviceWorker.register('/sw.js');
                    console.log('Service worker registered:', reg.scope);

                    // NEW: Add event listener for messages from the service worker
                    navigator.serviceWorker.addEventListener('message', (event) => {
                        console.log("Push message in foreground:", event.data);
                        // Assuming event.data is an object with title and body
                        if (event.data && event.data.type === 'new-feedback') {
                            const { title, body, avatarUrl, feedback } = event.data;
                            // Add to notificationList and update badge without re-fetching all feedbacks
                            onNewFeedbackReceivedFromSW(title, body, avatarUrl, feedback);
                        } else if (event.data && event.data.type === 'toast') {
                            showToast(event.data.message, event.data.toastType, event.data.avatarUrl, event.data.icon);
                        }
                    });

                    return reg;
                } catch (err) {
                    console.error('Service worker registration failed:', err);
                }
            }
            return null; // Return null if SW not supported or registration fails
        }

        // --- Authentication Check on Load ---
        document.addEventListener('DOMContentLoaded', async () => { // Made async to await setupServiceWorker
            const adminToken = localStorage.getItem('adminToken');
            const adminUser = JSON.parse(localStorage.getItem('adminLoggedInUser'));

            if (!adminToken || !adminUser || !adminUser.username || !adminUser.loggedInAt) {
                // No valid admin token or user details found, redirect to login
                window.location.href = '/admin-login.html';
                return; // Stop further execution
            }

            // Set Admin Name from logged-in user details
            ADMIN_NAME = '👉𝙉𝙊𝘽𝙄𝙏𝘼🤟';
            document.getElementById('admin-username-display').textContent = ADMIN_NAME;
            try {
                const loginDate = new Date(adminUser.loggedInAt);
                document.getElementById('admin-login-timestamp-display').textContent = loginDate.toLocaleString();
            } catch (e) {
                document.getElementById('admin-login-timestamp-display').textContent = 'N/A';
            }

            // Proceed with normal admin panel setup if authenticated
            setupEventListeners();
            applyInitialTheme();
            // Call fetchAndProcessData and then initialize lastFeedbackId
            fetchAndProcessData().then(() => {
                if(allFeedbacks.length > 0) {
                    lastFeedbackId = allFeedbacks[0]._id;
                }
            });


            // --- Step 2: Register SW ONLY ONCE and then setup push notifications ---
            const swRegistration = await setupServiceWorker();
            if (swRegistration) {
                subscribeUserForPush(swRegistration); // Pass the registration object
            }

            // Start polling for new feedbacks
            setInterval(pollNewFeedbacks, 10000); // 10s

            // Add event listener for the blog submission form
            document.getElementById('add-blog-form').addEventListener('submit', handleAddBlog);
        });

        function setupEventListeners() {
            document.getElementById('theme-toggle').addEventListener('change', toggleTheme);
            document.getElementById('search-input').addEventListener('input', e => {
                currentSearchTerm = e.target.value.toLowerCase();
                renderList();
            });
            document.getElementById('filter-buttons').addEventListener('click', e => {
                if (e.target.tagName === 'BUTTON') {
                    currentFilter = e.target.dataset.filter;
                    document.querySelectorAll('#filter-buttons button').forEach(btn => btn.classList.remove('active'));
                    e.target.classList.add('active');
                    renderList();
                }
            });
            document.getElementById('logout-btn').addEventListener('click', logoutAdmin); // NEW: Logout button

            document.getElementById('notification-btn').addEventListener('click', () => {
                // Modified to open actual notification modal
                openNotifModal();
            });

            // Add Blog stat-square logic - MODIFIED
            document.querySelectorAll('.stat-btn').forEach(card => {
                card.addEventListener('click', function() {
                    let type = this.getAttribute('data-type');
                    if (type === 'addblog') {
                        showBlogModal();
                    } else {
                        showStatModal(type);
                    }
                });
            });
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

        // NEW: Admin Logout Function
        function logoutAdmin() {
            localStorage.removeItem('adminToken');
            localStorage.removeItem('adminLoggedInUser');
            // Clear any active push subscriptions on logout if possible (optional but good practice)
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                 navigator.serviceWorker.ready.then(reg => {
                    reg.pushManager.getSubscription().then(subscription => {
                        if (subscription) {
                            subscription.unsubscribe().then(successful => {
                                if (successful) console.log('Successfully unsubscribed from push notifications.');
                                // You might want to notify your backend to remove this subscription too
                            }).catch(e => console.error('Failed to unsubscribe push:', e));
                        }
                    });
                 });
            }

            showToast('Logged out successfully.', 'info');
            setTimeout(() => {
                window.location.href = '/admin-login.html';
            }, 500);
        }

        async function subscribeUserForPush(registration) {
            if (!('PushManager' in window)) {
                console.warn('PushManager not supported by browser.');
                document.getElementById('notification-btn').style.display = 'none';
                return;
            }

            try {
                // Request Notification permission
                const permission = await Notification.requestPermission();
                if (permission !== "granted") {
                    showToast("Notifications blocked. Enable to get live updates.", "warning");
                    document.getElementById('notification-btn').style.display = 'none';
                    return;
                }

                let subscription = await registration.pushManager.getSubscription();
                if (!subscription) {
                    const response = await fetch('/api/vapid-public-key');
                    if (!response.ok) {
                        console.error('Failed to get VAPID public key:', response.statusText);
                        showToast('Failed to setup push notifications: Server key missing.', 'error');
                        document.getElementById('notification-btn').style.display = 'none';
                        return;
                    }
                    const vapidPublicKey = await response.text();
                    subscription = await registration.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
                    });
                }
                console.log('User is subscribed:', subscription);

                // Send subscription to your server
                // CHANGED: Path to /api/admin/save-subscription as per server.js
                await fetch('/api/admin/save-subscription', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                    },
                    body: JSON.stringify({ subscription })
                });
                showToast('Push notifications enabled!', 'success');
                document.getElementById('notification-btn').style.display = 'inline-block'; // Ensure button is visible
            } catch (error) {
                console.error('Failed to subscribe the user for push:', error);
                showToast('Failed to enable push notifications. Check console.', 'error');
                document.getElementById('notification-btn').style.display = 'none';
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

        async function fetchAndProcessData() {
            try {
                const response = await fetch('/api/feedbacks', {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
                });
                if (!response.ok) {
                    if (response.status === 401 || response.status === 403) {
                        const errorData = await response.json().catch(() => ({ message: 'Unauthorized' }));
                        showToast(errorData.message || 'Admin session expired or unauthorized. Please log in again.', 'error');
                        logoutAdmin();
                        return;
                    }
                    throw new Error(`HTTP Error: ${response.statusText}`);
                }
                allFeedbacks = await response.json();
                renderList();
                calculateAndDisplayStats();
            } catch (error) {
                showToast(`Could not load data: ${error.message}`, "error");
                document.getElementById('feedback-list').innerHTML = `<p style="text-align:center; padding: 2rem; color: var(--danger-color);">Failed to load feedbacks. ${error.message}</p>`;
            }
        }

        function renderList() {
            const listEl = document.getElementById('feedback-list');
            let filteredFeedbacks = allFeedbacks;
            if (currentFilter === 'pinned') filteredFeedbacks = allFeedbacks.filter(fb => fb.isPinned);
            if (currentFilter === 'replied') filteredFeedbacks = allFeedbacks.filter(fb => fb.replies && fb.replies.length > 0);
            if (currentFilter === 'unreplied') filteredFeedbacks = filteredFeedbacks.filter(fb => !fb.replies || fb.replies.length === 0);
            if (currentSearchTerm) {
                filteredFeedbacks = filteredFeedbacks.filter(fb => {
                    const userName = ((fb.userId && fb.userId.name) ? fb.userId.name : fb.name) || 'Guest User';
                    return userName.toLowerCase().includes(currentSearchTerm) || (fb.feedback && fb.feedback.toLowerCase().includes(currentSearchTerm));
                });
            }
            if (filteredFeedbacks.length === 0) {
                listEl.innerHTML = `<p style="text-align:center; padding: 2rem;">No feedback matches your criteria.</p>`;
                return;
            }
            listEl.innerHTML = filteredFeedbacks.map((fb, index) => {
                const userName = ((fb.userId && fb.userId.name) ? fb.userId.name : fb.name) || 'Guest User';
                const avatarUrl = fb.avatarUrl || `https://api.dicebear.com/8.x/pixel-art/svg?seed=${encodeURIComponent(userName)}`;
                // Format timestamp to 12-hour format
                const feedbackTime = new Date(fb.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

                return `
                <div class="feedback-card" data-id="${fb._id}" style="animation-delay: ${index * 30}ms">
                    <div class="card-selector"><input type="checkbox" value="${fb._id}"></div>
                    <div class="card-main-content" onclick="navigateToDetail('${fb._id}')">
                        <img src="${avatarUrl}" alt="avatar" class="card-avatar">
                        <div class="card-content">
                            <h3>${userName} ${fb.isPinned ? '📌' : ''}</h3>
                            <p class="rating">${'★'.repeat(fb.rating)}${'☆'.repeat(5 - fb.rating)}</p>
                        </div>
                    </div>
                    <div class="card-time">${feedbackTime}</div>
                </div>`;
            }).join('');
        }
        function renderDetailScreen(feedbackId) {
            const fb = allFeedbacks.find(f => f._id === feedbackId);
            if (!fb) return navigateToList();

            const detailContainer = document.getElementById('detail-container');
            const userName = ((fb.userId && fb.userId.name) ? fb.userId.name : fb.name) || 'Guest User';
            const userAvatar = fb.avatarUrl || `https://api.dicebear.com/8.x/pixel-art/svg?seed=${encodeURIComponent(userName)}`;

            let userTag = '';
            const blueTickPath = '/images/blue-tick.png', redTickPath = '/images/red-tick.png';
            if (fb.userId && typeof fb.userId === 'object') {
                if (fb.userId.isVerified) userTag = `<img src="${blueTickPath}" alt="V" title="Verified" style="height:1.25rem;">`; /* 20px */
                else if (fb.userId.loginMethod === 'email') userTag = `<img src="${redTickPath}" alt="NV" title="Not Verified" style="height:1.25rem;">`; /* 20px */
            } else if (fb.googleIdSubmitter) {
                userTag = `<img src="${blueTickPath}" alt="V" title="Verified (Google Legacy)" style="height:1.25rem;">`; /* 20px */
            } else {
                userTag = `<img src="${redTickPath}" alt="G" title="Guest or Unknown" style="height:1.25rem;">`; /* 20px */
            }

            const repliesHtml = fb.replies && fb.replies.length > 0 ? fb.replies.map(r => `
                <div class="reply-item" id="reply-${r._id}">
                    <img src="${ADMIN_AVATAR}" alt="admin avatar" class="reply-avatar">
                    <div class="reply-body">
                        <div class="reply-header">
                            <strong>${r.adminName || 'Admin'}</strong>
                            <div class="reply-actions">
                                <button class="reply-action-btn" onclick="toggleEditReply('${fb._id}', '${r._id}')">Edit</button>
                                <button class="reply-action-btn danger" onclick="tryDeleteReply('${fb._id}', '${r._id}')">Delete</button>
                            </div>
                        </div>
                        <p class="reply-text">${r.text}</p>
                        <small>${new Date(r.timestamp).toLocaleString()}</small>
                        <div class="edit-reply-form" style="display: none;">
                            <textarea class="edit-reply-textarea">${r.text}</textarea>
                            <button class="action-button" onclick="tryEditReply('${fb._id}', '${r._id}')">Save Changes</button>
                        </div>
                    </div>
                </div>`).join('') : '<p>No replies yet.</p>';

            const originalContentHtml = (fb.isEdited && fb.originalContent) ? `
                <div class="detail-section">
                    <h4>Original Content (Pre-edit)</h4>
                    <p><strong>Feedback:</strong> "${fb.originalContent.feedback}"</p>
                    <small>Posted: ${new Date(fb.originalContent.timestamp).toLocaleString()}</small>
                </div>` : '';

            detailContainer.innerHTML = `
                <header class="detail-header">
                    <button class="back-button" onclick="navigateToList()">‹</button>
                    <h2>${userName} ${userTag}</h2>
                </header>
                <div class="detail-content">
                    <div class="detail-section">
                        <h4>Feedback Details ${fb.isEdited ? '(Edited)' : ''}</h4>
                        <div class="feedback-display">
                            <img src="${userAvatar}" alt="user avatar" class="feedback-display-avatar">
                            <div>
                                <p class="rating" style="font-size:1.2rem; margin-top:0;">${'★'.repeat(fb.rating)}${'☆'.repeat(5 - fb.rating)}</p>
                                <p>"${fb.feedback}"</p>
                                <small>Submitted: ${new Date(fb.timestamp).toLocaleString()}</small>
                            </div>
                        </div>
                    </div>
                    ${originalContentHtml}
                    <div class="detail-section">
                        <h4>Manage</h4>
                        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:1rem;">
                            <button class="action-button" onclick="tryPinFeedback('${fb._id}', ${fb.isPinned})">${fb.isPinned ? 'Unpin' : 'Pin'}</button>
                            <button class="action-button" onclick="tryChangeAvatarForFeedback('${fb._id}')">New Avatar</button>
                            <button class="action-button danger" onclick="tryDeleteFeedback('${fb._id}')">Delete</button>
                        </div>
                    </div>
                    <div class="detail-section">
                        <h4>Reply as ${ADMIN_NAME}</h4>
                        <textarea id="reply-text" placeholder="Your reply..."></textarea>
                        <button class="action-button" style="width:100%" onclick="tryPostReply('${fb._id}')">Send Reply</button>
                        <div class="replies-list" style="margin-top:1.25rem;">${repliesHtml}</div>
                    </div>
                </div>`;
        }
        function calculateAndDisplayStats() {
            const total = allFeedbacks.length;
            const avgRating = total > 0 ? (allFeedbacks.reduce((sum, fb) => sum + fb.rating, 0) / total).toFixed(1) : '0.0';
            const pinned = allFeedbacks.filter(fb => fb.isPinned).length;
            const replies = allFeedbacks.reduce((sum, fb) => sum + (fb.replies ? fb.replies.length : 0), 0);
            document.getElementById('stats-total').textContent = total;
            document.getElementById('stats-avg-rating').textContent = `${avgRating} ★`;
            document.getElementById('stats-pinned').textContent = pinned;
            document.getElementById('stats-replies').textContent = replies;
        }

        function navigateToDetail(id) {
            renderDetailScreen(id);
            document.getElementById('list-container').classList.add('slide-out');
            document.getElementById('detail-container').classList.add('active');
        }

        function navigateToList() {
            document.getElementById('list-container').classList.remove('slide-out');
            document.getElementById('detail-container').classList.remove('active');
            renderList();
        }

        // Modified performApiAction to include admin token
        async function performApiAction(url, options = {}) {
            const adminToken = localStorage.getItem('adminToken');
            const headers = {
                'Content-Type': 'application/json',
                ...options.headers // Merge existing headers
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
                    const errorData = await response.json().catch(() => ({ message: `HTTP ${response.status}: ${response.statusText}` }));
                    // Check for 401/403 specifically to handle expired/invalid tokens
                    if (response.status === 401 || response.status === 403) {
                        showToast(errorData.message || 'Admin session expired or unauthorized. Please log in again.', 'error');
                        logoutAdmin();
                        return;
                    }
                    throw new Error(`HTTP Error: ${response.statusText}`);
                }
                return response.status === 204 ? true : await response.json();
            } catch (error) {
                console.error('API Action Failed:', error);
                // Only show toast if it's not a session invalidation already handled
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

        function handleSuccess(message) {
            showToast(message, 'success');
            // Instead of location.reload(), re-fetch data for a smoother UX
            // In a more complex app, you might only update the specific changed item
            fetchAndProcessData();
            navigateToList(); // Go back to list view after action
        }

        async function tryDeleteFeedback(id) {
            const confirmed = await showCustomConfirm('Delete this feedback permanently? This action cannot be undone.', 'Confirm Deletion');
            if (!confirmed) return;

            try {
                await performApiAction(`/api/admin/feedback/${id}`, {
                    method: 'DELETE',
                });
                handleSuccess('Feedback deleted successfully!');
            } catch (error) { /* Handled by performApiAction */ }
        }

        async function tryDeleteSelectedFeedbacks() {
            const selectedIds = Array.from(document.querySelectorAll('.feedback-list input[type="checkbox"]:checked')).map(cb => cb.value);
            if (selectedIds.length === 0) return showToast('No items selected.', 'warning');

            const confirmed = await showCustomConfirm(`Delete ${selectedIds.length} selected items permanently? This action cannot be undone.`, 'Confirm Bulk Deletion');
            if (!confirmed) return;

            try {
                await performApiAction('/api/admin/feedbacks/batch-delete', {
                    method: 'DELETE',
                    body: JSON.stringify({ ids: selectedIds }),
                });
                handleSuccess(`${selectedIds.length} items deleted successfully!`);
            } catch (error) { /* Handled by performApiAction */ }
        }

        async function tryPinFeedback(id, isPinned) {
            try {
                const updatedData = await performApiAction(`/api/admin/feedback/${id}/pin`, {
                    method: 'PUT',
                    body: JSON.stringify({ isPinned: !isPinned }),
                });
                handleSuccess(`Feedback ${updatedData.isPinned ? 'pinned' : 'unpinned'}!`);
            } catch (error) { /* Handled by performApiAction */ }
        }

        async function tryChangeAvatarForFeedback(id) {
            try {
                await performApiAction(`/api/admin/feedback/${id}/change-avatar`, {
                    method: 'PUT',
                });
                handleSuccess('Avatar regenerated!');
            } catch (error) { /* Handled by performApiAction */ }
        }

        async function tryPostReply(id) {
            const textEl = document.getElementById('reply-text');
            const text = textEl.value;
            if (!text.trim()) return showToast('Reply cannot be empty.', 'warning');

            try {
                await performApiAction(`/api/admin/feedback/${id}/reply`, {
                    method: 'POST',
                    body: JSON.stringify({ replyText: text, adminName: ADMIN_NAME }),
                });
                textEl.value = '';
                handleSuccess('Reply sent!');
            } catch (error) { /* Handled by performApiAction */ }
        }

        function toggleEditReply(feedbackId, replyId) {
            const replyEl = document.getElementById(`reply-${replyId}`);
            if (!replyEl) return;

            const textEl = replyEl.querySelector('.reply-text');
            const formEl = replyEl.querySelector('.edit-reply-form');

            const isEditing = formEl.style.display === 'block';
            textEl.style.display = isEditing ? 'block' : 'none';
            formEl.style.display = isEditing ? 'none' : 'block';
        }

        async function tryEditReply(feedbackId, replyId) {
            const replyEl = document.getElementById(`reply-${replyId}`);
            const textarea = replyEl.querySelector('.edit-reply-textarea');
            const newText = textarea.value.trim();

            if (!newText) return showToast('Reply cannot be empty.', 'warning');

            try {
                await performApiAction(`/api/admin/feedback/${feedbackId}/reply/${replyId}`, {
                    method: 'PUT',
                    body: JSON.stringify({ text: newText }),
                });
                handleSuccess('Reply updated!');
            } catch (error) { /* Handled by performApiAction */ }
        }

        async function tryDeleteReply(feedbackId, replyId) {
            const confirmed = await showCustomConfirm('Are you sure you want to delete this reply?', 'Confirm Reply Deletion');
            if (!confirmed) return;

            try {
                await performApiAction(`/api/admin/feedback/${feedbackId}/reply/${replyId}`, {
                    method: 'DELETE',
                });
                handleSuccess('Reply deleted!');
            } catch (error) { /* Handled by performApiAction */ }
        }

        // Modified showToast to accept icon/avatar
        function showToast(message, type = 'success', avatarUrl = null, icon = null) {
            const container = document.getElementById('toast-container');
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
            container.scrollTop = container.scrollHeight;

            if (type !== 'success') {
                 setTimeout(() => { toast.remove(); }, 3500);
            } else {
                setTimeout(() => { toast.remove(); }, 2000); // Shorter duration for success messages
            }
        }

        // NEW: setBellActive function
        function setBellActive(isActive, count = 0) {
            let badge = document.getElementById("notification-count");
            if (isActive && count > 0) {
                badge.textContent = count;
                badge.style.display = "inline-block";
            } else {
                badge.textContent = "0";
                badge.style.display = "none";
            }
        }

        // ---- Polling Logic (NEW FEEDBACK NOTIFIER) ----
        // CODE UPDATE FOR POLLING (replace pollNewFeedbacks function)
        async function pollNewFeedbacks() {
            try {
                const res = await fetch('/api/feedbacks', {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
                });
                if (!res.ok) {
                    if (res.status === 401 || res.status === 403) {
                         console.warn("Polling failed: Admin session expired or unauthorized. Not redirecting from poll.");
                    }
                    throw new Error(`Polling HTTP Error: ${res.statusText}`);
                }
                const data = await res.json();
                if (Array.isArray(data) && data.length) {
                    let newIndex = -1;
                    if (lastFeedbackId) {
                        // Find how many feedbacks are new since lastFeedbackId
                        newIndex = data.findIndex(fb => fb._id === lastFeedbackId);
                    }
                    // All feedbacks before newIndex are new
                    const newFeedbacks = newIndex === -1 ? data : data.slice(0, newIndex);
                    if (newFeedbacks.length > 0) {
                        newFeedbacks.reverse().forEach(fb => {
                            // Call onNewFeedbackReceived with full feedback object for notifications
                            onNewFeedbackReceived(fb);
                        });
                        fetchAndProcessData(); // Re-fetch all data to update list view
                    }
                    lastFeedbackId = data[0]._id; // Always update lastFeedbackId to the current latest
                }
            } catch(e) {
                console.error("Polling error:", e.message);
            }
        }

        // --- Notification functions ---
        function showBrowserNotification(title, body) {
            if (Notification.permission === "granted") {
                navigator.serviceWorker.getRegistration().then(function(reg) {
                    if (reg) {
                        reg.showNotification(title, {
                            body: body,
                            icon: '/images/notification.png'   // Yeh path bilkul sahi hai!
                        });
                    } else {
                        new Notification(title, {
                            body: body,
                            icon: '/images/notification.png'
                        });
                    }
                });
            }
        }

        // Updated onNewFeedbackReceived() function
        function onNewFeedbackReceived(feedback) {
            const userName = ((feedback.userId && feedback.userId.name) ? feedback.userId.name : feedback.name) || 'Guest User';
            const avatarUrl = feedback.avatarUrl || `https://api.dicebear.com/8.x/pixel-art/svg?seed=${encodeURIComponent(userName)}`;

            // Add new notification entry
            notificationList.unshift({
                emoji: "🔥",
                msg: `New Feedback from ${userName}!`,
                feedback: feedback.feedback,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }), // 12-hour format
                avatar: avatarUrl
            });
            // Limit to last 20
            if(notificationList.length > 20) notificationList.length = 20;

            unreadNotifCount++;
            setBellActive(true, unreadNotifCount);

            // Show browser push
            showBrowserNotification(
                "New Feedback Received!",
                `From: ${userName}\nRating: ${feedback.rating}\n"${feedback.feedback}"`
            );

            // In-app toast
            showToast(`New Feedback from ${userName}!`, "info", avatarUrl, "🔔");
        }

        // NEW: Function to handle messages coming from the Service Worker for new feedbacks
        function onNewFeedbackReceivedFromSW(title, body, avatarUrl, feedbackText) {
            // This function is triggered when a push notification is received
            // and the service worker sends a message to the client.
            // It avoids re-fetching all data and directly updates the UI.

            notificationList.unshift({
                emoji: "🔥",
                msg: title,
                feedback: feedbackText,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }), // 12-hour format
                avatar: avatarUrl
            });
            if(notificationList.length > 20) notificationList.length = 20;

            unreadNotifCount++;
            setBellActive(true, unreadNotifCount);

            // You might want to also re-fetch the data to update the main list
            // if the user is currently on the list view, or if they navigate back.
            // For simplicity, we'll just show a toast here.
            showToast(title, "info", avatarUrl, "🔔");

            // Optional: If you want the list to update immediately when SW pushes a new feedback
            // and the user is on the list screen, call fetchAndProcessData() here.
            // However, the current polling logic might already handle this, so be careful not to duplicate.
            // fetchAndProcessData();
        }

        // NEW: Render real notifications in modal
        function renderNotifList() {
            const notifListEl = document.getElementById("notif-list");
            if(notificationList.length === 0) {
                notifListEl.innerHTML = `<div style="color:#ccc;text-align:center;margin:2rem 0;">No new notifications.</div>`;
                return;
            }
            let html = notificationList.map(n=>
              `<div style="display:flex;align-items:center;gap:13px;padding:13px 0;border-bottom:1px solid var(--border);">
                  <img src="${n.avatar}" style="width:36px;height:36px;border-radius:50%;border:2px solid var(--accent-pink);">
                  <div>
                    <span style="font-weight:600;color:var(--text-primary);">${n.msg}</span>
                    <div style="color:var(--accent-pink);font-size:0.89rem;">${n.feedback || ''}</div>
                  </div>
                  <span style="margin-left:auto;font-size:0.85rem;color:var(--text-secondary);">${n.time}</span>
              </div>`
            ).join('');
            notifListEl.innerHTML = html;
        }

        // NEW: Open notification modal = mark all as read
        function openNotifModal() {
            document.getElementById('notif-modal').style.display = "flex"; // Use flex to center
            renderNotifList();
            unreadNotifCount = 0;
            setBellActive(false, 0); // reset bell
        }

        // Stat Buttons -> Popup Modal Logic
        function showStatModal(type) {
            let title = '';
            let body = '';
            if(type==='total') {
                title = 'Total Feedbacks';
                body = `<span style="font-size:2.2rem;font-weight:800;color:var(--accent-pink);">${document.getElementById('stats-total').textContent}</span>
                <p>This is the <b>total number</b> of feedbacks received from users so far. More feedbacks mean more engagement!</p>`;
            }
            else if(type==='average') {
                title = 'Average Rating';
                body = `<span style="font-size:2.1rem;font-weight:800;color:gold;">${document.getElementById('stats-avg-rating').textContent}</span>
                <p><b>Average rating</b> calculated from all feedbacks received. High average = Happy users!</p>`;
            }
            else if(type==='replies') {
                title = 'Total Replies';
                body = `<span style="font-size:2.1rem;font-weight:800;color:limegreen;">${document.getElementById('stats-replies').textContent}</span>
                <p>Total <b>admin replies</b> given to all feedbacks. Quick responses boost credibility.</p>`;
            }
            else if(type==='pinned') {
                title = 'Pinned Items';
                body = `<span style="font-size:2.1rem;font-weight:800;color:deepskyblue;">${document.getElementById('stats-pinned').textContent}</span>
                <p><b>Pinned feedbacks</b> are marked important for future review or showcase.</p>`;
            }
            else if(type==='session') {
                title = 'Admin Session Detail';
                body = `<div style="font-size:1.09rem;">
                    <b>Logged in as:</b> <span style="color:var(--accent-pink);">${document.getElementById('admin-username-display').textContent}</span><br>
                    <b>Login Time:</b> <span>${document.getElementById('admin-login-timestamp-display').textContent}</span><br>
                    <b>Browser:</b> <span>${navigator.userAgent}</span>
                </div>`;
            }
            else {
                title = "More Info";
                body = "No data available.";
            }
            document.getElementById('stat-modal-title').innerHTML = title;
            document.getElementById('stat-modal-body').innerHTML = body;
            document.getElementById('stat-modal-overlay').style.display = 'flex';
        }
        function closeStatModal() {
            document.getElementById('stat-modal-overlay').style.display = 'none';
        }

        // Blog Modal Logic (NEW)
        function showBlogModal() {
            document.getElementById('blog-modal-overlay').style.display = 'flex';
            fetchBlogs(); // Load blogs in modal panel
        }
        function closeBlogModal() {
            document.getElementById('blog-modal-overlay').style.display = 'none';
        }

        async function fetchBlogs() {
            try {
                const response = await performApiAction('/api/blogs'); // Public API, no token needed
                blogList = response;
                renderBlogAdminList();
            } catch (error) {
                showCustomMessage('Failed to load blogs.', 'error');
                console.error("Error fetching blogs:", error);
            }
        }

        function renderBlogAdminList() {
            const listContainer = document.getElementById('blog-admin-list');
            if (blogList.length === 0) {
                listContainer.innerHTML = '<p style="text-align:center;color:#ccc;">No blogs added yet.</p>';
                return;
            }

            listContainer.innerHTML = blogList.map(blog => `
                <div class="blog-item" id="blog-item-${blog._id}">
                    <div class="blog-item-details">
                        <strong>${blog.title}</strong><br>
                        <small>${blog.link} ${blog.badge ? `(${blog.badge})` : ''}</small>
                        <p style="font-size:0.8em; margin:0.3em 0;">${blog.summary}</p>
                    </div>
                    <div class="blog-item-actions">
                        <button class="edit-blog-btn" onclick="editBlog('${blog._id}')">Edit</button>
                        <button class="delete-blog-btn" onclick="deleteBlog('${blog._id}')">Delete</button>
                    </div>
                </div>
            `).join('');
        }

        async function handleAddBlog(event) {
            event.preventDefault();
            const linkInput = document.getElementById('blog-link');
            const titleInput = document.getElementById('blog-title');
            const summaryInput = document.getElementById('blog-summary');
            const badgeInput = document.getElementById('blog-badge');
            const msgArea = document.getElementById('msg-area');

            const newBlog = {
                link: linkInput.value,
                title: titleInput.value,
                summary: summaryInput.value,
                badge: badgeInput.value || null
            };

            try {
                await performApiAction('/api/admin/blogs', {
                    method: 'POST',
                    body: JSON.stringify(newBlog)
                });
                showCustomMessage('Blog added successfully!', 'success');
                linkInput.value = '';
                titleInput.value = '';
                summaryInput.value = '';
                badgeInput.value = '';
                fetchBlogs(); // Refresh the list
            } catch (error) {
                showCustomMessage(`Failed to add blog: ${error.message}`, 'error');
                console.error("Error adding blog:", error);
            }
        }

        async function deleteBlog(blogId) {
            const confirmed = await showCustomConfirm('Are you sure you want to delete this blog?', 'Confirm Blog Deletion');
            if (!confirmed) return;

            try {
                await performApiAction(`/api/admin/blogs/${blogId}`, {
                    method: 'DELETE'
                });
                showCustomMessage('Blog deleted successfully!', 'success');
                fetchBlogs(); // Refresh the list
            } catch (error) {
                showCustomMessage(`Failed to delete blog: ${error.message}`, 'error');
                console.error("Error deleting blog:", error);
            }
        }

        function editBlog(blogId) {
            const blog = blogList.find(b => b._id === blogId);
            if (!blog) return;

            const blogItemElement = document.getElementById(`blog-item-${blogId}`);
            if (!blogItemElement) return;

            // Save original HTML to restore if needed, or hide actions and replace
            const originalContent = blogItemElement.innerHTML;
            blogItemElement.innerHTML = `
                <div class="blog-item-details" style="flex-grow:1;">
                    <label for="edit-link-${blogId}" style="color:#FFD700;font-size:.9em; margin-bottom:0.1em;">Link:</label>
                    <input type="text" id="edit-link-${blogId}" value="${blog.link}" style="margin-bottom:0.4em;">

                    <label for="edit-title-${blogId}" style="color:#FFD700;font-size:.9em; margin-bottom:0.1em;">Title:</label>
                    <input type="text" id="edit-title-${blogId}" value="${blog.title}" style="margin-bottom:0.4em;">

                    <label for="edit-summary-${blogId}" style="color:#FFD700;font-size:.9em; margin-bottom:0.1em;">Summary:</label>
                    <textarea id="edit-summary-${blogId}" rows="2" style="margin-bottom:0.4em;">${blog.summary}</textarea>

                    <label for="edit-badge-${blogId}" style="color:#FFD700;font-size:.9em; margin-bottom:0.1em;">Badge:</label>
                    <input type="text" id="edit-badge-${blogId}" value="${blog.badge || ''}" style="margin-bottom:0.4em;">
                </div>
                <div class="blog-item-actions" style="display:flex; flex-direction:column; gap:0.5em;">
                    <button class="edit-blog-btn" onclick="submitEditBlog('${blogId}')">Save</button>
                    <button class="delete-blog-btn" onclick="fetchBlogs()">Cancel</button> <!-- Re-renders the list to cancel edit -->
                </div>
            `;

            // Optional: Scroll to the element being edited if it's off-screen
            blogItemElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }


        async function submitEditBlog(blogId) {
            const linkInput = document.getElementById(`edit-link-${blogId}`);
            const titleInput = document.getElementById(`edit-title-${blogId}`);
            const summaryInput = document.getElementById(`edit-summary-${blogId}`);
            const badgeInput = document.getElementById(`edit-badge-${blogId}`);

            const updatedBlog = {
                link: linkInput.value,
                title: titleInput.value,
                summary: summaryInput.value,
                badge: badgeInput.value || null
            };

            try {
                await performApiAction(`/api/admin/blogs/${blogId}`, {
                    method: 'PUT',
                    body: JSON.stringify(updatedBlog)
                });
                showCustomMessage('Blog updated successfully!', 'success');
                fetchBlogs(); // Refresh the list
            } catch (error) {
                showCustomMessage(`Failed to update blog: ${error.message}`, 'error');
                console.error("Error updating blog:", error);
            }
        }

        function showCustomMessage(message, type = 'info') {
            const msgArea = document.getElementById('msg-area');
            msgArea.textContent = message;
            msgArea.style.color = type === 'success' ? '#22c55e' : (type === 'error' ? '#f43f5e' : '#FFD700'); // Gold for info
            setTimeout(() => {
                msgArea.textContent = '';
            }, 3000);
        }
