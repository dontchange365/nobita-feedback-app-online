document.addEventListener('DOMContentLoaded', () => {
    const feedbackForm = document.getElementById('feedback-form');
    const starRatingContainer = document.getElementById('star-rating-container');
    const feedbackComment = document.getElementById('feedback-comment');
    const feedbacksContainer = document.getElementById('feedbacks-container');
    const overallScoreElement = document.getElementById('overall-score');
    const overallFeedbackCountElement = document.getElementById('overall-feedback-count');
    const overallStarsContainer = document.getElementById('overall-stars');

    let currentRating = 0;

    // --- Star Rating Logic ---
    function renderStars(container, rating, isInteractive = false) {
        container.innerHTML = ''; // Clear previous stars
        for (let i = 1; i <= 5; i++) {
            const star = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            star.setAttribute("xmlns", "http://www.w3.org/2000/svg");
            star.setAttribute("viewBox", "0 0 24 24");
            star.setAttribute("fill", "currentColor");
            star.classList.add('w-8', 'h-8', 'text-gray-300', 'star-icon');
            if (i <= rating) {
                star.classList.add('active', 'text-yellow-400');
            } else {
                star.classList.remove('active', 'text-yellow-400');
            }
            star.innerHTML = `<path d="M12 2l3.09 6.31L22 9.27l-5 4.87 1.18 6.88L12 17.27l-6.18 3.29L7 14.14l-5-4.87 6.91-0.96L12 2z"/>`;
            star.dataset.value = i;

            if (isInteractive) {
                star.addEventListener('mouseover', () => {
                    Array.from(container.children).forEach((s, idx) => {
                        if (idx < i) {
                            s.classList.add('active', 'text-yellow-400');
                        } else {
                            s.classList.remove('active', 'text-yellow-400');
                        }
                    });
                });
                star.addEventListener('mouseout', () => {
                    renderStars(container, currentRating, true); // Reset to current selected
                });
                star.addEventListener('click', () => {
                    currentRating = i;
                    renderStars(container, currentRating, true);
                });
            }
            container.appendChild(star);
        }
    }

    renderStars(starRatingContainer, currentRating, true); // Initialize interactive stars

    // --- Feedback Submission ---
    feedbackForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        if (!token) {
            showToast('Please log in to submit feedback.', 'error');
            openModal(document.getElementById('auth-modal'));
            return;
        }

        if (currentRating === 0) {
            showToast('Please select a star rating!', 'error');
            return;
        }
        if (feedbackComment.value.trim() === '') {
            showToast('Comment cannot be empty!', 'error');
            return;
        }

        try {
            const response = await fetch('/api/feedback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    rating: currentRating,
                    comment: feedbackComment.value.trim()
                })
            });
            const data = await response.json();

            if (response.ok) {
                showToast('Feedback Submitted!', 'success');
                feedbackForm.reset();
                currentRating = 0; // Reset rating
                renderStars(starRatingContainer, currentRating, true); // Update star UI
                await fetchFeedbacks(); // Refresh feedbacks to show the new one
            } else {
                showToast(data.message || 'Failed to submit feedback.', 'error');
                if (response.status === 401) { // Unauthorized, possibly expired token
                    localStorage.removeItem('token');
                    // Assuming updateAuthUI is global from auth.js
                    window.updateAuthUI();
                    window.openModal(document.getElementById('auth-modal'));
                }
            }
        } catch (error) {
            console.error('Feedback submission error:', error);
            showToast('An error occurred. Please try again.', 'error');
        }
    });

    // --- Fetch and Display Feedbacks ---
    window.fetchFeedbacks = async () => {
        try {
            const response = await fetch('/api/feedback');
            const data = await response.json();

            if (response.ok) {
                displayFeedbacks(data.feedbacks);
                updateOverallRating(data.overallRating, data.totalFeedbacks);
            } else {
                showToast(data.message || 'Failed to fetch feedbacks.', 'error');
            }
        } catch (error) {
            console.error('Error fetching feedbacks:', error);
            showToast('Failed to load feedbacks.', 'error');
        }
    };

    function displayFeedbacks(feedbacks) {
        feedbacksContainer.innerHTML = '';
        const currentUserId = localStorage.getItem('userId');
        const isAdmin = localStorage.getItem('isAdmin') === 'true';

        feedbacks.forEach(feedback => {
            const isCurrentUser = feedback.user._id === currentUserId;
            const feedbackCard = document.createElement('div');
            feedbackCard.classList.add(
                'bg-white', 'rounded-xl', 'shadow-lg', 'p-6', 'relative',
                'overflow-hidden', 'feedback-card', 'transition-all', 'duration-300', 'ease-in-out',
                'animate-slide-in-up' // Add entrance animation
            );

            if (isCurrentUser) {
                feedbackCard.classList.add('bg-indigo-50', 'border-l-4', 'border-indigo-400'); // Highlight current user's feedback
            }

            // Generate star SVG string
            let starSvgs = '';
            for (let i = 1; i <= 5; i++) {
                starSvgs += `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4 ${i <= feedback.rating ? 'text-yellow-400' : 'text-gray-300'}"><path d="M12 2l3.09 6.31L22 9.27l-5 4.87 1.18 6.88L12 17.27l-6.18 3.29L7 14.14l-5-4.87 6.91-0.96L12 2z"/></svg>`;
            }

            const formattedDate = new Date(feedback.createdAt).toLocaleString('en-US', {
                year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            });

            feedbackCard.innerHTML = `
                <div class="flex items-center space-x-4 mb-4">
                    <img src="${feedback.user.avatar || '/images/default-avatar.png'}" alt="${feedback.user.name}" class="w-12 h-12 rounded-full border-2 border-indigo-300 object-cover">
                    <div>
                        <p class="font-semibold text-gray-900">${feedback.user.name}</p>
                        <p class="text-xs text-gray-500">${formattedDate}</p>
                    </div>
                </div>
                <div class="flex mb-3">
                    ${starSvgs}
                </div>
                <p class="text-gray-700 leading-relaxed mb-4">${feedback.comment}</p>

                ${feedback.adminReply ? `
                    <div class="bg-slate-100 border-l-4 border-blue-500 rounded-lg p-4 mt-4 relative">
                        <div class="flex items-center space-x-3 mb-2">
                            <img src="${feedback.adminReply.adminAvatar || '/images/admin-avatar.png'}" alt="Admin" class="w-8 h-8 rounded-full object-cover">
                            <span class="font-bold text-blue-600 text-sm uppercase tracking-wider">Admin Response</span>
                        </div>
                        <p class="text-gray-800">${feedback.adminReply.text}</p>
                        <p class="text-xs text-gray-500 mt-2 text-right">Replied: ${new Date(feedback.adminReply.createdAt).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                ` : ''}

                ${(isCurrentUser || isAdmin) ? `
                <div class="feedback-actions absolute top-4 right-4 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    ${isCurrentUser ? `
                    <button class="edit-feedback-btn p-2 rounded-full bg-gray-200 text-gray-600 hover:bg-green-100 hover:text-green-600 transition-colors duration-200" data-id="${feedback._id}">
                        <i data-lucide="edit-3" class="w-4 h-4"></i>
                    </button>
                    ` : ''}
                    <button class="delete-feedback-btn p-2 rounded-full bg-gray-200 text-gray-600 hover:bg-red-100 hover:text-red-600 transition-colors duration-200" data-id="${feedback._id}">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
                ` : ''}
            `;
            feedbacksContainer.appendChild(feedbackCard);
        });

        lucide.createIcons(); // Ensure icons in new cards are rendered

        // Add event listeners for delete buttons (if present and authorized)
        document.querySelectorAll('.delete-feedback-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const feedbackId = e.currentTarget.dataset.id;
                showConfirmation('Are you sure you want to delete this feedback?', () => deleteFeedback(feedbackId));
            });
        });

        // Add event listeners for edit buttons (if present and authorized) - Implementation deferred
        document.querySelectorAll('.edit-feedback-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const feedbackId = e.currentTarget.dataset.id;
                // Implement edit functionality (e.g., populate form, open edit modal)
                showToast(`Edit functionality for feedback ID: ${feedbackId} not yet implemented.`, 'warning');
            });
        });
    }

    async function deleteFeedback(feedbackId) {
        const token = localStorage.getItem('token');
        if (!token) {
            showToast('Session expired. Please log in again.', 'error');
            openModal(document.getElementById('auth-modal'));
            return;
        }

        try {
            const response = await fetch(`/api/feedback/${feedbackId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const data = await response.json();
            if (response.ok) {
                showToast('Feedback deleted successfully!', 'success');
                await fetchFeedbacks(); // Refresh the list
            } else {
                showToast(data.message || 'Failed to delete feedback.', 'error');
            }
        } catch (error) {
            console.error('Error deleting feedback:', error);
            showToast('An error occurred during deletion.', 'error');
        }
    }


    // --- Overall Rating Logic ---
    function updateOverallRating(overallRating, totalFeedbacks) {
        overallScoreElement.textContent = overallRating.toFixed(1);
        overallFeedbackCountElement.textContent = `Based on ${totalFeedbacks} feedbacks.`;

        // Animate number count-up
        const startValue = parseFloat(overallScoreElement.dataset.currentValue || 0);
        const endValue = overallRating;
        const duration = 800; // ms
        let startTime = null;

        function animateCountUp(currentTime) {
            if (!startTime) startTime = currentTime;
            const progress = (currentTime - startTime) / duration;
            const currentValue = startValue + (endValue - startValue) * Math.min(progress, 1);
            overallScoreElement.textContent = currentValue.toFixed(1);
            overallScoreElement.dataset.currentValue = currentValue;

            if (progress < 1) {
                requestAnimationFrame(animateCountUp);
            }
        }
        requestAnimationFrame(animateCountUp);


        // Render overall stars
        overallStarsContainer.innerHTML = '';
        for (let i = 1; i <= 5; i++) {
            const star = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            star.setAttribute("xmlns", "http://www.w3.org/2000/svg");
            star.setAttribute("viewBox", "0 0 24 24");
            star.setAttribute("fill", "currentColor");
            star.classList.add('w-10', 'h-10', 'text-gray-300'); // Larger stars for overall
            if (i <= Math.round(overallRating)) { // Round for filled stars
                star.classList.add('text-yellow-400');
            }
            star.innerHTML = `<path d="M12 2l3.09 6.31L22 9.27l-5 4.87 1.18 6.88L12 17.27l-6.18 3.29L7 14.14l-5-4.87 6.91-0.96L12 2z"/>`;
            overallStarsContainer.appendChild(star);
        }
    }

    // Confirmation Modal Logic (re-using main.js modal functions)
    const confirmationModal = document.getElementById('confirmation-modal');
    const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
    const confirmProceedBtn = document.getElementById('confirm-proceed-btn');
    const confirmationMessageElement = document.getElementById('confirmation-message');
    let confirmCallback = null;

    window.showConfirmation = (message, onConfirm) => {
        confirmationMessageElement.textContent = message;
        confirmCallback = onConfirm;
        openModal(confirmationModal);
    };

    confirmCancelBtn.addEventListener('click', () => {
        closeModal(confirmationModal);
        confirmCallback = null; // Clear callback
    });

    confirmProceedBtn.addEventListener('click', () => {
        if (confirmCallback) {
            confirmCallback();
        }
        closeModal(confirmationModal);
        confirmCallback = null;
    });

    // Initial fetch of feedbacks on page load
    fetchFeedbacks();
});
