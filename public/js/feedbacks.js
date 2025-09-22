// This file contains all the JavaScript logic specific to the feedback section.
// It is designed to be loaded alongside main.js and other core scripts.

// Global state variables for the feedback form and data
const FEEDBACKS_CACHE_KEY = 'nobi_feedbacks';
let currentSelectedRating = 0;
let isEditing = false;
let currentEditFeedbackId = null;

// The main `currentUser` object will be available globally from `main.js`.
// The API constants (like API_FEEDBACK_URL, API_FETCH_FEEDBACKS_URL) are also available.
// The utility functions (`apiRequest`, `showStylishPopup`, `closeStylishPopup`, `updateUIAfterLogin`, etc.)
// are also globally available via the `window` object in `main.js`.

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
}
window.renderFeedbackData = renderFeedbackData;

async function fetchFeedbacks() {
    if (window.isLoadingFeedbacks || !window.hasMoreFeedbacks) return;

    window.isLoadingFeedbacks = true;
    if (lazyLoadSpinner) lazyLoadSpinner.style.display = 'block';

    try {
        const url = `${window.API_FETCH_FEEDBACKS_URL}?page=${window.currentPage}&limit=${PAGE_LIMIT}`;
        const responseData = await window.apiRequest(url, 'GET');

        const feedbacksArray = responseData.feedbacks;

        // Render new feedbacks (append=true)
        // Note: The first render will still be done in this function.
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

function updateAverageRating(avg, count) {
    if(!averageRatingDisplayEl) return;

    const avgNum = parseFloat(avg);
    let starsHtml = '☆☆☆☆☆';

    if (!isNaN(avgNum) && avgNum > 0) {
        const full = Math.floor(avgNum);
        const halfVal = avgNum % 1;
        let halfChar = '';
        if (halfVal >= 0.25 && halfVal < 0.75) halfChar = '◐';
        else if (halfVal >= 0.75) halfChar = '★';
        starsHtml = '★'.repeat(full) + halfChar + '☆'.repeat(Math.max(0, 5 - full - (halfChar ? 1 : 0)));
    }

    averageRatingDisplayEl.innerHTML = `
        <div class="average-rating-container animate-in">
            <h3>Overall Average Rating</h3>
            <div class="average-number">${isNaN(avgNum) ? '0.0' : avgNum.toFixed(1)}</div>
            <div class="average-stars">${starsHtml}</div>
            <div class="total-feedbacks-count">Based on ${count} Feedback${count === 1 ? '' : 's'} <span class="badge-total">+${count}</span></div>
        </div>
    `;
}
window.updateAverageRating = updateAverageRating;

function addFeedbackToDOM(fbData) {
    if (!feedbackListContainer) return;

    const item = document.createElement('div');
    item.className = `feedback-item ${fbData.isPinned ? 'pinned' : ''}`;
    item.dataset.feedbackId = fbData._id;

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
    const pFb = document.createElement('p');
    pFb.textContent = fbData.feedback;
    const tsDiv = document.createElement('div');
    tsDiv.className = 'feedback-timestamp';
    try {
        tsDiv.innerHTML = `<i class="far fa-clock"></i> Posted: ${new Date(fbData.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}`;
    } catch (e) {
        tsDiv.innerHTML = `<i class="far fa-clock"></i> Posted: ${new Date(fbData.timestamp).toLocaleString('en-US')}`;
    }
    detailsDiv.append(strongName, starsDiv, pFb, tsDiv);

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
            replyContent.innerHTML = `<strong>(${(reply.adminName || 'Admin')}):</strong> ${reply.text} <span class="reply-timestamp">${replyTs}</span>`;
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
    // const enhanceFeedbackBtn = document.getElementById('enhance-feedback-btn');
    // if (enhanceFeedbackBtn) {
    //    enhanceFeedbackBtn.addEventListener('click', async () => {
    //        const originalFeedback = feedbackTextarea.value.trim();
    //        if (!originalFeedback) {
    //            return window.showStylishPopup({iconType: 'warning', title: 'Empty Feedback', message: 'Write some feedback first, then enhance it!', buttons: [{text:'OK', action: window.closeStylishPopup}]});
    //        }
    //        const originalBtnText = enhanceFeedbackBtn.innerHTML;
    //        enhanceFeedbackBtn.disabled = true;
    //        enhanceFeedbackBtn.innerHTML = `<span class="nobi-spinner"></span> Enhancing...`;
    //        try {
    //            const prompt = `Refine and enhance the following user feedback. Make it more constructive, clear, and polite, while maintaining the original sentiment. Keep it concise. Original Feedback: "${originalFeedback}"`;
    //            const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }] };
    //            const apiKey = "";
    //            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    //            const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    //            if (!response.ok) {
    //                const errorData = await response.json();
    //                console.error("Gemini API error:", errorData);
    //                throw new Error(errorData.error?.message || "Failed to enhance feedback due to API error.");
    //            }
    //            const result = await response.json();
    //            let enhancedText = originalFeedback;
    //            if (result.candidates && result.candidates[0]?.content?.parts?.[0]?.text) {
    //                enhancedText = result.candidates[0].content.parts[0].text;
    //                window.showStylishPopup({iconType: 'success', title: 'Feedback Enhanced!', message: 'AI has helped refine your feedback.', buttons: [{text:'OK', action: window.closeStylishPopup}]});
    //            } else {
    //                console.warn("Gemini API response issue or no text found:", result);
    //                window.showStylishPopup({iconType: 'warning', title: 'Enhancement Issue', message: 'Could not get a refined version from AI. Using original feedback.', buttons: [{text:'OK', action: window.closeStylishPopup}]});
    //            }
    //            feedbackTextarea.value = enhancedText;
    //            feedbackTextarea.dispatchEvent(new Event('input'));
    //        } catch (error) {
    //            console.error("Error enhancing feedback:", error);
    //            window.showStylishPopup({iconType: 'error', title: 'Enhancement Failed', message: `An error occurred: ${error.message}. Please try again later.`, buttons: [{text:'OK', action: window.closeStylishPopup}]});
    //        } finally {
    //            enhanceFeedbackBtn.disabled = false;
    //            enhanceFeedbackBtn.innerHTML = originalBtnText;
    //        }
    //    });
    // } else {
    //    console.error("Enhance feedback button not found!");
    // }


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
        const url = (isEditing && isSubmissionByLoggedInUser) ? `${API_FEEDBACK_URL}/${currentEditFeedbackId}` : API_FEEDBACK_URL;
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

    // Initial fetch of the first page
    window.currentPage = 1;
    window.hasMoreFeedbacks = true;
    fetchFeedbacks();

    // Add scroll event listener for lazy loading
    window.addEventListener('scroll', handleScroll);
});
