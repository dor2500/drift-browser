import type { SyntheticEvent } from 'react';
import type { DropPosition, TabState } from '../../shared/types';
import { cmd, cx, endTabDrag, isTabDrag, startTabDrag, tabTitle } from '../lib';
import { Favicon } from './Favicon';
import { Icon } from './Icon';
import { t } from '../i18n';
import { useTabSwipe } from './useTabSwipe';

interface Props {
  tab: TabState;
  selected: boolean;
  inSplit: boolean;
  /** A permission prompt is waiting in this background tab. */
  attention?: boolean;
  dropPos?: DropPosition;
  swipeEnabled?: boolean;
  onDragOverItem: (pos: DropPosition) => void;
}

const stop = (e: SyntheticEvent) => e.stopPropagation();

export function TabItem({ tab, selected, inSplit, attention, dropPos, swipeEnabled = true, onDragOverItem }: Props) {
  const swipe = useTabSwipe({
    enabled: swipeEnabled && !tab.essential,
    onClose: () => cmd({ type: 'tab:close', id: tab.id }),
  });

  return (
    <div
      className={cx(
        'tab',
        selected && 'selected',
        inSplit && 'in-split',
        tab.asleep && !selected && 'asleep',
        dropPos && `drop-${dropPos}`,
        swipe.closing && 'closing',
      )}
      style={swipe.style}
      title={`${tab.title}\n${tab.url}`}
      draggable
      onDragStart={(e) => startTabDrag(e, tab.id)}
      onDragEnd={endTabDrag}
      onWheel={swipe.onWheel}
      onTouchStart={swipe.onTouchStart}
      onTouchMove={swipe.onTouchMove}
      onTouchEnd={swipe.onTouchEnd}
      onDragOver={(e) => {
        if (!isTabDrag(e)) return;
        e.preventDefault();
        const r = e.currentTarget.getBoundingClientRect();
        onDragOverItem(e.clientY < r.top + r.height / 2 ? 'before' : 'after');
      }}
      // Browsers switch tabs on press, not release.
      onMouseDown={(e) => e.button === 0 && cmd({ type: 'tab:activate', id: tab.id })}
      onAuxClick={(e) => e.button === 1 && cmd({ type: 'tab:close', id: tab.id })}
      onContextMenu={(e) => {
        e.preventDefault();
        window.drift.tabMenu(tab.id);
      }}
    >
      <Favicon tab={tab} />
      <span className="tab-label">{tabTitle(tab, t('set.title'), t('tabs.new'))}</span>
      {attention && <span className="tab-attention" title={t('tabs.waiting')} />}
      {(tab.audible || tab.muted) && (
        <button className="tab-audio" title={tab.muted ? t('tabs.unmute') : t('tabs.mute')} onMouseDown={stop} onClick={() => cmd({ type: 'tab:set', id: tab.id, muted: !tab.muted })}>
          <Icon name={tab.muted ? 'muted' : 'speaker'} size={14} />
        </button>
      )}
      <button
        className="tab-close"
        title={t('tabs.close')}
        onMouseDown={stop}
        onClick={(e) => {
          e.stopPropagation();
          cmd({ type: 'tab:close', id: tab.id });
        }}
      >
        <Icon name="x" size={14} />
      </button>
    </div>
  );
}
