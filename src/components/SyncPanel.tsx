import { useState } from 'react';
import type { SyncState, TabState } from '../../shared/types';
import { t, useLocale } from '../i18n';
import { cmd, handoffActions, syncActions } from '../lib';
import { Icon } from './Icon';
import { Toggle } from './UpdatePanels';

const GUIDE = 'https://github.com/dor2500/drift-browser/blob/main/docs/GOOGLE-SYNC.md';

/**
 * Drift Cloud Sync powered by Firebase Authentication (Google Sign-In provider)
 * and Cloud Firestore for real-time per-user synchronization.
 */
export function SyncPanel({ sync, activeTab }: { sync: SyncState; activeTab?: TabState }) {
  const locale = useLocale();
  const [apiKey, setApiKey] = useState(sync.firebaseConfig?.apiKey ?? '');
  const [projectId, setProjectId] = useState(sync.firebaseConfig?.projectId ?? '');
  const [authDomain, setAuthDomain] = useState(sync.firebaseConfig?.authDomain ?? '');
  const [appId, setAppId] = useState(sync.firebaseConfig?.appId ?? '');
  const [jsonSnippet, setJsonSnippet] = useState('');
  const [id, setId] = useState('');
  const [secret, setSecret] = useState('');
  const [sentToast, setSentToast] = useState<string | null>(null);

  const when = (ms?: number) =>
    ms ? new Date(ms).toLocaleString(locale.code, { dateStyle: 'short', timeStyle: 'short' }) : '';

  const applyJsonSnippet = (raw: string) => {
    setJsonSnippet(raw);
    try {
      const apiKeyMatch = raw.match(/apiKey\s*:\s*["']([^"']+)["']/)?.[1];
      const projectIdMatch = raw.match(/projectId\s*:\s*["']([^"']+)["']/)?.[1];
      const authDomainMatch = raw.match(/authDomain\s*:\s*["']([^"']+)["']/)?.[1];
      const appIdMatch = raw.match(/appId\s*:\s*["']([^"']+)["']/)?.[1];
      if (apiKeyMatch && projectIdMatch) {
        setApiKey(apiKeyMatch);
        setProjectId(projectIdMatch);
        setAuthDomain(authDomainMatch || `${projectIdMatch}.firebaseapp.com`);
        if (appIdMatch) setAppId(appIdMatch);
        return;
      }
      const parsed = JSON.parse(raw) as Record<string, string>;
      if (parsed.apiKey && parsed.projectId) {
        setApiKey(parsed.apiKey);
        setProjectId(parsed.projectId);
        setAuthDomain(parsed.authDomain || `${parsed.projectId}.firebaseapp.com`);
        if (parsed.appId) setAppId(parsed.appId);
      }
    } catch {
      /* user still typing */
    }
  };

  const saveFirebaseConfig = () => {
    if (!apiKey.trim() || !projectId.trim()) return;
    syncActions.setFirebaseConfig({
      apiKey: apiKey.trim(),
      projectId: projectId.trim(),
      authDomain: authDomain.trim() || `${projectId.trim()}.firebaseapp.com`,
      appId: appId.trim() || undefined,
    });
  };

  const canSendActiveTab = !!activeTab && /^https?:/i.test(activeTab.url);

  const sendActiveTab = (targetDeviceId: string | 'all', label: string) => {
    if (!activeTab || !canSendActiveTab) return;
    handoffActions.sendTab(activeTab.url, activeTab.title || activeTab.url, targetDeviceId);
    setSentToast(label);
    setTimeout(() => setSentToast(null), 2200);
  };

  return (
    <div className="sync-panel">
      <div className="sync-card">
        <div className="sync-hero" aria-hidden>
          <span className="blob b1" />
          <span className="blob b2" />
          <span className="blob b3" />
          <div className="sync-art">
            <span className="dot d1" />
            <span className="dot d2" />
            <span className="dot d3" />
            <span className="dot d4" />
            <span className="dot d5" />
            <div className="laptop">
              <i />
            </div>
            <div className="phone">
              <i />
            </div>
          </div>
        </div>

        {!sync.signedIn ? (
          <div className="sync-row main">
            <div className="sync-text">
              <div className="sync-title">{t('sync.title')}</div>
              <div className="sync-body">{t('sync.body')}</div>
            </div>
            <button
              className="btn primary sync-signin"
              disabled={sync.syncing}
              onClick={() => syncActions.signIn()}
            >
              <Icon name="google" size={16} />{' '}
              {sync.syncing ? t('sync.syncing') : t('sync.signIn')}
            </button>
          </div>
        ) : (
          <div className="sync-row main">
            {sync.picture ? (
              <img className="sync-avatar" src={sync.picture} alt="" referrerPolicy="no-referrer" />
            ) : (
              <span className="sync-avatar letter">{(sync.name ?? sync.email ?? '?')[0]}</span>
            )}
            <div className="sync-text">
              <div className="sync-title">
                {sync.name ?? sync.email}
                {sync.realtimeConnected && (
                  <span className="sync-live-pill" title={t('sync.realtime')}>
                    ● Live Firestore
                  </span>
                )}
              </div>
              <div className="sync-body">
                {sync.email} · {sync.deviceName} ·{' '}
                {sync.syncing
                  ? t('sync.syncing')
                  : sync.lastSync
                    ? t('sync.last', { when: when(sync.lastSync) })
                    : t('sync.on')}
              </div>
            </div>
            <button className="btn" disabled={sync.syncing} onClick={() => syncActions.syncNow()}>
              <Icon name="reload" size={14} /> {t('sync.now')}
            </button>
            <button className="btn" onClick={() => syncActions.signOut()}>
              {t('sync.signOut')}
            </button>
          </div>
        )}
        {sync.error && (
          <div className="sync-row error">{t('sync.error', { error: sync.error })}</div>
        )}
      </div>

      {sync.signedIn && (
        <>
          <h3>{t('sync.what')}</h3>
          <Toggle
            checked={sync.what.bookmarks}
            onChange={(bookmarks) => syncActions.setWhat({ bookmarks })}
            label={t('sync.whatBookmarks')}
          />
          <Toggle
            checked={sync.what.tabs}
            onChange={(tabs) => syncActions.setWhat({ tabs })}
            label={t('sync.whatTabs')}
          />
          <Toggle
            checked={sync.what.history}
            onChange={(history) => syncActions.setWhat({ history })}
            label={t('sync.whatHistory')}
          />
          <Toggle
            checked={sync.what.settings}
            onChange={(settings) => syncActions.setWhat({ settings })}
            label={t('sync.whatSettings')}
          />
          <Toggle
            checked={sync.what.clipboard}
            onChange={(clipboard) => syncActions.setWhat({ clipboard })}
            label={t('sync.whatClipboard')}
          />

          {/* Cross-Device Tab Handoff */}
          <h3>Cross-Device Tab Handoff</h3>
          <div className="sync-device">
            <div className="sync-device-head">
              <Icon name="send" size={15} /> {t('sync.sendTab')}
            </div>
            <div className="sync-handoff-controls">
              {sync.otherDevices.map((d) => (
                <button
                  key={d.id}
                  className="btn"
                  disabled={!canSendActiveTab}
                  onClick={() => sendActiveTab(d.id, d.name)}
                >
                  <Icon name="send" size={13} /> Send to {d.name}
                </button>
              ))}
              <button
                className="btn primary"
                disabled={!canSendActiveTab}
                onClick={() => sendActiveTab('all', t('sync.sendAll'))}
              >
                <Icon name="devices" size={14} /> Send to {t('sync.sendAll')}
              </button>
              {sentToast && (
                <span className="sync-sent-badge">✓ Sent to {sentToast}</span>
              )}
            </div>
          </div>

          <h3>{t('sync.devices')}</h3>
          {sync.otherDevices.length === 0 && (
            <div className="empty-note">{t('sync.noDevices')}</div>
          )}
          {sync.otherDevices.map((d) => (
            <div key={d.id} className="sync-device">
              <div className="sync-device-head">
                <Icon name={d.platform === 'android' ? 'tab' : 'devices'} size={15} /> {d.name}
                <span className="sync-device-when">{when(d.updated)}</span>
              </div>
              {d.tabs.slice(0, 15).map((tab, idx) => (
                <button
                  key={`${tab.url}-${idx}`}
                  className="sync-tab"
                  title={tab.url}
                  onClick={() => cmd({ type: 'tab:new', url: tab.url })}
                >
                  <Icon name="globe" size={13} />
                  <span className="sync-tab-title">{tab.title || tab.url}</span>
                </button>
              ))}
            </div>
          ))}
        </>
      )}

      {/* Optional Advanced Firebase Project Override (collapsed by default) */}
      <details className="sync-key">
        <summary>{t('sync.firebaseTitle')}</summary>
        <p className="settings-lead">
          {t('sync.firebaseBody')}{' '}
          <a
            href={GUIDE}
            onClick={(e) => (e.preventDefault(), cmd({ type: 'tab:new', url: GUIDE }))}
          >
            {t('sync.keyGuide')}
          </a>
        </p>
        <div className="sync-firebase-grid">
          <input
            placeholder="Paste firebaseConfig JSON or JS snippet (auto-fills fields below)"
            value={jsonSnippet}
            onChange={(e) => applyJsonSnippet(e.target.value)}
            spellCheck={false}
          />
          <div className="sync-key-row">
            <input
              placeholder="Firebase apiKey (e.g. AIzaSy...)"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              spellCheck={false}
            />
            <input
              placeholder="Firebase projectId (e.g. drift-browser-sync)"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              spellCheck={false}
            />
          </div>
          <div className="sync-key-row">
            <input
              placeholder="authDomain (optional, defaults to projectId.firebaseapp.com)"
              value={authDomain}
              onChange={(e) => setAuthDomain(e.target.value)}
              spellCheck={false}
            />
            <input
              placeholder="appId (optional)"
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              spellCheck={false}
            />
            <button
              className="btn primary"
              disabled={!apiKey.trim() || !projectId.trim()}
              onClick={saveFirebaseConfig}
            >
              Save Firebase Config
            </button>
          </div>
        </div>

        <div className="sync-oauth-optional">
          <div className="toggle-hint">
            Optional Desktop OAuth Client ID &amp; Secret (if not set, Drift signs in via your
            Firebase Auth Google provider in a secure popup):
          </div>
          <div className="sync-key-row">
            <input
              placeholder="Google OAuth Client ID (optional)"
              value={id}
              onChange={(e) => setId(e.target.value)}
              spellCheck={false}
            />
            <input
              placeholder="Google OAuth Client Secret (optional)"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              spellCheck={false}
              type="password"
            />
            <button
              className="btn"
              disabled={!id.trim() || !secret.trim()}
              onClick={() => syncActions.setOAuthClient(id, secret)}
            >
              {t('sync.keySave')}
            </button>
          </div>
        </div>
        {sync.configured && <div className="toggle-hint">{t('sync.keyReady')}</div>}
      </details>
      <p className="toggle-hint">
        Your synced data is stored under your private Cloud Firestore path{' '}
        <code>users/&#123;uid&#125;/sync/*</code> protected by Firestore security rules.
      </p>
    </div>
  );
}
