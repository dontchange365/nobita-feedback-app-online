// admin-panel-src/js/feedback.js
window.allFeedbacks = [];
window.currentFilter = 'all';
window.currentSearchTerm = '';
// Removed notificationList and unreadNotifCount
window.lastSeenFeedback = null; // New global variable to store last seen feedback object
window.isLoading = false;
window.hasMoreData = true;
window.ITEMS_PER_PAGE = 10;
window.currentPage = 1;

// --- ADDED: search debounce + abort helpers ---
let searchTimer = null;
let searchAbort = null;

// ────── Safety & small helpers ──────
function escapeHtml(str) {
  if (!str && str !== 0) return '';
  return String(str).replace(/[&<>"']/g, s => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[s]));
}

function safeRating(r) {
  const n = Number(r) || 0;
  return Math.max(0, Math.min(5, Math.round(n)));
}

function niceTime(timestamp) {
  const t = new Date(timestamp || Date.now());
  if (isNaN(t)) return 'Unknown';
  const options = {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  };
  return t.toLocaleString('en-US', options);
}

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
};

window.fetchAndProcessData = async function(page = 1, append = false, fetchOptions = {}) {
    if (isLoading && !append) return;
    isLoading = true;

    const listEl = document.getElementById('feedback-list');
    
    if (!append) {
        if (listEl) listEl.innerHTML = '<div class="loading-indicator">Loading feedbacks... <span class="loading-spinner"></span></div>';
    }

    const params = new URLSearchParams({
        page,
        limit: ITEMS_PER_PAGE,
        filter: currentFilter || 'all'
    });
    if (currentSearchTerm && currentSearchTerm.trim() !== "") {
        params.set('q', currentSearchTerm.trim());
    }

    try {
        const res = await fetch('/api/feedbacks?' + params.toString(), {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` },
            signal: fetchOptions.signal
    });

        if (!res.ok) throw new Error('Failed to fetch feedbacks: ' + res.status);

        const data = await res.json();
        const serverList = data.feedbacks || [];
        
        if (append) {
            allFeedbacks = [...allFeedbacks, ...serverList];
        } else {
            allFeedbacks = serverList;
        }

        renderList();

        window.currentPage = data.currentPage || page;
        window.totalPages = data.totalPages || 1;
        window.hasMoreData = window.currentPage < window.totalPages;
        
        calculateAndDisplayStats(data);
        
    } catch (err) {
        if (err.name !== 'AbortError') console.error('fetchAndProcessData error', err);
        if (!append) {
            const listEl = document.getElementById('feedback-list');
            if (listEl) listEl.innerHTML = `<div class="error-state"><i class="fas fa-exclamation-triangle"></i><p>Failed to load feedbacks.</p><button class="retry-btn" onclick="initFeedbackModule()">Retry</button></div>`;
        }
    } finally {
        isLoading = false;
        updateLoadMoreButton();
    }
};

window.renderList = function() {
    updateActiveFilterButton();
    const listEl = document.getElementById('feedback-list');
    
    if (allFeedbacks.length === 0) {
        listEl.innerHTML = `<p style="text-align:center; padding: 2rem;">No feedback matches your criteria.</p>`;
    } else {
        const renderedCards = allFeedbacks.map((fb, index) => renderFeedbackCard(fb, index)).join(' ');
        listEl.innerHTML = renderedCards;
    }
    
    document.querySelectorAll('.feedback-card:not([data-events-added])').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('input[type="checkbox"]')) return;
            navigateToDetail(card.dataset.id);
        });
        card.setAttribute('data-events-added', 'true');
    });
    updateLoadMoreButton();
};


window.loadMoreFeedbacks = async function(btn) {
    if (!hasMoreData || isLoading) {
        return;
    }
    const nextPage = currentPage + 1;
    await withSpinner(btn, () => fetchAndProcessData(nextPage, true));
}

window.updateLoadMoreButton = function() {
    const btn = document.getElementById('load-more-btn');
    if (!btn) return;

    if (hasMoreData) {
        btn.style.display = 'block';
    } else {
        btn.style.display = 'none';
    }
}

window.updateActiveFilterButton = function() {
    document.querySelectorAll('#filter-buttons button').forEach(btn => {
        if (btn.dataset.filter === currentFilter) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

window.renderFeedbackCard = function(fb, index, animationOffset = 0) {
    const userName = escapeHtml(((fb.userId && fb.userId.name) ? fb.userId.name : fb.name) || 'Guest User');
    const avatarUrl = fb.avatarUrl || `https://api.dicebear.com/8.x/pixel-art/svg?seed=${encodeURIComponent(userName)}`;
    const rating = safeRating(fb.rating);
    const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
    const feedbackTime = niceTime(fb.timestamp || fb.createdAt);
    const verificationBadge = (fb.userId && fb.userId.isVerified) ? `<img class="verification-badge" src="/images/blue-tick.svg" alt="Verified">` : '';

    const animDelay = (animationOffset + index) * 30;

    const replyIndicator = (fb.replies && fb.replies.length > 0) ? `<span class="reply-indicator" title="Admin has replied"><i class="fas fa-reply"></i></span>` : '';
    
    // CHANGE: Added logic to render the last reply directly on the card
    const lastReply = fb.replies && fb.replies.length > 0 ? fb.replies[fb.replies.length - 1] : null;
    const replyHtml = lastReply ? `
        <div class="admin-reply-summary">
            <img src="${ADMIN_AVATAR}" alt="admin" class="admin-reply-avatar">
            <div class="admin-reply-text">
                <strong>${escapeHtml(ADMIN_NAME)}:</strong> ${escapeHtml(lastReply.text)}
            </div>
        </div>
    ` : '';

    return `
        <div class="feedback-card" data-id="${escapeHtml(fb._id)}" style="animation-delay: ${animDelay}ms">
            <div class="card-selector"><input type="checkbox" value="${escapeHtml(fb._id)}"></div>
            <div class="card-main-content">
                <div class="header-row">
                    <img src="${escapeHtml(avatarUrl)}" alt="avatar" class="card-avatar">
                    <div class="user-info">
                        <span class="user-name">${userName}</span>
                        ${verificationBadge}
                        ${fb.isPinned ? '📌' : ''}
                        ${replyIndicator}
                    </div>
                </div>
                <div class="content-row">
                    <p class="rating">${stars}</p>
                    <p class="feedback-time">${escapeHtml(feedbackTime)}</p>
                </div>
                <p class="feedback-text">${escapeHtml(fb.feedback)}</p>
                ${replyHtml}
            </div>
        </div>`;
}

window.renderDetailScreen = function(feedbackId) {
    const fb = allFeedbacks.find(f => f._id === feedbackId);
    if (!fb) return navigateToList();

    const userName = ((fb.userId && fb.userId.name) ? fb.userId.name : fb.name) || 'Guest User';
    const userAvatar = fb.avatarUrl || `https://api.dicebear.com/8.x/pixel-art/svg?seed=${encodeURIComponent(userName)}`;
    const timeOptions = {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    };
    const detailContainer = document.getElementById('detail-container');
    let userTag = '';
    const blueTickPath = '/images/blue-tick.svg',
        redTickPath = '/images/red-tick.svg';
    if (fb.userId && typeof fb.userId === 'object') {
        if (fb.userId.isVerified) userTag = `<img src="${blueTickPath}" alt="V" title="Verified" style="height:1.25rem;">`;
        else if (fb.userId.loginMethod === 'email') userTag = `<img src="${redTickPath}" alt="NV" title="Not Verified" style="height:1.25rem;">`;
    } else if (fb.googleIdSubmitter) {
        userTag = `<img src="${blueTickPath}" alt="V" title="Verified (Google Legacy)" style="height:1.25rem;">`;
    } else {
        userTag = `<img src="${redTickPath}" alt="G" title="Guest or Unknown" style="height:1.25rem;">`;
    }

    const repliesHtml = fb.replies && fb.replies.length > 0 ? fb.replies.map(r => `
                <div class="reply-item" id="reply-${r._id}">
                    <div class="reply-header">
                        <img src="${ADMIN_AVATAR}" alt="admin avatar" class="reply-avatar">
                        <strong>${escapeHtml(r.adminName || 'Admin')}</strong>
                    </div>
                    <p class="reply-text">${escapeHtml(r.text)}</p>
                    <small>${escapeHtml(new Date(r.timestamp).toLocaleString('en-US', timeOptions))}</small>
                    <div class="edit-reply-form" style="display: none;">
                        <textarea class="edit-reply-textarea">${escapeHtml(r.text)}</textarea>
                        <div class="reply-actions" style="justify-content: flex-end; margin-top: 8px;">
                            <button class="reply-btn send" onclick="tryEditReply('${escapeHtml(fb._id)}', '${escapeHtml(r._id)}', this)">Save</button>
                            <button class="reply-btn cancel" onclick="toggleEditReply('${escapeHtml(fb._id)}', '${escapeHtml(r._id)}')">Cancel</button>
                        </div>
                    </div>
                    <div class="reply-actions" id="reply-actions-${escapeHtml(r._id)}">
                        <button class="reply-action-btn edit" onclick="toggleEditReply('${escapeHtml(fb._id)}', '${escapeHtml(r._id)}')">Edit</button>
                        <button class="reply-action-btn danger" onclick="tryDeleteReply('${escapeHtml(fb._id)}', '${escapeHtml(r._id)}', this)">Delete</button>
                    </div>
                </div>`).join('') : '<p>No replies yet.</p>';

    const originalContentHtml = (fb.isEdited && fb.originalContent) ? `
                <div class="detail-section">
                    <h4>Original Content (Pre-edit)</h4>
                    <p><strong>Feedback:</strong> "${escapeHtml(fb.originalContent.feedback)}"</p>
                    <small>Posted: ${escapeHtml(new Date(fb.originalContent.timestamp).toLocaleString('en-US', timeOptions))}</small>
                </div>` : '';

    detailContainer.innerHTML = `
                <header class="detail-header">
                    <button class="back-button" onclick="navigateToList()">‹</button>
                    <h2>${userName} ${userTag}</h2>
                </header>
                <div class="detail-content">
                    <div class="detail-section">
                        <h4>Manage</h4>
                        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:1rem;">
                            <button class="action-button" onclick="tryPinFeedback('${escapeHtml(fb._id)}', ${fb.isPinned}, this)">${fb.isPinned ? 'Unpin' : 'Pin'}</button>
                            <button class="action-button" onclick="tryChangeAvatarForFeedback('${escapeHtml(fb._id)}', this)">New Avatar</button>
                            <button class="action-button danger" onclick="tryDeleteFeedback('${escapeHtml(fb._id)}', this)">Delete</button>
                        </div>
                    </div>
                    <div class="detail-section">
                        <h4>Feedback Details ${fb.isEdited ? '(Edited)' : ''}</h4>
                        <div class="feedback-display">
                            <img src="${escapeHtml(userAvatar)}" alt="user avatar" class="feedback-display-avatar">
                            <div>
                                <p class="rating" style="font-size:1.2rem; margin-top:0;">${'★'.repeat(safeRating(fb.rating))}${'☆'.repeat(5 - safeRating(fb.rating))}</p>
                                <p>"${escapeHtml(fb.feedback)}"</p>
                                <small>Submitted: ${escapeHtml(new Date(fb.timestamp).toLocaleString('en-US', timeOptions))}</small>
                            </div>
                        </div>
                    </div>
                    ${originalContentHtml}
                    <div class="detail-section">
                        <h4>Replies</h4>
                        <div class="replies-list" style="margin-top:1.25rem;">${repliesHtml}</div>
                    </div>
                    <div class="detail-section">
                        <h4>Reply as ${escapeHtml(ADMIN_NAME)}</h4>
                        <textarea id="reply-text" placeholder="Your reply..."></textarea>
                        <button class="action-button" style="width:100%" onclick="tryPostReply('${escapeHtml(fb._id)}', this)">Send Reply</button>
                    </div>
                </div>`;
    // Removed markFeedbackAsRead
}

window.calculateAndDisplayStats = function(data) {
    const total = data.totalFeedbacks;
    const avgRating = data.averageRating;
    const pinned = data.totalPinned;
    const replies = data.totalReplies;
    document.getElementById('stats-total').textContent = total;
    document.getElementById('stats-avg-rating').textContent = `${avgRating} ★`;
    document.getElementById('stats-pinned').textContent = pinned;
    document.getElementById('stats-replies').textContent = replies;
}

window.navigateToDetail = function(id) {
    sessionStorage.setItem('lastFeedbackListState', JSON.stringify({
        filter: currentFilter,
        searchTerm: currentSearchTerm,
        scrollPosition: document.getElementById('feedback-list').scrollTop
    }));
    
    renderDetailScreen(id);
    document.getElementById('list-container').classList.add('slide-out');
    document.getElementById('detail-container').classList.add('active');
}

window.navigateToList = function() {
    const savedState = JSON.parse(sessionStorage.getItem('lastFeedbackListState'));
    
    document.getElementById('list-container').classList.remove('slide-out');
    document.getElementById('detail-container').classList.remove('active');
    document.getElementById('list-container').classList.add('active');
    
    if (savedState) {
        currentFilter = savedState.filter;
        currentSearchTerm = savedState.searchTerm;
        
        fetchAndProcessData(1, false).then(() => {
            const listEl = document.getElementById('feedback-list');
            if (listEl) {
                listEl.scrollTop = savedState.scrollPosition;
            }
        });
        
    } else {
        updateActiveFilterButton();
        renderList();
    }
}

window.tryDeleteFeedback = async function(id, btn) {
    const confirmed = await showCustomConfirm(
        'Delete this feedback permanently? This action cannot be undone.',
        'Confirm Deletion'
    );
    if (!confirmed) return;

    await withSpinner(btn, async () => {
        await performApiAction(`/api/admin/feedback/${id}`, {
            method: 'DELETE',
        });
        showToast('Feedback deleted successfully!', 'success');
        
        const feedbackCard = document.querySelector(`.feedback-card[data-id="${id}"]`);
        if (feedbackCard) {
            feedbackCard.remove();
        }
        
        navigateToList();
        allFeedbacks = allFeedbacks.filter(fb => fb._id !== id);
    });
}

window.tryDeleteSelectedFeedbacks = async function() {
    const selectedIds = Array.from(document.querySelectorAll('#feedback-list input[type="checkbox"]:checked')).map(cb => cb.value);
    if (selectedIds.length === 0) return showToast('No items selected.', 'warning');

    const confirmed = await showCustomConfirm(
        `Delete ${selectedIds.length} selected items permanently? This action cannot be undone.`,
        'Confirm Bulk Deletion'
    );
    if (!confirmed) return;
    
    const bulkBtn = document.querySelector('.bulk-action-btn');

    await withSpinner(bulkBtn, async () => {
        await performApiAction('/api/admin/feedbacks/batch-delete', {
            method: 'DELETE',
            body: JSON.stringify({
                ids: selectedIds
            }),
        });
        showToast(`${selectedIds.length} items deleted successfully!`, 'success');
        
        selectedIds.forEach(id => {
            const feedbackCard = document.querySelector(`.feedback-card[data-id="${id}"]`);
            if (feedbackCard) {
                feedbackCard.remove();
            }
        });
        allFeedbacks = allFeedbacks.filter(fb => !selectedIds.includes(fb._id));
    });
}

window.tryPinFeedback = async function(id, isPinned, btn) {
    await withSpinner(btn, async () => {
        const updatedData = await performApiAction(`/api/admin/feedback/${id}/pin`, {
            method: 'PUT',
            body: JSON.stringify({
                isPinned: !isPinned
            }),
        });
        
        const fb = allFeedbacks.find(f => f._id === id);
        if (fb) fb.isPinned = updatedData.isPinned;
        
        renderList();
        renderDetailScreen(id);

        showToast(`Feedback ${updatedData.isPinned ? 'pinned' : 'unpinned'}!`, 'success');
    });
}

window.tryChangeAvatarForFeedback = async function(id, btn) {
    await withSpinner(btn, async () => {
        const updatedData = await performApiAction(`/api/admin/feedback/${id}/change-avatar`, {
            method: 'PUT',
        });
        
        const fb = allFeedbacks.find(f => f._id === id);
        if (fb) fb.avatarUrl = updatedData.avatarUrl;
        
        renderList();
        renderDetailScreen(id);
        
        showToast('Avatar regenerated!', 'success');
    });
}

window.tryPostReply = async function(id, btn) {
    const textEl = document.getElementById('reply-text');
    const text = textEl.value.trim();
    if (!text) return showToast('Reply cannot be empty.', 'warning');

    await withSpinner(btn, async () => {
        const data = await performApiAction(`/api/admin/feedback/${id}/reply`, {
            method: 'POST',
            body: JSON.stringify({
                replyText: text,
                adminName: ADMIN_NAME
            }),
        });

        const fb = allFeedbacks.find(f => f._id === id);
        if (fb) {
            fb.replies = fb.replies || [];
            fb.replies.push(data.reply);
        }
        
        renderDetailScreen(id);
        
        textEl.value = '';
        showToast('Reply sent!', 'success');
    });
}

window.toggleEditReply = function(feedbackId, replyId) {
    const replyEl = document.getElementById(`reply-${replyId}`);
    if (!replyEl) return;

    const textEl = replyEl.querySelector('.reply-text');
    const formEl = replyEl.querySelector('.edit-reply-form');
    const actionButtonsEl = replyEl.querySelector(`#reply-actions-${replyId}`);

    const isEditing = formEl.style.display === 'block';

    textEl.style.display = isEditing ? 'block' : 'none';
    formEl.style.display = isEditing ? 'none' : 'block';
    actionButtonsEl.style.display = isEditing ? 'flex' : 'none';
}

window.tryEditReply = async function(feedbackId, replyId, btn) {
    const replyEl = document.getElementById(`reply-${replyId}`);
    const textarea = replyEl.querySelector('.edit-reply-textarea');
    const newText = textarea.value.trim();
    if (!newText) return showToast('Reply cannot be empty.', 'warning');

    await withSpinner(btn, async () => {
        await performApiAction(`/api/admin/feedback/${feedbackId}/reply/${replyId}`, {
            method: 'PUT',
            body: JSON.stringify({
                text: newText
            }),
        });
        
        const fb = allFeedbacks.find(f => f._id === feedbackId);
        if (fb) {
            const reply = fb.replies.find(r => r._id === replyId);
            if (reply) reply.text = newText;
        }

        renderDetailScreen(feedbackId);
        
        showToast('Reply updated!', 'success');
    });
}

window.tryDeleteReply = async function(feedbackId, replyId, btn) {
    const confirmed = await showCustomConfirm('Are you sure you want to delete this reply?', 'Confirm Reply Deletion');
    if (!confirmed) return;

    await withSpinner(btn, async () => {
        await performApiAction(`/api/admin/feedback/${feedbackId}/reply/${replyId}`, {
            method: 'DELETE',
        });
        
        const fb = allFeedbacks.find(f => f._id === feedbackId);
        if (fb) {
            fb.replies = fb.replies.filter(r => r._id !== replyId);
        }
        
        renderDetailScreen(feedbackId);
        
        showToast('Reply deleted!', 'success');
    });
}

// Removed markFeedbackAsRead function
// Removed pollUnreadCount function
// Removed showBrowserNotification function
// Removed onNewFeedbackReceived function
// Removed onNewFeedbackReceivedFromSW function
// Removed renderNotifList function
// Removed openNotifModal function
// Removed setBellActive function
// Removed showLoader function
// Removed hideLoader function

window.initFeedbackModule = function() {
    document.getElementById('search-input').addEventListener('input', e => {
        const term = e.target.value.trim().toLowerCase();
        window.currentSearchTerm = term;
        
        // Debounce server query
        clearTimeout(searchTimer);
        searchTimer = setTimeout(async () => {
            // Cancel previous server fetch (if any)
            if (searchAbort) searchAbort.abort();
            searchAbort = new AbortController();
            
            // Perform a new search query from scratch
            try {
                await fetchAndProcessData(1, false, { signal: searchAbort.signal });
            } catch (err) {
                if (err.name !== 'AbortError') {
                    console.error('Server search error', err);
                }
            }
        }, 300);
    });

    // Filter buttons
    document.getElementById('filter-buttons').addEventListener('click', e => {
        if (e.target.tagName === 'BUTTON') {
            currentFilter = e.target.dataset.filter;
            fetchAndProcessData(1, false);
        }
    });
    
    // Initial fetch of feedbacks and stats
    fetchAndProcessData(1, false);
}