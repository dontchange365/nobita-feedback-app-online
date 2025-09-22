// routes/fileManager.js
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { authenticateAdminToken } = require('../middleware/auth');
const githubService = require('../services/githubService');
const { upload, cloudinary } = require('../middleware/fileUpload');

const BASE_DIR = path.resolve(__dirname, '..');

const getFileIcon = (file) => {
    const ext = path.extname(file).toLowerCase().replace('.', '');
    const map = { js: 'js', json: 'json', html: 'html', css: 'css', md: 'md', txt: 'txt', env: 'env', png: 'image', jpg: 'image', jpeg: 'image', svg: 'image', mp3: 'audio', wav: 'audio', mp4: 'video', mov: 'video', zip: 'zip', rar: 'zip', pdf: 'pdf', doc: 'doc', docx: 'doc', xls: 'xls', xlsx: 'xls' };
    return map[ext] || 'file';
};

router.get('/api/file-manager', authenticateAdminToken, (req, res) => {
    let currPath = req.query.path || '/';
    let fullPath = path.join(BASE_DIR, currPath);
    fs.readdir(fullPath, { withFileTypes: true }, (err, files) => {
        if (err) return res.status(500).json({ error: err.message });
        let content = files.map(f => {
            let itemFullPath = path.join(fullPath, f.name);
            let stat;
            try { stat = fs.statSync(itemFullPath); } catch (statErr) { return { name: f.name, type: f.isDirectory() ? 'folder' : 'file', icon: f.isDirectory() ? 'folder' : getFileIcon(f.name), size: null, mtime: null }; }
            return { name: f.name, type: f.isDirectory() ? 'folder' : 'file', icon: f.isDirectory() ? 'folder' : getFileIcon(f.name), size: f.isDirectory() ? null : stat.size, mtime: stat.mtime };
        });
        res.json({ path: currPath, parent: currPath === '/' ? null : path.dirname(currPath), content: content });
    });
});

router.post('/api/file-manager/folder', authenticateAdminToken, (req, res) => {
    const { path: dirPath, name } = req.body;
    if (!name) return res.status(400).json({ error: 'Folder name is required.' });
    let target = path.join(BASE_DIR, dirPath, name);
    fs.mkdir(target, { recursive: false }, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ ok: 1 });
    });
});

router.post('/api/file-manager/file', authenticateAdminToken, (req, res) => {
    const { path: filePath, name, content, overwrite } = req.body;
    if (!name) return res.status(400).json({ error: 'File name is required.' });
    let target = path.join(BASE_DIR, filePath, name);
    if (fs.existsSync(target) && !(overwrite === true || overwrite === "true")) return res.status(409).json({ error: 'File already exists.', exists: true });
    fs.writeFile(target, content || '', (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ ok: 1 });
    });
});

router.get('/api/file-manager/file', authenticateAdminToken, (req, res) => {
    const { path: filePath } = req.query;
    let target = path.join(BASE_DIR, filePath);
    if (!fs.existsSync(target)) return res.status(404).json({ error: 'File not found.' });
    fs.readFile(target, 'utf-8', (err, data) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ content: data });
    });
});

router.put('/api/file-manager/file', authenticateAdminToken, (req, res) => {
    const { path: filePath, content } = req.body;
    let target = path.join(BASE_DIR, filePath);
    fs.writeFile(target, content, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ ok: 1 });
    });
});

router.delete('/api/file-manager', authenticateAdminToken, (req, res) => {
    const { path: targetPath } = req.query;
    let target = path.join(BASE_DIR, targetPath);
    if (!fs.existsSync(target)) return res.status(404).json({ error: 'Item not found.' });
    fs.stat(target, (err, stat) => {
        if (err) return res.status(500).json({ error: err.message });
        if (stat.isDirectory()) {
            fs.rm(target, { recursive: true, force: true }, (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ ok: 1 });
            });
        } else {
            fs.unlink(target, (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ ok: 1 });
            });
        }
    });
});

// CHANGE START: Updated push-to-github route
router.post('/api/admin/push-to-github', authenticateAdminToken, async (req, res) => {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const REPO_OWNER = githubService.GITHUB_REPO_OWNER;
  const REPO_NAME = githubService.GITHUB_REPO_NAME;
  const BRANCH = githubService.GITHUB_BRANCH;
  const pushMessage = req.body.message || 'Auto push from NOBI FILE MANAGER 😈';
  const baseDir = path.resolve(__dirname, '..');
  
  // FIX: Push karne se pehle GITHUB_TOKEN ko check karein
  if (!GITHUB_TOKEN) {
    return res.status(500).json({ error: 'GitHub Token is not configured. Please check your .env file.' });
  }
  
  try {
    const allFiles = githubService.walkAllFiles(baseDir);
    for (const file of allFiles) {
      let sha = undefined;
      try {
        const meta = await axios.get( `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodeURIComponent(file.path)}?ref=${BRANCH}`, { headers: { Authorization: `token ${GITHUB_TOKEN}` } } );
        sha = meta.data.sha;
      } catch (e) {
        if (e.response && e.response.status === 404) { console.log(`File ${file.path} not found, will create.`); } else { console.warn(`Error checking SHA for ${file.path}:`, e.response?.data || e.message); }
      }
      await axios.put( `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodeURIComponent(file.path)}`, { message: pushMessage, content: Buffer.from(file.content).toString('base64'), branch: BRANCH, ...(sha ? { sha } : {}) }, { headers: { Authorization: `token ${GITHUB_TOKEN}`, 'Content-Type': 'application/json', 'Accept': 'application/vnd.github.v3+json' } } );
      console.log(`Pushed: ${file.path}`);
    }
    res.json({ success: true, totalFilesPushed: allFiles.length, message: 'All files successfully pushed to GitHub!' });
  } catch (err) {
    console.error('GitHub push error:', err.response?.data || err.message || err);
    res.status(500).json({ error: 'GitHub push failed', detail: err.response?.data?.message || err.message, status: err.response?.status });
  }
});
// CHANGE END

// CHANGE START: Updated pull-from-github route
router.post('/api/admin/pull-from-github', authenticateAdminToken, async (req, res) => {
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const REPO_OWNER = githubService.GITHUB_REPO_OWNER;
    const REPO_NAME = githubService.GITHUB_REPO_NAME;
    const BRANCH = githubService.GITHUB_BRANCH;
    const baseDir = path.resolve(__dirname, '..');
    
    // FIX: Pull karne se pehle GITHUB_TOKEN ko check karein
    if (!GITHUB_TOKEN) {
      return res.status(500).json({ error: 'GitHub Token is not configured. Please check your .env file.' });
    }
    
    try {
        await githubService.downloadGithubContents(REPO_OWNER, REPO_NAME, BRANCH, '', baseDir, sendLog);
        res.json({ success: true, message: 'All files successfully pulled from GitHub!' });
    } catch (e) {
        console.error("Critical error during GitHub pull:", e);
        res.status(500).json({ error: 'GitHub pull failed', detail: e.message });
    }
});
// CHANGE END


router.post('/api/admin/avatars/upload', authenticateAdminToken, upload.array('avatars', 10), async (req, res) => {
    return res.status(400).json({ error: 'This route is deprecated. Please use the new single file upload route.' });
});

router.post('/api/admin/avatars/upload-single', authenticateAdminToken, upload.single('avatar'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file selected for upload.' });
    }
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
        return res.status(500).json({ error: 'Cloudinary environment variables are not set.' });
    }
    try {
        const result = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream({
                folder: 'nobita_avatars_library',
                public_id: path.parse(req.file.originalname).name,
                tags: ['avatar_library'],
                resource_type: 'image'
            }, (error, result) => {
                if (error) {
                    console.error('Cloudinary upload error:', error);
                    return reject(error);
                }
                resolve(result.secure_url);
            });
            stream.end(req.file.buffer);
        });
        res.status(200).json({ message: 'Avatar uploaded successfully!', url: result });
    } catch (error) {
        console.error('Single upload error:', error);
        res.status(500).json({ error: 'Failed to upload avatar.' });
    }
});

module.exports = router;