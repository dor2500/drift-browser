import { useEffect, useLayoutEffect, useRef } from 'react';
import type { GlanceState, Snapshot, TabState } from '../../shared/types';
import { displayUrl } from '../../shared/url';
import { cmd } from '../lib';
import { Favicon } from './Favicon';
import { Icon } from './Icon';
import { t } from '../i18n';

interface Props {
  glance: GlanceState;
  tab: TabState;
  ready: boolean;
  snapshot?: Snapshot;
  onReady: () => void;
}

const GROW_MS = 280;

/**
 * Zen-style Glance: a floating card that grows out of the clicked link.
 * The card is HTML while it animates. Once it settles, it renders the
 * `data-pane` placeholder, and the main process drops the native page into it.
 */
export function Glance({ glance, tab, ready, snapshot, onReady }: Props) {
  const layer = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);

  // Grow from the click point. offsetLeft/Top ignore the running scale animation.
  useLayoutEffect(() => {
    const l = layer.current;
    const c = card.current;
    if (!l || !c || !glance.origin) return;
    const box = l.getBoundingClientRect();
    c.style.transformOrigin = `${glance.origin.x - box.left - c.offsetLeft}px ${glance.origin.y - box.top - c.offsetTop}px`;
  }, [glance.origin]);

  useEffect(() => {
    const t = setTimeout(onReady, GROW_MS);
    return () => clearTimeout(t);
  }, [onReady]);

  return (
    <div ref={layer} className="glance-layer" onMouseDown={(e) => e.target === e.currentTarget && cmd({ type: 'glance:close' })}>
      <div ref={card} className="glance-card">
        {ready ? (
          <div className="glance-view" data-pane={tab.id}>
            {snapshot && <img className="pane-snapshot" src={snapshot.dataUrl} alt="" />}
          </div>
        ) : (
          <div className="glance-loading">
            <Favicon tab={tab} />
            <span>{displayUrl(tab.url)}</span>
          </div>
        )}
      </div>
      <div className="glance-actions">
        <button className="glance-btn" title={t('glance.close')} onClick={() => cmd({ type: 'glance:close' })}>
          <Icon name="x" />
        </button>
        <button className="glance-btn" title={t('glance.expand')} onClick={() => cmd({ type: 'glance:expand' })}>
          <Icon name="expand" />
        </button>
        <button className="glance-btn" title={t('glance.split')} onClick={() => cmd({ type: 'glance:split' })}>
          <Icon name="split" />
        </button>
      </div>
    </div>
  );
}
