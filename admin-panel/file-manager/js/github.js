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

function renderGithubLog() {
  const area = document.getElementById('github-log-area');
  area.textContent = githubLogState.join('\n');
  area.scrollTop = area.scrollHeight;
}

function githubLog(line) {
  githubLogState.push(line);
  if (githubLogState.length > 100) {
    githubLogState = githubLogState.slice(-100);
  }
  renderGithubLog();
  sessionStorage.setItem('githubLogState', JSON.stringify(githubLogState));
}

async function startGithubStream(endpoint) {
  githubLogState = [];
  sessionStorage.removeItem('githubLogState');
  githubProcessStatus = 'loading';
  showGithubLogPopup();
  githubLog(`[Connecting to GitHub for ${endpoint.includes('push') ? 'push' : 'pull'}...]`);

  const adminToken = localStorage.getItem('adminToken');
  if (!adminToken) {
      githubLog('[ERROR] Admin token not found. Please log in.');
      githubProcessStatus = 'error';
      renderGithubLog();
      showToast('Admin session expired. Please log in.', 'error');
      return;
  }
  const message = encodeURIComponent('Full action from NOBI FILE MANAGER 😈');

  if (githubEventSource) {
      githubEventSource.close();
  }

  githubEventSource = new EventSource(`${endpoint}?token=${encodeURIComponent(adminToken)}&message=${message}`);

  githubEventSource.onmessage = function(event) {
    if (event.data === '[GITHUB_DONE]') {
      githubProcessStatus = 'complete';
      renderGithubLog();
      githubEventSource.close();
      githubLog(`[COMPLETE] GitHub ${endpoint.includes('push') ? 'push' : 'pull'} done!`);
      showToast(`GitHub ${endpoint.includes('push') ? 'push' : 'pull'} complete!`, 'success');
      return;
    }
    githubLog(event.data);
  };

  githubEventSource.onerror = function(e) {
    console.error("GitHub EventSource error:", e);
    githubProcessStatus = 'error';
    renderGithubLog();
    githubEventSource.close();
    githubLog('[ERROR] Connection error or server stopped.');
    showToast(`GitHub ${endpoint.includes('push') ? 'push' : 'pull'} encountered an error.`, 'error');
  };
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
        startGithubStream('/api/admin/push-to-github/stream');
      } else if (action === 'pull') {
        startGithubStream('/api/admin/pull-from-github/stream');
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