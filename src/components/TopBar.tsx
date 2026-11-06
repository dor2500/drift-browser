import { useRef, useState } from 'react';
import { hostOf, permissionLabel } from '../../shared/permissions';
import type { BrowserState, DropPosition, PermissionPrompt, TabState } from '../../shared/types';
import { displayUrl, isInternalUrl } from '../../shared/url';
import { TAB_MIME, cmd, cx, endTabDrag, isTabDrag, startTabDrag, tabTitle } from '../lib';
import { Favicon } from './Favicon';
import { Icon } from './Icon';
import { DownloadsButton } from './DownloadsButton';
import { PageActions } from './PageActions';
import { iconForPermission } from './PermissionCard';
import { hasUpdateBadge } from './UpdatePanels';
import { t } from '../i18n';

export interface Anchor {
  left: number;
  top: number;
  width: number;
}

interface Props {
  state: BrowserState;
  onOpenBar: (mode: 'new' | 'current', anchor?: Anchor) => void;
}

/**
 * Top-tab layout used by the Chrome, Firefox and Brave styles: a tab strip
 * with window buttons, then a toolbar with navigation, the omnibox and the
 * ⋮ menu. Shapes differ per style in topbar.css ([data-theme] selectors).
 */
export function TopBar({ state, onOpenBar }: Props) {
  const space = state.spaces.find((s) => s.id === state.activeSpaceId)!;
  const focus = state.tabs.find((t) => t.id === (state.glance?.id ?? state.activeTabId));
  const essentials = state.tabs.filter((t) => t.essential);
  const own = state.tabs.filter((t) => !t.essential && !t.glanceOf && t.spaceId === space.id);
  const strip = [...essentials, ...own.filter((t) => t.pinned), ...own.filter((t) => !t.pinned)];
  const waiting = new Set(state.prompts.map((p) => p.tabId));
  const prompt = focus ? state.prompts.find((p) => p.tabId === focus.id) : undefined;
  const omnibox = useRef<HTMLButtonElement>(null);
  const [drop, setDrop] = useState<{ id: string; pos: DropPosition } | null>(null);

  const anchor = (): Anchor | undefined => {
    const r = omnibox.current?.getBoundingClientRect();
    return r ? { left: r.left, top: r.top, width: r.width } : undefined;
  };
  // Like Chrome: "+" opens a real new tab and puts the cursor in the omnibox.
  const newTab = async () => {
    await window.drift.cmd({ type: 'tab:new' });
    onOpenBar('current', anchor());
  };

  return (
    <header className="topbar">
      <div className="tabstrip drag">
        {state.spaces.length > 1 && (
          <button className="strip-btn space-btn" title={t('spaces.space', { name: space.name })} onClick={() => window.drift.spacesMenu()}>
            {space.icon}
          </button>
        )}
        <div
          className="htabs"
          onDragOver={(e) => isTabDrag(e) && e.preventDefault()}
          onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setDrop(null)}
          onDrop={(e) => {
            const id = e.dataTransfer.getData(TAB_MIME);
            e.preventDefault();
            endTabDrag();
            const target = strip.find((t) => t.id === drop?.id);
            if (id && target) {
              const zone = target.essential ? 'essentials' : target.pinned ? 'pinned' : 'tabs';
              cmd({ type: 'tab:move', id, zone, targetId: target.id, position: drop!.pos });
            }
            setDrop(null);
          }}
        >
          {strip.map((t) => (
            <HTab
              key={t.id}
              tab={t}
              selected={t.id === state.activeTabId}
              compact={t.essential || t.pinned}
              attention={waiting.has(t.id) && t.id !== state.activeTabId}
              dropPos={drop?.id === t.id ? drop.pos : undefined}
              onDragOverTab={(pos) => (drop?.id !== t.id || drop.pos !== pos) && setDrop({ id: t.id, pos })}
            />
          ))}
          <button className="strip-btn newtab-btn" title={`${t('menu.newTab')} (Ctrl+T)`} onClick={() => void newTab()}>
            <Icon name="plus" size={16} />
          </button>
        </div>
        <div className="strip-spacer" />
        <div className="caption-buttons">
          <button title={t('win.minimize')} onClick={() => cmd({ type: 'win:minimize' })}>
            <Icon name="minimize" size={14} />
          </button>
          <button title={t('win.maximize')} onClick={() => cmd({ type: 'win:maximize' })}>
            <Icon name="maximize" size={13} />
          </button>
          <button className="close" title={t('win.close')} onClick={() => cmd({ type: 'win:close' })}>
            <Icon name="x" size={15} />
          </button>
        </div>
      </div>

      <div className="toolbar">
        <button className="tb-btn" title={`${t('nav.back')} (Alt+←)`} disabled={!focus?.canGoBack} onClick={() => cmd({ type: 'tab:back' })}>
          <Icon name="back" size={18} />
        </button>
        <button className="tb-btn" title={`${t('nav.forward')} (Alt+→)`} disabled={!focus?.canGoForward} onClick={() => cmd({ type: 'tab:forward' })}>
          <Icon name="forward" size={18} />
        </button>
        <button className="tb-btn" title={`${t('nav.reload')} (Ctrl+R)`} disabled={!focus} onClick={() => cmd({ type: 'tab:reload' })}>
          <Icon name="reload" size={17} />
        </button>
        <div className="omnibox">
          <button
            className="omnibox-site"
            title={t('url.sitePermissions')}
            disabled={!focus || !/^https?:/.test(focus.url)}
            onClick={() => window.drift.siteMenu()}
          >
            <Icon name={focus?.url.startsWith('https:') ? 'lock' : 'search'} size={14} />
          </button>
          <button ref={omnibox} className="omnibox-text" title="Ctrl+L" onClick={() => onOpenBar('current', anchor())}>
            {focus ? (isInternalUrl(focus.url) ? t('set.title') : displayUrl(focus.url)) : t('url.placeholder')}
          </button>
          <PageActions tab={focus} state={state} />
        </div>
        {state.media && (
          <button
            className="tb-btn"
            title={state.media.playing ? t('media.pause') : t('media.play')}
            onClick={() => cmd({ type: 'media:control', id: state.media!.tabId, action: 'toggle' })}
          >
            <Icon name={state.media.playing ? 'pause' : 'play'} size={16} />
          </button>
        )}
        <DownloadsButton downloads={state.downloads} className="tb-btn" />
        <button className="tb-btn menu-btn" title={t('nav.menu')} onClick={() => window.drift.appMenu()}>
          <Icon name="more" size={18} />
          {hasUpdateBadge(state.updates, state.settings.updates.engineAlerts) && <span className="update-dot" />}
        </button>
      </div>

      {prompt && <PermissionBar key={prompt.id} prompt={prompt} />}
    </header>
  );
}

function HTab({
  tab,
  selected,
  compact,
  attention,
  dropPos,
  onDragOverTab,
}: {
  tab: TabState;
  selected: boolean;
  compact: boolean;
  attention: boolean;
  dropPos?: DropPosition;
  onDragOverTab: (pos: DropPosition) => void;
}) {
  return (
    <div
      className={cx('htab', selected && 'selected', compact && 'compact', tab.asleep && !selected && 'asleep', dropPos && `drop-${dropPos}`)}
      title={`${tab.title}\n${tab.url}`}
      draggable
      onDragStart={(e) => startTabDrag(e, tab.id)}
      onDragEnd={endTabDrag}
      onDragOver={(e) => {
        if (!isTabDrag(e)) return;
        e.preventDefault();
        const r = e.currentTarget.getBoundingClientRect();
        onDragOverTab(e.clientX < r.left + r.width / 2 ? 'before' : 'after');
      }}
      onMouseDown={(e) => e.button === 0 && cmd({ type: 'tab:activate', id: tab.id })}
      onAuxClick={(e) => e.button === 1 && cmd({ type: 'tab:close', id: tab.id })}
      onContextMenu={(e) => {
        e.preventDefault();
        window.drift.tabMenu(tab.id);
      }}
    >
      <Favicon tab={tab} />
      {!compact && <span className="htab-title">{tabTitle(tab, t('set.title'))}</span>}
      {attention && <span className="tab-attention" />}
      {!compact && (tab.audible || tab.muted) && (
        <button className="htab-icon" onMouseDown={(e) => e.stopPropagation()} onClick={() => cmd({ type: 'tab:set', id: tab.id, muted: !tab.muted })}>
          <Icon name={tab.muted ? 'muted' : 'speaker'} size={13} />
        </button>
      )}
      {!compact && (
        <button
          className="htab-icon htab-close"
          title={t('tabs.close')}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => cmd({ type: 'tab:close', id: tab.id })}
        >
          <Icon name="x" size={13} />
        </button>
      )}
    </div>
  );
}

/** Permission request as a bar under the toolbar (HTML can't float over the page). */
function PermissionBar({ prompt }: { prompt: PermissionPrompt }) {
  const [remember, setRemember] = useState(true);
  const respond = (allow: boolean) => cmd({ type: 'permission:respond', id: prompt.id, allow, remember });
  return (
    <div className="permission-bar" role="alertdialog">
      <Icon name={iconForPermission(prompt.kinds[0])} size={16} />
      <span className="pb-text">
        {t('perm.wantsTo', { site: hostOf(prompt.origin) })}: {prompt.kinds.map((k) => permissionLabel(k, t)).join(', ')}
      </span>
      <label className="perm-remember">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
        {t('perm.rememberShort')}
      </label>
      <button className="btn small" onClick={() => respond(false)}>
        {t('perm.block')}
      </button>
      <button className="btn small primary" onClick={() => respond(true)}>
        {t('perm.allow')}
      </button>
    </div>
  );
}
