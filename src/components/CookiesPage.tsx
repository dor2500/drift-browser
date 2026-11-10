import { useEffect, useMemo, useState } from 'react';
import type { BrowserState, CookieRecord } from '../../shared/types';
import { cmd, cx } from '../lib';
import { Icon } from './Icon';

interface DomainGroup {
  domain: string;
  cookies: CookieRecord[];
  secureCount: number;
  httpOnlyCount: number;
}

export function CookiesPage({ state: _state }: { state: BrowserState }) {
  const [cookies, setCookies] = useState<CookieRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'secure' | 'httponly' | 'session'>('all');
  const [sortBy, setSortBy] = useState<'domain' | 'count'>('domain');
  const [expandedDomains, setExpandedDomains] = useState<Record<string, boolean>>({});
  const [revealedValues, setRevealedValues] = useState<Record<string, boolean>>({});

  // Modals
  const [showClearAllModal, setShowClearAllModal] = useState(false);
  const [domainToDelete, setDomainToDelete] = useState<string | null>(null);
  const [editingCookie, setEditingCookie] = useState<{
    url: string;
    name: string;
    value: string;
    domain: string;
    path: string;
    secure: boolean;
    httpOnly: boolean;
    isSession: boolean;
  } | null>(null);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const loadCookies = async () => {
    try {
      setLoading(true);
      const list = await window.drift.getCookies();
      setCookies(list || []);
    } catch (e) {
      console.error('Failed to load cookies:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCookies();
  }, []);

  // Group cookies by domain
  const domainGroups = useMemo<DomainGroup[]>(() => {
    const map = new Map<string, CookieRecord[]>();
    for (const c of cookies) {
      const dom = c.domain.replace(/^\./, '');
      const arr = map.get(dom) || [];
      arr.push(c);
      map.set(dom, arr);
    }

    const groups: DomainGroup[] = [];
    for (const [domain, list] of map.entries()) {
      const secureCount = list.filter((c) => c.secure).length;
      const httpOnlyCount = list.filter((c) => c.httpOnly).length;
      groups.push({ domain, cookies: list, secureCount, httpOnlyCount });
    }

    return groups;
  }, [cookies]);

  // Filter & Sort
  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return domainGroups
      .map((g) => {
        let matchingCookies = g.cookies;
        if (filterType === 'secure') {
          matchingCookies = matchingCookies.filter((c) => c.secure);
        } else if (filterType === 'httponly') {
          matchingCookies = matchingCookies.filter((c) => c.httpOnly);
        } else if (filterType === 'session') {
          matchingCookies = matchingCookies.filter((c) => c.session);
        }

        if (q) {
          const domainMatches = g.domain.toLowerCase().includes(q);
          if (!domainMatches) {
            matchingCookies = matchingCookies.filter(
              (c) => c.name.toLowerCase().includes(q) || c.value.toLowerCase().includes(q)
            );
          }
        }

        return {
          ...g,
          cookies: matchingCookies,
        };
      })
      .filter((g) => g.cookies.length > 0)
      .sort((a, b) => {
        if (sortBy === 'count') {
          return b.cookies.length - a.cookies.length;
        }
        return a.domain.localeCompare(b.domain);
      });
  }, [domainGroups, searchQuery, filterType, sortBy]);

  // Overall statistics
  const stats = useMemo(() => {
    const totalCookies = cookies.length;
    const totalDomains = domainGroups.length;
    const secureCookies = cookies.filter((c) => c.secure).length;
    const httpOnlyCookies = cookies.filter((c) => c.httpOnly).length;
    return { totalCookies, totalDomains, secureCookies, httpOnlyCookies };
  }, [cookies, domainGroups]);

  const toggleDomain = (domain: string) => {
    setExpandedDomains((prev) => ({ ...prev, [domain]: !prev[domain] }));
  };

  const toggleExpandAll = () => {
    const allExpanded = filteredGroups.every((g) => expandedDomains[g.domain]);
    const next: Record<string, boolean> = {};
    for (const g of filteredGroups) {
      next[g.domain] = !allExpanded;
    }
    setExpandedDomains(next);
  };

  const toggleValueReveal = (key: string) => {
    setRevealedValues((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Actions
  const handleDeleteSingleCookie = async (c: CookieRecord) => {
    const protocol = c.secure ? 'https://' : 'http://';
    const cleanDom = c.domain.replace(/^\./, '');
    const url = `${protocol}${cleanDom}${c.path}`;
    await window.drift.removeCookie(url, c.name);
    showToast(`העוגיה "${c.name}" נמחקה בהצלחה`);
    await loadCookies();
  };

  const handleConfirmDeleteDomain = async () => {
    if (!domainToDelete) return;
    await window.drift.removeCookiesForDomain(domainToDelete);
    showToast(`כל נתוני האתר "${domainToDelete}" נמחקו`);
    setDomainToDelete(null);
    await loadCookies();
  };

  const handleConfirmClearAll = async () => {
    await window.drift.clearAllCookies();
    showToast('כל קובצי העוגיות ונתוני האתרים נמחקו לחלוטין');
    setShowClearAllModal(false);
    await loadCookies();
  };

  const handleSaveCookie = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCookie || !editingCookie.name.trim()) return;

    let targetUrl = editingCookie.url.trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = (editingCookie.secure ? 'https://' : 'http://') + (editingCookie.domain.replace(/^\./, '') || 'localhost');
    }

    try {
      await window.drift.setCookie({
        url: targetUrl,
        name: editingCookie.name.trim(),
        value: editingCookie.value,
        domain: editingCookie.domain.trim() || undefined,
        path: editingCookie.path.trim() || '/',
        secure: editingCookie.secure,
        httpOnly: editingCookie.httpOnly,
        expirationDate: editingCookie.isSession ? undefined : Math.floor(Date.now() / 1000) + 365 * 86400,
      });
      showToast(`העוגיה "${editingCookie.name}" נשמרה בהצלחה`);
      setEditingCookie(null);
      await loadCookies();
    } catch (err) {
      console.error(err);
      alert('שגיאה בשמירת העוגיה: אנא ודא שה-URL והדומיין תקינים.');
    }
  };

  const handleExportJSON = () => {
    const jsonStr = JSON.stringify(cookies, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `drift-cookies-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('קובץ העוגיות יוצא בהצלחה');
  };

  const faviconUrl = (dom: string) => `https://${dom}/favicon.ico`;

  return (
    <div className="cookies-page">
      {/* Toast message notification */}
      {toastMessage && (
        <div className="cookies-toast">
          <Icon name="check" size={16} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header & Stats Banner */}
      <div className="cookies-header">
        <div className="header-titles">
          <div className="header-breadcrumb">
            <button className="crumb-link" onClick={() => cmd({ type: 'settings:open' })}>
              הגדרות
            </button>
            <span className="crumb-sep">/</span>
            <span>פרטיות ואבטחה</span>
            <span className="crumb-sep">/</span>
            <span className="crumb-current">נתוני אתרים וקובצי עוגיות</span>
          </div>
          <h2>נתוני אתרים וקובצי עוגיות (Site Data & Cookies)</h2>
          <p className="header-subtitle">
            צפייה, סריקה, עריכה ומחיקה של כל נתוני הגלישה, קובצי ה-Cookie והאחסון המקומי שנשמרו על ידי אתרים בדפדפן.
          </p>
        </div>

        <div className="header-actions">
          <button
            className="btn ghost small"
            onClick={() =>
              setEditingCookie({
                url: 'https://',
                name: '',
                value: '',
                domain: '',
                path: '/',
                secure: true,
                httpOnly: false,
                isSession: false,
              })
            }
          >
            <Icon name="plus" size={14} />
            <span>+ עוגיה חדשה</span>
          </button>
          <button className="btn ghost small" onClick={handleExportJSON} title="ייצוא כל העוגיות לקובץ JSON">
            <Icon name="download" size={14} />
            <span>ייצוא JSON</span>
          </button>
          <button
            className="btn danger-ghost small"
            onClick={() => setShowClearAllModal(true)}
            disabled={cookies.length === 0}
          >
            <Icon name="trash" size={14} />
            <span>נקה את כל נתוני האתרים</span>
          </button>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="cookies-metrics-grid">
        <div className="metric-card">
          <div className="metric-icon domains">
            <Icon name="globe" size={18} />
          </div>
          <div className="metric-info">
            <span className="metric-value">{stats.totalDomains}</span>
            <span className="metric-label">אתרים ומקורות שמורים</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon cookies">
            <Icon name="key" size={18} />
          </div>
          <div className="metric-info">
            <span className="metric-value">{stats.totalCookies}</span>
            <span className="metric-label">סך הכל קובצי עוגיות</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon secure">
            <Icon name="lock" size={18} />
          </div>
          <div className="metric-info">
            <span className="metric-value">{stats.secureCookies}</span>
            <span className="metric-label">עוגיות מאובטחות (HTTPS)</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon httponly">
            <Icon name="shield" size={18} />
          </div>
          <div className="metric-info">
            <span className="metric-value">{stats.httpOnlyCookies}</span>
            <span className="metric-label">חסינות סקריפטים (HttpOnly)</span>
          </div>
        </div>
      </div>

      {/* Toolbar: Search, Filters, Sort */}
      <div className="cookies-toolbar">
        <div className="search-wrap">
          <Icon name="search" size={16} />
          <input
            type="text"
            placeholder="חפש לפי שם אתר, שם עוגיה או תוכן ערך..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="btn-clear-search" onClick={() => setSearchQuery('')}>
              <Icon name="x" size={14} />
            </button>
          )}
        </div>

        <div className="toolbar-filters">
          <button
            className={cx('filter-pill', filterType === 'all' && 'active')}
            onClick={() => setFilterType('all')}
          >
            הכל ({domainGroups.length})
          </button>
          <button
            className={cx('filter-pill', filterType === 'secure' && 'active')}
            onClick={() => setFilterType('secure')}
          >
            🔒 מאובטח ({stats.secureCookies})
          </button>
          <button
            className={cx('filter-pill', filterType === 'httponly' && 'active')}
            onClick={() => setFilterType('httponly')}
          >
            🛡️ HttpOnly ({stats.httpOnlyCookies})
          </button>
          <button
            className={cx('filter-pill', filterType === 'session' && 'active')}
            onClick={() => setFilterType('session')}
          >
            ⏳ סשן זמני
          </button>
        </div>

        <div className="toolbar-controls">
          <select
            className="field-input sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'domain' | 'count')}
          >
            <option value="domain">מיון: שם דומיין (A-Z)</option>
            <option value="count">מיון: כמות עוגיות (גבוה לנמוך)</option>
          </select>

          <button className="btn ghost small" onClick={toggleExpandAll} title="פתח או סגור את כל כרטיסי האתרים">
            <Icon name="sliders" size={13} />
            <span>פתח/סגור הכל</span>
          </button>

          <button className="btn ghost small" onClick={loadCookies} title="רענן רשימה עכשיו">
            <Icon name="reload" size={13} />
          </button>
        </div>
      </div>

      {/* Domain Groups List */}
      <div className="cookies-content">
        {loading ? (
          <div className="cookies-loading">
            <Icon name="reload" size={24} />
            <span>טוען נתוני עוגיות מהדפדפן...</span>
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="cookies-empty">
            <div className="empty-icon-box">
              <Icon name="shield" size={32} />
            </div>
            <h3>לא נמצאו קובצי עוגיות או נתוני אתרים</h3>
            <p>
              {searchQuery
                ? `לא נמצאו תוצאות עבור חיפוש "${searchQuery}". נסה חיפוש אחר.`
                : 'הדפדפן נקי לחלוטין מקובצי עוגיות ומעקב.'}
            </p>
          </div>
        ) : (
          <div className="domain-cards-list">
            {filteredGroups.map((group) => {
              const isExpanded = !!expandedDomains[group.domain];
              return (
                <div key={group.domain} className={cx('domain-card', isExpanded && 'expanded')}>
                  {/* Domain Card Header */}
                  <div className="domain-card-header" onClick={() => toggleDomain(group.domain)}>
                    <div className="domain-info-left">
                      <img
                        src={faviconUrl(group.domain)}
                        alt=""
                        className="domain-favicon"
                        onError={(e) => ((e.currentTarget.style.visibility = 'hidden'))}
                      />
                      <strong className="domain-name">{group.domain}</strong>
                      <span className="badge-count">{group.cookies.length} עוגיות</span>
                      {group.secureCount > 0 && (
                        <span className="badge-pill secure" title={`${group.secureCount} עוגיות מאובטחות`}>
                          🔒 {group.secureCount} HTTPS
                        </span>
                      )}
                      {group.httpOnlyCount > 0 && (
                        <span className="badge-pill httponly" title={`${group.httpOnlyCount} עוגיות חסינות סקריפטים`}>
                          🛡️ {group.httpOnlyCount} HttpOnly
                        </span>
                      )}
                    </div>

                    <div className="domain-actions-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="btn-trash-domain"
                        title={`מחק את כל ${group.cookies.length} העוגיות של ${group.domain}`}
                        onClick={() => setDomainToDelete(group.domain)}
                      >
                        <Icon name="trash" size={14} />
                        <span>מחק אתר</span>
                      </button>
                      <button
                        className="btn-expand-domain"
                        title={isExpanded ? 'כווץ' : 'הרחב'}
                        onClick={() => toggleDomain(group.domain)}
                      >
                        <Icon name={isExpanded ? 'up' : 'down'} size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Domain Cookies Table */}
                  {isExpanded && (
                    <div className="domain-cookies-table-wrap">
                      <table className="domain-cookies-table">
                        <thead>
                          <tr>
                            <th>שם (Name)</th>
                            <th>ערך (Value)</th>
                            <th>נתיב (Path)</th>
                            <th>תפוגה (Expires)</th>
                            <th>מאפייני אבטחה</th>
                            <th className="th-actions">פעולות</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.cookies.map((c, idx) => {
                            const cookieKey = `${c.domain}-${c.name}-${idx}`;
                            const isRevealed = !!revealedValues[cookieKey];
                            const expireText = c.session
                              ? 'סשן נוכחי'
                              : c.expirationDate
                                ? new Date(c.expirationDate * 1000).toLocaleDateString('he-IL', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                  })
                                : 'ללא הגבלה';

                            return (
                              <tr key={cookieKey}>
                                <td className="td-name">
                                  <div className="cookie-name-wrap">
                                    <Icon name="key" size={13} />
                                    <strong title={c.name}>{c.name}</strong>
                                  </div>
                                </td>
                                <td className="td-value">
                                  <div className="cookie-value-box">
                                    <span className="value-text">
                                      {isRevealed
                                        ? c.value
                                        : c.value.length > 24
                                          ? `${c.value.slice(0, 12)}••••••••`
                                          : c.value.replace(/./g, '•')}
                                    </span>
                                    <button
                                      className="btn-icon-tiny"
                                      title={isRevealed ? 'הסתר ערך' : 'הצג ערך'}
                                      onClick={() => toggleValueReveal(cookieKey)}
                                    >
                                      <Icon name={isRevealed ? 'sun' : 'moon'} size={12} />
                                    </button>
                                    <button
                                      className="btn-icon-tiny"
                                      title="העתק ערך ללוח"
                                      onClick={() => {
                                        navigator.clipboard.writeText(c.value);
                                        showToast(`הערך של "${c.name}" הועתק`);
                                      }}
                                    >
                                      <Icon name="copy" size={12} />
                                    </button>
                                  </div>
                                </td>
                                <td className="td-path">{c.path}</td>
                                <td className="td-expires">{expireText}</td>
                                <td className="td-flags">
                                  <div className="flags-wrap">
                                    {c.secure && <span className="flag secure">Secure</span>}
                                    {c.httpOnly && <span className="flag httponly">HttpOnly</span>}
                                    {c.sameSite && c.sameSite !== 'unspecified' && (
                                      <span className="flag samesite">{c.sameSite}</span>
                                    )}
                                  </div>
                                </td>
                                <td className="td-actions">
                                  <div className="actions-wrap">
                                    <button
                                      className="btn-icon-small edit"
                                      title="ערוך עוגיה"
                                      onClick={() =>
                                        setEditingCookie({
                                          url: (c.secure ? 'https://' : 'http://') + group.domain + c.path,
                                          name: c.name,
                                          value: c.value,
                                          domain: c.domain,
                                          path: c.path,
                                          secure: c.secure,
                                          httpOnly: c.httpOnly,
                                          isSession: c.session,
                                        })
                                      }
                                    >
                                      <Icon name="sliders" size={13} />
                                    </button>
                                    <button
                                      className="btn-icon-small delete"
                                      title="מחק עוגיה זו"
                                      onClick={() => handleDeleteSingleCookie(c)}
                                    >
                                      <Icon name="trash" size={13} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL: ADD / EDIT COOKIE */}
      {editingCookie && (
        <div className="modal-backdrop" onClick={() => setEditingCookie(null)}>
          <div className="modal-content cookie-editor-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingCookie.name ? 'עריכת עוגיה' : 'הוספת עוגיה ידנית חדשה'}</h3>
              <button className="btn-icon" onClick={() => setEditingCookie(null)}>
                <Icon name="x" size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveCookie}>
              <div className="modal-body">
                <div className="field-group">
                  <label className="field-label">דומיין האתר (Domain):</label>
                  <input
                    type="text"
                    className="field-input"
                    placeholder="לדוגמה: .google.com או localhost"
                    value={editingCookie.domain}
                    onChange={(e) => setEditingCookie({ ...editingCookie, domain: e.target.value })}
                    required
                  />
                </div>

                <div className="field-group">
                  <label className="field-label">שם העוגיה (Name):</label>
                  <input
                    type="text"
                    className="field-input"
                    placeholder="לדוגמה: session_id, token, user_pref"
                    value={editingCookie.name}
                    onChange={(e) => setEditingCookie({ ...editingCookie, name: e.target.value })}
                    required
                  />
                </div>

                <div className="field-group">
                  <label className="field-label">ערך העוגיה (Value):</label>
                  <textarea
                    className="field-input"
                    rows={3}
                    placeholder="הזן ערך..."
                    value={editingCookie.value}
                    onChange={(e) => setEditingCookie({ ...editingCookie, value: e.target.value })}
                  />
                </div>

                <div className="field-group">
                  <label className="field-label">נתיב (Path):</label>
                  <input
                    type="text"
                    className="field-input"
                    placeholder="/"
                    value={editingCookie.path}
                    onChange={(e) => setEditingCookie({ ...editingCookie, path: e.target.value })}
                  />
                </div>

                <div className="checkboxes-row">
                  <label className="cb-label">
                    <input
                      type="checkbox"
                      checked={editingCookie.secure}
                      onChange={(e) => setEditingCookie({ ...editingCookie, secure: e.target.checked })}
                    />
                    <span>מאובטח בלבד (Secure / HTTPS Only)</span>
                  </label>

                  <label className="cb-label">
                    <input
                      type="checkbox"
                      checked={editingCookie.httpOnly}
                      onChange={(e) => setEditingCookie({ ...editingCookie, httpOnly: e.target.checked })}
                    />
                    <span>חסינות סקריפט (HttpOnly)</span>
                  </label>

                  <label className="cb-label">
                    <input
                      type="checkbox"
                      checked={editingCookie.isSession}
                      onChange={(e) => setEditingCookie({ ...editingCookie, isSession: e.target.checked })}
                    />
                    <span>עוגיית סשן זמנית (Session)</span>
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn ghost" onClick={() => setEditingCookie(null)}>
                  ביטול
                </button>
                <button type="submit" className="btn primary">
                  שמור עוגיה
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DELETE DOMAIN CONFIRMATION */}
      {domainToDelete && (
        <div className="modal-backdrop" onClick={() => setDomainToDelete(null)}>
          <div className="modal-content confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>מחיקת נתוני אתר</h3>
              <button className="btn-icon" onClick={() => setDomainToDelete(null)}>
                <Icon name="x" size={16} />
              </button>
            </div>
            <div className="modal-body">
              <p>האם אתה בטוח שברצונך למחוק את כל קובצי העוגיות ונתוני האתר של <strong>{domainToDelete}</strong>?</p>
              <p className="modal-hint">פעולה זו תנתק אותך מחשבונך באתר זה ותאפס הגדרות מקומיות שנשמרו בו.</p>
            </div>
            <div className="modal-footer">
              <button className="btn ghost" onClick={() => setDomainToDelete(null)}>
                ביטול
              </button>
              <button className="btn danger" onClick={handleConfirmDeleteDomain}>
                מחק נתונים
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CLEAR ALL CONFIRMATION */}
      {showClearAllModal && (
        <div className="modal-backdrop" onClick={() => setShowClearAllModal(false)}>
          <div className="modal-content confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>ניקוי מלא של כל נתוני האתרים והעוגיות</h3>
              <button className="btn-icon" onClick={() => setShowClearAllModal(false)}>
                <Icon name="x" size={16} />
              </button>
            </div>
            <div className="modal-body">
              <p>האם אתה בטוח שברצונך למחוק את <strong>כל {stats.totalCookies} קובצי ה-Cookie</strong> מכל {stats.totalDomains} האתרים?</p>
              <p className="modal-hint">
                פעולה זו תנקה את כל האחסון המקומי (LocalStorage, IndexedDB, Cache ו-Cookies) בכל האתרים ותנתק אותך מכל החשבונות הפעילים.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn ghost" onClick={() => setShowClearAllModal(false)}>
                ביטול
              </button>
              <button className="btn danger" onClick={handleConfirmClearAll}>
                מחק את כל הנתונים
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
