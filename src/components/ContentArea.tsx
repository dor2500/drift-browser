import { Fragment, useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import type { BrowserState, Pane, Snapshot } from '../../shared/types';
import { cmd, cx } from '../lib';
import { isInternalUrl } from '../../shared/url';
import { FindBar } from './FindBar';
import { Glance } from './Glance';
import { NewTabPage } from './NewTabPage';
import { SettingsPage } from './SettingsPage';
import { StorePage } from './StorePage';
import { t } from '../i18n';

interface Props {
  state: BrowserState;
  snapshots: Snapshot[];
  dimmed: boolean;
  findOpen: boolean;
  onCloseFind: () => void;
}

/**
 * Draws empty placeholder panes and reports their screen rectangles to the
 * main process, which moves the native web views on top of them. Layout is
 * plain CSS, so split view, compact mode and resizing all come for free.
 */
export function ContentArea({ state, snapshots, dimmed, findOpen, onCloseFind }: Props) {
  const ref = useRef<HTMLElement>(null);
  const active = state.activeTabId;
  const split = state.split && active && state.split.tabIds.includes(active) ? state.split : undefined;
  const ids = split ? split.tabIds : active ? [active] : [];

  const [liveRatio, setLiveRatio] = useState<number | null>(null);
  useEffect(() => setLiveRatio(null), [state.split?.ratio]);
  const ratio = liveRatio ?? split?.ratio ?? 0.5;

  const glance = state.glance;
  const glanceTab = glance && state.tabs.find((t) => t.id === glance.id);
  const [readyGlance, setReadyGlance] = useState<string | null>(null);
  const glanceReady = !!glanceTab && readyGlance === glanceTab.id;
  const onGlanceReady = useCallback(() => setReadyGlance(glance?.id ?? null), [glance?.id]);

  const internal = new Set(ids.filter((id) => isInternalUrl(state.tabs.find((t) => t.id === id)?.url ?? '')));
  const key = ids.map((id) => (internal.has(id) ? `${id}:internal` : id)).join('|') + (glanceReady ? `|glance:${glanceTab!.id}` : '');
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    let frame = 0;
    let last = '';
    const report = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const panes: Pane[] = [...root.querySelectorAll<HTMLElement>('[data-pane]')].map((el) => {
          const b = el.getBoundingClientRect();
          return {
            tabId: el.dataset.pane!,
            rect: { x: Math.round(b.left), y: Math.round(b.top), width: Math.round(b.width), height: Math.round(b.height) },
          };
        });
        const sig = JSON.stringify(panes);
        if (sig !== last) {
          last = sig;
          window.drift.layout(panes);
        }
      });
    };
    const ro = new ResizeObserver(report);
    ro.observe(root);
    root.querySelectorAll('[data-pane]').forEach((el) => ro.observe(el));
    window.addEventListener('resize', report);
    report();
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', report);
      cancelAnimationFrame(frame);
    };
  }, [key, ratio, findOpen]);

  const startGutterDrag = (e: RPointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const box = el.parentElement!.getBoundingClientRect();
    el.setPointerCapture(e.pointerId);
    let r = ratio;
    const move = (ev: PointerEvent) => {
      const rtl = document.documentElement.dir === 'rtl';
      const x = rtl ? box.right - ev.clientX : ev.clientX - box.left;
      r = Math.min(0.85, Math.max(0.15, x / box.width));
      setLiveRatio(r);
    };
    const up = () => {
      el.removeEventListener('pointermove', move);
      cmd({ type: 'split:ratio', ratio: r });
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up, { once: true });
  };

  return (
    <main ref={ref} className={cx('content', dimmed && 'dimmed', glanceTab && 'glancing')}>
      {ids.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="panes">
          {ids.map((id, i) => {
            const snap = snapshots.find((s) => s.tabId === id);
            return (
              <Fragment key={id}>
                {i === 1 && <div className="split-gutter" onPointerDown={startGutterDrag} />}
                <div
                  className={cx('pane', split && id === active && 'focused', internal.has(id) && 'internal')}
                  // Internal pages (drift://settings) are drawn here; only web pages get a native view.
                  data-pane={internal.has(id) ? undefined : id}
                  style={split ? { flex: `${i === 0 ? ratio : 1 - ratio} 1 0` } : undefined}
                  onMouseDown={() => split && id !== active && cmd({ type: 'tab:activate', id })}
                >
                  {internal.has(id) ? (
                    state.tabs.find((t) => t.id === id)?.url.startsWith('drift://newtab') ? (
                      <NewTabPage state={state} />
                    ) : state.tabs.find((t) => t.id === id)?.url.startsWith('drift://store') ? (
                      <StorePage state={state} />
                    ) : (
                      <SettingsPage state={state} />
                    )
                  ) : (
                    snap && <img className="pane-snapshot" src={snap.dataUrl} alt="" />
                  )}
                </div>
              </Fragment>
            );
          })}
        </div>
      )}
      {findOpen && ids.length > 0 && !internal.has(ids[0]) && <FindBar find={state.find} onClose={onCloseFind} />}
      {glance && glanceTab && (
        <Glance
          key={glanceTab.id}
          glance={glance}
          tab={glanceTab}
          ready={glanceReady}
          snapshot={snapshots.find((s) => s.tabId === glanceTab.id)}
          onReady={onGlanceReady}
        />
      )}
    </main>
  );
}

function EmptyState() {
  return (
    <div className="empty-state">
      <div className="big">{t('empty.title')}</div>
      <div className="keys">
        <span><kbd>Ctrl</kbd><kbd>T</kbd>{t('empty.newTab')}</span>
        <span><kbd>Ctrl</kbd><kbd>Alt</kbd><kbd>→</kbd>{t('empty.nextSpace')}</span>
        <span><kbd>Ctrl</kbd><kbd>Alt</kbd><kbd>C</kbd>{t('empty.compact')}</span>
      </div>
    </div>
  );
}
