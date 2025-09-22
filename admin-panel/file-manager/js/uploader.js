// uploader.js

// --- MULTI-FILE UPLOAD LOGIC ---
async function handleFileUploads(files) {
  showLoading(true); // Files read karne ki process ke liye shuru mein loading dikhaen
  let action = null; // 'skip', 'overwrite', null
  let doAll = false;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    let exists = fileTree.some(f => f.name === file.name && f.type === 'file'); // fileTree is a global variable from script.js

    if (exists && !doAll) {
      // User prompt dikhane se pehle loading chupaen
      showLoading(false);
      const userChoice = await new Promise(resolve => {
        showPopup(`
          <div>File <b>${file.name}</b> pehle se exist karti hai.<br>Kya karna chahte hain?</div>
          <div style="margin:10px 0;"><label><input type="checkbox" id="doAll"> Sabhi bachi hui files ke liye yahi karein</label></div>
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
      action = userChoice;
      showLoading(true);
    }

    if (action === 'skip') {
      console.log(`Skipping file: ${file.name}`);
      showToast(`Skipped file: ${file.name}`, 'info');
      continue;
    } else {
      try {
        await uploadFile(file, true); // Overwrite set to true if it exists or user chose to
        showToast(`Uploaded file: ${file.name}`, 'success');
      } catch (e) {
        console.error(`${file.name} ke liye upload failed:`, e);
        showToast(`Failed to upload ${file.name}: ${e.message || e}`, 'error');
      }
    }
  }
  showLoading(false);
  loadDir(currentPath); // Assuming loadDir is globally available from script.js
}

async function uploadFile(file, overwrite=false) {
  try {
    const content = await file.text();
    await performFileManagerApiAction('/file', {
      method: 'POST',
      body: { path: currentPath, name: file.name, content, overwrite }
    });
    console.log(`File '${file.name}' successfully uploaded (overwrite: ${overwrite})`);
  } catch (e) {
    console.error(`${file.name} ke liye uploadFile mein error:`, e);
    if (e && e.message && e.message.includes('NotReadableError')) {
      throw new Error('File read nahi ho sakti! Dobara select karein ya page reload karein.');
    } else if (e.message && e.message.includes('File exists')) {
      throw new Error('Upload failed: File already exists. Please use overwrite option.');
    } else {
      throw e;
    }
  }
}