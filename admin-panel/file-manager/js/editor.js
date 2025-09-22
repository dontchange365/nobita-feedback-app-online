// editor.js
// Is file mein sirf ACE Editor se related saari logic hai.

let aceEditorInstance = null;
let popupEditorFilePath = null;
let popupEditorOriginal = '';
let findReplaceBar = null;
let lastFindValue = '';
let editorHasUnsavedChanges = false; // New flag to track unsaved changes

// New helper function to update the filename UI
function updateEditorFilenameUI() {
  const filenameEl = document.querySelector('#popup-editor-content .editor-filename');
  const filename = filenameEl.textContent.replace(' *', ''); // Remove existing star if any
  if (editorHasUnsavedChanges) {
    filenameEl.textContent = `${filename} *`;
  } else {
    filenameEl.textContent = filename;
  }
}

function getFileMode(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  switch(ext) {
    case 'js': return 'javascript';
    case 'html': return 'html';
    case 'css': return 'css';
    case 'json': return 'json';
    case 'py': return 'python';
    case 'xml': return 'xml';
    case 'md': return 'markdown';
    case 'txt': return 'text';
    case 'sh': return 'sh';
    case 'php': return 'php';
    case 'java': return 'java';
    case 'c': return 'c_cpp';
    case 'cpp': return 'c_cpp';
    case 'go': return 'golang';
    case 'rb': return 'ruby';
    case 'rs': return 'rust';
    case 'ts': return 'typescript';
    case 'jsx': return 'jsx';
    case 'tsx': return 'tsx';
    case 'vue': return 'html';
    case 'sql': return 'sql';
    case 'yml':
    case 'yaml': return 'yaml';
    default: return 'text';
  }
}

async function openEditor(name, currentPath) {
  showLoading(true);
  const filepath = pathJoin(currentPath, name);
  try {
    const data = await performFileManagerApiAction(`/file?path=${encodeURIComponent(filepath)}`);
    popupEditorFilePath = filepath;
    popupEditorOriginal = data.content;
    document.querySelector('#popup-editor-content .editor-filename').textContent = name;
    document.getElementById('popup-editor').style.display = 'flex';

    if (aceEditorInstance) {
      aceEditorInstance.destroy();
      aceEditorInstance = null;
    }
    
    aceEditorInstance = ace.edit("code-editor");
    aceEditorInstance.setTheme("ace/theme/monokai");
    aceEditorInstance.session.setMode("ace/mode/" + getFileMode(name));
    aceEditorInstance.setValue(data.content || "", -1);
    
    aceEditorInstance.setFontSize('12px');
    aceEditorInstance.session.setUseWrapMode(true);

    // CHANGE: Unsaved changes ka flag reset karein aur change event listener add karein
    editorHasUnsavedChanges = false;
    aceEditorInstance.getSession().on('change', () => {
      // Yahan par naya logic hai: current content ko original content se compare karein
      const currentContent = aceEditorInstance.getValue();
      if (currentContent === popupEditorOriginal) {
        editorHasUnsavedChanges = false;
      } else {
        editorHasUnsavedChanges = true;
      }
      updateEditorFilenameUI();
    });
    updateEditorFilenameUI(); // Initial UI update

    aceEditorInstance.resize();
    aceEditorInstance.focus();

    document.querySelector('#popup-editor-content .save').onclick = saveEditorFile;
    document.querySelector('#popup-editor-content .cancel').onclick = closeEditorPopup;
    document.querySelector('.findreplace-btn').onclick = renderFindReplaceBar;

  } catch(e) {
    showToast('File open karne mein error: ' + e.message || e, 'error');
  }
  showLoading(false);
}

async function saveEditorFile() {
  if (!aceEditorInstance || !popupEditorFilePath) return;
  const val = aceEditorInstance.getValue();
  try {
    await performFileManagerApiAction('/file', {method:'PUT', body:{path:popupEditorFilePath, content:val}});
    
    // CHANGE: File save hone par unsaved changes ka flag reset karein
    editorHasUnsavedChanges = false;
    updateEditorFilenameUI(); // UI update karein taaki star hat jaye
    
    closeEditorPopup();
    loadDir(currentPath);
    showToast('File successfully saved!', 'success');
  } catch(e) {
    // Error handling in performFileManagerApiAction
  }
}

function closeEditorPopup() {
  document.getElementById('popup-editor').style.display = 'none';
  if (aceEditorInstance) {
    aceEditorInstance.destroy();
    aceEditorInstance = null;
  }
  popupEditorFilePath = null;
  popupEditorOriginal = '';
  hideFindReplaceBar();
}

window.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeEditorPopup();
    closePopup();
  }
});


function renderFindReplaceBar() {
  if (!aceEditorInstance) return;
  if (!findReplaceBar) findReplaceBar = document.getElementById('find-replace-bar');
  
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
  setTimeout(()=>findInput.focus(), 60);

  findInput.oninput = function() {
    lastFindValue = findInput.value;
    findInAce(lastFindValue);
  };
  findInput.onkeydown = function(e) {
    if(e.key==='Enter') aceEditorInstance.execCommand("findnext");
    if(e.key==='Escape') hideFindReplaceBar();
  };
  replaceInput.onkeydown = function(e) {
    if(e.key==='Enter') aceEditorInstance.execCommand("replace");
    if(e.key==='Escape') hideFindReplaceBar();
  };
  findReplaceBar.querySelector('.prev-btn').onclick = ()=>aceEditorInstance.execCommand("findprevious");
  findReplaceBar.querySelector('.next-btn').onclick = ()=>aceEditorInstance.execCommand("findnext");
  findReplaceBar.querySelector('.replace-btn').onclick = ()=>aceEditorInstance.execCommand("replace");
  findReplaceBar.querySelector('.replace-all-btn').onclick = ()=>aceEditorInstance.execCommand("replaceAll");
  findReplaceBar.querySelector('.close-btn').onclick = hideFindReplaceBar;
  document.addEventListener('keydown', escCloseListener);
}

function findInAce(text) {
  aceEditorInstance.find(text, {
    regExp: false,
    caseSensitive: false
  });
}

function hideFindReplaceBar() {
  if (!findReplaceBar) findReplaceBar = document.getElementById('find-replace-bar');
  findReplaceBar.style.display = 'none';
  if (aceEditorInstance) aceEditorInstance.exitFindMode();
}

function escCloseListener(e) {
  if (e.key === 'Escape') hideFindReplaceBar();
}