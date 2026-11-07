import { useEffect, useState } from 'react';
import type { BrowserState, TabState } from '../../shared/types';
import { aiActions, clipboardActions, cmd, cx } from '../lib';
import { Favicon } from './Favicon';
import { Icon } from './Icon';
import { t } from '../i18n';

export type PopoverKind = 'clipboard' | 'darkmode' | 'handoff';

export const openShellPopover = (kind: PopoverKind) =>
  window.dispatchEvent(new CustomEvent<PopoverKind>('drift:popover', { detail: kind }));

/** Icons at the end of the address bar: copy link, tab handoff, cloud clipboard, dark mode, local AI, and ad-blocking shield. */
export function PageActions({ tab, state }: { tab?: TabState; state: BrowserState }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => setCopied(false), [tab?.url]);
  const web = !!tab && /^https?:/.test(tab.url);
  const on = state.settings.adblock;
  const host = web ? new URL(tab!.url).hostname.replace(/^www\./, '').toLowerCase() : '';
  const paused = !!host && state.settings.adblockPaused.some((h) => host === h || host.endsWith('.' + h));
  const count = tab?.blocked ?? 0;

  const dm = state.settings.darkMode;
  const siteDark =
    web &&
    (dm.enabled
      ? !dm.disabledHosts.some((h) => host === h || host.endsWith('.' + h))
      : dm.forcedHosts.some((h) => host === h || host.endsWith('.' + h)));

  return (
    <div className="page-actions">
      {tab?.zoom && (
        <button className="page-action zoom-badge" title={t('zoom.reset', { percent: tab.zoom })} onClick={() => cmd({ type: 'zoom', dir: 0 })}>
          {tab.zoom}%
        </button>
      )}
      {web && (
        <button
          className="page-action"
          title="הוספה או הסרה מהסימניות · Bookmark this tab (Ctrl+D)"
          onClick={() => cmd({ type: 'bookmark:toggle', url: tab!.url, title: tab!.title })}
        >
          <Icon name="star" size={14} />
        </button>
      )}
      {web && (
        <button
          className="page-action"
          title="מצב קריאה · Reading Mode"
          onClick={() => cmd({ type: 'page:readingMode' })}
        >
          <Icon name="book" size={14} />
        </button>
      )}
      {web && (
        <button
          className="page-action"
          title="יצירת קוד QR לשיתוף דף עם הנייד (Create QR code)"
          onClick={() => cmd({ type: 'page:qr', url: tab!.url })}
        >
          <Icon name="qr" size={14} />
        </button>
      )}
      {web && (
        <button
          className="page-action"
          title="תרגם דף זה באמצעות Google Translate"
          onClick={() => cmd({ type: 'page:translate' })}
        >
          <Icon name="globe" size={14} />
        </button>
      )}
      {web && (
        <button
          className="page-action"
          title={copied ? t('url.copied') : t('url.copyLink')}
          onClick={() => {
            clipboardActions.pushCurrentOrText(tab!.url);
            setCopied(true);
          }}
        >
          <Icon name={copied ? 'check' : 'link'} size={14} />
        </button>
      )}
      <button
        className={cx('page-action', state.sync.otherDevices.length > 0 && 'active')}
        title="Cross-Device Tab Handoff (Send tab or view other devices)"
        onClick={() => openShellPopover('handoff')}
      >
        <Icon name="devices" size={14} />
      </button>
      <button
        className={cx('page-action', state.clipboard.length > 0 && 'active')}
        title={t('clip.title')}
        onClick={() => openShellPopover('clipboard')}
      >
        <Icon name="clipboard" size={14} />
      </button>
      <button
        className={cx('page-action', (siteDark || dm.enabled) && 'active')}
        title={t('dm.title')}
        onClick={() => openShellPopover('darkmode')}
      >
        <Icon name="moon" size={14} />
      </button>
      <button
        className={cx('page-action', state.ai.open && 'active')}
        title={`${t('ai.title')} (Ctrl+Shift+A)`}
        onClick={() => aiActions.togglePanel()}
      >
        <Icon name="sparkles" size={14} />
      </button>
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
        <button title={t('act.pip')} onClick={() => cmd({ type: 'page:pip' })}>
          <Icon name="pip" size={15} />
        </button>
        <button title={tab.muted ? t('tabs.unmute') : t('tabs.mute')} onClick={() => cmd({ type: 'tab:set', id: tab.id, muted: !tab.muted })}>
          <Icon name={tab.muted ? 'muted' : 'speaker'} size={15} />
        </button>
      </div>
    </div>
  );
}
