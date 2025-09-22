// admin-panel-src/js/blog.js
window.blogList = [];

window.showBlogModal = function() {
    document.getElementById('blog-modal-overlay').style.display = 'flex';
    fetchBlogs();
}

window.closeBlogModal = function() {
    document.getElementById('blog-modal-overlay').style.display = 'none';
}

window.fetchBlogs = async function() {
    try {
        const response = await performApiAction('/api/blogs');
        blogList = response;
        renderBlogAdminList();
    } catch (error) {
        showCustomMessage('Failed to load blogs.', 'error');
        console.error("Error fetching blogs:", error);
    }
}

window.renderBlogAdminList = function() {
    const listContainer = document.getElementById('blog-admin-list');
    if (blogList.length === 0) {
        listContainer.innerHTML = '<p style="text-align:center;color:#ccc;">No blogs added yet.</p>';
        return;
    }
    listContainer.innerHTML = blogList.map(blog => `
        <div class="blog-item" id="blog-item-${blog._id}">
            <div class="blog-item-details">
                <strong>${blog.title}</strong><br>
                <small>${blog.link} ${blog.badge ? `(${blog.badge})` : ''}</small>
                <p style="font-size:0.8em; margin:0.3em 0;">${blog.summary}</p>
            </div>
            <div class="blog-item-actions" style="margin-top:0.6rem;">
                <button class="edit-blog-btn" onclick="editBlog('${blog._id}')">Edit</button>
                <button class="delete-blog-btn" onclick="deleteBlog('${blog._id}', this)">Delete</button>
            </div>
        </div>
    `).join('');
}

window.handleAddBlog = async function(event) {
    event.preventDefault();
    const linkInput = document.getElementById('blog-link');
    const titleInput = document.getElementById('blog-title');
    const summaryInput = document.getElementById('blog-summary');
    const badgeInput = document.getElementById('blog-badge');
    const submitBtn = event.target.querySelector('button[type="submit"]');

    const newBlog = {
        link: linkInput.value,
        title: titleInput.value,
        summary: summaryInput.value,
        badge: badgeInput.value || null
    };
    
    await withSpinner(submitBtn, async () => {
        const data = await performApiAction('/api/admin/blogs', {
            method: 'POST',
            body: JSON.stringify(newBlog)
        });
        showCustomMessage('Blog added successfully!', 'success');
        
        // Live DOM update
        blogList.unshift(data.blog); // Add new blog to the front of the list
        renderBlogAdminList();
        
        linkInput.value = '';
        titleInput.value = '';
        summaryInput.value = '';
        badgeInput.value = '';
    });
}

window.deleteBlog = async function(blogId, btn) {
    const confirmed = await showCustomConfirm('Are you sure you want to delete this blog?', 'Confirm Blog Deletion');
    if (!confirmed) return;
    
    const blogItem = document.getElementById(`blog-item-${blogId}`);
    
    await withSpinner(btn, async () => {
        await performApiAction(`/api/admin/blog/${blogId}`, {
            method: 'DELETE'
        });
        showCustomMessage('Blog deleted successfully!', 'success');
        
        // Live DOM update
        if (blogItem) {
            blogItem.remove();
        }
        blogList = blogList.filter(b => b._id !== blogId);
    });
}

window.editBlog = function(blogId) {
    const blog = blogList.find(b => b._id === blogId);
    if (!blog) return;
    const blogItemElement = document.getElementById(`blog-item-${blogId}`);
    if (!blogItemElement) return;
    blogItemElement.innerHTML = `
        <div class="blog-item-details" style="flex-grow:1;">
            <label for="edit-link-${blogId}" style="color:#FFD700;font-size:.9em; margin-bottom:0.1em;">Link:</label>
            <input type="text" id="edit-link-${blogId}" value="${blog.link}" style="margin-bottom:0.4em;">
            <label for="edit-title-${blogId}" style="color:#FFD700;font-size:.9em; margin-bottom:0.1em;">Title:</label>
            <input type="text" id="edit-title-${blogId}" value="${blog.title}" style="margin-bottom:0.4em;">
            <label for="edit-summary-${blogId}" style="color:#FFD700;font-size:.9em; margin-bottom:0.1em;">Summary:</label>
            <textarea id="edit-summary-${blogId}" rows="2" style="margin-bottom:0.4em;">${blog.summary}</textarea>
            <label for="edit-badge-${blogId}" style="color:#FFD700;font-size:.9em; margin-bottom:0.1em;">Badge:</label>
            <input type="text" id="edit-badge-${blogId}" value="${blog.badge || ''}" style="margin-bottom:0.4em;">
        </div>
        <div class="blog-item-actions" style="display:flex; gap:0.5rem;">
            <button class="edit-blog-btn" onclick="submitEditBlog('${blogId}', this)">Save</button>
            <button class="delete-blog-btn" onclick="fetchBlogs()">Cancel</button>
        </div>
    `;
    blogItemElement.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
    });
}

window.submitEditBlog = async function(blogId, btn) {
    const linkInput = document.getElementById(`edit-link-${blogId}`);
    const titleInput = document.getElementById(`edit-title-${blogId}`);
    const summaryInput = document.getElementById(`edit-summary-${blogId}`);
    const badgeInput = document.getElementById(`edit-badge-${blogId}`);
    const updatedBlog = {
        link: linkInput.value,
        title: titleInput.value,
        summary: summaryInput.value,
        badge: badgeInput.value || null
    };

    await withSpinner(btn, async () => {
        await performApiAction(`/api/admin/blog/${blogId}`, {
            method: 'PUT',
            body: JSON.stringify(updatedBlog)
        });
        showCustomMessage('Blog updated successfully!', 'success');
        
        // Live DOM update by re-rendering the list
        fetchBlogs();
    });
}

window.initBlogModule = function() {
    document.getElementById('add-blog-form').addEventListener('submit', handleAddBlog);
    document.querySelectorAll('.stat-btn[data-type="addblog"]').forEach(btn => {
        btn.addEventListener('click', showBlogModal);
    });
}