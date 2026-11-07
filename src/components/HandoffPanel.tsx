import { useState } from 'react';
import type { SyncState, TabState } from '../../shared/types';
import { handoffActions, cmd } from '../lib';
import { useT } from '../i18n';
import { Icon } from './Icon';

export function HandoffPanel({
  sync,
  activeTab,
  onClose,
}: {
  sync: SyncState;
  activeTab?: TabState;
  onClose?: () => void;
}) {
  const { t } = useT();
  const [sentTo, setSentTo] = useState<string | null>(null);

  const canSend = !!activeTab && /^https?:/i.test(activeTab.url);

  const handleSend = (targetId: string | 'all', label: string) => {
    if (!activeTab || !canSend) return;
    handoffActions.sendTab(activeTab.url, activeTab.title || activeTab.url, targetId);
    setSentTo(label);
    setTimeout(() => setSentTo(null), 2200);
  };

  return (
    <div className="handoff-panel">
      <div className="clip-head">
        <div className="clip-title">
          <Icon name="devices" size={16} />
          <div>
            <div className="clip-title-text">Cross-Device Tab Handoff</div>
            <div className="clip-sub-text">
              Send the current webpage to another device or open tabs from your other synced devices.
            </div>
          </div>
        </div>
        {onClose && (
          <button className="tb-btn" onClick={onClose} title={t('win.close')}>
            <Icon name="x" size={14} />
          </button>
        )}
      </div>

      {/* Send Active Tab */}
      <div className="handoff-send-card">
        <div className="handoff-current-tab">
          <Icon name="send" size={14} />
          <div className="handoff-tab-meta">
            <div className="handoff-tab-title">
              {canSend ? activeTab?.title || activeTab?.url : 'No web page active to send'}
            </div>
            {canSend && <div className="handoff-tab-url">{activeTab?.url}</div>}
          </div>
        </div>

        {!sync.signedIn ? (
          <div className="handoff-signin-cta">
            <span>Sign in with Google (Firebase Sync) to send tabs across devices.</span>
            <button
              className="set-action is-primary"
              onClick={() => {
                onClose?.();
                cmd({ type: 'settings:open' });
              }}
            >
              Open Sync Settings
            </button>
          </div>
        ) : (
          <div className="handoff-targets">
            {sync.otherDevices.map((dev) => (
              <button
                key={dev.id}
                className="set-action"
                disabled={!canSend}
                onClick={() => handleSend(dev.id, dev.name)}
              >
                <Icon name="send" size={13} />
                <span>Send to {dev.name}</span>
              </button>
            ))}
            <button
              className="set-action is-primary"
              disabled={!canSend}
              onClick={() => handleSend('all', t('sync.sendAll'))}
            >
              <Icon name="devices" size={13} />
              <span>Send to {t('sync.sendAll')}</span>
            </button>
          </div>
        )}
        {sentTo && (
          <div className="handoff-sent-toast">
            <Icon name="check" size={13} />
            <span>Sent tab to {sentTo} via Cloud Firestore!</span>
          </div>
        )}
      </div>

      {/* Incoming Handoff History */}
      {sync.handoffQueue.length > 0 && (
        <div className="handoff-section">
          <div className="handoff-section-title">Recently Sent to This Device</div>
          <div className="sync-tabs">
            {sync.handoffQueue.map((item) => (
              <div key={item.id} className="sync-tab handoff-queue-item">
                <button
                  className="handoff-open-link"
                  onClick={() => {
                    handoffActions.openRemoteTab(item.url, false);
                    onClose?.();
                  }}
                >
                  <Icon name="send" size={13} />
                  <span className="sync-tab-title">{item.title || item.url}</span>
                  <span className="sync-tab-url">from {item.fromDeviceName}</span>
                </button>
                <button
                  className="tb-btn"
                  title="Dismiss"
                  onClick={() => handoffActions.dismiss(item.id)}
                >
                  <Icon name="x" size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Open Tabs from Other Devices */}
      <div className="handoff-section">
        <div className="handoff-section-title">{t('sync.devices')}</div>
        {sync.otherDevices.length === 0 ? (
          <div className="set-empty">{t('sync.noDevices')}</div>
        ) : (
          sync.otherDevices.map((dev) => (
            <div key={dev.id} className="sync-device">
              <div className="sync-device-head">
                <span className="sync-device-name">
                  <Icon name="devices" size={13} /> {dev.name}
                  {dev.platform ? ` (${dev.platform})` : ''}
                </span>
                <span className="sync-device-when">
                  {new Date(dev.updated).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div className="sync-tabs">
                {dev.tabs.map((tab, i) => (
                  <button
                    key={i}
                    className="sync-tab"
                    onClick={() => {
                      handoffActions.openRemoteTab(tab.url, false);
                      onClose?.();
                    }}
                  >
                    <Icon name="globe" size={14} />
                    <span className="sync-tab-title">{tab.title || tab.url}</span>
                    <span className="sync-tab-url">{tab.url}</span>
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
