import React, { useState } from 'react';
import { Globe, RotateCw, ExternalLink } from 'lucide-react';

export default function PreviewPanel() {
  const [url, setUrl] = useState('http://localhost:8080');
  const [iframeKey, setIframeKey] = useState(0);

  const handleRefresh = () => {
    setIframeKey(prev => prev + 1);
  };

  const handleOpenExternal = () => {
    window.open(url, '_blank');
  };

  return (
    <div className="panel preview-panel">
      <div className="panel-header">
        <div className="panel-title">
          <Globe size={14} style={{ color: 'var(--accent-cyan)' }} />
          <span>Web App Preview</span>
        </div>
      </div>

      <div className="preview-url-bar">
        <input 
          type="text" 
          value={url} 
          onChange={e => setUrl(e.target.value)}
          placeholder="http://localhost:8080"
        />
        <button className="icon-btn" onClick={handleRefresh} title="Reload Preview">
          <RotateCw size={14} />
        </button>
        <button className="icon-btn" onClick={handleOpenExternal} title="Open in New Tab">
          <ExternalLink size={14} />
        </button>
      </div>

      <div className="panel-body preview-body">
        {url ? (
          <iframe 
            key={iframeKey}
            src={url} 
            title="App Preview"
            className="preview-iframe"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        ) : (
          <div className="no-preview">
            <p>Enter a preview URL above to view your running application.</p>
          </div>
        )}
      </div>

      <style>{`
        .preview-panel {
          height: 100%;
        }
        .preview-url-bar {
          background: var(--bg-panel-header);
          border-bottom: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          padding: 6px 12px;
          gap: 6px;
        }
        .preview-url-bar input {
          flex: 1;
          height: 28px;
          padding: 0 10px;
          font-size: 0.8rem;
          font-family: var(--font-code);
        }
        .preview-body {
          background: #fff; /* White background for preview rendering */
          position: relative;
        }
        .preview-iframe {
          width: 100%;
          height: 100%;
          border: none;
          background: #fff;
        }
        .no-preview {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: var(--text-muted);
          background: var(--bg-panel);
          font-size: 0.85rem;
          text-align: center;
          padding: 24px;
        }
      `}</style>
    </div>
  );
}
