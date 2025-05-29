// ==== CONSTANTS ====
const API_BASE = "https://nobita-feedback-app-online.onrender.com";
const CLOUDINARY_BASE = "https://res.cloudinary.com/dyv7xav3e/image/upload/";
const GOOGLE_CLIENT_ID = "609784004025-li543jevd5e9u3a58ihvr98a2jpqfb8b.apps.googleusercontent.com";
const ADMIN_AVATAR = CLOUDINARY_BASE + "v1716910018/admin_avatar.png";

// ==== GLOBAL STATE ====
let currentUser = null;
let jwt = localStorage.getItem("token") || "";
let feedbackPage = 1, feedbackHasMore = true, feedbackList = [], searchActive = false;
let feedbackBusy = false;
let notifList = [], notifUnread = 0;
let lang = localStorage.getItem("lang") || "en";
let theme = localStorage.getItem("theme") || "light";

// ==== INIT ====
document.addEventListener("DOMContentLoaded", async () => {
  if (theme === "dark") document.body.classList.add("dark-theme");
  lucide.createIcons();

  // Theme Toggle
  document.getElementById("theme-toggle").onclick = () => {
    theme = theme === "light" ? "dark" : "light";
    document.body.classList.toggle("dark-theme", theme === "dark");
    localStorage.setItem("theme", theme);
    updateThemeIcon();
  };
  updateThemeIcon();
  function updateThemeIcon() {
    document.getElementById("theme-toggle").innerHTML = `<i data-lucide="${theme === 'dark' ? 'sun' : 'moon'}"></i>`;
    lucide.createIcons();
  }

  // Language Toggle
  document.getElementById("lang-toggle").onclick = () => {
    lang = lang === "en" ? "hi" : "en";
    localStorage.setItem("lang", lang);
    document.documentElement.lang = lang;
    setLangText();
    showToast("Language changed!", "success");
  };
  setLangText();
  function setLangText() {
    const t = {
      en: {
        greet: currentUser ? `Welcome, ${currentUser.name}!` : "Welcome to Nobita Feedback!",
        desc: "Share your thoughts, rate us, and help us grow better. ⭐",
        giveFeedback: "Give Feedback",
        showHow: "Show me how",
        feedbackLabel: "Feedback (Markdown supported)",
        submit: "Submit Feedback",
      },
      hi: {
        greet: currentUser ? `स्वागत है, ${currentUser?.name || "दोस्त"}!` : "Nobita Feedback में आपका स्वागत है!",
        desc: "अपने विचार साझा करें, हमें रेट करें, और सुधार में मदद करें। ⭐",
        giveFeedback: "फीडबैक दें",
        showHow: "कैसे करें देखें",
        feedbackLabel: "फीडबैक (मार्कडाउन सपोर्टेड)",
        submit: "फीडबैक सबमिट करें",
      }
    }[lang];
    document.getElementById("hero-greet").textContent = t.greet;
    document.getElementById("hero-desc").textContent = t.desc;
    document.getElementById("hero-feedback-btn").innerHTML = `<i data-lucide="edit"></i>${t.giveFeedback}`;
    document.getElementById("hero-tour-btn").innerHTML = `<i data-lucide="help-circle"></i>${t.showHow}`;
    document.querySelector("#feedback-form label").textContent = t.feedbackLabel;
    document.getElementById("submit-feedback-btn").innerHTML = `<i data-lucide="send"></i>${t.submit}`;
    lucide.createIcons();
  }

  document.getElementById("nav-logo").onclick = () => location.reload();

  document.getElementById("user-btn").onclick = openUserMenuOrLogin;
  document.getElementById("notif-bell-btn").onclick = openNotifDropdown;

  document.getElementById("hero-feedback-btn").onclick = () => document.getElementById("feedback-text").focus();
  document.getElementById("hero-tour-btn").onclick = startTour;

  setupFeedbackToolbar();
  document.getElementById("attach-btn").onclick = () => document.getElementById("attach-input").click();
  document.getElementById("attach-input").onchange = updateAttachPreview;

  setupFeedbackStars();
  document.getElementById("search-feedback").addEventListener("input", debounce(searchFeedback, 300));

  await loadUser();
  await loadStats();
  await loadFeedbackPage(1);

  setupInfiniteScroll();
  setupSocket();

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") { closeModal(); closeDropdowns(); }
  });

  lucide.createIcons();
});

// ==== USER AUTH, PROFILE, LOGIN ====
async function loadUser() {
  if (!jwt) { setGuestUI(); return; }
  try {
    const res = await fetch(`${API_BASE}/api/user/me`, { headers: { Authorization: `Bearer ${jwt}` } });
    if (!res.ok) throw 0;
    currentUser = await res.json();
    setUserUI();
  } catch (e) {
    jwt = ""; localStorage.removeItem("token");
    setGuestUI();
  }
  setLangText();
}
function setGuestUI() {
  currentUser = null;
  document.getElementById("user-btn").innerHTML = `<i data-lucide="user"></i>`;
  lucide.createIcons();
}
function setUserUI() {
  document.getElementById("user-btn").innerHTML =
    `<img src="${currentUser.avatar || 'https://api.dicebear.com/8.x/adventurer/svg?seed=guest&radius=50'}"
      alt="User Avatar" class="navbar-avatar" id="user-avatar-in-navbar" />`;
  lucide.createIcons();
}

// ==== MODAL/DROPDOWN OPEN/CLOSE ====
function closeModal() {
  const root = document.getElementById("modal-root");
  root.innerHTML = "";
}
function showModal(contentHTML, { size = "default" } = {}) {
  closeModal();
  const root = document.getElementById("modal-root");
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.tabIndex = -1;
  overlay.onclick = e => { if (e.target === overlay) closeModal(); };
  overlay.innerHTML = `<div class="modal" style="max-width:${size==="large"?"520px":"410px"};position:relative;">
    <button class="close-btn" aria-label="Close" onclick="closeModal()"><i data-lucide='x'></i></button>
    <div>${contentHTML}</div>
  </div>`;
  root.appendChild(overlay); lucide.createIcons();
}
function closeDropdowns() {
  document.getElementById("user-dropdown").classList.add("hidden");
  document.getElementById("notif-dropdown").classList.add("hidden");
}
document.body.addEventListener("click", (e) => {
  if (!e.target.closest('.dropdown-menu') && !e.target.closest('#user-btn') && !e.target.closest('#notif-bell-btn'))
    closeDropdowns();
});

// ==== USER MENU / PROFILE MODAL ====
function openUserMenuOrLogin(e) {
  closeDropdowns();
  if (!currentUser) return openLoginModal();
  const menu = document.getElementById("user-dropdown");
  menu.innerHTML = `
    <div class="menu-item" onclick="openProfileModal()"><i data-lucide="user-round"></i>View Profile</div>
    <div class="menu-item" onclick="logout()"><i data-lucide="log-out"></i>Logout</div>
    ${currentUser.role==="admin"?'<div class="menu-divider"></div><div class="menu-item" onclick="openAdminPanel()"><i data-lucide="settings"></i>Admin Panel</div>':''}
  `;
  menu.classList.remove("hidden"); lucide.createIcons();
}
function openNotifDropdown() {
  closeDropdowns();
  const menu = document.getElementById("notif-dropdown");
  menu.innerHTML = notifList.length === 0
    ? `<div class="menu-item" style="color:#aaa;">No notifications.</div>`
    : notifList.map(n => `
      <div class="menu-item${n.read?'':' notif-unread'}" onclick="markNotifRead('${n._id}', '${n.link||""}')">
        <i data-lucide="${n.type==="admin_reply"?'message-circle':'bell'}"></i>
        <span>${n.text}</span>
        <span style="margin-left:auto;font-size:.93em;color:#999;">${formatTime(n.createdAt)}</span>
      </div>
    `).join('');
  menu.classList.remove("hidden"); lucide.createIcons();
}
async function markNotifRead(id, link) {
  await fetch(`${API_BASE}/api/notifications/read/${id}`, { method:"POST", headers:{Authorization:`Bearer ${jwt}`}});
  notifList = notifList.map(n=> n._id===id ? {...n,read:true} : n);
  notifUnread = notifList.filter(n=>!n.read).length;
  updateNotifBadge();
  if(link) { location.hash = link; closeDropdowns();}
}
function updateNotifBadge() {
  const badge = document.getElementById("notif-badge");
  badge.textContent = notifUnread;
  badge.classList.toggle("hidden", notifUnread==0);
}
function openProfileModal() {
  showModal(`
    <div style="text-align:center;">
      <div style="position:relative;display:inline-block;">
        <img src="${currentUser.avatar}" class="navbar-avatar" style="width:74px;height:74px;border:3.5px solid #9fa7fd;" alt="User avatar" />
        ${currentUser.role==='admin'?'<i data-lucide="shield" title="Admin" style="position:absolute;bottom:-2px;right:-8px;width:26px;height:26px;color:#3578e5;background:#fff;border-radius:50%;padding:2.5px;"></i>':''}
      </div>
      <div style="margin:18px 0 4px 0;font-family:var(--font-heading);font-weight:bold;font-size:2rem;line-height:1.15;">${currentUser.name}</div>
      <div style="color:#8a91b3;font-size:1.15em;display:flex;align-items:center;justify-content:center;gap:6px;">
        <span>${currentUser.email}</span>
        <button class="nav-icon-btn" style="padding:4px;" onclick="copyText('${currentUser.email}',this)" aria-label="Copy email"><i data-lucide="copy"></i></button>
      </div>
      <div style="margin:8px 0 20px 0;font-size:.99rem;color:#b2b3c6;">Joined ${formatJoinDate(currentUser.joinedOn)}</div>
      <button class="primary-btn" onclick="openEditProfileModal()" style="width:96%;">Edit Information</button>
    </div>
  `, {size:"large"});
  lucide.createIcons();
}
function formatJoinDate(date) {
  const d = new Date(date);
  return d.toLocaleDateString("en-IN",{year:'numeric',month:'long',day:'numeric'});
}
function copyText(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    btn.innerHTML = `<i data-lucide="check"></i>`;
    setTimeout(()=>{btn.innerHTML=`<i data-lucide="copy"></i>`;lucide.createIcons();},800);
    showToast("Email copied!","success");
    lucide.createIcons();
  });
}

// ==== LOGIN/SIGNUP MODAL ====
function openLoginModal() {
  showModal(`
    <h2 style="text-align:center;font-family:var(--font-heading);font-size:2rem;margin-bottom:14px;">Login to Nobita</h2>
    <form id="login-form" autocomplete="on">
      <div style="margin-bottom:18px;">
        <div style="position:relative;">
          <input type="email" id="login-email" autocomplete="username" required style="padding:1em 1.2em;width:100%;font-size:1.07rem;border-radius:8px;border:1.2px solid #d1d5db;background:var(--bg-glass-light);" />
          <label for="login-email" style="position:absolute;left:1.2em;top:.7em;pointer-events:none;color:#8a91b3;transition:.18s;">Email</label>
        </div>
      </div>
      <div style="margin-bottom:15px;">
        <div style="position:relative;">
          <input type="password" id="login-pass" autocomplete="current-password" required style="padding:1em 3em 1em 1.2em;width:100%;font-size:1.07rem;border-radius:8px;border:1.2px solid #d1d5db;background:var(--bg-glass-light);" />
          <label for="login-pass" style="position:absolute;left:1.2em;top:.7em;pointer-events:none;color:#8a91b3;transition:.18s;">Password</label>
          <button type="button" id="toggle-login-pw" class="nav-icon-btn" style="position:absolute;right:7px;top:9px;padding:4px;" tabindex="0" aria-label="Show password"><i data-lucide="eye"></i></button>
        </div>
      </div>
      <button type="submit" class="primary-btn" style="width:100%;">Login</button>
      <div style="text-align:center;margin:18px 0 0 0;color:#8a91b3;font-size:.98rem;">or</div>
      <button type="button" class="primary-btn" id="google-login-btn" style="margin-top:18px;width:100%;background:#fff;border:2px solid #2979f5;color:#222;">
        <img src="https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg" style="width:22px;margin-right:13px;">Sign in with Google
      </button>
    </form>
    <div style="text-align:center;margin-top:15px;">
      <a href="#" onclick="openSignupModal();return false;" style="color:var(--primary);font-weight:500;">Create new account</a>
      <span style="color:#a6a6bc;"> | </span>
      <a href="#" onclick="openForgotModal();return false;" style="color:var(--primary);font-weight:500;">Forgot password?</a>
    </div>
  `);
  lucide.createIcons();
  const email = document.getElementById("login-email"), pass = document.getElementById("login-pass");
  const emailLabel = email.nextElementSibling, passLabel = pass.nextElementSibling;
  email.onfocus = () => emailLabel.style.top = "-1.2em";
  email.onblur = () => email.value ? emailLabel.style.top = "-1.2em" : emailLabel.style.top = ".7em";
  pass.onfocus = () => passLabel.style.top = "-1.2em";
  pass.onblur = () => pass.value ? passLabel.style.top = "-1.2em" : passLabel.style.top = ".7em";
  document.getElementById("toggle-login-pw").onclick = function() {
    pass.type = pass.type === "password" ? "text" : "password";
    this.innerHTML = `<i data-lucide="${pass.type==='password'?'eye':'eye-off'}"></i>`;
    lucide.createIcons();
  };
  document.getElementById("google-login-btn").onclick = () => {
    window.location = `${API_BASE}/api/auth/google?redirect=${encodeURIComponent(window.location.href)}`;
  };
  document.getElementById("login-form").onsubmit = async function(e) {
    e.preventDefault();
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.value, password: pass.value })
    });
    const data = await res.json();
    if (res.ok && data.token) {
      localStorage.setItem("token", data.token); jwt = data.token;
      closeModal(); showToast("Logged in!","success");
      await loadUser();
    } else {
      showToast(data?.message || "Login failed. Check credentials.", "error");
    }
  };
}
// TODO: Implement openSignupModal() and openForgotModal() with similar structure if needed

function logout() {
  jwt = ""; localStorage.removeItem("token"); currentUser = null;
  setGuestUI(); showToast("Logged out.", "success");
}

// ==== PROFILE EDIT MODAL ====
function openEditProfileModal() {
  showModal(`
    <form id="edit-profile-form" enctype="multipart/form-data" style="display:flex;flex-direction:column;align-items:center;gap:22px;">
      <div style="position:relative;">
        <label for="avatar-upload-input">
          <img src="${currentUser.avatar}" id="edit-avatar-img" class="navbar-avatar" style="width:84px;height:84px;border:3px solid #2979f5;cursor:pointer;" alt="User avatar" />
          <span style="position:absolute;bottom:0;right:0;"><i data-lucide="cloud-upload"></i></span>
        </label>
        <input type="file" id="avatar-upload-input" accept="image/*" style="display:none;" />
      </div>
      <div>
        <label style="display:block;font-size:1.08rem;margin-bottom:4px;">Name</label>
        <input id="edit-name" type="text" value="${currentUser.name}" required style="padding:.9em 1.2em;width:230px;font-size:1.08rem;border-radius:9px;border:1.2px solid #c8d0ef;background:var(--bg-glass-light);" />
      </div>
      <div>
        <label style="display:block;font-size:1.08rem;margin-bottom:4px;">Email</label>
        <input type="text" value="${currentUser.email}" disabled style="padding:.9em 1.2em;width:230px;font-size:1.08rem;border-radius:9px;border:1.2px solid #c8d0ef;background:#f1f1f1;opacity:.7;" />
      </div>
      <button type="button" class="primary-btn" id="edit-password-btn"><i data-lucide="key"></i>Change Password</button>
      <button type="submit" class="primary-btn" style="margin-top:7px;">Save Changes</button>
    </form>
  `, {size:"large"});
  lucide.createIcons();
  document.getElementById("avatar-upload-input").onchange = async function() {
    const file = this.files[0];
    if (!file) return showToast("No file selected!", "error");
    const formData = new FormData();
    formData.append("avatar", file);
    showToast("Uploading avatar...","info");
    const res = await fetch(`${API_BASE}/api/user/upload-avatar`, {
      method: "POST", headers: { Authorization: `Bearer ${jwt}` }, body: formData
    });
    const data = await res.json();
    if (res.ok && data.avatarUrl) {
      document.getElementById("edit-avatar-img").src = data.avatarUrl;
      currentUser.avatar = data.avatarUrl;
      setUserUI();
      showToast("Avatar updated!","success");
    } else showToast(data.message||"Failed to upload avatar.","error");
  };
  document.getElementById("edit-profile-form").onsubmit = async function(e) {
    e.preventDefault();
    const name = document.getElementById("edit-name").value.trim();
    if (!name) return showToast("Name cannot be empty","error");
    const res = await fetch(`${API_BASE}/api/user/update-name`, {
      method:"PATCH", headers:{Authorization:`Bearer ${jwt}`,"Content-Type":"application/json"},
      body:JSON.stringify({ name })
    });
    if (res.ok) {
      currentUser.name = name;
      setUserUI(); setLangText();
      showToast("Name updated!","success");
      closeModal();
    } else showToast("Failed to update name","error");
  };
  document.getElementById("edit-password-btn").onclick = () => openChangePasswordModal();
}
function openChangePasswordModal() {
  showModal(`
    <form id="change-pass-form" style="display:flex;flex-direction:column;gap:14px;">
      <div>
        <label>Current Password</label>
        <input id="curr-pass" type="password" required style="width:100%;padding:.8em 1.2em;border-radius:7px;border:1.2px solid #d1d5db;background:var(--bg-glass-light);" />
      </div>
      <div>
        <label>New Password</label>
        <input id="new-pass" type="password" required style="width:100%;padding:.8em 1.2em;border-radius:7px;border:1.2px solid #d1d5db;background:var(--bg-glass-light);" />
      </div>
      <div>
        <label>Confirm New Password</label>
        <input id="conf-pass" type="password" required style="width:100%;padding:.8em 1.2em;border-radius:7px;border:1.2px solid #d1d5db;background:var(--bg-glass-light);" />
      </div>
      <button class="primary-btn" style="margin-top:7px;">Save Changes</button>
    </form>
  `);
  document.getElementById("change-pass-form").onsubmit = async function(e){
    e.preventDefault();
    const curr=document.getElementById("curr-pass").value;
    const np=document.getElementById("new-pass").value;
    const cp=document.getElementById("conf-pass").value;
    if(np.length<6) return showToast("Password too short","error");
    if(np!==cp) return showToast("Passwords do not match","error");
    const res = await fetch(`${API_BASE}/api/user/change-password`, {
      method:"PATCH",headers:{Authorization:`Bearer ${jwt}`,"Content-Type":"application/json"},
      body:JSON.stringify({currentPassword:curr,newPassword:np})
    });
    if(res.ok){ showToast("Password changed!","success"); setTimeout(closeModal,2000);}
    else showToast("Wrong password or error.","error");
  };
}

// ==== TOASTS ====
function showToast(msg, type = "info") {
  const icons = {success:"check-circle",error:"alert-triangle",info:"info",warn:"alert-circle"};
  const toast = document.createElement("div");
  toast.style = `background:${type=="success"?"#22c55e":type=="error"?"#ef4444":type=="warn"?"#fbbf24":"#6366f1"};color:#fff;padding:1em 1.6em;border-radius:14px;box-shadow:0 6px 22px #0002;font-size:1.09rem;display:flex;align-items:center;gap:14px;min-width:155px;animation:fadeInDropdown .19s;`;
  toast.innerHTML = `<i data-lucide="${icons[type]||'info'}"></i> <span>${msg}</span>`;
  document.getElementById("toast-container").appendChild(toast);
  lucide.createIcons();
  setTimeout(()=>toast.remove(), 3200);
}

// ==== FEEDBACK (submission, render, edit/delete, rating, search, infinite scroll, etc.) ====
// [Paste the full PART 5 code here, as previously given, including setupFeedbackStars, updateAttachPreview, setupFeedbackToolbar, loadStats, setOverallRating, loadFeedbackPage, renderFeedbackList, prependFeedbackCard, renderFeedbackCard, renderAdminReply, formatTime, debounce, searchFeedback, setupInfiniteScroll, openShareModal, confirmDeleteFeedback, deleteFeedback, startTour, setupSocket, etc.]
// (Due to length, not re-pasting here, but you already have the PART 5 code above! If you want, I can send full PART 5 code again here, just bolo.)

// ---------------
// === FEEDBACK STAR RATING (Form) ===
function setupFeedbackStars() {
  const starsDiv = document.getElementById("feedback-stars");
  starsDiv.innerHTML = "";
  let rating = 0;
  for (let i = 1; i <= 5; i++) {
    const star = document.createElement("i");
    star.setAttribute("data-lucide", "star");
    star.setAttribute("aria-label", `${i} star`);
    star.style.cursor = "pointer";
    star.style.width = "30px";
    star.style.height = "30px";
    star.style.transition = "color .19s";
    star.onmouseenter = () => highlightStars(i);
    star.onclick = () => { rating = i; highlightStars(i); };
    starsDiv.appendChild(star);
  }
  starsDiv.onmouseleave = () => highlightStars(rating);
  highlightStars(0);

  // Save selected rating on submit
  document.getElementById("feedback-form").onsubmit = async function (e) {
    e.preventDefault();
    if (!jwt) return showToast("Login required to submit feedback.", "error");
    if (!rating) return showToast("Select rating stars!", "error");
    const text = document.getElementById("feedback-text").value.trim();
    if (text.length < 2) return showToast("Enter your feedback.", "error");
    // Attachments
    let attachUrl = "";
    const attachFile = document.getElementById("attach-input").files[0];
    if (attachFile) {
      const formData = new FormData();
      formData.append("file", attachFile);
      showToast("Uploading file...", "info");
      const res = await fetch(`${API_BASE}/api/feedback/upload-attachment`, {
        method: "POST",
        headers: { Authorization: `Bearer ${jwt}` },
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.url) {
        attachUrl = data.url;
      } else {
        showToast(data.message || "Attachment failed", "error");
        return;
      }
    }
    // Anonymous?
    const isAnon = document.getElementById("anon-toggle").checked;
    // Submit feedback
    const payload = {
      rating, text,
      attachment: attachUrl,
      anonymous: isAnon
    };
    const res = await fetch(`${API_BASE}/api/feedback/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok) {
      showToast("Feedback submitted!", "success");
      prependFeedbackCard(data.feedback);
      document.getElementById("feedback-form").reset();
      setupFeedbackStars(); // reset stars
      document.getElementById("attach-preview").innerHTML = "";
    } else {
      showToast(data.message || "Submit failed", "error");
    }
  };

  function highlightStars(count) {
    for (let i = 0; i < 5; i++) {
      starsDiv.children[i].style.color = i < count ? "#ffd600" : "#aaa";
      starsDiv.children[i].style.fill = i < count ? "#ffd600" : "none";
    }
    lucide.createIcons();
  }
}

function updateAttachPreview() {
  const input = document.getElementById("attach-input");
  const preview = document.getElementById("attach-preview");
  if (!input.files.length) return (preview.innerHTML = "");
  const file = input.files[0];
  let icon = "file";
  if (file.type.startsWith("image/")) icon = "image";
  if (file.name.endsWith(".pdf")) icon = "file-text";
  preview.innerHTML = `<i data-lucide="${icon}"></i> ${file.name}`;
  lucide.createIcons();
}

// === FEEDBACK TOOLBAR (BOLD, ITALIC, BULLET, EMOJI, CODE) ===
function setupFeedbackToolbar() {
  const textarea = document.getElementById("feedback-text");
  document.getElementById("feedback-bold-btn").onclick = () => insertAround(textarea, "**", "**");
  document.getElementById("feedback-italic-btn").onclick = () => insertAround(textarea, "*", "*");
  document.getElementById("feedback-bullet-btn").onclick = () => insertAtStart(textarea, "- ");
  document.getElementById("feedback-code-btn").onclick = () => insertAround(textarea, "`", "`");
  document.getElementById("feedback-emoji-btn").onclick = () => insertAtCursor(textarea, "😊");

  function insertAround(el, before, after) {
    const [s, e] = [el.selectionStart, el.selectionEnd];
    el.setRangeText(before + el.value.slice(s, e) + after, s, e, 'end');
    el.focus();
  }
  function insertAtStart(el, text) {
    const lines = el.value.split("\n");
    const idx = el.value.substr(0, el.selectionStart).split("\n").length - 1;
    lines[idx] = text + lines[idx];
    el.value = lines.join("\n");
    el.focus();
  }
  function insertAtCursor(el, text) {
    const [s, e] = [el.selectionStart, el.selectionEnd];
    el.setRangeText(text, s, e, 'end');
    el.focus();
  }
}

// === FEEDBACK LIST, OVERALL RATING, SEARCH, INFINITE SCROLL ===
async function loadStats() {
  // Overall rating & count
  const res = await fetch(`${API_BASE}/api/feedback/overall-rating`);
  const data = await res.json();
  if (res.ok) {
    setOverallRating(data.avg, data.count);
  }
}
function setOverallRating(avg, count) {
  const starsDiv = document.getElementById("overall-rating-stars");
  const valueDiv = document.getElementById("overall-rating-value");
  const countDiv = document.getElementById("overall-rating-count");
  starsDiv.innerHTML = "";
  for (let i = 1; i <= 5; i++) {
    const star = document.createElement("i");
    star.setAttribute("data-lucide", "star");
    star.style.color = i <= Math.round(avg) ? "#ffd600" : "#aaa";
    star.style.width = "36px";
    star.style.height = "36px";
    starsDiv.appendChild(star);
  }
  valueDiv.textContent = avg.toFixed(1);
  countDiv.textContent = `Based on ${count} feedbacks`;
  lucide.createIcons();
}
async function loadFeedbackPage(page = 1, search = "") {
  if (feedbackBusy) return;
  feedbackBusy = true;
  document.getElementById("load-more-spinner").style.display = "block";
  let url = `${API_BASE}/api/feedback/list?page=${page}`;
  if (search) url += `&query=${encodeURIComponent(search)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${jwt}` } });
  const data = await res.json();
  document.getElementById("load-more-spinner").style.display = "none";
  if (res.ok && data.feedbacks) {
    if (page === 1) feedbackList = [];
    feedbackList = feedbackList.concat(data.feedbacks);
    feedbackHasMore = data.hasMore;
    renderFeedbackList(feedbackList, page === 1);
  }
  feedbackBusy = false;
}
function renderFeedbackList(list, clear = true) {
  const container = document.getElementById("feedback-list");
  if (clear) container.innerHTML = "";
  for (const fb of list) {
    container.appendChild(renderFeedbackCard(fb));
  }
}
function prependFeedbackCard(fb) {
  const container = document.getElementById("feedback-list");
  container.insertBefore(renderFeedbackCard(fb), container.firstChild);
}
function renderFeedbackCard(fb) {
  const card = document.createElement("div");
  card.className = "glass";
  card.style = `padding:1.3em 1.6em;border-radius:var(--card-radius);box-shadow:0 2px 16px #6366f118;position:relative;`;
  // Avatar
  const avatar = fb.anonymous
    ? "https://api.dicebear.com/8.x/adventurer/svg?seed=anon&radius=50"
    : fb.user?.avatar || "https://api.dicebear.com/8.x/adventurer/svg?seed=guest&radius=50";
  // Stars
  const stars = Array.from({ length: 5 }).map((_, i) =>
    `<i data-lucide="star" style="color:${i < fb.rating ? "#ffd600" : "#aaa"};width:18px;height:18px;vertical-align:-3px;"></i>`
  ).join("");
  // Timestamp
  const ts = formatTime(fb.createdAt);
  // Name & badges
  const name = fb.anonymous ? "Anonymous" : fb.user?.name || "User";
  const badge = fb.user?.role === "admin"
    ? `<i data-lucide="shield" title="Admin" style="margin-left:7px;width:16px;height:16px;color:#3578e5;vertical-align:-3px;"></i>`
    : "";
  // Admin pin
  const pin = fb.pinned
    ? `<i data-lucide="star" style="position:absolute;top:13px;right:15px;color:#ffa726;width:23px;height:23px;" title="Pinned by admin"></i>`
    : "";
  // Attachments
  let attach = "";
  if (fb.attachment)
    attach = `<a href="${fb.attachment}" target="_blank" style="display:inline-flex;align-items:center;gap:4px;margin-top:6px;text-decoration:underline;">
      <i data-lucide="${fb.attachment.match(/\.(jpe?g|png|gif|bmp|webp)$/i) ? 'image' : 'file'}"></i>Attachment</a>`;
  // Edit/Delete
  const canEdit = currentUser && (currentUser._id === fb.user?._id || currentUser.role === "admin");
  // Feedback text: markdown rendered
  card.innerHTML = `
    <div style="display:flex;align-items:center;gap:17px;">
      <img src="${avatar}" style="width:50px;height:50px;border-radius:50%;border:2.5px solid #fff;box-shadow:0 0 0 2px #eceef8;" />
      <div style="flex:1;">
        <span style="font-family:var(--font-heading);font-weight:700;font-size:1.13rem;letter-spacing:-.5px;">
          ${name} ${badge}
        </span>
        <span style="margin-left:9px;font-size:.97em;color:#a7b4c7;">${ts}</span>
        <div style="margin-top:3px;">${stars}</div>
      </div>
      <div style="display:flex;gap:7px;">
        <button class="nav-icon-btn" aria-label="Share" onclick="openShareModal('${fb._id}')" title="Share"><i data-lucide="share-2"></i></button>
        ${canEdit ? `
        <button class="nav-icon-btn" aria-label="Edit" onclick="openEditFeedback('${fb._id}')" title="Edit"><i data-lucide="edit-3"></i></button>
        <button class="nav-icon-btn" aria-label="Delete" onclick="confirmDeleteFeedback('${fb._id}')" title="Delete"><i data-lucide="trash-2"></i></button>
        ` : ""}
      </div>
      ${pin}
    </div>
    <div style="margin:17px 0 6px 0;font-size:1.13rem;">${marked.parse(fb.text)}</div>
    ${attach}
    ${fb.adminReply ? renderAdminReply(fb.adminReply) : ""}
  `;
  lucide.createIcons();
  return card;
}
function renderAdminReply(reply) {
  const adminAvatar = ADMIN_AVATAR;
  return `
    <div style="margin-top:18px;background:#eef3fc;border-left:4px solid #2979f5;border-radius:9px;padding:10px 13px 10px 13px;display:flex;align-items:center;gap:12px;">
      <img src="${adminAvatar}" style="width:32px;height:32px;border-radius:50%;border:2px solid #fff;">
      <div>
        <div style="color:#3578e5;font-weight:bold;">Admin Response</div>
        <div style="font-size:1.06rem;margin-top:3px;">${marked.parse(reply.text)}</div>
      </div>
    </div>
  `;
}
function formatTime(date) {
  const d = new Date(date);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) +
    " " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

// === SEARCH ===
let searchTimeout = null;
function debounce(fn, t) {
  return (...a) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => fn.apply(this, a), t);
  };
}
function searchFeedback(e) {
  const q = e.target.value.trim();
  if (q.length > 0) {
    searchActive = true;
    loadFeedbackPage(1, q);
  } else {
    searchActive = false;
    loadFeedbackPage(1);
  }
}

// === INFINITE SCROLL ===
function setupInfiniteScroll() {
  const sentinel = document.getElementById("load-more-sentinel");
  new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && feedbackHasMore && !searchActive) {
      loadFeedbackPage(++feedbackPage);
    }
  }).observe(sentinel);
}

// === SHARE FEEDBACK ===
function openShareModal(feedbackId) {
  const link = window.location.origin + "/#feedback-" + feedbackId;
  showModal(`
    <div style="text-align:center;">
      <h3>Share Feedback</h3>
      <div style="margin:1.3em 0;">
        <input type="text" value="${link}" style="width:85%;padding:7px 12px;font-size:1.09em;border-radius:7px;border:1.2px solid #d1d5db;" id="share-link-inp" readonly />
        <button class="nav-icon-btn" onclick="copyText('${link}',this)" style="margin-left:8px;"><i data-lucide="copy"></i></button>
      </div>
      <div style="display:flex;justify-content:center;gap:18px;">
        <a href="https://wa.me/?text=${encodeURIComponent(link)}" target="_blank"><i data-lucide="message-circle"></i>WhatsApp</a>
        <a href="https://twitter.com/intent/tweet?url=${encodeURIComponent(link)}" target="_blank"><i data-lucide="twitter"></i>Twitter</a>
      </div>
    </div>
  `);
  lucide.createIcons();
}

// === ADMIN PANEL, PIN, REPLY, DELETE ===
function confirmDeleteFeedback(id) {
  showModal(`
    <div style="text-align:center;padding:2em 0;">
      <i data-lucide="alert-triangle" style="color:#ef4444;width:33px;height:33px;"></i>
      <div style="margin:1em 0;font-size:1.12rem;">Are you sure you want to delete this feedback?</div>
      <button class="primary-btn" style="margin-right:13px;" onclick="deleteFeedback('${id}')">Yes, Delete</button>
      <button class="secondary-btn" onclick="closeModal()">Cancel</button>
    </div>
  `);
  lucide.createIcons();
}
async function deleteFeedback(id) {
  const res = await fetch(`${API_BASE}/api/feedback/delete/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${jwt}` },
  });
  if (res.ok) {
    showToast("Feedback deleted!", "success");
    feedbackList = feedbackList.filter(fb => fb._id !== id);
    renderFeedbackList(feedbackList, true);
    closeModal();
  } else showToast("Delete failed", "error");
}

// === ONBOARDING TOUR ===
function startTour() {
  introJs().setOptions({
    steps: [
      { intro: "👋 Welcome to Nobita Feedback! Let’s explore the features." },
      { element: document.querySelector('.navbar-logo'), intro: "Click to always reload home." },
      { element: document.getElementById('user-btn'), intro: "Login or access your profile & logout here." },
      { element: document.getElementById('hero-feedback-btn'), intro: "Submit your valuable feedback!" },
      { element: document.getElementById('overall-rating-block'), intro: "See our average rating." },
      { element: document.getElementById('search-feedback'), intro: "Search through feedback instantly." },
      { element: document.getElementById('feedback-list'), intro: "See all feedbacks with replies, edit/delete if you own." }
    ]
  }).start();
}

// === SOCKET.IO NOTIFICATIONS (Real-Time) ===
function setupSocket() {
  if (!jwt) return;
  const socket = io(API_BASE, { transports: ["websocket"], auth: { token: jwt } });
  socket.on("connect", () => {});
  socket.on("new_notification", notif => {
    notifList.unshift(notif);
    notifUnread++;
    updateNotifBadge();
    showToast(notif.text, "info");
  });
}