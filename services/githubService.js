// services/githubService.js
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const simpleGit = require('simple-git');

const GITHUB_REPO_OWNER = 'dontchange365';
const GITHUB_REPO_NAME = 'nobita-feedback-app-online';
const GITHUB_BRANCH = 'main';

const walkAllFiles = (dir, base = '', arr = []) => {
    fs.readdirSync(dir).forEach(file => {
        const filePath = path.join(dir, file);
        const relPath = path.join(base, file);
        const excludedPaths = ['node_modules', '.git', '.env', 'package-lock.json', 'yarn.lock', 'Thumbs.db', '.DS_Store', 'nbproject', 'public/admin-panel/file-manager.html', '_'];
        const shouldExclude = excludedPaths.some(exclude => relPath.includes(exclude));
        if (shouldExclude) { console.log(`Skipping excluded path: ${relPath}`); return; }
        if (fs.statSync(filePath).isDirectory()) {
            walkAllFiles(filePath, relPath, arr);
        } else {
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                arr.push({ path: relPath.replace(/\\/g, '/'), content: content });
            } catch (e) {
                console.warn(`Could not read file ${filePath} as UTF-8. Skipping.`);
            }
        }
    });
    return arr;
};

// CHANGE: downloadGithubContents function ko update karein taaki woh structured data bheje
const downloadGithubContents = async (owner, repo, branch, repoPath, localPath, sendLog) => {
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    if (!GITHUB_TOKEN) { throw new Error('GitHub Token is not configured for pull operations.'); }
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${repoPath}?ref=${branch}`;
    let response;
    try {
        response = await axios.get(url, {
            headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3.raw' },
            responseType: 'arraybuffer'
        });
    } catch (error) {
        if (error.response && error.response.status === 404) { sendLog({ type: 'skipped', file: repoPath, status: 'pull' }); return; }
        throw error;
    }
    const contentType = response.headers['content-type'];
    if (contentType.includes('application/json')) {
        const data = JSON.parse(Buffer.from(response.data).toString('utf8'));
        sendLog({ type: 'start', file: repoPath, status: 'pull' });
        if (!fs.existsSync(localPath)) { fs.mkdirSync(localPath, { recursive: true }); }
        for (const item of data) {
            const newRepoPath = item.path;
            const newLocalPath = path.join(localPath, item.name);
            await downloadGithubContents(owner, repo, branch, newRepoPath, newLocalPath, sendLog);
        }
    } else {
        sendLog({ type: 'start', file: repoPath, status: 'pull' });
        fs.writeFileSync(localPath, response.data);
        sendLog({ type: 'success', file: repoPath, status: 'pull' });
    }
};

module.exports = {
    walkAllFiles,
    downloadGithubContents,
    GITHUB_REPO_OWNER,
    GITHUB_REPO_NAME,
    GITHUB_BRANCH
};