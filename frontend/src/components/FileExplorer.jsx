import React, { useState } from 'react';
import { Folder, FolderOpen, File, Plus, Trash, ChevronRight, ChevronDown, RefreshCw } from 'lucide-react';

export default function FileExplorer({ 
  files, 
  activeFile, 
  onFileSelect, 
  onCreate, 
  onDelete, 
  onRefresh 
}) {
  const [expanded, setExpanded] = useState({});
  const [showInput, setShowInput] = useState(null); // { parentPath, type: 'file'|'directory' }
  const [inputValue, setInputValue] = useState('');

  const toggleExpand = (path) => {
    setExpanded(prev => ({ ...prev, path: !prev[path] }));
  };

  const handleCreate = (e) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      const path = showInput.parentPath 
        ? `${showInput.parentPath}/${inputValue.trim()}`
        : inputValue.trim();
      onCreate(path, showInput.type);
      setShowInput(null);
      setInputValue('');
    } else if (e.key === 'Escape') {
      setShowInput(null);
      setInputValue('');
    }
  };

  const renderTree = (nodes, parentPath = '') => {
    return nodes.map(node => {
      const isFolder = node.type === 'directory';
      const isExpanded = expanded[node.path];
      const isActive = activeFile === node.path;

      return (
        <div key={node.path} style={{ marginLeft: 12 }}>
          <div 
            className={`file-explorer-node ${isActive ? 'active' : ''}`}
            onClick={() => {
              if (isFolder) {
                setExpanded(prev => ({ ...prev, [node.path]: !prev[node.path] }));
              } else {
                onFileSelect(node.path);
              }
            }}
          >
            <div className="node-info">
              {isFolder ? (
                <>
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  {isExpanded ? <FolderOpen size={16} className="icon-folder" /> : <Folder size={16} className="icon-folder" />}
                </>
              ) : (
                <File size={16} className="icon-file" />
              )}
              <span className="node-name">{node.name}</span>
            </div>
            
            <div className="node-actions" onClick={e => e.stopPropagation()}>
              {isFolder && (
                <>
                  <button className="icon-btn" onClick={() => setShowInput({ parentPath: node.path, type: 'file' })} title="New File">
                    <Plus size={12} />
                  </button>
                  <button className="icon-btn" onClick={() => setShowInput({ parentPath: node.path, type: 'directory' })} title="New Folder">
                    <Folder size={12} style={{ width: 12, height: 12 }} />
                  </button>
                </>
              )}
              <button className="icon-btn delete-btn" onClick={() => onDelete(node.path)} title="Delete">
                <Trash size={12} />
              </button>
            </div>
          </div>

          {/* Inline creation input */}
          {showInput && showInput.parentPath === node.path && (
            <div className="inline-input-container" style={{ marginLeft: 24 }}>
              {showInput.type === 'directory' ? <Folder size={14} /> : <File size={14} />}
              <input
                autoFocus
                type="text"
                value={inputValue}
                placeholder={`New ${showInput.type}...`}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={handleCreate}
                onBlur={() => setShowInput(null)}
              />
            </div>
          )}

          {isFolder && isExpanded && node.children && (
            <div className="folder-children">
              {renderTree(node.children, node.path)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="panel file-explorer">
      <div className="panel-header">
        <div className="panel-title">
          <span>Workspace Files</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="icon-btn" onClick={() => setShowInput({ parentPath: '', type: 'file' })} title="New File at Root">
            <Plus size={14} />
          </button>
          <button className="icon-btn" onClick={() => setShowInput({ parentPath: '', type: 'directory' })} title="New Folder at Root">
            <Folder size={14} />
          </button>
          <button className="icon-btn" onClick={onRefresh} title="Refresh Workspace">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>
      <div className="panel-body file-tree-body">
        {showInput && showInput.parentPath === '' && (
          <div className="inline-input-container" style={{ marginLeft: 12, marginTop: 4 }}>
            {showInput.type === 'directory' ? <Folder size={14} /> : <File size={14} />}
            <input
              autoFocus
              type="text"
              value={inputValue}
              placeholder={`New ${showInput.type}...`}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={handleCreate}
              onBlur={() => setShowInput(null)}
            />
          </div>
        )}
        
        {files.length === 0 ? (
          <div className="empty-message">Empty Workspace. Click + to create a file.</div>
        ) : (
          <div style={{ padding: '8px 4px' }}>
            {renderTree(files)}
          </div>
        )}
      </div>

      <style>{`
        .file-explorer {
          height: 100%;
        }
        .file-tree-body {
          padding: 8px 4px;
        }
        .file-explorer-node {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 8px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.85rem;
          margin-bottom: 2px;
          transition: background var(--transition-fast);
          user-select: none;
        }
        .file-explorer-node:hover {
          background: var(--bg-hover);
        }
        .file-explorer-node:hover .node-actions {
          opacity: 1;
        }
        .file-explorer-node.active {
          background: rgba(0, 240, 255, 0.1);
          border-left: 2px solid var(--accent-cyan);
          padding-left: 6px;
        }
        .node-info {
          display: flex;
          align-items: center;
          gap: 6px;
          overflow: hidden;
        }
        .node-name {
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
          color: var(--text-main);
        }
        .icon-folder {
          color: var(--accent-purple);
        }
        .icon-file {
          color: var(--text-muted);
        }
        .node-actions {
          display: flex;
          gap: 4px;
          opacity: 0;
          transition: opacity var(--transition-fast);
        }
        .icon-btn {
          background: transparent;
          border: none;
          padding: 2px 4px;
          border-radius: 3px;
          color: var(--text-muted);
          cursor: pointer;
        }
        .icon-btn:hover {
          background: var(--border-color);
          color: #fff;
          box-shadow: none;
        }
        .icon-btn.delete-btn:hover {
          color: var(--accent-red);
          background: rgba(255, 85, 85, 0.1);
        }
        .inline-input-container {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 8px;
          background: var(--bg-input);
          border: 1px solid var(--accent-cyan);
          border-radius: 4px;
          margin-bottom: 4px;
        }
        .inline-input-container input {
          background: transparent;
          border: none;
          padding: 0;
          width: 100%;
          font-size: 0.85rem;
          color: var(--text-main);
          outline: none;
          box-shadow: none;
        }
        .empty-message {
          padding: 20px;
          color: var(--text-dark);
          text-align: center;
          font-size: 0.85rem;
        }
        .folder-children {
          border-left: 1px solid rgba(255, 255, 255, 0.05);
          margin-left: 6px;
        }
      `}</style>
    </div>
  );
}
