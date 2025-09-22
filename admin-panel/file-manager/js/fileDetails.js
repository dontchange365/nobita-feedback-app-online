// fileDetails.js
// Is file mein file aur folder ki details, icons, aur properties se related logic hai

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

function extName(name) {
  const i = name.lastIndexOf('.');
  return i>=0 ? name.substr(i+1).toLowerCase() : '';
}

function getIcon(item) {
  if(item.type==='folder') return iconMap.folder;
  let ext = extName(item.name);
  return iconMap[ext] || iconMap.file;
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
  // Agar koi previous menu open hai, use close karein
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
  // "File" ya "Folder" dikha
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