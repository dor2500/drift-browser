import { useEffect, useMemo, useState } from 'react';
import type { BrowserState, InstalledExtension } from '../../shared/types';
import { cmd, cx } from '../lib';
import { Icon } from './Icon';

export function ExtensionsPage({ state: _state }: { state: BrowserState }) {
  const [extensions, setExtensions] = useState<InstalledExtension[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'enabled' | 'disabled' | 'builtin' | 'external'>('all');
  const [developerMode, setDeveloperMode] = useState<boolean>(() => {
    return localStorage.getItem('drift_extensions_dev_mode') === 'true';
  });

  // Selected extension for Details modal
  const [selectedDetails, setSelectedDetails] = useState<InstalledExtension | null>(null);
  const [extensionToDelete, setExtensionToDelete] = useState<InstalledExtension | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const loadExtensions = async () => {
    try {
      setLoading(true);
      const list = await window.drift.getExtensions();
      setExtensions(list || []);
    } catch (e) {
      console.error('Failed to load extensions:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadExtensions();
  }, []);

  const handleToggleDevMode = (val: boolean) => {
    setDeveloperMode(val);
    localStorage.setItem('drift_extensions_dev_mode', String(val));
    showToast(val ? 'מצב מפתח הופעל' : 'מצב מפתח כובה');
  };

  const handleToggleExtension = async (ext: InstalledExtension) => {
    const nextState = !ext.enabled;
    await window.drift.toggleExtension(ext.id, nextState);
    setExtensions((prev) => prev.map((item) => (item.id === ext.id ? { ...item, enabled: nextState } : item)));
    showToast(`התוסף "${ext.name}" ${nextState ? 'הופעל' : 'הושבת'}`);
  };

  const handleLoadUnpacked = async () => {
    const loaded = await window.drift.loadUnpackedExtension();
    if (loaded) {
      showToast(`התוסף "${loaded.name}" נטען בהצלחה!`);
      await loadExtensions();
    }
  };

  const handleConfirmDelete = async () => {
    if (!extensionToDelete) return;
    await window.drift.removeExtension(extensionToDelete.id);
    showToast(`התוסף "${extensionToDelete.name}" הוסר בהצלחה`);
    setExtensionToDelete(null);
    if (selectedDetails?.id === extensionToDelete.id) {
      setSelectedDetails(null);
    }
    await loadExtensions();
  };

  const handleUpdateSetting = async (
    extId: string,
    key: 'allowIncognito' | 'allowFileAccess' | 'siteAccess',
    value: boolean | 'all' | 'onclick' | 'specific'
  ) => {
    await window.drift.updateExtensionSettings(extId, { [key]: value });
    setExtensions((prev) =>
      prev.map((item) => (item.id === extId ? { ...item, [key]: value } : item))
    );
    if (selectedDetails && selectedDetails.id === extId) {
      setSelectedDetails({ ...selectedDetails, [key]: value });
    }
    showToast('הגדרות התוסף עודכנו');
  };

  const filteredExtensions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return extensions.filter((ext) => {
      if (filterType === 'enabled' && !ext.enabled) return false;
      if (filterType === 'disabled' && ext.enabled) return false;
      if (filterType === 'builtin' && !ext.isBuiltIn) return false;
      if (filterType === 'external' && ext.isBuiltIn) return false;

      if (q) {
        return (
          ext.name.toLowerCase().includes(q) ||
          ext.description.toLowerCase().includes(q) ||
          ext.id.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [extensions, searchQuery, filterType]);

  const stats = useMemo(() => {
    const total = extensions.length;
    const enabled = extensions.filter((e) => e.enabled).length;
    const builtin = extensions.filter((e) => e.isBuiltIn).length;
    const external = total - builtin;
    return { total, enabled, builtin, external };
  }, [extensions]);

  return (
    <div className="extensions-page">
      {/* Toast */}
      {toastMessage && (
        <div className="extensions-toast">
          <Icon name="check" size={16} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Chrome Bar */}
      <header className="extensions-chrome-bar">
        <div className="chrome-bar-start">
          <div className="ext-icon-box">
            <Icon name="puzzle" size={20} />
          </div>
          <h2>תוספים (Extensions)</h2>
        </div>

        <div className="chrome-bar-search">
          <Icon name="search" size={16} />
          <input
            type="text"
            placeholder="חיפוש בתוספים מותקנים..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="btn-clear-search" onClick={() => setSearchQuery('')}>
              <Icon name="x" size={14} />
            </button>
          )}
        </div>

        <div className="chrome-bar-devmode">
          <label className="devmode-switch-wrap">
            <span className="devmode-label">מצב מפתח (Developer mode)</span>
            <input
              type="checkbox"
              className="switch"
              checked={developerMode}
              onChange={(e) => handleToggleDevMode(e.target.checked)}
            />
          </label>
        </div>
      </header>

      {/* Developer Mode Sub-bar */}
      {developerMode && (
        <div className="devmode-sub-bar">
          <div className="devmode-buttons">
            <button className="btn primary small" onClick={handleLoadUnpacked}>
              <Icon name="import" size={14} />
              <span>טען תוסף לא ארוז (Load unpacked)</span>
            </button>
            <button
              className="btn ghost small"
              onClick={() => showToast('אריזת תוסף זמינה דרך טעינת תיקייה')}
            >
              <Icon name="inbox" size={14} />
              <span>ארוז תוסף (Pack extension)</span>
            </button>
            <button className="btn ghost small" onClick={loadExtensions}>
              <Icon name="reload" size={14} />
              <span>עדכן תוספים (Update)</span>
            </button>
          </div>
          <span className="devmode-notice">
            מצב מפתח פעיל: באפשרותך לטעון תוספי Manifest V3/V2 ישירות מתיקיית מקור במחשב
          </span>
        </div>
      )}

      {/* Filter Tabs Bar */}
      <div className="extensions-filter-bar">
        <div className="filter-pills">
          <button
            className={cx('f-pill', filterType === 'all' && 'active')}
            onClick={() => setFilterType('all')}
          >
            הכל ({stats.total})
          </button>
          <button
            className={cx('f-pill', filterType === 'enabled' && 'active')}
            onClick={() => setFilterType('enabled')}
          >
            פעילים ({stats.enabled})
          </button>
          <button
            className={cx('f-pill', filterType === 'disabled' && 'active')}
            onClick={() => setFilterType('disabled')}
          >
            מושבתים ({stats.total - stats.enabled})
          </button>
          <button
            className={cx('f-pill', filterType === 'builtin' && 'active')}
            onClick={() => setFilterType('builtin')}
          >
            מקוריים של Drift ({stats.builtin})
          </button>
          {stats.external > 0 && (
            <button
              className={cx('f-pill', filterType === 'external' && 'active')}
              onClick={() => setFilterType('external')}
            >
              חיצוניים לא ארוזים ({stats.external})
            </button>
          )}
        </div>

        <button className="btn-store-link" onClick={() => cmd({ type: 'store:open' })}>
          <Icon name="sparkles" size={14} />
          <span>פתח את חנות התוספים (Drift Store)</span>
        </button>
      </div>

      {/* Extensions Grid */}
      <div className="extensions-content">
        {loading ? (
          <div className="extensions-loading">
            <Icon name="reload" size={24} />
            <span>טוען תוספים...</span>
          </div>
        ) : filteredExtensions.length === 0 ? (
          <div className="extensions-empty">
            <div className="empty-puzzle-box">
              <Icon name="puzzle" size={36} />
            </div>
            <h3>לא נמצאו תוספים</h3>
            <p>
              {searchQuery
                ? `לא נמצאו תוספים התואמים לחיפוש "${searchQuery}".`
                : 'אין תוספים בקטגוריה זו כרגע.'}
            </p>
            <button className="btn primary" onClick={() => cmd({ type: 'store:open' })}>
              גלה תוספים בחנות Drift Store
            </button>
          </div>
        ) : (
          <div className="extensions-grid">
            {filteredExtensions.map((ext) => (
              <div key={ext.id} className={cx('extension-card', !ext.enabled && 'disabled')}>
                <div className="card-top-row">
                  <div className="ext-card-icon">
                    <Icon name={ext.isBuiltIn ? 'shield' : 'puzzle'} size={24} />
                  </div>
                  <div className="ext-card-titles">
                    <div className="ext-name-line">
                      <strong className="ext-title">{ext.name}</strong>
                      <span className="ext-ver-pill">v{ext.version}</span>
                    </div>
                    <div className="ext-badges-line">
                      {ext.isBuiltIn ? (
                        <span className="badge official">מקורי Drift</span>
                      ) : (
                        <span className="badge unpacked">לא ארוז (Unpacked)</span>
                      )}
                      <span className="badge-id" title="מזהה תוסף">
                        ID: {ext.id}
                      </span>
                    </div>
                  </div>
                </div>

                <p className="ext-card-desc">{ext.description}</p>

                {/* Inspect Views & ID (Developer mode) */}
                {developerMode && (
                  <div className="ext-dev-info">
                    {ext.path && (
                      <div className="dev-path-row" title={ext.path}>
                        <span>נתיב מקור:</span>
                        <code>{ext.path}</code>
                      </div>
                    )}
                    <div className="dev-inspect-row">
                      <span>תצוגות פיקוח:</span>
                      <a href="#" onClick={(e) => { e.preventDefault(); showToast('Service Worker פעיל ברקע'); }}>
                        Service Worker
                      </a>
                    </div>
                  </div>
                )}

                {/* Bottom Actions */}
                <div className="card-bottom-actions">
                  <div className="card-action-buttons">
                    <button className="btn ghost small" onClick={() => setSelectedDetails(ext)}>
                      פרטים
                    </button>
                    {!ext.isBuiltIn && (
                      <button
                        className="btn danger-ghost small"
                        onClick={() => setExtensionToDelete(ext)}
                      >
                        הסר
                      </button>
                    )}
                    {ext.isBuiltIn && (
                      <button className="btn ghost small" onClick={() => cmd({ type: 'store:open' })}>
                        בחנות
                      </button>
                    )}
                  </div>

                  <div className="card-toggle-wrap">
                    <input
                      type="checkbox"
                      className="switch"
                      checked={ext.enabled}
                      onChange={() => handleToggleExtension(ext)}
                      title={ext.enabled ? 'השבת תוסף' : 'הפעל תוסף'}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* DETAILS MODAL (Full Chrome Extension Details) */}
      {selectedDetails && (
        <div className="modal-backdrop" onClick={() => setSelectedDetails(null)}>
          <div className="modal-content ext-details-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-with-icon">
                <Icon name={selectedDetails.isBuiltIn ? 'shield' : 'puzzle'} size={20} />
                <h3>{selectedDetails.name}</h3>
              </div>
              <button className="btn-icon" onClick={() => setSelectedDetails(null)}>
                <Icon name="x" size={16} />
              </button>
            </div>

            <div className="modal-body details-body">
              <div className="detail-meta-grid">
                <div className="meta-item">
                  <span className="meta-label">גרסה (Version):</span>
                  <span className="meta-value">{selectedDetails.version}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">מזהה (Extension ID):</span>
                  <span className="meta-value mono">{selectedDetails.id}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">סוג:</span>
                  <span className="meta-value">{selectedDetails.isBuiltIn ? 'תוסף ליבה מובנה' : 'תוסף כרום טעון'}</span>
                </div>
                {selectedDetails.path && (
                  <div className="meta-item full">
                    <span className="meta-label">נתיב טעינה מקומי:</span>
                    <span className="meta-value mono">{selectedDetails.path}</span>
                  </div>
                )}
              </div>

              <div className="details-section">
                <h4>תיאור</h4>
                <p className="details-desc-text">{selectedDetails.description}</p>
              </div>

              <div className="details-section">
                <h4>הרשאות (Permissions)</h4>
                <div className="permissions-chips">
                  {(selectedDetails.permissions || ['storage', 'tabs']).map((perm) => (
                    <span key={perm} className="perm-chip">
                      <Icon name="check" size={11} />
                      <span>{perm}</span>
                    </span>
                  ))}
                </div>
              </div>

              <div className="details-section">
                <h4>גישה לאתרים (Site Access)</h4>
                <div className="site-access-options">
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="siteAccess"
                      checked={selectedDetails.siteAccess === 'onclick'}
                      onChange={() => handleUpdateSetting(selectedDetails.id, 'siteAccess', 'onclick')}
                    />
                    <span>בעת לחיצה על התוסף בלבד (On click)</span>
                  </label>
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="siteAccess"
                      checked={selectedDetails.siteAccess === 'all' || !selectedDetails.siteAccess}
                      onChange={() => handleUpdateSetting(selectedDetails.id, 'siteAccess', 'all')}
                    />
                    <span>בכל האתרים (On all sites)</span>
                  </label>
                </div>
              </div>

              <div className="details-section toggles-section">
                <div className="details-toggle-row">
                  <div>
                    <strong>אפשר בגלישה בסתר (Allow in Incognito)</strong>
                    <div className="hint-text">מאפשר לתוסף זה לרוץ גם בחלונות גלישה בסתר</div>
                  </div>
                  <input
                    type="checkbox"
                    className="switch"
                    checked={!!selectedDetails.allowIncognito}
                    onChange={(e) => handleUpdateSetting(selectedDetails.id, 'allowIncognito', e.target.checked)}
                  />
                </div>

                <div className="details-toggle-row">
                  <div>
                    <strong>אפשר גישה לכתובות אתר של קבצים (Allow access to file URLs)</strong>
                    <div className="hint-text">מאפשר לתוסף לרוץ על קובצי `file:///` מקומיים</div>
                  </div>
                  <input
                    type="checkbox"
                    className="switch"
                    checked={selectedDetails.allowFileAccess ?? true}
                    onChange={(e) => handleUpdateSetting(selectedDetails.id, 'allowFileAccess', e.target.checked)}
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              {!selectedDetails.isBuiltIn && (
                <button
                  className="btn danger-ghost"
                  onClick={() => {
                    setExtensionToDelete(selectedDetails);
                  }}
                >
                  הסר תוסף
                </button>
              )}
              <button className="btn primary" onClick={() => setSelectedDetails(null)}>
                סגור
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      {extensionToDelete && (
        <div className="modal-backdrop" onClick={() => setExtensionToDelete(null)}>
          <div className="modal-content confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>הסרת תוסף</h3>
              <button className="btn-icon" onClick={() => setExtensionToDelete(null)}>
                <Icon name="x" size={16} />
              </button>
            </div>
            <div className="modal-body">
              <p>האם ברצונך להסיר את התוסף <strong>"{extensionToDelete.name}"</strong>?</p>
              <p className="modal-hint">התוסף יוסר לחלוטין מ-Drift Browser. תוכל לטעון אותו שוב בכל עת.</p>
            </div>
            <div className="modal-footer">
              <button className="btn ghost" onClick={() => setExtensionToDelete(null)}>
                ביטול
              </button>
              <button className="btn danger" onClick={handleConfirmDelete}>
                הסר תוסף
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
