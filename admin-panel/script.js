// ICON MAP (Font Awesome classes का उपयोग करके)
const iconMap = {
  'folder': '<i class="fa-solid fa-folder"></i>',
  'js': '<i class="fa-solid fa-file-code"></i>',
  'json': '<i class="fa-solid fa-file-code"></i>',
  'html': '<i class="fa-solid fa-file-code"></i>',
  'css': '<i class="fa-solid fa-file-code"></i>',
  'md': '<i class="fa-solid fa-file-lines"></i>', // Markdown
  'txt': '<i class="fa-solid fa-file-lines"></i>',
  'env': '<i class="fa-solid fa-gear"></i>',
  'log': '<i class="fa-solid fa-file-lines"></i>',
  'sh': '<i class="fa-solid fa-terminal"></i>',
  'xml': '<i class="fa-solid fa-code"></i>',
  'yml': '<i class="fa-solid fa-gear"></i>',
  'yaml': '<i class="fa-solid fa-gear"></i>',
  'image': '<i class="fa-solid fa-file-image"></i>',
  'png': '<i class="fa-solid fa-file-image"></i>',
  'jpg': '<i class="fa-solid fa-file-image"></i>',
  'jpeg': '<i class="fa-solid fa-file-image"></i>',
  'gif': '<i class="fa-solid fa-file-image"></i>',
  'svg': '<i class="fa-solid fa-file-image"></i>',
  'webp': '<i class="fa-solid fa-file-image"></i>', // New: webp
  'bmp': '<i class="fa-solid fa-file-image"></i>', // New: bmp
  'ico': '<i class="fa-solid fa-file-image"></i>', // New: ico
  'audio': '<i class="fa-solid fa-file-audio"></i>',
  'mp3': '<i class="fa-solid fa-file-audio"></i>',
  'wav': '<i class="fa-solid fa-file-audio"></i>',
  'video': '<i class="fa-solid fa-file-video"></i>',
  'mp4': '<i class="fa-solid fa-file-video"></i>',
  'mov': '<i class="fa-solid fa-file-video"></i>',
  'zip': '<i class="fa-solid fa-file-zipper"></i>',
  'rar': '<i class="fa-solid fa-file-zipper"></i>',
  'pdf': '<i class="fa-solid fa-file-pdf"></i>',
  'doc': '<i class="fa-solid fa-file-word"></i>',
  'docx': '<i class="fa-solid fa-file-word"></i>',
  'xls': '<i class="fa-solid fa-file-excel"></i>',
  'xlsx': '<i class="fa-solid fa-file-excel"></i>',
  'ppt': '<i class="fa-solid fa-file-powerpoint"></i>',
  'pptx': '<i class="fa-solid fa-file-powerpoint"></i>',
  'py': '<i class="fa-brands fa-python"></i>',
  'java': '<i class="fa-brands fa-java"></i>',
  'php': '<i class="fa-brands fa-php"></i>',
  'c': '<i class="fa-solid fa-file-lines"></i>', // General code/text file
  'cpp': '<i class="fa-solid fa-file-lines"></i>',
  'h': '<i class="fa-solid fa-file-lines"></i>',
  'go': '<i class="fa-brands fa-golang"></i>',
  'rb': '<i class="fa-solid fa-gem"></i>', // Ruby
  'rs': '<i class="fa-brands fa-rust"></i>',
  'ts': '<i class="fa-solid fa-file-code"></i>',
  'tsx': '<i class="fa-brands fa-react"></i>',
  'jsx': '<i class="fa-brands fa-react"></i>',
  'vue': '<i class="fa-brands fa-vuejs"></i>',
  'sql': '<i class="fa-solid fa-database"></i>',
  'db': '<i class="fa-solid fa-database"></i>',
  'sqlite': '<i class="fa-solid fa-database"></i>',
  'git': '<i class="fa-brands fa-git-alt"></i>',
  'gitignore': '<i class="fa-brands fa-git-alt"></i>',
  'licence': '<i class="fa-solid fa-certificate"></i>',
  'license': '<i class="fa-solid fa-certificate"></i>',
  'conf': '<i class="fa-solid fa-gear"></i>',
  'file': '<i class="fa-solid fa-file"></i>' // Default generic file icon
};

let currentPath = '/';
let parentPath = null;
let fileTree = []; // Global fileTree, अब इसमें 'selected' property भी होगी
let selectedFile = null;
let cmInstance = null; // CodeMirror instance को globally declare करें
let searchTerm = ''; // Search term के लिए global variable

window.onload = () => {
  // Authentication check aur basic UI setup file-manager.html ke script block mein hai.
  // Yahan sirf File Manager ke specific event listeners add karein.
  loadDir('/');
  document.querySelector('.add-folder').onclick = addFolderPopup;
  document.querySelector('.add-file').onclick = addFilePopup;
  document.querySelector('.refresh').onclick = () => loadDir(currentPath);
  document.getElementById('backBtn').onclick = goBack;
  document.getElementById('floating-back-btn').onclick = goBack;

  // Logout button event listener add kiya
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
      logoutBtn.addEventListener('click', logoutAdmin);
  }

  // Theme toggle event listener add kiya
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
      themeToggle.addEventListener('change', toggleTheme);
  }

  document.getElementById('file-upload').addEventListener('change', function (e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    handleFileUploads(files);
    e.target.value = ''; // Reset करें ताकि same files दोबारा select हो सकें
  });

  // Search input event listener
  document.getElementById('search-input').oninput = function() {
    searchTerm = this.value.trim().toLowerCase();
    showFileList(); // Search term change होने पर file list refresh करें
  };
  updateSelectionUI(); // Page load पर initial UI state set करें (bar hidden)
};

// performFileManagerApiAction function file-manager.html ke head section mein already defined hai.
// To avoid re-declaring it here, hum ise global scope mein maante hain.
// agar ye script.js mein nahi hai, to ise file-manager.html mein add karna zaroori hai.


function extName(name) {
  const i = name.lastIndexOf('.');
  return i>=0 ? name.substr(i+1).toLowerCase() : '';
}

function getIcon(item) {
  if(item.type==='folder') return iconMap.folder;
  let ext = extName(item.name);
  return iconMap[ext] || iconMap.file;
}

async function loadDir(pathx) {
  showLoading(true);
  try {
    // performFileManagerApiAction ka use kiya
    const data = await performFileManagerApiAction(`?path=${encodeURIComponent(pathx)}`);
    currentPath = data.path;
    parentPath = data.parent;
    // fileTree को update करें, existing 'selected' status maintain करते हुए
    const oldFileTree = fileTree;
    fileTree = data.content.map(newItem => {
      const existingItem = oldFileTree.find(oldItem => oldItem.name === newItem.name && oldItem.type === newItem.type);
      return { ...newItem, selected: existingItem ? existingItem.selected : false };
    });

    renderBreadcrumbBar(currentPath); // नया breadcrumb render करें
    showFileList(); // File list को show करें (search filter apply होगा)
  } catch (e) {
    // Error handling ab performFileManagerApiAction mein hota hai, yahan sirf fallback
    showToast('Directory load karne mein error: ' + e.message || e, 'error');
  }
  showLoading(false);
}

function showFileList() {
  const list = document.getElementById('file-list');
  list.innerHTML = '';

  // Apply search filter
  let contentToDisplay = [...fileTree];
  if (searchTerm) {
    contentToDisplay = contentToDisplay.filter(item => item.name.toLowerCase().includes(searchTerm));
  }

  // Folders और files को अलग करें
  const folders = contentToDisplay.filter(item => item.type === 'folder');
  const files = contentToDisplay.filter(item => item.type === 'file');

  // Files को alphabetically sort करें
  files.sort((a, b) => a.name.localeCompare(b.name));

  // Folders और sorted files को combine करें
  const sortedContent = [...folders, ...files];

  if (!sortedContent.length) {
    list.innerHTML = `<div style="color:#f43f5e;text-align:center;padding:16px;">कोई files/folders नहीं हैं।</div>`;
    updateSelectionUI(); // अगर कोई item नहीं है तो bulk actions bar छुपा दो
    return;
  }
  sortedContent.forEach(item => { // नए sorted array पर iterate करें
    const el = document.createElement('div');
    el.className = `item ${item.type}`;
    
    // Checkbox for selection, Icon, Name, और More button
    el.innerHTML = `
      <input type="checkbox" class="select-checkbox" ${item.selected ? 'checked' : ''}>
      <span class="icon">${getIcon(item)}</span>
      <span class="item-name">${item.name}</span>
      <span class="more-btn"><i class="fas fa-ellipsis-v"></i></span>
    `;

    // Click file/folder name or icon (exclude checkbox and more-btn clicks)
    el.querySelector('.item-name').onclick = (ev) => {
      if(item.type === 'folder') loadDir(pathJoin(currentPath, item.name));
      else {
        const ext = extName(item.name);
        // अगर image है: image viewer open करें
        if(['png','jpg','jpeg','gif','svg','webp','bmp','ico'].includes(ext)){
          showImageViewer(pathJoin(currentPath, item.name));
        } else {
          openFile(item.name); // Code editor text/code files के लिए
        }
      }
    };

    // More/3-dot menu click
    el.querySelector('.more-btn').onclick = (e) => {
      e.stopPropagation(); // Event bubbling रोकें
      showMoreMenu(item, el.querySelector('.more-btn'));
    };

    // Checkbox selection
    el.querySelector('.select-checkbox').onchange = function(e){
      item.selected = this.checked;
      updateSelectionUI(); // Selection UI update करें
    };

    list.appendChild(el);
  });
  updateSelectionUI(); // List render होने के बाद selection UI update करें
}

function updateSelectionUI() {
  const selectedItems = fileTree.filter(item => item.selected);
  const bulkActionsBar = document.getElementById('bulk-actions-bar');
  if (selectedItems.length > 0) {
    bulkActionsBar.classList.add('active');   // Bar dikh
  } else {
    bulkActionsBar.classList.remove('active'); // Bilkul gayab
  }
  // Buttons को अब individual dim/disable नहीं करना है, bar खुद hide/show होगा
}


function pathJoin(...args) {
  return args.join('/').replace(/\/+/g,'/').replace(/\/$/,'') || '/';
}

function goBack() {
  // सिर्फ तभी वापस जाएं जब root पर ना हो और parent path define हो
  if (currentPath && currentPath !== '/' && parentPath) {
    loadDir(parentPath);
  } else {
    // Optionally, root directory पर होने पर feedback दें
    console.log("पहले से ही root directory पर हैं।");
  }
}

function addFolderPopup() {
  inputPopup('नया Folder नाम:', '', async (name) => {
    try {
      // performFileManagerApiAction ka use kiya
      await performFileManagerApiAction('/folder', {method:'POST', body:{path:currentPath, name}});
      loadDir(currentPath);
    } catch (e) {
      // Error handling performFileManagerApiAction mein
    }
  });
}

function addFilePopup() {
  inputPopup('नयी File नाम:', '', async (name) => {
    try {
      // performFileManagerApiAction ka use kiya
      await performFileManagerApiAction('/file', {method:'POST', body:{path:currentPath, name, content:'', overwrite:false}});
      loadDir(currentPath);
    } catch(e) {
      if (e.message && e.message.includes('File exists')) { // Error message check kiya
        confirmPopup(`File <b>${name}</b> पहले से exist करती है। Empty content से overwrite करें?`, async () => {
          try {
            // performFileManagerApiAction ka use kiya
            await performFileManagerApiAction('/file', {
              method: 'POST',
              body: { path: currentPath, name, content: '', overwrite: true }
            });
            loadDir(currentPath);
          } catch (overwriteError) {
             showToast('File overwrite karne mein error: ' + overwriteError.message, 'error');
          }
        },'overwrite');
      } else {
        showToast('File banane mein error: ' + e.message || e, 'error'); // Generic error toast
      }
    }
  });
}

// --- POPUP EDITOR LOGIC (CODEMIRROR के लिए UPDATED) --- //
let popupEditorFilePath = null;
let popupEditorOriginal = '';

function getFileMode(filename) {
  const ext = extName(filename);
  switch(ext) {
    case 'js': return 'javascript';
    case 'html': return 'htmlmixed';
    case 'css': return 'css';
    case 'json': return {name: "javascript", json: true};
    case 'py': return 'python';
    case 'xml': return 'xml';
    case 'md': return 'gfm'; // GitHub Flavored Markdown
    case 'txt': return 'text/plain';
    case 'sh': return 'shell';
    case 'php': return 'php'; // Corrected: `php` mode add kiya
    case 'java': return 'clike'; // Java, C, C++ के लिए
    case 'c': return 'clike';
    case 'cpp': return 'clike';
    case 'go': return 'go';
    case 'rb': return 'ruby';
    case 'rs': return 'rust';
    case 'ts': return 'javascript'; // TypeScript अक्सर JS mode use करता है
    case 'jsx': return 'jsx';
    case 'tsx': return 'jsx';
    case 'vue': return 'htmlmixed'; // Vue files अक्सर HTML mixed होती हैं
    case 'sql': return 'sql';
    case 'yml':
    case 'yaml': return 'yaml';
    default: return 'text/plain'; // Default plain text
  }
}

async function openFile(name) {
  showLoading(true);
  const filepath = pathJoin(currentPath, name);
  try {
    // performFileManagerApiAction ka use kiya
    const data = await performFileManagerApiAction(`/file?path=${encodeURIComponent(filepath)}`);
    popupEditorFilePath = filepath;
    popupEditorOriginal = data.content;
    document.querySelector('#popup-editor-content .editor-filename').textContent = name;
    document.getElementById('popup-editor').style.display = 'flex';

    if (cmInstance) {
      cmInstance.toTextArea(); // CodeMirror instance को वापस textarea में convert करें
      cmInstance = null;
    }

    const mode = getFileMode(name);

    cmInstance = CodeMirror.fromTextArea(document.getElementById("code-editor"), {
      value: data.content,
      lineNumbers: true,
      mode: mode,
      theme: "material-darker",
      lineWrapping: true,
      viewportMargin: Infinity,   // सारी lines visible, कोई scroll bug नहीं
      autofocus: true,
      extraKeys: {
        "Tab": function(cm) { cm.replaceSelection("  ", "end"); } // Mobile-friendly tab
      }
    });

    cmInstance.setValue(data.content || "");  // Content set करें
    // IMPORTANT: Value set करने और visible होने के बाद CodeMirror instance को refresh करें
    setTimeout(()=>cmInstance.refresh(),200);
    setTimeout(()=>cmInstance.focus(),300); // Mobile में focus जुगाड़

  } catch(e) {
    showToast('File open karne mein error: ' + e.message || e, 'error');
  }
  showLoading(false);
}

document.querySelector('#popup-editor-content .save').onclick = async function() {
  if (!cmInstance) return;
  const val = cmInstance.getValue();
  if (!popupEditorFilePath) return;
  try {
    // performFileManagerApiAction ka use kiya
    await performFileManagerApiAction('/file', {method:'PUT', body:{path:popupEditorFilePath, content:val}});
    closeEditorPopup();
    loadDir(currentPath);
    showToast('File successfully saved!', 'success'); // Save success toast
  } catch(e) {
    // Error handling performFileManagerApiAction mein
  }
};

document.querySelector('#popup-editor-content .cancel').onclick = function() {
  closeEditorPopup();
};

function closeEditorPopup() {
  document.getElementById('popup-editor').style.display = 'none';
  if (cmInstance) {
    cmInstance.toTextArea(); // CodeMirror instance को वापस textarea में convert करें
    cmInstance = null;
  }
  popupEditorFilePath = null;
  popupEditorOriginal = '';
}

window.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeEditorPopup(); closePopup(); }
});

// --- REVISED MULTI-FILE UPLOAD LOGIC (POPUP पर LOADING OVERLAY FIX किया) ---
async function handleFileUploads(files) {
  showLoading(true); // Files read करने की process के लिए शुरू में loading दिखाएं
  let action = null; // 'skip', 'overwrite', null
  let doAll = false;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    let exists = fileTree.some(f => f.name === file.name && f.type === 'file');

    if (exists && !doAll) {
      // User prompt दिखाने से पहले loading छुपाएं
      showLoading(false);
      // अगर file exist करती है और 'सबके लिए यही करें' checked नहीं है, तो prompt दिखाएं
      const userChoice = await new Promise(resolve => {
        showPopup(`
          <div>File <b>${file.name}</b> पहले से exist करती है।<br>क्या करना चाहते हैं?</div>
          <div style="margin:10px 0;"><label><input type="checkbox" id="doAll"> सभी बची हुई files के लिए यही करें</label></div>
          <div class="popup-actions">
            <button class="ok skip">Skip</button>
            <button class="overwrite">Overwrite</button>
          </div>
        `);
        document.querySelector('.skip').onclick = () => {
          if (document.getElementById('doAll').checked) { doAll = true; }
          closePopup(); resolve('skip');
        };
        document.querySelector('.overwrite').onclick = () => {
          if (document.getElementById('doAll').checked) { doAll = true; }
          closePopup(); resolve('overwrite');
        };
      });
      action = userChoice; // User की choice के हिसाब से action set करें
      showLoading(true); // User के choice बनाने के बाद loading वापस दिखाएं (next upload से पहले)
    }

    // अब action apply करें (या तो user-chosen या 'doAll' action)
    if (action === 'skip') {
      console.log(`Skipping file: ${file.name}`);
      showToast(`Skipped file: ${file.name}`, 'info');
      continue; // अगली file पर जाएं
    } else { // Implicitly 'overwrite' या 'no-conflict' (अगर file exist नहीं करती थी)
      try {
        await uploadFile(file, true); // Overwrite set to true if it exists or user chose to
        showToast(`Uploaded file: ${file.name}`, 'success'); // Toast for each successful upload
      } catch (e) {
        console.error(`${file.name} के लिए upload failed:`, e);
        showToast(`Failed to upload ${file.name}: ${e.message || e}`, 'error');
      }
    }
  }
  showLoading(false); // सारी files process होने के बाद loading छुपाएं
  loadDir(currentPath); // सारे operations के बाद directory list को refresh करें
}

async function uploadFile(file, overwrite=false) {
  // showLoading(true); // Loading ab handleFileUploads mein control hota hai
  try {
    const content = await file.text(); // यह line NotReadableError throw कर सकती है
    // performFileManagerApiAction ka use kiya
    await performFileManagerApiAction('/file', {
      method: 'POST',
      body: { path: currentPath, name: file.name, content, overwrite }
    });
    console.log(`File '${file.name}' successfully uploaded (overwrite: ${overwrite})`);
  } catch (e) {
    console.error(`${file.name} के लिए uploadFile में error:`, e);
    // Error handling ab performFileManagerApiAction mein bhi hai, yahan specific checks
    if (e && e.message && e.message.includes('NotReadableError')) { // check for 'e.message'
      throw new Error('File read nahi ho sakti! Dobara select karein ya page reload karein.');
    } else if (e.message && e.message.includes('File exists')) {
      // This case should be handled by the outer loop for user prompt
      throw new Error('Upload failed: File already exists. Please use overwrite option.');
    } else {
      throw e; // Re-throw other errors
    }
  } finally {
    // showLoading(false); // सिर्फ handleFileUploads में loading छुपाएं
  }
}

// --- POPUP / PROMPT SYSTEM ---
function showPopup(content) {
  const popup = document.getElementById('popup');
  const popupContent = document.getElementById('popup-content');
  popupContent.innerHTML = content;
  popup.style.display = 'flex';
  // अगर image है तो popup-content transparent हो
  if (content.includes('<img')) {
    popupContent.style.background = 'transparent';
    popupContent.style.boxShadow = 'none';
  } else {
    popupContent.style.background = '#232336';
    popupContent.style.boxShadow = '0 8px 28px #0009';
  }
  // OUTSIDE CLICK TO CLOSE (added to showPopup)
  popup.onclick = function(e) {
    if (e.target === popup) { // सिर्फ overlay पर click होने पर
        closePopup();
    }
  };
}
function closePopup() {
  document.getElementById('popup').style.display = 'none';
  document.getElementById('popup-content').innerHTML = '';
  document.getElementById('popup').onclick = null; // Listener हटा दो to prevent memory leaks and unintended behavior
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

// --- BREADCRUMB NAVIGATION LOGIC ---
function renderBreadcrumbBar(path) {
  const bar = document.getElementById('breadcrumb-bar');
  bar.innerHTML = ''; // Old breadcrumbs clear करें
  let fullPathAccumulator = ''; // Full path बनाने के लिए

  // ROOT Button
  const rootBtn = document.createElement('span');
  rootBtn.className = 'breadcrumb-link breadcrumb-root';
  rootBtn.textContent = 'ROOT';
  rootBtn.onclick = () => { loadDir('/'); };
  bar.appendChild(rootBtn);

  let segments = path.replace(/^\/+/,'').split('/').filter(Boolean); // Clean path segments

  if (segments.length > 0) {
    const sep = document.createElement('span');
    sep.textContent = '/';
    sep.className = 'breadcrumb-sep';
    bar.appendChild(sep);
  }

  segments.forEach((seg, idx) => {
    fullPathAccumulator += '/' + seg;
    const link = document.createElement('span');
    link.className = 'breadcrumb-link';
    link.textContent = seg;
    // Closure issue से बचने के लिए, current fullPathAccumulator को bind करें
    const currentSegmentPath = fullPathAccumulator;
    link.onclick = () => { loadDir(currentSegmentPath); };
    bar.appendChild(link);
    if (idx < segments.length - 1) {
      const sep = document.createElement('span');
      sep.textContent = '/';
      sep.className = 'breadcrumb-sep';
      bar.appendChild(sep);
    }
  });

  // Auto-scroll to end अगर बहुत सारे folders हैं
  setTimeout(() => {
    bar.scrollLeft = bar.scrollWidth;
  }, 100);
}

// --- IMAGE VIEWER LOGIC ---
function showImageViewer(path){
  showPopup(`
    <img src="/api/file-manager/file?path=${encodeURIComponent(path)}" 
         style="max-width:95vw;max-height:76vh;border-radius:13px;box-shadow:0 4px 40px rgba(0,0,0,0.8); display: block; margin: auto;"
         onerror="this.onerror=null;this.src='https://placehold.co/600x400/FF0000/FFFFFF?text=Error+Loading+Image';">
  `);
}


// --- MORE MENU (3-DOTS) LOGIC ---
let activeMoreMenu = null; // Track active menu to close it

function showMoreMenu(item, anchorEl){
  // अगर कोई previous menu open है, उसे close करें
  if (activeMoreMenu) {
    activeMoreMenu.remove();
    activeMoreMenu = null;
  }

  const menu = document.createElement('div');
  menu.className = 'more-menu';
  
  // Position menu relative to the anchor element
  const rect = anchorEl.getBoundingClientRect();
  menu.style.top = `${rect.bottom + 4}px`;
  // Adjust left position to align with right side or prevent going off screen
  const menuWidth = 150; // Approximate menu width
  const viewportWidth = window.innerWidth;
  if (rect.left + menuWidth > viewportWidth - 10) { // If menu goes off right edge
    menu.style.left = `${viewportWidth - menuWidth - 10}px`; // Align to right with some padding
  } else {
    menu.style.left = `${rect.left}px`;
  }

  // Common actions for both file and folder
  let menuHtml = `
    <div class="more-item" onclick="closeMoreMenu(); renameItem('${item.name}')"><i class="fas fa-pen"></i> Rename</div>
    <div class="more-item" onclick="closeMoreMenu(); showProperties('${item.name}', '${item.type}')"><i class="fas fa-info-circle"></i> Properties</div>
    <div class="more-item" onclick="closeMoreMenu(); deleteItem('${item.name}')"><i class="fas fa-trash-alt"></i> Delete</div>
  `;

  // Add download for files only (assuming backend supports download via GET on file path)
  if (item.type === 'file') {
    menuHtml += `<div class="more-item" onclick="closeMoreMenu(); downloadFile('${item.name}')"><i class="fas fa-download"></i> Download</div>`;
  }

  menu.innerHTML = menuHtml;
  document.body.appendChild(menu);
  activeMoreMenu = menu;

  // Close menu when clicking outside
  document.addEventListener('click', function remover(ev){
  if (
    activeMoreMenu && 
    (!menu || !menu.contains(ev.target)) && 
    (!anchorEl || !anchorEl.contains(ev.target))
  ) {
    activeMoreMenu.remove();
    activeMoreMenu = null;
    document.removeEventListener('click', remover);
  }
});
}

// Add this function globally to explicitly close the more menu
function closeMoreMenu() {
  if (activeMoreMenu) {
    activeMoreMenu.remove();
    activeMoreMenu = null;
  }
}

// Helper to get file size (approximate for demonstration)
async function getFileSize(path) {
    try {
        // performFileManagerApiAction ka use kiya (method: 'HEAD' for headers only)
        const response = await performFileManagerApiAction(`/file?path=${encodeURIComponent(path)}`, { method: 'HEAD' });
        if (response) { // response.ok performFileManagerApiAction mein handle ho gaya
            const contentLength = response.headers.get('content-length');
            if (contentLength) {
                const bytes = parseInt(contentLength, 10);
                if (bytes < 1024) return bytes + ' Bytes';
                if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
                if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
                return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
            }
        }
    } catch (error) {
        console.error("Error fetching file size:", error);
        // showToast('Error fetching file size: ' + error.message, 'error'); // already handled in performFileManagerApiAction
    }
    return 'N/A';
}

async function showProperties(name, type){
  // "File" या "Folder" दिखा
  let niceType = (type === 'file') ? 'File' : (type === 'folder') ? 'Folder' : type;
  let itemDetails = `<b>Name:</b> ${name}<br><b>Type:</b> ${niceType}<br>`;
  let sizeText = 'N/A'; // Default value

  if (type === 'file') {
    showLoading(true);
    try {
      // getFileSize calls performFileManagerApiAction internally
      sizeText = await getFileSize(pathJoin(currentPath, name));
    } catch (e) {
      console.error("Error fetching size for properties:", e);
      // showToast is already called by performFileManagerApiAction
      sizeText = 'N/A'; // Fallback if API call fails
    }
    showLoading(false);
    itemDetails += `<b>Size:</b> ${sizeText}<br>`;
  }
  showPopup(`<h3>Properties for ${name}</h3><div>${itemDetails}</div>`);
}

async function renameItem(name){
  inputPopup(`Rename "${name}":`, name, async(newName)=>{
    if (newName === name) {
      showToast('New name is same as old name.', 'info');
      return;
    }
    try {
      // performFileManagerApiAction ka use kiya
      await performFileManagerApiAction('/rename', {method:'POST', body:{path:currentPath, name, newName}});
      loadDir(currentPath);
      showToast(`Renamed ${name} to ${newName}.`, 'success');
    } catch(e) {
      // Error handled by performFileManagerApiAction
    }
  });
}

async function deleteItem(name){
  confirmPopup(`<b>${name}</b> delete करें?`, async()=>{
    showLoading(true);
    try {
      // performFileManagerApiAction ka use kiya
      await performFileManagerApiAction(`?path=${encodeURIComponent(pathJoin(currentPath, name))}`, {method:'DELETE'});
      showToast(`Deleted: ${name}.`, 'success');
      loadDir(currentPath);
    } catch(e) {
      // Error handled by performFileManagerApiAction
    } finally {
      showLoading(false);
    }
  },'danger');
}

async function downloadFile(name) {
  const filepath = pathJoin(currentPath, name);
  // Direct window.open will include current cookies/auth if on same domain.
  // For protected file manager, server should handle auth for /api/file-manager/file?path=...
  // The backend already handles this by requiring authenticateAdminToken for this endpoint.
  // We need to ensure the request includes the token.
  // A direct window.open might not pass headers directly.
  // A more robust way would be to create a temporary signed URL from the server,
  // or fetch the blob and create a local URL. For simplicity, we'll assume
  // the backend's /api/file-manager/file route (GET) will handle the auth check
  // on its own, and if successful, serve the file.
  // If the server requires token in headers for GET file, then this simple window.open won't work.
  // For now, let's keep it simple assuming browser sends cookies/auth for same-origin requests.
  // If not, it would involve a more complex method using Blob or temporary URLs.
  showToast('Downloading file...', 'info');
  window.open(`/api/file-manager/file?path=${encodeURIComponent(filepath)}`, '_blank');
}


// --- BULK OPERATIONS LOGIC ---
function selectAllFiles(){
  fileTree.forEach(f => {
    f.selected = true;
  });
  showFileList(); // Refresh UI to show checkboxes checked
  updateSelectionUI(); // <-- सुनिश्चित करें कि बार तुरंत अपडेट हो
}

function deselectAllFiles(){
  fileTree.forEach(f => {
    f.selected = false;
  });
  showFileList(); // Refresh UI to show checkboxes unchecked
  updateSelectionUI(); // <-- सुनिश्चित करें कि बार तुरंत हाइड हो
}

async function bulkDelete(){
  const selectedItems = fileTree.filter(f => f.selected);
  if(!selectedItems.length){
    showToast('Bhosdike, kuch select to kar pehle!', 'warning'); // Use toast here
    return;
  }
  confirmPopup(`<b>${selectedItems.length}</b> items delete करें?`, async()=>{
    showLoading(true);
    let successCount = 0;
    let failCount = 0;
    for(const item of selectedItems){
      try {
        // performFileManagerApiAction ka use kiya
        await performFileManagerApiAction(`?path=${encodeURIComponent(pathJoin(currentPath, item.name))}`, {method:'DELETE'});
        successCount++;
      } catch (e) {
        console.error(`${item.name} ko delete karne mein error:`, e);
        failCount++;
      }
    }
    showLoading(false);
    if (successCount > 0) {
        showToast(`${successCount} items deleted successfully!`, 'success');
    }
    if (failCount > 0) {
        showToast(`${failCount} items failed to delete. Check console.`, 'error');
    }
    loadDir(currentPath); // Delete hone ke baad list refresh karein
  },'danger');
}
  // --- FIND & REPLACE ---
    let findReplaceBar = document.getElementById('find-replace-bar');
    let findMatches = [], findCurrentIndex = -1, lastFindValue = '';
    let debounceTimer = null;

    function renderFindReplaceBar() {
      if (!cmInstance) return;
      if (!findReplaceBar) findReplaceBar = document.getElementById('find-replace-bar');

      // Updated HTML structure for find/replace bar
      findReplaceBar.innerHTML = `
        <div class="fr-input-row">
          <input type="text" id="find-input" placeholder="Find..." autocomplete="off">
          <input type="text" id="replace-input" placeholder="Replace..." autocomplete="off">
        </div>
        <div class="fr-btn-row">
          <button class="bar-btn prev-btn" title="Previous">&#8593;</button>
          <button class="bar-btn next-btn" title="Next">&#8595;</button>
          <button class="bar-btn replace-btn" title="Replace">Replace</button>
          <button class="bar-btn replace-all-btn standout" title="Replace All"><i class="fas fa-bolt"></i> All</button>
          <button class="close-btn" title="Close">&times;</button>
        </div>
      `;
      findReplaceBar.style.display = 'flex';

      let findInput = document.getElementById('find-input');
      let replaceInput = document.getElementById('replace-input');
      findInput.value = lastFindValue || '';
      setTimeout(()=>findInput.focus(), 60);

      findInput.oninput = function() {
        lastFindValue = findInput.value;
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(triggerFind, 1500); // 1.5s delay
      };
      findInput.onkeydown = function(e) {
        if(e.key==='Enter') jumpToMatch(1);
        if(e.key==='Escape') hideFindReplaceBar();
      };
      replaceInput.onkeydown = function(e) {
        if(e.key==='Enter') doReplace(replaceInput.value);
        if(e.key==='Escape') hideFindReplaceBar();
      };
      findReplaceBar.querySelector('.prev-btn').onclick = ()=>jumpToMatch(-1);
      findReplaceBar.querySelector('.next-btn').onclick = ()=>jumpToMatch(1);
      findReplaceBar.querySelector('.replace-btn').onclick = ()=>doReplace(replaceInput.value);
      findReplaceBar.querySelector('.replace-all-btn').onclick = ()=>doReplaceAll(replaceInput.value);
      findReplaceBar.querySelector('.close-btn').onclick = hideFindReplaceBar;

      document.addEventListener('keydown', escCloseListener);
      // Initial find (in case input prefilled)
      if (findInput.value) triggerFind();
    }

    function hideFindReplaceBar() {
      if (!findReplaceBar) findReplaceBar = document.getElementById('find-replace-bar');
      findReplaceBar.style.display = 'none';
      if (cmInstance) cmInstance.getAllMarks().forEach(mark=>mark.clear());
      findMatches = []; findCurrentIndex = -1; lastFindValue = '';
      document.removeEventListener('keydown', escCloseListener);
    }

    function escCloseListener(e) {
      if (e.key === 'Escape') hideFindReplaceBar();
    }

    // --- FIND LOGIC (debounced) ---
    function triggerFind() {
      if (!cmInstance) return;
      let query = lastFindValue;
      cmInstance.getAllMarks().forEach(mark=>mark.clear());
      if (!query) { findMatches = []; findCurrentIndex = -1; return; }

      let content = cmInstance.getValue();
      let regex;
      try { regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "gi"); } catch(e) { return; }
      let matches = [], match;
      while ((match = regex.exec(content)) !== null) {
        let from = cmInstance.posFromIndex(match.index);
        let to = cmInstance.posFromIndex(match.index + match[0].length);
        matches.push({from, to});
        if (match.index === regex.lastIndex) regex.lastIndex++;
      }
      findMatches = matches;
      findCurrentIndex = findMatches.length ? 0 : -1;
      updateHighlights();
      if (findCurrentIndex !== -1) jumpToMatch(0); // focus first
    }

    function updateHighlights() {
      if (!cmInstance) return;
      cmInstance.getAllMarks().forEach(mark=>mark.clear());
      findMatches.forEach((m, i) => {
        cmInstance.markText(m.from, m.to, {
          className: "find-highlight" + (i===findCurrentIndex?" current":""),
          clearOnEnter: true
        });
      });
    }

    // --- NEXT/PREVIOUS ---
    function jumpToMatch(dir) {
      if (!findMatches.length) return;
      findCurrentIndex = (findCurrentIndex + dir + findMatches.length) % findMatches.length;
      updateHighlights();
      let match = findMatches[findCurrentIndex];
      cmInstance.setSelection(match.from, match.to);
      cmInstance.scrollIntoView({from:match.from,to:match.to}, 50);
    }

    // --- REPLACE ONE ---
    function doReplace(val) {
      if (findCurrentIndex===-1 || !findMatches.length) return;
      let match = findMatches[findCurrentIndex];
      cmInstance.replaceRange(val, match.from, match.to);
      setTimeout(triggerFind, 20); // refresh after change
    }

    // --- REPLACE ALL ---
    function doReplaceAll(val) {
      if (!findMatches.length) return;
      cmInstance.operation(function(){
        for(let i=findMatches.length-1;i>=0;i--){
          cmInstance.replaceRange(val, findMatches[i].from, findMatches[i].to);
        }
      });
      setTimeout(triggerFind, 20);
    }

    // --- OPEN BAR ON BUTTON CLICK ---
    document.querySelector('.findreplace-btn').onclick =
    renderFindReplaceBar;
    
  // Ye script page load hote hi run hoga.
    // Check karega ki admin authenticated hai ya nahi.
    const adminToken = localStorage.getItem('adminToken');
    const adminLoggedInUser = JSON.parse(localStorage.getItem('adminLoggedInUser'));

    if (!adminToken || !adminLoggedInUser || !adminLoggedInUser.username || !adminLoggedInUser.userId) {
        console.warn("Admin token ya user data missing/invalid. Redirecting to login.");
        // window.location.replace() use karein taki back button se protected page par wapis na aa saken.
        window.location.replace('/admin-login.html');
    }

    // --- Helper Functions for Authentication and UI (Global scope mein) ---

    // Logout function
    function logoutAdmin() {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminLoggedInUser');
        localStorage.removeItem('adminUsername'); // 'Remember Me' ke liye
        localStorage.removeItem('adminRememberMe'); // 'Remember Me' ke liye
        showToast('Logged out successfully.', 'info');
        setTimeout(() => {
            window.location.replace('/admin-login.html'); // Redirect to login page after logout
        }, 500);
    }

    // Show Toast Notification Function
    function showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) {
            console.warn('Toast container not found. Cannot show toast:', message);
            return;
        }
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        // Toast ko 3 seconds baad remove karein
        setTimeout(() => { toast.remove(); }, 3000);
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

    // --- API Action Helper Function (Authentication ke saath) ---
    // Ye function har API call ko wrap karega aur Authorization header add karega.
    async function performFileManagerApiAction(path, opts = {}) {
        const adminToken = localStorage.getItem('adminToken');
        if (!adminToken) {
            // Agar token nahi hai, to redirect kar do, waise initial check se catch ho jayega
            showToast('Session expired. Please log in again.', 'error');
            logoutAdmin();
            throw new Error('Authentication required.');
        }

        const url = '/api/file-manager' + path;
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`, // JWT token add kiya
            ...(opts.headers || {}) // Aur koi custom headers hain to unhe merge kar do
        };

        const finalOpts = {
            ...opts,
            headers: headers,
        };

        // Agar body object hai to JSON.stringify karein
        if (finalOpts.body && typeof finalOpts.body !== 'string') {
            finalOpts.body = JSON.stringify(finalOpts.body);
        }

        try {
            const res = await fetch(url, finalOpts);

            if (res.status === 401 || res.status === 403) {
                // Agar session expired ya unauthorized hai, to logout kar do
                const errorData = await res.json().catch(() => ({ message: 'Authentication failed or session expired.' }));
                showToast(errorData.message || 'Session expired. Please log in again.', 'error');
                logoutAdmin();
                throw new Error(errorData.message || 'Unauthorized access');
            }

            if (!res.ok) {
                // Normal HTTP errors
                let msg = 'Error: ' + res.status;
                try { let js = await res.json(); msg = js.error || msg; } catch{}
                throw new Error(msg);
            }

            // DELETE operations ke liye response empty ho sakta hai, isliye handle karein
            if (opts.method === 'DELETE') {
                 // Depend karta hai backend kya return karta hai, yahan generic success
                 return res.status === 204 ? {} : await res.json().catch(() => ({ success: true }));
            }

            return await res.json();
        } catch (error) {
            console.error("File Manager API Error:", error);
            // showToast function already error display kar chuki hai
            throw error; // Re-throw error ताकि calling function bhi handle kar sake agar zaroori ho
        }
    }

    // --- GitHub Log Functionality ---
    let githubLogState = [];
    let githubProcessStatus = 'idle'; // 'idle', 'loading', 'complete', 'error'
    let githubEventSource = null; // To store the current EventSource instance

    function updateGithubSpinnerIcon() {
      const spinnerBtn = document.getElementById('github-spinner-btn');
      const spinnerAnim = spinnerBtn.querySelector('.spinner-anim');

      spinnerBtn.style.display = (githubProcessStatus === 'idle') ? 'none' : 'block';
      spinnerBtn.className = 'github-spinner-icon'; // Reset classes

      if (githubProcessStatus === 'loading') {
        spinnerBtn.classList.add('loading');
      } else if (githubProcessStatus === 'complete') {
        spinnerBtn.classList.add('complete');
      } else if (githubProcessStatus === 'error') {
        spinnerBtn.classList.add('error');
      }
    }

    function showGithubLogPopup() {
      // Load previous state if available and no process is in progress
      const prev = sessionStorage.getItem('githubLogState');
      if (prev && githubProcessStatus === 'idle') { // Only load if not active
        try {
          githubLogState = JSON.parse(prev);
        } catch (e) {
          console.error("Error parsing stored githubLogState:", e);
          githubLogState = []; // Reset if corrupted
        }
      } else if (githubProcessStatus === 'idle') {
        githubLogState = []; // Clear if starting a new session and no process in progress
      }
      document.getElementById('github-log-popup').style.display = 'flex';
      updateGithubSpinnerIcon(); // Ensure spinner state is correct
      renderGithubLog();
    }

    function closeGithubLogPopup() {
      document.getElementById('github-log-popup').style.display = 'none';
      sessionStorage.setItem('githubLogState', JSON.stringify(githubLogState));
      // If process is complete or errored, and popup is closed, hide the spinner icon too
      if (githubProcessStatus === 'complete' || githubProcessStatus === 'error') {
        githubProcessStatus = 'idle';
        updateGithubSpinnerIcon();
      }
    }

    function minimizeGithubLogPopup() {
      document.getElementById('github-log-popup').style.display = 'none';
      updateGithubSpinnerIcon(); // Show minimized icon
    }

    function renderGithubLog() {
      const area = document.getElementById('github-log-area');
      area.textContent = githubLogState.join('\n');
      area.scrollTop = area.scrollHeight; // Auto-scroll to bottom
    }

    function githubLog(line) {
      githubLogState.push(line);
      // Keep only the last 100 lines to prevent memory issues
      if (githubLogState.length > 100) {
        githubLogState = githubLogState.slice(-100);
      }
      renderGithubLog();
      // Save state to session storage periodically (or on every update)
      sessionStorage.setItem('githubLogState', JSON.stringify(githubLogState));
    }

    async function startGithubStream(endpoint) {
      githubLogState = [];
      sessionStorage.removeItem('githubLogState'); // Clear session storage on new push
      githubProcessStatus = 'loading';
      showGithubLogPopup(); // Show the full log popup initially
      githubLog(`[Connecting to GitHub for ${endpoint.includes('push') ? 'push' : 'pull'}...]`);

      const adminToken = localStorage.getItem('adminToken');
      if (!adminToken) {
          githubLog('[ERROR] Admin token not found. Please log in.');
          githubProcessStatus = 'error';
          renderGithubLog();
          showToast('Admin session expired. Please log in.', 'error');
          return;
      }
      const message = encodeURIComponent('Full action from NOBI FILE MANAGER 😈'); // Generic message

      // Close any existing event source before opening a new one
      if (githubEventSource) {
          githubEventSource.close();
      }

      // Pass token as query parameter as per the prompt's instruction for SSE
      githubEventSource = new EventSource(`${endpoint}?token=${encodeURIComponent(adminToken)}&message=${message}`);

      githubEventSource.onmessage = function(event) {
        if (event.data === '[GITHUB_DONE]') {
          githubProcessStatus = 'complete';
          renderGithubLog();
          githubEventSource.close(); // Close the connection when done
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
        githubEventSource.close(); // Close on error as well
        githubLog('[ERROR] Connection error or server stopped.');
        showToast(`GitHub ${endpoint.includes('push') ? 'push' : 'pull'} encountered an error.`, 'error');
      };
    }

    // DOMContentLoaded for all event listeners and initial UI setup
    document.addEventListener('DOMContentLoaded', () => {
      const githubActionBtn = document.getElementById('github-action-btn-main'); // The main button to open action selection
      const githubActionPopup = document.getElementById('github-action-popup');
      const githubLogPopup = document.getElementById('github-log-popup');
      const closeActionPopupBtn = githubActionPopup.querySelector('.close-btn');
      const actionButtons = githubActionPopup.querySelectorAll('.github-action-btn');
      const minimizeLogBtn = document.getElementById('minimize-log-btn');
      const githubSpinnerBtn = document.getElementById('github-spinner-btn'); // The floating spinner icon

      // 1. Show action selection popup
      if (githubActionBtn) {
        githubActionBtn.addEventListener('click', () => {
          githubActionPopup.style.display = 'flex';
          // Ensure log popup is hidden if action popup is opened
          githubLogPopup.style.display = 'none';
        });
      }

      // 2. Handle action selection (Push/Pull)
      actionButtons.forEach(button => {
        button.addEventListener('click', function() {
          const action = this.dataset.action;
          githubActionPopup.style.display = 'none'; // Close action selection popup

          if (action === 'push') {
            startGithubStream('/api/admin/push-to-github/stream');
          } else if (action === 'pull') {
            startGithubStream('/api/admin/pull-from-github/stream');
          }
        });
      });

      // 3. Close action selection popup
      if (closeActionPopupBtn) {
        closeActionPopupBtn.addEventListener('click', () => {
          githubActionPopup.style.display = 'none';
        });
      }

      // 4. Minimize live log popup
      if (minimizeLogBtn) {
        minimizeLogBtn.addEventListener('click', minimizeGithubLogPopup);
      }

      // 5. Restore live log popup from minimized spinner icon
      if (githubSpinnerBtn) {
        githubSpinnerBtn.addEventListener('click', showGithubLogPopup);
      }

      // Initial state of spinner icon on page load
      updateGithubSpinnerIcon();
    });

/* ADMIN HUB JS START FROM HERE */
