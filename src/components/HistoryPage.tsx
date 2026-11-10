import { useEffect, useMemo, useState } from 'react';
import type { BrowserState, HistoryItem } from '../../shared/types';
import { cmd, cx } from '../lib';
import { Icon } from './Icon';

interface Props {
  state: BrowserState;
}

type ClearRange = '1h' | '24h' | '7d' | '4w' | 'all';
type ViewFilter = 'all' | 'recentlyClosed' | 'bookmarks' | 'frequent';

export function HistoryPage({ state: _state }: Props) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ViewFilter>('all');
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearRange, setClearRange] = useState<ClearRange>('all');
  const [clearHistoryCheck, setClearHistoryCheck] = useState(true);
  const [clearCookiesCheck, setClearCookiesCheck] = useState(false);
  const [clearCacheCheck, setClearCacheCheck] = useState(false);
  const [clearing, setClearing] = useState(false);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const list = await window.drift.getHistory(2000);
      setHistory(list);
    } catch (err) {
      console.error('[drift:history] failed to load', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadHistory();
  }, []);

  useEffect(() => {
    const activeTab = _state.tabs.find((t) => t.id === _state.activeTabId);
    if (activeTab?.url.includes('clear=true')) {
      setShowClearModal(true);
    }
  }, [_state.tabs, _state.activeTabId]);

  const handleDeleteOne = async (url: string) => {
    await window.drift.deleteHistory(url);
    setHistory((prev) => prev.filter((item) => item.url !== url));
    setSelectedUrls((prev) => {
      const next = new Set(prev);
      next.delete(url);
      return next;
    });
  };

  const handleDeleteSelected = async () => {
    if (selectedUrls.size === 0) return;
    const urls = Array.from(selectedUrls);
    for (const u of urls) {
      await window.drift.deleteHistory(u);
    }
    setHistory((prev) => prev.filter((item) => !selectedUrls.has(item.url)));
    setSelectedUrls(new Set());
  };

  const handleClearData = async () => {
    setClearing(true);
    try {
      await cmd({
        type: 'privacy:clearData',
        range: clearRange,
        history: clearHistoryCheck,
        cookies: clearCookiesCheck,
        cache: clearCacheCheck,
      });
      setShowClearModal(false);
      await loadHistory();
    } finally {
      setClearing(false);
    }
  };

  const handleCopy = (url: string) => {
    void navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const toggleSelectOne = (url: string) => {
    setSelectedUrls((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const toggleSelectAll = (filteredList: HistoryItem[]) => {
    if (selectedUrls.size >= filteredList.length && filteredList.length > 0) {
      setSelectedUrls(new Set());
    } else {
      setSelectedUrls(new Set(filteredList.map((i) => i.url)));
    }
  };

  // Filtered list based on search and sub-filter
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return history.filter((item) => {
      if (filter === 'bookmarks' && !item.bookmark) return false;
      if (filter === 'frequent' && item.visits < 3) return false;
      if (!q) return true;
      return item.title.toLowerCase().includes(q) || item.url.toLowerCase().includes(q);
    });
  }, [history, search, filter]);

  // Group by date
  const groups = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 86400000;
    const startOfWeek = startOfToday - 6 * 86400000;

    const todayItems: HistoryItem[] = [];
    const yesterdayItems: HistoryItem[] = [];
    const thisWeekItems: HistoryItem[] = [];
    const olderItems: HistoryItem[] = [];

    for (const item of filtered) {
      const ts = item.last || 0;
      if (ts >= startOfToday) todayItems.push(item);
      else if (ts >= startOfYesterday) yesterdayItems.push(item);
      else if (ts >= startOfWeek) thisWeekItems.push(item);
      else olderItems.push(item);
    }

    const res: { label: string; count: number; items: HistoryItem[] }[] = [];
    if (todayItems.length > 0) res.push({ label: 'היום · Today', count: todayItems.length, items: todayItems });
    if (yesterdayItems.length > 0) res.push({ label: 'אתמול · Yesterday', count: yesterdayItems.length, items: yesterdayItems });
    if (thisWeekItems.length > 0) res.push({ label: '7 הימים האחרונים · Earlier This Week', count: thisWeekItems.length, items: thisWeekItems });
    if (olderItems.length > 0) res.push({ label: 'היסטוריה ישנה יותר · Older', count: olderItems.length, items: olderItems });
    return res;
  }, [filtered]);

  const formatTime = (ts: number) => {
    if (!ts) return '--:--';
    const d = new Date(ts);
    return d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  };

  const getDomain = (url: string) => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  };

  return (
    <div className="history-hub-page" dir="rtl">
      {/* Header Banner */}
      <header className="history-hub-header">
        <div className="history-header-left">
          <div className="history-header-icon">
            <Icon name="clock" size={26} />
          </div>
          <div>
            <h1 className="history-title">היסטוריית גלישה (Browsing History)</h1>
            <p className="history-subtitle">
              חיפוש, ניהול ומחיקת פעילות גלישה מקומית ומסונכרנת · Drift Security & Privacy Shield
            </p>
          </div>
        </div>

        <div className="history-header-actions">
          <button className="btn history-action-btn primary" onClick={() => setShowClearModal(true)}>
            <Icon name="broom" size={15} />
            <span>נקה נתוני גלישה (Clear Data)</span>
          </button>
          <button className="btn history-action-btn" onClick={() => void loadHistory()} title="רענן רשימה">
            <Icon name="forward" size={14} />
          </button>
        </div>
      </header>

      {/* Search & Filter Bar */}
      <div className="history-filter-strip">
        <div className="history-search-box">
          <Icon name="search" size={16} />
          <input
            type="text"
            className="history-search-input"
            placeholder="חפש בהיסטוריה לפי כותרת עמוד או כתובת URL... (Search History)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="history-search-clear" onClick={() => setSearch('')} title="נקה חיפוש">
              <Icon name="x" size={13} />
            </button>
          )}
        </div>

        <div className="history-filter-tabs">
          <button
            className={cx('history-tab-chip', filter === 'all' && 'active')}
            onClick={() => setFilter('all')}
          >
            כל ההיסטוריה ({history.length})
          </button>
          <button
            className={cx('history-tab-chip', filter === 'recentlyClosed' && 'active')}
            onClick={() => setFilter('recentlyClosed')}
          >
            🕒 כרטיסיות שנסגרו לאחרונה ({_state.recentlyClosed?.length || 0})
          </button>
          <button
            className={cx('history-tab-chip', filter === 'bookmarks' && 'active')}
            onClick={() => setFilter('bookmarks')}
          >
            ⭐ סימניות ({history.filter((i) => i.bookmark).length})
          </button>
          <button
            className={cx('history-tab-chip', filter === 'frequent' && 'active')}
            onClick={() => setFilter('frequent')}
          >
            🔥 אתרים נפוצים ({history.filter((i) => i.visits >= 3).length})
          </button>
        </div>
      </div>

      {/* Selected Items Bulk Bar */}
      {selectedUrls.size > 0 && (
        <div className="history-selection-bar">
          <div className="selection-info">
            <Icon name="check" size={16} />
            <span>{selectedUrls.size} פריטים נבחרו</span>
          </div>
          <div className="selection-actions">
            <button className="btn small danger" onClick={() => void handleDeleteSelected()}>
              <Icon name="trash" size={14} />
              <span>מחק פריטים שנבחרו</span>
            </button>
            <button className="btn small" onClick={() => setSelectedUrls(new Set())}>
              בטל בחירה
            </button>
          </div>
        </div>
      )}

      {/* Content Groups */}
      <div className="history-content-scroll">
        {filter === 'recentlyClosed' ? (
          (!_state.recentlyClosed || _state.recentlyClosed.length === 0) ? (
            <div className="history-empty-state">
              <Icon name="inbox" size={48} />
              <h3>אין כרטיסיות שנסגרו לאחרונה</h3>
              <p>כרטיסיות שתסגור יופיעו כאן וניתן יהיה לפתוח אותן מחדש בלחיצה אחת או באמצעות Ctrl+Shift+T.</p>
            </div>
          ) : (
            <div className="history-group-section">
              <div className="history-group-header">
                <div className="group-title-wrap">
                  <h2 className="history-group-title">כרטיסיות שנסגרו לאחרונה · Recently Closed Tabs</h2>
                  <span className="history-group-badge">{_state.recentlyClosed.length}</span>
                </div>
              </div>
              <div className="history-items-list">
                {_state.recentlyClosed.map((rc) => (
                  <div key={rc.id} className="history-item-row recently-closed-row">
                    <span className="history-time-stamp">{formatTime(rc.closedAt)}</span>
                    <div className="history-favicon-box">
                      {rc.favicon ? (
                        <img src={rc.favicon} alt="" className="history-favicon-img" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
                      ) : (
                        <span className="history-favicon-letter">{getDomain(rc.url)[0]?.toUpperCase() || '•'}</span>
                      )}
                    </div>
                    <div className="history-meta-box">
                      <span className="history-item-title" title={rc.title}>{rc.title}</span>
                      <span className="history-item-domain">{getDomain(rc.url)}</span>
                    </div>
                    <div className="history-row-actions">
                      <button
                        className="btn small primary"
                        onClick={() => cmd({ type: 'tab:reopen', closedId: rc.id })}
                        title="פתח כרטיסייה זו מחדש"
                      >
                        <Icon name="tab" size={13} />
                        <span>פתח מחדש</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        ) : loading ? (
          <div className="history-empty-state">
            <Icon name="clock" size={40} />
            <p>טוען נתוני היסטוריה...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="history-empty-state">
            <Icon name="inbox" size={48} />
            <h3>{search ? 'לא נמצאו תוצאות עבור החיפוש' : 'היסטוריית הגלישה ריקה'}</h3>
            <p>
              {search
                ? `נסה לחפש מילות מפתח אחרות או בדוק שגיאות הקלדה.`
                : 'אתרים שתבקר בהם יופיעו כאן בצורה מאובטחת ומסודרת לפי תאריכים ושעות.'}
            </p>
            {search && (
              <button className="btn small" onClick={() => setSearch('')}>
                הצג את כל ההיסטוריה
              </button>
            )}
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.label} className="history-group-section">
              <div className="history-group-header">
                <div className="group-title-wrap">
                  <h2 className="history-group-title">{group.label}</h2>
                  <span className="history-group-badge">{group.count}</span>
                </div>
                <button
                  className="btn ghost-btn small"
                  onClick={() => toggleSelectAll(group.items)}
                  title="בחר / בטל בחירת כל הפריטים בקבוצה זו"
                >
                  בחר הכל בקבוצה זו
                </button>
              </div>

              <div className="history-items-list">
                {group.items.map((item) => {
                  const isSelected = selectedUrls.has(item.url);
                  const domain = getDomain(item.url);
                  return (
                    <div
                      key={item.url}
                      className={cx('history-item-row', isSelected && 'selected')}
                    >
                      <label className="history-checkbox-wrap">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(item.url)}
                        />
                      </label>

                      <div className="history-item-time" title={new Date(item.last).toLocaleString('he-IL')}>
                        {formatTime(item.last)}
                      </div>

                      <div className="history-item-favicon">
                        <img
                          src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
                          alt=""
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                          }}
                        />
                      </div>

                      <div className="history-item-details">
                        <button
                          className="history-item-title-link"
                          onClick={() => cmd({ type: 'tab:new', url: item.url })}
                          title={`${item.title}\n${item.url}`}
                        >
                          {item.title || item.url}
                        </button>
                        <div className="history-item-meta">
                          <span className="history-domain-chip">{domain}</span>
                          {item.visits > 1 && (
                            <span className="history-visits-chip">
                              {item.visits} ביקורים
                            </span>
                          )}
                          {item.source && (
                            <span className="history-source-chip">
                              מקור: {item.source}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="history-item-actions">
                        <button
                          className={cx('history-icon-btn', item.bookmark && 'bookmarked')}
                          title={item.bookmark ? 'מופיע בסימניות' : 'הוסף לסימניות'}
                          onClick={() => cmd({ type: 'bookmark:toggle', url: item.url, title: item.title })}
                        >
                          <Icon name="star" size={14} />
                        </button>
                        <button
                          className="history-icon-btn"
                          title="העתק קישור"
                          onClick={() => handleCopy(item.url)}
                        >
                          <Icon name={copiedUrl === item.url ? 'check' : 'copy'} size={14} />
                        </button>
                        <button
                          className="history-icon-btn"
                          title="פתח בטאב חדש"
                          onClick={() => cmd({ type: 'tab:new', url: item.url })}
                        >
                          <Icon name="tab" size={14} />
                        </button>
                        <button
                          className="history-icon-btn danger"
                          title="מחק פריט זה מההיסטוריה"
                          onClick={() => void handleDeleteOne(item.url)}
                        >
                          <Icon name="x" size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Clear Browsing Data Modal (Chrome-Matching) */}
      {showClearModal && (
        <div className="drift-modal-backdrop" onClick={() => !clearing && setShowClearModal(false)}>
          <div className="drift-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="drift-modal-header">
              <div className="modal-title-wrap">
                <Icon name="broom" size={20} />
                <h3>נקה נתוני גלישה (Clear Browsing Data)</h3>
              </div>
              <button
                className="drift-modal-close"
                disabled={clearing}
                onClick={() => setShowClearModal(false)}
              >
                <Icon name="x" size={16} />
              </button>
            </div>

            <div className="drift-modal-body">
              <p className="modal-description">
                מחיקת היסטוריה, קובצי Cookie ומטמון מהמכשיר המקומי של Drift.
              </p>

              <div className="modal-field-group">
                <label className="modal-label">טווח זמן (Time Range):</label>
                <select
                  className="modal-select"
                  value={clearRange}
                  onChange={(e) => setClearRange(e.target.value as ClearRange)}
                  disabled={clearing}
                >
                  <option value="1h">השעה האחרונה (Last hour)</option>
                  <option value="24h">24 השעות האחרונות (Last 24 hours)</option>
                  <option value="7d">7 הימים האחרונים (Last 7 days)</option>
                  <option value="4w">4 השבועות האחרונים (Last 4 weeks)</option>
                  <option value="all">כל הזמן (All time)</option>
                </select>
              </div>

              <div className="modal-checkboxes-list">
                <label className="modal-checkbox-row">
                  <input
                    type="checkbox"
                    checked={clearHistoryCheck}
                    onChange={(e) => setClearHistoryCheck(e.target.checked)}
                    disabled={clearing}
                  />
                  <div>
                    <strong>היסטוריית גלישה (Browsing History)</strong>
                    <span>מנקה את כל כתובות האתרים שביקרת בהם בטווח הנבחר.</span>
                  </div>
                </label>

                <label className="modal-checkbox-row">
                  <input
                    type="checkbox"
                    checked={clearCookiesCheck}
                    onChange={(e) => setClearCookiesCheck(e.target.checked)}
                    disabled={clearing}
                  />
                  <div>
                    <strong>קובצי Cookie ונתוני אתרים אחרים (Cookies & Site Data)</strong>
                    <span>מנתק אותך ממרבית האתרים.</span>
                  </div>
                </label>

                <label className="modal-checkbox-row">
                  <input
                    type="checkbox"
                    checked={clearCacheCheck}
                    onChange={(e) => setClearCacheCheck(e.target.checked)}
                    disabled={clearing}
                  />
                  <div>
                    <strong>תמונות וקבצים במטמון (Cached Images & Files)</strong>
                    <span>מפנה שטח אחסון ומאפשר טעינה עדכנית של אתרים.</span>
                  </div>
                </label>
              </div>
            </div>

            <div className="drift-modal-footer">
              <button
                className="btn"
                disabled={clearing}
                onClick={() => setShowClearModal(false)}
              >
                ביטול
              </button>
              <button
                className="btn danger"
                disabled={clearing || (!clearHistoryCheck && !clearCookiesCheck && !clearCacheCheck)}
                onClick={() => void handleClearData()}
              >
                {clearing ? 'מנקה כעת...' : 'נקה נתונים (Clear Now)'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

