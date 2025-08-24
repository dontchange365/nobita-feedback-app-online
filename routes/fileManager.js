// routes/fileManager.js
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { authenticateAdminToken } = require('../middleware/auth');
const githubService = require('../services/githubService');

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

router.post('/api/admin/push-to-github', authenticateAdminToken, async (req, res) => {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const REPO_OWNER = githubService.GITHUB_REPO_OWNER;
  const REPO_NAME = githubService.GITHUB_REPO_NAME;
  const BRANCH = githubService.GITHUB_BRANCH;
  const pushMessage = req.body.message || 'Auto push from NOBI FILE MANAGER 😈';
  const baseDir = path.resolve(__dirname, '..');
  if (!GITHUB_TOKEN) return res.status(500).json({ error: 'GitHub Token is not configured.' });
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

router.get('/api/admin/push-to-github/stream', authenticateAdminToken, async (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
  res.flushHeaders();
  function sendLog(msg) { res.write(`data: ${msg}\n\n`); }
  sendLog('[Connecting to GitHub...]');
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const REPO_OWNER = githubService.GITHUB_REPO_OWNER;
  const REPO_NAME = githubService.GITHUB_REPO_NAME;
  const BRANCH = githubService.GITHUB_BRANCH;
  const pushMessage = req.query.message || 'Auto push from NOBI FILE MANAGER 😈';
  const baseDir = path.resolve(__dirname, '..');
  if (!GITHUB_TOKEN) { sendLog("[ERROR] GitHub Token is not configured."); sendLog('[GITHUB_DONE]'); return res.end(); }
  try {
    const allFiles = githubService.walkAllFiles(baseDir);
    sendLog(`[Found ${allFiles.length} files, pushing to GitHub...]`);
    let pushed = 0;
    for (const file of allFiles) {
      sendLog(`[PUSHING] ${file.path}`);
      let sha = undefined;
      try {
        const meta = await axios.get(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodeURIComponent(file.path)}?ref=${BRANCH}`, { headers: { Authorization: `token ${GITHUB_TOKEN}` } });
        sha = meta.data.sha;
      } catch (e) {
        if (e.response && e.response.status !== 404) { console.warn(`Error checking SHA for ${file.path}:`, e.response?.data || e.message); }
      }
      try {
        await axios.put(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodeURIComponent(file.path)}`, { message: pushMessage, content: Buffer.from(file.content).toString('base64'), branch: BRANCH, ...(sha ? { sha } : {}) }, { headers: { Authorization: `token ${GITHUB_TOKEN}`, 'Content-Type': 'application/json', 'Accept': 'application/vnd.github.v3+json' } });
        pushed++;
        sendLog(`[✅] ${file.path} (pushed)`);
      } catch (err) { sendLog(`[❌] ${file.path} (FAILED) — ${err.response?.data?.message || err.message}`); }
    }
    sendLog(`[COMPLETE] Pushed: ${pushed}/${allFiles.length} files.`);
    sendLog('[GITHUB_DONE]');
    res.end();
  } catch (e) {
    console.error("Critical error during GitHub SSE push:", e);
    sendLog(`[ERROR] ${e.message}`);
    sendLog('[GITHUB_DONE]');
    res.end();
  }
});

router.get('/api/admin/pull-from-github/stream', authenticateAdminToken, async (req, res) => {
    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
    res.flushHeaders();
    function sendLog(msg) { res.write(`data: ${msg}\n\n`); }
    sendLog('[Connecting to GitHub for pull...]');
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const REPO_OWNER = githubService.GITHUB_REPO_OWNER;
    const REPO_NAME = githubService.GITHUB_REPO_NAME;
    const BRANCH = githubService.GITHUB_BRANCH;
    const baseDir = path.resolve(__dirname, '..');
    if (!GITHUB_TOKEN) { sendLog("[ERROR] GitHub Token is not configured."); sendLog('[GITHUB_DONE]'); return res.end(); }
    try {
        await githubService.downloadGithubContents(REPO_OWNER, REPO_NAME, BRANCH, '', baseDir, sendLog);
        sendLog('[COMPLETE] Files successfully pulled from GitHub!');
        sendLog('[GITHUB_DONE]');
        res.end();
    } catch (e) {
        console.error("Critical error during GitHub SSE pull:", e);
        sendLog(`[ERROR] ${e.message}`);
        sendLog('[GITHUB_DONE]');
        res.end();
    }
});

router.post('/api/admin/create-page-from-template', authenticateAdminToken, async (req, res) => {
    const { pageName, pageTitle, metaDescription, metaKeywords, pageContent, inlineCss, inlineJs, websiteTitle, heroTitle, heroEmoji, heroPara } = req.body;
    if (!pageName || !pageTitle || !pageContent || !websiteTitle || !heroTitle || !heroPara) return res.status(400).json({ message: 'Page name, title, content, website title, hero title, and hero paragraph are required.' });
    const fileName = pageName.endsWith('.html') ? pageName : `${pageName}.html`;
    const filePath = path.join(BASE_DIR, 'public', fileName);
    if (filePath.includes('..') || !filePath.startsWith(path.join(BASE_DIR, 'public'))) return res.status(400).json({ message: 'Invalid page name.' });
    const templatePath = path.join(BASE_DIR, 'template.html');
    try {
        let templateContent = await fs.promises.readFile(templatePath, 'utf8');
        templateContent = templateContent.replace(/PAGE TITLE HERE/g, pageTitle);
        templateContent = templateContent.replace(/Meta description here/g, metaDescription || '');
        templateContent = templateContent.replace(/Nobita, keywords, update, new content/g, metaKeywords || 'Nobita, custom page');
        templateContent = templateContent.replace(/WEBSITE_TITLE_PLACEHOLDER/g, websiteTitle);
        templateContent = templateContent.replace(/HERO_TITLE_PLACEHOLDER/g, heroTitle);
        templateContent = templateContent.replace(/HERO_EMOJI_PLACEHOLDER/g, heroEmoji || '');
        templateContent = templateContent.replace(/HERO_PARA_PLACEHOLDER/g, heroPara);
        templateContent = templateContent.replace(/MAIN_CONTENT_PLACEHOLDER/g, pageContent);
        if (inlineCss) { templateContent = templateContent.replace('</head>', `<style>\n${inlineCss}\n</style>\n</head>`); }
        if (inlineJs) {
            const bodyEndIndex = templateContent.lastIndexOf('</body>');
            if (bodyEndIndex !== -1) { templateContent = templateContent.substring(0, bodyEndIndex) + `<script>\n${inlineJs}\n</script>\n` + templateContent.substring(bodyEndIndex); }
            else { templateContent = templateContent.replace('</html>', `<script>\n${inlineJs}\n</script>\n</html>`); }
        }
        await fs.promises.writeFile(filePath, templateContent);
        res.status(200).json({ message: `Page "${fileName}" created successfully in public folder.` });
    } catch (error) { console.error('Error creating page from template:', error); res.status(500).json({ message: 'Failed to create page from template.', error: error.message }); }
});

module.exports = router;
