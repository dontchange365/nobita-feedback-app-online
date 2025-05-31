// public/js/admin.js

document.addEventListener('DOMContentLoaded', () => {
    const userListContainer = document.getElementById('user-list');
    const feedbackListAdminContainer = document.getElementById('feedback-list-admin');

    // Function to fetch all users (admin only)
    async function fetchUsers() {
        const token = localStorage.getItem('token');
        if (!token || localStorage.getItem('isAdmin') !== 'true') {
            window.location.href = '/'; // Redirect if not admin
            return;
        }

        try {
            const response = await fetch('/api/admin/users', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            const data = await response.json();

            if (response.ok) {
                userListContainer.innerHTML = '';
                data.forEach(user => {
                    const userDiv = document.createElement('div');
                    userDiv.classList.add('user-item');
                    userDiv.innerHTML = `
                        <div class="user-info">
                            <p><strong>ID:</strong> ${user._id}</p>
                            <p><strong>Username:</strong> ${user.username}</p>
                            <p><strong>Email:</strong> ${user.email}</p>
                            <p><strong>Admin:</strong> ${user.isAdmin ? 'Yes' : 'No'}</p>
                        </div>
                        <div class="user-actions">
                            <button class="delete-user-btn" data-user-id="${user._id}">Delete</button>
                        </div>
                        <hr>
                    `;
                    userListContainer.appendChild(userDiv);
                });
                attachDeleteUserListeners();
            } else {
                console.error('Failed to fetch users:', data.message || 'An error occurred');
                userListContainer.innerHTML = '<p class="error-message">Failed to load users.</p>';
            }
        } catch (error) {
            console.error('Error fetching users:', error);
            userListContainer.innerHTML = '<p class="error-message">An error occurred while loading users.</p>';
        }
    }

    // Function to attach event listeners to delete user buttons
    function attachDeleteUserListeners() {
        const deleteButtons = document.querySelectorAll('.delete-user-btn');
        deleteButtons.forEach(button => {
            button.addEventListener('click', async () => {
                const userId = button.dataset.userId;
                const token = localStorage.getItem('token');
                if (confirm(`Are you sure you want to delete user with ID: ${userId}?`)) {
                    try {
                        const response = await fetch(`/api/admin/users/${userId}`, {
                            method: 'DELETE',
                            headers: {
                                'Authorization': `Bearer ${token}`,
                            },
                        });

                        const data = await response.json();

                        if (response.ok) {
                            alert('User deleted successfully.');
                            fetchUsers(); // Refresh user list
                        } else {
                            alert(data.message || 'Failed to delete user.');
                        }
                    } catch (error) {
                        console.error('Error deleting user:', error);
                        alert('An error occurred while deleting the user.');
                    }
                }
            });
        });
    }

    // Function to fetch all feedback (admin only)
    async function fetchFeedbackAdmin() {
        const token = localStorage.getItem('token');
        if (!token || localStorage.getItem('isAdmin') !== 'true') {
            window.location.href = '/'; // Redirect if not admin
            return;
        }

        try {
            const response = await fetch('/api/admin/feedbacks', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            const data = await response.json();

            if (response.ok) {
                feedbackListAdminContainer.innerHTML = '';
                data.forEach(feedback => {
                    const feedbackDiv = document.createElement('div');
                    feedbackDiv.classList.add('feedback-item-admin');
                    feedbackDiv.innerHTML = `
                        <div class="feedback-info-admin">
                            <p><strong>ID:</strong> ${feedback._id}</p>
                            <p class="user-details"><strong>User:</strong> ${feedback.user ? feedback.user.username : 'Guest'}</p>
                            <p><strong>Rating:</strong> ${'★'.repeat(feedback.rating)}</p>
                            <p class="comment">${feedback.comment}</p>
                            ${feedback.media && feedback.media.length > 0 ?
                                '<div class="feedback-media">' +
                                feedback.media.map(url => {
                                    if (url.endsWith('.mp4') || url.endsWith('.webm')) {
                                        return `<video src="${url}" controls width="160"></video>`;
                                    } else {
                                        return `<img src="${url}" alt="Feedback Media" style="max-width: 160px;">`;
                                    }
                                }).join('') +
                                '</div>' : ''
                            }
                        </div>
                        <div class="feedback-actions-admin">
                            <button class="delete-feedback-btn" data-feedback-id="${feedback._id}">Delete</button>
                        </div>
                        <hr>
                    `;
                    feedbackListAdminContainer.appendChild(feedbackDiv);
                });
                attachDeleteFeedbackListeners();
            } else {
                console.error('Failed to fetch feedback:', data.message || 'An error occurred');
                feedbackListAdminContainer.innerHTML = '<p class="error-message">Failed to load feedback.</p>';
            }
        } catch (error) {
            console.error('Error fetching feedback:', error);
            feedbackListAdminContainer.innerHTML = '<p class="error-message">An error occurred while loading feedback.</p>';
        }
    }

    // Function to attach event listeners to delete feedback buttons
    function attachDeleteFeedbackListeners() {
        const deleteButtons = document.querySelectorAll('.delete-feedback-btn');
        deleteButtons.forEach(button => {
            button.addEventListener('click', async () => {
                const feedbackId = button.dataset.feedbackId;
                const token = localStorage.getItem('token');
                if (confirm(`Are you sure you want to delete feedback with ID: ${feedbackId}?`)) {
                    try {
                        const response = await fetch(`/api/admin/feedbacks/${feedbackId}`, {
                            method: 'DELETE',
                            headers: {
                                'Authorization': `Bearer ${token}`,
                            },
                        });

                        const data = await response.json();

                        if (response.ok) {
                            alert('Feedback deleted successfully.');
                            fetchFeedbackAdmin(); // Refresh feedback list
                        } else {
                            alert(data.message || 'Failed to delete feedback.');
                        }
                    } catch (error) {
                        console.error('Error deleting feedback:', error);
                        alert('An error occurred while deleting the feedback.');
                    }
                }
            });
        });
    }

    // Fetch data when the page loads (only if admin)
    if (localStorage.getItem('isAdmin') === 'true') {
        fetchUsers();
        fetchFeedbackAdmin();
    } else {
        window.location.href = '/'; // Redirect non-admins
    }
});