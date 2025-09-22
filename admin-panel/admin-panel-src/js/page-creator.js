// admin-panel-src/js/page-creator.js
window.initPageModule = function() {
    const createPageBtn = document.getElementById('createPageBtn');
    const createPageModal = document.getElementById('createPageModal');
    const createPageForm = document.getElementById('createPageForm');
    const cancelCreatePageBtn = document.getElementById('cancelCreatePageBtn');
    const submitCreatePageBtn = document.getElementById('submitCreatePageBtn');
    const closeCreatePageModalBtn = document.getElementById('closeCreatePageModalBtn');
    const closeCreatePageModal = () => {
        createPageModal.style.display = 'none';
        createPageForm.reset();
    };

    if (createPageBtn) {
        createPageBtn.addEventListener('click', () => {
            createPageModal.style.display = 'flex';
        });
    }
    if (cancelCreatePageBtn) {
        cancelCreatePageBtn.addEventListener('click', closeCreatePageModal);
    }
    if (closeCreatePageModalBtn) {
        closeCreatePageModalBtn.addEventListener('click', closeCreatePageModal);
    }
    if (createPageModal) {
        createPageModal.addEventListener('click', (event) => {
            if (event.target === createPageModal) {
                closeCreatePageModal();
            }
        });
    }
    if (createPageForm) {
        createPageForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const pageName = document.getElementById('pageName').value.trim();
            const pageTitle = document.getElementById('pageTitle').value.trim();
            const metaDescription = document.getElementById('metaDescription').value.trim();
            const metaKeywords = document.getElementById('metaKeywords').value.trim();
            const pageContent = document.getElementById('pageContent').value.trim();
            const inlineCss = document.getElementById('inlineCss').value.trim();
            const inlineJs = document.getElementById('inlineJs').value.trim();
            const websiteTitle = document.getElementById('websiteTitle').value.trim();
            const heroTitle = document.getElementById('heroTitle').value.trim();
            const heroEmoji = document.getElementById('heroEmoji').value.trim();
            const heroPara = document.getElementById('heroPara').value.trim();
            if (!pageName || !pageTitle || !pageContent || !websiteTitle || !heroTitle || !heroPara) {
                showToast('Page name, title, content, website title, hero title, and hero paragraph are required.', 'error');
                return;
            }

            submitCreatePageBtn.disabled = true;
            submitCreatePageBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';

            const token = localStorage.getItem('adminToken');
            try {
                const response = await fetch('/api/admin/create-page-from-template', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': token ? `Bearer ${token}` : ''
                    },
                    body: JSON.stringify({
                        pageName,
                        pageTitle,
                        metaDescription,
                        metaKeywords,
                        pageContent,
                        inlineCss,
                        inlineJs,
                        websiteTitle,
                        heroTitle,
                        heroEmoji,
                        heroPara
                    })
                });
                const data = await response.json();
                if (response.ok) {
                    showToast(data.message, 'success');
                    closeCreatePageModal();
                } else {
                    showToast(data.message || 'Error creating page.', 'error');
                }
            } catch (error) {
                console.error('Network error or unexpected:', error);
                showToast('An unexpected error occurred. Check console.', 'error');
            } finally {
                submitCreatePageBtn.disabled = false;
                submitCreatePageBtn.innerHTML = 'Create Page';
            }
        });
    }
}