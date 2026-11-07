import { useState } from 'react';
import type { SyncState } from '../../shared/types';
import { t, useLocale } from '../i18n';
import { cmd } from '../lib';
import { Icon } from './Icon';
import { Toggle } from './UpdatePanels';

const GUIDE = 'https://github.com/dor2500/drift-browser/blob/main/docs/GOOGLE-SYNC.md';

/** Drift Sync with a Google account, laid out like Chrome's "You and Google". */
export function SyncPanel({ sync }: { sync: SyncState }) {
  const locale = useLocale();
  const [id, setId] = useState('');
  const [secret, setSecret] = useState('');
  const when = (ms?: number) => (ms ? new Date(ms).toLocaleString(locale.code, { dateStyle: 'short', timeStyle: 'short' }) : '');

  return (
    <div className="sync-panel">
      <div className="sync-card">
        {/* Drift's own artwork: a laptop and a phone joined by a ring of dots. */}
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
            <button className="btn primary sync-signin" disabled={!sync.configured} onClick={() => cmd({ type: 'sync:signin' })}>
              <Icon name="google" size={16} /> {t('sync.signIn')}
            </button>
          </div>
        ) : (
          <div className="sync-row main">
            {sync.picture ? <img className="sync-avatar" src={sync.picture} alt="" referrerPolicy="no-referrer" /> : <span className="sync-avatar letter">{(sync.name ?? sync.email ?? '?')[0]}</span>}
            <div className="sync-text">
              <div className="sync-title">{sync.name ?? sync.email}</div>
              <div className="sync-body">
                {sync.email} · {sync.syncing ? t('sync.syncing') : sync.lastSync ? t('sync.last', { when: when(sync.lastSync) }) : t('sync.on')}
              </div>
            </div>
            <button className="btn" disabled={sync.syncing} onClick={() => cmd({ type: 'sync:now' })}>
              <Icon name="reload" size={14} /> {t('sync.now')}
            </button>
            <button className="btn" onClick={() => cmd({ type: 'sync:signout' })}>
              {t('sync.signOut')}
            </button>
          </div>
        )}
        {sync.error && <div className="sync-row error">{t('sync.error', { error: sync.error })}</div>}
      </div>

      {sync.signedIn && (
        <>
          <h3>{t('sync.what')}</h3>
          <Toggle checked={sync.what.bookmarks} onChange={(bookmarks) => cmd({ type: 'sync:what', what: { bookmarks } })} label={t('sync.whatBookmarks')} />
          <Toggle checked={sync.what.tabs} onChange={(tabs) => cmd({ type: 'sync:what', what: { tabs } })} label={t('sync.whatTabs')} />
          <Toggle checked={sync.what.history} onChange={(history) => cmd({ type: 'sync:what', what: { history } })} label={t('sync.whatHistory')} />
          <Toggle checked={sync.what.settings} onChange={(settings) => cmd({ type: 'sync:what', what: { settings } })} label={t('sync.whatSettings')} />

          <h3>{t('sync.devices')}</h3>
          {sync.otherDevices.length === 0 && <div className="empty-note">{t('sync.noDevices')}</div>}
          {sync.otherDevices.map((d) => (
            <div key={d.name} className="sync-device">
              <div className="sync-device-head">
                <Icon name={d.platform === 'android' ? 'tab' : 'globe'} size={15} /> {d.name}
                <span className="sync-device-when">{when(d.updated)}</span>
              </div>
              {d.tabs.slice(0, 12).map((tab) => (
                <button key={tab.url} className="sync-tab" title={tab.url} onClick={() => cmd({ type: 'tab:new', url: tab.url })}>
                  {tab.title || tab.url}
                </button>
              ))}
            </div>
          ))}
        </>
      )}

      {!sync.builtInKey && (
        <details className="sync-key" open={!sync.configured}>
          <summary>{t('sync.keyTitle')}</summary>
          <p className="settings-lead">
            {t('sync.keyBody')}{' '}
            <a href={GUIDE} onClick={(e) => (e.preventDefault(), cmd({ type: 'tab:new', url: GUIDE }))}>
              {t('sync.keyGuide')}
            </a>
          </p>
          <div className="sync-key-row">
            <input placeholder="Client ID" value={id} onChange={(e) => setId(e.target.value)} spellCheck={false} />
            <input placeholder="Client secret" value={secret} onChange={(e) => setSecret(e.target.value)} spellCheck={false} type="password" />
            <button className="btn primary" disabled={!id.trim() || !secret.trim()} onClick={() => cmd({ type: 'sync:key', clientId: id, clientSecret: secret })}>
              {t('sync.keySave')}
            </button>
          </div>
          {sync.configured && <div className="toggle-hint">{t('sync.keyReady')}</div>}
        </details>
      )}
      <p className="toggle-hint">{t('sync.privacy')}</p>
    </div>
  );
}
