let editor; // Global ACE editor instance
let currentFilePath = ''; // To store the path of the currently opened file

document.addEventListener('DOMContentLoaded', () => {
    const editorEl = document.getElementById('editor');
    const editorPopup = document.getElementById('popup-editor');
    const editorFilenameSpan = editorPopup.querySelector('.editor-filename');
    const saveBtn = editorPopup.querySelector('.popup-editor-actions .save');
    const cancelBtn = editorPopup.querySelector('.popup-editor-actions .cancel');

    // Find/Replace elements
    const findReplacePanel = document.getElementById('find-replace-panel');
    const findInput = document.getElementById('find-input');
    const replaceInput = document.getElementById('replace-input');
    const findNextBtn = document.getElementById('find-next-btn');
    const findPrevBtn = document.getElementById('find-prev-btn');
    const replaceBtn = document.getElementById('replace-btn');
    const replaceAllBtn = document.getElementById('replace-all-btn');
    const toggleFindReplaceBtn = document.getElementById('toggle-find-replace-btn');
    const closeFindReplaceBtn = document.getElementById('close-find-replace-btn');

    // Run/Format buttons (from Editor.html)
    const runBtn = document.getElementById('run-btn');
    const formatBtn = document.getElementById('format-btn');

    // Get reference to the file list element
    const fileList = document.getElementById('file-list'); // THIS IS NEW

    if (editorEl) {
        editor = ace.edit(editorEl);
        editor.setTheme("ace/theme/dracula"); // A dark theme that complements the file manager's dark mode
        editor.session.setMode("ace/mode/javascript"); // Default mode
        editor.setOptions({
            enableBasicAutocompletion: true,
            enableLiveAutocompletion: true,
            enableSnippets: true,
            fontSize: "16px",
            fontFamily: "JetBrains Mono, monospace",
            tabSize: 4,
            useSoftTabs: true,
            wrap: true,
            indentedSoftWrap: false, // Prevents excessive indentation on soft wraps
            highlightActiveLine: true,
            showPrintMargin: false, // Hide the vertical print margin line
            fixedWidthGutter: true // Keeps the gutter from jumping around
        });
    } else {
        console.error('ACE editor element #editor not found. Editor will not be initialized.');
    }

    // Function to map file extension to ACE mode
    function getAceMode(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        switch (ext) {
            case 'js':
            case 'mjs':
            case 'cjs':
                return 'ace/mode/javascript';
            case 'html':
            case 'htm':
                return 'ace/mode/html';
            case 'css':
                return 'ace/mode/css';
            case 'json':
                return 'ace/mode/json';
            case 'py':
                return 'ace/mode/python';
            case 'java':
                return 'ace/mode/java';
            case 'php':
                return 'ace/mode/php';
            case 'ts':
            case 'tsx':
                return 'ace/mode/typescript';
            case 'jsx':
                return 'ace/mode/jsx';
            case 'xml':
                return 'ace/mode/xml';
            case 'sh':
            case 'bash':
                return 'ace/mode/sh';
            case 'md':
            case 'markdown':
                return 'ace/mode/markdown';
            case 'rb':
            case 'ruby':
                return 'ace/mode/ruby';
            case 'go':
                return 'ace/mode/golang';
            case 'c':
            case 'cpp':
                return 'ace/mode/c_cpp';
            case 'cs':
                return 'ace/mode/csharp';
            case 'vue':
                return 'ace/mode/vue';
            case 'scss':
                return 'ace/mode/scss';
            case 'less':
                return 'ace/mode/less';
            case 'sql':
                return 'ace/mode/sql';
            case 'json5':
                return 'ace/mode/json5';
            case 'yaml':
            case 'yml':
                return 'ace/mode/yaml';
            case 'txt':
                return 'ace/mode/text';
            default:
                return 'ace/mode/text'; // Fallback to plain text
        }
    }

    // --- Editor Actions ---

    // Exposed globally for script.js to call (or now, for internal use too)
    window.openEditor = async (filePath) => {
        if (!editor) {
            console.error('ACE editor not initialized.');
            showToast('Editor not ready. Please refresh.', 'error');
            return;
        }

        currentFilePath = filePath;
        const filename = filePath.split('/').pop();
        editorFilenameSpan.textContent = filename;
        editorPopup.style.display = 'flex'; // Show the editor modal

        // Hide find/replace panel by default when opening a new file
        findReplacePanel.classList.add('hidden');

        try {
            // Assume the API endpoint to read a file is /api/read-file
            const response = await fetch(`/api/read-file?path=${encodeURIComponent(filePath)}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to read file.');
            }
            const data = await response.json();
            editor.setValue(data.content, -1); // -1 moves cursor to the start
            editor.session.setMode(getAceMode(filename)); // Set mode based on file extension
            editor.focus(); // Focus the editor
            showToast(`Opened: ${filename}`, 'success');
        } catch (error) {
            console.error('Error opening file:', error);
            showToast(`Error opening file: ${error.message}`, 'error');
            editor.setValue(`Error: ${error.message}`, -1); // Display error in editor
            editor.session.setMode('ace/mode/text'); // Set to text mode on error
        }
    };

    async function saveEditorContent() {
        if (!currentFilePath) {
            showToast('No file open to save.', 'warning');
            return;
        }
        if (!editor) {
            showToast('Editor not ready.', 'error');
            return;
        }

        const content = editor.getValue();
        const filename = currentFilePath.split('/').pop();

        try {
            // Assume the API endpoint to save a file is /api/save-file
            const response = await fetch('/api/save-file', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Add authorization token if required by your backend
                    // 'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                },
                body: JSON.stringify({ path: currentFilePath, content: content })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to save file.');
            }

            showToast(`Saved: ${filename}`, 'success');
            // Optionally, refresh file list if save might affect directory structure (e.g., new file)
            if (window.refreshCurrentDirectory) {
                window.refreshCurrentDirectory();
            }
            editorPopup.style.display = 'none'; // Close editor after saving
        } catch (error) {
            console.error('Error saving file:', error);
            showToast(`Error saving file: ${error.message}`, 'error');
        }
    }

    // --- Event Listeners ---
    saveBtn.addEventListener('click', saveEditorContent);
    cancelBtn.addEventListener('click', () => {
        editorPopup.style.display = 'none'; // Hide the editor modal
        currentFilePath = ''; // Clear current file path
        editor.setValue('', -1); // Clear editor content
    });

    // --- NEW: File List Click Handler (Moved from script.js suggestion) ---
    if (fileList) {
        fileList.addEventListener('click', async (event) => {
            const item = event.target.closest('.item'); // Find the closest parent with class 'item'

            // Check if a file/folder item was clicked
            if (item) {
                const filePath = item.dataset.path; // Get the file/folder path from data-path attribute
                const fileType = item.classList.contains('folder') ? 'folder' : 'file';

                if (fileType === 'file') {
                    console.log("File clicked (from editor.js handler):", filePath);
                    if (window.openEditor) { // Call the openEditor function defined in this same file
                        window.openEditor(filePath);
                    } else {
                        console.error("ERROR: window.openEditor function not found (self-reference issue?).");
                        showToast("Editor function not ready. Please check console.", "error");
                    }
                } else if (fileType === 'folder') {
                    console.log("Folder clicked (from editor.js handler):", filePath);
                    // Agar folder hai, toh us folder mein navigate karo
                    // Assuming you have a function like navigateToPath in your script.js
                    if (window.navigateToPath) {
                        window.navigateToPath(filePath);
                    } else {
                        console.warn("navigateToPath function not found. Cannot navigate to folder.");
                        showToast("Folder navigation not implemented.", "info");
                    }
                }
            }

            // --- Handling 'More Options' Menu Clicks ---
            // Agar aapka 'more-btn' click karne par menu open hota hai, aur menu ke items edit function trigger karte hain
            const moreItemEdit = event.target.closest('.more-item[data-action="edit"]');
            if (moreItemEdit) {
                const menu = moreItemEdit.closest('.more-menu');
                const filePath = menu.dataset.filepath; // Assume filepath is stored on the more-menu div
                
                if (filePath && window.openEditor) {
                    console.log("Edit action from more menu clicked (from editor.js handler) for:", filePath);
                    window.openEditor(filePath);
                } else if (!filePath) {
                    console.error("File path not found for edit action in more menu.");
                }

                // Hide the more menu after action
                if (window.hideMoreMenu) { // Assuming you have a function to hide the menu
                    window.hideMoreMenu();
                } else {
                    // Fallback to hide if hideMoreMenu is not defined
                    const openMenus = document.querySelectorAll('.more-menu');
                    openMenus.forEach(m => m.remove());
                }
            }
            
            const moreBtn = event.target.closest('.more-btn');
            if (moreBtn) {
                event.stopPropagation(); // Stop propagation to prevent item click
                const item = moreBtn.closest('.item');
                if (item) {
                    const filePath = item.dataset.path;
                    console.log("More button clicked (from editor.js handler) for:", filePath);
                    // This part would typically call a function in script.js to show the menu
                    // For now, it just logs or shows a toast.
                    showToast("More options feature not fully integrated here.", "info");
                }
            }
        });
    } else {
        console.warn('File list element #file-list not found. File click handler will not be attached.');
    }

    // --- Find/Replace Functionality ---
    toggleFindReplaceBtn.addEventListener('click', () => {
        findReplacePanel.classList.toggle('hidden');
        if (!findReplacePanel.classList.contains('hidden')) {
            findInput.focus();
            findInput.select(); // Select current text in find input
        }
    });

    closeFindReplaceBtn.addEventListener('click', () => {
        findReplacePanel.classList.add('hidden');
        editor.renderer.removeMarker(editor.$searchHighlight); // Remove search highlight
        editor.find(''); // Clear previous search
    });

    findNextBtn.addEventListener('click', () => {
        editor.find(findInput.value, {}, true); // true for forward
    });

    findPrevBtn.addEventListener('click', () => {
        editor.find(findInput.value, {}, false); // false for backward
    });

    replaceBtn.addEventListener('click', () => {
        editor.replace(replaceInput.value);
    });

    replaceAllBtn.addEventListener('click', () => {
        editor.replaceAll(replaceInput.value);
    });

    // Live search as you type
    findInput.addEventListener('input', () => {
        const needle = findInput.value;
        if (needle) {
            editor.$searchHighlight = editor.find(needle, {
                regExp: false, // Adjust as needed
                wholeWord: false,
                caseSensitive: false,
                wrap: true,
                skipCurrent: false, // Find the first occurrence
                range: null
            });
        } else {
            editor.renderer.removeMarker(editor.$searchHighlight);
        }
    });

    // Keyboard shortcuts for find/replace
    editor.commands.addCommand({
        name: "find",
        bindKey: { win: "Ctrl-F", mac: "Command-F" },
        exec: function(editor) {
            toggleFindReplaceBtn.click(); // Toggle panel
        },
        readOnly: true
    });
    editor.commands.addCommand({
        name: "replace",
        bindKey: { win: "Ctrl-H", mac: "Command-H" },
        exec: function(editor) {
            toggleFindReplaceBtn.click(); // Toggle panel
            // Optionally, focus replace input if panel is shown
            if (!findReplacePanel.classList.contains('hidden')) {
                replaceInput.focus();
            }
        },
        readOnly: true
    });

    // Handle Enter key in find/replace inputs
    findInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault(); // Prevent new line in input
            if (e.shiftKey) {
                editor.find(findInput.value, {}, false); // Find previous
            } else {
                editor.find(findInput.value, {}, true); // Find next
            }
        }
    });

    replaceInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            replaceBtn.click();
        }
    });

    // --- Run/Format Buttons Placeholders ---
    if (runBtn) {
        runBtn.addEventListener('click', () => {
            showToast('Run functionality not implemented yet.', 'info');
            // Implement code execution logic here, e.g., send code to a server-side runner
        });
    }

    if (formatBtn) {
        formatBtn.addEventListener('click', () => {
            showToast('Format functionality not implemented yet.', 'info');
            // Implement code formatting logic here, e.g., use Prettier via a server endpoint
        });
    }
});

// Helper function for Toast notifications (assuming it's defined in script.js)
// If showToast is not in script.js, you'll need to define it here or where it's accessible.
// Example placeholder if not available:
if (typeof showToast === 'undefined') {
    window.showToast = (message, type = 'info') => {
        console.log(`Toast (${type}): ${message}`);
        const toastContainer = document.getElementById('toast-container');
        if (toastContainer) {
            const toast = document.createElement('div');
            toast.classList.add('toast', type);
            toast.textContent = message;
            toastContainer.appendChild(toast);
            setTimeout(() => {
                toast.style.opacity = 0;
                toast.addEventListener('transitionend', () => toast.remove());
            }, 3000);
        }
    };
}