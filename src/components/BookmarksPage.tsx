import { useEffect, useMemo, useState } from 'react';
import type { BrowserState } from '../../shared/types';
import { cmd } from '../lib';
import { Icon } from './Icon';

interface BookmarkItem {
  id?: string;
  url: string;
  title: string;
  addedAt?: number;
}

export function BookmarksPage({ state }: { state: BrowserState }) {
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const loadBookmarks = async () => {
    try {
      if (window.drift?.getBookmarks) {
        const res = await window.drift.getBookmarks();
        setBookmarks(res || []);
      } else {
        // Fallback to searching bookmarks
        const results = await window.drift.suggest('');
        const bms = results.filter((r) => r.kind === 'bookmark').map((r) => ({
          url: r.url,
          title: r.title,
        }));
        setBookmarks(bms);
      }
    } catch (e) {
      console.error('Failed to load bookmarks', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookmarks();
  }, []);

  const filteredBookmarks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return bookmarks;
    return bookmarks.filter(
      (b) => b.title.toLowerCase().includes(q) || b.url.toLowerCase().includes(q)
    );
  }, [bookmarks, searchQuery]);

  const handleOpenBookmark = (url: string, newTab: boolean = false) => {
    if (newTab) {
      cmd({ type: 'tab:new', url });
    } else {
      cmd({ type: 'tab:navigate', input: url });
    }
  };

  const handleAddBookmark = () => {
    let cleanUrl = newUrl.trim();
    if (!cleanUrl) return;
    if (!/^https?:\/\//i.test(cleanUrl)) {
      cleanUrl = 'https://' + cleanUrl;
    }
    const cleanTitle = newTitle.trim() || cleanUrl;

    cmd({
      type: 'bookmark:toggle',
      url: cleanUrl,
      title: cleanTitle,
    });

    setBookmarks((prev) => [{ url: cleanUrl, title: cleanTitle, addedAt: Date.now() }, ...prev]);
    setShowAddModal(false);
    setNewTitle('');
    setNewUrl('');
    showToast('הסימנייה נוספה בהצלחה!');
  };

  const handleDeleteBookmark = (url: string) => {
    cmd({ type: 'bookmark:toggle', url, title: '' });
    setBookmarks((prev) => prev.filter((b) => b.url !== url));
    showToast('הסימנייה נמחקה');
  };

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    showToast('הקישור הועתק ללוח!');
  };

  const handleExportHtml = () => {
    if (bookmarks.length === 0) {
      showToast('אין סימניות לייצוא');
      return;
    }
    const htmlHeader = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3 ADD_DATE="${Math.floor(Date.now() / 1000)}" LAST_MODIFIED="${Math.floor(Date.now() / 1000)}">Drift Bookmarks</H3>
    <DL><p>
`;
    const htmlItems = bookmarks
      .map(
        (b) =>
          `        <DT><A HREF="${b.url}" ADD_DATE="${Math.floor(
            (b.addedAt || Date.now()) / 1000
          )}">${b.title || b.url}</A>`
      )
      .join('\n');
    const htmlFooter = `\n    </DL><p>\n</DL><p>`;

    const blob = new Blob([htmlHeader + htmlItems + htmlFooter], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `drift-bookmarks-${new Date().toISOString().slice(0, 10)}.html`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('קובץ הסימניות יוצא בהצלחה!');
  };

  const handleImportHtml = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const text = ev.target?.result as string;
        const linkRegex = /<A\s+[^>]*HREF=["']([^"']+)["'][^>]*>([^<]*)<\/A>/gi;
        let match;
        const newBms: BookmarkItem[] = [];
        while ((match = linkRegex.exec(text)) !== null) {
          const url = match[1];
          const title = match[2]?.trim() || url;
          if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
            newBms.push({ url, title, addedAt: Date.now() });
            cmd({ type: 'bookmark:toggle', url, title });
          }
        }
        if (newBms.length > 0) {
          setBookmarks((prev) => [...newBms, ...prev]);
          showToast(`יובאו בהצלחה ${newBms.length} סימניות מקובץ ה-HTML!`);
        } else {
          showToast('לא נמצאו סימניות תקינות בקובץ ה-HTML');
        }
      } catch {
        showToast('שגיאה בקריאת קובץ ה-HTML');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const getDomain = (rawUrl: string) => {
    try {
      return new URL(rawUrl).hostname;
    } catch {
      return rawUrl;
    }
  };

  return (
    <div className="bookmarks-page" dir="rtl">
      {/* Header */}
      <header className="bookmarks-header">
        <div className="bookmarks-hero-badge">
          <Icon name="book" size={15} />
          <span>מנהל הסימניות הרשמי של Drift · Bookmarks Hub</span>
        </div>
        <div className="bookmarks-title-row">
          <div>
            <h1>סימניות וקישורים שמורים</h1>
            <p className="bookmarks-sub">
              נהל, חפש, ארגן וייצא את כל האתרים המועדפים עליך בנוחות ובפרטיות מלאה.
            </p>
          </div>
          <div className="bookmarks-top-actions">
            <button className="btn primary" onClick={() => setShowAddModal(true)}>
              <Icon name="plus" size={15} />
              <span>הוסף סימנייה</span>
            </button>
            <button className="btn ghost" onClick={handleExportHtml} title="ייצוא סימניות לקובץ HTML סטנדרטי (Netscape Format)">
              <Icon name="download" size={15} />
              <span>ייצוא HTML</span>
            </button>
            <label className="btn ghost" title="ייבוא סימניות מקובץ HTML (Chrome/Edge/Firefox)">
              <Icon name="import" size={15} />
              <span>ייבוא HTML</span>
              <input type="file" accept=".html,.htm" onChange={handleImportHtml} style={{ display: 'none' }} />
            </label>
          </div>
        </div>

        {/* Search & Stats Bar */}
        <div className="bookmarks-search-bar">
          <div className="bookmarks-search-wrap">
            <Icon name="search" size={17} />
            <input
              type="text"
              placeholder="חיפוש בסימניות לפי כותרת או כתובת אתר..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bookmarks-search-input"
            />
            {searchQuery && (
              <button className="clear-search-btn" onClick={() => setSearchQuery('')}>
                <Icon name="x" size={13} />
              </button>
            )}
          </div>
          <div className="bookmarks-count-pill">
            <span>{filteredBookmarks.length} סימניות</span>
          </div>
        </div>
      </header>

      {/* Main List */}
      <div className="bookmarks-content">
        {loading ? (
          <div className="bookmarks-loading">
            <Icon name="reload" size={24} />
            <span>טוען סימניות...</span>
          </div>
        ) : filteredBookmarks.length === 0 ? (
          <div className="bookmarks-empty">
            <div className="empty-icon-wrap">
              <Icon name="book" size={42} />
            </div>
            <h3>{searchQuery ? 'לא נמצאו סימניות התואמות את החיפוש' : 'אין עדיין סימניות שמורות'}</h3>
            <p>
              {searchQuery
                ? 'נסה להקליד מונח חיפוש אחר או בדוק שגיאות הקלדה.'
                : 'שמור אתרים מועדפים באמצעות לחיצה על כוכב הסימנייה בשורת הכתובת (Ctrl+D), או הוסף סימנייה ידנית.'}
            </p>
            {!searchQuery && (
              <div className="empty-suggestions">
                <span className="sug-label">הצעות מהירות להוספה:</span>
                <div className="sug-pills">
                  <button
                    className="sug-pill"
                    onClick={() => {
                      setNewTitle('Google');
                      setNewUrl('https://www.google.com');
                      setShowAddModal(true);
                    }}
                  >
                    Google
                  </button>
                  <button
                    className="sug-pill"
                    onClick={() => {
                      setNewTitle('GitHub');
                      setNewUrl('https://github.com');
                      setShowAddModal(true);
                    }}
                  >
                    GitHub
                  </button>
                  <button
                    className="sug-pill"
                    onClick={() => {
                      setNewTitle('YouTube');
                      setNewUrl('https://www.youtube.com');
                      setShowAddModal(true);
                    }}
                  >
                    YouTube
                  </button>
                  <button
                    className="sug-pill"
                    onClick={() => {
                      setNewTitle('Wikipedia');
                      setNewUrl('https://www.wikipedia.org');
                      setShowAddModal(true);
                    }}
                  >
                    Wikipedia
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bookmarks-list">
            {filteredBookmarks.map((bm, idx) => {
              const domain = getDomain(bm.url);
              return (
                <div key={idx} className="bookmark-card">
                  <div className="bm-fav-icon">
                    <img
                      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
                      alt=""
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                    <Icon name="globe" size={16} />
                  </div>

                  <div className="bm-info" onClick={() => handleOpenBookmark(bm.url, false)}>
                    <div className="bm-title" title={bm.title}>
                      {bm.title || bm.url}
                    </div>
                    <div className="bm-url" title={bm.url}>
                      <span className="bm-domain">{domain}</span>
                      <span className="bm-full-url">{bm.url}</span>
                    </div>
                  </div>

                  <div className="bm-actions">
                    <button
                      className="bm-action-btn"
                      title="פתח בטאב חדש"
                      onClick={() => handleOpenBookmark(bm.url, true)}
                    >
                      <Icon name="tab" size={14} />
                    </button>
                    <button
                      className="bm-action-btn"
                      title="העתק קישור"
                      onClick={() => handleCopyLink(bm.url)}
                    >
                      <Icon name="link" size={14} />
                    </button>
                    <button
                      className="bm-action-btn delete"
                      title="מחק סימנייה"
                      onClick={() => handleDeleteBookmark(bm.url)}
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Bookmark Modal */}
      {showAddModal && (
        <div className="bm-modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="bm-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="bm-modal-header">
              <h3>הוספת סימנייה חדשה</h3>
              <button className="bm-modal-close" onClick={() => setShowAddModal(false)}>
                <Icon name="x" size={15} />
              </button>
            </div>
            <div className="bm-modal-body">
              <div className="field-group">
                <label className="field-label">שם הסימנייה:</label>
                <input
                  type="text"
                  placeholder="למשל: דף הבית של Google"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="field-input"
                  autoFocus
                />
              </div>
              <div className="field-group">
                <label className="field-label">כתובת אתר (URL):</label>
                <input
                  type="text"
                  placeholder="https://example.com"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  className="field-input"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddBookmark();
                  }}
                />
              </div>
            </div>
            <div className="bm-modal-footer">
              <button className="btn primary" onClick={handleAddBookmark} disabled={!newUrl.trim()}>
                שמור סימנייה
              </button>
              <button className="btn ghost" onClick={() => setShowAddModal(false)}>
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
