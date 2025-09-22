let currentPath = '/';
let parentPath = null;
let fileTree = [];
let selectedFile = null;
let searchTerm = '';

// New smart back function to handle all states
function smartGoBack() {
  const popup = document.getElementById('popup');
  const editor = document.getElementById('popup-editor');

  // Check 1: Agar koi generic popup open hai, toh use band karo
  if (popup.style.display === 'flex') {
    closePopup();
    return;
  }

  // Check 2: Agar editor open hai, toh use band karo
  if (editor.style.display === 'flex') {
    closeEditorPopup();
    return;
  }

  // Check 3: Agar koi popup ya editor open nahi hai, toh directory mein piche jao
  if (currentPath && currentPath !== '/' && parentPath) {
    loadDir(parentPath);
  } else {
    // If already at root, show a toast or do nothing
    showToast('आप पहले से ही root directory में हैं।', 'warning');
  }
}


window.onload = () => {
  loadDir('/');
  document.querySelector('.add-folder').onclick = addFolderPopup;
  document.querySelector('.add-file').onclick = addFilePopup;
  document.querySelector('.refresh').onclick = () => loadDir(currentPath);

  // Back button event listeners ko update kiya gaya hai
  document.getElementById('floating-back-btn').onclick = smartGoBack;

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
      logoutBtn.addEventListener('click', logoutAdmin);
  }

  const restartBtn = document.getElementById('restartServerBtn');
  if(restartBtn){
    restartBtn.onclick = async function(){
      if(!confirm('Server restart karega. Are you sure?')) return;
      restartBtn.disabled = true;
      restartBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
      const token = localStorage.getItem('adminToken');
      try {
        const res = await fetch('/api/admin/restart', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? 'Bearer ' + token : ''
          }
        });
        if(res.ok){
          alert('Server restarting... Site may be offline for a few seconds!');
        }else{
          const data = await res.json();
          alert('Restart failed: ' + (data.message || 'Unknown error'));
        }
      } catch(e){
        alert('Restart error: ' + (e.message || e));
      }
      setTimeout(()=>location.reload(), 4000);
    };
  }

  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
      themeToggle.addEventListener('change', toggleTheme);
  }

  document.getElementById('file-upload').addEventListener('change', function (e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    handleFileUploads(files);
    e.target.value = '';
  });

  document.getElementById('search-input').oninput = function() {
    searchTerm = this.value.trim().toLowerCase();
    showFileList();
  };
  updateSelectionUI();
};

async function loadDir(pathx) {
  showLoading(true);
  try {
    const data = await performFileManagerApiAction(`?path=${encodeURIComponent(pathx)}`);
    currentPath = data.path;
    parentPath = data.parent;
    const oldFileTree = fileTree;
    fileTree = data.content.map(newItem => {
      const existingItem = oldFileTree.find(oldItem => oldItem.name === newItem.name && oldItem.type === newItem.type);
      return { ...newItem, selected: existingItem ? existingItem.selected : false };
    });

    renderBreadcrumbBar(currentPath);
    showFileList();
  } catch (e) {
    showToast('Directory load karne mein error: ' + e.message || e, 'error');
  }
  showLoading(false);
}

function showFileList() {
  const list = document.getElementById('file-list');
  list.innerHTML = '';

  let contentToDisplay = [...fileTree];
  if (searchTerm) {
    contentToDisplay = contentToDisplay.filter(item => item.name.toLowerCase().includes(searchTerm));
  }

  const folders = contentToDisplay.filter(item => item.type === 'folder');
  const files = contentToDisplay.filter(item => item.type === 'file');

  files.sort((a, b) => a.name.localeCompare(b.name));

  const sortedContent = [...folders, ...files];

  if (!sortedContent.length) {
    list.innerHTML = `<div style="color:#f43f5e;text-align:center;padding:16px;">कोई files/folders नहीं हैं।</div>`;
    updateSelectionUI();
    return;
  }
  sortedContent.forEach(item => {
    const el = document.createElement('div');
    el.className = `item ${item.type}`;

    el.innerHTML = `
      <input type="checkbox" class="select-checkbox" ${item.selected ? 'checked' : ''}>
      <span class="icon">${getIcon(item)}</span>
      <span class="item-name">${item.name}</span>
      <span class="more-btn"><i class="fas fa-ellipsis-v"></i></span>
    `;

    el.querySelector('.item-name').onclick = (ev) => {
      if(item.type === 'folder') loadDir(pathJoin(currentPath, item.name));
      else {
        const ext = extName(item.name);
        if(['png','jpg','jpeg','gif','svg','webp','bmp','ico'].includes(ext)){
          showImageViewer(pathJoin(currentPath, item.name));
        } else {
          openEditor(item.name, currentPath);
        }
      }
    };

    el.querySelector('.more-btn').onclick = (e) => {
      e.stopPropagation();
      showMoreMenu(item, el.querySelector('.more-btn'));
    };

    el.querySelector('.select-checkbox').onchange = function(e){
      item.selected = this.checked;
      updateSelectionUI();
    };

    list.appendChild(el);
  });
  updateSelectionUI();
}

function updateSelectionUI() {
  const selectedItems = fileTree.filter(item => item.selected);
  const bulkActionsBar = document.getElementById('bulk-actions-bar');
  if (selectedItems.length > 0) {
    bulkActionsBar.classList.add('active');
  } else {
    bulkActionsBar.classList.remove('active');
  }
}