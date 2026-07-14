import React from 'react';
import Editor from '@monaco-editor/react';
import { X, Save } from 'lucide-react';

export default function CodeEditor({
  openFiles,
  activeFile,
  fileContent,
  isSaving,
  onTabSelect,
  onTabClose,
  onContentChange,
  onManualSave
}) {
  const getLanguage = (filepath) => {
    if (!filepath) return 'plaintext';
    const ext = filepath.split('.').pop().toLowerCase();
    switch (ext) {
      case 'js':
      case 'jsx': return 'javascript';
      case 'ts':
      case 'tsx': return 'typescript';
      case 'html': return 'html';
      case 'css': return 'css';
      case 'json': return 'json';
      case 'py': return 'python';
      case 'md': return 'markdown';
      case 'sh': return 'shell';
      default: return 'plaintext';
    }
  };

  const getFileName = (filepath) => {
    if (!filepath) return '';
    return filepath.split('/').pop();
  };

  return (
    <div className="panel code-editor-panel">
      <div className="editor-header">
        <div className="tabs-container">
          {openFiles.map(path => {
            const isActive = activeFile === path;
            return (
              <div 
                key={path} 
                className={`tab ${isActive ? 'active' : ''}`}
                onClick={() => onTabSelect(path)}
              >
                <span className="tab-name">{getFileName(path)}</span>
                <button 
                  className="tab-close-btn" 
                  onClick={(e) => {
                    e.stopPropagation();
                    onTabClose(path);
                  }}
                >
                  <X size={12} />
                </button>
              </div>
            );
          })}
        </div>
        
        {activeFile && (
          <div className="editor-status-actions">
            <span className="save-status">
              {isSaving ? 'Saving...' : 'All changes saved'}
            </span>
            <button className="save-btn" onClick={onManualSave} title="Save File (Ctrl+S)">
              <Save size={14} />
              <span>Save</span>
            </button>
          </div>
        )}
      </div>

      <div className="panel-body editor-body">
        {activeFile ? (
          <Editor
            height="100%"
            theme="vs-dark"
            language={getLanguage(activeFile)}
            value={fileContent[activeFile] || ''}
            onChange={(val) => onContentChange(activeFile, val || '')}
            options={{
              fontSize: 14,
              fontFamily: "'JetBrains Mono', monospace",
              minimap: { enabled: false },
              automaticLayout: true,
              tabSize: 2,
              wordWrap: 'on',
              scrollbar: {
                vertical: 'visible',
                horizontal: 'visible',
                verticalScrollbarSize: 8,
                horizontalScrollbarSize: 8
              }
            }}
          />
        ) : (
          <div className="no-file-open">
            <div className="placeholder-icon">⚡</div>
            <h3>NIMbus Coder Workspace</h3>
            <p>Select a file from the explorer or prompt the AI agent to write some code.</p>
          </div>
        )}
      </div>

      <style>{`
        .code-editor-panel {
          height: 100%;
        }
        .editor-header {
          background: var(--bg-panel-header);
          border-bottom: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 12px;
          height: 40px;
          user-select: none;
        }
        .tabs-container {
          display: flex;
          overflow-x: auto;
          height: 100%;
          gap: 2px;
          align-items: flex-end;
        }
        .tabs-container::-webkit-scrollbar {
          height: 0px;
        }
        .tab {
          display: flex;
          align-items: center;
          gap: 6px;
          background: #191c29;
          border: 1px solid var(--border-color);
          border-bottom: none;
          border-top-left-radius: 4px;
          border-top-right-radius: 4px;
          padding: 6px 12px;
          font-size: 0.8rem;
          color: var(--text-muted);
          cursor: pointer;
          transition: all var(--transition-fast);
          height: 32px;
          white-space: nowrap;
        }
        .tab:hover {
          background: var(--bg-hover);
          color: var(--text-main);
        }
        .tab.active {
          background: var(--bg-panel);
          color: #fff;
          border-color: var(--border-color);
          border-top: 2px solid var(--accent-cyan);
        }
        .tab-close-btn {
          background: transparent;
          border: none;
          padding: 2px;
          color: var(--text-dark);
          cursor: pointer;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .tab-close-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: var(--accent-red);
        }
        .editor-status-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .save-status {
          font-size: 0.75rem;
          color: var(--text-dark);
        }
        .save-btn {
          height: 28px;
          padding: 0 10px;
          font-size: 0.75rem;
        }
        .editor-body {
          background: #1e1e1e; /* Standard vs-dark background */
        }
        .no-file-open {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: var(--text-muted);
          text-align: center;
          padding: 24px;
        }
        .placeholder-icon {
          font-size: 3.5rem;
          margin-bottom: 12px;
          filter: drop-shadow(0 0 15px rgba(0, 240, 255, 0.5));
          animation: pulseGlow 2s infinite;
        }
        .no-file-open h3 {
          color: #fff;
          font-weight: 600;
          margin-bottom: 6px;
        }
        .no-file-open p {
          max-width: 320px;
          font-size: 0.85rem;
        }
      `}</style>
    </div>
  );
}
