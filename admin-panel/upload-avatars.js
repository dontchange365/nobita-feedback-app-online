// admin-panel/upload-avatars.js
document.addEventListener('DOMContentLoaded', () => {
    const uploadButton = document.getElementById('uploadButton');
    const filesInput = document.getElementById('files');
    const prefixInput = document.getElementById('avatarNamePrefix');
    const progressBar = document.getElementById('progressBar');
    const progressContainer = document.querySelector('.progress-container');
    const statusMessage = document.getElementById('statusMessage');
    const resultsDiv = document.getElementById('results');
    const outputUrls = document.getElementById('outputUrls');
    const copyButton = document.getElementById('copyButton');
    let uploadedUrls = [];

    uploadButton.addEventListener('click', async () => {
        const files = filesInput.files;
        const namePrefix = prefixInput.value.trim() || 'nobita-avatar';
        if (files.length === 0) {
            statusMessage.textContent = 'Please select at least one file to upload.';
            statusMessage.className = 'status-message error';
            return;
        }

        uploadedUrls = [];
        progressContainer.style.display = 'block';
        statusMessage.textContent = '';
        resultsDiv.style.display = 'none';
        outputUrls.textContent = '';

        const token = localStorage.getItem('adminToken');
        if (!token) {
            statusMessage.textContent = 'Admin token not found. Please log in again.';
            statusMessage.className = 'status-message error';
            return;
        }

        let completedUploads = 0;
        let successfulUploads = 0;
        let totalFiles = files.length;

        // Disable button during upload
        uploadButton.disabled = true;
        uploadButton.textContent = 'Uploading...';

        for (let i = 0; i < totalFiles; i++) {
            const file = files[i];
            const formData = new FormData();
            formData.append('avatar', file, `${namePrefix}-${Date.now()}-${i}.${file.name.split('.').pop()}`);

            try {
                const response = await axios.post('/api/admin/avatars/upload-single', formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                        'Authorization': `Bearer ${token}`
                    }
                });

                uploadedUrls.push(response.data.url);
                successfulUploads++;
            } catch (error) {
                console.error(`Upload error for file ${file.name}:`, error);
                statusMessage.textContent = `Upload failed for ${file.name}: ${error.response?.data?.error || error.message}`;
                statusMessage.className = 'status-message error';
                // Continue with the next file even if one fails
            } finally {
                completedUploads++;
                const percentCompleted = Math.round((completedUploads / totalFiles) * 100);
                progressBar.style.width = `${percentCompleted}%`;
                progressBar.textContent = `${percentCompleted}%`;
            }
        }

        // Re-enable button after all uploads are done
        uploadButton.disabled = false;
        uploadButton.textContent = 'Upload to Cloudinary';

        if (uploadedUrls.length > 0) {
            const formattedUrls = uploadedUrls.map(url => `  "${url}",`).join('\n');
            outputUrls.textContent = `const avatarUrls = [\n${formattedUrls}\n];`;
            statusMessage.textContent = `All uploads completed! Successful: ${successfulUploads} / ${totalFiles}.`;
            statusMessage.className = 'status-message success';
            resultsDiv.style.display = 'block';
        } else {
            statusMessage.textContent = 'No avatars were uploaded successfully.';
            statusMessage.className = 'status-message error';
        }
    });

    copyButton.addEventListener('click', () => {
        if (uploadedUrls.length === 0) {
            alert('No URLs to copy!');
            return;
        }
        const formattedUrls = uploadedUrls.map(url => `  "${url}",`).join('\n');
        const textToCopy = `const avatarUrls = [\n${formattedUrls}\n];`;
        navigator.clipboard.writeText(textToCopy).then(() => {
            alert('URLs copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy:', err);
        });
    });
});
