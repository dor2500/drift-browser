import { useState, useRef, useEffect } from 'react';
import type { TabGroup, TabGroupColor } from '../../shared/types';
import { cmd, cx } from '../lib';
import { Icon } from './Icon';

export const TAB_GROUP_COLORS: Record<
  TabGroupColor,
  { name: string; bg: string; border: string; text: string; dot: string }
> = {
  grey: { name: 'אפור', bg: 'rgba(107, 114, 128, 0.25)', border: '#9ca3af', text: '#e5e7eb', dot: '#9ca3af' },
  blue: { name: 'כחול', bg: 'rgba(59, 130, 246, 0.25)', border: '#3b82f6', text: '#93c5fd', dot: '#3b82f6' },
  red: { name: 'אדום', bg: 'rgba(239, 68, 68, 0.25)', border: '#ef4444', text: '#fca5a5', dot: '#ef4444' },
  yellow: { name: 'צהוב', bg: 'rgba(234, 179, 8, 0.25)', border: '#eab308', text: '#fde047', dot: '#eab308' },
  green: { name: 'ירוק', bg: 'rgba(16, 185, 129, 0.25)', border: '#10b981', text: '#6ee7b7', dot: '#10b981' },
  pink: { name: 'ורוד', bg: 'rgba(236, 72, 153, 0.25)', border: '#ec4899', text: '#f472b6', dot: '#ec4899' },
  purple: { name: 'סגול', bg: 'rgba(168, 85, 247, 0.25)', border: '#a855f7', text: '#d8b4fe', dot: '#a855f7' },
  cyan: { name: 'טורקיז', bg: 'rgba(6, 182, 212, 0.25)', border: '#06b6d4', text: '#67e8f9', dot: '#06b6d4' },
};

interface Props {
  group: TabGroup;
  tabCount: number;
  layout?: 'horizontal' | 'vertical';
}

export function TabGroupHeader({ group, tabCount, layout = 'horizontal' }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(group.name);
  const menuRef = useRef<HTMLDivElement>(null);

  const style = TAB_GROUP_COLORS[group.color] || TAB_GROUP_COLORS.blue;

  useEffect(() => {
    setNameValue(group.name);
  }, [group.name]);

  // Click outside to close menu
  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setEditingName(false);
      }
    };
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  const toggleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation();
    cmd({ type: 'tabGroup:set', id: group.id, collapsed: !group.collapsed });
  };

  const handleSaveName = () => {
    setEditingName(false);
    if (nameValue.trim() && nameValue !== group.name) {
      cmd({ type: 'tabGroup:set', id: group.id, name: nameValue.trim() });
    }
  };

  const handleColorChange = (c: TabGroupColor) => {
    cmd({ type: 'tabGroup:set', id: group.id, color: c });
  };

  const handleNewTabInGroup = () => {
    setMenuOpen(false);
    void window.drift.cmd({ type: 'tab:new' }).then(() => {
      // Find new active tab and add to this group
      setTimeout(async () => {
        const state = await window.drift.getState();
        if (state.activeTabId) {
          cmd({ type: 'tabGroup:addTab', groupId: group.id, tabId: state.activeTabId });
        }
      }, 50);
    });
  };

  const handleUngroup = () => {
    setMenuOpen(false);
    cmd({ type: 'tabGroup:delete', id: group.id, closeTabs: false });
  };

  const handleCloseAllInGroup = () => {
    setMenuOpen(false);
    cmd({ type: 'tabGroup:delete', id: group.id, closeTabs: true });
  };

  return (
    <div
      className={cx(
        'tab-group-header-wrap',
        layout === 'vertical' ? 'vertical-group' : 'horizontal-group',
        group.collapsed && 'collapsed'
      )}
      style={{
        '--group-color': style.border,
        '--group-bg': style.bg,
        '--group-text': style.text,
      } as React.CSSProperties}
    >
      <button
        className="tab-group-pill"
        style={{
          borderColor: style.border,
          background: style.bg,
          color: style.text,
        }}
        onClick={toggleCollapse}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setMenuOpen(true);
        }}
        title={`קבוצת כרטיסיות: ${group.name} (${tabCount} כרטיסיות)\nלחיצה ימנית להגדרות צבע ושם`}
      >
        <span className="group-color-dot" style={{ background: style.dot }} />
        <span className="group-title-text">{group.name || 'קבוצה'}</span>
        <span className="group-count-badge">{tabCount}</span>
        <span className="group-chevron">{group.collapsed ? '◀' : '▼'}</span>
      </button>

      {/* Group Context Menu */}
      {menuOpen && (
        <div
          ref={menuRef}
          className="tab-group-menu-popover"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="group-menu-header">
            {editingName ? (
              <div className="group-name-edit-row">
                <input
                  type="text"
                  autoFocus
                  className="group-name-input"
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveName();
                    if (e.key === 'Escape') setEditingName(false);
                  }}
                  onBlur={handleSaveName}
                />
                <button className="btn small primary" onClick={handleSaveName}>
                  שמור
                </button>
              </div>
            ) : (
              <div className="group-name-display-row">
                <span className="group-menu-title">{group.name || 'קבוצה ללא שם'}</span>
                <button
                  className="btn ghost-btn small"
                  onClick={() => setEditingName(true)}
                  title="שנה שם קבוצה"
                >
                  ערוך שם
                </button>
              </div>
            )}
          </div>

          {/* Color Palette Selector */}
          <div className="group-colors-palette">
            {(Object.keys(TAB_GROUP_COLORS) as TabGroupColor[]).map((c) => {
              const pal = TAB_GROUP_COLORS[c];
              return (
                <button
                  key={c}
                  className={cx('group-color-choice', group.color === c && 'active')}
                  style={{ background: pal.dot }}
                  title={pal.name}
                  onClick={() => handleColorChange(c)}
                >
                  {group.color === c && <Icon name="check" size={10} />}
                </button>
              );
            })}
          </div>

          <div className="group-menu-actions">
            <button className="group-action-row" onClick={handleNewTabInGroup}>
              <Icon name="plus" size={14} />
              <span>כרטיסייה חדשה בקבוצה זו</span>
            </button>
            <button className="group-action-row" onClick={toggleCollapse}>
              <Icon name="split" size={14} />
              <span>{group.collapsed ? 'הרחב קבוצה (Expand)' : 'כווץ קבוצה (Collapse)'}</span>
            </button>
            <button className="group-action-row" onClick={handleUngroup}>
              <Icon name="x" size={14} />
              <span>ביטול הקבוצה (Ungroup)</span>
            </button>
            <button className="group-action-row danger" onClick={handleCloseAllInGroup}>
              <Icon name="trash" size={14} />
              <span>סגור את כל הכרטיסיות בקבוצה</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

