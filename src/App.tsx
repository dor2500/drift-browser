import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { colorTheme } from '../shared/colorThemes';
import { THEMES, contentRadiusFor } from '../shared/themes';
import type { HandoffItem, Snapshot } from '../shared/types';
import { AiAssistantPanel } from './components/AiAssistantPanel';
import { CloudClipboardPanel } from './components/CloudClipboardPanel';
import { CommandBar } from './components/CommandBar';
import { ContentArea } from './components/ContentArea';
import { DarkModePanel } from './components/DarkModePanel';
import { HandoffPanel } from './components/HandoffPanel';
import { Icon } from './components/Icon';
import { Onboarding } from './components/Onboarding';
import { type PopoverKind } from './components/PageActions';
import { Sidebar } from './components/Sidebar';
import { TopBar, type Anchor } from './components/TopBar';
import { OperaRail } from './components/OperaRail';
import { loadLocale, t, useLocale } from './i18n';
import { cx, useBrowserState } from './lib';

type BarMode = 'new' | 'current';
type OverlayReason = 'bar' | 'onboarding' | 'popover';

export function App() {
  const state = useBrowserState();
  useLocale();

  // Switch language live when the setting changes.
  const language = state?.settings.language;
  const firstLanguage = useRef(language);
  useEffect(() => {
    if (language === undefined || language === firstLanguage.current) return;
    firstLanguage.current = language;
    void loadLocale();
  }, [language]);
  const [bar, setBar] = useState<BarMode | null>(null);
  const [anchor, setAnchor] = useState<Anchor | undefined>();
  const horizontal = state ? !state.settings.verticalTabs : false;
  const horizontalRef = useRef(horizontal);
  horizontalRef.current = horizontal;
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [renamingSpace, setRenamingSpace] = useState<string | null>(null);
  const [peek, setPeek] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [glanceSnaps, setGlanceSnaps] = useState<Snapshot[]>([]);
  const [popover, setPopover] = useState<PopoverKind | null>(null);
  const [handoffToast, setHandoffToast] = useState<HandoffItem | null>(null);

  // Native web views paint above HTML. While any HTML layer must cover the
  // page (command bar, first-run setup, floating popover), the main process
  // swaps the views for screenshots. Several layers can hold that at once.
  const holders = useRef(new Set<OverlayReason>());
  const hold = useCallback(async (reason: OverlayReason, on: boolean) => {
    const before = holders.current.size > 0;
    if (on) holders.current.add(reason);
    else holders.current.delete(reason);
    const after = holders.current.size > 0;
    if (before === after) return;
    if (after) {
      const snaps = await window.drift.overlay(true);
      if (holders.current.size > 0) setSnapshots(snaps);
    } else {
      setSnapshots([]);
      void window.drift.overlay(false);
    }
  }, []);

  // Screenshots of the page(s) behind a Glance; dropped once it closes.
  const glanceId = state?.glance?.id;
  useEffect(() => {
    if (!glanceId) setGlanceSnaps([]);
  }, [glanceId]);

  const openBar = useCallback(
    (mode: BarMode, at?: Anchor) => {
      setAnchor(at);
      setBar(mode);
      void hold('bar', true);
    },
    [hold],
  );

  /** In top-tab layouts the bar drops down from the omnibox, like Chrome and Firefox. */
  const omniboxAnchor = (): Anchor | undefined => {
    const r = document.querySelector('.omnibox-text')?.getBoundingClientRect();
    return r ? { left: r.left, top: r.top, width: r.width } : undefined;
  };
  const closeBar = useCallback(() => {
    setBar(null);
    void hold('bar', false);
  }, [hold]);

  const closePopover = useCallback(() => {
    setPopover(null);
    void hold('popover', false);
  }, [hold]);

  useEffect(() => {
    const open = () => setFindOpen(true);
    const onPopover = (ev: Event) => {
      const kind = (ev as CustomEvent<PopoverKind>).detail;
      setPopover((prev) => {
        const next = prev === kind ? null : kind;
        void hold('popover', next !== null);
        return next;
      });
    };
    window.addEventListener('drift:find', open);
    window.addEventListener('drift:popover', onPopover);
    return () => {
      window.removeEventListener('drift:find', open);
      window.removeEventListener('drift:popover', onPopover);
    };
  }, [hold]);

  const activeId = state?.activeTabId;
  useEffect(() => setFindOpen(false), [activeId]);

  const onboarding = state ? !state.settings.onboarded : false;
  useEffect(() => {
    void hold('onboarding', onboarding);
  }, [onboarding, hold]);

  const theme = state?.settings.theme ?? 'zen';
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(
    () =>
      window.drift.onUi((e) => {
        if (e.type === 'commandbar') {
          if (!horizontalRef.current) openBar(e.mode);
          // Top-tab browsers open a real new tab on Ctrl+T, then focus the omnibox.
          else if (e.mode === 'new') void window.drift.cmd({ type: 'tab:new' }).then(() => openBar('current', omniboxAnchor()));
          else openBar('current', omniboxAnchor());
        } else if (e.type === 'space:rename') setRenamingSpace(e.id);
        else if (e.type === 'glance:backdrop') setGlanceSnaps(e.snapshots);
        else if (e.type === 'find') setFindOpen(true);
        else if (e.type === 'handoff:received') {
          setHandoffToast(e.item);
          setTimeout(() => setHandoffToast((cur) => (cur?.id === e.item.id ? null : cur)), 4500);
        }
      }),
    [openBar],
  );

  if (!state) return null;
  const space = state.spaces.find((s) => s.id === state.activeSpaceId)!;
  const info = THEMES[state.settings.theme];
  const ct = colorTheme(state.settings.colorTheme);
  const accent = state.settings.spaceColors ? space.accent : state.settings.customAccent || ct?.accent || info.accent;
  // A colour theme repaints the window and page backgrounds; the style keeps its layout and shapes.
  const themeVars: Record<string, string> = ct
    ? {
        '--window-bg': ct.bg,
        '--surface': ct.surface,
        '--panel': `color-mix(in srgb, ${ct.surface} 85%, white 6%)`,
        '--urlbar-bg': `color-mix(in srgb, ${ct.surface} 75%, black)`,
        '--element-bg': `color-mix(in srgb, ${ct.surface} 70%, white 8%)`,
        '--tab-selected': `color-mix(in srgb, ${ct.accent} 20%, rgba(255, 255, 255, 0.12))`,
        '--essential-bg': `color-mix(in srgb, ${ct.surface} 80%, white 5%)`,
        '--essential-selected': `color-mix(in srgb, ${ct.accent} 30%, ${ct.surface})`,
        '--hstrip-bg': ct.bg,
        '--toolbar-bg': ct.surface,
        '--htab-selected': `color-mix(in srgb, ${ct.accent} 18%, ${ct.surface})`,
        '--omni-bg': `color-mix(in srgb, ${ct.surface} 70%, black)`,
      }
    : {};
  // A permission prompt lives in the sidebar, so compact mode must reveal it.
  const focusId = state.glance?.id ?? state.activeTabId;
  const activeTab = state.tabs.find((t) => t.id === focusId);
  const sidebarOpen = !state.compact || peek || state.prompts.some((p) => p.tabId === focusId);

  return (
    <div
      className={cx('app', horizontal ? 'horizontal' : state.compact && 'compact', (horizontal || sidebarOpen) && 'sidebar-open')}
      style={
        {
          ...themeVars,
          '--accent': accent,
          '--content-radius': `${contentRadiusFor(state.settings)}px`,
          '--sidebar-width': `${state.sidebarWidth}px`,
        } as CSSProperties
      }
    >
      {horizontal ? (
        <TopBar state={state} onOpenBar={openBar} />
      ) : (
        <>
          {state.compact && !peek && <div className="peek-zone" onMouseEnter={() => setPeek(true)} />}
          <Sidebar
            state={state}
            onOpenBar={(mode) => openBar(mode)}
            renamingSpace={renamingSpace}
            onRenameDone={() => setRenamingSpace(null)}
            onMouseLeave={() => setPeek(false)}
          />
        </>
      )}
      {(() => {
        const contentWithAi = (
          <div className="workspace-main">
            <ContentArea
              state={state}
              snapshots={[...snapshots, ...glanceSnaps]}
              dimmed={bar !== null || onboarding || popover !== null}
              findOpen={findOpen}
              onCloseFind={() => setFindOpen(false)}
            />
            {state.ai.open && (
              <AiAssistantPanel
                ai={state.ai}
                settings={state.settings.ai}
                activeTab={activeTab}
              />
            )}
          </div>
        );
        // Opera One keeps a rail of shortcuts beside the page.
        return horizontal && theme === 'opera' ? (
          <div className="opera-body">
            <OperaRail state={state} />
            {contentWithAi}
          </div>
        ) : (
          contentWithAi
        );
      })()}

      {/* Floating Popover Modal for Dark Mode, Cloud Clipboard, or Tab Handoff */}
      {popover && (
        <div className="shell-popover-backdrop" onMouseDown={closePopover}>
          <div className="shell-popover-card" onMouseDown={(e) => e.stopPropagation()}>
            {popover === 'darkmode' && (
              <DarkModePanel
                darkMode={state.settings.darkMode}
                activeUrl={activeTab?.url}
                onClose={closePopover}
              />
            )}
            {popover === 'clipboard' && (
              <CloudClipboardPanel
                items={state.clipboard}
                settings={state.settings.clipboardSync}
                sync={state.sync}
                onClose={closePopover}
              />
            )}
            {popover === 'handoff' && (
              <HandoffPanel
                sync={state.sync}
                activeTab={activeTab}
                onClose={closePopover}
              />
            )}
          </div>
        </div>
      )}

      {/* Real-time Incoming Tab Handoff Notification */}
      {handoffToast && (
        <div className="handoff-live-banner">
          <Icon name="devices" size={16} />
          <span>
            {t('sync.handoffToast', { device: handoffToast.fromDeviceName })}:{' '}
            <strong>{handoffToast.title || handoffToast.url}</strong>
          </span>
          <button className="tb-btn" onClick={() => setHandoffToast(null)}>
            <Icon name="x" size={13} />
          </button>
        </div>
      )}

      {bar && <CommandBar key={bar} mode={bar} state={state} anchor={horizontal ? anchor : undefined} onClose={closeBar} />}
      {onboarding && <Onboarding state={state} />}
    </div>
  );
}
