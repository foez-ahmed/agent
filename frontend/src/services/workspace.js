// Dual-Mode Workspace Service (Express API fallback to Browser File System Access API / VFS)

let isServerMode = true;
let rootDirectoryHandle = null;

// Virtual Filesystem (VFS) fallback for Safari/Firefox or unauthorized access
let virtualFilesystem = {
  'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Hello NIMbus</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <h1>Stopwatch Utility</h1>
  <div class="timer">00:00:00</div>
  <button id="start">Start</button>
  <button id="stop">Stop</button>
  <script src="script.js"></script>
</body>
</html>`,
  'style.css': `body {
  background: #111;
  color: #fff;
  font-family: sans-serif;
  text-align: center;
  padding: 50px;
}
.timer {
  font-size: 3rem;
  margin: 20px 0;
  font-family: monospace;
}`,
  'script.js': `console.log("Stopwatch ready!");`
};

// Check if Express backend is running
export async function detectWorkspaceMode() {
  try {
    const res = await fetch('/api/files/list');
    const data = await res.json();
    isServerMode = data.success === true;
  } catch (e) {
    isServerMode = false;
  }
  return isServerMode;
}

export function getIsServerMode() {
  return isServerMode;
}

export function setDirectoryHandle(handle) {
  rootDirectoryHandle = handle;
  isServerMode = false; // Force browser mode if directory picker is explicitly loaded
}

export function getHasDirectoryHandle() {
  return !!rootDirectoryHandle;
}

// -------------------------------------------------------------
// Filesystem Operations
// -------------------------------------------------------------

// List files recursively
export async function listWorkspaceFiles() {
  if (isServerMode) {
    const res = await fetch('/api/files/list');
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data.files;
  }

  if (rootDirectoryHandle) {
    return await listDirectoryHandleFiles(rootDirectoryHandle);
  }

  // Fallback: Build tree from Virtual Filesystem (VFS)
  return buildTreeFromVfs();
}

// Read file content
export async function readWorkspaceFile(path) {
  if (isServerMode) {
    const res = await fetch('/api/files/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data.content;
  }

  if (rootDirectoryHandle) {
    const fileHandle = await getFileHandleByPath(rootDirectoryHandle, path);
    const file = await fileHandle.getFile();
    return await file.text();
  }

  // VFS Read
  if (virtualFilesystem[path] !== undefined) {
    return virtualFilesystem[path];
  }
  throw new Error(`File not found in Virtual Workspace: ${path}`);
}

// Write file content
export async function writeWorkspaceFile(path, content) {
  if (isServerMode) {
    const res = await fetch('/api/files/write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, content })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return true;
  }

  if (rootDirectoryHandle) {
    const fileHandle = await getFileHandleByPath(rootDirectoryHandle, path, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
    return true;
  }

  // VFS Write
  virtualFilesystem[path] = content;
  return true;
}

// Create new file or folder
export async function createWorkspaceItem(path, type) {
  if (isServerMode) {
    const res = await fetch('/api/files/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, type })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return true;
  }

  if (rootDirectoryHandle) {
    if (type === 'directory') {
      await getDirectoryHandleByPath(rootDirectoryHandle, path, { create: true });
    } else {
      await getFileHandleByPath(rootDirectoryHandle, path, { create: true });
    }
    return true;
  }

  // VFS Create
  if (type === 'directory') {
    // VFS is flat, directory creation is implicit in file paths. Just a dummy key if needed
  } else {
    virtualFilesystem[path] = '';
  }
  return true;
}

// Delete file or folder
export async function deleteWorkspaceItem(path) {
  if (isServerMode) {
    const res = await fetch('/api/files/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return true;
  }

  if (rootDirectoryHandle) {
    // Navigate to parent handle and delete
    const parts = path.split('/');
    const targetName = parts.pop();
    const parentPath = parts.join('/');
    const parentHandle = parentPath 
      ? await getDirectoryHandleByPath(rootDirectoryHandle, parentPath) 
      : rootDirectoryHandle;
    
    await parentHandle.removeEntry(targetName, { recursive: true });
    return true;
  }

  // VFS Delete
  delete virtualFilesystem[path];
  // Also clean up any subfiles if directory delete was targeted
  for (const k of Object.keys(virtualFilesystem)) {
    if (k.startsWith(path + '/')) {
      delete virtualFilesystem[k];
    }
  }
  return true;
}

// -------------------------------------------------------------
// Command execution (SSE stream connection or Mock)
// -------------------------------------------------------------
export async function executeWorkspaceCommand(command, onProgress) {
  if (isServerMode) {
    const response = await fetch('/api/command/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command })
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let accumulated = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const event = JSON.parse(line.slice(6));
          if (event.type === 'stdout' || event.type === 'stderr') {
            onProgress({ type: 'command_output', data: event.data });
            accumulated += event.data;
          }
        }
      }
    }
    return `Command finished. Output:\n${accumulated}`;
  }

  // Browser Mock command execution
  onProgress({ type: 'command_output', data: `[NIMbus Console] Running: ${command}\n` });
  
  if (command.includes('http.server') || command.includes('npm run') || command.includes('serve')) {
    onProgress({ 
      type: 'command_output', 
      data: `[NIMbus Console] Web Server simulation started successfully.\n` + 
            `[NIMbus Console] Local visual server is accessible inside Browser Preview tab!\n` +
            `[NIMbus Console] Simulation running at http://localhost:8080/\n`
    });
    return `Server started at http://localhost:8080/`;
  }

  onProgress({ type: 'command_output', data: `[NIMbus Console] Command executed (simulation mode).\n` });
  return `Command executed successfully. (Simulated execution on static host)`;
}

// -------------------------------------------------------------
// Directory Handle Recurser helpers
// -------------------------------------------------------------
async function listDirectoryHandleFiles(dirHandle, relativeDir = '') {
  let results = [];
  for await (const entry of dirHandle.values()) {
    if (
      entry.name === 'node_modules' || 
      entry.name === '.git' || 
      entry.name === 'dist' ||
      entry.name === '.agents' ||
      entry.name === 'package-lock.json'
    ) {
      continue;
    }
    
    const relPath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
    
    if (entry.kind === 'directory') {
      const subTree = await listDirectoryHandleFiles(entry, relPath);
      results.push({
        name: entry.name,
        path: relPath,
        type: 'directory',
        children: subTree
      });
    } else {
      const file = await entry.getFile();
      results.push({
        name: entry.name,
        path: relPath,
        type: 'file',
        size: file.size
      });
    }
  }
  return results.sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === 'directory' ? -1 : 1;
  });
}

async function getFileHandleByPath(dirHandle, relPath, options = {}) {
  const parts = relPath.split('/');
  let current = dirHandle;
  
  for (let i = 0; i < parts.length - 1; i++) {
    current = await current.getDirectoryHandle(parts[i], options);
  }
  
  return await current.getFileHandle(parts[parts.length - 1], options);
}

async function getDirectoryHandleByPath(dirHandle, relPath, options = {}) {
  const parts = relPath.split('/');
  let current = dirHandle;
  for (const part of parts) {
    current = await current.getDirectoryHandle(part, options);
  }
  return current;
}

// -------------------------------------------------------------
// VFS Tree Generator helper
// -------------------------------------------------------------
function buildTreeFromVfs() {
  const results = [];
  const filesList = Object.keys(virtualFilesystem);

  for (const filePath of filesList) {
    const parts = filePath.split('/');
    let currentLevel = results;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const partialPath = parts.slice(0, i + 1).join('/');
      const isLast = i === parts.length - 1;

      let existing = currentLevel.find(item => item.name === part);

      if (!existing) {
        if (isLast) {
          existing = {
            name: part,
            path: partialPath,
            type: 'file',
            size: virtualFilesystem[filePath].length
          };
          currentLevel.push(existing);
        } else {
          existing = {
            name: part,
            path: partialPath,
            type: 'directory',
            children: []
          };
          currentLevel.push(existing);
        }
      }
      if (existing.type === 'directory') {
        currentLevel = existing.children;
      }
    }
  }

  // Recursively sort tree
  const sortTree = (nodes) => {
    nodes.sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === 'directory' ? -1 : 1;
    });
    for (const node of nodes) {
      if (node.children) sortTree(node.children);
    }
  };
  
  sortTree(results);
  return results;
}
