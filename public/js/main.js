// Utility functions for modals and toasts

const authModal = document.getElementById('auth-modal');
const profileViewModal = document.getElementById('profile-view-modal');
const editProfileModal = document.getElementById('edit-profile-modal');
const confirmationModal = document.getElementById('confirmation-modal');

const allModals = [authModal, profileViewModal, editProfileModal, confirmationModal];

function openModal(modalElement) {
    modalElement.classList.remove('hidden');
    // Add 'show' class after a small delay to trigger transitions
    setTimeout(() => {
        modalElement.classList.add('show');
        modalElement.querySelector('.modal-content').classList.add('show');
    }, 10);
    document.body.classList.add('overflow-hidden'); // Prevent scrolling
}

function closeModal(modalElement) {
    modalElement.classList.remove('show');
    modalElement.querySelector('.modal-content').classList.remove('show');
    // Hide after transition
    setTimeout(() => {
        modalElement.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
    }, 300); // Duration of the modal transition
}

allModals.forEach(modal => {
    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal(modal);
        }
    });

    // Close on 'x' button click
    const closeBtn = modal.querySelector('.modal-close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => closeModal(modal));
    }
});


// Toast Notification System
const toastContainer = document.getElementById('toast-container');

function showToast(message, type = 'success', duration = 3000) {
    const toast = document.createElement('div');
    toast.classList.add('toast', type);
    toast.innerHTML = `
        <i data-lucide="${type === 'success' ? 'check-circle' : type === 'error' ? 'x-circle' : 'alert-circle'}" class="w-5 h-5"></i>
        <span>${message}</span>
    `;
    lucide.createIcons(); // Re-render lucide icons inside new toast

    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('show');
    }, 10); // Small delay to trigger transition

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300); // Remove after fade out
    }, duration);
}

// Global functions for other JS files to use
window.openModal = openModal;
window.closeModal = closeModal;
window.showToast = showToast;
