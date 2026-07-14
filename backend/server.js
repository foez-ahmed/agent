import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { runAgent } from './agent.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const app = express();
app.use(cors());
app.use(express.json());

// Helper to resolve paths safely within the project root
function safePath(relPath) {
  if (!relPath) return ROOT_DIR;
  const resolved = path.resolve(ROOT_DIR, relPath);
  if (!resolved.startsWith(ROOT_DIR)) {
    throw new Error('Access denied: path traversal detected');
  }
  return resolved;
}

// 1. Filesystem API: List all files
app.get('/api/files/list', (req, res) => {
  try {
    const listFilesRecursively = (dir, relativeDir = '') => {
      let results = [];
      const list = fs.readdirSync(dir);
      for (const file of list) {
        if (
          file === 'node_modules' || 
          file === '.git' || 
          file === '.next' || 
          file === 'dist' || 
          file === '.agents' ||
          file === 'package-lock.json'
        ) {
          continue;
        }
        const fullPath = path.join(dir, file);
        const relPath = path.join(relativeDir, file).replace(/\\/g, '/');
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          results.push({
            name: file,
            path: relPath,
            type: 'directory',
            children: listFilesRecursively(fullPath, relPath)
          });
        } else {
          results.push({
            name: file,
            path: relPath,
            type: 'file',
            size: stat.size
          });
        }
      }
      return results.sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'directory' ? -1 : 1;
      });
    };

    const files = listFilesRecursively(ROOT_DIR);
    res.json({ success: true, files });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Filesystem API: Read file
app.post('/api/files/read', (req, res) => {
  try {
    const { path: relPath } = req.body;
    const absPath = safePath(relPath);
    if (!fs.existsSync(absPath) || fs.statSync(absPath).isDirectory()) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }
    const content = fs.readFileSync(absPath, 'utf8');
    res.json({ success: true, content });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Filesystem API: Write file
app.post('/api/files/write', (req, res) => {
  try {
    const { path: relPath, content } = req.body;
    const absPath = safePath(relPath);
    
    // Create parent directories if they don't exist
    const parentDir = path.dirname(absPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    
    fs.writeFileSync(absPath, content, 'utf8');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. Filesystem API: Create empty file/directory
app.post('/api/files/create', (req, res) => {
  try {
    const { path: relPath, type } = req.body;
    const absPath = safePath(relPath);
    
    if (type === 'directory') {
      fs.mkdirSync(absPath, { recursive: true });
    } else {
      const parentDir = path.dirname(absPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      fs.writeFileSync(absPath, '', 'utf8');
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 5. Filesystem API: Delete file/directory
app.post('/api/files/delete', (req, res) => {
  try {
    const { path: relPath } = req.body;
    const absPath = safePath(relPath);
    
    if (!fs.existsSync(absPath)) {
      return res.status(404).json({ success: false, error: 'Not found' });
    }
    
    const stat = fs.statSync(absPath);
    if (stat.isDirectory()) {
      fs.rmSync(absPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(absPath);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 6. Shell Command Execution: Stream command output
app.post('/api/command/execute', (req, res) => {
  const { command } = req.body;
  if (!command) {
    return res.status(400).json({ success: false, error: 'Command is required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const child = spawn(command, { cwd: ROOT_DIR, shell: true });

  child.stdout.on('data', (data) => {
    res.write(`data: ${JSON.stringify({ type: 'stdout', data: data.toString() })}\n\n`);
  });

  child.stderr.on('data', (data) => {
    res.write(`data: ${JSON.stringify({ type: 'stderr', data: data.toString() })}\n\n`);
  });

  child.on('error', (err) => {
    res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`);
  });

  child.on('close', (code) => {
    res.write(`data: ${JSON.stringify({ type: 'close', code })}\n\n`);
    res.end();
  });

  // Handle client disconnect by killing child process
  req.on('close', () => {
    child.kill();
  });
});

// 7. Agent Executor Endpoint: SSE stream
app.post('/api/agent/run', async (req, res) => {
  const { prompt, apiKey, model } = req.body;
  
  if (!prompt || !apiKey || !model) {
    return res.status(400).json({ success: false, error: 'Prompt, apiKey, and model are required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendEvent = (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  try {
    await runAgent(prompt, apiKey, model, sendEvent);
    sendEvent({ type: 'done', summary: 'Agent task complete!' });
    res.end();
  } catch (error) {
    sendEvent({ type: 'error', error: error.message });
    res.end();
  }
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`NIMbus Coder backend listening on http://localhost:${PORT}`);
});
