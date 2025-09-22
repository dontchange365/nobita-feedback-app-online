// fileActions.js
// Is file mein file aur folder ko create, rename, aur delete karne ki logic hai.
// Isme bulk actions bhi shamil hain.

async function addFolderPopup() {
  inputPopup('नया Folder नाम:', '', async (name) => {
    try {
      await performFileManagerApiAction('/folder', {method:'POST', body:{path:currentPath, name}});
      loadDir(currentPath);
    } catch (e) {
    }
  });
}

async function addFilePopup() {
  inputPopup('नयी File नाम:', '', async (name) => {
    try {
      await performFileManagerApiAction('/file', {method:'POST', body:{path:currentPath, name, content:'', overwrite:false}});
      loadDir(currentPath);
    } catch(e) {
      if (e.message && e.message.includes('File exists')) {
        confirmPopup(`File <b>${name}</b> पहले से exist करती है। Empty content से overwrite करें?`, async () => {
          try {
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
        showToast('File banane mein error: ' + e.message || e, 'error');
      }
    }
  });
}

async function renameItem(name){
  inputPopup(`Rename "${name}":`, name, async(newName)=>{
    if (newName === name) {
      showToast('New name is same as old name.', 'info');
      return;
    }
    try {
      await performFileManagerApiAction('/rename', {method:'POST', body:{path:currentPath, name, newName}});
      loadDir(currentPath);
      showToast(`Renamed ${name} to ${newName}.`, 'success');
    } catch(e) {
    }
  });
}

async function deleteItem(name){
  confirmPopup(`<b>${name}</b> delete करें?`, async()=>{
    showLoading(true);
    try {
      await performFileManagerApiAction(`?path=${encodeURIComponent(pathJoin(currentPath, name))}`, {method:'DELETE'});
      showToast(`Deleted: ${name}.`, 'success');
      loadDir(currentPath);
    } catch(e) {
    } finally {
      showLoading(false);
    }
  },'danger');
}

function selectAllFiles(){
  fileTree.forEach(f => {
    f.selected = true;
  });
  showFileList();
  updateSelectionUI();
}

function deselectAllFiles(){
  fileTree.forEach(f => {
    f.selected = false;
  });
  showFileList();
  updateSelectionUI();
}

async function bulkDelete(){
  const selectedItems = fileTree.filter(f => f.selected);
  if(!selectedItems.length){
    showToast('Bhosdike, kuch select to kar pehle!', 'warning');
    return;
  }
  confirmPopup(`<b>${selectedItems.length}</b> items delete करें?`, async()=>{
    showLoading(true);
    let successCount = 0;
    let failCount = 0;
    for(const item of selectedItems){
      try {
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
    loadDir(currentPath);
  },'danger');
}