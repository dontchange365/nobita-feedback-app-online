// github.js

// --- GitHub Log Functionality ---
let githubLogState = [];
let githubProcessStatus = 'idle'; // 'idle', 'loading', 'complete', 'error'
let githubEventSource = null;

function updateGithubSpinnerIcon() {
  const spinnerBtn = document.getElementById('github-spinner-btn');
  const spinnerAnim = spinnerBtn.querySelector('.spinner-anim');

  spinnerBtn.style.display = (githubProcessStatus === 'idle') ? 'none' : 'block';
  spinnerBtn.className = 'github-spinner-icon';

  if (githubProcessStatus === 'loading') {
    spinnerBtn.classList.add('loading');
  } else if (githubProcessStatus === 'complete') {
    spinnerBtn.classList.add('complete');
  } else if (githubProcessStatus === 'error') {
    spinnerBtn.classList.add('error');
  }
}

function showGithubLogPopup() {
  const prev = sessionStorage.getItem('githubLogState');
  if (prev && githubProcessStatus === 'idle') {
    try {
      githubLogState = JSON.parse(prev);
    } catch (e) {
      console.error("Error parsing stored githubLogState:", e);
      githubLogState = [];
    }
  } else if (githubProcessStatus === 'idle') {
    githubLogState = [];
  }
  document.getElementById('github-log-popup').style.display = 'flex';
  updateGithubSpinnerIcon();
  renderGithubLog();
}

function closeGithubLogPopup() {
  document.getElementById('github-log-popup').style.display = 'none';
  sessionStorage.setItem('githubLogState', JSON.stringify(githubLogState));
  if (githubProcessStatus === 'complete' || githubProcessStatus === 'error') {
    githubProcessStatus = 'idle';
    updateGithubSpinnerIcon();
  }
}

function minimizeGithubLogPopup() {
  document.getElementById('github-log-popup').style.display = 'none';
  updateGithubSpinnerIcon();
}

// CHANGE: Log rendering logic ko update kiya gaya hai
function renderGithubLog() {
  const area = document.getElementById('github-log-area');
  area.innerHTML = ''; // Clear for new rendering
  githubLogState.forEach(item => {
    const logItem = document.createElement('div');
    logItem.className = 'log-item';
    let icon = '';
    let text = item.message;

    if (item.type === 'start') {
        icon = '<i class="fas fa-spinner fa-spin"></i>';
        text = `[${item.status.toUpperCase()}] Pushing file: ${item.file}`;
    } else if (item.type === 'progress') {
        icon = '<i class="fas fa-spinner fa-spin"></i>';
        text = `[${item.status.toUpperCase()}] Pushing file: ${item.file}`;
    } else if (item.type === 'success') {
        icon = '<i class="fas fa-check-circle"></i>';
        text = `Pushed successfully: ${item.file}`;
    } else if (item.type === 'error') {
        icon = '<i class="fas fa-times-circle"></i>';
        text = `Error pushing: ${item.file}`;
    } else if (item.type === 'message') {
      // Simple text message, no icon
        text = item.message;
    }
    
    logItem.innerHTML = `<span class="log-icon">${icon}</span> <span class="log-text">${text}</span>`;
    area.appendChild(logItem);
  });
  area.scrollTop = area.scrollHeight;
}

// CHANGE: Log data ko JSON ke roop mein parse kiya gaya hai
function githubLog(data) {
  try {
    const logData = JSON.parse(data);
    
    // Find if an item with the same file is already in progress
    const existingIndex = githubLogState.findIndex(item => item.file === logData.file);

    if (logData.type === 'start' || logData.type === 'progress') {
        // If it's a new file, add it to the state
        if (existingIndex === -1) {
            githubLogState.push(logData);
        } else {
            // If the file is already in the list, update its status
            githubLogState[existingIndex] = logData;
        }
    } else if (logData.type === 'success' || logData.type === 'error') {
        // For success or error, find the item and update its status
        const itemToUpdate = githubLogState.find(item => item.file === logData.file);
        if (itemToUpdate) {
            itemToUpdate.type = logData.type;
        } else {
            // Or add it if it somehow wasn't there
            githubLogState.push(logData);
        }
    } else {
        // Simple message, add it to the end
        githubLogState.push(logData);
    }
    
    // Keep only the last 100 lines to prevent memory issues
    if (githubLogState.length > 100) {
      githubLogState = githubLogState.slice(-100);
    }
    renderGithubLog();
    sessionStorage.setItem('githubLogState', JSON.stringify(githubLogState));
  } catch (e) {
    // If the data is not JSON, handle it as a simple text message
    githubLogState.push({ type: 'message', message: data });
    renderGithubLog();
  }
}

// CHANGE: startGithubStream ko modify kiya gaya hai taaki woh ek hi baar mein poori process complete kare
async function singleActionGithub(endpoint) {
    githubLogState = [];
    sessionStorage.removeItem('githubLogState');
    githubProcessStatus = 'loading';
    showGithubLogPopup();
    githubLog(JSON.stringify({ type: 'message', message: `[Connecting to GitHub for ${endpoint.includes('push') ? 'push' : 'pull'}... Please wait. This may take a moment.]`}));

    const adminToken = localStorage.getItem('adminToken');
    if (!adminToken) {
        githubLog(JSON.stringify({ type: 'error', message: '[ERROR] Admin token not found. Please log in.' }));
        githubProcessStatus = 'error';
        showToast('Admin session expired. Please log in.', 'error');
        return;
    }
    const message = encodeURIComponent('Full action from NOBI FILE MANAGER 😈');

    try {
        const response = await fetch(`${endpoint.replace('/stream', '')}?message=${message}`, {
            method: 'POST', // Push aur Pull dono ko POST request se handle karenge
            headers: { 'Authorization': `Bearer ${adminToken}` },
        });

        const result = await response.json();
        
        if (response.ok) {
            githubLog(JSON.stringify({ type: 'message', message: `[COMPLETE] ${result.message}` }));
            githubProcessStatus = 'complete';
            showToast(`GitHub action complete: ${result.message}`, 'success');
            loadDir(currentPath); // Refresh the file list after a successful pull/push
        } else {
            githubLog(JSON.stringify({ type: 'error', message: `[ERROR] ${result.error || result.message}` }));
            githubProcessStatus = 'error';
            showToast(`GitHub action failed: ${result.error || result.message}`, 'error');
        }
    } catch (e) {
        console.error("GitHub Action error:", e);
        githubLog(JSON.stringify({ type: 'error', message: `[ERROR] Connection error or server issue: ${e.message}` }));
        githubProcessStatus = 'error';
        showToast('GitHub action encountered an error.', 'error');
    } finally {
        renderGithubLog();
    }
}


document.addEventListener('DOMContentLoaded', () => {
  const githubActionBtn = document.getElementById('github-action-btn-main');
  const githubActionPopup = document.getElementById('github-action-popup');
  const githubLogPopup = document.getElementById('github-log-popup');
  const closeActionPopupBtn = githubActionPopup.querySelector('.close-btn');
  const actionButtons = githubActionPopup.querySelectorAll('.github-action-btn');
  const minimizeLogBtn = document.getElementById('minimize-log-btn');
  const githubSpinnerBtn = document.getElementById('github-spinner-btn');

  if (githubActionBtn) {
    githubActionBtn.addEventListener('click', () => {
      githubActionPopup.style.display = 'flex';
      githubLogPopup.style.display = 'none';
    });
  }

  actionButtons.forEach(button => {
    button.addEventListener('click', function() {
      const action = this.dataset.action;
      githubActionPopup.style.display = 'none';

      if (action === 'push') {
        singleActionGithub('/api/admin/push-to-github');
      } else if (action === 'pull') {
        singleActionGithub('/api/admin/pull-from-github');
      }
    });
  });

  if (closeActionPopupBtn) {
    closeActionPopupBtn.addEventListener('click', () => {
      githubActionPopup.style.display = 'none';
    });
  }

  if (minimizeLogBtn) {
    minimizeLogBtn.addEventListener('click', minimizeGithubLogPopup);
  }

  if (githubSpinnerBtn) {
    githubSpinnerBtn.addEventListener('click', showGithubLogPopup);
  }

  updateGithubSpinnerIcon();
});