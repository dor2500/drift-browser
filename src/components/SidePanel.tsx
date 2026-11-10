import { useEffect, useMemo, useState } from 'react';
import type { BrowserState, TabState } from '../../shared/types';
import { cmd } from '../lib';
import { Icon } from './Icon';

export interface ReadingListItem {
  id: string;
  url: string;
  title: string;
  favicon?: string;
  domain: string;
  addedAt: number;
  read: boolean;
}

export function SidePanel({
  activeTab,
  state: _state,
  onClose,
}: {
  activeTab?: TabState;
  state: BrowserState;
  onClose: () => void;
}) {
  const [activeTabSection, setActiveTabSection] = useState<'readingList' | 'bookmarks' | 'search' | 'notes'>('readingList');
  const [readingList, setReadingList] = useState<ReadingListItem[]>(() => {
    try {
      const saved = localStorage.getItem('drift_reading_list');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Bookmarks state
  const [bookmarks, setBookmarks] = useState<{ url: string; title: string }[]>([]);
  const [bookmarkSearch, setBookmarkSearch] = useState('');

  // Search state
  const [sideSearchQuery, setSideSearchQuery] = useState('');

  // Notes state
  const currentDomain = useMemo(() => {
    if (!activeTab?.url) return 'global';
    try {
      return new URL(activeTab.url).hostname.replace(/^www\./, '');
    } catch {
      return 'global';
    }
  }, [activeTab?.url]);

  const [notes, setNotes] = useState<string>(() => {
    return localStorage.getItem(`drift_notes_${currentDomain}`) || localStorage.getItem('drift_notes_global') || '';
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const saveReadingList = (items: ReadingListItem[]) => {
    setReadingList(items);
    localStorage.setItem('drift_reading_list', JSON.stringify(items));
  };

  useEffect(() => {
    void window.drift.getBookmarks().then(setBookmarks);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(`drift_notes_${currentDomain}`);
    if (saved !== null) setNotes(saved);
  }, [currentDomain]);

  const handleNotesChange = (val: string) => {
    setNotes(val);
    localStorage.setItem(`drift_notes_${currentDomain}`, val);
  };

  // Add current active tab to reading list
  const handleAddCurrentTab = () => {
    if (!activeTab || !activeTab.url || activeTab.url.startsWith('drift://')) {
      showToast('לא ניתן להוסיף דפי מערכת פנימיים לרשימת קריאה');
      return;
    }

    if (readingList.some((item) => item.url === activeTab.url)) {
      showToast('דף זה כבר קיים ברשימת הקריאה שלך');
      return;
    }

    const domain = currentDomain;
    const newItem: ReadingListItem = {
      id: String(Date.now()),
      url: activeTab.url,
      title: activeTab.title || domain,
      favicon: activeTab.favicon,
      domain,
      addedAt: Date.now(),
      read: false,
    };

    saveReadingList([newItem, ...readingList]);
    showToast('הדף נוסף בהצלחה לרשימת הקריאה!');
  };

  const handleToggleRead = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    saveReadingList(
      readingList.map((item) => (item.id === id ? { ...item, read: !item.read } : item))
    );
  };

  const handleDeleteItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    saveReadingList(readingList.filter((item) => item.id !== id));
    showToast('הדף הוסר מרשימת הקריאה');
  };

  const handleOpenItem = (url: string) => {
    cmd({ type: 'tab:navigate', input: url });
  };

  const unreadItems = useMemo(() => readingList.filter((i) => !i.read), [readingList]);
  const readItems = useMemo(() => readingList.filter((i) => i.read), [readingList]);

  const filteredBookmarks = useMemo(() => {
    const q = bookmarkSearch.trim().toLowerCase();
    if (!q) return bookmarks;
    return bookmarks.filter(
      (b) => b.title.toLowerCase().includes(q) || b.url.toLowerCase().includes(q)
    );
  }, [bookmarks, bookmarkSearch]);

  const handleSideSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sideSearchQuery.trim()) return;
    cmd({ type: 'tab:navigate', input: sideSearchQuery.trim() });
  };

  return (
    <div className="sidepanel-root">
      {/* Toast */}
      {toastMessage && (
        <div className="sidepanel-toast">
          <Icon name="check" size={14} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header with Chrome Section Selector */}
      <div className="sidepanel-header">
        <div className="sidepanel-selector-wrap">
          <select
            className="sidepanel-dropdown"
            value={activeTabSection}
            onChange={(e) => setActiveTabSection(e.target.value as any)}
          >
            <option value="readingList">📑 רשימת קריאה (Reading list)</option>
            <option value="bookmarks">🔖 סימניות מהירות (Bookmarks)</option>
            <option value="search">🔍 חיפוש צדדי מקביל (Side search)</option>
            <option value="notes">📝 פתקי דף ורשימות (Page notes)</option>
          </select>
        </div>

        <button className="btn-icon" onClick={onClose} title="סגור חלונית צד">
          <Icon name="x" size={16} />
        </button>
      </div>

      {/* BODY CONTENT */}
      <div className="sidepanel-body">
        {/* TAB 1: READING LIST */}
        {activeTabSection === 'readingList' && (
          <div className="sidepanel-reading-list">
            <button className="btn primary small btn-add-current" onClick={handleAddCurrentTab}>
              <Icon name="plus" size={14} />
              <span>הוסף כרטיסייה נוכחית (Add tab)</span>
            </button>

            {/* Unread Section */}
            <div className="rl-section">
              <div className="rl-section-header">
                <strong>טרם נקרא ({unreadItems.length})</strong>
              </div>

              {unreadItems.length === 0 ? (
                <div className="rl-empty-text">אין כרגע דפים שלא נקראו</div>
              ) : (
                <div className="rl-items-list">
                  {unreadItems.map((item) => (
                    <div
                      key={item.id}
                      className="rl-item-row"
                      onClick={() => handleOpenItem(item.url)}
                      title={item.title}
                    >
                      {item.favicon ? (
                        <img src={item.favicon} alt="" className="rl-favicon" onError={(e) => ((e.currentTarget.style.display = 'none'))} />
                      ) : (
                        <Icon name="globe" size={16} />
                      )}
                      <div className="rl-texts">
                        <strong className="rl-title">{item.title}</strong>
                        <span className="rl-domain">{item.domain}</span>
                      </div>
                      <div className="rl-actions">
                        <button
                          className="btn-icon-tiny mark-read"
                          title="סמן כנקרא"
                          onClick={(e) => handleToggleRead(item.id, e)}
                        >
                          <Icon name="check" size={13} />
                        </button>
                        <button
                          className="btn-icon-tiny delete"
                          title="הסר מרשימת הקריאה"
                          onClick={(e) => handleDeleteItem(item.id, e)}
                        >
                          <Icon name="trash" size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Read Section */}
            {readItems.length > 0 && (
              <div className="rl-section read-section">
                <div className="rl-section-header">
                  <strong>דפים שנקראו ({readItems.length})</strong>
                </div>
                <div className="rl-items-list">
                  {readItems.map((item) => (
                    <div
                      key={item.id}
                      className="rl-item-row read"
                      onClick={() => handleOpenItem(item.url)}
                      title={item.title}
                    >
                      {item.favicon ? (
                        <img src={item.favicon} alt="" className="rl-favicon" onError={(e) => ((e.currentTarget.style.display = 'none'))} />
                      ) : (
                        <Icon name="globe" size={16} />
                      )}
                      <div className="rl-texts">
                        <span className="rl-title">{item.title}</span>
                        <span className="rl-domain">{item.domain}</span>
                      </div>
                      <div className="rl-actions">
                        <button
                          className="btn-icon-tiny"
                          title="סמן כלא נקרא"
                          onClick={(e) => handleToggleRead(item.id, e)}
                        >
                          <Icon name="reload" size={12} />
                        </button>
                        <button
                          className="btn-icon-tiny delete"
                          title="הסר"
                          onClick={(e) => handleDeleteItem(item.id, e)}
                        >
                          <Icon name="trash" size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: BOOKMARKS */}
        {activeTabSection === 'bookmarks' && (
          <div className="sidepanel-bookmarks">
            <div className="sidepanel-search-box">
              <Icon name="search" size={14} />
              <input
                type="text"
                placeholder="חיפוש מהיר בסימניות..."
                value={bookmarkSearch}
                onChange={(e) => setBookmarkSearch(e.target.value)}
              />
            </div>

            <div className="bm-items-list">
              {filteredBookmarks.length === 0 ? (
                <div className="rl-empty-text">לא נמצאו סימניות תואמות</div>
              ) : (
                filteredBookmarks.map((bm, idx) => (
                  <div
                    key={idx}
                    className="bm-item-row"
                    onClick={() => handleOpenItem(bm.url)}
                    title={bm.title}
                  >
                    <Icon name="star" size={14} />
                    <div className="bm-texts">
                      <strong className="bm-title">{bm.title || bm.url}</strong>
                      <span className="bm-url">{bm.url}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 3: SIDE SEARCH */}
        {activeTabSection === 'search' && (
          <div className="sidepanel-search">
            <form onSubmit={handleSideSearchSubmit} className="sidepanel-search-form">
              <div className="sidepanel-search-box">
                <Icon name="search" size={15} />
                <input
                  type="text"
                  placeholder="חפש ב-Google או הקלד שאילתה..."
                  value={sideSearchQuery}
                  onChange={(e) => setSideSearchQuery(e.target.value)}
                  autoFocus
                />
              </div>
              <button type="submit" className="btn primary small" style={{ width: '100%' }}>
                חפש בכרטיסייה הפעילה
              </button>
            </form>

            <div className="search-quick-links">
              <span className="quick-links-title">חיפושים פופולריים:</span>
              <div className="quick-tags">
                <button className="tag-btn" onClick={() => cmd({ type: 'tab:navigate', input: 'חדשות היום ישראל' })}>
                  📰 חדשות היום
                </button>
                <button className="tag-btn" onClick={() => cmd({ type: 'tab:navigate', input: 'מזג אוויר השבוע' })}>
                  ☀️ מזג אוויר
                </button>
                <button className="tag-btn" onClick={() => cmd({ type: 'tab:navigate', input: 'GitHub trending repositories' })}>
                  💻 GitHub Trends
                </button>
                <button className="tag-btn" onClick={() => cmd({ type: 'tab:navigate', input: 'YouTube Music' })}>
                  🎵 YouTube Music
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: PAGE NOTES */}
        {activeTabSection === 'notes' && (
          <div className="sidepanel-notes">
            <div className="notes-meta-bar">
              <span className="notes-domain-badge">
                <Icon name="link" size={12} />
                <span>דומיין: {currentDomain}</span>
              </span>
              <button
                className="btn ghost small"
                onClick={() => {
                  navigator.clipboard.writeText(notes);
                  showToast('הפתק הועתק ללוח!');
                }}
              >
                <Icon name="copy" size={12} />
                <span>העתק</span>
              </button>
            </div>

            <textarea
              className="sidepanel-textarea"
              placeholder="כתוב פתקים, רשימות וקישורים השמורים ספציפית עבור אתר זה..."
              value={notes}
              onChange={(e) => handleNotesChange(e.target.value)}
              rows={12}
            />

            <div className="notes-footer">
              <span>{notes.length} תווים</span>
              <span>נשמר אוטומטית מקומית</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
