// ui.js
// Is file mein saare generic UI helper functions hain

// Show Toast Notification Function
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) {
        console.warn('Toast container not found. Cannot show toast:', message);
        return;
    }
    
    // Agar 3 se zyada toasts hain, toh sabse purane ko hata dein
    if (container.children.length >= 3) {
        container.firstChild.remove();
    }

    const iconMap = {
        'success': 'fas fa-check-circle',
        'error': 'fas fa-exclamation-circle',
        'warning': 'fas fa-exclamation-triangle',
        'info': 'fas fa-info-circle'
    };
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    toast.innerHTML = `
        <i class="toast-icon ${iconMap[type] || 'fas fa-info-circle'}"></i>
        <div class="toast-content">
            <p class="toast-message">${message}</p>
        </div>
    `;

    container.appendChild(toast);

    setTimeout(() => { 
        toast.classList.add('hide');
        toast.addEventListener('transitionend', () => toast.remove());
    }, 4000);
}

// --- POPUP / PROMPT SYSTEM ---
function showPopup(content) {
  const popup = document.getElementById('popup');
  const popupContent = document.getElementById('popup-content');
  popupContent.innerHTML = content;
  popup.style.display = 'flex';
  // Agar image hai to popup-content transparent ho
  if (content.includes('<img')) {
    popupContent.style.background = 'transparent';
    popupContent.style.boxShadow = 'none';
  } else {
    popupContent.style.background = '#232336';
    popupContent.style.boxShadow = '0 8px 28px #0009';
  }
  // OUTSIDE CLICK TO CLOSE (added to showPopup)
  popup.onclick = function(e) {
    if (e.target === popup) { // Sirf overlay par click hone par
        closePopup();
    }
  };
}
function closePopup() {
  document.getElementById('popup').style.display = 'none';
  document.getElementById('popup-content').innerHTML = '';
  document.getElementById('popup').onclick = null; // Listener hata do to prevent memory leaks and unintended behavior
}
function inputPopup(label, value, onok) {
  showPopup(`<label>${label}</label>
    <input type="text" id="popup-input" value="${value}">
    <div class="popup-actions">
      <button class="ok">OK</button>
      <button class="cancel">Cancel</button>
    </div>`);
  document.getElementById('popup-input').focus();
  document.querySelector('.ok').onclick = () => {
    const val = document.getElementById('popup-input').value.trim();
    if (!val) {
        showToast('Input cannot be empty!', 'warning');
        return;
    }
    closePopup(); onok(val);
  };
  document.querySelector('.cancel').onclick = closePopup;
}
function confirmPopup(msg, onok, style) {
  showPopup(`<div>${msg}</div>
    <div class="popup-actions">
      <button class="${style||'ok'}">OK</button>
      <button class="cancel">Cancel</button>
    </div>`);
  document.querySelector('.ok,.overwrite,.danger').onclick = () => { closePopup(); onok(); };
  document.querySelector('.cancel').onclick = closePopup;
}

// --- LOADING OVERLAY ---
function showLoading(show) {
  let x = document.getElementById('loading-ind');
  if (!x) {
    x = document.createElement('div');
    x.id = 'loading-ind';
    x.style = "position:fixed;top:0;left:0;width:100vw;height:100vh;background:#181825cc;color:#fff;font-size:1.4em;display:flex;align-items:center;justify-content:center;z-index:200;pointer-events:auto;";
    x.innerHTML = "<span style='padding:22px 36px;border-radius:18px;background:#232336bb;font-weight:700;box-shadow:0 6px 20px #0008'>Loading...</span>";
    document.body.appendChild(x);
  }
  x.style.display = show ? 'flex' : 'none';
}

// Apply Initial Theme
function applyInitialTheme() {
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    document.body.classList.toggle('dark-mode', isDarkMode);
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.checked = isDarkMode;
    }
}

// Toggle Theme
function toggleTheme(e) {
    document.body.classList.toggle('dark-mode', e.target.checked);
    localStorage.setItem('darkMode', e.target.checked);
}

// DOMContentLoaded par theme apply karein
document.addEventListener('DOMContentLoaded', applyInitialTheme);