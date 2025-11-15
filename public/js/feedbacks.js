// public/js/feedbacks.js
// This file contains all the JavaScript logic specific to the feedback section.
// It is designed to be loaded alongside main.js and other core scripts.

// Global state variables for the feedback form and data
const FEEDBACKS_CACHE_KEY = 'nobi_feedbacks';
let currentSelectedRating = 0;
let isEditing = false;
let currentEditFeedbackId = null;
let currentSortOrder = 'newest'; // NEW: For Sorting
let currentSearchTerm = ''; // NEW: For Search
let searchDebounceTimer = null; // NEW: For Search Debouncing
window.allFeedbacks = []; // NEW: Store all feedbacks locally

// --- API ENDPOINTS (FIXED) ---
// Constants removed, will use global window.API_... from main.js
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

// --- NEW SKELETON FUNCTIONS ---

/**
 * Renders a DETAILED skeleton placeholder for the average rating box.
 */
function renderAverageRatingSkeleton() {
    if(!averageRatingDisplayEl) return;
    // Ye detailed skeleton HTML ko average rating container me daal dega
    averageRatingDisplayEl.innerHTML = `
        <div class="skeleton-avg-rating">
            <div class="skeleton-line" style="width: 60%; height: 20px;"></div>
            <div class="skeleton-big-number"></div>
            <div class="skeleton-line" style="width: 50%;"></div>
            <div class="skeleton-stars"></div>
            <div class="skeleton-line" style="width: 70%; margin-top: 10px;"></div>
        </div>
    `;
}

/**
 * Renders multiple skeleton placeholders for the feedback list.
 * @param {number} count - The number of skeletons to display.
 */
function renderFeedbackSkeletons(count = 3) {
    if(!feedbackListContainer) return;
    
    // Purana "No feedback" message hatao
    const existingMsgP = feedbackListContainer.querySelector('p.no-feedback-message');
    if (existingMsgP) existingMsgP.remove();
    
    let skeletonsHtml = '';
    for (let i = 0; i < count; i++) {
        // Ye ek feedback item ka skeleton HTML hai
        skeletonsHtml += `
            <div class="feedback-item-skeleton">
                <div class="skeleton-avatar"></div>
                <div class="skeleton-details">
                    <div class="skeleton-line" style="width: 40%;"></div>
                    <div class="skeleton-line" style="width: 60%;"></div>
                    <div class="skeleton-line" style="width: 90%; margin-top: 10px;"></div>
                    <div class="skeleton-line" style="width: 80%;"></div>
                </div>
            </div>
        `;
    }
    // Skeletons ko list me add karo
    feedbackListContainer.insertAdjacentHTML('beforeend', skeletonsHtml);
}
// --- END SKELETON FUNCTIONS ---


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

// --- UPDATED (PIN-PRIORITY SMART SORTING) ---
/**
 * Sorts the global `allFeedbacks` array based on `currentSortOrder`
 * and then calls `renderFeedbackData` to update the DOM.
 */
function sortAndRenderList(totalCount, averageRating) {
    // 1. Sort the local array
    window.allFeedbacks.sort((a, b) => {
        // 1. Pinned items ALWAYS come first, regardless of sort order
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;

        // 2. If both are same (pinned or unpinned), THEN use the selected sort order
        if (currentSortOrder === 'popular') {
            // "Most Liked" sort
            return (b.upvoteCount || 0) - (a.upvoteCount || 0);
        } else {
            // "Newest" sort (default)
            return new Date(b.timestamp) - new Date(a.timestamp);
        }
    });
    
    // 2. Re-render the list from the sorted array
    // `append=false` poori list ko naye order me reload karega
    // *** MODIFIED: Return the result of renderFeedbackData ***
    return renderFeedbackData(window.allFeedbacks, false, totalCount, averageRating);
}

// Main rendering function, now optimized for appending
function renderFeedbackData(feedbacksArray, append = false, totalCount = 0, averageRating = 0) {
    if (!feedbackListContainer) return;

    if (!append) {
        // === SKELETON REMOVAL ===
        feedbackListContainer.querySelectorAll('.feedback-item-skeleton').forEach(sk => sk.remove());
        
        // Clear all feedback items (lekin sort/search controls ko nahi)
        const childrenToRemove = Array.from(feedbackListContainer.children).filter(child => 
            child.id !== 'average-rating-display' && 
            child.tagName.toLowerCase() !== 'h2' && 
            !child.classList.contains('feedback-sort-container') && // Sort buttons ko mat hatana
            !child.classList.contains('feedback-search-container') && // NEW: Search bar ko mat hatana
            child.classList.contains('feedback-item')
        );
        childrenToRemove.forEach(child => child.remove());

        // Update average rating
        updateAverageRating(averageRating, totalCount);

        const existingMsgP = feedbackListContainer.querySelector('p.no-feedback-message');
        if (existingMsgP) existingMsgP.remove();

        if (feedbacksArray.length === 0) {
            const msgP = document.createElement('p');
            // NEW: Search ke liye dynamic message
            if (currentSearchTerm) {
                msgP.textContent = `No feedbacks found matching "${currentSearchTerm}".`;
            } else {
                msgP.textContent = 'No feedbacks yet. Be the first to share your thoughts!';
            }
            msgP.className = 'no-feedback-message';
            msgP.style.cssText = 'text-align:center; padding:20px; color:rgba(255,255,255,0.7); grid-column: 1 / -1;';
            feedbackListContainer.appendChild(msgP);
            // return; // Don't return here, need to run scrollToFeedback
        }
    } else {
        const existingMsgP = feedbackListContainer.querySelector('p.no-feedback-message');
        if (existingMsgP) existingMsgP.remove();
    }

    // Append the new feedbacks
    feedbacksArray.forEach(addFeedbackToDOM);
    
    // *** MODIFIED: Return the result of scrollToFeedbackIfRequired ***
    return scrollToFeedbackIfRequired();
}
window.renderFeedbackData = renderFeedbackData;

/**
 * Fetches feedbacks.
 * @returns {Promise<boolean>} - Returns true if the target feedback was found.
 */
async function fetchFeedbacks() {
    if (window.isLoadingFeedbacks || !window.hasMoreFeedbacks) return false;

    window.isLoadingFeedbacks = true;
    if (lazyLoadSpinner) lazyLoadSpinner.style.display = 'block';

    // === SKELETON RENDER ===
    if (window.currentPage === 1) { 
        renderAverageRatingSkeleton(); 
        renderFeedbackSkeletons(3); 
    }

    let found = false; // Variable to store if feedback was found

    try {
        // --- FIX: Build URL string manually instead of using new URL() on a relative path ---
        // Use the global constant from main.js (window.API_FETCH_FEEDBACKS_URL)
        let url = `${window.API_FETCH_FEEDBACKS_URL}?page=${window.currentPage}&limit=${PAGE_LIMIT}`;

        // Agar search term hai, toh use URL mein add karo
        if (currentSearchTerm) {
            url += `&q=${encodeURIComponent(currentSearchTerm)}`;
        }
        // --- END FIX ---

        const responseData = await window.apiRequest(url, 'GET'); // url bhej rahe hain, url.href nahi

        let feedbacksArray = responseData.feedbacks;
        
        // Data ko global array me add/replace karo
        if (window.currentPage === 1) {
            window.allFeedbacks = feedbacksArray;
        } else {
            // Duplicates ko filter karke hi add karein
            feedbacksArray.forEach(fb => {
                if (!window.allFeedbacks.find(f => f._id === fb._id)) {
                    window.allFeedbacks.push(fb);
                }
            });
        }

        // --- MODIFIED (SMART SORTING & RECURSION FIX) ---
        // sortAndRenderList ab `true` ya `false` return karega
        found = sortAndRenderList(responseData.totalFeedbacks, responseData.averageRating);
        
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
            sortAndRenderList(0, 0); // Skeletons ko hatane ke liye
        }
    } finally {
        window.isLoadingFeedbacks = false;
        if (lazyLoadSpinner) lazyLoadSpinner.style.display = 'none';
    }
    
    return found; // Return karega ki feedback mila ya nahi
}
window.fetchFeedbacks = fetchFeedbacks;

// --- NEW SCROLL TO FEEDBACK LOGIC START ---

function getTargetIdFromURL() {
    if (globalTargetFeedbackId) return globalTargetFeedbackId;
    
    const urlParams = new URLSearchParams(window.location.search);
    const targetId = urlParams.get('feedbackId');
    if (targetId) {
        globalTargetFeedbackId = targetId;
        if (window.history.replaceState) {
            const cleanUrl = window.location.pathname + window.location.search.replace(`feedbackId=${targetId}`, '').replace(/[?&]$/, '');
            window.history.replaceState(null, null, cleanUrl);
        }
    }
    return globalTargetFeedbackId;
}

/**
 * --- MODIFIED: RECURSION REMOVED ---
 * Ab ye function sirf scroll/highlight karta hai agar item milta hai.
 * @returns {boolean} - Returns true if feedback was found and scrolled to.
 */
function scrollToFeedbackIfRequired() {
    const targetId = getTargetIdFromURL();
    
    // Agar ID nahi hai, ya pehle hi scroll kar chuke hain, toh false return karo
    if (!targetId || window.hasScrolledToId) return false;

    const targetElement = document.getElementById(`feedback-item-${targetId}`);
    
    if (targetElement) {
        // MIL GAYA!
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // --- BADA CHANGE (USER REQUEST) ---
        // Purana 'highlighted-scroll' class hata diya
        // Naya permanent glow class 'highlighted-scroll-permanent' add kiya
        targetElement.classList.add('highlighted-scroll-permanent'); 
        // --- END BADA CHANGE ---

        window.hasScrolledToId = true; 
        globalTargetFeedbackId = null; // ID ko clear kar do taaki lazy-loading normal ho jaye
        
        // --- REMOVED ---
        // setTimeout block jo highlight ko remove karta tha, woh hata diya gaya hai.
        // --- END REMOVED ---

        return true; // <<<--- RETURN TRUE (FOUND IT)
    }
    
    // Item abhi tak DOM mein nahi mila
    return false; // <<<--- RETURN FALSE (NOT FOUND YET)
}
// --- NEW SCROLL TO FEEDBACK LOGIC END ---


// --- NEW FUNCTION: PAGE LOADER FOR SHARED LINKS ---
/**
 * Loads pages one by one until the target feedback ID is found.
 * @param {string} targetId 
 */
async function loadPagesUntilFeedbackFound(targetId) {
    console.log(`Searching for feedback ID: ${targetId}...`);
    let found = false;
    
    // Loop while we have more pages AND we haven't found the item
    while (window.hasMoreFeedbacks && !found) {
        console.log(`Fetching page ${window.currentPage}...`);
        // fetchFeedbacks() will load data, render, scroll, and return true/false
        found = await fetchFeedbacks(); 
        
        if (found) {
            console.log(`Successfully found and scrolled to ${targetId}`);
            break;
        }
        
        if (!window.hasMoreFeedbacks && !found) {
            // Sab pages load ho gaye aur feedback nahi mila
            console.warn(`Could not find feedback ${targetId}. Loaded all pages.`);
            window.showStylishPopup({
                iconType: 'error',
                title: 'Feedback Not Found',
                message: `The feedback you linked (${targetId.substring(0, 10)}...) could not be found. It might have been deleted.`,
                buttons: [{ text: 'OK', action: window.closeStylishPopup }]
            });
        }
    }
}
// --- END NEW FUNCTION ---


// --- UPDATED updateAverageRating FUNCTION (CSS STARS) START ---
function updateAverageRating(avg, count) {
    if(!averageRatingDisplayEl) return;

    const avgNum = parseFloat(avg);
    let sentimentText = 'No ratings yet';
    let sentimentClass = '';
    let fillPercentage = 0; 
    
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

    if (count > 0 && !isNaN(avgNum)) {
        fillPercentage = (avgNum / 5) * 100;
        if (fillPercentage > 100) fillPercentage = 100; 
    }
    
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
    const identifier = (window.currentUser && window.currentUser.userId) ? window.currentUser.userId : getGuestId();
    return `nobi_liked_id_${identifier}`;
}

// Get array of liked feedback IDs from localStorage
function getLikedFeedbacks() {
    const key = getLikedStorageKey();
    try {
        const liked = localStorage.getItem(key);
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
    const idToCheck = String(feedbackId);
    return getLikedFeedbacks().includes(idToCheck);
}

// Guest ID helper function (for persistent guest ID - Required by point 2 and 3)
function getGuestId() {
    let guestId = localStorage.getItem('nobi_guestId');
    if (!guestId) {
        guestId = window.generateUUID(); 
        localStorage.setItem('nobi_guestId', guestId);
    }
    return guestId;
}

// --- NEW (ANIMATED COUNT) ---
// UI Update function (Real-time and API response)
function updateVoteCounts(feedbackId, newCount, isActive = null, oldCount = null) {
    const upvoteCountEl = document.getElementById(`upvote-count-${feedbackId}`);
    const upvoteBtnEl = document.querySelector(`.vote-btn.upvote[data-id="${feedbackId}"]`);

    // 1. Handle Count Animation
    if (upvoteCountEl) {
        // Check if old count was provided and is different from new count
        const isDifferent = (oldCount !== null) && (oldCount !== newCount);
        
        if (isDifferent) {
            // Animate from old to new
            upvoteCountEl.classList.remove('count-animate');
            // Force reflow (ye animation ko restart karne ke liye zaroori hai)
            void upvoteCountEl.offsetWidth; 
            // Naya count set karo aur animation class add karo
            upvoteCountEl.textContent = newCount;
            upvoteCountEl.classList.add('count-animate');
        } else {
            // Sirf count set karo (koi animation nahi)
            upvoteCountEl.textContent = newCount;
        }
    }

    // 2. Handle Button Active State (ye pehle jaisa hi hai)
    if (upvoteBtnEl) {
        if (isActive === true) {
            upvoteBtnEl.classList.add('active');
            upvoteBtnEl.classList.add('liked-animate'); 
            setTimeout(() => upvoteBtnEl.classList.remove('liked-animate'), 300); 
        } else if (isActive === false) {
            upvoteBtnEl.classList.remove('active');
            upvoteBtnEl.classList.remove('liked-animate'); 
        } else if (isActive === null) {
            // Real-time update ya error ke case me
            if (isFeedbackLikedByCurrentUser(feedbackId)) {
                upvoteBtnEl.classList.add('active');
            } else {
                upvoteBtnEl.classList.remove('active');
            }
        }
    }
}

// --- NEW (IN-BUTTON SPINNER + ANIMATED COUNT) ---
// Voting API Call
async function handleVote(feedbackId, voteType) {
    if (voteType !== 'upvote') return;

    const upvoteBtnEl = document.querySelector(`.vote-btn.upvote[data-id="${feedbackId}"]`);
    if (!upvoteBtnEl || upvoteBtnEl.classList.contains('loading')) {
        return; // Button nahi mila ya pehle se loading me hai
    }

    // *** NEW: Get OLD count ***
    const upvoteCountEl = document.getElementById(`upvote-count-${feedbackId}`);
    const oldCount = parseInt(upvoteCountEl.textContent, 10) || 0;
    // *** END NEW ***

    // 1. Show Spinner
    upvoteBtnEl.classList.add('loading');
    upvoteBtnEl.disabled = true; // Disable button during request
    
    // --- BUG FIX: Use 'nobita_jwt' instead of 'jwtToken' ---
    const token = localStorage.getItem('nobita_jwt');
    let headers = { 'Content-Type': 'application/json' };
    let body = { voteType: 'upvote' };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    } else {
        body.guestId = getGuestId();
    }
    
    try {
        // 2. Manual Fetch (apiRequest use nahi kar rahe)
        // --- FIX: Use global window.API_FEEDBACK_URL ---
        const response = await fetch(`${window.API_FEEDBACK_URL}/${feedbackId}/vote`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body)
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Failed to process your vote.');
        }

        // 3. Success
        const isUpvoteAdded = data.message.includes('Upvoted successfully');
        const newCount = data.feedback.upvoteCount; // Naya count
        
        // Update localStorage
        let likedIds = getLikedFeedbacks();
        if (isUpvoteAdded) {
            if (!likedIds.includes(String(feedbackId))) { 
                likedIds.push(String(feedbackId));
            }
        } else {
            likedIds = likedIds.filter(id => id !== String(feedbackId)); 
        }
        setLikedFeedbacks(likedIds);

        // *** MODIFIED: Pass OLD count to animation function ***
        updateVoteCounts(feedbackId, newCount, isUpvoteAdded, oldCount);

        // Update local `allFeedbacks` array
        const feedbackInArray = window.allFeedbacks.find(f => f._id === feedbackId);
        if (feedbackInArray) {
            feedbackInArray.upvoteCount = newCount;
        }

        // Re-sort agar popular sort active hai
        if (currentSortOrder === 'popular') {
            sortAndRenderList(window.totalFeedbacksCount, window.currentAverageRating);
        }

    } catch (error) {
        // 4. Show error
        console.error('Network error during voting:', error);
        window.showStylishPopup({ 
            iconType: 'error', 
            title: 'Vote Error', 
            message: error.message || 'Could not connect to server.', 
            buttons: [{ text: 'OK', action: window.closeStylishPopup }] 
        });
        // Error state me, UI ko purani (original) state par reset karo
        updateVoteCounts(feedbackId, oldCount, null, null); 
    } finally {
        // 5. Hide Spinner
        upvoteBtnEl.classList.remove('loading');
        upvoteBtnEl.disabled = false;
    }
}
// --- END (IN-BUTTON SPINNER) ---

// --- NEW (SMART SHARE) ---
/**
 * Handles the click event for the share button.
 * Copies the feedback-specific URL to the clipboard.
 * @param {Event} event - The click event.
 * @param {string} feedbackId - The ID of the feedback to share.
 */
function handleShareClick(event, feedbackId) {
    // Stop click from bubbling up to the edit button or card
    event.stopPropagation();

    // Create the URL
    const url = new URL(window.location.href);
    url.search = `?feedbackId=${feedbackId}`; // Sets the ?feedbackId=...
    url.hash = ''; // Remove any existing hash
    
    const shareUrl = url.href;

    // Copy to clipboard using modern API
    if (navigator.clipboard) {
        navigator.clipboard.writeText(shareUrl).then(() => {
            // Success
            window.showStylishPopup({ 
                iconType: 'success', 
                title: 'Link Copied!', 
                message: 'A direct link to this feedback has been copied to your clipboard.', 
                buttons: [{text:'OK', action: window.closeStylishPopup}] 
            });
        }, (err) => {
            // Fail
            console.error('Failed to copy: ', err);
            window.showStylishPopup({ 
                iconType: 'error', 
                title: 'Copy Failed', 
                message: 'Could not copy the link. Please try again.', 
                buttons: [{text:'OK', action: window.closeStylishPopup}] 
            });
        });
    } else {
        // Fallback for older browsers
        console.warn('Clipboard API not available. Implement fallback.');
    }
}
// --- END (SMART SHARE) ---

// --- REMOVED: GUEST DELETE FUNCTION ---
// (handleGuestDelete function yahaan tha, ab hata diya hai)
// --- END GUEST DELETE FUNCTION ---


function addFeedbackToDOM(fbData) {
    if (!feedbackListContainer) return;

    // Check if item exists
    let item = document.getElementById(`feedback-item-${fbData._id}`); 
    if (item) {
        // Item exists. This shouldn't happen with the new `sortAndRenderList`
        // But if it does (e.g., socket update), just update votes
        updateVoteCounts(fbData._id, fbData.upvoteCount || 0, null, null); // No animation for socket
        return;
    }

    item = document.createElement('div');
    item.className = `feedback-item ${fbData.isPinned ? 'pinned' : ''}`;
    item.dataset.feedbackId = fbData._id;
    item.id = `feedback-item-${fbData._id}`; 

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
    // --- NEW: GUEST EDITED TAG ---
    else if (fbData.isEdited && fbData.guestId) {
        const edited = document.createElement('span');
        edited.className = 'edited-tag';
        edited.textContent = 'Edited (Guest)';
        strongName.appendChild(edited);
    }
    // --- END NEW ---

    const starsDiv = document.createElement('div');
    starsDiv.className = 'feedback-stars';
    starsDiv.textContent = '★'.repeat(fbData.rating) + '☆'.repeat(5 - fbData.rating);
    
    const isInitiallyLiked = isFeedbackLikedByCurrentUser(fbData._id);

    const voteActionsDiv = document.createElement('div');
    voteActionsDiv.className = 'feedback-actions'; 
    voteActionsDiv.innerHTML = `
        <button class="vote-btn upvote ${isInitiallyLiked ? 'active' : ''}" data-vote="upvote" data-id="${fbData._id}" title="Like this feedback">
            <i class="fas fa-thumbs-up"></i> 
            <span id="upvote-count-${fbData._id}">${fbData.upvoteCount || 0}</span>
            <span class="vote-spinner"></span> </button>
    `;
    
    const ratingAndActions = document.createElement('div');
    ratingAndActions.className = 'rating-and-actions'; 
    ratingAndActions.appendChild(starsDiv);
    ratingAndActions.appendChild(voteActionsDiv);

    const pFb = document.createElement('p');
    pFb.textContent = fbData.feedback;
    const tsDiv = document.createElement('div');
    tsDiv.className = 'feedback-timestamp';
    try {
        tsDiv.innerHTML = `<i class="far fa-clock"></i> Posted: ${new Date(fbData.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}`;
    } catch (e) {
        tsDiv.innerHTML = `<i class="far fa-clock"></i> Posted: ${new Date(fbData.timestamp).toLocaleString('en-US')}`;
    }
    
    detailsDiv.append(strongName, ratingAndActions, pFb, tsDiv); 

    item.append(avatarImg, detailsDiv);

    // --- NEW ACTION CONTAINER ---
    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'card-actions-container';

    // 1. Add Pinned Badge (if pinned)
    if (fbData.isPinned) {
        actionsContainer.innerHTML += `
            <div class="pinned-badge">
                <span class="pin-svg">
                <svg width="15" height="15" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M14 4H16V6H14V4ZM14 2H6V4H14V2ZM12 18V10H8V18H6V8H4V6H6V4C6 2.9 6.9 2 8 2H12C13.1 2 14 2.9 14 4V6H16V8H14V18H12Z" fill="#332400"/>
                </svg>
                </span>
                Pinned
            </div>`;
    }

    // 2. Add Share Button (always)
    const shareBtn = document.createElement('button');
    shareBtn.className = 'card-action-btn share-btn'; // New class
    shareBtn.innerHTML = '<i class="fas fa-share-alt"></i>';
    shareBtn.title = 'Copy link to this feedback';
    shareBtn.onclick = (e) => handleShareClick(e, fbData._id);
    actionsContainer.appendChild(shareBtn);

    // 3. Add Edit/Delete Buttons (LOGIC UPDATED)
    const isFeedbackOwner = window.currentUser && fbData.userId && typeof fbData.userId === 'object' && fbData.userId._id === window.currentUser.userId;
    const canLoggedInUserEdit = isFeedbackOwner && (window.currentUser.loginMethod === 'google' || (window.currentUser.loginMethod === 'email' && window.currentUser.isVerified));
    
    // --- NEW GUEST LOGIC START ---
    let isGuestOwner = false;
    let canGuestEdit = false;

    if (!window.currentUser && fbData.guestId) { // Agar user logged in nahi hai, aur feedback guest ka hai
        const currentGuestId = getGuestId();
        isGuestOwner = (fbData.guestId === currentGuestId); // Check karo kya yeh *mera* guest feedback hai

        if (isGuestOwner) {
            const feedbackTime = new Date(fbData.timestamp).getTime();
            const now = new Date().getTime();
            const ageInMinutes = (now - feedbackTime) / (1000 * 60);
            
            if (ageInMinutes < 5) { // 5 Minute Window
                canGuestEdit = true;
            }
        }
    }
    // --- NEW GUEST LOGIC END ---


    // Case 1: Logged-in User is Owner
    if (fbData.userId && typeof fbData.userId === 'object') {
        const editBtn = document.createElement('button');
        editBtn.className = 'card-action-btn edit-btn';
        editBtn.innerHTML = '<i class="fas fa-pencil-alt"></i>';
        editBtn.title = 'Edit your feedback';
        editBtn.disabled = !canLoggedInUserEdit; // Logged-in user ka verification check

        if (isFeedbackOwner && !canLoggedInUserEdit) {
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
            // Populate form (Logged-in user)
            if (nameInputInFeedbackForm) { nameInputInFeedbackForm.value = fbData.userId.name || fbData.name; nameInputInFeedbackForm.disabled = true; nameInputInFeedbackForm.dispatchEvent(new Event('input')); }
            if (feedbackTextarea) { feedbackTextarea.value = fbData.feedback; feedbackTextarea.dispatchEvent(new Event('input')); }
            currentSelectedRating = fbData.rating; if (ratingInput) ratingInput.value = fbData.rating; updateStarVisuals(fbData.rating);
            if (submitButton) submitButton.innerHTML = '<i class="fas fa-paper-plane"></i> Update Feedback';
            isEditing = true; currentEditFeedbackId = fbData._id;
            if (document.getElementById('feedback-form-container')) document.getElementById('feedback-form-container').scrollIntoView({ behavior: 'smooth', block: 'start' });
            window.showStylishPopup({ iconType: 'info', title: 'Editing Feedback', message: 'The form has been pre-filled. Make changes and click "Update Feedback".', buttons: [{ text: 'Got it!', action: window.closeStylishPopup }] });
        };
        actionsContainer.appendChild(editBtn);
    }
    // Case 2: Guest is Owner (and within 5-min window)
    else if (isGuestOwner && canGuestEdit) {
        
        // Add Guest EDIT Button
        const editBtn = document.createElement('button');
        editBtn.className = 'card-action-btn edit-btn';
        editBtn.innerHTML = '<i class="fas fa-pencil-alt"></i>';
        editBtn.title = 'Edit your feedback (Time remaining)';
        
        editBtn.onclick = e => {
            e.stopPropagation();
            // Populate form (Guest)
            if (nameInputInFeedbackForm) { 
                nameInputInFeedbackForm.value = fbData.name; 
                nameInputInFeedbackForm.disabled = false; // Guest apna naam bhi edit kar sakta hai
                nameInputInFeedbackForm.dispatchEvent(new Event('input')); 
            }
            if (feedbackTextarea) { feedbackTextarea.value = fbData.feedback; feedbackTextarea.dispatchEvent(new Event('input')); }
            currentSelectedRating = fbData.rating; if (ratingInput) ratingInput.value = fbData.rating; updateStarVisuals(fbData.rating);
            if (submitButton) submitButton.innerHTML = '<i class="fas fa-paper-plane"></i> Update Feedback';
            
            isEditing = true; 
            currentEditFeedbackId = fbData._id;
            
            document.getElementById('feedback-form-container').scrollIntoView({ behavior: 'smooth', block: 'start' });
            window.showStylishPopup({ iconType: 'info', title: 'Editing Feedback', message: 'You have 5 minutes from posting to edit. Make changes and click "Update".', buttons: [{ text: 'Got it!', action: window.closeStylishPopup }] });
        };
        actionsContainer.appendChild(editBtn);

        // --- REMOVED: GUEST DELETE BUTTON ---
        // (Delete button ka code yahaan tha, ab hata diya hai)
        // --- END REMOVED ---
    }
    
    item.appendChild(actionsContainer);
    // --- END ACTION CONTAINER ---


    if (fbData.replies?.length > 0) {
        const reply = fbData.replies[fbData.replies.length - 1];
        if (reply?.text) {
            const replyDiv = document.createElement('div');
            replyDiv.className = 'admin-reply';
            const adminAva = document.createElement('img');
            adminAva.className = 'admin-reply-avatar';
            adminAva.src = 'https://i.ibb.co/FsSs4SG/creator-avatar.png'; 
            adminAva.alt = 'Admin';
            const replyContent = document.createElement('div');
            replyContent.className = 'admin-reply-content';
            let replyTs = '';
            try { replyTs = `(${new Date(reply.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short' })})`; } catch (e) { replyTs = `(${new Date(reply.timestamp).toLocaleString('en-US')})`; }
            
            let displayedAdminName = reply.adminName || 'Admin';
            if (displayedAdminName !== 'Guest' && displayedAdminName !== 'UNKNOWN_IP') {
                displayedAdminName = DESIRED_DISPLAY_NAME;
            }

            replyContent.innerHTML = `<strong>(${displayedAdminName}):</strong> ${reply.text} <span class="reply-timestamp">${replyTs}</span>`;

            replyDiv.append(adminAva, replyContent);
            detailsDiv.appendChild(replyDiv);
        }
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
        if (data.feedback.guestId) {
            localStorage.setItem('nobi_guestId', data.feedback.guestId);
        }
        if (data.feedback.name) {
            localStorage.setItem('nobi_guestName', data.feedback.name);
        }
        // --- MODIFIED (SMART SORTING) ---
        // Naye feedback ko global array me locally add karo
        window.allFeedbacks.push(data.feedback);
        // Poori list ko re-sort aur re-render karo
        // (Stats approx update kar rahe hain, real data agle fetch par ayega)
        sortAndRenderList(window.totalFeedbacksCount + 1, window.currentAverageRating);
    }
    window.showStylishPopup({ iconType: 'success', title: 'Feedback Submitted!', message: data.message || 'Thank you for your feedback!', buttons: [{text:'Great!', action: window.closeStylishPopup}] });
    resetFeedbackForm();
    
    // (Fetch call removed, local update ho gaya hai)

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

    const now = Date.now();
    if (now - lastScrollTime < DEBOUNCE_DELAY) {
        return;
    }
    lastScrollTime = now;

    // --- RECURSION FIX ---
    // Agar hum targetId dhoondh rahe hain, toh user ke scroll karne par
    // naya page load mat karo.
    if (globalTargetFeedbackId && window.isLoadingFeedbacks) {
        return;
    }
    // --- END FIX ---

    if (scrollPosition + windowHeight >= documentHeight - 500 && !window.isLoadingFeedbacks && window.hasMoreFeedbacks) {
        console.log("Fetching next page...");
        fetchFeedbacks();
    }
};

// --- NEW: SEARCH FUNCTION ---
/**
 * Handles new search input by debouncing and triggering a fresh fetch.
 */
function handleSearchInput() {
    clearTimeout(searchDebounceTimer);
    
    const searchInput = document.getElementById('feedback-search-input');
    const newSearchTerm = searchInput.value.trim();

    // 300ms delay
    searchDebounceTimer = setTimeout(async () => {
        // Only fetch if the term has actually changed
        if (newSearchTerm !== currentSearchTerm) {
            console.log(`Searching for: ${newSearchTerm}`);
            currentSearchTerm = newSearchTerm;

            // *** RESET PAGINATION ***
            window.currentPage = 1;
            window.hasMoreFeedbacks = true;
            window.allFeedbacks = []; // Clear local array
            
            // Clear existing list in DOM (except for sort/search controls)
            if(feedbackListContainer) {
                 const childrenToRemove = Array.from(feedbackListContainer.children).filter(child => 
                    child.classList.contains('feedback-item') || 
                    child.classList.contains('feedback-item-skeleton') ||
                    child.classList.contains('no-feedback-message')
                );
                childrenToRemove.forEach(child => child.remove());
            }

            // fetchFeedbacks will now show skeletons and fetch Page 1
            await fetchFeedbacks();
        }
    }, 300); // 300ms debounce time
}
// --- END NEW SEARCH FUNCTION ---


document.addEventListener('DOMContentLoaded', () => {
    // Vote event listener
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

    // --- NEW (SMART SORTING) ---
    // Sort button event listeners
    const sortNewestBtn = document.getElementById('sort-by-newest');
    const sortPopularBtn = document.getElementById('sort-by-popular');

    if (sortNewestBtn && sortPopularBtn) {
        sortNewestBtn.addEventListener('click', () => {
            if (currentSortOrder === 'newest') return; // Pehle se active hai
            currentSortOrder = 'newest';
            sortNewestBtn.classList.add('active');
            sortPopularBtn.classList.remove('active');
            // List ko re-sort aur re-render karo
            sortAndRenderList(window.totalFeedbacksCount, window.currentAverageRating);
        });

        sortPopularBtn.addEventListener('click', () => {
            if (currentSortOrder === 'popular') return; // Pehle se active hai
            currentSortOrder = 'popular';
            sortPopularBtn.classList.add('active');
            sortNewestBtn.classList.remove('active');
            // List ko re-sort aur re-render karo
            sortAndRenderList(window.totalFeedbacksCount, window.currentAverageRating);
        });
    }
    // --- END (SMART SORTING) ---

    // --- NEW SEARCH LISTENER ---
    const searchInput = document.getElementById('feedback-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', handleSearchInput);
    }
    // --- END NEW SEARCH LISTENER ---

    // Socket.IO Listener for Real-time Updates
    if (typeof io !== 'undefined') {
        const socket = io();
        socket.on('feedback-vote-update', (data) => {
            // Update local array
            const feedbackInArray = window.allFeedbacks.find(f => f._id === data.feedbackId);
            if (feedbackInArray) {
                feedbackInArray.upvoteCount = data.upvoteCount;
            }
            // Update UI (ye function check karega ki item DOM me hai ya nahi)
            // Socket update ke liye animation nahi dikhayenge (null, null)
            updateVoteCounts(data.feedbackId, data.upvoteCount, null, null); 

            // Agar popular sort active hai, toh list ko re-sort karo
            if (currentSortOrder === 'popular') {
                sortAndRenderList(window.totalFeedbacksCount, window.currentAverageRating);
            }
        });
    }
    
    // Submission logic
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

            if (!guestId) {
                guestId = generateUUID();
                localStorage.setItem('nobi_guestId', guestId);
            }
            localStorage.setItem('nobi_guestName', nameValue);

            if (nameInputInFeedbackForm.value !== nameValue) nameInputInFeedbackForm.value = nameValue;
        }

        if (!feedbackContent || ratingValue === '0') {
            return window.showStylishPopup({ iconType: 'error', title: 'Missing Information', message: 'Please provide your name (if guest), feedback, and select a rating.', buttons: [{text:'OK', action: window.closeStylishPopup}] });
        }

        let feedbackPayload = { name: nameValue, feedback: feedbackContent, rating: parseInt(ratingValue) };
        if (!window.currentUser && guestId) feedbackPayload.guestId = guestId;

        // LOGIC UPDATED: Ab 'isEditing' logged-in user aur guest dono ke liye true ho sakta hai
        const isSubmissionByLoggedInUser = !!window.currentUser;
        
        // --- FIX: Use global window.API_... constants ---
        // --- START FIX ---
        const url = isEditing ? `${window.API_FEEDBACK_URL}/${currentEditFeedbackId}` : window.API_FEEDBACK_URL;
        // --- END FIX ---
        const method = isEditing ? 'PUT' : 'POST';

        if (isEditing && isSubmissionByLoggedInUser && window.currentUser.loginMethod === 'email' && !window.currentUser.isVerified) {
            return window.showStylishPopup({ iconType: 'warning', title: 'Email Verification Required', message: 'Please verify your email to *edit* your feedback.', buttons: [{text:'OK', action: window.closeStylishPopup}] });
        }
        
        // **IMPORTANT:** Backend `PUT /api/feedback/:id` route ko update karna zaroori hai
        // taaki woh `feedbackPayload.guestId` ko check kare agar `req.user` nahi hai.
        
        // --- NEW: Guest Edit ke liye bhi guestId bhejo ---
        if (isEditing && !isSubmissionByLoggedInUser && guestId) {
            feedbackPayload.guestId = guestId;
        }
        // --- END NEW ---

        const spinnerText = isEditing ? "Updating Feedback..." : "Submitting Feedback...";
        try {
            // Note: Ab hum `apiRequest` ka istemaal kar rahe hain submit ke liye (kyunki iska spinner bada hai, jo theek hai)
            // Sirf LIKE button ka spinner custom hai.
            const data = await window.apiRequest(url, method, feedbackPayload, false, submitButton, spinnerText);

            if (isEditing) {
                // --- MODIFIED (SMART SORTING) ---
                // Editing ke baad, local array update karo
                const index = window.allFeedbacks.findIndex(f => f._id === currentEditFeedbackId);
                if (index > -1) {
                    // Update karte waqt, purana `isPinned` status barkaraar rakhein
                    data.feedback.isPinned = window.allFeedbacks[index].isPinned;
                    window.allFeedbacks[index] = data.feedback;
                }
                resetFeedbackForm();
                // List ko re-sort aur re-render karo
                sortAndRenderList(window.totalFeedbacksCount, window.currentAverageRating);
                window.showStylishPopup({ iconType: 'success', title: 'Feedback Updated!', message: data.message, buttons: [{text:'Great!', action: window.closeStylishPopup}] });

            } else {
                // Naya feedback submit hua hai
                await handleFeedbackSubmitSuccess(data);
            }

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
    getTargetIdFromURL(); // This sets globalTargetFeedbackId

    window.currentPage = 1;
    window.hasMoreFeedbacks = true;
    window.allFeedbacks = []; 

    // === RECURSION FIX ===
    if (globalTargetFeedbackId) {
        // Agar URL me ID hai, toh sequential loader chalao
        loadPagesUntilFeedbackFound(globalTargetFeedbackId);
    } else {
        // Normal page load, sirf page 1 fetch karo
        fetchFeedbacks();
    }
    // === END FIX ===

    // Add scroll event listener for lazy loading
    window.addEventListener('scroll', handleScroll);
});