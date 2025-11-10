// admin-panel-src/js/feedback.js
// REFACTORED FOR HIGH-LEVEL PERFORMANCE & ERROR HANDLING
// FINAL VERSION: Includes "Optimistic UI" for local state changes.

window.allFeedbacks = [];
window.currentFilter = 'all';
window.currentSearchTerm = '';
window.lastSeenFeedback = null;
window.isLoading = false;
window.hasMoreData = true;
window.ITEMS_PER_PAGE = 10;
window.currentPage = 1;

let searchTimer = null;
let searchAbort = null;

// ──────────────────────────────────────────────────────────────────
//   SUGGESTION 3: CENTRALIZED API & ERROR HANDLING
// ──────────────────────────────────────────────────────────────────

// Custom error for handling 401 redirects
class RedirectError extends Error {
    constructor(message) {
        super(message);
        this.name = 'RedirectError';
    }
}

/**
 * Centralized API fetch function.
 * Handles auth tokens, content types, and critical errors (like 401).
 * @param {string} url - The API endpoint
 * @param {object} options - Fetch options (method, body, etc.)
 * @returns {Promise<any>} - The JSON response
 * @throws {RedirectError} - On 401 Unauthorized
 * @throws {Error} - On other network or server errors
 */
async function apiFetch(url, options = {}) {
    const token = localStorage.getItem('adminToken');
    const headers = {
        'Content-Type': 'application/json', // Default to JSON
        ...options.headers,
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Ensure body is stringified if it's an object
    let body = options.body;
    if (typeof body === 'object' && body !== null && !(body instanceof FormData)) {
        body = JSON.stringify(body);
    }

    try {
        const res = await fetch(url, { ...options, headers, body });

        // === 401 Unauthorized: Session Expired ===
        if (res.status === 401) {
            showToast('Session expired. Logging out...', 'error');
            setTimeout(() => window.location.href = '/admin-login.html', 2000);
            throw new RedirectError('Unauthorized');
        }

        // === Other Server Errors ===
        if (!res.ok) {
            const errData = await res.json().catch(() => ({ message: res.statusText }));
            throw new Error(errData.message || `Server error: ${res.status}`);
        }

        // === Success (No Content) ===
        if (res.status === 204) {
            return null;
        }

        // === Success (With JSON Content) ===
        return res.json();

    } catch (err) {
        if (err instanceof TypeError) {
             console.error('Network error or CORS issue:', err);
             throw new Error('Network error. Please check your connection.');
        }
        // Re-throw the error to be caught by withSpinner or the calling function
        throw err;
    }
}

// ──────────────────────────────────────────────────────────────────
//   HELPERS (SPINNER, FORMATTERS, ETC.)
// ──────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  if (!str && str !== 0) return '';
  return String(str).replace(/[&<>"']/g, s => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[s]));
}

function safeRating(r) {
  const n = Number(r) || 0;
  return Math.max(0, Math.min(5, Math.round(n)));
}

function formatFeedbackDate(timestamp) {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const date = new Date(timestamp);
    if (isNaN(date)) return 'Invalid Date';
    const day = String(date.getDate()).padStart(2, '0');
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
}

function getAdminIdFromToken() {
    const token = localStorage.getItem('adminToken');
    if (!token) return null;
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.userId;
    } catch (e) {
        console.error("Failed to decode admin token:", e);
        return null;
    }
}

/**
 * Wrapper for API calls to show a loading spinner on a button.
 * Now relies on `apiFetch` to handle errors.
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
        // Don't show a toast if it's a RedirectError,
        // as apiFetch already showed one.
        if (err.name !== 'RedirectError') {
            console.error('API Action Failed:', err);
            showToast(err.message || 'An unexpected error occurred.', 'error');
        }
    } finally {
        btn.innerHTML = oldHtml;
        btn.disabled = originalDisabledState;
    }
};

// ──────────────────────────────────────────────────────────────────
//   SUGGESTION 1: SKELETON LOADERS
// ──────────────────────────────────────────────────────────────────

/**
 * Generates the HTML for a single skeleton card.
 */
function renderSkeletonCard() {
    return `
        <div class="skeleton-card">
            <div class="header-row">
                <div class="card-avatar"></div>
                <div class="user-info">
                    <div class="line"></div>
                    <div class="line line-short"></div>
                </div>
            </div>
            <div class="line line-long"></div>
            <div class="line line-medium"></div>
        </div>
    `;
}

/**
 * Fills the list with a number of skeleton cards.
 * @param {number} count - Number of skeletons to show
 */
function renderSkeletonLoaders(count = 5) {
    const listEl = document.getElementById('feedback-list');
    if (!listEl) return;
    let skeletonsHtml = '';
    for (let i = 0; i < count; i++) {
        skeletonsHtml += renderSkeletonCard();
    }
    listEl.innerHTML = skeletonsHtml;
}


// ──────────────────────────────────────────────────────────────────
//   CORE LOGIC: FETCHING & RENDERING
// ──────────────────────────────────────────────────────────────────

/**
 * Fetches feedback data from the server.
 * @param {number} page - Page number to fetch.
 * @param {boolean} append - Whether to append data or replace.
 * @param {object} fetchOptions - Options for fetch (e.g., signal).
 * @param {boolean} showLoader - Whether to show skeletons on load.
 */
window.fetchAndProcessData = async function(page = 1, append = false, fetchOptions = {}, showLoader = true) {
    if (isLoading && !append) return;
    isLoading = true;

    const listEl = document.getElementById('feedback-list');
    
    // === SUGGESTION 1 (MODIFIED): Show Skeletons only if asked ===
    if (!append && showLoader) {
        renderSkeletonLoaders(ITEMS_PER_PAGE);
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
        // === SUGGESTION 3: Use apiFetch ===
        const data = await apiFetch('/api/feedbacks?' + params.toString(), {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }, // apiFetch adds this, but explicit for GET
            signal: fetchOptions.signal
        });

        const adminId = getAdminIdFromToken();
        let serverList = data.feedbacks || [];
        
        if (adminId) {
            serverList = serverList.map(fb => ({
                ...fb,
                isAdminVoted: fb.upvotes && fb.upvotes.some(voterId => voterId === adminId || voterId.toString() === adminId)
            }));
        }
        
        if (append) {
            allFeedbacks = [...allFeedbacks, ...serverList];
            // === SUGGESTION 2: Efficiently append new items ===
            const newCardsHtml = serverList.map((fb, index) => renderFeedbackCard(fb, index + (allFeedbacks.length - serverList.length))).join(' ');
            if (listEl) {
                listEl.insertAdjacentHTML('beforeend', newCardsHtml);
                attachCardListeners(listEl); // Attach listeners to new cards
            }
        } else {
            allFeedbacks = serverList;
            renderList(); // Full re-render (replaces skeletons)
        }

        window.currentPage = data.currentPage || page;
        window.totalPages = data.totalPages || 1;
        window.hasMoreData = window.currentPage < window.totalPages;
        
        calculateAndDisplayStats(data);
        
    } catch (err) {
        if (err.name !== 'AbortError' && err.name !== 'RedirectError') {
            console.error('fetchAndProcessData error', err);
            // Only show error state if skeletons were showing
            if (!append && showLoader && listEl) {
                listEl.innerHTML = `<div class="error-state"><i class="fas fa-exclamation-triangle"></i><p>${escapeHtml(err.message)}</p><button class="retry-btn" onclick="initFeedbackModule()">Retry</button></div>`;
            } else if (!append && !showLoader && listEl) {
                // On silent refresh, just log it, don't break UI
                console.error("Silent refresh failed.");
            }
        }
    } finally {
        isLoading = false;
        updateLoadMoreButton();
    }
};

/**
 * Attaches click listeners to cards that don't have them.
 * @param {HTMLElement} container - The container to search within (or document).
 */
function attachCardListeners(container = document) {
     container.querySelectorAll('.feedback-card:not([data-events-added])').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('input[type="checkbox"]')) return;
            if (e.target.closest('.js-upvote-display')) return; // Don't navigate on upvote click
            navigateToDetail(card.dataset.id);
        });
        card.setAttribute('data-events-added', 'true');
    });
}

/**
 * Renders the ENTIRE list. Called on initial load or filter change.
 */
window.renderList = function() {
    updateActiveFilterButton();
    const listEl = document.getElementById('feedback-list');
    
    if (allFeedbacks.length === 0) {
        listEl.innerHTML = `<p style="text-align:center; padding: 2rem;">No feedback matches your criteria.</p>`;
    } else {
        const renderedCards = allFeedbacks.map((fb, index) => renderFeedbackCard(fb, index)).join(' ');
        listEl.innerHTML = renderedCards;
    }
    
    attachCardListeners(listEl);
    updateLoadMoreButton();
};


window.loadMoreFeedbacks = async function(btn) {
    if (!hasMoreData || isLoading) return;
    const nextPage = currentPage + 1;
    await withSpinner(btn, () => fetchAndProcessData(nextPage, true, {}, true)); // Always show loader for load more
}

window.updateLoadMoreButton = function() {
    const btn = document.getElementById('load-more-btn');
    if (!btn) return;
    btn.style.display = hasMoreData ? 'block' : 'none';
}

window.updateActiveFilterButton = function() {
    document.querySelectorAll('#filter-buttons button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === currentFilter);
    });
}

window.renderFeedbackCard = function(fb, index, animationOffset = 0) {
    const userName = escapeHtml(((fb.userId && fb.userId.name) ? fb.userId.name : fb.name) || 'Guest User');
    const avatarUrl = fb.avatarUrl || `https://api.dicebear.com/8.x/pixel-art/svg?seed=${encodeURIComponent(userName)}`;
    const rating = safeRating(fb.rating);
    const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
    const feedbackTime = formatFeedbackDate(fb.timestamp || fb.createdAt);
    const verificationBadge = (fb.userId && fb.userId.isVerified) ? `<img class="verification-badge" src="/images/blue-tick.svg" alt="Verified">` : '';
    const animDelay = (animationOffset + index) * 30;
    const replyIndicator = (fb.replies && fb.replies.length > 0) ? `<span class="reply-indicator" title="Admin has replied"><i class="fas fa-reply"></i></span>` : '';
    const upvoteCount = fb.upvoteCount || 0;
    const upvoteDisplay = `
        <span class="upvote-icon-count js-upvote-display" title="Total Upvotes">
            <i class="fas fa-thumbs-up"></i> ${upvoteCount}
        </span>
    `;

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
                    ${upvoteDisplay}
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

// === SUGGESTION 2: Efficiently update a single card in the list ===
/**
 * Updates a single feedback card in the list view without re-rendering the whole list.
 * @param {HTMLElement} cardElement - The .feedback-card DOM element
 * @param {object} fb - The updated feedback data object
 */
function updateFeedbackCard(cardElement, fb) {
    if (!cardElement || !fb) return;

    // Update User Info (for Pin/Reply status)
    const userName = escapeHtml(((fb.userId && fb.userId.name) ? fb.userId.name : fb.name) || 'Guest User');
    const verificationBadge = (fb.userId && fb.userId.isVerified) ? `<img class="verification-badge" src="/images/blue-tick.svg" alt="Verified">` : '';
    const replyIndicator = (fb.replies && fb.replies.length > 0) ? `<span class="reply-indicator" title="Admin has replied"><i class="fas fa-reply"></i></span>` : '';
    
    const userInfo = cardElement.querySelector('.user-info');
    if (userInfo) {
        userInfo.innerHTML = `
            <span class="user-name">${userName}</span>
            ${verificationBadge}
            ${fb.isPinned ? '📌' : ''}
            ${replyIndicator}
        `;
    }
    
    // Update Upvote Count
    const upvoteDisplay = cardElement.querySelector('.js-upvote-display');
    if (upvoteDisplay) {
        upvoteDisplay.innerHTML = `<i class="fas fa-thumbs-up"></i> ${fb.upvoteCount || 0}`;
    }

    // Update Avatar (if it changed)
    const avatar = cardElement.querySelector('.card-avatar');
    if (avatar && fb.avatarUrl && avatar.src !== fb.avatarUrl) {
        avatar.src = fb.avatarUrl;
    }
    
    // Update Last Reply Summary
    const lastReply = fb.replies && fb.replies.length > 0 ? fb.replies[fb.replies.length - 1] : null;
    let replySummaryEl = cardElement.querySelector('.admin-reply-summary');
    
    if (lastReply) {
        const replyHtml = `
            <img src="${ADMIN_AVATAR}" alt="admin" class="admin-reply-avatar">
            <div class="admin-reply-text">
                <strong>${escapeHtml(ADMIN_NAME)}:</strong> ${escapeHtml(lastReply.text)}
            </div>
        `;
        if (replySummaryEl) {
            replySummaryEl.innerHTML = replyHtml;
        } else {
            // Add reply summary if it didn't exist before
            replySummaryEl = document.createElement('div');
            replySummaryEl.className = 'admin-reply-summary';
            replySummaryEl.innerHTML = replyHtml;
            cardElement.querySelector('.card-main-content').appendChild(replySummaryEl);
        }
    } else if (replySummaryEl) {
        // Remove reply summary if no replies exist anymore
        replySummaryEl.remove();
    }
}


window.renderDetailScreen = function(feedbackId) {
    const fb = allFeedbacks.find(f => f._id === feedbackId);
    if (!fb) return navigateToList();

    const userName = ((fb.userId && fb.userId.name) ? fb.userId.name : fb.name) || 'Guest User';
    const userAvatar = fb.avatarUrl || `https://api.dicebear.com/8.x/pixel-art/svg?seed=${encodeURIComponent(userName)}`;
    const detailContainer = document.getElementById('detail-container');
    let userTag = '';
    const blueTickPath = '/images/blue-tick.svg', redTickPath = '/images/red-tick.svg';
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
                    <small>${escapeHtml(formatFeedbackDate(r.timestamp))}</small>
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
                    <small>Posted: ${escapeHtml(formatFeedbackDate(fb.originalContent.timestamp))}</small>
                </div>` : '';

    const initialLikedClass = fb.isAdminVoted ? 'liked' : '';

    detailContainer.innerHTML = `
                <header class="detail-header">
                    <button class="back-button" onclick="navigateToList()">‹</button>
                    <h2>${userName} ${userTag}</h2>
                </header>
                <div class="detail-content">
                    <div class="detail-section">
                        <h4>Manage</h4>
                        <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:1rem;">
                            <button class="action-button admin-vote-toggle ${initialLikedClass}" id="admin-upvote-btn" onclick="tryAdminUpvoteFeedback('${escapeHtml(fb._id)}', this)">
                                <i class="fas fa-thumbs-up"></i>
                            </button>
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
                                <div class="upvote-count-detail" style="margin: 8px 0 15px 0; font-size: 1.1rem; font-weight: 600; color: var(--secondary-color);">
                                    <i class="fas fa-thumbs-up" style="color:#FFD700; margin-right: 5px;"></i> 
                                    ${fb.upvoteCount || 0} upvotes
                                </div>
                                <p>"${escapeHtml(fb.feedback)}"</p>
                                <small>Submitted: ${escapeHtml(formatFeedbackDate(fb.timestamp))}</small>
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
}

// ──────────────────────────────────────────────────────────────────
//   ACTION HANDLERS (Refactored for "Optimistic UI")
// ──────────────────────────────────────────────────────────────────

window.tryAdminUpvoteFeedback = async function(id, btn) {
    await withSpinner(btn, async () => {
        const responseData = await apiFetch(`/api/admin/feedback/${id}/admin-upvote`, {
            method: 'PUT',
        });

        const fb = allFeedbacks.find(f => f._id === id);
        if (fb) {
            fb.upvoteCount = responseData.feedback.upvoteCount;
            fb.isAdminVoted = responseData.feedback.isAdminVoted;
        }

        // === SUGGESTION 2: Efficiently update list card ===
        renderDetailScreen(id);
        const listCard = document.querySelector(`#feedback-list .feedback-card[data-id="${id}"]`);
        if (listCard) updateFeedbackCard(listCard, fb);

        showToast(responseData.message, 'success');
    });
}

window.calculateAndDisplayStats = function(data) {
    document.getElementById('stats-total').textContent = data.totalFeedbacks;
    document.getElementById('stats-avg-rating').textContent = `${data.averageRating} ★`;
    document.getElementById('stats-pinned').textContent = data.totalPinned;
    document.getElementById('stats-replies').textContent = data.totalReplies;
}

// ──────────────────────────────────────────────────────────────────
//   NAVIGATION (*** THE "OPTIMISTIC" FIX IS HERE ***)
// ──────────────────────────────────────────────────────────────────

window.navigateToDetail = function(id) {
    sessionStorage.setItem('lastFeedbackListState', JSON.stringify({
        filter: currentFilter,
        searchTerm: currentSearchTerm,
        scrollPosition: document.getElementById('feedback-list').scrollTop || 0
    }));
    
    renderDetailScreen(id);
    document.getElementById('list-container').classList.add('slide-out');
    document.getElementById('detail-container').classList.add('active');
}

/**
 * Navigates back to the list view.
 * *** UPDATED (OPTIMISTIC UI) ***
 * Does NOT re-fetch data. Instantly renders the locally modified
 * 'allFeedbacks' array (which was changed by Pin/Reply/Delete handlers).
 */
window.navigateToList = function() {
    const savedState = JSON.parse(sessionStorage.getItem('lastFeedbackListState'));
    
    document.getElementById('list-container').classList.remove('slide-out');
    document.getElementById('detail-container').classList.remove('active');
    
    // === SMART FIX: JUST RENDER LOCAL DATA ===
    // The action handlers have already modified the allFeedbacks array.
    // We just need to show it.
    updateActiveFilterButton(); // Update filter button UI
    renderList(); // Re-renders the (now modified) allFeedbacks
    
    if (savedState) {
        // Restore scroll *after* rendering
        const listEl = document.getElementById('feedback-list');
        if (listEl) {
            listEl.scrollTop = savedState.scrollPosition;
        }
    }
}

// ──────────────────────────────────────────────────────────────────
//   ACTION HANDLERS (Continued with "Optimistic" logic)
// ──────────────────────────────────────────────────────────────────

window.tryDeleteFeedback = async function(id, btn) {
    const confirmed = await showCustomConfirm('Delete permanently? Cannot be undone.', 'Confirm Deletion');
    if (!confirmed) return;

    await withSpinner(btn, async () => {
        await apiFetch(`/api/admin/feedback/${id}`, { method: 'DELETE' });
        showToast('Feedback deleted!', 'success');
        
        // === SMART FIX: Modify local array ===
        allFeedbacks = allFeedbacks.filter(f => f._id !== id);
        
        navigateToList();     // Go back to list (ab ye list turant update ho jayegi)
    });
}

window.tryDeleteSelectedFeedbacks = async function() {
    const selectedIds = Array.from(document.querySelectorAll('#feedback-list input[type="checkbox"]:checked')).map(cb => cb.value);
    if (selectedIds.length === 0) return showToast('No items selected.', 'warning');

    const confirmed = await showCustomConfirm(`Delete ${selectedIds.length} items permanently?`, 'Confirm Bulk Deletion');
    if (!confirmed) return;
    
    const bulkBtn = document.querySelector('.bulk-action-btn');
    await withSpinner(bulkBtn, async () => {
        await apiFetch('/api/admin/feedbacks/batch-delete', {
            method: 'DELETE',
            body: { ids: selectedIds },
        });
        showToast(`${selectedIds.length} items deleted!`, 'success');
        
        // === SMART FIX: Modify local array ===
        allFeedbacks = allFeedbacks.filter(fb => !selectedIds.includes(fb._id));
        renderList(); // Re-render the list locally
    });
}

window.tryPinFeedback = async function(id, isPinned, btn) {
    await withSpinner(btn, async () => {
        const updatedData = await apiFetch(`/api/admin/feedback/${id}/pin`, {
            method: 'PUT',
            body: { isPinned: !isPinned },
        });
        
        const fb = allFeedbacks.find(f => f._id === id);
        if (fb) fb.isPinned = updatedData.isPinned;
        
        // === SMART FIX: Modify local array (Re-sort) ===
        // Server ki tarah locally sort karo (Pinned top par, fir date se)
        // Only re-sort if the filter is 'all'
        if (currentFilter === 'all' || currentFilter === 'pinned') {
            allFeedbacks.sort((a, b) => {
                // 1. Pinned items ko hamesha upar rakho
                if (a.isPinned && !b.isPinned) return -1;
                if (!a.isPinned && b.isPinned) return 1;
                
                // 2. Agar dono pinned hain ya dono unpinned hain, toh date se sort karo
                return new Date(b.timestamp) - new Date(a.timestamp);
            });
        }
        // ===

        renderDetailScreen(id); // Detail screen update karo
        
        // Local list card update (Suggestion 2)
        const listCard = document.querySelector(`#feedback-list .feedback-card[data-id="${id}"]`);
        if (listCard) updateFeedbackCard(listCard, fb);

        showToast(`Feedback ${updatedData.isPinned ? 'pinned' : 'unpinned'}!`, 'success');
    });
}

window.tryChangeAvatarForFeedback = async function(id, btn) {
    await withSpinner(btn, async () => {
        const updatedData = await apiFetch(`/api/admin/feedback/${id}/change-avatar`, {
            method: 'PUT',
        });
        
        const fb = allFeedbacks.find(f => f._id === id);
        if (fb) fb.avatarUrl = updatedData.avatarUrl;
        
        // === SUGGESTION 2: Efficiently update list card ===
        renderDetailScreen(id);
        const listCard = document.querySelector(`#feedback-list .feedback-card[data-id="${id}"]`);
        if (listCard) updateFeedbackCard(listCard, fb);
        
        showToast('Avatar regenerated!', 'success');
    });
}

window.tryPostReply = async function(id, btn) {
    const textEl = document.getElementById('reply-text');
    const text = textEl.value.trim();
    if (!text) return showToast('Reply cannot be empty.', 'warning');

    await withSpinner(btn, async () => {
        const data = await apiFetch(`/api/admin/feedback/${id}/reply`, {
            method: 'POST',
            body: {
                replyText: text,
                adminName: ADMIN_NAME
            },
        });

        const fb = allFeedbacks.find(f => f._id === id);
        if (fb) {
            fb.replies = fb.replies || [];
            fb.replies.push(data.reply);
        }
        
        // === SMART FIX: Modify local array ===
        // Agar 'Unreplied' filter active tha, toh is item ko list se hata do
        if (currentFilter === 'unreplied') {
            allFeedbacks = allFeedbacks.filter(f => f._id !== id);
        }
        // ===
        
        renderDetailScreen(id); // Detail screen update karo
        
        // Local list card update (Suggestion 2) - ye optional hai par acha hai
        const listCard = document.querySelector(`#feedback-list .feedback-card[data-id="${id}"]`);
        if (listCard) updateFeedbackCard(listCard, fb);
        
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
    const textarea = document.querySelector(`#reply-${replyId} .edit-reply-textarea`);
    const newText = textarea.value.trim();
    if (!newText) return showToast('Reply cannot be empty.', 'warning');

    await withSpinner(btn, async () => {
        await apiFetch(`/api/admin/feedback/${feedbackId}/reply/${replyId}`, {
            method: 'PUT',
            body: { text: newText },
        });
        
        const fb = allFeedbacks.find(f => f._id === feedbackId);
        if (fb) {
            const reply = fb.replies.find(r => r._id === replyId);
            if (reply) reply.text = newText;
        }

        // === SUGGESTION 2: Efficiently update list card ===
        renderDetailScreen(feedbackId);
        const listCard = document.querySelector(`#feedback-list .feedback-card[data-id="${feedbackId}"]`);
        if (listCard) updateFeedbackCard(listCard, fb);
        
        showToast('Reply updated!', 'success');
    });
}

window.tryDeleteReply = async function(feedbackId, replyId, btn) {
    const confirmed = await showCustomConfirm('Delete this reply?', 'Confirm Reply Deletion');
    if (!confirmed) return;

    await withSpinner(btn, async () => {
        await apiFetch(`/api/admin/feedback/${feedbackId}/reply/${replyId}`, {
            method: 'DELETE',
        });
        
        const fb = allFeedbacks.find(f => f._id === feedbackId);
        if (fb) {
            fb.replies = fb.replies.filter(r => r._id !== replyId);
        }
        
        // === SMART FIX ===
        // Agar 'replied' filter active tha aur ye aakhri reply tha,
        // toh item ko list se hata do. (Thoda complex, but good)
        if (currentFilter === 'replied' && (!fb.replies || fb.replies.length === 0)) {
            allFeedbacks = allFeedbacks.filter(f => f._id !== feedbackId);
        }
        // ===

        renderDetailScreen(feedbackId);
        const listCard = document.querySelector(`#feedback-list .feedback-card[data-id="${feedbackId}"]`);
        if (listCard) updateFeedbackCard(listCard, fb);
        
        showToast('Reply deleted!', 'success');
    });
}

// ──────────────────────────────────────────────────────────────────
//   INITIALIZATION
// ──────────────────────────────────────────────────────────────────

window.initFeedbackModule = function() {
    document.getElementById('search-input').addEventListener('input', e => {
        const term = e.target.value.trim().toLowerCase();
        window.currentSearchTerm = term;
        
        clearTimeout(searchTimer);
        searchTimer = setTimeout(async () => {
            if (searchAbort) searchAbort.abort();
            searchAbort = new AbVortController();
            
            try {
                // Search should always show loader
                await fetchAndProcessData(1, false, { signal: searchAbort.signal }, true);
            } catch (err) {
                if (err.name !== 'AbortError') {
                    console.error('Server search error', err);
                }
            }
        }, 300);
    });

    document.getElementById('filter-buttons').addEventListener('click', e => {
        if (e.target.tagName === 'BUTTON') {
            currentFilter = e.target.dataset.filter;
            // Filter change should show loader
            fetchAndProcessData(1, false, {}, true);
        }
    });
    
    // Initial fetch (should show loader)
    fetchAndProcessData(1, false, {}, true);
}
