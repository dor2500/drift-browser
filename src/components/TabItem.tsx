import type { SyntheticEvent } from 'react';
import type { DropPosition, TabGroup, TabState } from '../../shared/types';
import { cmd, cx, endTabDrag, isTabDrag, startTabDrag, tabTitle } from '../lib';
import { Favicon } from './Favicon';
import { Icon } from './Icon';
import { t } from '../i18n';
import { useTabSwipe } from './useTabSwipe';
import { TAB_GROUP_COLORS } from './TabGroupHeader';

interface Props {
  tab: TabState;
  selected: boolean;
  inSplit: boolean;
  /** A permission prompt is waiting in this background tab. */
  attention?: boolean;
  dropPos?: DropPosition;
  swipeEnabled?: boolean;
  group?: TabGroup;
  onDragOverItem: (pos: DropPosition) => void;
}

const stop = (e: SyntheticEvent) => e.stopPropagation();

export function TabItem({ tab, selected, inSplit, attention, dropPos, swipeEnabled = true, group, onDragOverItem }: Props) {
  const swipe = useTabSwipe({
    enabled: swipeEnabled && !tab.essential,
    onClose: () => cmd({ type: 'tab:close', id: tab.id }),
  });

  const groupStyle = group ? TAB_GROUP_COLORS[group.color] : undefined;

  return (
    <div
      className={cx(
        'tab',
        selected && 'selected',
        inSplit && 'in-split',
        tab.asleep && !selected && 'asleep',
        group && 'in-tab-group',
        dropPos && `drop-${dropPos}`,
        swipe.closing && 'closing',
      )}
      style={{
        ...swipe.style,
        ...(groupStyle ? ({ '--group-tint': groupStyle.border } as React.CSSProperties) : {}),
      }}
      title={`${tab.title}\n🌐 ${tab.url || 'about:blank'}${
        tab.asleep ? '\n💤 מצב חיסכון בזיכרון פעיל (Memory Saver — שוחרר זיכרון RAM)' : '\n⚡ פעיל'
      }${tab.audible ? '\n🔊 משמיע מדיה' : ''}${tab.muted ? '\n🔇 מושתק' : ''}${tab.pinned ? '\n📌 כרטיסייה נעוצה' : ''}`}
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
      <div className="tab-favicon-wrap">
        <Favicon tab={tab} />
        {tab.asleep && <span className="tab-sleep-badge" title="חיסכון בזיכרון (Memory Saver)">💤</span>}
      </div>
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
