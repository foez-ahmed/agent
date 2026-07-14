import React, { useState, useEffect, useRef } from 'react';
import FileExplorer from './components/FileExplorer';
import CodeEditor from './components/CodeEditor';
import ChatPanel from './components/ChatPanel';
import TerminalPanel from './components/TerminalPanel';
import PreviewPanel from './components/PreviewPanel';
import { 
  detectWorkspaceMode, 
  getIsServerMode, 
  setDirectoryHandle, 
  getHasDirectoryHandle,
  listWorkspaceFiles,
  readWorkspaceFile,
  writeWorkspaceFile,
  createWorkspaceItem,
  deleteWorkspaceItem,
  executeWorkspaceCommand
} from './services/workspace';
import { Terminal, Globe, Key, Settings, Cpu, FolderOpen, AlertCircle } from 'lucide-react';

const MODELS = [
  { value: 'meta/llama-3.3-70b-instruct', label: '(Recommended) Llama 3.3 70B' },
  { value: 'deepseek-ai/deepseek-r1', label: 'DeepSeek R1' },
  { value: 'meta/llama-3.1-405b-instruct', label: 'Llama 3.1 405B' },
  { value: 'nvidia/llama-3.1-nemotron-70b-instruct', label: 'Nemotron 3.1 70B' },
  { value: 'nvidia/nemotron-3-ultra-550b-a55b', label: 'Nemotron-3 Ultra 550B' }
];

const SYSTEM_PROMPT = `You are NIMbus Coder, an advanced AI coding assistant running inside a local workspace environment.
You can read/write files and execute command-line instructions to build websites, utilities, scripts, or debug issues.

You have access to the following tools:
1. list_files: Lists all files in the workspace (excluding build folders).
   Format:
   <tool_call>
     <name>list_files</name>
   </tool_call>

2. read_file: Reads the contents of a file.
   Format:
   <tool_call>
     <name>read_file</name>
     <arguments>
       <path>relative/path/to/file</path>
     </arguments>
   </tool_call>

3. write_file: Writes content to a file, creating parent directories automatically. Wrap file content inside <![CDATA[ ... ]]> block.
   Format:
   <tool_call>
     <name>write_file</name>
     <arguments>
       <path>relative/path/to/file</path>
       <content><![CDATA[
FILE CONTENTS HERE
]]]]><![CDATA[></content>
     </arguments>
   </tool_call>

4. execute_command: Runs a command in the shell. If starting a server, it will run in the background.
   Format:
   <tool_call>
     <name>execute_command</name>
     <arguments>
       <command>command to run</command>
     </arguments>
   </tool_call>

5. finish_task: Ends the agent loop with a summary of accomplishment.
   Format:
   <tool_call>
     <name>finish_task</name>
     <arguments>
       <message>Task summary</message>
     </arguments>
   </tool_call>

CRITICAL RULES:
- You must explain your thought process in a <thought>...</thought> block BEFORE issuing a <tool_call>...</tool_call> block.
- Always execute exactly one tool call per turn. Do not call multiple tools.
- Never output anything outside of the <thought> and <tool_call> blocks.
- If a command fails or files are missing, investigate and modify/fix files accordingly.
`;

function parseXmlTags(text) {
  const thoughtMatch = text.match(/<thought>([\s\S]*?)<\/thought>/);
  const thought = thoughtMatch ? thoughtMatch[1].trim() : '';

  const toolCallMatch = text.match(/<tool_call>([\s\S]*?)<\/tool_call>/);
  if (!toolCallMatch) {
    return { thought, toolCall: null };
  }

  const toolCallContent = toolCallMatch[1];
  const nameMatch = toolCallContent.match(/<name>(.*?)<\/name>/);
  const name = nameMatch ? nameMatch[1].trim() : '';

  const args = {};
  if (name === 'read_file' || name === 'write_file') {
    const pathMatch = toolCallContent.match(/<path>(.*?)<\/path>/);
    args.path = pathMatch ? pathMatch[1].trim() : '';
  }
  if (name === 'write_file') {
    const cdataMatch = toolCallContent.match(/<content><!\[CDATA\[([\s\S]*?)\]\]><\/content>/);
    if (cdataMatch) {
      args.content = cdataMatch[1];
    } else {
      const contentMatch = toolCallContent.match(/<content>([\s\S]*?)<\/content>/);
      args.content = contentMatch ? contentMatch[1] : '';
    }
  }
  if (name === 'execute_command') {
    const commandMatch = toolCallContent.match(/<command>([\s\S]*?)<\/command>/);
    args.command = commandMatch ? commandMatch[1].trim() : '';
  }
  if (name === 'finish_task') {
    const msgMatch = toolCallContent.match(/<message>([\s\S]*?)<\/message>/);
    args.message = msgMatch ? msgMatch[1].trim() : '';
  }

  return {
    thought,
    toolCall: { name, arguments: args }
  };
}

export default function App() {
  // App settings and configs
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('nimbus_api_key') || '');
  const [model, setModel] = useState(() => localStorage.getItem('nimbus_model') || MODELS[0].value);
  const [showSettings, setShowSettings] = useState(!localStorage.getItem('nimbus_api_key'));
  const [isServer, setIsServer] = useState(true);
  const [connectedFolder, setConnectedFolder] = useState('');

  // Workspace Files state
  const [files, setFiles] = useState([]);
  const [openFiles, setOpenFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [fileContent, setFileContent] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  // Agent State
  const [agentMessages, setAgentMessages] = useState([]);
  const [agentState, setAgentState] = useState('idle'); // 'idle' | 'running' | 'error'
  const [statusMessage, setStatusMessage] = useState('');
  const [currentThought, setCurrentThought] = useState('');
  const [currentOutputText, setCurrentOutputText] = useState('');
  const [activeCommand, setActiveCommand] = useState('');
  const [commandLogs, setCommandLogs] = useState('');
  const agentAbortController = useRef(null);

  // Interactive Terminal
  const [terminalLogs, setTerminalLogs] = useState('');
  const [isExecutingTerminal, setIsExecutingTerminal] = useState(false);
  const [activeTerminalCommand, setActiveTerminalCommand] = useState('');
  const terminalAbortController = useRef(null);

  // Layout selection
  const [rightTab, setRightTab] = useState('terminal');

  // Detect and fetch files
  const initializeWorkspace = async () => {
    const serverRunning = await detectWorkspaceMode();
    setIsServer(serverRunning);
    await fetchFiles();
  };

  useEffect(() => {
    initializeWorkspace();
  }, []);

  const fetchFiles = async () => {
    try {
      const workspaceFiles = await listWorkspaceFiles();
      setFiles(workspaceFiles);
    } catch (e) {
      console.error('Failed to load file list', e);
    }
  };

  // Directory picker integration
  const handleConnectFolder = async () => {
    try {
      if (!window.showDirectoryPicker) {
        alert("Your browser does not support the File System Access API. Please use a Chromium-based browser (Chrome, Edge, Opera) or continue with the Virtual Sandbox VFS.");
        return;
      }
      const handle = await window.showDirectoryPicker({
        mode: 'readwrite'
      });
      setDirectoryHandle(handle);
      setConnectedFolder(handle.name);
      setIsServer(false);
      await fetchFiles();
    } catch (err) {
      console.error('Folder picker cancelled or rejected', err);
    }
  };

  // Save configurations
  const saveConfig = (keyVal, modelVal) => {
    setApiKey(keyVal);
    setModel(modelVal);
    localStorage.setItem('nimbus_api_key', keyVal);
    localStorage.setItem('nimbus_model', modelVal);
    setShowSettings(false);
  };

  // Open file in Editor
  const handleFileSelect = async (path) => {
    if (!openFiles.includes(path)) {
      setOpenFiles(prev => [...prev, path]);
    }
    setActiveFile(path);
    
    if (fileContent[path] === undefined) {
      try {
        const content = await readWorkspaceFile(path);
        setFileContent(prev => ({ ...prev, [path]: content }));
      } catch (err) {
        console.error('Failed to read file', err);
      }
    }
  };

  const handleTabClose = (path) => {
    const updated = openFiles.filter(f => f !== path);
    setOpenFiles(updated);
    if (activeFile === path) {
      setActiveFile(updated.length > 0 ? updated[updated.length - 1] : null);
    }
  };

  const handleContentChange = (path, content) => {
    setFileContent(prev => ({ ...prev, [path]: content }));
  };

  // Save active file
  const handleSaveFile = async () => {
    if (!activeFile) return;
    setIsSaving(true);
    try {
      await writeWorkspaceFile(activeFile, fileContent[activeFile]);
      fetchFiles();
    } catch (err) {
      console.error('Save failed', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Ctrl+S key listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSaveFile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFile, fileContent]);

  // Create file or folder
  const handleCreateFile = async (path, type) => {
    try {
      await createWorkspaceItem(path, type);
      fetchFiles();
      if (type === 'file') {
        handleFileSelect(path);
      }
    } catch (err) {
      console.error('Creation failed', err);
    }
  };

  // Delete file or folder
  const handleDeleteFile = async (path) => {
    if (!confirm(`Are you sure you want to delete ${path}?`)) return;
    try {
      await deleteWorkspaceItem(path);
      handleTabClose(path);
      setFileContent(prev => {
        const updated = { ...prev };
        delete updated[path];
        return updated;
      });
      fetchFiles();
    } catch (err) {
      console.error('Deletion failed', err);
    }
  };

  // Interactive Terminal Runner
  const handleRunTerminalCommand = async (command) => {
    setIsExecutingTerminal(true);
    setActiveTerminalCommand(command);
    setTerminalLogs(prev => prev + `\n$ ${command}\n`);
    setRightTab('terminal');

    try {
      const output = await executeWorkspaceCommand(command, (event) => {
        setTerminalLogs(prev => prev + event.data);
      });
      setTerminalLogs(prev => prev + `\n${output}\n`);
      fetchFiles();
    } catch (err) {
      setTerminalLogs(prev => prev + `\n[Execution failed: ${err.message}]\n`);
    } finally {
      setIsExecutingTerminal(false);
      setActiveTerminalCommand('');
    }
  };

  // Direct Client-side Agent Loop (Runs in static mode)
  const runClientAgent = async (prompt, signal) => {
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt }
    ];

    let loopCount = 0;
    const maxLoops = 15;
    let currentTurnThoughts = '';
    let currentTurnToolCalls = [];

    while (loopCount < maxLoops) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
      loopCount++;
      
      setStatusMessage(`Starting agent step ${loopCount}...`);
      setCurrentThought('');
      setCurrentOutputText('');
      setCommandLogs('');
      setActiveCommand('');

      setStatusMessage(`Calling NVIDIA NIM completions (${model})...`);

      let responseText = '';
      
      const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: messages,
          temperature: 0.2,
          stream: true
        }),
        signal
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`NVIDIA API HTTP ${response.status}: ${errBody || response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          const cleanLine = line.trim();
          if (cleanLine.startsWith('data: ')) {
            if (cleanLine.includes('[DONE]')) continue;
            try {
              const parsed = JSON.parse(cleanLine.slice(6));
              const text = parsed.choices[0]?.delta?.content || '';
              responseText += text;
              setCurrentOutputText(prev => prev + text);
            } catch (e) {}
          }
        }
      }

      const { thought, toolCall } = parseXmlTags(responseText);
      
      if (thought) {
        currentTurnThoughts = thought;
        setCurrentThought(thought);
      }

      if (!toolCall) {
        messages.push({ role: 'assistant', content: responseText });
        messages.push({ role: 'user', content: 'Please output your response using the XML <thought> and <tool_call> tags.' });
        continue;
      }

      setStatusMessage(`Running tool: ${toolCall.name}...`);
      
      if (toolCall.name === 'execute_command') {
        setActiveCommand(toolCall.arguments.command);
        setRightTab('terminal');
        setTerminalLogs(prev => prev + `\n[Agent Run] $ ${toolCall.arguments.command}\n`);
      }

      let result = '';
      try {
        if (toolCall.name === 'list_files') {
          const filesFlat = await listWorkspaceFiles();
          // Convert tree structure to flat text list for model ease
          const flattenTree = (nodes) => {
            let list = [];
            for (const n of nodes) {
              if (n.type === 'directory') {
                list.push(...flattenTree(n.children));
              } else {
                list.push(n.path);
              }
            }
            return list;
          };
          const paths = flattenTree(filesFlat);
          result = paths.length > 0 ? paths.join('\n') : '(no files found)';
        } else if (toolCall.name === 'read_file') {
          result = await readWorkspaceFile(toolCall.arguments.path);
        } else if (toolCall.name === 'write_file') {
          await writeWorkspaceFile(toolCall.arguments.path, toolCall.arguments.content);
          result = `Success: Wrote file: ${toolCall.arguments.path}`;
          
          // Auto-sync files in editor if open
          const pathWritten = toolCall.arguments.path;
          if (openFiles.includes(pathWritten)) {
            const updatedContent = await readWorkspaceFile(pathWritten);
            setFileContent(prev => ({ ...prev, [pathWritten]: updatedContent }));
          }
        } else if (toolCall.name === 'execute_command') {
          result = await executeWorkspaceCommand(toolCall.arguments.command, (e) => {
            setCommandLogs(prev => prev + e.data);
            setTerminalLogs(prev => prev + e.data);
          });
        } else if (toolCall.name === 'finish_task') {
          setAgentMessages(prev => [
            ...prev,
            {
              role: 'assistant',
              thought: currentTurnThoughts,
              toolCalls: [...currentTurnToolCalls],
              message: toolCall.arguments.message
            }
          ]);
          setStatusMessage('');
          setCurrentThought('');
          setCurrentOutputText('');
          setAgentState('idle');
          return;
        } else {
          result = `Error: Unknown tool: ${toolCall.name}`;
        }
      } catch (err) {
        result = `Error executing tool: ${err.message}`;
      }

      currentTurnToolCalls.push({
        id: Date.now() + Math.random(),
        name: toolCall.name,
        args: toolCall.arguments || {},
        result: result
      });

      setActiveCommand('');
      setCommandLogs('');
      await fetchFiles();

      messages.push({ role: 'assistant', content: responseText });
      messages.push({ role: 'user', content: `<tool_result>\n${result}\n</tool_result>` });
    }

    throw new Error('Agent reached maximum loop threshold of 15 steps.');
  };

  // Run Agent Task trigger
  const handleRunAgentTask = async (prompt) => {
    if (!apiKey) {
      setShowSettings(true);
      alert('Please configure your NVIDIA API Key in settings first.');
      return;
    }

    setAgentState('running');
    setStatusMessage('Initializing Agent...');
    setCurrentThought('');
    setCurrentOutputText('');
    setCommandLogs('');
    setActiveCommand('');

    setAgentMessages(prev => [...prev, { role: 'user', content: prompt }]);
    agentAbortController.current = new AbortController();

    try {
      if (isServer) {
        // Local Server SSE Stream mode
        const response = await fetch('/api/agent/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, apiKey, model }),
          signal: agentAbortController.current.signal
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let currentTurnThoughts = '';
        let currentTurnToolCalls = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop();

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const event = JSON.parse(line.slice(6));
              if (event.type === 'loop_start') {
                setStatusMessage(`Starting agent step ${event.loop}...`);
                setCurrentThought('');
                setCurrentOutputText('');
                setCommandLogs('');
                setActiveCommand('');
              } else if (event.type === 'status') {
                setStatusMessage(event.message);
              } else if (event.type === 'chunk') {
                setCurrentOutputText(prev => prev + event.text);
              } else if (event.type === 'thought') {
                currentTurnThoughts = event.text;
                setCurrentThought(event.text);
              } else if (event.type === 'tool_start') {
                setStatusMessage(`Running tool: ${event.name}...`);
                if (event.name === 'execute_command') {
                  setActiveCommand(event.arguments.command);
                  setRightTab('terminal');
                  setTerminalLogs(prev => prev + `\n[Agent Run] $ ${event.arguments.command}\n`);
                }
              } else if (event.type === 'cmd_progress') {
                if (event.data.type === 'command_output') {
                  setCommandLogs(prev => prev + event.data.data);
                  setTerminalLogs(prev => prev + event.data.data);
                }
              } else if (event.type === 'tool_end') {
                currentTurnToolCalls.push({
                  id: Date.now() + Math.random(),
                  name: event.name,
                  args: event.arguments || {},
                  result: event.result
                });
                setActiveCommand('');
                setCommandLogs('');
                fetchFiles();
                if (event.name === 'write_file' && openFiles.includes(event.arguments.path)) {
                  const content = await readWorkspaceFile(event.arguments.path);
                  setFileContent(prev => ({ ...prev, [event.arguments.path]: content }));
                }
              } else if (event.type === 'finish') {
                setAgentMessages(prev => [
                  ...prev,
                  {
                    role: 'assistant',
                    thought: currentTurnThoughts,
                    toolCalls: [...currentTurnToolCalls],
                    message: event.message
                  }
                ]);
                setStatusMessage('');
                setCurrentThought('');
                setCurrentOutputText('');
                setAgentState('idle');
              } else if (event.type === 'error') {
                setAgentState('error');
                setStatusMessage(`Loop failed: ${event.error}`);
              }
            }
          }
        }
      } else {
        // Direct browser client-side execution loop (Static mode)
        await runClientAgent(prompt, agentAbortController.current.signal);
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        setStatusMessage('Stopped by user.');
        setAgentState('idle');
      } else {
        setStatusMessage(`Error: ${err.message}`);
        setAgentState('error');
      }
    }
  };

  const handleCancelAgent = () => {
    if (agentAbortController.current) {
      agentAbortController.current.abort();
    }
  };

  return (
    <div className="app-container">
      {/* Header Bar */}
      <header className="main-header">
        <div className="header-brand">
          <div className="brand-logo">⚡</div>
          <div className="brand-name">
            <h1>NIMbus Coder</h1>
            <span className="brand-badge">NVIDIA NIM Agent</span>
          </div>
        </div>

        {/* Static Hosting Status alerts */}
        <div className="workspace-status-indicator">
          {isServer ? (
            <div className="status-label server">
              <Cpu size={12} />
              <span>Server Mode</span>
            </div>
          ) : (
            <div className="status-label static">
              <AlertCircle size={12} />
              <span>Static Client Mode</span>
              {connectedFolder ? (
                <span className="folder-name">: {connectedFolder}</span>
              ) : (
                <button className="connect-folder-btn" onClick={handleConnectFolder}>
                  <FolderOpen style={{ width: 12, height: 12 }} />
                  <span>Select Folder</span>
                </button>
              )}
            </div>
          )}
        </div>

        <div className="header-actions">
          <div className="config-badge">
            <Cpu size={14} />
            <span>{MODELS.find(m => m.value === model)?.label.split(') ').pop() || model}</span>
          </div>

          <button className="settings-btn" onClick={() => setShowSettings(true)}>
            <Settings size={16} />
            <span>Config</span>
          </button>
        </div>
      </header>

      {/* Settings Dialog */}
      {showSettings && (
        <div className="modal-backdrop">
          <div className="modal-content animate-slide-in">
            <div className="modal-header">
              <Key size={18} style={{ color: 'var(--accent-cyan)' }} />
              <h3>NVIDIA NIM Configuration</h3>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>NVIDIA API Key</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="nvapi-xxxxxxxxxxxxxxxxxxxxxxxx"
                />
                <span className="help-text">Get an API key from <a href="https://build.nvidia.com" target="_blank" rel="noreferrer">build.nvidia.com</a></span>
              </div>
              <div className="form-group">
                <label>Model Selector</label>
                <select value={model} onChange={e => setModel(e.target.value)}>
                  {MODELS.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowSettings(false)}>Cancel</button>
              <button className="primary" onClick={() => saveConfig(apiKey, model)}>Save Settings</button>
            </div>
          </div>
        </div>
      )}

      {/* Core Grid layout */}
      <main className="workspace-grid">
        <ChatPanel
          agentMessages={agentMessages}
          agentState={agentState}
          statusMessage={statusMessage}
          currentThought={currentThought}
          currentOutputText={currentOutputText}
          activeCommand={activeCommand}
          commandLogs={commandLogs}
          onSendMessage={handleRunAgentTask}
          onCancelAgent={handleCancelAgent}
        />

        <div className="editor-workspace-split">
          <div style={{ width: '220px', height: '100%' }}>
            <FileExplorer
              files={files}
              activeFile={activeFile}
              onFileSelect={handleFileSelect}
              onCreate={handleCreateFile}
              onDelete={handleDeleteFile}
              onRefresh={fetchFiles}
            />
          </div>
          <div style={{ flex: 1, height: '100%', minWidth: 0 }}>
            <CodeEditor
              openFiles={openFiles}
              activeFile={activeFile}
              fileContent={fileContent}
              isSaving={isSaving}
              onTabSelect={setActiveFile}
              onTabClose={handleTabClose}
              onContentChange={handleContentChange}
              onManualSave={handleSaveFile}
            />
          </div>
        </div>

        <div className="panel right-column-panel">
          <div className="right-panel-switcher">
            <button 
              className={`switcher-tab ${rightTab === 'terminal' ? 'active' : ''}`}
              onClick={() => setRightTab('terminal')}
            >
              <Terminal size={14} />
              <span>Terminal</span>
            </button>
            <button 
              className={`switcher-tab ${rightTab === 'preview' ? 'active' : ''}`}
              onClick={() => setRightTab('preview')}
            >
              <Globe size={14} />
              <span>Preview</span>
            </button>
          </div>
          <div className="panel-body switcher-body">
            {rightTab === 'terminal' ? (
              <TerminalPanel
                terminalLogs={terminalLogs}
                isExecuting={isExecutingTerminal}
                activeCommand={activeTerminalCommand}
                onRunCommand={handleRunTerminalCommand}
                onClearLogs={() => setTerminalLogs('')}
              />
            ) : (
              <PreviewPanel />
            )}
          </div>
        </div>
      </main>

      <style>{`
        .main-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 16px;
          background: var(--bg-panel);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          box-shadow: var(--shadow-sm);
        }
        .header-brand {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .brand-logo {
          font-size: 1.5rem;
          filter: drop-shadow(0 0 10px rgba(0, 240, 255, 0.4));
        }
        .brand-name h1 {
          font-size: 1rem;
          font-weight: 700;
          color: #fff;
          line-height: 1.2;
        }
        .brand-badge {
          font-size: 0.7rem;
          color: var(--accent-cyan);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 500;
        }
        .header-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .config-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          background: var(--bg-input);
          border: 1px solid var(--border-color);
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 0.8rem;
          color: var(--text-muted);
        }
        .settings-btn {
          height: 32px;
        }

        /* Workspace Status Badges */
        .workspace-status-indicator {
          display: flex;
          align-items: center;
        }
        .status-label {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          border-radius: 6px;
          font-size: 0.78rem;
          font-weight: 500;
          border: 1px solid transparent;
        }
        .status-label.server {
          background: rgba(80, 250, 123, 0.08);
          border-color: rgba(80, 250, 123, 0.2);
          color: var(--accent-green);
        }
        .status-label.static {
          background: rgba(255, 121, 198, 0.08);
          border-color: rgba(255, 121, 198, 0.2);
          color: var(--accent-pink);
        }
        .folder-name {
          color: var(--text-main);
          font-family: var(--font-code);
          font-size: 0.75rem;
        }
        .connect-folder-btn {
          height: 22px;
          padding: 0 6px;
          font-size: 0.7rem;
          background: var(--bg-hover);
          border-color: var(--border-color);
          margin-left: 6px;
        }
        .connect-folder-btn:hover {
          border-color: var(--accent-pink);
          color: #fff;
        }
        
        .editor-workspace-split {
          display: flex;
          height: 100%;
          gap: 12px;
          min-width: 0;
        }
        
        .right-column-panel {
          height: 100%;
        }
        .right-panel-switcher {
          display: flex;
          background: var(--bg-panel-header);
          border-bottom: 1px solid var(--border-color);
          padding: 4px;
          gap: 4px;
        }
        .switcher-tab {
          flex: 1;
          background: transparent;
          border: none;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font-size: 0.8rem;
          color: var(--text-muted);
          border-radius: 4px;
        }
        .switcher-tab:hover {
          color: #fff;
          background: var(--bg-input);
        }
        .switcher-tab.active {
          color: #fff;
          background: var(--bg-hover);
          border: 1px solid var(--border-color);
        }
        .switcher-body {
          background: var(--bg-panel);
        }

        .modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .modal-content {
          background: var(--bg-panel);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          width: 420px;
          display: flex;
          flex-direction: column;
          box-shadow: var(--shadow-md);
        }
        .modal-header {
          padding: 16px;
          border-bottom: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .modal-header h3 {
          font-size: 1rem;
          font-weight: 600;
          color: #fff;
        }
        .modal-body {
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .form-group label {
          font-size: 0.8rem;
          font-weight: 500;
          color: var(--text-muted);
        }
        .form-group input, .form-group select {
          width: 100%;
          height: 38px;
        }
        .help-text {
          font-size: 0.72rem;
          color: var(--text-dark);
        }
        .help-text a {
          color: var(--accent-cyan);
          text-decoration: none;
        }
        .help-text a:hover {
          text-decoration: underline;
        }
        .modal-footer {
          padding: 12px 16px;
          border-top: 1px solid var(--border-color);
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }
      `}</style>
    </div>
  );
}
