import { useEffect, useMemo, useState } from 'react';
import type { BrowserState, SavedSession, SavedSessionTab } from '../../shared/types';
import { cmd, cx } from '../lib';
import { Icon } from './Icon';

export function SessionsPage({ state }: { state: BrowserState }) {
  const [sessions, setSessions] = useState<SavedSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [showStashModal, setShowStashModal] = useState(false);
  const [stashName, setStashName] = useState('');
  const [closeAfterStash, setCloseAfterStash] = useState(false);
  const [stashScope, setStashScope] = useState<'current' | 'all'>('current');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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

  return (
    <div className="sessions-page" dir="rtl">
      {/* Header */}
      <header className="sessions-header">
        <div className="sessions-hero-badge">
          <Icon name="inbox" size={15} />
          <span>מנהל הסשנים והכרטיסיות השמורות · Drift Tab Stash</span>
        </div>
        <div className="sessions-title-row">
          <div>
            <h1>סשנים שמורים ושמירת כרטיסיות (Tab Stash)</h1>
            <p className="sessions-sub">
              שמור כרטיסיות פתוחות לקבוצות מסודרות, פנה 100% מזיכרון ה-RAM, ושחזר הכל בלחיצה אחת מתי שתרצה.
            </p>
          </div>
          <div className="sessions-top-actions">
            <button className="btn primary" onClick={() => handleOpenStashDialog('current')}>
              <Icon name="plus" size={15} />
              <span>שמור כרטיסיות עכשיו (Stash)</span>
            </button>
            <label className="btn ghost import-btn" title="ייבוא סשן מקובץ JSON">
              <Icon name="import" size={15} />
              <span>ייבוא סשן</span>
              <input type="file" accept=".json" onChange={handleImportJson} style={{ display: 'none' }} />
            </label>
          </div>
        </div>

        {/* Live Stash Status Bar */}
        <div className="live-stash-card">
          <div className="live-stash-info">
            <div className="stash-dot-pulse" />
            <div>
              <div className="stash-live-title">
                מרחב נוכחי פעיל: <strong>{activeSpaceName}</strong> ({currentSpaceTabs.length} כרטיסיות פתוחות)
              </div>
              <div className="stash-live-sub">
                סה״כ בכל המרחבים: {allOpenTabs.length} כרטיסיות פתוחות שניתן לאחסן ולפנות מהזיכרון.
              </div>
            </div>
          </div>
          <div className="live-stash-actions">
            <button
              className="btn small ghost"
              onClick={() => handleOpenStashDialog('current')}
              disabled={currentSpaceTabs.length === 0}
            >
              <Icon name="inbox" size={13} />
              <span>שמור מרחב זה ({currentSpaceTabs.length})</span>
            </button>
            <button
              className="btn small ghost"
              onClick={() => handleOpenStashDialog('all')}
              disabled={allOpenTabs.length === 0}
            >
              <Icon name="sparkles" size={13} />
              <span>שמור הכל ({allOpenTabs.length})</span>
            </button>
          </div>
        </div>

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
            <span>{filteredSessions.length} סשנים שמורים</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="sessions-content">
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
            {filteredSessions.map((s) => {
              const isExpanded = expandedSessionId === s.id;
              const dateFormatted = new Date(s.createdAt).toLocaleString('he-IL', {
                dateStyle: 'medium',
                timeStyle: 'short',
              });

              return (
                <div key={s.id} className={cx('session-card', isExpanded && 'expanded')}>
                  <div className="session-card-header" onClick={() => setExpandedSessionId(isExpanded ? null : s.id)}>
                    <div className="session-title-group">
                      <button className="session-expand-toggle">
                        <Icon name={isExpanded ? 'down' : 'up'} size={14} />
                      </button>
                      <div>
                        <div className="session-name-row">
                          <h3 className="session-name">{s.name}</h3>
                          {s.spaceName && <span className="session-space-badge">{s.spaceName}</span>}
                        </div>
                        <div className="session-meta">
                          <span>📅 {dateFormatted}</span>
                          <span className="meta-sep">•</span>
                          <span>📦 {s.tabs.length} כרטיסיות שמורות</span>
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
                        {s.tabs.map((tab, idx) => (
                          <div
                            key={idx}
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

      {/* Save Stash Modal */}
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
