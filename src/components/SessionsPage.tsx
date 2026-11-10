import { useEffect, useMemo, useState } from 'react';
import type { BrowserState, SavedSession, SavedSessionTab, TabGroup, TabGroupColor } from '../../shared/types';
import { TAB_GROUP_COLORS } from './TabGroupHeader';
import { cmd, cx } from '../lib';
import { Icon } from './Icon';

type ViewMode = 'sessions' | 'groups' | 'bulk-import';

export function SessionsPage({ state }: { state: BrowserState }) {
  const [sessions, setSessions] = useState<SavedSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<ViewMode>('sessions');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [showStashModal, setShowStashModal] = useState(false);
  const [stashName, setStashName] = useState('');
  const [closeAfterStash, setCloseAfterStash] = useState(false);
  const [stashScope, setStashScope] = useState<'current' | 'all'>('current');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New Group modal state
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupColor, setNewGroupColor] = useState<TabGroupColor>('blue');
  const [selectedTabIdsForGroup, setSelectedTabIdsForGroup] = useState<string[]>([]);

  // Bulk URL import state
  const [bulkText, setBulkText] = useState('');
  const [bulkSessionName, setBulkSessionName] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const loadSessions = async () => {
    try {
      if (window.drift?.getSavedSessions) {
        const list = await window.drift.getSavedSessions();
        setSessions(list || []);
      }
    } catch (e) {
      console.error('Failed to load saved sessions', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const activeSpace = state.spaces.find((s) => s.id === state.activeSpaceId);
  const activeSpaceName = activeSpace?.name || 'מרחב ראשי';

  // Tabs eligible for stashing (excluding internal and glances)
  const currentSpaceTabs = useMemo(() => {
    return state.tabs.filter(
      (t) => !t.glanceOf && !t.essential && !t.url.startsWith('drift://') && t.spaceId === state.activeSpaceId
    );
  }, [state.tabs, state.activeSpaceId]);

  const allOpenTabs = useMemo(() => {
    return state.tabs.filter(
      (t) => !t.glanceOf && !t.essential && !t.url.startsWith('drift://')
    );
  }, [state.tabs]);

  const tabsToStash = stashScope === 'current' ? currentSpaceTabs : allOpenTabs;

  // Stash metrics
  const totalStashedTabs = useMemo(() => {
    return sessions.reduce((acc, s) => acc + (s.tabs?.length || 0), 0);
  }, [sessions]);

  const estimatedRamSavedMb = totalStashedTabs * 125;
  const ramDisplay = estimatedRamSavedMb >= 1024
    ? `${(estimatedRamSavedMb / 1024).toFixed(1)} GB`
    : `${estimatedRamSavedMb} MB`;

  const handleOpenStashDialog = (scope: 'current' | 'all') => {
    setStashScope(scope);
    const dateStr = new Date().toLocaleDateString('he-IL', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const defaultName = scope === 'current' ? `סשן ${activeSpaceName} · ${dateStr}` : `כל הכרטיסיות · ${dateStr}`;
    setStashName(defaultName);
    setCloseAfterStash(false);
    setShowStashModal(true);
  };

  const handleExecuteStash = async () => {
    if (tabsToStash.length === 0) {
      showToast('אין כרטיסיות פתוחות לשמירה');
      setShowStashModal(false);
      return;
    }

    const payload: SavedSessionTab[] = tabsToStash.map((t) => ({
      url: t.url,
      title: t.title || t.url,
      favicon: t.favicon,
      pinned: t.pinned,
    }));

    try {
      if (window.drift?.saveSessionSnapshot) {
        const newSession = await window.drift.saveSessionSnapshot(
          stashName,
          payload,
          stashScope === 'current' ? activeSpaceName : 'כל המרחבים'
        );
        setSessions((prev) => [newSession, ...prev]);
        setExpandedSessionId(newSession.id);
      }

      if (closeAfterStash) {
        for (const t of tabsToStash) {
          cmd({ type: 'tab:close', id: t.id });
        }
        showToast(`נשמרו ${payload.length} כרטיסיות והסשן נסגר בהצלחה! הזיכרון פונה.`);
      } else {
        showToast(`נשמר סשן חדש עם ${payload.length} כרטיסיות!`);
      }
    } catch (e) {
      console.error(e);
      showToast('שגיאה בשמירת הסשן');
    }

    setShowStashModal(false);
  };

  // Stash an entire Tab Group
  const handleStashTabGroup = async (group: TabGroup, groupTabs: typeof state.tabs) => {
    if (groupTabs.length === 0) {
      showToast('אין כרטיסיות בקבוצה זו לאחסון');
      return;
    }

    const dateStr = new Date().toLocaleDateString('he-IL', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const name = `קבוצה: ${group.name} · ${dateStr}`;
    const payload: SavedSessionTab[] = groupTabs.map((t) => ({
      url: t.url,
      title: t.title || t.url,
      favicon: t.favicon,
      pinned: t.pinned,
    }));

    try {
      if (window.drift?.saveSessionSnapshot) {
        const newSession = await window.drift.saveSessionSnapshot(name, payload, `קבוצת ${group.name}`);
        setSessions((prev) => [newSession, ...prev]);
        setExpandedSessionId(newSession.id);
      }

      // Close the tabs in the group to liberate RAM
      for (const t of groupTabs) {
        cmd({ type: 'tab:close', id: t.id });
      }
      // Delete the empty group
      cmd({ type: 'tabGroup:delete', id: group.id, closeTabs: false });

      showToast(`קבוצת "${group.name}" נשמרה ב-Stash (${payload.length} כרטיסיות) ופונתה מה-RAM!`);
      setActiveView('sessions');
    } catch (e) {
      console.error(e);
      showToast('שגיאה באחסון הקבוצה');
    }
  };

  const handleRestoreSession = async (id: string, newSpace: boolean = false) => {
    try {
      if (window.drift?.restoreSavedSession) {
        await window.drift.restoreSavedSession(id, newSpace);
        showToast(newSpace ? 'הסשן שוחזר בהצלחה במרחב עבודה חדש!' : 'כל כרטיסיות הסשן שוחזרו בהצלחה!');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteSession = async (id: string) => {
    try {
      if (window.drift?.deleteSavedSession) {
        await window.drift.deleteSavedSession(id);
        setSessions((prev) => prev.filter((s) => s.id !== id));
        showToast('הסשן נמחק');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleExportMarkdown = (session: SavedSession) => {
    const md = `# ${session.name}\nנוצר בתאריך: ${new Date(session.createdAt).toLocaleString('he-IL')}\n\n` +
      session.tabs.map((t) => `- [${t.title || t.url}](${t.url})`).join('\n');
    navigator.clipboard.writeText(md);
    showToast('רשימת הקישורים בפורמט Markdown הועתקה ללוח!');
  };

  const handleExportJson = (session: SavedSession) => {
    const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `drift-session-${session.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('קובץ הגיבוי יוצא בהצלחה!');
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (parsed.tabs && Array.isArray(parsed.tabs)) {
          if (window.drift?.saveSessionSnapshot) {
            const imported = await window.drift.saveSessionSnapshot(
              parsed.name || `סשן מיובא · ${file.name}`,
              parsed.tabs,
              parsed.spaceName || 'מיובא'
            );
            setSessions((prev) => [imported, ...prev]);
            showToast('הסשן יובא בהצלחה!');
          }
        } else {
          showToast('מבנה קובץ JSON אינו תקין');
        }
      } catch {
        showToast('שגיאה בקריאת קובץ ה-JSON');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Bulk extract links from raw text
  const extractedUrls = useMemo(() => {
    if (!bulkText.trim()) return [];
    const urlRegex = /https?:\/\/[^\s)"]+/gi;
    const matches = bulkText.match(urlRegex) || [];
    // Deduplicate
    return Array.from(new Set(matches)).map((url) => {
      let title = url;
      try {
        title = new URL(url).hostname;
      } catch {
        // ignore
      }
      return { url, title };
    });
  }, [bulkText]);

  const handleSaveBulkSession = async () => {
    if (extractedUrls.length === 0) {
      showToast('לא נמצאו קישורים תקניים בטקסט');
      return;
    }
    const name = bulkSessionName.trim() || `ייבוא קישורים מהיר · ${new Date().toLocaleDateString('he-IL')}`;
    const payload: SavedSessionTab[] = extractedUrls.map((item) => ({
      url: item.url,
      title: item.title,
    }));

    try {
      if (window.drift?.saveSessionSnapshot) {
        const newSession = await window.drift.saveSessionSnapshot(name, payload, 'ייבוא טקסט');
        setSessions((prev) => [newSession, ...prev]);
        setExpandedSessionId(newSession.id);
        setBulkText('');
        setBulkSessionName('');
        setActiveView('sessions');
        showToast(`נוצר סשן חדש עם ${payload.length} קישורים!`);
      }
    } catch (e) {
      console.error(e);
      showToast('שגיאה בשמירת הסשן');
    }
  };

  // Filtered sessions
  const filteredSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.spaceName && s.spaceName.toLowerCase().includes(q)) ||
        s.tabs.some((t) => t.title.toLowerCase().includes(q) || t.url.toLowerCase().includes(q))
    );
  }, [sessions, searchQuery]);

  // Tab Groups logic
  const tabGroups = state.tabGroups || [];
  const tabsByGroup = useMemo(() => {
    const map = new Map<string, typeof state.tabs>();
    for (const group of tabGroups) {
      map.set(group.id, state.tabs.filter((t) => t.groupId === group.id && !t.glanceOf));
    }
    return map;
  }, [tabGroups, state.tabs]);

  const ungroupedTabs = useMemo(() => {
    return state.tabs.filter(
      (t) => !t.groupId && !t.glanceOf && !t.essential && !t.url.startsWith('drift://')
    );
  }, [state.tabs]);

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) {
      showToast('יש להזין שם לקבוצה');
      return;
    }
    cmd({
      type: 'tabGroup:create',
      name: newGroupName.trim(),
      color: newGroupColor,
      tabIds: selectedTabIdsForGroup,
    });
    showToast(`קבוצת "${newGroupName}" נוצרה בהצלחה!`);
    setShowNewGroupModal(false);
    setNewGroupName('');
    setSelectedTabIdsForGroup([]);
  };

  return (
    <div className="sessions-page" dir="rtl">
      {/* Header */}
      <header className="sessions-header">
        <div className="sessions-hero-badge">
          <Icon name="inbox" size={15} />
          <span>מנהל הסשנים, קבוצות הכרטיסיות ו-Tab Stash · Drift Sessions Pro</span>
        </div>
        <div className="sessions-title-row">
          <div>
            <h1>סשנים שמורים, מרחבים וקבוצות כרטיסיות</h1>
            <p className="sessions-sub">
              ארגן כרטיסיות בקבוצות צבעוניות, אחסן סשנים לפריקת 100% מזיכרון ה-RAM, ושחזר הכל בטאב בודד או במרחב עבודה שלם.
            </p>
          </div>
          <div className="sessions-top-actions">
            <button className="btn primary" onClick={() => handleOpenStashDialog('current')}>
              <Icon name="plus" size={15} />
              <span>שמור כרטיסיות (Stash)</span>
            </button>
            <label className="btn ghost import-btn" title="ייבוא סשן מקובץ JSON">
              <Icon name="import" size={15} />
              <span>ייבוא JSON</span>
              <input type="file" accept=".json" onChange={handleImportJson} style={{ display: 'none' }} />
            </label>
          </div>
        </div>

        {/* Live Stash & Efficiency HUD */}
        <div className="stash-hud-grid">
          <div className="stash-hud-stat">
            <div className="hud-stat-icon">📦</div>
            <div className="hud-stat-info">
              <span className="hud-stat-value">{sessions.length}</span>
              <span className="hud-stat-label">סשנים שמורים ב-Stash</span>
            </div>
          </div>

          <div className="stash-hud-stat">
            <div className="hud-stat-icon">📑</div>
            <div className="hud-stat-info">
              <span className="hud-stat-value">{totalStashedTabs}</span>
              <span className="hud-stat-label">כרטיסיות שמורות במאגר</span>
            </div>
          </div>

          <div className="stash-hud-stat highlight">
            <div className="hud-stat-icon">⚡</div>
            <div className="hud-stat-info">
              <span className="hud-stat-value">{ramDisplay}</span>
              <span className="hud-stat-label">RAM שנחסך בפועל</span>
            </div>
          </div>

          <div className="stash-hud-stat">
            <div className="hud-stat-icon">🌐</div>
            <div className="hud-stat-info">
              <span className="hud-stat-value">{allOpenTabs.length}</span>
              <span className="hud-stat-label">כרטיסיות פתוחות כעת</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="sessions-view-nav">
          <button
            className={cx('nav-pill-btn', activeView === 'sessions' && 'active')}
            onClick={() => setActiveView('sessions')}
          >
            <Icon name="inbox" size={14} />
            <span>סשנים שמורים ב-Stash ({sessions.length})</span>
          </button>
          <button
            className={cx('nav-pill-btn', activeView === 'groups' && 'active')}
            onClick={() => setActiveView('groups')}
          >
            <Icon name="tab" size={14} />
            <span>מרחבים וקבוצות כרטיסיות ({tabGroups.length})</span>
          </button>
          <button
            className={cx('nav-pill-btn', activeView === 'bulk-import' && 'active')}
            onClick={() => setActiveView('bulk-import')}
          >
            <Icon name="link" size={14} />
            <span>ייבוא מהיר מרשימת קישורים</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="sessions-content">
        {/* VIEW 1: Saved Sessions */}
        {activeView === 'sessions' && (
          <div className="view-sessions-section">
            {/* Search Bar */}
            <div className="sessions-search-bar">
              <div className="sessions-search-wrap">
                <Icon name="search" size={17} />
                <input
                  type="text"
                  placeholder="חיפוש בסשנים שמורים לפי שם, אתר או כותרת כרטיסייה..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="sessions-search-input"
                />
                {searchQuery && (
                  <button className="clear-search-btn" onClick={() => setSearchQuery('')}>
                    <Icon name="x" size={13} />
                  </button>
                )}
              </div>
              <div className="sessions-count-pill">
                <span>{filteredSessions.length} סשנים</span>
              </div>
            </div>

            {loading ? (
              <div className="sessions-loading">
                <Icon name="reload" size={24} />
                <span>טוען סשנים שמורים...</span>
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="sessions-empty">
                <div className="empty-icon-wrap">
                  <Icon name="inbox" size={42} />
                </div>
                <h3>{searchQuery ? 'לא נמצאו סשנים התואמים את החיפוש' : 'אין עדיין סשנים שמורים'}</h3>
                <p>
                  {searchQuery
                    ? 'נסה לחפש שם אחר או נקה את שורת החיפוש.'
                    : 'באמצעות Tab Stash תוכל לשמור את כל הכרטיסיות הפתוחות שלך בבת-אחת, לפנות זיכרון RAM מלא, ולחזור אליהן בכל עת בלחיצת כפתור אחת.'}
                </p>
                {!searchQuery && currentSpaceTabs.length > 0 && (
                  <button className="btn primary" onClick={() => handleOpenStashDialog('current')}>
                    <Icon name="plus" size={15} />
                    <span>שמור {currentSpaceTabs.length} כרטיסיות פתוחות כעת</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="sessions-list">
                {filteredSessions.map((s, idx) => {
                  const isExpanded = expandedSessionId === s.id;
                  const isLatest = idx === 0;
                  const dateFormatted = new Date(s.createdAt).toLocaleString('he-IL', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  });

                  return (
                    <div key={s.id} className={cx('session-card', isExpanded && 'expanded', isLatest && 'latest-card')}>
                      <div className="session-card-header" onClick={() => setExpandedSessionId(isExpanded ? null : s.id)}>
                        <div className="session-title-group">
                          <button className="session-expand-toggle">
                            <Icon name={isExpanded ? 'down' : 'up'} size={14} />
                          </button>
                          <div>
                            <div className="session-name-row">
                              <h3 className="session-name">{s.name}</h3>
                              {isLatest && <span className="latest-backup-pill">⚡ גיבוי אחרון</span>}
                              {s.spaceName && <span className="session-space-badge">{s.spaceName}</span>}
                            </div>
                            <div className="session-meta">
                              <span>📅 {dateFormatted}</span>
                              <span className="meta-sep">•</span>
                              <span>📦 {s.tabs.length} כרטיסיות שמורות</span>
                              <span className="meta-sep">•</span>
                              <span className="saved-ram-chip">~{(s.tabs.length * 125).toFixed(0)} MB נחסכו</span>
                            </div>
                          </div>
                        </div>

                        <div className="session-card-actions" onClick={(e) => e.stopPropagation()}>
                          <button
                            className="btn small primary"
                            onClick={() => handleRestoreSession(s.id, false)}
                            title="שחזר את כל הכרטיסיות במרחב הנוכחי"
                          >
                            <Icon name="play" size={13} />
                            <span>שחזר הכל</span>
                          </button>
                          <button
                            className="btn small ghost"
                            onClick={() => handleRestoreSession(s.id, true)}
                            title="שחזר במרחב עבודה חדש לגמרי"
                          >
                            <Icon name="plus" size={13} />
                            <span>מרחב חדש</span>
                          </button>
                          <button
                            className="btn-icon-subtle"
                            title="העתק רשימת קישורים ל-Markdown"
                            onClick={() => handleExportMarkdown(s)}
                          >
                            <Icon name="copy" size={14} />
                          </button>
                          <button
                            className="btn-icon-subtle"
                            title="הורד קובץ גיבוי JSON"
                            onClick={() => handleExportJson(s)}
                          >
                            <Icon name="download" size={14} />
                          </button>
                          <button
                            className="btn-icon-subtle delete"
                            title="מחק סשן שמור זה"
                            onClick={() => handleDeleteSession(s.id)}
                          >
                            <Icon name="trash" size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Expanded Tabs List */}
                      {isExpanded && (
                        <div className="session-tabs-tray">
                          <div className="tabs-tray-header">
                            <span>כרטיסיות בסשן זה ({s.tabs.length}):</span>
                            <span className="tray-hint">לחץ על כרטיסייה לפתיחה מיידית בטאב חדש</span>
                          </div>
                          <div className="session-tabs-grid">
                            {s.tabs.map((tab, tIdx) => (
                              <div
                                key={tIdx}
                                className="tray-tab-item"
                                onClick={() => cmd({ type: 'tab:new', url: tab.url })}
                                title={`פתח ${tab.url}`}
                              >
                                <div className="tray-tab-fav">
                                  <Icon name="globe" size={14} />
                                </div>
                                <div className="tray-tab-details">
                                  <span className="tray-tab-title">{tab.title || tab.url}</span>
                                  <span className="tray-tab-url">{tab.url}</span>
                                </div>
                                <span className="tray-tab-arrow">↗</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: Chrome Tab Groups & Spaces Matrix */}
        {activeView === 'groups' && (
          <div className="view-groups-section">
            <div className="groups-top-bar">
              <div className="groups-top-info">
                <h2>קבוצות כרטיסיות פעילות (Chrome Tab Groups)</h2>
                <p>קבץ כרטיסיות לפי נושא, צבע או פרויקט, ופנה זיכרון בלחיצה אחת על ידי אחסון הקבוצה.</p>
              </div>
              <button
                className="btn primary"
                onClick={() => {
                  setNewGroupName('');
                  setNewGroupColor('blue');
                  setSelectedTabIdsForGroup([]);
                  setShowNewGroupModal(true);
                }}
              >
                <Icon name="plus" size={14} />
                <span>צור קבוצת כרטיסיות חדשה</span>
              </button>
            </div>

            {/* Tab Groups List */}
            <div className="tab-groups-matrix">
              {tabGroups.length === 0 ? (
                <div className="groups-empty-card">
                  <div className="empty-icon-wrap">
                    <Icon name="tab" size={36} />
                  </div>
                  <h3>אין עדיין קבוצות כרטיסיות פתוחות</h3>
                  <p>צור קבוצה כדי לארגן כרטיסיות מחקר, עבודה או קניות בצבעים מסודרים ולפנות זיכרון במהירות.</p>
                  <button
                    className="btn primary"
                    onClick={() => {
                      setNewGroupName('קבוצה ראשונה');
                      setShowNewGroupModal(true);
                    }}
                  >
                    <Icon name="plus" size={14} />
                    <span>צור קבוצה עכשיו</span>
                  </button>
                </div>
              ) : (
                tabGroups.map((group) => {
                  const groupTabs = tabsByGroup.get(group.id) || [];
                  const colorDef = TAB_GROUP_COLORS[group.color] || TAB_GROUP_COLORS.blue;

                  return (
                    <div
                      key={group.id}
                      className="tab-group-card"
                      style={{ borderTop: `3px solid ${colorDef.border}` }}
                    >
                      <div className="group-card-header">
                        <div className="group-card-title-wrap">
                          <span className="group-color-dot" style={{ background: colorDef.dot }} />
                          <h3 className="group-card-name" style={{ color: colorDef.text }}>
                            {group.name}
                          </h3>
                          <span className="group-tab-counter">{groupTabs.length} כרטיסיות</span>
                        </div>

                        <div className="group-card-actions">
                          <button
                            className="btn small primary"
                            onClick={() => handleStashTabGroup(group, groupTabs)}
                            title="שמור את כל כרטיסיות הקבוצה ב-Stash וסגור אותן לפינוי RAM"
                          >
                            <Icon name="inbox" size={13} />
                            <span>אחסן קבוצה (Stash)</span>
                          </button>
                          <button
                            className="btn small ghost"
                            onClick={() => cmd({ type: 'tabGroup:set', id: group.id, collapsed: !group.collapsed })}
                          >
                            <Icon name={group.collapsed ? 'up' : 'down'} size={13} />
                            <span>{group.collapsed ? 'הרחב' : 'כווץ'}</span>
                          </button>
                          <button
                            className="btn-icon-subtle delete"
                            title="פזר קבוצה (השאר כרטיסיות פתוחות)"
                            onClick={() => cmd({ type: 'tabGroup:delete', id: group.id, closeTabs: false })}
                          >
                            <Icon name="trash" size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Group Tabs */}
                      <div className="group-tabs-list">
                        {groupTabs.length === 0 ? (
                          <div className="group-no-tabs">קבוצה זו ריקה. גרור אליה כרטיסיות או הוסף מהרשימה למטה.</div>
                        ) : (
                          groupTabs.map((t) => (
                            <div key={t.id} className="group-tab-row">
                              <div className="group-tab-main" onClick={() => cmd({ type: 'tab:activate', id: t.id })}>
                                <span className="tab-bullet">●</span>
                                <span className="tab-title-text">{t.title || t.url}</span>
                                <span className="tab-url-text">{t.url}</span>
                              </div>
                              <div className="group-tab-actions">
                                <button
                                  className="btn-icon-mini"
                                  title="הוצא מקבוצה"
                                  onClick={() => cmd({ type: 'tabGroup:removeTab', tabId: t.id })}
                                >
                                  <Icon name="x" size={12} />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Ungrouped Tabs Helper */}
            {ungroupedTabs.length > 0 && (
              <div className="ungrouped-tabs-section">
                <div className="ungrouped-header">
                  <h3>כרטיסיות פתוחות ללא קבוצה ({ungroupedTabs.length})</h3>
                  <span className="ungrouped-sub">ניתן להוסיף כרטיסיות אלו ישירות לקבוצה קיימת או ליצור קבוצה חדשה</span>
                </div>
                <div className="ungrouped-grid">
                  {ungroupedTabs.map((t) => (
                    <div key={t.id} className="ungrouped-tab-item">
                      <div className="ungrouped-item-info">
                        <Icon name="globe" size={13} />
                        <span className="ungrouped-item-title">{t.title || t.url}</span>
                      </div>
                      <div className="ungrouped-dropdown-wrap">
                        {tabGroups.length > 0 ? (
                          <select
                            className="field-input group-select-mini"
                            defaultValue=""
                            onChange={(e) => {
                              if (e.target.value) {
                                cmd({ type: 'tabGroup:addTab', groupId: e.target.value, tabId: t.id });
                                showToast(`הכרטיסייה נוספה לקבוצה!`);
                              }
                            }}
                          >
                            <option value="" disabled>+ הוסף לקבוצה...</option>
                            {tabGroups.map((g) => (
                              <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                          </select>
                        ) : (
                          <button
                            className="btn small ghost"
                            onClick={() => {
                              setSelectedTabIdsForGroup([t.id]);
                              setNewGroupName(t.title?.slice(0, 16) || 'קבוצה חדשה');
                              setShowNewGroupModal(true);
                            }}
                          >
                            + קבץ כרטיסייה
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW 3: Bulk URL Importer */}
        {activeView === 'bulk-import' && (
          <div className="view-bulk-section">
            <div className="bulk-card">
              <div className="bulk-header">
                <h2>📋 ייבוא מהיר מרשימת קישורים (Bulk URL Importer)</h2>
                <p>
                  הדבק כאן כל טקסט המכיל קישורים (רשימת לינקים, פסקת טקסט, הודעת צ'אט, או קובץ Markdown). המערכת תזהה את
                  הכתובות באופן אוטומטי ותיצור סשן חדש בלחיצה אחת.
                </p>
              </div>

              <div className="bulk-fields">
                <div className="field-group">
                  <label className="field-label">שם הסשן לשמירה:</label>
                  <input
                    type="text"
                    className="field-input"
                    placeholder="לדוגמה: מקורות למחקר, מאמרי סוף שבוע..."
                    value={bulkSessionName}
                    onChange={(e) => setBulkSessionName(e.target.value)}
                  />
                </div>

                <div className="field-group">
                  <label className="field-label">הדבק טקסט או קישורים:</label>
                  <textarea
                    className="bulk-textarea"
                    rows={8}
                    placeholder={`https://github.com\nhttps://news.ycombinator.com\n[Google](https://google.com)\nאו סתם טקסט חופשי עם לינקים...`}
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                  />
                </div>
              </div>

              {/* Extraction Preview */}
              <div className="bulk-preview-wrap">
                <div className="bulk-preview-header">
                  <span>זוהו {extractedUrls.length} כתובות ייחודיות בטקסט:</span>
                </div>
                {extractedUrls.length > 0 ? (
                  <div className="bulk-links-list">
                    {extractedUrls.map((item, i) => (
                      <div key={i} className="bulk-link-chip">
                        <Icon name="link" size={12} />
                        <span className="link-text">{item.url}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bulk-empty-hint">הדבק טקסט עם קישורים למעלה כדי לראות תצוגה מקדימה</div>
                )}
              </div>

              <div className="bulk-actions">
                <button
                  className="btn primary"
                  disabled={extractedUrls.length === 0}
                  onClick={handleSaveBulkSession}
                >
                  <Icon name="plus" size={15} />
                  <span>שמור כסשן חדש ({extractedUrls.length} כרטיסיות)</span>
                </button>
                <button
                  className="btn ghost"
                  onClick={() => {
                    setBulkText('');
                    setBulkSessionName('');
                  }}
                >
                  נקה
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Save Stash Modal Dialog */}
      {showStashModal && (
        <div className="sessions-modal-backdrop" onClick={() => setShowStashModal(false)}>
          <div className="sessions-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>שמירת סשן כרטיסיות חדש (Tab Stash)</h3>
              <button className="modal-close-btn" onClick={() => setShowStashModal(false)}>
                <Icon name="x" size={15} />
              </button>
            </div>
            <div className="modal-body">
              <div className="field-group">
                <label className="field-label">שם הסשן:</label>
                <input
                  type="text"
                  value={stashName}
                  onChange={(e) => setStashName(e.target.value)}
                  className="field-input"
                  autoFocus
                />
              </div>

              <div className="field-group">
                <label className="field-label">טווח שמירה:</label>
                <div className="scope-radios">
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="scope"
                      checked={stashScope === 'current'}
                      onChange={() => setStashScope('current')}
                    />
                    <span>מרחב נוכחי ({activeSpaceName} · {currentSpaceTabs.length} כרטיסיות)</span>
                  </label>
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="scope"
                      checked={stashScope === 'all'}
                      onChange={() => setStashScope('all')}
                    />
                    <span>כל המרחבים ({allOpenTabs.length} כרטיסיות פתוחות)</span>
                  </label>
                </div>
              </div>

              <div className="stash-option-box">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={closeAfterStash}
                    onChange={(e) => setCloseAfterStash(e.target.checked)}
                  />
                  <div>
                    <strong>סגור כרטיסיות אלו לאחר השמירה (פנה 100% מזיכרון ה-RAM)</strong>
                    <div className="checkbox-sub">הכרטיסיות יישמרו בסשן בצורה בטוחה ותוכל לשחזרן בכל עת.</div>
                  </div>
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn primary" onClick={handleExecuteStash} disabled={tabsToStash.length === 0}>
                שמור {tabsToStash.length} כרטיסיות
              </button>
              <button className="btn ghost" onClick={() => setShowStashModal(false)}>
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create New Group Modal Dialog */}
      {showNewGroupModal && (
        <div className="sessions-modal-backdrop" onClick={() => setShowNewGroupModal(false)}>
          <div className="sessions-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>יצירת קבוצת כרטיסיות חדשה</h3>
              <button className="modal-close-btn" onClick={() => setShowNewGroupModal(false)}>
                <Icon name="x" size={15} />
              </button>
            </div>
            <div className="modal-body">
              <div className="field-group">
                <label className="field-label">שם הקבוצה:</label>
                <input
                  type="text"
                  placeholder="לדוגמה: מחקר, פרודוקטיביות, קניות..."
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="field-input"
                  autoFocus
                />
              </div>

              <div className="field-group">
                <label className="field-label">בחר צבע לקבוצה:</label>
                <div className="group-color-picker-row">
                  {(Object.keys(TAB_GROUP_COLORS) as TabGroupColor[]).map((c) => {
                    const def = TAB_GROUP_COLORS[c];
                    const isSelected = newGroupColor === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        className={cx('color-swatch-btn', isSelected && 'active')}
                        style={{ background: def.dot, outlineColor: def.border }}
                        onClick={() => setNewGroupColor(c)}
                        title={def.name}
                      />
                    );
                  })}
                </div>
              </div>

              {ungroupedTabs.length > 0 && (
                <div className="field-group">
                  <label className="field-label">בחר כרטיסיות לשיוך ראשוני:</label>
                  <div className="tab-picker-list">
                    {ungroupedTabs.map((t) => {
                      const isChecked = selectedTabIdsForGroup.includes(t.id);
                      return (
                        <label key={t.id} className="tab-picker-item">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedTabIdsForGroup((prev) => [...prev, t.id]);
                              } else {
                                setSelectedTabIdsForGroup((prev) => prev.filter((id) => id !== t.id));
                              }
                            }}
                          />
                          <span className="picker-title">{t.title || t.url}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn primary" onClick={handleCreateGroup}>
                צור קבוצה
              </button>
              <button className="btn ghost" onClick={() => setShowNewGroupModal(false)}>
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="store-toast">
          <Icon name="check" size={15} />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
