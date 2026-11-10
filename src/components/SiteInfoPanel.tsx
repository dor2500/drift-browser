import { useEffect, useState } from 'react';
import type { BrowserState, TabState } from '../../shared/types';
import { cmd, cx } from '../lib';
import { Icon } from './Icon';

interface Props {
  activeTab?: TabState;
  state: BrowserState;
  onClose: () => void;
}

const COMMON_PERMISSIONS = [
  { kind: 'camera', labelHe: 'מצלמה (Camera)', icon: 'camera' as const },
  { kind: 'microphone', labelHe: 'מיקרופון (Microphone)', icon: 'mic' as const },
  { kind: 'geolocation', labelHe: 'מיקום גיאוגרפי (Location)', icon: 'location' as const },
  { kind: 'notifications', labelHe: 'התראות (Notifications)', icon: 'bell' as const },
];

export function SiteInfoPanel({ activeTab, state, onClose }: Props) {
  const url = activeTab?.url || '';
  const isWeb = /^https?:/i.test(url);
  const isHttps = url.startsWith('https://');
  const isInternal = url.startsWith('drift://');

  let host = '';
  let origin = '';
  try {
    if (isWeb) {
      const u = new URL(url);
      host = u.hostname.replace(/^www\./, '').toLowerCase();
      origin = u.origin;
    }
  } catch {
    // Ignore
  }

  const [sitePermissions, setSitePermissions] = useState<Record<string, 'allow' | 'block'>>({});
  const [clearing, setClearing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    if (origin && window.drift?.sitePermissions) {
      window.drift.sitePermissions().then((all) => {
        if (all && all[origin]) {
          setSitePermissions(all[origin] as Record<string, 'allow' | 'block'>);
        }
      });
    }
  }, [origin]);

  const isAdblockPaused = !!host && state.settings.adblockPaused.some((h) => host === h || host.endsWith('.' + h));
  const blockedCount = activeTab?.blocked ?? 0;

  const handleToggleAdblock = () => {
    if (!host) return;
    cmd({
      type: 'adblock:site',
      host,
      paused: !isAdblockPaused,
    });
    showToast(!isAdblockPaused ? 'חסימת פרסומות כובתה לאתר זה' : 'חסימת פרסומות הופעלה לאתר זה');
  };

  const handlePermissionChange = (kind: string, next: 'allow' | 'block' | 'ask') => {
    if (!origin) return;
    const decision = next === 'ask' ? undefined : next;
    cmd({
      type: 'permission:set',
      origin,
      kind,
      decision,
    });

    setSitePermissions((prev) => {
      const copy = { ...prev };
      if (decision) copy[kind] = decision;
      else delete copy[kind];
      return copy;
    });

    showToast(`ההרשאה עודכנה בהצלחה`);
  };

  const handleResetAllPermissions = () => {
    if (!origin) return;
    cmd({
      type: 'permission:reset',
      origin,
    });
    setSitePermissions({});
    showToast('כל ההרשאות לאתר זה אופסו לברירת המחדל');
  };

  const handleClearSiteData = () => {
    if (!origin) return;
    setClearing(true);
    cmd({
      type: 'site:clearData',
      origin,
    });
    setTimeout(() => {
      setClearing(false);
      showToast('עוגיות ונתוני האתר נמחקו בהצלחה! הדף יתרענן כעת.');
      cmd({ type: 'tab:reload', id: activeTab?.id });
      setTimeout(onClose, 800);
    }, 600);
  };

  const handleOpenPrivacySettings = () => {
    cmd({ type: 'settings:open' });
    onClose();
  };

  return (
    <div className="site-info-panel" dir="rtl">
      {/* Header */}
      <div className="site-info-header">
        <div className="site-identity-row">
          <div className={cx('site-badge-icon', isHttps ? 'secure' : isInternal ? 'internal' : 'insecure')}>
            <Icon name={isHttps ? 'lock' : isInternal ? 'shield' : 'info'} size={18} />
          </div>
          <div className="site-title-info">
            <h3 className="site-host-name">{host || (isInternal ? 'דף מערכת Drift' : 'דף נוכחי')}</h3>
            <span className="site-security-subtitle">
              {isHttps
                ? 'חיבור מוצפן ומאובטח (TLS 1.3)'
                : isInternal
                ? 'אזור מערכת פנימי ומבודד'
                : 'חיבור אינו מוצפן (HTTP)'}
            </span>
          </div>
        </div>
        <button className="site-info-close" onClick={onClose}>
          <Icon name="x" size={14} />
        </button>
      </div>

      <div className="site-info-body">
        {/* Connection Security Details */}
        <div className="site-section connection-section">
          <div className="section-head">
            <Icon name="shield" size={14} />
            <span>סטטוס הצפנה ואבטחה</span>
          </div>
          <div className="connection-card">
            {isHttps ? (
              <>
                <div className="conn-status-row ok">
                  <span className="dot-green" />
                  <strong>החיבור מאובטח ותעודת ה-SSL בתוקף</strong>
                </div>
                <p className="conn-desc">
                  המידע שאתה שולח או מקבל (כגון סיסמאות או כרטיסי אשראי) מוצפן לחלוטין ואינו חשוף לצד שלישי.
                </p>
                <div className="conn-pills">
                  <span className="conn-pill">✓ TLS 1.3</span>
                  <span className="conn-pill">✓ AES-256-GCM</span>
                  <span className="conn-pill">✓ HSTS Protected</span>
                </div>
              </>
            ) : isInternal ? (
              <div className="conn-status-row internal">
                <span className="dot-blue" />
                <span>דף מערכת פנימי מאומת — סביבה מקומית סטרילית ללא רשת חיצונית.</span>
              </div>
            ) : (
              <div className="conn-status-row warn">
                <span className="dot-red" />
                <span>חיבור אינו מאובטח. אין להזין פרטים רגישים, סיסמאות או נתוני תשלום באתר זה.</span>
              </div>
            )}
          </div>
        </div>

        {/* Drift Shield Pro Status */}
        {isWeb && (
          <div className="site-section shield-section">
            <div className="section-head">
              <Icon name="bolt" size={14} />
              <span>הגנת Drift Shield Pro לאתר זה</span>
            </div>
            <div className="shield-card">
              <div className="shield-toggle-row">
                <div className="shield-toggle-info">
                  <div className="shield-toggle-title">חסימת פרסומות ומעקבים (AdBlock)</div>
                  <div className="shield-toggle-desc">
                    {!isAdblockPaused
                      ? `פעיל · נחסמו ${blockedCount} פריטי מעקב ופרסומות בדף זה`
                      : 'מושהה עבור אתר זה בלבד'}
                  </div>
                </div>
                <button
                  className={cx('toggle-switch', !isAdblockPaused && 'on')}
                  onClick={handleToggleAdblock}
                  title="הפעל / השבת חסימת פרסומות לאתר זה"
                >
                  <span className="toggle-slider" />
                </button>
              </div>

              <div className="shield-checks-list">
                <div className="check-item">
                  <Icon name="check" size={12} />
                  <span>מיסוך טביעות אצבע (Canvas & WebGL Cloaking): פעיל</span>
                </div>
                <div className="check-item">
                  <Icon name="check" size={12} />
                  <span>שיבוש שמע (AudioContext Frequency Jitter): פעיל</span>
                </div>
                <div className="check-item">
                  <Icon name="check" size={12} />
                  <span>הפשטת פרמטרי מעקב URL (Tracking Stripper): פעיל</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Site Permissions */}
        {isWeb && (
          <div className="site-section permissions-section">
            <div className="section-head">
              <Icon name="sliders" size={14} />
              <span>הרשאות אתר (Permissions)</span>
            </div>
            <div className="permissions-list">
              {COMMON_PERMISSIONS.map((p) => {
                const current = sitePermissions[p.kind]; // 'allow' | 'block' | undefined
                return (
                  <div key={p.kind} className="perm-row">
                    <div className="perm-label-wrap">
                      <Icon name={p.icon} size={14} />
                      <span className="perm-label">{p.labelHe}</span>
                    </div>
                    <select
                      className="perm-select"
                      value={current || 'ask'}
                      onChange={(e) => handlePermissionChange(p.kind, e.target.value as 'allow' | 'block' | 'ask')}
                    >
                      <option value="allow">מותר (Allow)</option>
                      <option value="block">חסום (Block)</option>
                      <option value="ask">שאל בכל פעם (Ask)</option>
                    </select>
                  </div>
                );
              })}
            </div>
            {Object.keys(sitePermissions).length > 0 && (
              <button className="reset-perms-btn" onClick={handleResetAllPermissions}>
                <Icon name="reload" size={12} />
                <span>אפס את כל ההרשאות לאתר זה</span>
              </button>
            )}
          </div>
        )}

        {/* Cookies & Storage Clear */}
        {isWeb && (
          <div className="site-section cookies-section">
            <div className="section-head">
              <Icon name="broom" size={14} />
              <span>עוגיות ונתונים מקומיים</span>
            </div>
            <div className="cookies-card">
              <p className="cookies-desc">
                עוגיות, נתוני מטמון ואחסון מקומי נשמרים בדפדפן כדי לשמור על חיבור לאתר והעדפות.
              </p>
              <button
                className="btn small ghost clear-site-data-btn"
                onClick={handleClearSiteData}
                disabled={clearing}
              >
                <Icon name="trash" size={13} />
                <span>{clearing ? 'מנקה נתונים...' : 'נקה עוגיות ונתונים לאתר זה בלבד'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="site-info-footer">
        <button className="btn small ghost" onClick={handleOpenPrivacySettings}>
          <Icon name="gear" size={13} />
          <span>הגדרות אבטחה ופרטיות מתקדמות</span>
        </button>
        <button className="btn small primary" onClick={onClose}>
          סגור
        </button>
      </div>

      {/* Floating Toast */}
      {toastMessage && (
        <div className="site-info-toast">
          <Icon name="check" size={13} />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
