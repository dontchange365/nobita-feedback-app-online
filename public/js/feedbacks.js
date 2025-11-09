// public/js/feedbacks.js
// This file contains all the JavaScript logic specific to the feedback section.
// It is designed to be loaded alongside main.js and other core scripts.

// Global state variables for the feedback form and data
const FEEDBACKS_CACHE_KEY = 'nobi_feedbacks';
let currentSelectedRating = 0;
let isEditing = false;
let currentEditFeedbackId = null;

// --- API ENDPOINTS (FIXED) ---
const API_FEEDBACKS_URL = '/api/feedback'; // Used for POST (new feedback)
const API_FEEDBACK_URL = '/api/feedback'; // Used for PUT (editing single item, same path but PUT method)
const API_FETCH_FEEDBACKS_URL = '/api/feedbacks'; // Used for GET (list)
// --- END API ENDPOINTS ---

// The main `currentUser` object will be available globally from `main.js`.
// The utility functions (`apiRequest`, `showStylishPopup`, `closeStylishPopup`, `updateUIAfterLogin`, etc.)
// are also globally available via the `window` object in `main.js`.

// --- DISPLAY CONFIG ---
const DESIRED_DISPLAY_NAME = "👉𝙉𝙊𝘽𝙄𝙏𝘼🤟";
// --- DISPLAY CONFIG ---


// --- Feedback Specific Functions ---
function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
window.generateUUID = generateUUID;

const starsElements = document.querySelectorAll('.star');
const ratingInput = document.getElementById('rating');
const nameInputInFeedbackForm = document.getElementById('name');
const feedbackTextarea = document.getElementById('feedback');
const submitButton = document.getElementById('submit-feedback');
const sendVerificationEmailBtnForm = document.getElementById('send-verification-email-btn-form');
const feedbackVerificationPrompt = document.getElementById('feedback-verification-prompt');
const feedbackListContainer = document.getElementById('feedback-list-container');
const averageRatingDisplayEl = document.getElementById('average-rating-display');
const lazyLoadSpinner = document.getElementById('lazy-load-spinner-container');

// NEW GLOBAL VARIABLE TO STORE THE ID
let globalTargetFeedbackId = null;
window.hasScrolledToId = false;

starsElements.forEach(star => {
    star.addEventListener('click', () => {
        const value = parseInt(star.dataset.value);
        currentSelectedRating = value;
        if (ratingInput) ratingInput.value = value;
        updateStarVisuals(value);
    });
    star.addEventListener('mouseover', () => {
        const value = parseInt(star.dataset.value);
        updateStarVisuals(value, true);
    });
    star.addEventListener('mouseout', () => {
        updateStarVisuals(currentSelectedRating);
    });
});

function updateStarVisuals(val, isHover = false) {
    starsElements.forEach(s => {
        const sVal = parseInt(s.dataset.value);
        if (isHover) {
            if (sVal <= val) s.classList.add('highlighted');
            else s.classList.remove('highlighted');
            s.classList.remove('selected');
        } else {
            if (sVal <= val) s.classList.add('selected');
            else s.classList.remove('selected');
            s.classList.remove('highlighted');
        }
    });
}
window.updateStarVisuals = updateStarVisuals;

// Lazy loading variables (re-using globals from main.js)
let PAGE_LIMIT = 10;
const DEBOUNCE_DELAY = 200;

let lastScrollPosition = 0;
let lastScrollTime = 0;

// Debounce function to limit scroll event calls
function debounce(func, delay) {
    let timeoutId;
    return function(...args) {
        const context = this;
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(context, args), delay);
    };
}

// Main rendering function, now optimized for appending
function renderFeedbackData(feedbacksArray, append = false, totalCount = 0, averageRating = 0) {
    if (!feedbackListContainer) return;

    if (!append) {
        // Clear all feedback items and messages, but keep average rating container and title
        const childrenToRemove = Array.from(feedbackListContainer.children).filter(child => child.id !== 'average-rating-display' && child.tagName.toLowerCase() !== 'h2' && child.classList.contains('feedback-item'));
        childrenToRemove.forEach(child => child.remove());

        // Update average rating and total count only on the first load
        updateAverageRating(averageRating, totalCount);

        const existingMsgP = feedbackListContainer.querySelector('p.no-feedback-message');
        if (existingMsgP) existingMsgP.remove();

        if (feedbacksArray.length === 0) {
            const msgP = document.createElement('p');
            msgP.textContent = 'No feedbacks yet. Be the first to share your thoughts!';
            msgP.className = 'no-feedback-message';
            msgP.style.cssText = 'text-align:center; padding:20px; color:rgba(255,255,255,0.7); grid-column: 1 / -1;';
            feedbackListContainer.appendChild(msgP);
            return;
        }
    } else {
        const existingMsgP = feedbackListContainer.querySelector('p.no-feedback-message');
        if (existingMsgP) existingMsgP.remove();
    }

    // Append the new feedbacks
    feedbacksArray.forEach(addFeedbackToDOM);
    
    // NEW: Scroll after rendering
    scrollToFeedbackIfRequired();
}
window.renderFeedbackData = renderFeedbackData;

async function fetchFeedbacks() {
    if (window.isLoadingFeedbacks || !window.hasMoreFeedbacks) return;

    window.isLoadingFeedbacks = true;
    if (lazyLoadSpinner) lazyLoadSpinner.style.display = 'block';

    try {
        const url = `${API_FETCH_FEEDBACKS_URL}?page=${window.currentPage}&limit=${PAGE_LIMIT}`;
        const responseData = await window.apiRequest(url, 'GET');

        let feedbacksArray = responseData.feedbacks;
        
        // Render new feedbacks (append=true)
        const isFirstLoad = window.currentPage === 1;
        renderFeedbackData(feedbacksArray, !isFirstLoad, responseData.totalFeedbacks, responseData.averageRating);

        // Update global state
        window.currentPage++;
        window.hasMoreFeedbacks = responseData.hasMore;
        window.totalFeedbacksCount = responseData.totalFeedbacks;
        window.currentAverageRating = responseData.averageRating;

        if (window.hasMoreFeedbacks) {
            console.log(`Page ${window.currentPage - 1} loaded. Loading more feedbacks...`);
        } else {
            console.log("All feedbacks have been loaded.");
        }

    } catch (err) {
        console.error("Failed to fetch feedbacks:", err);
        window.hasMoreFeedbacks = false; // Stop trying to fetch on error
        if (window.currentPage === 1) {
            // Handle initial load failure
            renderFeedbackData([]);
        }
    } finally {
        window.isLoadingFeedbacks = false;
        if (lazyLoadSpinner) lazyLoadSpinner.style.display = 'none';
    }
}
window.fetchFeedbacks = fetchFeedbacks;

// --- NEW SCROLL TO FEEDBACK LOGIC START ---

function getTargetIdFromURL() {
    if (globalTargetFeedbackId) return globalTargetFeedbackId;
    
    const urlParams = new URLSearchParams(window.location.search);
    const targetId = urlParams.get('feedbackId');
    if (targetId) {
        globalTargetFeedbackId = targetId;
        // Clean the URL to prevent issues, but keep the globalTargetFeedbackId
        if (window.history.replaceState) {
            // Remove the parameter from the URL bar after grabbing it
            const cleanUrl = window.location.pathname + window.location.search.replace(`feedbackId=${targetId}`, '').replace(/[?&]$/, '');
            window.history.replaceState(null, null, cleanUrl);
        }
    }
    return globalTargetFeedbackId;
}

function scrollToFeedbackIfRequired() {
    const targetId = getTargetIdFromURL();
    
    // Check if we have already scrolled or if there's no ID
    if (!targetId || window.hasScrolledToId) return;

    const targetElement = document.getElementById(`feedback-item-${targetId}`);
    
    if (targetElement) {
        // Scroll the element into view, positioning it in the center
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Highlight the element temporarily using the CSS class
        targetElement.classList.add('highlighted-scroll');
        
        // Set flag to prevent re-scrolling on subsequent scroll/render
        window.hasScrolledToId = true; 

        // Remove highlight after a few seconds
        setTimeout(() => {
            targetElement.classList.remove('highlighted-scroll');
            // After successful scroll, ensure global ID is reset so manual fetch/scroll continues
            globalTargetFeedbackId = null;
        }, 4000);
        
    } else if (!window.isLoadingFeedbacks && window.hasMoreFeedbacks) {
        // If the element isn't found, and we haven't checked all pages, load the next one.
        console.log(`Target ID ${targetId} not found on current pages. Attempting to load next page (Page ${window.currentPage})...`);
        
        // Reset scroll flag momentarily while loading, but keep the target ID
        window.hasScrolledToId = false; 
        fetchFeedbacks();
    }
}
// --- NEW SCROLL TO FEEDBACK LOGIC END ---

// --- UPDATED updateAverageRating FUNCTION (CSS STARS) START ---
function updateAverageRating(avg, count) {
    if(!averageRatingDisplayEl) return;

    const avgNum = parseFloat(avg);
    let sentimentText = 'No ratings yet';
    let sentimentClass = '';
    let fillPercentage = 0; 
    
    // Determine Sentiment Text and Class 
    if (count > 0 && !isNaN(avgNum)) {
        if (avgNum >= 4.5) {
            sentimentText = 'Outstanding! (Excellent)';
            sentimentClass = 'excellent';
        } else if (avgNum >= 3.5) {
            sentimentText = 'Great! (Good)';
            sentimentClass = 'good';
        } else if (avgNum >= 2.5) {
            sentimentText = 'Average (Okay)';
            sentimentClass = 'average';
        } else {
            sentimentText = 'Needs Improvement (Poor)';
            sentimentClass = 'poor';
        }
    } else {
        sentimentClass = 'average';
    }

    // CALCULATE CSS FILL PERCENTAGE
    if (count > 0 && !isNaN(avgNum)) {
        // Calculate width as a percentage of 5 stars
        fillPercentage = (avgNum / 5) * 100;
        if (fillPercentage > 100) fillPercentage = 100; 
    }
    
    // CREATE HTML FOR CSS STARS
    const cssStarsHtml = `
        <div class="css-stars-wrapper">
            <div class="css-stars-empty">★★★★★</div>
            <div class="css-stars-fill" style="width: ${fillPercentage.toFixed(1)}%;">★★★★★</div>
        </div>
    `;

    averageRatingDisplayEl.innerHTML = `
        <div class="average-rating-container animate-in">
            <h3>Overall Average Rating</h3>
            <div class="average-number">${isNaN(avgNum) ? '0.0' : avgNum.toFixed(1)}</div>
            <div class="sentiment-text ${sentimentClass}">${sentimentText}</div>
            ${cssStarsHtml}
            <div class="total-feedbacks-count">Based on ${count} Feedback${count === 1 ? '' : 's'} <span class="badge-total">+${count}</span></div>
        </div>
    `;
}
// --- UPDATED updateAverageRating FUNCTION ENDS ---


// Helper to get the key for storing liked feedback IDs (based on user state)
function getLikedStorageKey() {
    // Agar user logged-in hai, toh user ID se key banao. Warna persistent guest ID se.
    const identifier = (window.currentUser && window.currentUser.userId) ? window.currentUser.userId : getGuestId();
    return `nobi_liked_id_${identifier}`;
}

// Get array of liked feedback IDs from localStorage
function getLikedFeedbacks() {
    const key = getLikedStorageKey();
    try {
        const liked = localStorage.getItem(key);
        // BUG FIX: Ensure all IDs are strings when retrieved for reliable matching
        return liked ? JSON.parse(liked).map(id => String(id)) : [];
    } catch (e) {
        return [];
    }
}

// Save array of liked feedback IDs to localStorage
function setLikedFeedbacks(likedArray) {
    const key = getLikedStorageKey();
    localStorage.setItem(key, JSON.stringify(likedArray));
}

// Check if a feedback is liked by the current user/guest
function isFeedbackLikedByCurrentUser(feedbackId) {
    // BUG FIX: Ensure the feedbackId being checked is also a string
    const idToCheck = String(feedbackId);
    return getLikedFeedbacks().includes(idToCheck);
}

// Guest ID helper function (for persistent guest ID - Required by point 2 and 3)
function getGuestId() {
    let guestId = localStorage.getItem('nobi_guestId');
    if (!guestId) {
        // Generate a temporary ID if not found
        guestId = window.generateUUID(); 
        localStorage.setItem('nobi_guestId', guestId);
    }
    return guestId;
}

// UI Update function (Real-time and API response)
function updateVoteCounts(feedbackId, upvotes, isActive = null) {
    const upvoteCountEl = document.getElementById(`upvote-count-${feedbackId}`);
    const upvoteBtnEl = document.querySelector(`.vote-btn.upvote[data-id="${feedbackId}"]`);

    if (upvoteCountEl) upvoteCountEl.textContent = upvotes;

    if (upvoteBtnEl) {
        if (isActive === true) {
            upvoteBtnEl.classList.add('active');
            upvoteBtnEl.classList.add('liked-animate'); // Add class for animation
            setTimeout(() => upvoteBtnEl.classList.remove('liked-animate'), 300); // Remove class after animation
        } else if (isActive === false) {
            upvoteBtnEl.classList.remove('active');
            upvoteBtnEl.classList.remove('liked-animate'); // Ensure animation class is removed
        } else if (isActive === null) {
            // Use local storage state to set the initial class (for initial page load/real-time updates)
            if (isFeedbackLikedByCurrentUser(feedbackId)) {
                upvoteBtnEl.classList.add('active');
            } else {
                upvoteBtnEl.classList.remove('active');
            }
        }
    }
}

// Voting API Call
async function handleVote(feedbackId, voteType) {
    // Only process upvote
    if (voteType !== 'upvote') return;
    
    const token = localStorage.getItem('jwtToken');
    
    let headers = { 'Content-Type': 'application/json' };
    let body = { voteType: 'upvote' };
    
    // Determine if the user is logged in
    const isUserLoggedIn = !!window.currentUser;
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    } else {
        // If not logged in, pass the persistent guestId
        body.guestId = getGuestId();
    }
    
    try {
        const response = await fetch(`${API_FEEDBACK_URL}/${feedbackId}/vote`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body)
        });

        const data = await response.json();
        if (!response.ok) {
            window.showStylishPopup({ iconType: 'error', title: 'Vote Failed', message: data.message || 'Failed to process your vote. Please try again.', buttons: [{ text: 'OK', action: window.closeStylishPopup }] });
        } else {
            const isUpvoteAdded = data.message.includes('Upvoted successfully');
            
            // 1. Update localStorage cache based on the outcome
            let likedIds = getLikedFeedbacks();
            if (isUpvoteAdded) {
                if (!likedIds.includes(String(feedbackId))) { // BUG FIX: Ensure ID is cast to string before pushing
                    likedIds.push(String(feedbackId));
                }
            } else {
                likedIds = likedIds.filter(id => id !== String(feedbackId)); // BUG FIX: Ensure ID is cast to string for filtering
            }
            setLikedFeedbacks(likedIds);

            // 2. Success, update UI with new count and active status
            updateVoteCounts(feedbackId, data.feedback.upvoteCount, isUpvoteAdded);
        }
    } catch (error) {
        console.error('Network error during voting:', error);
        window.showStylishPopup({ iconType: 'error', title: 'Network Error', message: 'Could not connect to server to register your vote.', buttons: [{ text: 'OK', action: window.closeStylishPopup }] });
    }
}

function addFeedbackToDOM(fbData) {
    if (!feedbackListContainer) return;

    // --- Check if item exists and if it's currently being edited (logic retained) ---
    // NEW: Use the unique ID for checking existence
    let item = document.getElementById(`feedback-item-${fbData._id}`); 
    if (item && !isEditing) {
        // Item found, only update vote count
        updateVoteCounts(fbData._id, fbData.upvoteCount || 0);
        return;
    }
    // --------------------------------------------------------------------------------

    item = document.createElement('div');
    item.className = `feedback-item ${fbData.isPinned ? 'pinned' : ''}`;
    item.dataset.feedbackId = fbData._id;
    item.id = `feedback-item-${fbData._id}`; // NEW: Unique ID added for scrolling

    const avatarImg = document.createElement('img');
    avatarImg.className = 'avatar-img';
    const charForAvatar = (fbData.name?.[0]?.toUpperCase() || 'G');
    let avatarSource = fbData.avatarUrl;
    if (!avatarSource && fbData.guestId) {
        avatarSource = `https://api.dicebear.com/8.x/adventurer/svg?seed=${encodeURIComponent((fbData.name || 'guest').toLowerCase() + fbData.guestId)}&flip=true&radius=50&doodle=true&scale=90`;
    } else if (!avatarSource) {
        avatarSource = `https://placehold.co/50x50/6a0dad/FFFFFF?text=${encodeURIComponent(charForAvatar)}`;
    }
    avatarImg.src = avatarSource;
    avatarImg.alt = fbData.name || 'User Avatar';
    avatarImg.onerror = function() { this.src = `https://placehold.co/50x50/6a0dad/FFFFFF?text=${encodeURIComponent(charForAvatar)}`; };

    const detailsDiv = document.createElement('div');
    detailsDiv.className = 'feedback-details';
    const strongName = document.createElement('strong');
    let nameDisplay = fbData.name || 'Guest';
    let typeTag = '', verTag = '';

    if (fbData.userId && typeof fbData.userId === 'object') {
        nameDisplay = fbData.userId.name || fbData.name;
        if (fbData.userId.isVerified) avatarImg.classList.add('verified-user');
        if (fbData.userId.loginMethod === 'google') typeTag = `<span class="user-type-indicator google-user-indicator" title="Logged in with Google">G</span>`;
        if (fbData.userId.isVerified) {
            verTag = `<span class="verified-tag-feedback" title="Email Verified"><i class="fas fa-check-circle"></i></span>`;
        } else if (fbData.userId.loginMethod === 'email') {
            verTag = `<span class="unverified-tag-feedback" title="Email Not Verified">✖ Unverified</span>`;
        }
    } else {
        nameDisplay = fbData.name || 'Guest';
        verTag = `<span class="unverified-tag-feedback" title="Guest Submission${fbData.guestId ? ` (ID: ${fbData.guestId.substring(0,6)}...)` : ''}">Guest</span>`;
    }

    strongName.innerHTML = `${nameDisplay} ${typeTag} ${verTag}`;

    if (fbData.rating) strongName.classList.add(`rating-${fbData.rating}`);
    if (fbData.isEdited && fbData.userId) {
        const edited = document.createElement('span');
        edited.className = 'edited-tag';
        edited.textContent = 'Edited';
        strongName.appendChild(edited);
    }

    const starsDiv = document.createElement('div');
    starsDiv.className = 'feedback-stars';
    starsDiv.textContent = '★'.repeat(fbData.rating) + '☆'.repeat(5 - fbData.rating);
    
    // Check local storage for initial active state (BUG FIX RELIANCE)
    const isInitiallyLiked = isFeedbackLikedByCurrentUser(fbData._id);

    // --- VOTE BUTTON HTML (Upvote Only) ---
    const voteActionsDiv = document.createElement('div');
    voteActionsDiv.className = 'feedback-actions'; 
    voteActionsDiv.innerHTML = `
        <button class="vote-btn upvote ${isInitiallyLiked ? 'active' : ''}" data-vote="upvote" data-id="${fbData._id}" title="Like this feedback">
            <i class="fas fa-thumbs-up"></i> 
            <span id="upvote-count-${fbData._id}">${fbData.upvoteCount || 0}</span>
        </button>
    `;
    // --- VOTE BUTTON HTML END ---
    
    // --- NEW CONTAINER FOR STARS AND LIKE BUTTON (REINSTATED FIX) ---
    const ratingAndActions = document.createElement('div');
    ratingAndActions.className = 'rating-and-actions'; // New class for flex layout
    ratingAndActions.appendChild(starsDiv);
    ratingAndActions.appendChild(voteActionsDiv);
    // --- END NEW CONTAINER ---

    const pFb = document.createElement('p');
    pFb.textContent = fbData.feedback;
    const tsDiv = document.createElement('div');
    tsDiv.className = 'feedback-timestamp';
    try {
        tsDiv.innerHTML = `<i class="far fa-clock"></i> Posted: ${new Date(fbData.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}`;
    } catch (e) {
        tsDiv.innerHTML = `<i class="far fa-clock"></i> Posted: ${new Date(fbData.timestamp).toLocaleString('en-US')}`;
    }
    
    detailsDiv.append(strongName, ratingAndActions, pFb, tsDiv); // Use combined ratingAndActions

    item.append(avatarImg, detailsDiv);

    const isFeedbackOwner = window.currentUser && fbData.userId && typeof fbData.userId === 'object' && fbData.userId._id === window.currentUser.userId;
    const canEdit = isFeedbackOwner && (window.currentUser.loginMethod === 'google' || (window.currentUser.loginMethod === 'email' && window.currentUser.isVerified));

    if (fbData.userId && typeof fbData.userId === 'object') {
        const editBtn = document.createElement('button');
        editBtn.className = 'edit-feedback-btn';
        editBtn.innerHTML = '<i class="fas fa-pencil-alt"></i>';
        editBtn.title = 'Edit your feedback';
        editBtn.disabled = !canEdit;

        if (isFeedbackOwner && window.currentUser.loginMethod === 'email' && !window.currentUser.isVerified) {
            editBtn.title = "Verify your email to edit this feedback.";
        }

        editBtn.onclick = e => {
            e.stopPropagation();
            if (!isFeedbackOwner) {
                return window.showStylishPopup({ iconType: 'error', title: 'Permission Denied', message: 'You can only edit your own feedback.', buttons: [{ text: 'OK', action: window.closeStylishPopup }] });
            }
            if (window.currentUser.loginMethod === 'email' && !window.currentUser.isVerified) {
                return window.showStylishPopup({ iconType: 'warning', title: 'Email Verification Required', message: 'Please verify your email to *edit* your feedback. Resend verification email?', buttons: [{ text: 'Send Email', addSpinnerOnClick: true, spinnerText: 'Sending...', action: async () => { await window.requestAndShowVerificationEmail(); } }, { text: 'Later', action: window.closeStylishPopup }] });
            }
            if (nameInputInFeedbackForm) { nameInputInFeedbackForm.value = fbData.userId.name || fbData.name; nameInputInFeedbackForm.disabled = true; nameInputInFeedbackForm.dispatchEvent(new Event('input')); }
            if (feedbackTextarea) { feedbackTextarea.value = fbData.feedback; feedbackTextarea.dispatchEvent(new Event('input')); }
            currentSelectedRating = fbData.rating; if (ratingInput) ratingInput.value = fbData.rating; updateStarVisuals(fbData.rating);
            if (submitButton) submitButton.innerHTML = '<i class="fas fa-paper-plane"></i> Update Feedback';
            isEditing = true; currentEditFeedbackId = fbData._id;
            if (document.getElementById('feedback-form-container')) document.getElementById('feedback-form-container').scrollIntoView({ behavior: 'smooth', block: 'start' });
            window.showStylishPopup({ iconType: 'info', title: 'Editing Feedback', message: 'The form has been pre-filled. Make changes and click "Update Feedback".', buttons: [{ text: 'Got it!', action: window.closeStylishPopup }] });
        };
        item.appendChild(editBtn);
    }

    if (fbData.replies?.length > 0) {
        const reply = fbData.replies[fbData.replies.length - 1];
        if (reply?.text) {
            const replyDiv = document.createElement('div');
            replyDiv.className = 'admin-reply';
            const adminAva = document.createElement('img');
            adminAva.className = 'admin-reply-avatar';
            adminAva.src = 'https://i.ibb.co/FsSs4SG/creator-avatar.png'; // Image of Admin Creator
            adminAva.alt = 'Admin';
            const replyContent = document.createElement('div');
            replyContent.className = 'admin-reply-content';
            let replyTs = '';
            try { replyTs = `(${new Date(reply.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short' })})`; } catch (e) { replyTs = `(${new Date(reply.timestamp).toLocaleString('en-US')})`; }
            
            // --- FINAL FIX: INTERCEPT AND REPLACE ADMIN NAME FOR DISPLAY ---
            let displayedAdminName = reply.adminName || 'Admin';
            
            // YAHAN Hum Saare Admin/Bot Naamon Ko '👉𝙉𝙊𝘽𝙄𝙏𝘼🤟' Se Replace Kar Rahe Hain
            // TAAKI OLD DATA AUR NEW DATA CONSISTENT DIKHE
            if (displayedAdminName !== 'Guest' && displayedAdminName !== 'UNKNOWN_IP') {
                displayedAdminName = DESIRED_DISPLAY_NAME;
            }

            replyContent.innerHTML = `<strong>(${displayedAdminName}):</strong> ${reply.text} <span class="reply-timestamp">${replyTs}</span>`;
            // --- FINAL FIX ENDS ---

            replyDiv.append(adminAva, replyContent);
            detailsDiv.appendChild(replyDiv);
        }
    }

    if (fbData.isPinned) {
        const pinnedBadgeHTML = `
        <div class="pinned-badge">
            <span class="pin-svg">
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 4H16V6H14V4ZM14 2H6V4H14V2ZM12 18V10H8V18H6V8H4V6H6V4C6 2.9 6.9 2 8 2H12C13.1 2 14 2.9 14 4V6H16V8H14V18H12Z" fill="#332400"/>
            </svg>
            </span>
            Pinned
        </div>`;
        item.insertAdjacentHTML('afterbegin', pinnedBadgeHTML);
    }

    feedbackListContainer.appendChild(item);
}
window.addFeedbackToDOM = addFeedbackToDOM;

// Resets feedback form
function resetFeedbackForm() {
    const starsElements = document.querySelectorAll('.star');

    if (window.currentUser) {
        if (nameInputInFeedbackForm) {
            nameInputInFeedbackForm.value = window.currentUser.name;
            nameInputInFeedbackForm.disabled = true;
            nameInputInFeedbackForm.dispatchEvent(new Event('input'));
        }
    } else {
        if (nameInputInFeedbackForm) {
            const storedGuestName = localStorage.getItem('nobi_guestName');
            nameInputInFeedbackForm.value = storedGuestName || '';
            nameInputInFeedbackForm.disabled = false;
            nameInputInFeedbackForm.placeholder = ' ';
            nameInputInFeedbackForm.dispatchEvent(new Event('input'));
        }
    }
    if (feedbackTextarea) {
        feedbackTextarea.value = '';
        feedbackTextarea.dispatchEvent(new Event('input'));
    }
    if (ratingInput) ratingInput.value = '0';
    currentSelectedRating = 0;
    updateStarVisuals(0);
    if (submitButton) {
        submitButton.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Feedback';
        submitButton.disabled = false;
    }
    isEditing = false;
    currentEditFeedbackId = null;
    if (feedbackVerificationPrompt && (!window.currentUser || (window.currentUser && window.currentUser.isVerified))) {
        feedbackVerificationPrompt.style.display = 'none';
    }
}
window.resetFeedbackForm = resetFeedbackForm;

// NEW: Handles the post-submission process including asking for notifications
async function handleFeedbackSubmitSuccess(data) {
    if (data && data.feedback) {
        // --- FIX IS HERE ---
        if (data.feedback.guestId) {
            localStorage.setItem('nobi_guestId', data.feedback.guestId);
        }
        if (data.feedback.name) {
            localStorage.setItem('nobi_guestName', data.feedback.name);
        }
        // --- END FIX ---
    }
    window.showStylishPopup({ iconType: 'success', title: 'Feedback Submitted!', message: data.message || 'Thank you for your feedback!', buttons: [{text:'Great!', action: window.closeStylishPopup}] });
    resetFeedbackForm();
    window.currentPage = 1;
    window.hasMoreFeedbacks = true;
    if (feedbackListContainer) feedbackListContainer.innerHTML = '';

    if (averageRatingDisplayEl) feedbackListContainer.appendChild(averageRatingDisplayEl);
    const h2Title = document.createElement('h2');
    h2Title.textContent = 'Recent Feedbacks';
    h2Title.classList.add('section-title');
    feedbackListContainer.appendChild(h2Title);
    await window.fetchFeedbacks();

    // After success, ask for notification permission
    const granted = await requestNotificationPermission();
    if (granted) {
        await window.registerUserForNotifications();
        window.showStylishPopup({
            iconType: 'success',
            title: 'Notifications Enabled!',
            message: "You'll get notified when admin replies to your feedback.",
            buttons: [{text: 'Great!', action: window.closeStylishPopup}]
        });
    } else {
        window.showStylishPopup({
            iconType: 'warning',
            title: 'Notifications Blocked',
            message: 'You can enable notifications later from browser settings.',
            buttons: [{text: 'OK', action: window.closeStylishPopup}]
        });
    }
}
window.handleFeedbackSubmitSuccess = handleFeedbackSubmitSuccess;

// NEW: Requests permission for push notifications
async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        console.warn('Browser notifications not supported.');
        return false;
    }
    if (Notification.permission === 'granted') {
        return true;
    }
    if (Notification.permission === 'denied') {
        return false;
    }
    const permission = await Notification.requestPermission();
    return permission === 'granted';
}
window.requestNotificationPermission = requestNotificationPermission;


// Handle infinite scroll
const handleScroll = () => {
    const scrollPosition = window.scrollY;
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;

    // Throttle scroll event by a simple timestamp check
    const now = Date.now();
    if (now - lastScrollTime < DEBOUNCE_DELAY) {
        return;
    }
    lastScrollTime = now;

    if (scrollPosition + windowHeight >= documentHeight - 500 && !window.isLoadingFeedbacks && window.hasMoreFeedbacks) {
        console.log("Fetching next page...");
        fetchFeedbacks();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // Vote event listener is correctly implemented here
    document.addEventListener('click', (e) => {
        let target = e.target.closest('.vote-btn');
        if (target && target.dataset.vote === 'upvote') {
            const feedbackId = target.dataset.id;
            const voteType = target.dataset.vote;
            if (feedbackId) {
                handleVote(feedbackId, voteType);
            }
        }
    });

    // Socket.IO Listener for Real-time Updates (vote update logic is in place)
    if (typeof io !== 'undefined') {
        const socket = io();
        socket.on('feedback-vote-update', (data) => {
            updateVoteCounts(data.feedbackId, data.upvoteCount);
        });
    }
    
    // Submission logic (also retained)
    if (submitButton) submitButton.addEventListener('click', async () => {
        const feedbackContent = feedbackTextarea.value.trim();
        const ratingValue = ratingInput.value;
        let nameValue;
        let guestId = localStorage.getItem('nobi_guestId');
        let storedGuestName = localStorage.getItem('nobi_guestName');

        if (window.currentUser) {
            nameValue = window.currentUser.name;
        } else {
            nameValue = nameInputInFeedbackForm.value.trim();
            if (!nameValue) {
                return window.showStylishPopup({ iconType: 'error', title: 'Name Required', message: 'Please enter your name to submit feedback as a guest.', buttons: [{text:'OK', action: window.closeStylishPopup}] });
            }

            // --- FIX IS HERE ---
            if (!guestId) {
                guestId = generateUUID();
                localStorage.setItem('nobi_guestId', guestId);
            }
            localStorage.setItem('nobi_guestName', nameValue);
            // --- END FIX ---

            if (nameInputInFeedbackForm.value !== nameValue) nameInputInFeedbackForm.value = nameValue;
        }

        if (!feedbackContent || ratingValue === '0') {
            return window.showStylishPopup({ iconType: 'error', title: 'Missing Information', message: 'Please provide your name (if guest), feedback, and select a rating.', buttons: [{text:'OK', action: window.closeStylishPopup}] });
        }

        let feedbackPayload = { name: nameValue, feedback: feedbackContent, rating: parseInt(ratingValue) };
        if (!window.currentUser && guestId) feedbackPayload.guestId = guestId;

        const isSubmissionByLoggedInUser = !!window.currentUser;
        const url = (isEditing && isSubmissionByLoggedInUser) ? `${API_FEEDBACK_URL}/${currentEditFeedbackId}` : API_FEEDBACKS_URL;
        const method = (isEditing && isSubmissionByLoggedInUser) ? 'PUT' : 'POST';

        if (isEditing && isSubmissionByLoggedInUser && window.currentUser.loginMethod === 'email' && !window.currentUser.isVerified) {
            return window.showStylishPopup({ iconType: 'warning', title: 'Email Verification Required', message: 'Please verify your email to *edit* your feedback.', buttons: [{text:'OK', action: window.closeStylishPopup}] });
        }

        const spinnerText = (isEditing && isSubmissionByLoggedInUser) ? "Updating Feedback..." : "Submitting Feedback...";
        try {
            const data = await window.apiRequest(url, method, feedbackPayload, false, submitButton, spinnerText);

            // Replaced the simple success popup with the new handler
            await handleFeedbackSubmitSuccess(data);

        } catch (error) {
            // Error handled by apiRequest
        }
    });

    const feedbackFormContainer = document.getElementById('feedback-form-container');
    if (feedbackFormContainer) setTimeout(() => feedbackFormContainer.classList.add('animate-in'), 300);
    if (feedbackListContainer) setTimeout(() => feedbackListContainer.classList.add('animate-in'), 400);

    // Initial check and fetch
    window.resetFeedbackForm();

    // Initial grab of the ID and start fetching
    getTargetIdFromURL();

    // Initial fetch of the first page
    window.currentPage = 1;
    window.hasMoreFeedbacks = true;
    fetchFeedbacks();

    // Add scroll event listener for lazy loading
    window.addEventListener('scroll', handleScroll);
});
