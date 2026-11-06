import { useEffect, useState } from 'react';
import type { BrowserState, TabState } from '../../shared/types';
import { cmd, cx } from '../lib';
import { Favicon } from './Favicon';
import { Icon } from './Icon';
import { t } from '../i18n';

/** Icons at the end of the address bar: copy link and the ad-blocking shield. */
export function PageActions({ tab, state }: { tab?: TabState; state: BrowserState }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => setCopied(false), [tab?.url]);
  const web = !!tab && /^https?:/.test(tab.url);
  const on = state.settings.adblock;
  const host = web ? new URL(tab!.url).hostname.replace(/^www\./, '') : '';
  const paused = !!host && state.settings.adblockPaused.some((h) => host === h || host.endsWith('.' + h));
  const count = tab?.blocked ?? 0;

  return (
    <div className="page-actions">
      {web && (
        <button
          className="page-action"
          title={copied ? t('url.copied') : t('url.copyLink')}
          onClick={() => {
            void navigator.clipboard.writeText(tab!.url);
            setCopied(true);
          }}
        >
          <Icon name={copied ? 'check' : 'link'} size={14} />
        </button>
      )}
      <button
        className={cx('page-action', 'shield', on && !paused && 'active')}
        title={!on ? t('shield.off') : paused ? t('shield.paused') : t('shield.count', { count })}
        onClick={() => window.drift.shieldMenu()}
      >
        <Icon name="shield" size={14} />
        {on && !paused && count > 0 && <span className="shield-count">{count > 99 ? '99+' : count}</span>}
      </button>
    </div>
  );
}

/** Media controls for the page playing audio or video, like Zen's sidebar player. */
export function MediaBar({ state }: { state: BrowserState }) {
  const m = state.media;
  const tab = m && state.tabs.find((t) => t.id === m.tabId);
  if (!m || !tab) return null;
  return (
    <div className="media-bar">
      <button className="media-title" title={tab.title} onClick={() => cmd({ type: 'tab:activate', id: tab.id })}>
        <Favicon tab={tab} />
        <span>{tab.title}</span>
      </button>
      <div className="media-buttons">
        <button title={t('media.prev')} onClick={() => cmd({ type: 'media:control', id: tab.id, action: 'prev' })}>
          <Icon name="prev" size={14} />
        </button>
        <button title={m.playing ? t('media.pause') : t('media.play')} onClick={() => cmd({ type: 'media:control', id: tab.id, action: 'toggle' })}>
          <Icon name={m.playing ? 'pause' : 'play'} size={15} />
        </button>
        <button title={t('media.next')} onClick={() => cmd({ type: 'media:control', id: tab.id, action: 'next' })}>
          <Icon name="next" size={14} />
        </button>
        <button title={tab.muted ? t('tabs.unmute') : t('tabs.mute')} onClick={() => cmd({ type: 'tab:set', id: tab.id, muted: !tab.muted })}>
          <Icon name={tab.muted ? 'muted' : 'speaker'} size={15} />
        </button>
      </div>
    </div>
  );
}
