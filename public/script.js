// Base API URL for backend calls (replace with your backend's URL)
const API_BASE = "https://nobita-feedback-app-online.onrender.com";  // e.g., "https://myapp.onrender.com"

// Select DOM elements for reuse
const loginBtn = document.getElementById('loginBtn');
const userMenu = document.getElementById('userMenu');
const logoutLink = document.getElementById('logoutLink') || document.getElementById('logoutLinkProfile');
const navUserNameElem = document.getElementById('navUserName');
const navAvatarElem = document.getElementById('navAvatar');
const profileNavAvatar = document.getElementById('profileNavAvatar');
const profileNavName = document.getElementById('profileNavName');
const profileNameElem = document.getElementById('profileName');
const profileEmailElem = document.getElementById('profileEmail');
const profileAvatarElem = document.getElementById('profileAvatar');

const feedbackForm = document.getElementById('feedbackForm');
const feedbackNameInput = document.getElementById('feedbackName');
const starRatingElems = document.querySelectorAll('#starRating .star');
const ratingValueInput = document.getElementById('ratingValue');
const feedbackText = document.getElementById('feedbackText');
const charCountElem = document.getElementById('charCount');
const submitBtnText = document.getElementById('submitBtnText');
const submitBtnSpinner = document.getElementById('submitBtnSpinner');
const feedbackListElem = document.getElementById('feedbackList');

const authModal = document.getElementById('authModal');
const authModalClose = document.getElementById('authModalClose');
const loginFormDiv = document.getElementById('loginForm');
const signupFormDiv = document.getElementById('signupForm');
const switchToSignupLink = document.getElementById('switchToSignup');
const switchToLoginLink = document.getElementById('switchToLogin');
const forgotPasswordLink = document.getElementById('forgotPasswordLink');
const loginEmailInput = document.getElementById('loginEmail');
const loginPasswordInput = document.getElementById('loginPassword');
const loginSubmitBtn = document.getElementById('loginSubmitBtn');
const signupNameInput = document.getElementById('signupName');
const signupEmailInput = document.getElementById('signupEmail');
const signupPasswordInput = document.getElementById('signupPassword');
const signupSubmitBtn = document.getElementById('signupSubmitBtn');
const googleSignInDiv = document.getElementById('googleSignInDiv');

const avatarInput = document.getElementById('avatarInput');
const uploadAvatarBtn = document.getElementById('uploadAvatarBtn');
const avatarUploadSpinner = document.getElementById('avatarUploadSpinner');

const resetForm = document.getElementById('resetForm');
const newPasswordInput = document.getElementById('newPassword');
const confirmPasswordInput = document.getElementById('confirmPassword');
const resetMessageElem = document.getElementById('resetMessage');

const toastElem = document.getElementById('toast');

// State variables
let currentUser = null;
let currentToken = null;
let selectedRating = 0;

// Toast message function
function showToast(message, isError = false) {
  if (!toastElem) return;
  toastElem.textContent = message;
  toastElem.style.backgroundColor = isError ? "#d33" : "#333";
  toastElem.className = "show";
  // Hide after 3 seconds (the CSS animation is 0.5s in, 0.5s out, with 3s display)
  setTimeout(() => {
    toastElem.className = toastElem.className.replace("show", "");
  }, 3500);
}

// Format date from ISO string to a short readable format
function formatDate(isoString) {
  const date = new Date(isoString);
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// Update UI to logged-in state
function updateUIForLoggedIn() {
  if (!currentUser) return;
  if (loginBtn) loginBtn.style.display = "none";
  if (userMenu) userMenu.style.display = "flex";
  if (navUserNameElem) navUserNameElem.textContent = currentUser.name;
  if (navAvatarElem) {
    navAvatarElem.src = currentUser.avatarUrl;
    navAvatarElem.alt = currentUser.name;
  }
  if (profileNavAvatar) profileNavAvatar.src = currentUser.avatarUrl;
  if (profileNavName) profileNavName.textContent = currentUser.name;
  if (profileNameElem) profileNameElem.textContent = currentUser.name;
  if (profileEmailElem) profileEmailElem.textContent = currentUser.email;
  if (profileAvatarElem) profileAvatarElem.src = currentUser.avatarUrl;
  if (feedbackNameInput) {
    feedbackNameInput.value = currentUser.name;
    feedbackNameInput.disabled = true;
  }
}

// Update UI to logged-out state
function updateUIForLoggedOut() {
  if (loginBtn) loginBtn.style.display = "inline-block";
  if (userMenu) userMenu.style.display = "none";
  if (navUserNameElem) navUserNameElem.textContent = "";
  if (navAvatarElem) navAvatarElem.src = "";
  if (profileNavAvatar) profileNavAvatar.src = "";
  if (profileNavName) profileNavName.textContent = "";
  if (profileNameElem) profileNameElem.textContent = "";
  if (profileEmailElem) profileEmailElem.textContent = "";
  if (profileAvatarElem) profileAvatarElem.src = "";
  if (feedbackNameInput) {
    feedbackNameInput.value = "";
    feedbackNameInput.disabled = false;
  }
}

// Handle Google Sign-In initialization and callback
if (typeof google !== "undefined" && googleSignInDiv) {
  google.accounts.id.initialize({
    client_id: "609784004025-li543jevd5e9u3a58ihvr98a2jpqfb8b.apps.googleusercontent.com",
    callback: async (response) => {
      // Called after Google sign-in, with the ID token in response.credential
      try {
        const res = await fetch(`${API_BASE}/api/auth/google-signin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: response.credential })
        });
        const data = await res.json();
        if (res.ok) {
          currentToken = data.token;
          currentUser = data.user;
          localStorage.setItem("token", currentToken);
          localStorage.setItem("user", JSON.stringify(currentUser));
          updateUIForLoggedIn();
          closeAuthModal();
          showToast(`Logged in as ${currentUser.name}`);
        } else {
          showToast(data.message || "Google login failed.", true);
        }
      } catch (err) {
        console.error("Google login error:", err);
        showToast("Google login error: " + err.message, true);
      }
    }
  });
  google.accounts.id.renderButton(googleSignInDiv, { theme: "outline", size: "large", text: "signin_with" });
}

// Modal controls
function openAuthModal() {
  if (authModal) authModal.style.display = "block";
}
function closeAuthModal() {
  if (authModal) authModal.style.display = "none";
}
if (loginBtn) {
  loginBtn.onclick = () => {
    openAuthModal();
    if (loginFormDiv) loginFormDiv.style.display = "block";
    if (signupFormDiv) signupFormDiv.style.display = "none";
  };
}
if (authModalClose) {
  authModalClose.onclick = () => {
    closeAuthModal();
  };
}
// Switch between login and signup form in modal
if (switchToSignupLink) {
  switchToSignupLink.onclick = (e) => {
    e.preventDefault();
    if (loginFormDiv) loginFormDiv.style.display = "none";
    if (signupFormDiv) signupFormDiv.style.display = "block";
  };
}
if (switchToLoginLink) {
  switchToLoginLink.onclick = (e) => {
    e.preventDefault();
    if (loginFormDiv) loginFormDiv.style.display = "block";
    if (signupFormDiv) signupFormDiv.style.display = "none";
  };
}
// Forgot Password
if (forgotPasswordLink) {
  forgotPasswordLink.onclick = (e) => {
    e.preventDefault();
    const email = prompt("Enter your email to reset password:");
    if (email) {
      fetch(`${API_BASE}/api/auth/request-password-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      })
      .then(res => res.json())
      .then(data => {
        // Always show a success message even if email not found (to avoid email enumeration)
        showToast(data.message || "If that email is registered, a reset link has been sent.");
      })
      .catch(err => {
        console.error("Password reset request error:", err);
        showToast("Error sending password reset email.", true);
      });
    }
  };
}

// Login form submission
if (loginSubmitBtn) {
  loginSubmitBtn.onclick = async () => {
    const email = loginEmailInput.value.trim();
    const password = loginPasswordInput.value;
    if (!email || !password) {
      showToast("Please enter email and password.", true);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok) {
        currentToken = data.token;
        currentUser = data.user;
        localStorage.setItem("token", currentToken);
        localStorage.setItem("user", JSON.stringify(currentUser));
        updateUIForLoggedIn();
        closeAuthModal();
        showToast(`Welcome back, ${currentUser.name}!`);
      } else {
        showToast(data.message || "Login failed.", true);
      }
    } catch (err) {
      console.error("Login error:", err);
      showToast("Login request error.", true);
    }
  };
}

// Signup form submission
if (signupSubmitBtn) {
  signupSubmitBtn.onclick = async () => {
    const name = signupNameInput.value.trim();
    const email = signupEmailInput.value.trim();
    const password = signupPasswordInput.value;
    if (!name || !email || !password) {
      showToast("All fields are required.", true);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password })
      });
      const data = await res.json();
      if (res.ok) {
        currentToken = data.token;
        currentUser = data.user;
        localStorage.setItem("token", currentToken);
        localStorage.setItem("user", JSON.stringify(currentUser));
        updateUIForLoggedIn();
        closeAuthModal();
        showToast(`Account created! Logged in as ${currentUser.name}`);
      } else {
        showToast(data.message || "Sign-up failed.", true);
      }
    } catch (err) {
      console.error("Signup error:", err);
      showToast("Sign-up request error.", true);
    }
  };
}

// Logout
if (logoutLink) {
  logoutLink.onclick = (e) => {
    e.preventDefault();
    currentUser = null;
    currentToken = null;
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    updateUIForLoggedOut();
    showToast("Logged out successfully.");
    // If on profile page, redirect to home on logout
    if (window.location.pathname.includes("profile.html")) {
      window.location.href = "index.html";
    }
  };
}

// Character count for feedback textarea
if (feedbackText && charCountElem) {
  feedbackText.oninput = () => {
    charCountElem.textContent = feedbackText.value.length;
  };
}

// Star rating hover and click behavior
if (starRatingElems) {
  starRatingElems.forEach(star => {
    star.addEventListener('mouseover', () => {
      const val = Number(star.getAttribute('data-value'));
      highlightStars(val);
    });
    star.addEventListener('mouseout', () => {
      // on mouse out, revert to the current selected rating
      highlightStars(selectedRating);
    });
    star.addEventListener('click', () => {
      const val = Number(star.getAttribute('data-value'));
      selectedRating = val;
      ratingValueInput.value = val;
      highlightStars(val);
    });
  });
}
function highlightStars(rating) {
  starRatingElems.forEach(star => {
    const starVal = Number(star.getAttribute('data-value'));
    if (starVal <= rating) {
      star.textContent = '★';  // filled star
      star.classList.add('active');
    } else {
      star.textContent = '☆';  // empty star
      star.classList.remove('active');
    }
  });
}

// Submit feedback form
if (feedbackForm) {
  feedbackForm.onsubmit = async (e) => {
    e.preventDefault();
    if (!selectedRating) {
      showToast("Please select a star rating.", true);
      return;
    }
    const feedbackContent = feedbackText.value.trim();
    const nameVal = feedbackNameInput ? feedbackNameInput.value.trim() : "";
    if (!feedbackContent) {
      showToast("Feedback text cannot be empty.", true);
      return;
    }
    // Show spinner on submit button
    submitBtnText.style.display = "none";
    submitBtnSpinner.style.display = "inline-block";
    try {
      const res = await fetch(`${API_BASE}/api/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(currentToken ? { "Authorization": `Bearer ${currentToken}` } : {})
        },
        body: JSON.stringify({ feedback: feedbackContent, rating: selectedRating })
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Thank you for your feedback!");
        // Reset form fields
        if (feedbackText) feedbackText.value = "";
        if (charCountElem) charCountElem.textContent = "0";
        selectedRating = 0;
        highlightStars(0);
        ratingValueInput.value = "";
        // Append the new feedback to the list (using data.feedback or our own object)
        const newFeedback = data.feedback || {
          _id: data.id,  // assume backend might return the saved feedback
          name: currentUser ? currentUser.name : nameVal,
          avatarUrl: currentUser ? currentUser.avatarUrl : "",
          rating: selectedRating,
          feedback: feedbackContent,
          timestamp: new Date().toISOString(),
          userId: currentUser ? currentUser.userId : null
        };
        appendFeedbackItem(newFeedback);
      } else {
        showToast(data.message || "Failed to submit feedback.", true);
      }
    } catch (err) {
      console.error("Feedback submit error:", err);
      showToast("Error submitting feedback.", true);
    } finally {
      submitBtnSpinner.style.display = "none";
      submitBtnText.style.display = "inline";
    }
  };
}

// Function to create and append a feedback item in the list
function appendFeedbackItem(item) {
  if (!feedbackListElem) return;
  const itemDiv = document.createElement('div');
  itemDiv.className = 'feedback-item';
  // Avatar image
  const avatarImg = document.createElement('img');
  avatarImg.className = 'avatar';
  avatarImg.src = item.avatarUrl && item.avatarUrl !== '' ? item.avatarUrl : 'https://via.placeholder.com/50?text=?';
  avatarImg.alt = item.name || "Avatar";
  // Content container
  const contentDiv = document.createElement('div');
  contentDiv.className = 'feedback-content';
  // Header (name, rating, date)
  const headerDiv = document.createElement('div');
  headerDiv.className = 'feedback-header';
  const nameSpan = document.createElement('span');
  nameSpan.className = 'name';
  nameSpan.textContent = item.name || "Anonymous";
  const ratingSpan = document.createElement('span');
  ratingSpan.className = 'rating-display';
  const rating = item.rating || 0;
  ratingSpan.textContent = ' ' + '★'.repeat(rating) + '☆'.repeat(5 - rating);
  const dateSpan = document.createElement('span');
  dateSpan.className = 'date';
  dateSpan.textContent = item.timestamp ? formatDate(item.timestamp) : '';
  headerDiv.appendChild(nameSpan);
  headerDiv.appendChild(ratingSpan);
  headerDiv.appendChild(dateSpan);
  // Comment text
  const commentDiv = document.createElement('div');
  commentDiv.className = 'comment';
  commentDiv.textContent = item.feedback || '';
  // Actions (edit/delete if owned by current user)
  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'actions';
  if (currentUser && item.userId && currentUser.userId === (item.userId._id || item.userId)) {
    // Edit button
    const editBtn = document.createElement('button');
    editBtn.textContent = "Edit";
    editBtn.onclick = () => {
      // Populate form with this item's content for editing
      if (feedbackNameInput) feedbackNameInput.value = currentUser.name;
      if (feedbackText) {
        feedbackText.value = item.feedback;
        charCountElem.textContent = String(item.feedback.length);
      }
      selectedRating = item.rating;
      highlightStars(item.rating);
      ratingValueInput.value = item.rating;
      submitBtnText.textContent = "Update Feedback";
      feedbackForm.setAttribute('data-edit-id', item._id || item.id);
      // Scroll up to the form (if needed)
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = "Delete";
    deleteBtn.onclick = async () => {
      if (!confirm("Are you sure you want to delete this feedback?")) return;
      try {
        const res = await fetch(`${API_BASE}/api/feedback/${item._id || item.id}`, {
          method: "DELETE",
          headers: {
            ...(currentToken ? { "Authorization": `Bearer ${currentToken}` } : {})
          }
        });
        const data = await res.json();
        if (res.ok) {
          showToast("Feedback deleted.");
          feedbackListElem.removeChild(itemDiv);
        } else {
          showToast(data.message || "Failed to delete feedback.", true);
        }
      } catch (err) {
        console.error("Delete feedback error:", err);
        showToast("Error deleting feedback.", true);
      }
    };
    actionsDiv.appendChild(editBtn);
    actionsDiv.appendChild(deleteBtn);
  }
  // Assemble feedback item
  contentDiv.appendChild(headerDiv);
  contentDiv.appendChild(commentDiv);
  contentDiv.appendChild(actionsDiv);
  itemDiv.appendChild(avatarImg);
  itemDiv.appendChild(contentDiv);
  feedbackListElem.prepend(itemDiv);  // add to top of list
}

// Load feedback list from server (for main page)
async function loadFeedbackList() {
  if (!feedbackListElem) return;
  try {
    const res = await fetch(`${API_BASE}/api/feedbacks`);
    const data = await res.json();
    if (res.ok) {
      feedbackListElem.innerHTML = "";
      data.forEach(fb => appendFeedbackItem(fb));
    } else {
      console.error("Error loading feedbacks:", data);
    }
  } catch (err) {
    console.error("Network error loading feedbacks:", err);
  }
}

// Avatar upload handling (profile page)
if (uploadAvatarBtn) {
  uploadAvatarBtn.onclick = async () => {
    const file = avatarInput.files[0];
    if (!file) {
      showToast("No file selected for upload.", true);
      return;
    }
    avatarUploadSpinner.style.display = "inline-block";
    const formData = new FormData();
    formData.append("avatar", file);
    try {
      const res = await fetch(`${API_BASE}/api/user/upload-avatar`, {
        method: "POST",
        headers: {
          ...(currentToken ? { "Authorization": `Bearer ${currentToken}` } : {})
        },
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        // Update avatar in UI
        if (profileAvatarElem) profileAvatarElem.src = data.avatarUrl;
        if (profileNavAvatar) profileNavAvatar.src = data.avatarUrl;
        if (navAvatarElem) navAvatarElem.src = data.avatarUrl;
        // Update local user data
        if (currentUser) {
          currentUser.avatarUrl = data.avatarUrl;
          localStorage.setItem("user", JSON.stringify(currentUser));
        }
        showToast("Avatar updated successfully!");
      } else {
        showToast(data.message || "Avatar upload failed.", true);
      }
    } catch (err) {
      console.error("Avatar upload error:", err);
      showToast("Error uploading avatar.", true);
    } finally {
      avatarUploadSpinner.style.display = "none";
      avatarInput.value = ""; // reset file input
    }
  };
}

// Password reset form submission (reset-password.html)
if (resetForm) {
  resetForm.onsubmit = async (e) => {
    e.preventDefault();
    const newPass = newPasswordInput.value;
    const confirmPass = confirmPasswordInput.value;
    if (newPass !== confirmPass) {
      resetMessageElem.textContent = "Passwords do not match.";
      resetMessageElem.style.color = "red";
      return;
    }
    // Get reset token from URL query params
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (!token) {
      resetMessageElem.textContent = "Invalid or expired reset token.";
      resetMessageElem.style.color = "red";
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: newPass, confirmPassword: confirmPass })
      });
      const data = await res.json();
      if (res.ok) {
        resetMessageElem.textContent = data.message || "Password reset successful! You can now log in with your new password.";
        resetMessageElem.style.color = "green";
      } else {
        resetMessageElem.textContent = data.message || "Failed to reset password.";
        resetMessageElem.style.color = "red";
      }
    } catch (err) {
      console.error("Reset password error:", err);
      resetMessageElem.textContent = "Error resetting password.";
      resetMessageElem.style.color = "red";
    }
  };
}

// On page load, initialize state and data
document.addEventListener('DOMContentLoaded', () => {
  // Restore session if token in storage
  const storedToken = localStorage.getItem("token");
  const storedUser = localStorage.getItem("user");
  if (storedToken && storedUser) {
    currentToken = storedToken;
    try {
      currentUser = JSON.parse(storedUser);
    } catch (e) {
      currentUser = null;
    }
    // Verify token validity (optional step)
    if (currentToken) {
      fetch(`${API_BASE}/api/auth/me`, { headers: { "Authorization": `Bearer ${currentToken}` } })
        .then(res => res.ok ? res.json() : Promise.reject())
        .then(data => {
          currentUser = data;
          localStorage.setItem("user", JSON.stringify(currentUser));
          updateUIForLoggedIn();
        })
        .catch(() => {
          // Token invalid/expired
          currentToken = null;
          currentUser = null;
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          updateUIForLoggedOut();
        });
    }
    if (currentUser) {
      updateUIForLoggedIn();
    }
  } else {
    updateUIForLoggedOut();
  }
  // Load feedback list if on the main page
  if (feedbackListElem) {
    loadFeedbackList();
  }
});