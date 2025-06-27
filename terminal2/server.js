const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { exec, spawn } = require('child_process'); // Added spawn for better process control
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve frontend - Assuming terminal.html is in the same directory as server.js
app.use('/', express.static(__dirname)); // Serving from the root directory for simplicity

// Store child processes by WebSocket connection ID (or similar unique identifier)
// This is crucial for sending signals like Ctrl+C
const activeProcesses = new Map();

wss.on('connection', function connection(ws) {
  let currentDir = process.cwd(); // Track current directory per connection
  let processId = Math.random().toString(36).substring(2, 15); // Unique ID for this connection

  // Store the WebSocket connection with its ID
  activeProcesses.set(processId, null); // Initially no process running

  // Send initial welcome message and then the first prompt
  ws.send(JSON.stringify({ type: 'output', data: '\r\n\x1b[32mConnected to NOBI BOT Terminal! 😈💻\x1b[0m\r\n' }));

  // Function to send the updated prompt
  const sendPrompt = () => {
    let displayPath = currentDir === process.env.HOME ? '~' : path.basename(currentDir);
    ws.send(JSON.stringify({ type: 'prompt', data: `\x1b[33m${displayPath}$ \x1b[0m` }));
  };

  sendPrompt(); // Send initial prompt

  ws.on('message', function incoming(msg) {
    let payload;
    try {
      payload = JSON.parse(msg);
    } catch (e) {
      console.error('Invalid JSON received:', msg);
      return;
    }

    if (payload.type === 'input') {
      const command = payload.data;

      // Handle Ctrl+C signal
      if (command === '\x03') { // ASCII for Ctrl+C
        if (activeProcesses.has(processId) && activeProcesses.get(processId)) {
          console.log(`Sending SIGINT to process ${activeProcesses.get(processId).pid}`);
          activeProcesses.get(processId).kill('SIGINT'); // Send interrupt signal
          ws.send(JSON.stringify({ type: 'output', data: `^C\r\n` }));
        } else {
          ws.send(JSON.stringify({ type: 'output', data: `^C\r\n` }));
        }
        sendPrompt(); // Show new prompt after Ctrl+C
        return;
      }
      
      // Basic security warning: Do NOT run this on public servers without
      // proper command validation/sanitization or whitelisting.
      // This allows arbitrary command execution!
      console.log(`Executing command: "${command}" in dir: "${currentDir}" for connection ${processId}`);

      // Use spawn for better control over processes and signals
      const child = spawn(command, { cwd: currentDir, shell: true });
      activeProcesses.set(processId, child);

      child.stdout.on('data', (data) => {
        ws.send(JSON.stringify({ type: 'output', data: data.toString() }));
      });

      child.stderr.on('data', (data) => {
        ws.send(JSON.stringify({ type: 'output', data: data.toString() }));
      });

      child.on('close', (code) => {
        activeProcesses.set(processId, null); // Clear active process
        if (code !== 0) {
          ws.send(JSON.stringify({ type: 'output', data: `\x1b[31m[COMMAND EXITED with code ${code}]\x1b[0m\r\n` }));
        }

        // After every command, get the updated current directory
        exec('pwd', { cwd: currentDir }, (pwdErr, pwdStdout) => {
          if (!pwdErr && pwdStdout) {
            const newPath = pwdStdout.trim();
            if (newPath && newPath !== currentDir) { // Ensure newPath is not empty
              currentDir = newPath;
            }
          }
          sendPrompt(); // Always send the current path as a separate prompt type
        });
      });

      child.on('error', (err) => {
        activeProcesses.set(processId, null); // Clear active process
        let errorMessage = (err.message || '').trimStart();
        ws.send(JSON.stringify({ type: 'output', data: `\x1b[31m[ERROR] ${errorMessage}\x1b[0m\r\n` }));
        sendPrompt(); // Send prompt even on error
      });
    }
  });

  ws.on('close', () => {
    console.log(`Connection ${processId} closed.`);
    // If a process was active for this connection, try to kill it
    if (activeProcesses.has(processId) && activeProcesses.get(processId)) {
      activeProcesses.get(processId).kill(); // Kill the child process on disconnect
      console.log(`Killed child process for connection ${processId}`);
    }
    activeProcesses.delete(processId);
  });
});

const PORT = 7861;
server.listen(PORT, () => {
  console.log(`NOBI BOT Terminal running: http://localhost:${PORT}/terminal.html`);
  console.log(`\x1b[31mWARNING: This terminal allows arbitrary command execution. DO NOT expose it to the internet without proper security measures!\x1b[0m`);
});