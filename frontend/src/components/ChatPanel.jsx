import React, { useState, useRef, useEffect } from 'react';
import { Send, Terminal, Play, CheckCircle, AlertTriangle, Cpu, HelpCircle } from 'lucide-react';

export default function ChatPanel({
  agentMessages,
  agentState, // 'idle' | 'running' | 'error'
  statusMessage,
  currentThought,
  currentOutputText,
  activeCommand,
  commandLogs,
  onSendMessage,
  onCancelAgent
}) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || agentState === 'running') return;
    onSendMessage(input.trim());
    setInput('');
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [agentMessages, currentThought, currentOutputText, commandLogs, statusMessage]);

  const renderToolLog = (tool) => {
    const isSuccess = !tool.result?.startsWith('Error');
    return (
      <div key={tool.id} className="tool-log-item animate-slide-in">
        <div className="tool-log-header">
          <span className={`tool-status-dot ${isSuccess ? 'success' : 'error'}`}></span>
          <span className="tool-name">
            {tool.name === 'write_file' && `📝 Write ${tool.args.path}`}
            {tool.name === 'read_file' && `🔍 Read ${tool.args.path}`}
            {tool.name === 'list_files' && `📂 List workspace files`}
            {tool.name === 'execute_command' && `⚙️ Run: ${tool.args.command}`}
            {tool.name === 'finish_task' && `🏁 Finished Task`}
          </span>
        </div>
        {tool.result && (
          <pre className="tool-result-preview">
            {tool.result.length > 250 
              ? `${tool.result.substring(0, 250)}...\n[output truncated]`
              : tool.result}
          </pre>
        )}
      </div>
    );
  };

  return (
    <div className="panel chat-panel-container">
      <div className="panel-header">
        <div className="panel-title">
          <Cpu size={16} className={agentState === 'running' ? 'spin' : ''} style={{ color: 'var(--accent-cyan)' }} />
          <span>Agent Workspace</span>
        </div>
        <div className="agent-indicator">
          <span className={`glow-dot ${agentState}`}></span>
          <span className="agent-indicator-text">
            {agentState === 'running' ? 'Agent Working' : agentState === 'error' ? 'Error' : 'Agent Idle'}
          </span>
        </div>
      </div>

      <div className="panel-body chat-messages-body">
        {agentMessages.length === 0 && !currentThought && !currentOutputText && (
          <div className="chat-welcome">
            <div className="welcome-glow-icon">🤖</div>
            <h2>Prompt the AI Agent</h2>
            <p>Tell the agent to create components, setup logic, build features, or debug issues in this workspace.</p>
            <div className="welcome-examples">
              <div className="example-tag" onClick={() => setInput("Build a clean HTML/CSS/JS stopwatch utility in this workspace")}>
                "Create a stopwatch utility"
              </div>
              <div className="example-tag" onClick={() => setInput("Create a node script that writes random quotes to a file quotes.txt and run it")}>
                "Write and run random quotes script"
              </div>
            </div>
          </div>
        )}

        {agentMessages.map((msg, idx) => (
          <div key={idx} className={`chat-card ${msg.role === 'user' ? 'user-card' : 'agent-card'}`}>
            <div className="card-header">
              <span className="avatar">{msg.role === 'user' ? '👤' : '🤖'}</span>
              <span className="sender-name">{msg.role === 'user' ? 'User Request' : 'NIMbus Agent'}</span>
            </div>
            <div className="card-content">
              {msg.role === 'user' ? (
                <p className="user-prompt">{msg.content}</p>
              ) : (
                <div className="agent-response-area">
                  {msg.thought && (
                    <div className="thought-block">
                      <div className="block-header">Thought Process</div>
                      <p className="thought-text">{msg.thought}</p>
                    </div>
                  )}
                  {msg.toolCalls && msg.toolCalls.map(renderToolLog)}
                  {msg.message && (
                    <div className="agent-final-message">
                      <CheckCircle size={16} style={{ color: 'var(--accent-green)', flexShrink: 0 }} />
                      <p>{msg.message}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Live streaming status card */}
        {(currentThought || currentOutputText || statusMessage || agentState === 'running') && (
          <div className="chat-card agent-card active-stream">
            <div className="card-header">
              <span className="avatar spin-avatar">🤖</span>
              <span className="sender-name">NIMbus Agent (Working...)</span>
            </div>
            <div className="card-content">
              {currentThought && (
                <div className="thought-block active-thought animate-slide-in">
                  <div className="block-header">Thought Process</div>
                  <p className="thought-text">{currentThought}</p>
                </div>
              )}

              {/* Streaming complete output token window */}
              {currentOutputText && !currentThought && (
                <div className="raw-stream-window">
                  <pre>{currentOutputText}</pre>
                </div>
              )}

              {activeCommand && (
                <div className="live-cmd-window">
                  <div className="cmd-header">
                    <Terminal size={12} />
                    <span>Executing: <code>{activeCommand}</code></span>
                  </div>
                  {commandLogs && (
                    <pre className="cmd-console">
                      {commandLogs}
                    </pre>
                  )}
                </div>
              )}

              {statusMessage && (
                <div className="status-toast">
                  <div className="loader-ring"></div>
                  <span>{statusMessage}</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-area" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          disabled={agentState === 'running'}
          onChange={(e) => setInput(e.target.value)}
          placeholder={agentState === 'running' ? 'Agent is working...' : 'Describe task for agent...'}
        />
        {agentState === 'running' ? (
          <button type="button" className="cancel-btn" onClick={onCancelAgent}>
            <span>Stop</span>
          </button>
        ) : (
          <button type="submit" disabled={!input.trim()} className="primary">
            <Send size={14} />
          </button>
        )}
      </form>

      <style>{`
        .chat-panel-container {
          height: 100%;
        }
        .agent-indicator {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.75rem;
          color: var(--text-muted);
        }
        .chat-messages-body {
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .chat-welcome {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          text-align: center;
          color: var(--text-muted);
          padding: 24px 12px;
        }
        .welcome-glow-icon {
          font-size: 3rem;
          margin-bottom: 12px;
          filter: drop-shadow(0 0 10px rgba(189, 147, 249, 0.4));
        }
        .chat-welcome h2 {
          color: #fff;
          font-size: 1.25rem;
          margin-bottom: 6px;
        }
        .chat-welcome p {
          font-size: 0.85rem;
          max-width: 280px;
          margin-bottom: 24px;
        }
        .welcome-examples {
          display: flex;
          flex-direction: column;
          gap: 8px;
          width: 100%;
        }
        .example-tag {
          background: var(--bg-input);
          border: 1px solid var(--border-color);
          padding: 10px;
          border-radius: 6px;
          font-size: 0.8rem;
          color: var(--text-main);
          cursor: pointer;
          transition: all var(--transition-fast);
          text-align: left;
        }
        .example-tag:hover {
          border-color: var(--accent-cyan);
          background: var(--bg-hover);
        }
        .chat-card {
          background: var(--bg-input);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .user-card {
          border-left: 3px solid var(--accent-cyan);
          align-self: flex-end;
          width: 90%;
        }
        .agent-card {
          border-left: 3px solid var(--accent-purple);
          align-self: flex-start;
          width: 95%;
        }
        .active-stream {
          box-shadow: 0 0 15px rgba(189, 147, 249, 0.15);
          border-color: var(--accent-purple);
        }
        .card-header {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--text-muted);
        }
        .avatar {
          font-size: 1.1rem;
        }
        .user-prompt {
          font-size: 0.85rem;
          line-height: 1.4;
          white-space: pre-wrap;
        }
        .agent-response-area {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .thought-block {
          background: rgba(189, 147, 249, 0.08);
          border: 1px solid rgba(189, 147, 249, 0.2);
          border-radius: 6px;
          padding: 8px;
        }
        .block-header {
          font-size: 0.7rem;
          font-weight: 600;
          text-transform: uppercase;
          color: var(--accent-purple);
          margin-bottom: 4px;
        }
        .thought-text {
          font-size: 0.82rem;
          line-height: 1.45;
          color: var(--text-main);
          white-space: pre-wrap;
        }
        .tool-log-item {
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          padding: 8px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .tool-log-header {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.8rem;
          font-weight: 500;
        }
        .tool-status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }
        .tool-status-dot.success { background-color: var(--accent-green); }
        .tool-status-dot.error { background-color: var(--accent-red); }
        .tool-result-preview {
          font-family: var(--font-code);
          font-size: 0.72rem;
          background: #090a0f;
          padding: 6px;
          border-radius: 4px;
          max-height: 120px;
          overflow: auto;
          color: var(--text-muted);
          white-space: pre-wrap;
        }
        .agent-final-message {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          background: rgba(80, 250, 123, 0.1);
          border: 1px solid rgba(80, 250, 123, 0.2);
          border-radius: 6px;
          padding: 8px;
          font-size: 0.85rem;
          line-height: 1.4;
        }
        .raw-stream-window {
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          padding: 8px;
          max-height: 200px;
          overflow-y: auto;
        }
        .raw-stream-window pre {
          font-family: var(--font-code);
          font-size: 0.75rem;
          white-space: pre-wrap;
          color: var(--text-muted);
        }
        .live-cmd-window {
          background: #090a0f;
          border: 1px solid var(--border-color);
          border-radius: 6px;
          overflow: hidden;
        }
        .cmd-header {
          background: var(--bg-panel-header);
          padding: 4px 8px;
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.72rem;
          color: var(--accent-cyan);
          border-bottom: 1px solid var(--border-color);
        }
        .cmd-console {
          padding: 8px;
          font-family: var(--font-code);
          font-size: 0.75rem;
          color: #fff;
          max-height: 150px;
          overflow-y: auto;
          white-space: pre-wrap;
        }
        .status-toast {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.78rem;
          color: var(--accent-cyan);
          padding: 4px 0;
        }
        .loader-ring {
          width: 12px;
          height: 12px;
          border: 2px solid rgba(0, 240, 255, 0.2);
          border-top-color: var(--accent-cyan);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        .chat-input-area {
          display: flex;
          padding: 10px;
          background: var(--bg-panel-header);
          border-top: 1px solid var(--border-color);
          gap: 8px;
        }
        .chat-input-area input {
          flex: 1;
          height: 38px;
        }
        .cancel-btn {
          height: 38px;
          background: rgba(255, 85, 85, 0.1);
          border-color: var(--accent-red);
          color: var(--accent-red);
        }
        .cancel-btn:hover {
          background: var(--accent-red);
          color: #fff;
        }
      `}</style>
    </div>
  );
}
