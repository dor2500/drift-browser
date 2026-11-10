import { useEffect, useMemo, useState } from 'react';
import type { BrowserState } from '../../shared/types';
import { cmd, cx } from '../lib';
import { Icon, type IconName } from './Icon';

interface PermissionCategory {
  id: string;
  nameHe: string;
  nameEn: string;
  icon: IconName;
  descriptionHe: string;
  defaultState: 'ask' | 'allow' | 'block';
  defaultStateLabel: string;
}

const CATEGORIES: PermissionCategory[] = [
  {
    id: 'camera',
    nameHe: 'מצלמה',
    nameEn: 'Camera',
    icon: 'camera',
    descriptionHe: 'גישה למצלמת המכשיר לשיחות וידאו וסריקת מסמכים',
    defaultState: 'ask',
    defaultStateLabel: 'שאל לפני מתן גישה (מומלץ)',
  },
  {
    id: 'microphone',
    nameHe: 'מיקרופון',
    nameEn: 'Microphone',
    icon: 'mic',
    descriptionHe: 'הקלטת קול, זיהוי דיבור ושיחות שמע',
    defaultState: 'ask',
    defaultStateLabel: 'שאל לפני מתן גישה (מומלץ)',
  },
  {
    id: 'geolocation',
    nameHe: 'מיקום גיאוגרפי',
    nameEn: 'Location',
    icon: 'location',
    descriptionHe: 'שיתוף מיקום מדויק של המכשיר עם שירותי מפות ומזג אוויר',
    defaultState: 'ask',
    defaultStateLabel: 'שאל לפני מתן גישה',
  },
  {
    id: 'notifications',
    nameHe: 'התראות מערכת',
    nameEn: 'Notifications',
    icon: 'bell',
    descriptionHe: 'קבלת הודעות פוש והתראות שולחן עבודה מאתרים',
    defaultState: 'ask',
    defaultStateLabel: 'שאל לפני שליחת התראות',
  },
  {
    id: 'clipboard-read',
    nameHe: 'לוח עריכה (קריאה)',
    nameEn: 'Clipboard Access',
    icon: 'link',
    descriptionHe: 'קריאת טקסט ותמונות המועתקים בלוח המערכת',
    defaultState: 'ask',
    defaultStateLabel: 'שאל לפני קריאת הלוח',
  },
  {
    id: 'media',
    nameHe: 'צליל והפעלה אוטומטית',
    nameEn: 'Sound & Autoplay',
    icon: 'music',
    descriptionHe: 'ניגון אודיו והשמעת סרטונים אוטומטית בעמודים',
    defaultState: 'allow',
    defaultStateLabel: 'אפשר צליל כברירת מחדל',
  },
  {
    id: 'window-management',
    nameHe: 'חלונות קופצים והפניות',
    nameEn: 'Popups & Redirects',
    icon: 'tab',
    descriptionHe: 'פתיחת חלונות וטאבים חדשים באופן עצמאי',
    defaultState: 'block',
    defaultStateLabel: 'חסום חלונות קופצים (מומלץ)',
  },
  {
    id: 'fileSystem',
    nameHe: 'מערכת קבצים',
    nameEn: 'File System',
    icon: 'folder',
    descriptionHe: 'קריאה ועריכת קבצים ותיקיות מקומיות במחשב',
    defaultState: 'ask',
    defaultStateLabel: 'שאל לפני גישה לקבצים',
  },
  {
    id: 'idle-detection',
    nameHe: 'זיהוי חוסר פעילות',
    nameEn: 'Idle Detection',
    icon: 'clock',
    descriptionHe: 'זיהוי מתי המשתמש אינו נוגע בעכבר או במקלדת',
    defaultState: 'ask',
    defaultStateLabel: 'שאל לפני מעקב חוסר פעילות',
  },
  {
    id: 'midi',
    nameHe: 'התקני MIDI',
    nameEn: 'MIDI Devices',
    icon: 'sliders',
    descriptionHe: 'חיבור למקלדות וכלי נגינה דיגיטליים ב-Web MIDI',
    defaultState: 'ask',
    defaultStateLabel: 'שאל לפני חיבור MIDI',
  },
  {
    id: 'storage-access',
    nameHe: 'גישה לאחסון מקומי ועוגיות',
    nameEn: 'Storage Access',
    icon: 'shield',
    descriptionHe: 'שמירת מטמון ועוגיות עבור יישומי צד ג׳',
    defaultState: 'ask',
    defaultStateLabel: 'מוגן ע״י Drift Shield',
  },
  {
    id: 'openExternal',
    nameHe: 'פתיחת אפליקציות חיצוניות',
    nameEn: 'Open External Apps',
    icon: 'tab',
    descriptionHe: 'הפעלת יישומי שולחן עבודה (Zoom, Teams, Mailto וכו׳)',
    defaultState: 'ask',
    defaultStateLabel: 'שאל לפני הפעלת יישום',
  },
];

export function SiteSettingsPage({ state: _state }: { state: BrowserState }) {
  const [permissions, setPermissions] = useState<Record<string, Record<string, 'allow' | 'block'>>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedSites, setExpandedSites] = useState<Record<string, boolean>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Add override modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addOrigin, setAddOrigin] = useState('');
  const [addKind, setAddKind] = useState('camera');
  const [addDecision, setAddDecision] = useState<'allow' | 'block'>('allow');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const loadPermissions = async () => {
    try {
      const data = await window.drift.sitePermissions();
      setPermissions(data || {});
    } catch (e) {
      console.error('Failed to load permissions', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPermissions();
  }, []);

  const handleSetDecision = async (origin: string, kind: string, decision: 'allow' | 'block' | 'ask') => {
    if (decision === 'ask') {
      await cmd({ type: 'permission:reset', origin, kind });
      showToast(`ההרשאה אופסה לברירת המחדל ("שאל") עבור ${origin}`);
    } else {
      await cmd({ type: 'permission:set', origin, kind, decision });
      showToast(`ההרשאה שונתה ל-${decision === 'allow' ? 'מורשה' : 'חסום'} עבור ${origin}`);
    }
    await loadPermissions();
  };

  const handleResetSite = async (origin: string) => {
    await cmd({ type: 'permission:reset', origin });
    showToast(`כל ההרשאות החורגות עבור ${origin} אופסו`);
    await loadPermissions();
  };

  const handleClearAll = async () => {
    if (confirm('האם אתה בטוח שברצונך לאפס את כל ההרשאות המותאמות אישית לכל האתרים?')) {
      await cmd({ type: 'permission:reset', origin: '*' });
      showToast('כל ההרשאות המותאמות אישית לכל האתרים אופסו בהצלחה!');
      await loadPermissions();
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let o = addOrigin.trim();
    if (!o) return;
    if (!/^https?:\/\//i.test(o)) {
      o = 'https://' + o;
    }
    try {
      const url = new URL(o);
      const cleanOrigin = url.origin;
      await cmd({ type: 'permission:set', origin: cleanOrigin, kind: addKind, decision: addDecision });
      showToast(`הרשאה נוספה בהצלחה לאתר ${cleanOrigin}`);
      setShowAddModal(false);
      setAddOrigin('');
      await loadPermissions();
    } catch {
      alert('נא להזין כתובת אתר תקינה (לדוגמה: https://meet.google.com)');
    }
  };

  const toggleExpand = (origin: string) => {
    setExpandedSites((prev) => ({ ...prev, [origin]: !prev[origin] }));
  };

  // Compute site statistics
  const siteList = useMemo(() => {
    return Object.entries(permissions).map(([origin, kinds]) => ({
      origin,
      kinds,
      count: Object.keys(kinds).length,
    }));
  }, [permissions]);

  const filteredSites = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return siteList.filter(({ origin, kinds }) => {
      const matchQuery =
        !q ||
        origin.toLowerCase().includes(q) ||
        Object.keys(kinds).some((k) => k.toLowerCase().includes(q));

      const matchCategory =
        !selectedCategory ||
        Object.keys(kinds).includes(selectedCategory);

      return matchQuery && matchCategory;
    });
  }, [siteList, searchQuery, selectedCategory]);

  const totalDecisionsCount = useMemo(() => {
    return siteList.reduce((acc, curr) => acc + curr.count, 0);
  }, [siteList]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, { allow: number; block: number }> = {};
    for (const cat of CATEGORIES) {
      counts[cat.id] = { allow: 0, block: 0 };
    }
    for (const site of siteList) {
      for (const [k, v] of Object.entries(site.kinds)) {
        if (!counts[k]) counts[k] = { allow: 0, block: 0 };
        if (v === 'allow') counts[k].allow++;
        if (v === 'block') counts[k].block++;
      }
    }
    return counts;
  }, [siteList]);

  return (
    <div className="site-settings-page" dir="rtl">
      {/* Top Header */}
      <header className="site-settings-header">
        <div className="site-settings-hero">
          <div className="settings-hero-badge">
            <Icon name="shield" size={16} />
            <span>הגדרות תוכן והרשאות אבטחה של Chrome & Drift</span>
          </div>
          <h1>הגדרות אתרים והרשאות תוכן</h1>
          <p className="site-settings-sub">
            שליטה מלאה על הרשאות המצלמה, המיקרופון, ההתראות, לוח העריכה והעוגיות עבור כל אתר אינטרנט.
          </p>

          <div className="site-settings-actions-bar">
            <div className="site-settings-search">
              <Icon name="search" size={16} />
              <input
                type="text"
                placeholder="חיפוש לפי כתובת אתר או סוג הרשאה (מצלמה, התראות...)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="clear-search-btn" onClick={() => setSearchQuery('')}>
                  <Icon name="x" size={13} />
                </button>
              )}
            </div>

            <div className="header-buttons-row">
              <button className="btn primary small" onClick={() => setShowAddModal(true)}>
                <Icon name="plus" size={14} />
                <span>הוסף אתר להרשאות מותאמות</span>
              </button>

              {totalDecisionsCount > 0 && (
                <button className="btn ghost small" onClick={handleClearAll} title="אפס את כל ההרשאות החורגות">
                  <Icon name="reload" size={14} />
                  <span>נקה את כל ההרשאות ({totalDecisionsCount})</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Drift Shield Max Security Status HUD */}
        <div className="site-settings-shield-hud">
          <div className="hud-title-row">
            <div className="hud-icon-wrap">
              <Icon name="shield" size={22} />
            </div>
            <div>
              <div className="hud-title">מערך אבטחת אתרים מקסימאלי פעיל</div>
              <div className="hud-sub">בידוד מוחלט של טביעות אצבע והגנה מפני פישינג</div>
            </div>
          </div>
          <div className="hud-badges-grid">
            <div className="hud-badge-pill">
              <Icon name="check" size={12} />
              <span>Camera Sandbox</span>
            </div>
            <div className="hud-badge-pill">
              <Icon name="check" size={12} />
              <span>Mic Noise Cloaking</span>
            </div>
            <div className="hud-badge-pill">
              <Icon name="check" size={12} />
              <span>Geo Spoof Defense</span>
            </div>
            <div className="hud-badge-pill">
              <Icon name="check" size={12} />
              <span>XSS / CSP Enforced</span>
            </div>
          </div>
        </div>
      </header>

      {/* 12 Chrome Content Settings Categories Grid */}
      <section className="categories-section">
        <div className="section-title-row">
          <h2>12 קטגוריות ההרשאות והתוכן של Chrome</h2>
          {selectedCategory && (
            <button className="btn ghost small reset-filter-btn" onClick={() => setSelectedCategory(null)}>
              <span>הצג את כל הקטגוריות</span>
              <Icon name="x" size={12} />
            </button>
          )}
        </div>

        <div className="categories-grid">
          {CATEGORIES.map((cat) => {
            const counts = categoryCounts[cat.id] || { allow: 0, block: 0 };
            const isSelected = selectedCategory === cat.id;
            const hasOverrides = counts.allow > 0 || counts.block > 0;

            return (
              <div
                key={cat.id}
                className={cx('category-card', isSelected && 'active', hasOverrides && 'has-overrides')}
                onClick={() => setSelectedCategory(isSelected ? null : cat.id)}
              >
                <div className="cat-card-top">
                  <div className="cat-icon-wrap">
                    <Icon name={cat.icon} size={20} />
                  </div>
                  <div className="cat-info">
                    <div className="cat-title-line">
                      <span className="cat-title">{cat.nameHe}</span>
                      <span className="cat-title-en">{cat.nameEn}</span>
                    </div>
                    <div className="cat-desc">{cat.descriptionHe}</div>
                  </div>
                </div>

                <div className="cat-card-bottom">
                  <span className="cat-default-pill">{cat.defaultStateLabel}</span>
                  {hasOverrides ? (
                    <span className="cat-overrides-badge">
                      {counts.allow > 0 && <span className="allow-count">✓ {counts.allow} מורשים</span>}
                      {counts.block > 0 && <span className="block-count">✕ {counts.block} חסומים</span>}
                    </span>
                  ) : (
                    <span className="cat-no-overrides">לפי ברירת מחדל</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Per-Site Overrides List */}
      <section className="sites-overrides-section">
        <div className="section-title-row">
          <h2>
            אתרים בעלי הרשאות מותאמות אישית ({filteredSites.length})
            {selectedCategory && (
              <span className="filtered-category-tag">
                — מסונן לפי: {CATEGORIES.find((c) => c.id === selectedCategory)?.nameHe}
              </span>
            )}
          </h2>
          <span className="sites-hint">הרשאות שנקבעו מפורשות על ידך יישמרו ויגברו על ברירת המחדל</span>
        </div>

        {loading ? (
          <div className="sites-loading">
            <Icon name="reload" size={24} />
            <span>טוען הרשאות אתרים...</span>
          </div>
        ) : filteredSites.length === 0 ? (
          <div className="sites-empty-card">
            <div className="empty-icon-wrap">
              <Icon name="check" size={32} />
            </div>
            <h3>אין הרשאות חורגות</h3>
            <p>
              {searchQuery || selectedCategory
                ? 'לא נמצאו אתרים התואמים את החיפוש או הסינון שנבחרו.'
                : 'כל האתרים פועלים כרגע בהתאם להגדרות ברירת המחדל המאובטחות של Chrome ו-Drift.'}
            </p>
            <button className="btn primary small" onClick={() => setShowAddModal(true)}>
              <Icon name="plus" size={14} />
              <span>הוסף הרשאה מותאמת לאתר</span>
            </button>
          </div>
        ) : (
          <div className="sites-list">
            {filteredSites.map(({ origin, kinds, count }) => {
              const isExpanded = expandedSites[origin] ?? true;
              const host = origin.replace(/^https?:\/\//i, '').replace(/\/$/, '');
              const faviconUrl = `https://www.google.com/s2/favicons?domain=${host}&sz=32`;

              return (
                <div key={origin} className={cx('site-card', isExpanded && 'expanded')}>
                  <div className="site-card-header" onClick={() => toggleExpand(origin)}>
                    <div className="site-header-left">
                      <img
                        src={faviconUrl}
                        alt=""
                        className="site-favicon"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                      <div className="site-titles">
                        <span className="site-origin">{origin}</span>
                        <span className="site-count-badge">
                          {count} {count === 1 ? 'הרשאה מוגדרת' : 'הרשאות מוגדרות'}
                        </span>
                      </div>
                    </div>

                    <div className="site-header-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="btn ghost small site-reset-btn"
                        onClick={() => handleResetSite(origin)}
                        title="אפס את כל ההרשאות לאתר זה"
                      >
                        <Icon name="reload" size={12} />
                        <span>איפוס אתר</span>
                      </button>
                      <button
                        className="btn ghost small site-clear-btn"
                        onClick={() => {
                          void cmd({ type: 'site:clearData', origin });
                          showToast(`נתוני האתר והעוגיות עבור ${origin} נוקו`);
                        }}
                        title="מחק עוגיות ונתונים מקומיים לאתר זה"
                      >
                        <Icon name="x" size={12} />
                        <span>נקה עוגיות</span>
                      </button>
                      <button className="expand-caret-btn" onClick={() => toggleExpand(origin)}>
                        <Icon name={isExpanded ? 'up' : 'down'} size={14} />
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="site-card-body">
                      <div className="site-permissions-grid">
                        {CATEGORIES.map((cat) => {
                          const currentDecision = kinds[cat.id];
                          const isConfigured = !!currentDecision;

                          return (
                            <div key={cat.id} className={cx('perm-row', isConfigured && 'configured')}>
                              <div className="perm-row-left">
                                <Icon name={cat.icon} size={15} />
                                <span className="perm-row-name">{cat.nameHe}</span>
                              </div>

                              <div className="perm-row-select-wrap">
                                <select
                                  className={cx(
                                    'perm-select',
                                    currentDecision === 'allow' && 'allowed',
                                    currentDecision === 'block' && 'blocked'
                                  )}
                                  value={currentDecision || 'ask'}
                                  onChange={(e) =>
                                    handleSetDecision(origin, cat.id, e.target.value as 'allow' | 'block' | 'ask')
                                  }
                                >
                                  <option value="ask">שאל (ברירת מחדל)</option>
                                  <option value="allow">✓ מורשה (Allow)</option>
                                  <option value="block">✕ חסום (Block)</option>
                                </select>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Add Custom Site Override Modal */}
      {showAddModal && (
        <div className="site-modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="site-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-wrap">
                <Icon name="shield" size={18} />
                <h3>הוספת הרשאה מותאמת אישית לאתר</h3>
              </div>
              <button className="modal-close-btn" onClick={() => setShowAddModal(false)}>
                <Icon name="x" size={14} />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="modal-form">
              <div className="form-group">
                <label>כתובת האתר (Domain / URL):</label>
                <input
                  type="text"
                  placeholder="https://meet.google.com או zoom.us"
                  value={addOrigin}
                  onChange={(e) => setAddOrigin(e.target.value)}
                  autoFocus
                  required
                />
                <span className="field-hint">ההרשאה תוחל על כל העמודים תחת כתובת מתחם זו.</span>
              </div>

              <div className="form-group">
                <label>סוג ההרשאה:</label>
                <select value={addKind} onChange={(e) => setAddKind(e.target.value)}>
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nameHe} ({c.nameEn})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>החלטה (סטטוס):</label>
                <div className="radio-options-row">
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="decision"
                      value="allow"
                      checked={addDecision === 'allow'}
                      onChange={() => setAddDecision('allow')}
                    />
                    <span>✓ אפשר תמיד (Allow)</span>
                  </label>
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="decision"
                      value="block"
                      checked={addDecision === 'block'}
                      onChange={() => setAddDecision('block')}
                    />
                    <span>✕ חסום תמיד (Block)</span>
                  </label>
                </div>
              </div>

              <div className="modal-actions">
                <button type="submit" className="btn primary">
                  שמור הרשאה
                </button>
                <button type="button" className="btn ghost" onClick={() => setShowAddModal(false)}>
                  ביטול
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="site-settings-toast">
          <Icon name="check" size={15} />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
