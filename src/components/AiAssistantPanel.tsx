import { useEffect, useRef, useState } from 'react';
import type { AiState, TabState } from '../../shared/types';
import type { AiSettings } from '../../shared/settings';
import { aiActions, clipboardActions } from '../lib';
import { Icon } from './Icon';
import { useT } from '../i18n';

export function AiAssistantPanel({
  ai,
  settings,
  activeTab,
}: {
  ai: AiState;
  settings: AiSettings;
  activeTab?: TabState;
}) {
  const { t } = useT();
  const [input, setInput] = useState('');
  const [includePage, setIncludePage] = useState(true);
  const [showConfig, setShowConfig] = useState(false);
  const [endpointDraft, setEndpointDraft] = useState(settings.endpoint);
  const [modelDraft, setModelDraft] = useState(settings.model);
  const [langDraft, setLangDraft] = useState(settings.targetLanguage);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setEndpointDraft(settings.endpoint);
    setModelDraft(settings.model);
    setLangDraft(settings.targetLanguage);
  }, [settings.endpoint, settings.model, settings.targetLanguage]);

  const isStreaming = ai.status === 'streaming' || ai.status === 'connecting';

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ai.messages, isStreaming]);

  const submitPrompt = () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    aiActions.sendPrompt(trimmed, 'chat', includePage);
    setInput('');
  };

  const saveConfig = () => {
    aiActions.updateSettings({
      endpoint: endpointDraft.trim() || 'http://localhost:11434',
      model: modelDraft.trim() || 'llama3.2',
      targetLanguage: langDraft.trim() || 'English',
    });
    setShowConfig(false);
  };

  const canUsePage = !!activeTab && /^https?:/i.test(activeTab.url);
  // The "100% Local" promise only holds when the endpoint is a loopback host.
  const endpointIsLocal = (() => {
    try {
      const h = new URL(settings.endpoint || 'http://localhost:11434').hostname.toLowerCase();
      return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]' || h.endsWith('.localhost');
    } catch {
      return false;
    }
  })();

  return (
    <aside className="ai-panel" aria-label={t('ai.title')}>
      <header className="ai-panel-head">
        <div className="ai-panel-title">
          <Icon name="sparkles" size={16} />
          <span>{t('ai.title')}</span>
          <span
            className={`ai-status-dot ${ai.ollamaOnline ? 'is-online' : 'is-offline'}`}
            title={ai.ollamaOnline ? t('ai.online') : t('ai.offline')}
          />
        </div>
        <div className="ai-panel-actions">
          <button
            className="tb-btn"
            title="Refresh Ollama models"
            onClick={() => aiActions.refreshModels()}
          >
            <Icon name="reload" size={14} />
          </button>
          <button
            className={`tb-btn ${showConfig ? 'is-on' : ''}`}
            title="Configure Ollama endpoint & model"
            onClick={() => setShowConfig((v) => !v)}
          >
            <Icon name="gear" size={14} />
          </button>
          {ai.messages.length > 0 && (
            <button
              className="tb-btn"
              title="Clear conversation"
              onClick={() => aiActions.clearChat()}
            >
              <Icon name="trash" size={14} />
            </button>
          )}
          <button
            className="tb-btn"
            title="Close AI panel (Ctrl+Shift+A)"
            onClick={() => aiActions.togglePanel(false)}
          >
            <Icon name="x" size={14} />
          </button>
        </div>
      </header>

      {/* Model & Status Bar */}
      <div className="ai-model-bar">
        {ai.availableModels.length > 0 ? (
          <select
            className="set-select ai-model-select"
            value={settings.model}
            onChange={(e) => aiActions.updateSettings({ model: e.target.value })}
          >
            {!ai.availableModels.includes(settings.model) && (
              <option value={settings.model}>{settings.model}</option>
            )}
            {ai.availableModels.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        ) : (
          <span className="ai-model-tag">{settings.model}</span>
        )}
        {endpointIsLocal ? (
          <span className="ai-privacy-badge" title="All requests stay on your machine via localhost">
            100% Local
          </span>
        ) : (
          <span className="ai-privacy-badge" title={`Requests are sent to ${settings.endpoint}, which is not on your machine`}>
            ⚠ Remote endpoint
          </span>
        )}
      </div>

      {showConfig && (
        <div className="ai-config-card">
          <div className="ai-config-field">
            <label>Ollama Endpoint</label>
            <input
              className="set-input"
              value={endpointDraft}
              placeholder="http://localhost:11434"
              onChange={(e) => setEndpointDraft(e.target.value)}
            />
          </div>
          <div className="ai-config-field">
            <label>Model Name</label>
            <input
              className="set-input"
              value={modelDraft}
              placeholder="llama3.2, mistral, qwen2.5…"
              onChange={(e) => setModelDraft(e.target.value)}
            />
          </div>
          <div className="ai-config-field">
            <label>Target Translation Language</label>
            <input
              className="set-input"
              value={langDraft}
              placeholder="English, Hebrew, Spanish…"
              onChange={(e) => setLangDraft(e.target.value)}
            />
          </div>
          <div className="ai-config-btns">
            <button className="set-action is-primary" onClick={saveConfig}>
              Save & Reconnect
            </button>
          </div>
        </div>
      )}

      {/* Quick Webpage Actions */}
      <div className="ai-quick-actions">
        <button
          className="ai-chip"
          disabled={!canUsePage || isStreaming}
          onClick={() => aiActions.summarizeCurrentPage()}
          title={canUsePage ? `Summarize ${activeTab?.title || activeTab?.url}` : 'Open a webpage first'}
        >
          <Icon name="sparkles" size={13} />
          <span>{t('ai.summarize')}</span>
        </button>
        <button
          className="ai-chip"
          disabled={!canUsePage || isStreaming}
          onClick={() => aiActions.explainCurrentPage()}
        >
          <Icon name="book" size={13} />
          <span>{t('ai.explain')}</span>
        </button>
        <button
          className="ai-chip"
          disabled={!canUsePage || isStreaming}
          onClick={() => aiActions.translateCurrentPage()}
        >
          <Icon name="globe" size={13} />
          <span>
            {t('ai.translate')} ({settings.targetLanguage})
          </span>
        </button>
      </div>

      {/* Chat Messages */}
      <div className="ai-messages">
        {ai.messages.length === 0 ? (
          <div className="ai-empty">
            <div className="ai-empty-ic">
              <Icon name="sparkles" size={26} />
            </div>
            <div className="ai-empty-title">Private Local AI Assistant</div>
            <div className="ai-empty-sub">
              Powered by your {endpointIsLocal ? 'local' : 'configured'} Ollama instance at{' '}
              <code>{settings.endpoint}</code>. Summarize articles, translate text, or ask questions
              about the current page
              {endpointIsLocal
                ? ' without sending any data to the cloud.'
                : ' — note: this endpoint is not on your machine, so page content is sent there.'}
            </div>
            {!ai.ollamaOnline && (
              <div className="ai-offline-hint">
                <div>Ollama is not reachable yet.</div>
                <code>ollama serve &amp;&amp; ollama pull {settings.model}</code>
              </div>
            )}
          </div>
        ) : (
          ai.messages.map((m) => (
            <div key={m.id} className={`ai-msg ai-msg-${m.role}`}>
              <div className="ai-msg-meta">
                <span>{m.role === 'user' ? 'You' : `Ollama (${settings.model})`}</span>
                {m.content && (
                  <button
                    className="ai-copy-btn"
                    title="Copy response & sync to Cloud Clipboard"
                    onClick={() => clipboardActions.pushCurrentOrText(m.content)}
                  >
                    <Icon name="copy" size={12} />
                  </button>
                )}
              </div>
              <div className="ai-msg-body">
                {m.content || (isStreaming ? 'Thinking…' : '')}
              </div>
            </div>
          ))
        )}
        {ai.error && <div className="ai-error-banner">{ai.error}</div>}
        <div ref={chatEndRef} />
      </div>

      {/* Composer */}
      <footer className="ai-composer">
        <label className="ai-context-toggle">
          <input
            type="checkbox"
            checked={includePage && canUsePage}
            disabled={!canUsePage}
            onChange={(e) => setIncludePage(e.target.checked)}
          />
          <span>{t('ai.includePage')}</span>
        </label>
        <div className="ai-input-row">
          <textarea
            className="ai-textarea"
            rows={2}
            value={input}
            placeholder={t('ai.placeholder')}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submitPrompt();
              }
            }}
          />
          {isStreaming ? (
            <button
              className="set-action ai-send-btn is-stop"
              title="Stop generation"
              onClick={() => aiActions.stopGeneration()}
            >
              <Icon name="x" size={14} />
            </button>
          ) : (
            <button
              className="set-action is-primary ai-send-btn"
              disabled={!input.trim()}
              title="Send prompt (Enter)"
              onClick={submitPrompt}
            >
              <Icon name="send" size={14} />
            </button>
          )}
        </div>
      </footer>
    </aside>
  );
}
