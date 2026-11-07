import { useEffect, useRef, useState, type CSSProperties, type DragEvent, type PointerEvent as RPointerEvent, type WheelEvent } from 'react';
import { SIDEBAR_MAX, SIDEBAR_MIN, type BrowserState, type DropPosition, type DropZone, type SpaceState, type TabState } from '../../shared/types';
import { displayUrl, isInternalUrl } from '../../shared/url';
import { TAB_MIME, cmd, cx, endTabDrag, isTabDrag, startTabDrag } from '../lib';
import { Favicon } from './Favicon';
import { Icon } from './Icon';
import { DownloadsButton } from './DownloadsButton';
import { MediaBar, PageActions } from './PageActions';
import { PermissionCard } from './PermissionCard';
import { SpaceIcon } from './SpaceIcon';
import { TabItem } from './TabItem';
import { hasUpdateBadge } from './UpdatePanels';
import { t } from '../i18n';

interface Props {
  state: BrowserState;
  onOpenBar: (mode: 'new' | 'current') => void;
  renamingSpace: string | null;
  onRenameDone: () => void;
  onMouseLeave: () => void;
}

export function Sidebar({ state, onOpenBar, renamingSpace, onRenameDone, onMouseLeave }: Props) {
  const space = state.spaces.find((s) => s.id === state.activeSpaceId)!;
  // While a Glance is open, the toolbar and URL pill act on it.
  const active = state.tabs.find((t) => t.id === (state.glance?.id ?? state.activeTabId));
  const essentials = state.tabs.filter((t) => t.essential);
  const own = state.tabs.filter((t) => !t.essential && !t.glanceOf && t.spaceId === space.id);
  const pinned = own.filter((t) => t.pinned);
  const regular = own.filter((t) => !t.pinned);
  const splitIds = state.split?.tabIds ?? [];
  const myPrompts = active ? state.prompts.filter((p) => p.tabId === active.id) : [];
  const waiting = new Set(state.prompts.map((p) => p.tabId));

  // Slide the tab list left/right when switching spaces, like Zen.
  const idx = state.spaces.indexOf(space);
  const prevIdx = useRef(idx);
  const dir = useRef<'left' | 'right' | 'none'>('none');
  if (prevIdx.current !== idx) {
    dir.current = idx > prevIdx.current ? 'left' : 'right';
    prevIdx.current = idx;
  }

  // Two-finger horizontal swipe over the sidebar switches spaces.
  const swipe = useRef({ acc: 0, until: 0 });
  const onWheel = (e: WheelEvent) => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || Date.now() < swipe.current.until) return;
    swipe.current.acc += e.deltaX;
    if (Math.abs(swipe.current.acc) > 120) {
      cmd({ type: 'space:cycle', dir: swipe.current.acc > 0 ? 1 : -1 });
      swipe.current = { acc: 0, until: Date.now() + 450 };
    }
  };

  // Live width while dragging the resize handle; committed on release.
  const [liveWidth, setLiveWidth] = useState<number | null>(null);
  useEffect(() => setLiveWidth(null), [state.sidebarWidth]);
  const startResize = (e: RPointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startW = state.sidebarWidth;
    let w = startW;
    const move = (ev: PointerEvent) => {
      const dx = document.documentElement.dir === 'rtl' ? startX - ev.clientX : ev.clientX - startX;
      w = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, startW + dx));
      setLiveWidth(w);
    };
    const up = () => {
      el.removeEventListener('pointermove', move);
      cmd({ type: 'ui:sidebarWidth', width: w });
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up, { once: true });
  };

  return (
    <aside
      className="sidebar"
      style={liveWidth ? ({ '--sidebar-width': `${liveWidth}px` } as CSSProperties) : undefined}
      onMouseLeave={onMouseLeave}
      onWheel={onWheel}
    >
      <div className="sidebar-top drag">
        <button className="icon-btn" title={t('nav.menu')} onClick={() => window.drift.appMenu()}>
          <Icon name="moreh" />
        </button>
        <button className="icon-btn" title={t('nav.compact')} onClick={() => cmd({ type: 'ui:compact' })}>
          <Icon name="sidebar" />
        </button>
        <button className="icon-btn" title={`${t('nav.back')} (Alt+←)`} disabled={!active?.canGoBack} onClick={() => cmd({ type: 'tab:back' })}>
          <Icon name="back" />
        </button>
        <button className="icon-btn" title={`${t('nav.forward')} (Alt+→)`} disabled={!active?.canGoForward} onClick={() => cmd({ type: 'tab:forward' })}>
          <Icon name="forward" />
        </button>
        <button className="icon-btn" title={`${t('nav.reload')} (Ctrl+R)`} disabled={!active} onClick={() => cmd({ type: 'tab:reload' })}>
          <Icon name="reload" />
        </button>
        <div className="spacer" />
        <button className="icon-btn win-ctl" title={t('win.minimize')} onClick={() => cmd({ type: 'win:minimize' })}>
          <Icon name="minimize" size={14} />
        </button>
        <button className="icon-btn win-ctl" title={t('win.maximize')} onClick={() => cmd({ type: 'win:maximize' })}>
          <Icon name="maximize" size={14} />
        </button>
        <button className="icon-btn win-ctl win-close" title={t('win.close')} onClick={() => cmd({ type: 'win:close' })}>
          <Icon name="x" size={15} />
        </button>
      </div>

      <div className="urlbar-pill">
        <button
          className="site-btn"
          title={t('url.sitePermissions')}
          disabled={!active || !/^https?:/.test(active.url)}
          onClick={() => window.drift.siteMenu()}
        >
          <Icon name={active?.url.startsWith('https:') ? 'lock' : 'search'} size={14} />
        </button>
        <button className="urlbar-text" title="Ctrl+L" onClick={() => onOpenBar('current')}>
          {active ? (active.url.startsWith('drift://newtab') ? t('url.placeholder') : isInternalUrl(active.url) ? t('set.title') : displayUrl(active.url)) : t('url.placeholder')}
        </button>
        <PageActions tab={active} state={state} />
      </div>

      {myPrompts[0] && <PermissionCard key={myPrompts[0].id} prompt={myPrompts[0]} extra={myPrompts.length - 1} />}

      <Essentials tabs={essentials} activeId={state.activeTabId} />

      <div className="space-viewport">
        <div key={space.id} className={`space-content slide-${dir.current}`}>
          <SpaceHeader space={space} renaming={renamingSpace === space.id} onDone={onRenameDone} />
          <TabSection zone="pinned" tabs={pinned} activeId={state.activeTabId} splitIds={splitIds} waiting={waiting} swipeEnabled={state.settings.swipeToCloseTabs} />
          <div className="pinned-separator">
            {regular.length > 0 && (
              <button title={t('tabs.clearHint')} onClick={() => cmd({ type: 'space:clear', id: space.id })}>
                {t('tabs.clear')}
              </button>
            )}
          </div>
          <button className="new-tab" onClick={() => onOpenBar('new')}>
            <Icon name="plus" />
            <span className="tab-label">{t('tabs.new')}</span>
          </button>
          <TabSection zone="tabs" tabs={regular} activeId={state.activeTabId} splitIds={splitIds} waiting={waiting} swipeEnabled={state.settings.swipeToCloseTabs} />
        </div>
      </div>

      <MediaBar state={state} />
      <div className="sidebar-bottom">
        <button className="icon-btn settings-btn" title={t('settings.open')} onClick={() => cmd({ type: 'settings:open' })}>
          <Icon name="gear" size={15} />
          {hasUpdateBadge(state.updates, state.settings.updates.engineAlerts) && <span className="update-dot" />}
        </button>
        <SpaceSwitcher spaces={state.spaces} activeId={space.id} />
        <DownloadsButton downloads={state.downloads} className="icon-btn" />
      </div>
      <div className="sidebar-resize" onPointerDown={startResize} />
    </aside>
  );
}

function Essentials({ tabs, activeId }: { tabs: TabState[]; activeId?: string }) {
  const [over, setOver] = useState(false);
  const drop = (e: DragEvent, targetId?: string) => {
    const id = e.dataTransfer.getData(TAB_MIME);
    e.preventDefault();
    e.stopPropagation();
    setOver(false);
    endTabDrag();
    if (id) cmd({ type: 'tab:move', id, zone: 'essentials', targetId, position: 'before' });
  };
  return (
    <div
      className={cx('essentials', tabs.length === 0 && 'empty', over && 'over')}
      onDragOver={(e) => {
        if (!isTabDrag(e)) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setOver(false)}
      onDrop={(e) => drop(e)}
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          className={cx('essential', t.id === activeId && 'selected')}
          title={t.title}
          draggable
          onDragStart={(e) => startTabDrag(e, t.id)}
          onDragEnd={endTabDrag}
          onDrop={(e) => drop(e, t.id)}
          onMouseDown={(e) => e.button === 0 && cmd({ type: 'tab:activate', id: t.id })}
          onContextMenu={(e) => {
            e.preventDefault();
            window.drift.tabMenu(t.id);
          }}
        >
          <Favicon tab={t} />
        </button>
      ))}
    </div>
  );
}

function TabSection({ zone, tabs, activeId, splitIds, waiting, swipeEnabled }: { zone: DropZone; tabs: TabState[]; activeId?: string; splitIds: string[]; waiting: Set<string>; swipeEnabled?: boolean }) {
  const [drop, setDrop] = useState<{ id: string; pos: DropPosition } | null>(null);
  return (
    <div
      className={cx('tab-section', zone)}
      onDragOver={(e) => isTabDrag(e) && e.preventDefault()}
      onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setDrop(null)}
      onDrop={(e) => {
        const id = e.dataTransfer.getData(TAB_MIME);
        e.preventDefault();
        endTabDrag();
        if (id) cmd({ type: 'tab:move', id, zone, targetId: drop?.id, position: drop?.pos });
        setDrop(null);
      }}
    >
      {tabs.map((t) => (
        <TabItem
          key={t.id}
          tab={t}
          selected={t.id === activeId}
          inSplit={splitIds.includes(t.id)}
          attention={waiting.has(t.id) && t.id !== activeId}
          dropPos={drop?.id === t.id ? drop.pos : undefined}
          swipeEnabled={swipeEnabled}
          onDragOverItem={(pos) => (drop?.id !== t.id || drop.pos !== pos) && setDrop({ id: t.id, pos })}
        />
      ))}
    </div>
  );
}

function SpaceHeader({ space, renaming, onDone }: { space: SpaceState; renaming: boolean; onDone: () => void }) {
  const [editing, setEditing] = useState(false);
  const isEditing = editing || renaming;
  const finish = (name?: string) => {
    if (name !== undefined) cmd({ type: 'space:set', id: space.id, name });
    setEditing(false);
    onDone();
  };
  return (
    <div
      className="space-header"
      onDoubleClick={() => setEditing(true)}
      onContextMenu={(e) => {
        e.preventDefault();
        window.drift.spaceMenu(space.id);
      }}
    >
      <span className="space-icon"><SpaceIcon icon={space.icon} size={14} /></span>
      {isEditing ? (
        <input
          autoFocus
          defaultValue={space.name}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={(e) => finish(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') finish();
          }}
        />
      ) : (
        <span className="space-name">{space.name}</span>
      )}
    </div>
  );
}

function SpaceSwitcher({ spaces, activeId }: { spaces: SpaceState[]; activeId: string }) {
  return (
    <div className="space-switcher">
      {spaces.map((s) => (
        <button
          key={s.id}
          className={cx('space-dot', s.id === activeId && 'active')}
          title={`${s.name} (Ctrl+Alt+←/→)`}
          onClick={() => cmd({ type: 'space:activate', id: s.id })}
          onContextMenu={(e) => {
            e.preventDefault();
            window.drift.spaceMenu(s.id);
          }}
        >
          <SpaceIcon icon={s.icon} />
        </button>
      ))}
      <button className="icon-btn" title={t('spaces.new')} onClick={() => cmd({ type: 'space:new' })}>
        <Icon name="plus" size={15} />
      </button>
    </div>
  );
}
