document.addEventListener('DOMContentLoaded', () => {
    // --- Global Variables & State ---
    let currentUser = null; // Will hold user data after login
    // Example: currentUser = { uid: '123', displayName: 'Nobita', email: 'nobita@example.com', avatarUrl: 'images/default-avatar.png', type: 'email' };

    let feedbacks = []; // To store feedback items locally

    // --- DOM Elements ---
    const loginIconTrigger = document.getElementById('login-icon-trigger');
    const userAvatarTrigger = document.getElementById('user-avatar-trigger');
    const userAvatarTriggerImg = document.getElementById('user-avatar-trigger-img');

    const loginModalOverlay = document.getElementById('login-modal-overlay');
    const signupModalOverlay = document.getElementById('signup-modal-overlay');
    const profileModalOverlay = document.getElementById('profile-modal-overlay');

    const closeLoginModalBtn = loginModalOverlay?.querySelector('.close-modal-btn');
    const closeSignupModalBtn = signupModalOverlay?.querySelector('.close-modal-btn');
    const closeProfileModalBtn = profileModalOverlay?.querySelector('.close-modal-btn[data-target-modal="profile-modal-overlay"]');


    const showSignupLink = document.getElementById('show-signup-link');
    const showLoginLink = document.getElementById('show-login-link');

    const userProfileMenu = document.getElementById('user-profile-menu');
    const menuAvatarImg = document.getElementById('menu-avatar-img');
    const menuUsername = document.getElementById('menu-username');
    const viewProfileLink = document.getElementById('view-profile-link');
    const logoutLink = document.getElementById('logout-link');

    // Profile Modal Elements
    const profileModalTitle = document.getElementById('profile-modal-title');
    const profileDisplayView = document.getElementById('profile-display-view');
    const displayProfileAvatar = document.getElementById('display-profile-avatar');
    const displayProfileName = document.getElementById('display-profile-name');
    const displayProfileEmail = document.getElementById('display-profile-email');
    const editProfileButton = document.getElementById('edit-profile-button');

    const profileEditView = document.getElementById('profile-edit-view');
    const modalProfileAvatarImg = document.getElementById('modal-profile-avatar-img');
    const avatarUploadInput = document.getElementById('avatar-upload-input');
    const profileNameInput = document.getElementById('profile-name-input');
    const profileEmailDisplayEdit = document.getElementById('profile-email-display-edit');
    const saveProfileButton = document.getElementById('save-profile-button');
    const cancelEditProfileButton = document.getElementById('cancel-edit-profile-button');
    const loadingSpinnerModal = profileEditView?.querySelector('.loading-spinner'); // Spinner inside profile edit view

    // Feedback Form Elements
    const feedbackForm = document.getElementById('feedback-form');
    const nameInput = document.getElementById('name');
    const ratingStarsContainer = document.getElementById('rating-stars');
    const hiddenRatingInput = document.getElementById('rating');
    const messageInput = document.getElementById('message');
    const submitFeedbackBtn = document.getElementById('submit-feedback');

    // Feedback List Elements
    const feedbackItemsList = document.getElementById('feedback-items-list');
    const avgRatingNum = document.getElementById('avg-rating-num');
    const avgRatingStars = document.getElementById('avg-rating-stars');
    const totalFeedbackCount = document.getElementById('total-feedback-count');

    // Stylish Popup Elements
    const stylishPopupOverlay = document.getElementById('stylish-popup-overlay');
    const stylishPopupCard = document.getElementById('stylish-popup-card');
    const closeStylishPopupBtn = document.getElementById('close-stylish-popup-btn');
    const popupIconArea = document.getElementById('popup-icon-area');
    const popupTitle = document.getElementById('popup-title');
    const popupMessage = document.getElementById('popup-message');
    const popupInputGroup1 = document.getElementById('popup-input-group-1');
    const popupInputLabel1 = document.getElementById('popup-input-label-1');
    const popupInputField1 = document.getElementById('popup-input-field-1');
    const popupInputGroup2 = document.getElementById('popup-input-group-2'); // For textarea
    const popupInputLabel2 = document.getElementById('popup-input-label-2');
    const popupInputField2 = document.getElementById('popup-input-field-2');
    constPopupButtonContainer = document.getElementById('popup-button-container');

    let newAvatarFile = null;
    let newAvatarPreviewUrl = null; // Stores Data URL for immediate preview

    // --- Initial Animations & Setup ---
    const ownerInfo = document.querySelector('.owner-info');
    if (ownerInfo) setTimeout(() => ownerInfo.classList.add('animate-in'), 300);
    const formContainer = document.getElementById('feedback-form-container');
    const listContainer = document.getElementById('feedback-list-container');
    if (formContainer) setTimeout(() => formContainer.classList.add('animate-in'), 500);
    if (listContainer) setTimeout(() => listContainer.classList.add('animate-in'), 700);
    // Average rating container animation
    const avgRatingContainer = document.querySelector('.average-rating-container');
    if(avgRatingContainer) setTimeout(() => avgRatingContainer.classList.add('animate-in'), 900);


    // --- STYLISH POPUP FUNCTIONALITY ---
    function showStylishPopup(type, title, message, buttons = [], inputs = []) {
        if (!stylishPopupOverlay || !stylishPopupCard) return;

        // Icon mapping
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-times-circle',
            info: 'fas fa-info-circle',
            warning: 'fas fa-exclamation-triangle',
            confirm: 'fas fa-question-circle',
            forgot_password: 'fas fa-key' // Example custom type
        };

        popupIconArea.className = `popup-icon-area ${type}`; // For color
        popupIconArea.innerHTML = `<i class="${icons[type] || icons.info}"></i>`;
        popupTitle.textContent = title;
        popupMessage.innerHTML = message; // Use innerHTML to allow basic formatting like <br>

        // Handle Inputs
        [popupInputGroup1, popupInputGroup2].forEach(group => group.style.display = 'none');
        inputs.forEach((inputSetup, index) => {
            const group = index === 0 ? popupInputGroup1 : popupInputGroup2;
            const label = index === 0 ? popupInputLabel1 : popupInputLabel2;
            const field = index === 0 ? popupInputField1 : popupInputField2;
            if (group && label && field) {
                label.textContent = inputSetup.label;
                field.type = inputSetup.type || 'text';
                field.placeholder = inputSetup.placeholder || '';
                field.value = inputSetup.value || '';
                if (inputSetup.type === 'textarea') {
                    field.rows = inputSetup.rows || 3;
                }
                group.style.display = 'block';
            }
        });


        popupButtonContainer.innerHTML = ''; // Clear old buttons
        if (buttons.length === 0 && (type === 'success' || type === 'error' || type === 'info')) {
            buttons.push({ text: 'OK', class: 'primary', action: hideStylishPopup });
        }

        buttons.forEach(btn => {
            const buttonEl = document.createElement('button');
            buttonEl.className = `popup-button ${btn.class || 'secondary'}`;
            buttonEl.textContent = btn.text;
            buttonEl.addEventListener('click', () => {
                if (btn.action) btn.action();
                // Do not automatically hide for confirm unless action says so
                if (type !== 'confirm' || btn.text.toLowerCase() === 'cancel' || btn.text.toLowerCase() === 'no') {
                   // hideStylishPopup(); // Action should handle hide for confirm
                }
            });
            popupButtonContainer.appendChild(buttonEl);
        });

        stylishPopupOverlay.classList.add('active');
    }

    function hideStylishPopup() {
        if (stylishPopupOverlay) stylishPopupOverlay.classList.remove('active');
    }

    if (closeStylishPopupBtn) closeStylishPopupBtn.addEventListener('click', hideStylishPopup);
    // Close popup if overlay is clicked (optional)
    // if (stylishPopupOverlay) {
    //     stylishPopupOverlay.addEventListener('click', (event) => {
    //         if (event.target === stylishPopupOverlay) {
    //             hideStylishPopup();
    //         }
    //     });
    // }

    // --- Authentication Mock/UI Logic ---
    function updateLoginStateUI() {
        if (currentUser) {
            if (loginIconTrigger) loginIconTrigger.style.display = 'none';
            if (userAvatarTrigger) userAvatarTrigger.style.display = 'flex';
            if (userAvatarTriggerImg) userAvatarTriggerImg.src = currentUser.avatarUrl || 'images/default-avatar.png';
            if (nameInput) { // Autofill name in feedback form
                nameInput.value = currentUser.displayName;
                nameInput.disabled = true; // Optional: disable if logged in
            }
            if (menuAvatarImg) menuAvatarImg.src = currentUser.avatarUrl || 'images/default-avatar.png';
            if (menuUsername) menuUsername.textContent = currentUser.displayName;
        } else {
            if (loginIconTrigger) loginIconTrigger.style.display = 'flex';
            if (userAvatarTrigger) userAvatarTrigger.style.display = 'none';
            if (userProfileMenu) userProfileMenu.classList.remove('active');
            if (nameInput) {
                nameInput.value = '';
                nameInput.disabled = false;
            }
        }
    }
    // Example login function (replace with actual auth)
    function mockLogin(name, avatar) {
        currentUser = {
            uid: 'mock-' + Date.now(),
            displayName: name || 'Mock User',
            email: `${(name || 'user').toLowerCase().replace(' ','')}@example.com`,
            avatarUrl: avatar || 'images/default-avatar.png',
            type: 'email' // or 'google'
        };
        updateLoginStateUI();
        if (loginModalOverlay) loginModalOverlay.classList.remove('active');
        if (signupModalOverlay) signupModalOverlay.classList.remove('active');
        showStylishPopup('success', 'Logged In!', `Welcome back, ${currentUser.displayName}!`);
    }
    // Example Logout
    if (logoutLink) {
        logoutLink.addEventListener('click', (e) => {
            e.preventDefault();
            currentUser = null;
            updateLoginStateUI();
            if (userProfileMenu) userProfileMenu.classList.remove('active');
            showStylishPopup('info', 'Logged Out', 'You have been successfully logged out.');
        });
    }

    // Modal Toggle Logic
    if (loginIconTrigger) {
        loginIconTrigger.addEventListener('click', () => loginModalOverlay?.classList.add('active'));
    }
    if (userAvatarTrigger) {
        userAvatarTrigger.addEventListener('click', () => userProfileMenu?.classList.toggle('active'));
    }
    // Close modals
    [closeLoginModalBtn, closeSignupModalBtn, closeProfileModalBtn].forEach(btn => {
        btn?.addEventListener('click', () => {
            const modalId = btn.getAttribute('data-target-modal');
            document.getElementById(modalId)?.classList.remove('active');
        });
    });
     // Close menu if clicked outside
    document.addEventListener('click', function(event) {
        if (userProfileMenu && userAvatarTrigger) {
            const isClickInsideMenu = userProfileMenu.contains(event.target);
            const isClickOnAvatar = userAvatarTrigger.contains(event.target);
            if (!isClickInsideMenu && !isClickOnAvatar && userProfileMenu.classList.contains('active')) {
                userProfileMenu.classList.remove('active');
            }
        }
    });


    // Switch between login and signup modals
    if (showSignupLink) {
        showSignupLink.addEventListener('click', (e) => {
            e.preventDefault();
            loginModalOverlay?.classList.remove('active');
            signupModalOverlay?.classList.add('active');
        });
    }
    if (showLoginLink) {
        showLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            signupModalOverlay?.classList.remove('active');
            loginModalOverlay?.classList.add('active');
        });
    }
    // Mock form submissions (replace with actual API calls)
    document.getElementById('login-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        mockLogin(document.getElementById('login-email').value.split('@')[0], 'images/default-avatar.png'); // Simulate with email prefix as name
    });
    document.getElementById('signup-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        mockLogin(document.getElementById('signup-name').value, 'images/default-avatar.png');
    });


    // --- PROFILE MODAL LOGIC ---
    if (viewProfileLink) {
        viewProfileLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (!currentUser) {
                showStylishPopup('error', 'Not Logged In', 'Please log in to view your profile.');
                return;
            }
            populateProfileModal();
            profileDisplayView.style.display = 'block';
            profileEditView.style.display = 'none';
            profileModalTitle.textContent = "Your Profile";
            profileModalOverlay?.classList.add('active');
            userProfileMenu?.classList.remove('active');
        });
    }

    function populateProfileModal() {
        if (!currentUser) return;
        // Display View
        displayProfileAvatar.src = currentUser.avatarUrl || 'images/default-avatar.png';
        displayProfileName.textContent = currentUser.displayName;
        displayProfileEmail.textContent = currentUser.email;
        // Edit View (prefill for editing)
        modalProfileAvatarImg.src = currentUser.avatarUrl || 'images/default-avatar.png';
        profileNameInput.value = currentUser.displayName;
        profileEmailDisplayEdit.value = currentUser.email; // Assuming email is not editable in this form

        newAvatarFile = null; // Reset file selection
        newAvatarPreviewUrl = null;
        if (avatarUploadInput) avatarUploadInput.value = null; // Clear file input
    }

    if (editProfileButton) {
        editProfileButton.addEventListener('click', () => {
            profileDisplayView.style.display = 'none';
            profileEditView.style.display = 'block';
            profileModalTitle.textContent = "Edit Your Profile";
            populateProfileModal(); // Repopulate edit fields to ensure they are current
        });
    }

    if (cancelEditProfileButton) {
        cancelEditProfileButton.addEventListener('click', () => {
            profileDisplayView.style.display = 'block';
            profileEditView.style.display = 'none';
            profileModalTitle.textContent = "Your Profile";
            // No need to save, just revert to display
        });
    }

    // Avatar Preview on File Selection
    if (avatarUploadInput && modalProfileAvatarImg) {
        avatarUploadInput.addEventListener('change', function(event) {
            const file = event.target.files[0];
            if (file) {
                if (file.size > 5 * 1024 * 1024) { // 5MB limit, same as server
                    showStylishPopup('error', 'File Too Large', 'Please select an image smaller than 5MB.');
                    avatarUploadInput.value = ""; // Clear the invalid file
                    return;
                }
                if (!file.type.startsWith('image/')) {
                    showStylishPopup('error', 'Invalid File Type', 'Please select an image file (e.g., JPG, PNG).');
                    avatarUploadInput.value = ""; // Clear the invalid file
                    return;
                }
                newAvatarFile = file;
                const reader = new FileReader();
                reader.onload = function(e) {
                    newAvatarPreviewUrl = e.target.result;
                    modalProfileAvatarImg.src = newAvatarPreviewUrl;
                }
                reader.readAsDataURL(file);
            }
        });
    }

    // Save Profile Changes (Name and Avatar)
    if (saveProfileButton) {
        saveProfileButton.addEventListener('click', async function() {
            if (!currentUser) return;
            const newName = profileNameInput.value.trim();
            let nameChanged = false;
            let avatarChanged = false;

            if (loadingSpinnerModal) loadingSpinnerModal.style.display = 'block';
            saveProfileButton.disabled = true;

            // 1. Update Name (Locally first, then would be part of same API call or separate)
            if (newName && newName !== currentUser.displayName) {
                // In a real app, this would be sent to server. For now, update local `currentUser`.
                currentUser.displayName = newName;
                nameChanged = true;
            }

            // 2. Upload Avatar if a new one is selected
            if (newAvatarFile) {
                const formData = new FormData();
                formData.append('avatar', newAvatarFile);
                // You might want to send userId or other identifiers if your backend needs them
                // formData.append('userId', currentUser.uid);

                try {
                    const response = await fetch('/api/upload-avatar', {
                        method: 'POST',
                        body: formData
                        // 'Content-Type': 'multipart/form-data' is set by browser automatically for FormData
                    });
                    const result = await response.json();

                    if (response.ok && result.success && result.avatarUrl) {
                        currentUser.avatarUrl = result.avatarUrl; // Update with URL from server
                        avatarChanged = true;
                    } else {
                        throw new Error(result.message || 'Avatar upload failed on server.');
                    }
                } catch (error) {
                    console.error("Avatar upload error:", error);
                    if (loadingSpinnerModal) loadingSpinnerModal.style.display = 'none';
                    saveProfileButton.disabled = false;
                    showStylishPopup('error', 'Upload Failed', `Could not upload avatar: ${error.message}`);
                    return; // Stop further processing
                }
            }

            // If anything changed, update UI and show success
            if (nameChanged || avatarChanged) {
                updateLoginStateUI(); // Updates corner avatar and menu avatar/name
                populateProfileModal(); // Refreshes modal content (especially if staying on edit view, or for next open)

                let successMessage = "";
                if (nameChanged && avatarChanged) successMessage = "Name and avatar updated successfully!";
                else if (nameChanged) successMessage = "Name updated successfully!";
                else if (avatarChanged) successMessage = "Avatar updated successfully!";

                showStylishPopup('success', 'Profile Updated', successMessage);
            } else {
                showStylishPopup('info', 'No Changes', 'No changes were made to your profile.');
            }

            if (loadingSpinnerModal) loadingSpinnerModal.style.display = 'none';
            saveProfileButton.disabled = false;
            newAvatarFile = null; // Reset after processing
            newAvatarPreviewUrl = null;
            if(avatarUploadInput) avatarUploadInput.value = null; // Clear file input

            // Switch back to display view after saving
            profileDisplayView.style.display = 'block';
            profileEditView.style.display = 'none';
            profileModalTitle.textContent = "Your Profile";
        });
    }


    // --- Feedback Form Logic ---
    let selectedRating = 0;
    if (ratingStarsContainer) {
        const stars = ratingStarsContainer.querySelectorAll('.star');
        stars.forEach(star => {
            star.addEventListener('mouseover', () => highlightStars(star.dataset.value, stars));
            star.addEventListener('mouseleave', () => highlightStars(selectedRating, stars)); // Revert to selected
            star.addEventListener('click', () => {
                selectedRating = star.dataset.value;
                hiddenRatingInput.value = selectedRating;
                highlightStars(selectedRating, stars, true); // Mark as selected
            });
        });
    }

    function highlightStars(rating, starElements, isSelected = false) {
        starElements.forEach(s => {
            s.classList.remove('highlighted', 'selected');
            if (s.dataset.value <= rating) {
                s.classList.add('highlighted');
                if (isSelected && s.dataset.value <= selectedRating) {
                    s.classList.add('selected');
                }
            }
        });
    }

    if (feedbackForm) {
        feedbackForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const name = nameInput.value.trim();
            const rating = hiddenRatingInput.value;
            const message = messageInput.value.trim();

            if (!rating || rating === "0") {
                showStylishPopup('error', 'Missing Rating', 'Please select a star rating.');
                return;
            }
            // More validation can be added here

            submitFeedbackBtn.disabled = true;
            submitFeedbackBtn.innerHTML = 'Submitting... <i class="fas fa-spinner fa-spin"></i>';

            // --- SIMULATE API CALL FOR FEEDBACK SUBMISSION ---
            // In a real app, you'd send this data to your server:
            // const response = await fetch('/api/feedback', {
            //     method: 'POST',
            //     headers: { 'Content-Type': 'application/json' },
            //     body: JSON.stringify({ name, rating: parseInt(rating), message, userId: currentUser ? currentUser.uid : null })
            // });
            // const result = await response.json();
            // if (response.ok && result.success) { ... } else { ... }
            await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate delay
            const newFeedback = {
                id: 'fb-' + Date.now(),
                name: name,
                avatar: currentUser ? currentUser.avatarUrl : 'images/default-avatar.png', // Use logged-in user's avatar
                rating: parseInt(rating),
                message: message,
                timestamp: new Date().toISOString(),
                userType: currentUser ? currentUser.type : 'guest', // 'guest', 'email', 'google'
                edited: false
            };
            feedbacks.unshift(newFeedback); // Add to the beginning of the array
            renderFeedbacks();
            showStylishPopup('success', 'Feedback Submitted!', 'Thanks for your valuable feedback. It has been recorded.');
            feedbackForm.reset();
            selectedRating = 0; // Reset rating selection
            highlightStars(0, ratingStarsContainer.querySelectorAll('.star'));
            if (currentUser) { // Re-fill name if user is logged in
                nameInput.value = currentUser.displayName;
            }
            // --- END SIMULATION ---

            submitFeedbackBtn.disabled = false;
            submitFeedbackBtn.innerHTML = 'Submit Feedback <i class="fas fa-paper-plane"></i>';
        });
    }


    // --- Feedback List Rendering ---
    function renderFeedbacks() {
        if (!feedbackItemsList) return;
        feedbackItemsList.innerHTML = ''; // Clear existing items

        if (feedbacks.length === 0) {
            feedbackItemsList.innerHTML = '<p style="text-align:center; opacity:0.7;">No feedback yet. Be the first to share your thoughts!</p>';
        } else {
            feedbacks.forEach(item => {
                const feedbackEl = createFeedbackItemElement(item);
                feedbackItemsList.appendChild(feedbackEl);
            });
        }
        updateAverageRating();
    }

    function createFeedbackItemElement(item) {
        const div = document.createElement('div');
        div.className = 'feedback-item';
        div.dataset.id = item.id;

        const avatarSrc = item.avatar || 'images/default-avatar.png';
        const userTypeClass = item.userType === 'google' ? 'google-user-indicator' : (item.userType === 'email' ? 'email-user-indicator' : '');
        const userTypeLabel = item.userType === 'google' ? 'Google' : (item.userType === 'email' ? 'Email' : '');

        div.innerHTML = `
            <img src="${avatarSrc}" alt="${item.name}" class="avatar-img">
            <div class="feedback-details">
                <strong>${escapeHTML(item.name)}
                    ${userTypeClass ? `<span class="user-type-indicator ${userTypeClass}">${userTypeLabel}</span>` : ''}
                    ${item.edited ? '<span class="edited-tag">Edited</span>' : ''}
                </strong>
                <div class="feedback-stars">${'★'.repeat(item.rating)}${'☆'.repeat(5 - item.rating)}</div>
                <p>${escapeHTML(item.message).replace(/\n/g, '<br>')}</p> <div class="feedback-timestamp">${formatTimestamp(item.timestamp)}</div>
                ${currentUser && currentUser.uid === item.userId ? `<button class="edit-feedback-btn" data-id="${item.id}"><i class="fas fa-edit"></i></button>` : ''}
                </div>
        `;
        // Add event listener for edit button if it exists
        const editBtn = div.querySelector('.edit-feedback-btn');
        if(editBtn) {
            editBtn.addEventListener('click', ()_ => handleEditFeedback(item.id));
        }
        return div;
    }
    function handleEditFeedback(feedbackId) {
        const feedbackToEdit = feedbacks.find(fb => fb.id === feedbackId);
        if (!feedbackToEdit) return;

        showStylishPopup(
            'info', // Or a custom type if you have styles for it
            'Edit Your Feedback',
            `You are editing your feedback. Original message:`,
            [
                { text: 'Save Changes', class: 'primary', action: () => {
                    const newMessageHandler = document.getElementById('popup-input-field-2');
                    const newMessage = newMessageHandler.value.trim();
                    const newRatingHandler = document.getElementById('popup-input-field-1'); // Assuming rating is editable
                    const newRating = parseInt(newRatingHandler.value);


                    if(newMessage !== feedbackToEdit.message || newRating !== feedbackToEdit.rating ) {
                        // Actual update logic (API call then update local array)
                        feedbackToEdit.message = newMessage;
                        feedbackToEdit.rating = newRating;
                        feedbackToEdit.edited = true;
                        feedbackToEdit.timestamp = new Date().toISOString(); // Update timestamp on edit
                        renderFeedbacks();
                        showStylishPopup('success', 'Feedback Updated', 'Your feedback has been updated.');
                    } else {
                         showStylishPopup('info', 'No Changes', 'No changes were made to your feedback.');
                    }
                    hideStylishPopup(); // Hide edit popup
                }},
                { text: 'Cancel', class: 'secondary', action: hideStylishPopup }
            ],
            [ // Inputs for the popup
                {label: 'New Rating (1-5):', type: 'number', value: feedbackToEdit.rating, placeholder: 'Enter rating 1-5'},
                {label: 'New Message:', type: 'textarea', value: feedbackToEdit.message, placeholder: 'Enter your new message', rows: 4}
            ]
        );
    }


    function updateAverageRating() {
        if (feedbacks.length === 0) {
            if(avgRatingNum) avgRatingNum.textContent = '0.0';
            if(avgRatingStars) avgRatingStars.innerHTML = '☆☆☆☆☆'; // Empty stars
            if(totalFeedbackCount) totalFeedbackCount.textContent = '0';
            return;
        }
        const totalRating = feedbacks.reduce((sum, item) => sum + item.rating, 0);
        const average = (totalRating / feedbacks.length).toFixed(1);

        if(avgRatingNum) avgRatingNum.textContent = average;
        if(avgRatingStars) {
            const fullStars = Math.floor(parseFloat(average));
            const halfStar = (parseFloat(average) - fullStars) >= 0.5 ? 1 : 0;
            const emptyStars = 5 - fullStars - halfStar;
            avgRatingStars.innerHTML = '★'.repeat(fullStars) + (halfStar ? '✬' : '') + '☆'.repeat(emptyStars); // Using ✬ for half star approx.
        }
        if(totalFeedbackCount) totalFeedbackCount.textContent = feedbacks.length.toString();
    }

    function escapeHTML(str) {
        if (typeof str !== 'string') return str; // Or handle appropriately
        return str.replace(/[&<>"']/g, function (match) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[match];
        });
    }

    function formatTimestamp(isoString) {
        const date = new Date(isoString);
        // Simple relative time or formatted date
        const now = new Date();
        const diffSeconds = Math.round((now - date) / 1000);

        if (diffSeconds < 60) return `${diffSeconds} seconds ago`;
        const diffMinutes = Math.round(diffSeconds / 60);
        if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
        const diffHours = Math.round(diffMinutes / 60);
        if (diffHours < 24) return `${diffHours} hours ago`;
        // For older dates, show formatted date
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    // --- Load Initial Data (Mock) ---
    function loadInitialData() {
        // This would be an API call in a real app
        feedbacks = [
            // { id: 'fb1', name: 'Suneo Honekawa', avatar: 'images/suneo.png', rating: 5, message: 'This platform is fantastic! So stylish.', timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), userType: 'google', edited: false },
            // { id: 'fb2', name: 'Takeshi Goda (Gian)', avatar: 'images/gian.png', rating: 4, message: 'Good, but my singing is better!', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), userType: 'email', edited: true },
            // { id: 'fb3', name: 'Shizuka Minamoto', avatar: 'images/shizuka.png', rating: 5, message: 'Very helpful and easy to use. I love the colors!', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), userType: 'guest', edited: false }
        ]; // Start with empty or predefined mock data
        renderFeedbacks();
        updateLoginStateUI(); // Initialize UI based on whether a user is "logged in"
    }

    loadInitialData(); // Load data when DOM is ready

}); // End of DOMContentLoaded
