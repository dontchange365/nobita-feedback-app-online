// public/js/feedback.js

document.addEventListener('DOMContentLoaded', () => {
    const feedbackForm = document.getElementById('feedback-form');
    const feedbackListContainer = document.getElementById('feedback-list');
    const mediaPreviewContainer = document.getElementById('media-preview');

    // Function to display existing feedback
    async function fetchFeedback() {
        try {
            const response = await fetch('/api/feedback');
            const data = await response.json();

            if (response.ok) {
                feedbackListContainer.innerHTML = ''; // Clear previous feedback
                data.forEach(feedback => {
                    const feedbackDiv = document.createElement('div');
                    feedbackDiv.classList.add('feedback-item');
                    feedbackDiv.innerHTML = `
                        <p><strong>${feedback.name}</strong> - Rating: ${'★'.repeat(feedback.rating)}</p>
                        <p>${feedback.comment}</p>
                        ${feedback.media && feedback.media.length > 0 ?
                            '<div class="feedback-media">' +
                            feedback.media.map(url => {
                                if (url.endsWith('.mp4') || url.endsWith('.webm')) {
                                    return `<video src="${url}" controls width="320"></video>`;
                                } else {
                                    return `<img src="${url}" alt="Feedback Media" style="max-width: 320px;">`;
                                }
                            }).join('') +
                            '</div>' : ''
                        }
                        <hr>
                    `;
                    feedbackListContainer.appendChild(feedbackDiv);
                }
                );
            } else {
                console.error('Failed to fetch feedback:', data.message || 'An error occurred');
                feedbackListContainer.innerHTML = '<p class="error-message">Failed to load feedback.</p>';
            }
        } catch (error) {
            console.error('Error fetching feedback:', error);
            feedbackListContainer.innerHTML = '<p class="error-message">An error occurred while loading feedback.</p>';
        }
    }

    // Fetch feedback when the page loads
    fetchFeedback();

    // --- Feedback Form Submission ---
    if (feedbackForm) {
        feedbackForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const rating = document.getElementById('rating').value;
            const comment = document.getElementById('comment').value;
            const mediaFiles = document.getElementById('media').files;

            const formData = new FormData();
            formData.append('rating', rating);
            formData.append('comment', comment);

            for (let i = 0; i < mediaFiles.length; i++) {
                formData.append('media', mediaFiles[i]);
            }

            try {
                const token = localStorage.getItem('token');
                if (!token) {
                    alert('You must be logged in to leave feedback.');
                    window.location.href = '/login.html';
                    return;
                }

                const response = await fetch('/api/feedback', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                    body: formData,
                });

                const data = await response.json();

                if (response.ok) {
                    alert('Feedback submitted successfully!');
                    feedbackForm.reset();
                    mediaPreviewContainer.innerHTML = ''; // Clear media preview
                    fetchFeedback(); // Refresh feedback list
                } else {
                    alert(data.message || 'Failed to submit feedback.');
                }
            } catch (error) {
                console.error('Feedback submission error:', error);
                alert('An error occurred while submitting feedback.');
            }
        });

        // --- Media Preview (Optional) ---
        const mediaInput = document.getElementById('media');
        if (mediaInput) {
            mediaInput.addEventListener('change', (event) => {
                mediaPreviewContainer.innerHTML = ''; // Clear previous previews
                const files = event.target.files;
                for (const file of files) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const preview = document.createElement('div');
                        preview.style.marginRight = '10px';
                        if (file.type.startsWith('image/')) {
                            preview.innerHTML = `<img src="${e.target.result}" alt="Media Preview" style="max-width: 100px; height: auto;">`;
                        } else if (file.type.startsWith('video/')) {
                            preview.innerHTML = `<video src="${e.target.result}" controls width="100"></video>`;
                        }
                        mediaPreviewContainer.appendChild(preview);
                    };
                    reader.readAsDataURL(file);
                }
            });
        }
    }
});