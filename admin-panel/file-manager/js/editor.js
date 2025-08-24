// editor.js
// Is file mein sirf code editor se related saari logic hai.

// --- POPUP EDITOR LOGIC (CODEMIRROR KE LIYE) ---
let cmInstance = null; // CodeMirror instance ko globally declare करें
let popupEditorFilePath = null;
let popupEditorOriginal = '';
let findReplaceBar = null;
let findMatches = [], findCurrentIndex = -1, lastFindValue = '';
let debounceTimer = null;

function getFileMode(filename) {
  const ext = filename.split('.').pop().toLowerCase();
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
    case 'php': return 'php';
    case 'java': return 'clike';
    case 'c': return 'clike';
    case 'cpp': return 'clike';
    case 'go': return 'go';
    case 'rb': return 'ruby';
    case 'rs': return 'rust';
    case 'ts': return 'javascript';
    case 'jsx': return 'jsx';
    case 'tsx': return 'tsx';
    case 'vue': return 'htmlmixed';
    case 'sql': return 'sql';
    case 'yml':
    case 'yaml': return 'yaml';
    default: return 'text/plain';
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

    if (cmInstance) {
      cmInstance.toTextArea();
      cmInstance = null;
    }

    const mode = getFileMode(name);

    cmInstance = CodeMirror.fromTextArea(document.getElementById("code-editor"), {
      value: data.content,
      lineNumbers: true,
      mode: mode,
      theme: "material-darker",
      lineWrapping: true,
      viewportMargin: Infinity,
      autofocus: true,
      extraKeys: {
        "Tab": function(cm) { cm.replaceSelection("  ", "end"); }
      }
    });

    cmInstance.setValue(data.content || "");
    setTimeout(()=>cmInstance.refresh(),200);
    setTimeout(()=>cmInstance.focus(),300);

    // Event listeners for editor actions
    document.querySelector('#popup-editor-content .save').onclick = saveEditorFile;
    document.querySelector('#popup-editor-content .cancel').onclick = closeEditorPopup;
    document.querySelector('.findreplace-btn').onclick = renderFindReplaceBar;

  } catch(e) {
    showToast('File open karne mein error: ' + e.message || e, 'error');
  }
  showLoading(false);
}

async function saveEditorFile() {
  if (!cmInstance || !popupEditorFilePath) return;
  const val = cmInstance.getValue();
  try {
    await performFileManagerApiAction('/file', {method:'PUT', body:{path:popupEditorFilePath, content:val}});
    closeEditorPopup();
    loadDir(currentPath); // Assuming loadDir is globally available from script.js
    showToast('File successfully saved!', 'success');
  } catch(e) {
    // Error handling in performFileManagerApiAction
  }
}

function closeEditorPopup() {
  document.getElementById('popup-editor').style.display = 'none';
  if (cmInstance) {
    cmInstance.toTextArea();
    cmInstance = null;
  }
  popupEditorFilePath = null;
  popupEditorOriginal = '';
  hideFindReplaceBar();
}

// Global key listener for Escape
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeEditorPopup();
    closePopup(); // Assuming closePopup is globally available from script.js
  }
});


// --- FIND & REPLACE LOGIC ---
function renderFindReplaceBar() {
  if (!cmInstance) return;
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
  findInput.value = lastFindValue || '';
  setTimeout(()=>findInput.focus(), 60);

  findInput.oninput = function() {
    lastFindValue = findInput.value;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(triggerFind, 1500);
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
  if (findCurrentIndex !== -1) jumpToMatch(0);
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

function jumpToMatch(dir) {
  if (!findMatches.length) return;
  findCurrentIndex = (findCurrentIndex + dir + findMatches.length) % findMatches.length;
  updateHighlights();
  let match = findMatches[findCurrentIndex];
  cmInstance.setSelection(match.from, match.to);
  cmInstance.scrollIntoView({from:match.from,to:match.to}, 50);
}

function doReplace(val) {
  if (findCurrentIndex===-1 || !findMatches.length) return;
  let match = findMatches[findCurrentIndex];
  cmInstance.replaceRange(val, match.from, match.to);
  setTimeout(triggerFind, 20);
}

function doReplaceAll(val) {
  if (!findMatches.length) return;
  cmInstance.operation(function(){
    for(let i=findMatches.length-1;i>=0;i--){
      cmInstance.replaceRange(val, findMatches[i].from, findMatches[i].to);
    }
  });
  setTimeout(triggerFind, 20);
}