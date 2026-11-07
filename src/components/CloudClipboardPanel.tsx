import { useState } from 'react';
import type { ClipboardItemEntry, SyncState } from '../../shared/types';
import type { ClipboardSyncSettings } from '../../shared/settings';
import { clipboardActions } from '../lib';
import { useT } from '../i18n';
import { Icon } from './Icon';

function timeAgo(ts: number): string {
  const sec = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.round(sec / 60)}m ago`;
  if (sec < 86_400) return `${Math.round(sec / 3600)}h ago`;
  return new Date(ts).toLocaleDateString();
}

export function CloudClipboardPanel({
  items,
  settings,
  sync,
  onClose,
}: {
  items: ClipboardItemEntry[];
  settings: ClipboardSyncSettings;
  sync: SyncState;
  onClose?: () => void;
}) {
  const { t } = useT();
  const [customSnippet, setCustomSnippet] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (item: ClipboardItemEntry) => {
    clipboardActions.copyToSystem(item.id);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId((prev) => (prev === item.id ? null : prev)), 1500);
  };

  const handlePushCustom = () => {
    const trimmed = customSnippet.trim();
    if (!trimmed) return;
    clipboardActions.pushCurrentOrText(trimmed);
    setCustomSnippet('');
  };

  return (
    <div className="clip-panel">
      <div className="clip-head">
        <div className="clip-title">
          <Icon name="clipboard" size={16} />
          <div>
            <div className="clip-title-text">{t('clip.title')}</div>
            <div className="clip-sub-text">{t('clip.subtitle')}</div>
          </div>
        </div>
        {onClose && (
          <button className="tb-btn" onClick={onClose} title={t('win.close')}>
            <Icon name="x" size={14} />
          </button>
        )}
      </div>

      {/* Sync status & quick controls */}
      <div className="clip-toolbar">
        <button
          className="set-action is-primary"
          onClick={() => clipboardActions.pushCurrentOrText()}
        >
          <Icon name="clipboard" size={14} />
          <span>{t('clip.syncNow')}</span>
        </button>
        {items.some((x) => !x.pinned) && (
          <button className="set-action" onClick={() => clipboardActions.clearUnpinned()}>
            <Icon name="trash" size={14} />
            <span>{t('clip.clear')}</span>
          </button>
        )}
        <span className={`clip-sync-badge ${sync.signedIn && sync.what.clipboard ? 'is-live' : ''}`}>
          {sync.signedIn && sync.what.clipboard
            ? 'Firestore Cloud Synced'
            : 'Local History (Sign in to sync)'}
        </span>
      </div>

      {/* Quick paste/send input */}
      <div className="clip-add-row">
        <input
          className="set-input"
          placeholder="Type or paste a text snippet to sync across your devices…"
          value={customSnippet}
          onChange={(e) => setCustomSnippet(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handlePushCustom()}
        />
        <button
          className="set-action"
          disabled={!customSnippet.trim()}
          onClick={handlePushCustom}
        >
          Add Snippet
        </button>
      </div>

      {/* Auto-apply toggle */}
      <div className="clip-options">
        <label className="ai-context-toggle">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) =>
              clipboardActions.updateSettings({ ...settings, enabled: e.target.checked })
            }
          />
          <span>Monitor system clipboard automatically</span>
        </label>
        <label className="ai-context-toggle">
          <input
            type="checkbox"
            checked={settings.autoApplyToSystem}
            onChange={(e) =>
              clipboardActions.updateSettings({
                ...settings,
                autoApplyToSystem: e.target.checked,
              })
            }
          />
          <span>{t('clip.autoApply')}</span>
        </label>
      </div>

      {/* Snippets List */}
      <div className="clip-list">
        {items.length === 0 ? (
          <div className="clip-empty">{t('clip.empty')}</div>
        ) : (
          items.map((item) => {
            const isLocal = item.deviceId === sync.deviceId;
            return (
              <div key={item.id} className={`clip-item ${item.pinned ? 'is-pinned' : ''}`}>
                <div className="clip-item-meta">
                  <span className="clip-device-badge">
                    <Icon name="devices" size={12} />
                    <span>{isLocal ? `${item.deviceName} (This PC)` : item.deviceName}</span>
                  </span>
                  <span className="clip-time">{timeAgo(item.createdAt)}</span>
                </div>
                <pre className="clip-item-text">{item.text}</pre>
                <div className="clip-item-actions">
                  <button
                    className={`set-action clip-btn ${copiedId === item.id ? 'is-primary' : ''}`}
                    onClick={() => handleCopy(item)}
                  >
                    <Icon name={copiedId === item.id ? 'check' : 'copy'} size={13} />
                    <span>{copiedId === item.id ? t('url.copied') : 'Copy'}</span>
                  </button>
                  <button
                    className={`tb-btn ${item.pinned ? 'is-on' : ''}`}
                    title={item.pinned ? 'Unpin snippet' : 'Pin snippet'}
                    onClick={() => clipboardActions.setPinned(item.id, !item.pinned)}
                  >
                    <Icon name="pin" size={13} />
                  </button>
                  <button
                    className="tb-btn"
                    title="Delete snippet"
                    onClick={() => clipboardActions.remove(item.id)}
                  >
                    <Icon name="trash" size={13} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

