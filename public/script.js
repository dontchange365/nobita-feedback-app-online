// ASSUMING YOU HAVE A FUNCTION TO SHOW YOUR STYLISH POPUP
// function showStylishPopup(type, title, message, buttons = []) { ... }
// AND A FUNCTION TO HIDE IT, OR IT HIDES ITSELF
// function hideStylishPopup() { ... }

// ASSUMING currentUser OBJECT IS AVAILABLE AND HAS displayName, avatarUrl
// let currentUser = { displayName: "User", avatarUrl: "default-avatar.png", email: "user@example.com", type: "email" }; // Example

// --- DOM Elements (Make sure these IDs exist in your HTML) ---
const profileModalOverlay = document.getElementById('profile-modal-overlay'); // Assuming your profile modal overlay
const modalProfileAvatarImg = document.getElementById('modal-profile-avatar-img'); // Assign this ID to the large avatar img in profile modal
const avatarUploadInput = document.getElementById('avatar-upload-input'); // Assign this ID to your <input type="file"> for avatar
const profileNameInput = document.getElementById('profile-name-input'); // Assign this ID to your name input in profile modal
const saveProfileButton = document.getElementById('save-profile-button'); // Assign this ID to your save changes button in profile modal
const userAvatarTriggerImg = document.getElementById('user-avatar-trigger-img'); // Assign this ID to the <img> inside #user-avatar-trigger
const loadingSpinner = document.querySelector('.loading-spinner'); // Make sure this element exists for loading indication

let newAvatarFile = null;
let newAvatarPreviewUrl = null;

// --- Function to show loading state ---
function showProfileLoading(isSaving) {
    if (loadingSpinner) loadingSpinner.style.display = 'block';
    if (saveProfileButton) saveProfileButton.disabled = true;
    if (isSaving) {
        // Optionally, show a specific message instead of just a spinner
        // You might want a dedicated div for this message in your HTML
        console.log("Uploading/Saving... Please wait.");
    }
}

// --- Function to hide loading state ---
function hideProfileLoading() {
    if (loadingSpinner) loadingSpinner.style.display = 'none';
    if (saveProfileButton) saveProfileButton.disabled = false;
}

// --- Event Listener for Avatar File Input Change (Show Preview) ---
if (avatarUploadInput && modalProfileAvatarImg) {
    avatarUploadInput.addEventListener('change', function(event) {
        const file = event.target.files[0];
        if (file) {
            newAvatarFile = file; // Store the file object
            const reader = new FileReader();
            reader.onload = function(e) {
                newAvatarPreviewUrl = e.target.result; // Store Data URL for preview
                modalProfileAvatarImg.src = newAvatarPreviewUrl; // Show preview
            }
            reader.readAsDataURL(file);
        }
    });
}

// --- Event Listener for Save Profile Button Click ---
if (saveProfileButton) {
    saveProfileButton.addEventListener('click', async function() {
        const newName = profileNameInput ? profileNameInput.value.trim() : currentUser.displayName;

        showProfileLoading(true);

        let avatarChanged = false;
        let nameChanged = false;

        // Simulate Name Update (as you said it's working)
        if (newName !== currentUser.displayName && newName !== "") {
            // In a real app, you'd send this to the server
            currentUser.displayName = newName;
            nameChanged = true;
            // Update display name in UI if it's shown elsewhere in the modal or menu immediately
            const menuUsername = document.querySelector('.user-profile-menu .menu-header .username');
            if (menuUsername) menuUsername.textContent = newName;
        }

        // Simulate Avatar Upload
        if (newAvatarFile && newAvatarPreviewUrl) {
            // **REAL UPLOAD LOGIC WILL GO HERE**
            // For example, using FormData and fetch:
            // const formData = new FormData();
            // formData.append('avatar', newAvatarFile);
            // formData.append('userId', currentUser.id); // or some identifier
            // try {
            //    const response = await fetch('/api/upload-avatar', { method: 'POST', body: formData });
            //    const result = await response.json();
            //    if (response.ok && result.avatarUrl) {
            //        currentUser.avatarUrl = result.avatarUrl; // URL from server
            //        modalProfileAvatarImg.src = currentUser.avatarUrl;
            //        if (userAvatarTriggerImg) userAvatarTriggerImg.src = currentUser.avatarUrl;
            //        avatarChanged = true;
            //    } else {
            //        throw new Error(result.message || 'Avatar upload failed');
            //    }
            // } catch (error) {
            //    console.error("Avatar upload error:", error);
            //    hideProfileLoading();
            //    showStylishPopup('error', 'Upload Failed', error.message || 'Could not upload avatar. Please try again.');
            //    return; // Stop further processing
            // }

            // **SIMULATED UPLOAD FOR NOW**
            await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate 1.5 seconds upload time

            // On successful simulated upload:
            currentUser.avatarUrl = newAvatarPreviewUrl; // Use the preview URL as the new avatar URL
            modalProfileAvatarImg.src = currentUser.avatarUrl;
            if (userAvatarTriggerImg) userAvatarTriggerImg.src = currentUser.avatarUrl;
            avatarChanged = true;
            newAvatarFile = null; // Reset after "upload"
            newAvatarPreviewUrl = null; // Reset preview URL
        }

        hideProfileLoading();

        if (avatarChanged && nameChanged) {
            showStylishPopup('success', 'Profile Updated!', 'Your name and avatar have been successfully updated.');
        } else if (avatarChanged) {
            showStylishPopup('success', 'Avatar Updated!', 'Your new avatar has been successfully updated.');
        } else if (nameChanged) {
            showStylishPopup('success', 'Name Updated!', 'Your name has been successfully updated.');
        } else {
            showStylishPopup('info', 'No Changes', 'No changes were made to your profile.');
        }

        // Optionally close the modal or give other feedback
        // if (profileModalOverlay && profileModalOverlay.classList.contains('active')) {
        //     profileModalOverlay.classList.remove('active');
        // }
    });
}

// --- Function to populate profile modal when it opens ---
// (You'll need to call this when your profile modal becomes active)
function populateProfileModal() {
    if (currentUser && profileNameInput) {
        profileNameInput.value = currentUser.displayName;
    }
    if (currentUser && modalProfileAvatarImg) {
        modalProfileAvatarImg.src = currentUser.avatarUrl;
    }
    // Reset file input and preview data
    if (avatarUploadInput) avatarUploadInput.value = null;
    newAvatarFile = null;
    newAvatarPreviewUrl = null;
}

// Example: If your profile modal opens by adding 'active' class to an overlay
// const viewProfileButton = document.getElementById('view-profile-button'); // ID of your "View Profile" link/button
// if (viewProfileButton && profileModalOverlay) {
//     viewProfileButton.addEventListener('click', () => {
//         populateProfileModal();
//         profileModalOverlay.classList.add('active'); // Or however your modal is shown
//     });
// }

// Make sure to call populateProfileModal() when your profile modal is displayed.
// For instance, if you have a function that opens the profile modal:
// function openProfileModal() {
//     // ... your existing code to show modal ...
//     populateProfileModal();
//     // ...
// }
