document.addEventListener('DOMContentLoaded', function() {
    // --- Utility Functions ---
    function showStylishPopup(iconClass, title, message, buttons, formFields) {
        const popupOverlay = document.getElementById('stylishPopupOverlay');
        const popupCard = document.getElementById('stylishPopupCard');
        const popupIcon = document.getElementById('stylishPopupIcon');
        const popupTitle = document.getElementById('stylishPopupTitle');
        const popupMessage = document.getElementById('stylishPopupMessage');
        const popupButtonContainer = document.getElementById('stylishPopupButtonContainer');
        const popupFormArea = document.getElementById('stylishPopupFormArea');

        if (!popupOverlay || !popupCard || !popupIcon || !popupTitle || !popupMessage || !popupButtonContainer || !popupFormArea) {
            console.error('One or more popup elements not found.');
            return;
        }

        // Set content and classes
        popupIcon.className = 'popup-icon-area ' + iconClass;
        popupTitle.textContent = title;
        popupMessage.innerHTML = message; // Use innerHTML to allow for links

        // Clear existing buttons and form
        popupButtonContainer.innerHTML = '';
        popupFormArea.innerHTML = '';
        popupFormArea.style.display = 'none'; // Hide form area by default

        // Add buttons
        if (buttons && buttons.length > 0) {
            buttons.forEach(button => {
                const btnElement = document.createElement('button');
                btnElement.textContent = button.text;
                btnElement.className = 'popup-button ' + button.class;
                btnElement.addEventListener('click', button.onClick);
                popupButtonContainer.appendChild(btnElement);
            });
        }

        // Add form fields
        if (formFields && formFields.length > 0) {
            popupFormArea.style.display = 'block'; // Show form area
            formFields.forEach(field => {
                const inputGroup = document.createElement('div');
                inputGroup.className = 'popup-form-input-group';
                const label = document.createElement('label');
                label.textContent = field.label;
                const input = document.createElement('input');
                input.type = field.type || 'text';
                input.id = field.id;
                input.placeholder = field.placeholder || '';
                input.required = field.required || false;
                inputGroup.appendChild(label);
                inputGroup.appendChild(input);
                popupFormArea.appendChild(inputGroup);
            });
        }

        // Show the popup
        popupOverlay.classList.add('active');
        // Close Popup Function
        function closeStylishPopup() {
            popupOverlay.classList.remove('active');
        }

        // Close button functionality
        const closeButton = document.getElementById('closeStylishPopupBtn');
        if (closeButton) {
            closeButton.addEventListener('click', closeStylishPopup);
        }

        // Optional: Close on outside click
        popupOverlay.addEventListener('click', function(event) {
            if (event.target === popupOverlay) {
                closeStylishPopup();
            }
        });
    }

    function generateConfetti() {
        const container = document.createElement('div');
        container.className = 'confetti-container';
        document.body.appendChild(container);

        const colors = ['#fce18a', '#ff726d', '#b48de6', '#fbd78c'];
        const count = 120; // Number of confetti pieces

        for (let i = 0; i < count; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.left = `${Math.random() * 100}vw`; // Start from random x position
            confetti.style.animationDelay = `${Math.random() * 2}s`; // Random start delay
            confetti.style.animationDuration = `${Math.random() * 1.5 + 1.5}s`; // Random duration
            container.appendChild(confetti);
        }

        // Remove confetti after animation completes
        setTimeout(() => {
            container.remove();
        }, 3000); // Adjust to match animation duration
    }

    function animateElement(element, className, delay = 0) {
        if (!element) return;
        setTimeout(() => {
            element.classList.add(className);
        }, delay);
    }

    // --- Authentication Flow ---
    const loginIconTrigger = document.getElementById('login-icon-trigger');
    const userAvatarTrigger = document.getElementById('user-avatar-trigger');
    const loginModal = document.getElementById('loginModal');
    const signupModal = document.getElementById('signupModal');
    const userMenu = document.getElementById('userMenu');
    const userProfileModal = document.getElementById('userProfileModal');

    // Modal Close Function
    function closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
        }
    }

    // Open Modal Functions
    function openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
        }
    }

    // Event Listeners for Modal Triggers
    if (loginIconTrigger) {
        loginIconTrigger.addEventListener('click', () => openModal('loginModal'));
    }

    if (userAvatarTrigger) {
        userAvatarTrigger.addEventListener('click', () => {
            if (userMenu) {
                userMenu.classList.toggle('active');
            }
        });
    }

    // Close Modal Buttons
    document.querySelectorAll('.close-modal-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const modalId = this.dataset.modalClose;
            closeModal(modalId);
        });
    });

    // Switch between Login and Signup Modals
    document.getElementById('modal-create-account-link').addEventListener('click', function(event) {
        event.preventDefault();
        closeModal('loginModal');
        openModal('signupModal');
    });

     document.getElementById('modal-already-account-link').addEventListener('click', function(event) {
        event.preventDefault();
        closeModal('signupModal');
        openModal('loginModal');
    });

    // --- User Profile Functionality ---
    const menuViewProfile = document.getElementById('menu-view-profile');
    if (menuViewProfile) {
        menuViewProfile.addEventListener('click', (event) => {
            event.preventDefault();
            closeModal('loginModal'); // In case it's open
            closeModal('signupModal'); // In case it's open
            if (userMenu) userMenu.classList.remove('active'); // Close user menu
            openModal('userProfileModal');
        });
    }

    const avatarUploadInput = document.getElementById('avatar-upload-input');
    const profileDisplayAvatar = document.getElementById('profile-display-avatar');
    const uploadProgressBar = document.getElementById('upload-progress-bar');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');

    if (avatarUploadInput) {
        avatarUploadInput.addEventListener('change', function() {
            const file = this.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    if (profileDisplayAvatar) profileDisplayAvatar.src = e.target.result;
                }
                reader.readAsDataURL(file);
            }
        });
    }

    const profileEditForm = document.getElementById('profile-edit-form');
    if (profileEditForm) {
        profileEditForm.addEventListener('submit', function(event) {
            event.preventDefault();
            // Basic form data - adjust as needed for backend
            const formData = new FormData(this);
            // Include avatar file if selected
            if (avatarUploadInput && avatarUploadInput.files.length > 0) {
                 formData.append('avatar', avatarUploadInput.files[0]);
            }

            fetch('/update-profile', { // Replace with your actual endpoint
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                     showStylishPopup('success', 'Profile Updated', 'Your profile has been updated successfully!', [{
                        text: 'Okay',
                        class: 'primary',
                        onClick: () => closeModal('userProfileModal')
                    }]);
                    // Update user menu avatar if needed
                    const menuAvatar = document.getElementById('menu-avatar');
                    if (menuAvatar && data.avatarUrl) {
                        menuAvatar.src = data.avatarUrl;
                    }
                } else {
                     showStylishPopup('error', 'Update Failed', data.message || 'Failed to update profile. Please try again.', [{
                        text: 'Okay',
                        class: 'primary'
                    }]);
                }
            })
            .catch(error => {
                console.error('Error:', error);
                 showStylishPopup('error', 'Error', 'An unexpected error occurred. Please try again later.', [{
                    text: 'Okay',
                    class: 'primary'
                }]);
            });
        });
    }

    // --- Change Password Functionality ---
    const changePasswordForm = document.getElementById('change-password-form');
    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', function(event) {
            event.preventDefault();
            const currentPassword = document.getElementById('current-password').value;
            const newPassword = document.getElementById('new-password-profile').value;
            const confirmPassword = document.getElementById('confirm-new-password-profile').value;

            if (newPassword !== confirmPassword) {
                 showStylishPopup('warning', 'Passwords Do Not Match', 'Please ensure your new password and confirmation match.', [{
                    text: 'Okay',
                    class: 'primary'
                }]);
                return;
            }

            fetch('/change-password', { // Replace with your actual endpoint
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    currentPassword: currentPassword,
                    newPassword: newPassword
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                     showStylishPopup('success', 'Password Changed', 'Your password has been changed successfully!', [{
                        text: 'Okay',
                        class: 'primary',
                        onClick: () => closeModal('userProfileModal')
                    }]);
                } else {
                     showStylishPopup('error', 'Password Change Failed', data.message || 'Failed to change password. Please check your current password and try again.', [{
                        text: 'Okay',
                        class: 'primary'
                    }]);
                }
            })
            .catch(error => {
                console.error('Error:', error);
                 showStylishPopup('error', 'Error', 'An unexpected error occurred. Please try again later.', [{
                    text: 'Okay',
                    class: 'primary'
                }]);
            });
        });
    }

    // --- Logout Functionality ---
    const menuLogout = document.getElementById('menu-logout');
    if (menuLogout) {
        menuLogout.addEventListener('click', function(event) {
            event.preventDefault();
            fetch('/logout', { // Replace with your actual logout endpoint
                method: 'POST'
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Redirect to login page or update UI as needed
                    showStylishPopup('info', 'Logged Out', 'You have been successfully logged out.', [{
                        text: 'Okay',
                        class: 'primary',
                        onClick: () => {
                            window.location.href = '/login'; // Or your login page
                        }
                    }]);
                } else {
                    showStylishPopup('error', 'Logout Failed', data.message || 'Failed to log out. Please try again.', [{
                        text: 'Okay',
                        class: 'primary'
                    }]);
                }
            })
            .catch(error => {
                console.error('Error:', error);
                 showStylishPopup('error', 'Error', 'An unexpected error occurred. Please try again later.', [{
                    text: 'Okay',
                    class: 'primary'
                }]);
            });
        });
    }

    // --- Feedback Form Functionality ---
    const feedbackForm = document.getElementById('feedback-form');
    const submitFeedbackButton = document.getElementById('submit-feedback');
    const feedbackListContainer = document.getElementById('feedback-list-container');
    const feedbackFormUsername = document.getElementById('feedback-form-username');
    const nameInput = document.getElementById('name');
    const feedbackTextarea = document.getElementById('feedback');
    const ratingInput = document.getElementById('rating');
    const starRating = document.getElementById('star-rating');

    // Load initial data and set up event listeners
    let user = null; // Store user data globally
    let allFeedbacks = []; // Store all feedbacks globally

    function fetchInitialData() {
        Promise.all([
            fetch('/user').then(response => response.json()),
            fetch('/feedbacks').then(response => response.json())
        ])
        .then(([userData, feedbackData]) => {
            user = userData.user;
            allFeedbacks = feedbackData.feedbacks || []; // Ensure it's an array

            // Set up UI based on loaded data
            updateUIForUser();
            displayFeedbacks(allFeedbacks);
            calculateAndDisplayAverageRating(allFeedbacks);
            animateElement(document.querySelector('.owner-info'), 'animate-in', 200);
            animateElement(document.getElementById('feedback-form-container'), 'animate-in', 500);
            animateElement(feedbackListContainer, 'animate-in', 700);
        })
        .catch(error => {
            console.error('Error fetching initial data:', error);
            showStylishPopup('error', 'Data Load Error', 'Failed to load initial data. Please try again later.', [{
                text: 'Okay',
                class: 'primary'
            }]);
        });
    }

    function updateUIForUser() {
        if (user) {
            // User is logged in
            feedbackFormUsername.textContent = user.name;
            nameInput.disabled = true;
            nameInput.value = user.name;
            if (user.avatar) {
                userAvatarTrigger.querySelector('img').src = user.avatar;
                userAvatarTrigger.classList.add('avatar-mode');
            } else {
                userAvatarTrigger.querySelector('img').src = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='; // Transparent GIF
                userAvatarTrigger.classList.remove('avatar-mode');
            }
            loginIconTrigger.style.display = 'none';
            userAvatarTrigger.style.display = 'flex';
        } else {
            // User is not logged in
            feedbackFormUsername.textContent = 'Guest';
            nameInput.disabled = false;
            nameInput.value = '';
            userAvatarTrigger.style.display = 'none';
            loginIconTrigger.style.display = 'flex';
        }
    }

    function displayFeedbacks(feedbacks) {
        feedbackListContainer.innerHTML = '<h2>Recent Feedbacks</h2>'; // Clear previous content

        if (feedbacks.length === 0) {
            feedbackListContainer.innerHTML += '<p>No feedbacks yet. Be the first!</p>';
            return;
        }

        feedbacks.forEach(feedback => {
            const feedbackItem = createFeedbackItemElement(feedback);
            feedbackListContainer.appendChild(feedbackItem);
        });
    }

    function createFeedbackItemElement(feedback) {
        const feedbackItem = document.createElement('div');
        feedbackItem.className = 'feedback-item';

        const avatarImg = document.createElement('img');
        avatarImg.className = 'avatar-img';
        avatarImg.src = feedback.user.avatar || 'https://i.ibb.co/8BqQ0gH/guest-avatar.png'; // Default guest avatar
        avatarImg.alt = 'User Avatar';

        const feedbackDetails = document.createElement('div');
        feedbackDetails.className = 'feedback-details';

        const nameElement = document.createElement('strong');
        nameElement.textContent = feedback.user.name;

        // Add user type indicator
        let userTypeIndicator = '';
        if (feedback.user.authType === 'google') {
            userTypeIndicator = '<span class="user-type-indicator google-user-indicator">Google</span>';
        } else if (feedback.user.authType === 'email') {
            userTypeIndicator = '<span class="user-type-indicator email-user-indicator">Email</span>';
        }
        nameElement.innerHTML += userTypeIndicator; // Use innerHTML to inject span

        const starsElement = document.createElement('div');
        starsElement.className = 'feedback-stars';
        for (let i = 0; i < feedback.rating; i++) {
            starsElement.innerHTML += '★';
        }

        const feedbackParagraph = document.createElement('p');
        feedbackParagraph.textContent = feedback.feedback;

         // Add "Edited" tag if feedback was edited
        if (feedback.edited) {
            const editedTag = document.createElement('span');
            editedTag.className = 'edited-tag';
            editedTag.textContent = 'Edited';
            nameElement.appendChild(editedTag); // Append to name element
        }

        const timestampElement = document.createElement('div');
        timestampElement.className = 'feedback-timestamp';
        timestampElement.textContent = new Date(feedback.timestamp).toLocaleString();

        feedbackDetails.appendChild(nameElement);
        feedbackDetails.appendChild(starsElement);
        feedbackDetails.appendChild(feedbackParagraph);
        feedbackDetails.appendChild(timestampElement);

        feedbackItem.appendChild(avatarImg);
        feedbackItem.appendChild(feedbackDetails);

        return feedbackItem;
    }

    function calculateAndDisplayAverageRating(feedbacks) {
        if (feedbacks.length === 0) {
            return;
        }

        const totalRating = feedbacks.reduce((sum, feedback) => sum + feedback.rating, 0);
        const averageRating = (totalRating / feedbacks.length).toFixed(1);

        const averageRatingDisplay = document.getElementById('average-rating-display');
         if (!averageRatingDisplay) {
            console.warn('average-rating-display element not found.');
            return;
        }

        averageRatingDisplay.innerHTML = `
            <div class="average-rating-container">
                <h3>Average Rating</h3>
                <div class="average-number">${averageRating}</div>
                <div class="average-stars">${'★'.repeat(Math.round(averageRating))}</div>
                <div class="total-feedbacks-count">Based on ${feedbacks.length} feedbacks</div>
            </div>
        `;
        animateElement(averageRatingDisplay.querySelector('.average-rating-container'), 'animate-in', 900);
    }

    if (starRating) {
        starRating.addEventListener('click', function(event) {
            if (event.target.classList.contains('star')) {
                const rating = parseInt(event.target.dataset.value);
                ratingInput.value = rating;

                // Update star highlighting
                starRating.querySelectorAll('.star').forEach(star => {
                    star.classList.remove('selected', 'highlighted');
                });
                event.target.classList.add('selected');
                let current = event.target;
                while (current.previousElementSibling) {
                    current = current.previousElementSibling;
                    current.classList.add('selected');
                }
            }
        });

        starRating.addEventListener('mouseover', function(event) {
             if (event.target.classList.contains('star')) {
                event.target.classList.add('highlighted');
                let current = event.target;
                while (current.previousElementSibling) {
                    current = current.previousElementSibling;
                    current.classList.add('highlighted');
                }
            }
        });

        starRating.addEventListener('mouseout', function(event) {
            starRating.querySelectorAll('.star').forEach(star => {
                star.classList.remove('highlighted');
            });
        });
    }

    if (submitFeedbackButton) {
        submitFeedbackButton.addEventListener('click', function() {
            if (!user && !nameInput.value.trim()) {
                 showStylishPopup('warning', 'Name Required', 'Please enter your name to submit feedback.', [{
                    text: 'Okay',
                    class: 'primary'
                }]);
                return;
            }

            if (!feedbackTextarea.value.trim()) {
                 showStylishPopup('warning', 'Feedback Required', 'Please enter your feedback.', [{
                    text: 'Okay',
                    class: 'primary'
                }]);
                return;
            }

            if (ratingInput.value === '0') {
                 showStylishPopup('warning', 'Rating Required', 'Please rate your experience.', [{
                    text: 'Okay',
                    class: 'primary'
                }]);
                return;
            }

            const feedbackData = {
                name: user ? user.name : nameInput.value,
                feedback: feedbackTextarea.value,
                rating: parseInt(ratingInput.value),
            };

            fetch('/submit-feedback', { // Replace with your actual endpoint
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(feedbackData)
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    allFeedbacks.unshift(data.feedback); // Add new feedback to the beginning
                    displayFeedbacks(allFeedbacks);
                    calculateAndDisplayAverageRating(allFeedbacks);
                    feedbackTextarea.value = ''; // Clear textarea
                    ratingInput.value = '0'; // Reset rating
                    starRating.querySelectorAll('.star').forEach(star => star.classList.remove('selected')); // Clear selected stars
                    generateConfetti();
                     showStylishPopup('success', 'Feedback Submitted', 'Thank you for your feedback!', [{
                        text: 'Okay',
                        class: 'primary'
                    }]);
                } else {
                     showStylishPopup('error', 'Submission Failed', data.message || 'Failed to submit feedback. Please try again.', [{
                        text: 'Okay',
                        class: 'primary'
                    }]);
                }
            })
            .catch(error => {
                console.error('Error:', error);
                 showStylishPopup('error', 'Error', 'An unexpected error occurred. Please try again later.', [{
                    text: 'Okay',
                    class: 'primary'
                }]);
            });
        });
    }

    // Initialize the app by fetching data
    fetchInitialData();

    // --- Typed.js Initialization ---
    const mainTitle = document.getElementById('main-title');
    const typedOutput = document.getElementById('typed-output');

    if (mainTitle && typedOutput) {
        const typed = new Typed(mainTitle, {
            strings: ["Share Your Valuable Feedback!", "We Value Your Thoughts!", "Help Us Improve!", "Your Voice Matters!"],
            typeSpeed: 65,
            backSpeed: 35,
            startDelay: 700,
            backDelay: 2500,
            loop: true,
            loopCount: Infinity,
            onComplete: function(self) {
                typedOutput.textContent = '...and we\'re listening!';
                typedOutput.style.color = '#FFD700'; // Gold color
                typedOutput.style.fontWeight = 'bold';
            }
        });
    } else {
        console.warn('Main title or typed output element not found.');
    }
});
