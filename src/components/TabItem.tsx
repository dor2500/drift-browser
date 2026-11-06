import type { SyntheticEvent } from 'react';
import type { DropPosition, TabState } from '../../shared/types';
import { cmd, cx, endTabDrag, isTabDrag, startTabDrag, tabTitle } from '../lib';
import { Favicon } from './Favicon';
import { Icon } from './Icon';
import { t } from '../i18n';

interface Props {
  tab: TabState;
  selected: boolean;
  inSplit: boolean;
  /** A permission prompt is waiting in this background tab. */
  attention?: boolean;
  dropPos?: DropPosition;
  onDragOverItem: (pos: DropPosition) => void;
}

const stop = (e: SyntheticEvent) => e.stopPropagation();

export function TabItem({ tab, selected, inSplit, attention, dropPos, onDragOverItem }: Props) {
  return (
    <div
      className={cx('tab', selected && 'selected', inSplit && 'in-split', dropPos && `drop-${dropPos}`)}
      title={`${tab.title}\n${tab.url}`}
      draggable
      onDragStart={(e) => startTabDrag(e, tab.id)}
      onDragEnd={endTabDrag}
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
      <span className="tab-label">{tabTitle(tab, t('set.title'))}</span>
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
