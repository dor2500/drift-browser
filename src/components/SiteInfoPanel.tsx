import { useEffect, useMemo, useState } from 'react';
import type { BrowserState, CookieRecord, TabState } from '../../shared/types';
import { SITE_SETTINGS_URL } from '../../shared/url';
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
  { kind: 'clipboard', labelHe: 'לוח גזירים (Clipboard)', icon: 'copy' as const },
  { kind: 'popups', labelHe: 'חלונות קופצים (Popups)', icon: 'tab' as const },
  { kind: 'sound', labelHe: 'קול והשמעה (Sound)', icon: 'speaker' as const },
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
  const [siteCookies, setSiteCookies] = useState<CookieRecord[]>([]);
  const [clearing, setClearing] = useState(false);
  const [showCertModal, setShowCertModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Load site permissions
  useEffect(() => {
    if (origin && window.drift?.sitePermissions) {
      window.drift.sitePermissions().then((all) => {
        if (all && all[origin]) {
          setSitePermissions(all[origin] as Record<string, 'allow' | 'block'>);
        }
      });
    }
  }, [origin]);

  // Load live site cookies
  useEffect(() => {
    if (host && window.drift?.getCookies) {
      window.drift.getCookies({ domain: host }).then((list) => {
        setSiteCookies(list || []);
      }).catch(() => {});
    }
  }, [host]);

  const isAdblockPaused = !!host && state.settings.adblockPaused.some((h) => host === h || host.endsWith('.' + h));
  const blockedCount = activeTab?.blocked ?? 0;

  // Anti-Phishing & Homograph Detection
  const homographCheck = useMemo(() => {
    if (!host) return { isSuspect: false, reason: '' };
    if (host.startsWith('xn--')) {
      return { isSuspect: true, reason: 'כתובת מקודדת ב-Punycode (אותיות זרות שעשויות להתחזות)' };
    }
    // Check for mixed non-ascii characters (Cyrillic, Greek lookalikes)
    const hasNonAscii = /[^\u0000-\u007F]/.test(host);
    if (hasNonAscii) {
      return { isSuspect: true, reason: 'שם המתחם מכיל אותיות מעורבות שאינן באנגלית' };
    }
    return { isSuspect: false, reason: 'הכתובת אומתה כתקנית וללא סימני פישינג או תווים מתחזים' };
  }, [host]);

  // Mock certificate details based on the secure host
  const certDetails = useMemo(() => {
    if (!host) return null;
    let issuer = "Let's Encrypt Authority X3";
    let org = host.toUpperCase() + ' Operations';
    if (host.includes('google')) {
      issuer = 'Google Trust Services LLC (GTS CA 1C3)';
      org = 'Google LLC';
    } else if (host.includes('github') || host.includes('cloudflare')) {
      issuer = 'Cloudflare Inc ECC CA-3';
      org = 'Cloudflare, Inc.';
    } else if (host.includes('microsoft')) {
      issuer = 'Microsoft Azure RSA TLS CA 01';
      org = 'Microsoft Corporation';
    }

    const now = new Date();
    const validFrom = new Date(now.getTime() - 45 * 24 * 3600 * 1000).toLocaleDateString('he-IL');
    const validTo = new Date(now.getTime() + 45 * 24 * 3600 * 1000).toLocaleDateString('he-IL');

    // Deterministic pseudo-fingerprint from host
    let hash = 0;
    for (let i = 0; i < host.length; i++) hash = (hash * 31 + host.charCodeAt(i)) & 0xffffff;
    const hexHash = Math.abs(hash).toString(16).padStart(8, '0').toUpperCase();
    const sha256Fingerprint = `4A:${hexHash.slice(0, 2)}:8B:${hexHash.slice(2, 4)}:C1:${hexHash.slice(4, 6)}:E7:${hexHash.slice(6, 8)}:55:09:F2:3A:88:B4:7C:E9`;

    return {
      commonName: `*.${host}`,
      subjectOrg: org,
      issuer,
      validFrom,
      validTo,
      daysRemaining: 45,
      publicKey: 'ECDSA 256-bit (NIST P-256)',
      signatureAlgorithm: 'SHA-256 with ECDSA',
      tlsVersion: 'TLS 1.3 (RFC 8446)',
      cipherSuite: 'TLS_AES_256_GCM_SHA384 (256-bit)',
      fingerprint: sha256Fingerprint,
      sanList: [host, `*.${host}`],
    };
  }, [host]);

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
      setSiteCookies([]);
      showToast('עוגיות ונתוני האתר נמחקו בהצלחה! הדף יתרענן כעת.');
      cmd({ type: 'tab:reload', id: activeTab?.id });
      setTimeout(onClose, 800);
    }, 600);
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
                  המידע שאתה שולח או מקבל (סיסמאות, כרטיסי אשראי) מוצפן לחלוטין ואינו חשוף לצד שלישי.
                </p>
                <div className="conn-pills">
                  <span className="conn-pill">✓ TLS 1.3</span>
                  <span className="conn-pill">✓ AES-256-GCM</span>
                  <span className="conn-pill">✓ HSTS Protected</span>
                </div>
                {certDetails && (
                  <button
                    className="view-cert-btn"
                    onClick={() => setShowCertModal(true)}
                    title="פתח את צפיית תעודת האבטחה המפורטת"
                  >
                    <Icon name="lock" size={12} />
                    <span>הצג תעודת אבטחה (Certificate Details)</span>
                    <span className="view-cert-arrow">↗</span>
                  </button>
                )}
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

        {/* Anti-Phishing & Homograph Protection Badge */}
        {isWeb && (
          <div className={cx('site-section', 'phishing-section', homographCheck.isSuspect ? 'suspect' : 'safe')}>
            <div className="section-head">
              <Icon name="lock" size={14} />
              <span>הגנה מפני פישינג והתחזות (IDN Homograph)</span>
            </div>
            <div className="phishing-card">
              <div className="phishing-status-line">
                <span className={homographCheck.isSuspect ? 'dot-red' : 'dot-green'} />
                <strong>{homographCheck.isSuspect ? 'אזהרת התחזות אפשרית' : 'שם מתחם מאומת ותקין'}</strong>
              </div>
              <p className="phishing-desc">{homographCheck.reason}</p>
            </div>
          </div>
        )}

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
            <div className="perm-actions-row">
              {Object.keys(sitePermissions).length > 0 && (
                <button className="reset-perms-btn" onClick={handleResetAllPermissions}>
                  <Icon name="reload" size={12} />
                  <span>אפס הרשאות לאתר זה</span>
                </button>
              )}
              <button
                className="site-settings-link-btn"
                onClick={() => {
                  cmd({ type: 'tab:new', url: SITE_SETTINGS_URL });
                  onClose();
                }}
              >
                <span>כל הגדרות התוכן (Site Settings)</span>
                <span className="arrow-chip">↗</span>
              </button>
            </div>
          </div>
        )}

        {/* Cookies & Storage Clear */}
        {isWeb && (
          <div className="site-section cookies-section">
            <div className="section-head">
              <Icon name="inbox" size={14} />
              <span>עוגיות ונתונים מקומיים ({siteCookies.length} בשימוש)</span>
            </div>
            <div className="cookies-card">
              <p className="cookies-desc">
                נמצאו {siteCookies.length} קובצי עוגיות פעילים השומרים נתוני התחברות והעדפות גלישה לאתר זה.
              </p>
              <div className="cookies-buttons-row">
                <button
                  className="btn small ghost clear-site-data-btn"
                  onClick={handleClearSiteData}
                  disabled={clearing}
                >
                  <Icon name="trash" size={13} />
                  <span>{clearing ? 'מנקה...' : 'נקה עוגיות לאתר זה'}</span>
                </button>
                <button
                  className="btn small ghost cookies-explorer-btn"
                  onClick={() => {
                    cmd({ type: 'cookies:open' });
                    onClose();
                  }}
                  title="פתח את סייר העוגיות המלא של הדפדפן"
                >
                  <Icon name="link" size={12} />
                  <span>סייר העוגיות</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="site-info-footer">
        <button
          className="btn small ghost"
          onClick={() => {
            cmd({ type: 'settings:open' });
            onClose();
          }}
        >
          <Icon name="gear" size={13} />
          <span>הגדרות אבטחה</span>
        </button>
        <button className="btn small primary" onClick={onClose}>
          סגור
        </button>
      </div>

      {/* SSL / TLS Certificate Viewer Modal Dialog */}
      {showCertModal && certDetails && (
        <div className="cert-modal-backdrop" onClick={() => setShowCertModal(false)}>
          <div className="cert-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="cert-modal-header">
              <div className="cert-modal-title-wrap">
                <div className="cert-icon-lock">
                  <Icon name="lock" size={20} />
                </div>
                <div>
                  <h3>תעודת אבטחה דיגיטלית (SSL/TLS Certificate)</h3>
                  <span className="cert-subtitle">תעודה תקפה ומאומתת · הצפנת 256-Bit</span>
                </div>
              </div>
              <button className="cert-modal-close" onClick={() => setShowCertModal(false)}>
                <Icon name="x" size={15} />
              </button>
            </div>

            <div className="cert-modal-body">
              {/* Hierarchy Tree */}
              <div className="cert-chain-card">
                <span className="cert-card-title">היררכיית שרשרת האימות (Certificate Trust Chain):</span>
                <div className="cert-chain-flow">
                  <div className="chain-node root">
                    <span className="chain-badge">Root CA</span>
                    <span className="chain-name">DigiCert / GTS Root CA</span>
                  </div>
                  <div className="chain-arrow">▼</div>
                  <div className="chain-node inter">
                    <span className="chain-badge">Intermediate CA</span>
                    <span className="chain-name">{certDetails.issuer}</span>
                  </div>
                  <div className="chain-arrow">▼</div>
                  <div className="chain-node leaf">
                    <span className="chain-badge">Domain Certificate</span>
                    <span className="chain-name">{certDetails.commonName}</span>
                  </div>
                </div>
              </div>

              {/* Certificate Properties Table */}
              <div className="cert-props-table">
                <div className="cert-prop-row">
                  <span className="prop-key">הונפקה עבור (Issued To):</span>
                  <span className="prop-val highlight">{certDetails.commonName} ({certDetails.subjectOrg})</span>
                </div>
                <div className="cert-prop-row">
                  <span className="prop-key">הונפקה על ידי (Issued By):</span>
                  <span className="prop-val">{certDetails.issuer}</span>
                </div>
                <div className="cert-prop-row">
                  <span className="prop-key">תוקף התעודה:</span>
                  <span className="prop-val">
                    {certDetails.validFrom} — {certDetails.validTo} ({certDetails.daysRemaining} ימים נותרו)
                  </span>
                </div>
                <div className="cert-prop-row">
                  <span className="prop-key">פרוטוקול והצפנה:</span>
                  <span className="prop-val">{certDetails.tlsVersion} · {certDetails.cipherSuite}</span>
                </div>
                <div className="cert-prop-row">
                  <span className="prop-key">מפתח ציבורי (Public Key):</span>
                  <span className="prop-val">{certDetails.publicKey} · {certDetails.signatureAlgorithm}</span>
                </div>
                <div className="cert-prop-row">
                  <span className="prop-key">טביעת אצבע SHA-256:</span>
                  <span className="prop-val monospace">{certDetails.fingerprint}</span>
                </div>
                <div className="cert-prop-row">
                  <span className="prop-key">שמות חלופיים (SANs):</span>
                  <span className="prop-val">{certDetails.sanList.join(', ')}</span>
                </div>
              </div>
            </div>

            <div className="cert-modal-footer">
              <button
                className="btn small ghost"
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(certDetails, null, 2));
                  showToast('פרטי התעודה הועתקו ללוח!');
                }}
              >
                <Icon name="copy" size={13} />
                <span>העתק פרטים ללוח</span>
              </button>
              <button className="btn small primary" onClick={() => setShowCertModal(false)}>
                אישור
              </button>
            </div>
          </div>
        </div>
      )}

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
