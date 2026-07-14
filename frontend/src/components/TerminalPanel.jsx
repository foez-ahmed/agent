import React, { useState, useRef, useEffect } from 'react';
import { Terminal as TermIcon, Play, Trash, ShieldAlert } from 'lucide-react';

export default function TerminalPanel({
  terminalLogs,
  isExecuting,
  activeCommand,
  onRunCommand,
  onClearLogs
}) {
  const [cmdInput, setCmdInput] = useState('');
  const logEndRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!cmdInput.trim() || isExecuting) return;
    onRunCommand(cmdInput.trim());
    setCmdInput('');
  };

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [terminalLogs]);

  return (
    <div className="panel terminal-panel">
      <div className="panel-header">
        <div className="panel-title">
          <TermIcon size={14} style={{ color: 'var(--accent-green)' }} />
          <span>Interactive Terminal</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="icon-btn" onClick={onClearLogs} title="Clear Console">
            <Trash size={14} />
          </button>
        </div>
      </div>

      <div className="panel-body console-body">
        <div className="system-disclaimer">
          <ShieldAlert size={12} />
          <span>Commands run locally in the workspace directory.</span>
        </div>
        
        <pre className="console-output">
          {terminalLogs || '$ Ready for command execution...\n'}
          <div ref={logEndRef} />
        </pre>
      </div>

      <form className="console-input-line" onSubmit={handleSubmit}>
        <span className="console-prompt">$</span>
        <input
          type="text"
          value={cmdInput}
          disabled={isExecuting}
          onChange={(e) => setCmdInput(e.target.value)}
          placeholder={isExecuting ? `Running ${activeCommand}...` : "Type a shell command (e.g. npm install, python -m http.server)..."}
        />
        <button type="submit" disabled={isExecuting || !cmdInput.trim()} className="exec-btn">
          <Play size={12} />
          <span>Run</span>
        </button>
      </form>

      <style>{`
        .terminal-panel {
          height: 100%;
        }
        .console-body {
          background: #06070a;
          display: flex;
          flex-direction: column;
        }
        .system-disclaimer {
          background: rgba(241, 250, 140, 0.05);
          border-bottom: 1px solid rgba(241, 250, 140, 0.1);
          padding: 6px 12px;
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.72rem;
          color: var(--accent-yellow);
        }
        .console-output {
          flex: 1;
          padding: 12px;
          font-family: var(--font-code);
          font-size: 0.8rem;
          color: #fff;
          overflow-y: auto;
          white-space: pre-wrap;
          line-height: 1.4;
        }
        .console-input-line {
          background: #090a0f;
          border-top: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          padding: 6px 12px;
          gap: 8px;
          height: 40px;
        }
        .console-prompt {
          font-family: var(--font-code);
          font-weight: 600;
          color: var(--accent-green);
          user-select: none;
        }
        .console-input-line input {
          flex: 1;
          background: transparent;
          border: none;
          padding: 0;
          font-family: var(--font-code);
          font-size: 0.82rem;
          color: #fff;
          box-shadow: none;
        }
        .console-input-line input:focus {
          border: none;
          box-shadow: none;
        }
        .exec-btn {
          height: 28px;
          padding: 0 10px;
          font-size: 0.75rem;
        }
      `}</style>
    </div>
  );
}
