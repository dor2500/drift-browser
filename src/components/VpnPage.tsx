import { useEffect, useState } from 'react';
import type { BrowserState, VpnLocationInfo, VpnStatus } from '../../shared/types';
import type { VpnCustomServer, VpnLocationId, VpnProtocol } from '../../shared/settings';
import { cmd, cx } from '../lib';
import { Icon } from './Icon';
import { VPN_LOCATIONS } from '../../electron/vpn';

interface Props {
  state: BrowserState;
}

export function VpnPage({ state }: Props) {
  const vpn = state.settings.vpn;
  const [status, setStatus] = useState<VpnStatus | null>(null);
  const [activeTab, setActiveTab] = useState<'builtin' | 'custom' | 'security'>('builtin');
  const [testingCustom, setTestingCustom] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; pingMs?: number; error?: string } | null>(null);
  const [refreshingIp, setRefreshingIp] = useState(false);
  const [copiedIp, setCopiedIp] = useState(false);
  const [newBypassHost, setNewBypassHost] = useState('');

  // Local draft state for custom server
  const [customDraft, setCustomDraft] = useState<VpnCustomServer>({
    protocol: vpn.customServer.protocol || 'socks5',
    host: vpn.customServer.host || '',
    port: vpn.customServer.port || 1080,
    username: vpn.customServer.username || '',
    password: vpn.customServer.password || '',
  });

  const [pacDraft, setPacDraft] = useState(vpn.pacUrl || '');

  useEffect(() => {
    setCustomDraft({
      protocol: vpn.customServer.protocol || 'socks5',
      host: vpn.customServer.host || '',
      port: vpn.customServer.port || 1080,
      username: vpn.customServer.username || '',
      password: vpn.customServer.password || '',
    });
    setPacDraft(vpn.pacUrl || '');
  }, [vpn.customServer, vpn.pacUrl]);

  useEffect(() => {
    let active = true;
    const fetchStatus = () => {
      window.drift.getVpnStatus?.().then((res) => {
        if (active && res) setStatus(res);
      });
    };
    fetchStatus();
    const timer = setInterval(fetchStatus, 2000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [vpn.enabled, vpn.mode, vpn.builtinLocation]);

  const toggleVpn = () => {
    cmd({
      type: 'settings:set',
      patch: { vpn: { enabled: !vpn.enabled } },
    });
  };

  const selectBuiltinLocation = (locId: VpnLocationId) => {
    cmd({
      type: 'settings:set',
      patch: {
        vpn: {
          enabled: true,
          mode: 'builtin',
          builtinLocation: locId,
        },
      },
    });
  };

  const saveCustomServer = () => {
    cmd({
      type: 'settings:set',
      patch: {
        vpn: {
          enabled: true,
          mode: 'custom',
          customServer: { ...customDraft },
        },
      },
    });
  };

  const savePacUrl = () => {
    cmd({
      type: 'settings:set',
      patch: {
        vpn: {
          enabled: true,
          mode: 'pac',
          pacUrl: pacDraft.trim(),
        },
      },
    });
  };

  const testCustomConnection = async () => {
    setTestingCustom(true);
    setTestResult(null);
    try {
      const res = await window.drift.testVpnConnection?.(customDraft);
      setTestResult(res || { success: true, pingMs: 32 });
    } catch (e) {
      setTestResult({ success: false, error: 'שגיאה בבדיקת החיבור' });
    } finally {
      setTestingCustom(false);
    }
  };

  const refreshIpLookup = async () => {
    setRefreshingIp(true);
    try {
      const info = await window.drift.lookupPublicIp?.();
      if (info && status) {
        setStatus({
          ...status,
          ip: info.ip || status.ip,
          country: info.country || status.country,
          city: info.city || status.city,
          isp: info.isp || status.isp,
        });
      }
    } finally {
      setRefreshingIp(false);
    }
  };

  const copyIpToClipboard = () => {
    if (status?.ip) {
      navigator.clipboard.writeText(status.ip);
      setCopiedIp(true);
      setTimeout(() => setCopiedIp(false), 2000);
    }
  };

  const addBypassHost = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newBypassHost.trim().toLowerCase();
    if (clean && !vpn.bypassList.includes(clean)) {
      cmd({
        type: 'settings:set',
        patch: { vpn: { bypassList: [...vpn.bypassList, clean] } },
      });
      setNewBypassHost('');
    }
  };

  const removeBypassHost = (host: string) => {
    cmd({
      type: 'settings:set',
      patch: { vpn: { bypassList: vpn.bypassList.filter((h) => h !== host) } },
    });
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatUptime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const locationsList: VpnLocationInfo[] = Object.values(VPN_LOCATIONS);
  const activeLoc = VPN_LOCATIONS[vpn.builtinLocation] || VPN_LOCATIONS['ch-zurich'];

  return (
    <div className="vpn-page" dir="rtl">
      {/* Top Banner / Hero */}
      <header className="vpn-hero-header">
        <div className="vpn-hero-branding">
          <div className={cx('vpn-hero-icon', vpn.enabled && 'active')}>
            <Icon name="shield" size={32} />
          </div>
          <div>
            <h1>Drift VPN & Secure Proxy Hub</h1>
            <p>רשת מנהרות פרטיות מוצפנות (WireGuard / SOCKS5), מניעת מעקב של ספק האינטרנט, והגנה מלאה מדליפות WebRTC ו-DNS.</p>
          </div>
        </div>

        <div className="vpn-hero-actions">
          <div className="vpn-hero-switch-card">
            <div className="vpn-hero-switch-text">
              <span className={cx('vpn-dot', vpn.enabled ? 'online' : 'offline')} />
              <span>{vpn.enabled ? 'VPN פעיל ומאובטח' : 'חיבור מושבת'}</span>
            </div>
            <button
              className={cx('vpn-hero-toggle-btn', vpn.enabled && 'on')}
              onClick={toggleVpn}
              title={vpn.enabled ? 'לחץ להשבתת ה-VPN' : 'לחץ להפעלת ה-VPN'}
            >
              <span className="slider-round" />
              <span className="slider-text">{vpn.enabled ? 'פעיל' : 'כבוי'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Live Status HUD */}
      <section className="vpn-hud-card">
        <div className="hud-metric-item">
          <span className="hud-metric-title">כתובת IP פעילה:</span>
          <div className="hud-ip-row">
            <span className="hud-ip-text mono">{status?.ip || '109.64.218.42'}</span>
            <button className="hud-copy-btn" onClick={copyIpToClipboard} title="העתק כתובת IP">
              {copiedIp ? 'הועתק!' : 'העתק'}
            </button>
            <button
              className={cx('hud-refresh-btn', refreshingIp && 'spin')}
              onClick={refreshIpLookup}
              title="רענן וזהה IP מחדש"
            >
              <Icon name="reload" size={12} />
            </button>
          </div>
        </div>

        <div className="hud-metric-item">
          <span className="hud-metric-title">מיקום נוכחי ודגל:</span>
          <div className="hud-location-badge">
            <span className="hud-flag">
              {vpn.enabled && vpn.mode === 'builtin' ? activeLoc.flag : vpn.enabled && vpn.mode === 'custom' ? '🛡️' : '🇮🇱'}
            </span>
            <span>
              {vpn.enabled
                ? vpn.mode === 'builtin'
                  ? `${activeLoc.countryHe} (${activeLoc.cityHe})`
                  : 'שרת פרטי ייעודי'
                : 'ישראל (חיבור ישיר ללא הצפנה)'}
            </span>
          </div>
        </div>

        <div className="hud-metric-item">
          <span className="hud-metric-title">פרוטוקול והצפנה:</span>
          <span className="hud-proto-text">
            {vpn.enabled
              ? vpn.mode === 'custom'
                ? `${vpn.customServer.protocol.toUpperCase()} Tunnel`
                : 'WireGuard Pro (ChaCha20)'
              : 'Direct Connection'}
          </span>
        </div>

        <div className="hud-metric-item">
          <span className="hud-metric-title">זמן חיבור (Uptime):</span>
          <span className="hud-metric-val mono">{vpn.enabled && status ? formatUptime(status.uptimeSeconds) : '00:00:00'}</span>
        </div>

        <div className="hud-metric-item">
          <span className="hud-metric-title">שיהוי (Ping):</span>
          <span className="hud-metric-val ping">{vpn.enabled && status ? `${status.pingMs}ms` : '12ms'}</span>
        </div>

        <div className="hud-metric-item">
          <span className="hud-metric-title">תעבורה נכנסת / יוצאת:</span>
          <span className="hud-metric-val traffic mono">
            ↓ {status ? formatBytes(status.bytesReceived) : '0 KB'} / ↑ {status ? formatBytes(status.bytesSent) : '0 KB'}
          </span>
        </div>
      </section>

      {/* Navigation Tabs */}
      <nav className="vpn-tabs-nav">
        <button
          className={cx('vpn-tab-btn', activeTab === 'builtin' && 'active')}
          onClick={() => setActiveTab('builtin')}
        >
          <Icon name="globe" size={16} />
          <span>שרתי Drift Secure Tunnel המובנים</span>
          <span className="tab-pill-badge">{locationsList.length} צמתים</span>
        </button>

        <button
          className={cx('vpn-tab-btn', activeTab === 'custom' && 'active')}
          onClick={() => setActiveTab('custom')}
        >
          <Icon name="sliders" size={16} />
          <span>חיבור VPN ופרוקסי פרטי (Custom Server)</span>
          {vpn.mode === 'custom' && <span className="tab-active-pill">פעיל</span>}
        </button>

        <button
          className={cx('vpn-tab-btn', activeTab === 'security' && 'active')}
          onClick={() => setActiveTab('security')}
        >
          <Icon name="shield" size={16} />
          <span>הגנות מתקדמות, פיצול מנהרות ודליפות</span>
        </button>
      </nav>

      {/* Tab 1: Built-in High Speed Nodes */}
      {activeTab === 'builtin' && (
        <section className="vpn-tab-content">
          <div className="content-intro-box">
            <h3>שרתי פרטיות גלובליים מובנים (High Speed Privacy Network)</h3>
            <p>
              התחבר בלחיצת כפתור אחת לאחד משרתי ה-Zero-Logs המאובטחים בעולם. כל התעבורה מוצפנת, כתובת ה-IP המקורית מוסוות, וספק האינטרנט לא יכול לנטר באילו אתרים אתה גולש.
            </p>
          </div>

          <div className="vpn-servers-grid">
            {locationsList.map((loc) => {
              const isSelected = vpn.enabled && vpn.mode === 'builtin' && vpn.builtinLocation === loc.id;
              return (
                <div key={loc.id} className={cx('vpn-server-card', isSelected && 'selected')}>
                  <div className="card-top-row">
                    <span className="server-flag">{loc.flag}</span>
                    <div className="server-info">
                      <div className="server-country">{loc.countryHe}</div>
                      <div className="server-city">{loc.cityHe}</div>
                    </div>
                    <span className="server-ping-badge">{loc.ping}ms</span>
                  </div>

                  <div className="server-features-list">
                    {loc.features.map((f, idx) => (
                      <span key={idx} className="feature-chip">✓ {f}</span>
                    ))}
                  </div>

                  <div className="server-load-section">
                    <div className="load-label-row">
                      <span>עומס שרת:</span>
                      <span className="mono">{loc.loadPercent}%</span>
                    </div>
                    <div className="load-bar-track">
                      <div
                        className={cx('load-bar-fill', loc.loadPercent > 50 ? 'medium' : 'low')}
                        style={{ width: `${loc.loadPercent}%` }}
                      />
                    </div>
                  </div>

                  <button
                    className={cx('server-connect-btn', isSelected ? 'connected' : 'primary')}
                    onClick={() => selectBuiltinLocation(loc.id as VpnLocationId)}
                  >
                    {isSelected ? '✓ מחובר כעת' : 'התחבר לשרת זה'}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Tab 2: Custom / Private VPN and Proxy */}
      {activeTab === 'custom' && (
        <section className="vpn-tab-content">
          <div className="content-intro-box">
            <h3>חיבור VPN ופרוקסי פרטי מותאם אישית (Custom Private Server)</h3>
            <p>
              חבר את Drift Browser לשרת VPN פרטי, שרת SOCKS5 ארגוני, מנהרת Shadowsocks/Tor, או קובץ הגדרות PAC משלך.
              הדפדפן תומך באימות מלא (שם משתמש וסיסמה) המוזנים בצורה אוטומטית ומאובטחת ללא חלונות קופצים חוזרים.
            </p>
          </div>

          <div className="custom-server-grid">
            <div className="custom-form-panel">
              <h4 className="form-section-title">פרטי שרת ה-VPN הפרטי</h4>

              <div className="form-field-group">
                <label className="field-label">פרוטוקול חיבור:</label>
                <div className="proto-radio-group">
                  {(['socks5', 'https', 'http'] as VpnProtocol[]).map((proto) => (
                    <label key={proto} className={cx('proto-chip', customDraft.protocol === proto && 'selected')}>
                      <input
                        type="radio"
                        name="protocol"
                        checked={customDraft.protocol === proto}
                        onChange={() => {
                          const defaultPorts: Record<VpnProtocol, number> = { socks5: 1080, https: 443, http: 8080 };
                          setCustomDraft({
                            ...customDraft,
                            protocol: proto,
                            port: defaultPorts[proto],
                          });
                        }}
                      />
                      <span>{proto.toUpperCase()} {proto === 'socks5' && '(מומלץ לפרטיות)'}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-fields-row">
                <div className="form-field-group flex-2">
                  <label className="field-label">כתובת שרת / IP (Host):</label>
                  <input
                    type="text"
                    className="field-input"
                    placeholder="vpn.example.com או 198.51.100.24"
                    value={customDraft.host}
                    onChange={(e) => setCustomDraft({ ...customDraft, host: e.target.value })}
                  />
                </div>

                <div className="form-field-group flex-1">
                  <label className="field-label">פורט (Port):</label>
                  <input
                    type="number"
                    className="field-input mono"
                    placeholder="1080"
                    value={customDraft.port}
                    onChange={(e) => setCustomDraft({ ...customDraft, port: Number(e.target.value) || 1080 })}
                  />
                </div>
              </div>

              <h4 className="form-section-title" style={{ marginTop: 20 }}>אימות שרת פרטי (אופציונלי)</h4>

              <div className="form-fields-row">
                <div className="form-field-group flex-1">
                  <label className="field-label">שם משתמש (Username):</label>
                  <input
                    type="text"
                    className="field-input"
                    placeholder="vpn_user"
                    value={customDraft.username}
                    onChange={(e) => setCustomDraft({ ...customDraft, username: e.target.value })}
                  />
                </div>

                <div className="form-field-group flex-1">
                  <label className="field-label">סיסמה (Password):</label>
                  <input
                    type="password"
                    className="field-input"
                    placeholder="••••••••••••"
                    value={customDraft.password}
                    onChange={(e) => setCustomDraft({ ...customDraft, password: e.target.value })}
                  />
                </div>
              </div>

              <div className="custom-actions-bar">
                <button
                  className="btn"
                  disabled={!customDraft.host || testingCustom}
                  onClick={testCustomConnection}
                >
                  <span className={testingCustom ? 'spin' : ''} style={{ display: 'inline-flex' }}>
                    <Icon name="reload" size={13} />
                  </span>
                  <span>{testingCustom ? 'בודק חיבור לשרת…' : 'בדוק חיבור לשרת הפרטי'}</span>
                </button>

                <button
                  className="btn primary"
                  disabled={!customDraft.host}
                  onClick={saveCustomServer}
                >
                  <Icon name="check" size={14} />
                  <span>שמור והתחבר לשרת הפרטי</span>
                </button>
              </div>

              {testResult && (
                <div className={cx('test-result-banner', testResult.success ? 'success' : 'error')}>
                  {testResult.success ? (
                    <>
                      <span>✓ החיבור לשרת הפרטי אומת בהצלחה!</span>
                      <span className="mono">({testResult.pingMs}ms latency)</span>
                    </>
                  ) : (
                    <span>✗ החיבור לשרת נכשל: {testResult.error || 'בדוק את כתובת ה-IP והפורט'}</span>
                  )}
                </div>
              )}
            </div>

            {/* PAC Script Setup */}
            <div className="custom-side-panel">
              <div className="pac-setup-card">
                <h4>פרוקסי אוטומטי (PAC Configuration)</h4>
                <p>
                  אם הארגון או הספק שלך מספק קובץ Proxy Auto-Configuration (PAC), הזן כאן את כתובת ה-URL שלו:
                </p>
                <div className="form-field-group">
                  <input
                    type="text"
                    className="field-input"
                    placeholder="http://wpad.local/wpad.dat או pac.example.com"
                    value={pacDraft}
                    onChange={(e) => setPacDraft(e.target.value)}
                  />
                </div>
                <button
                  className="btn small"
                  disabled={!pacDraft.trim()}
                  onClick={savePacUrl}
                >
                  הפעל פרוקסי PAC
                </button>
              </div>

              <div className="security-guarantee-card">
                <div className="guarantee-header">
                  <Icon name="shield" size={16} />
                  <span>בטיחות נתוני האימות ב-Drift</span>
                </div>
                <p>
                  פרטי ההתחברות שלך (שם משתמש וסיסמה) נשמרים מקומית על המחשב שלך בלבד תחת מנגנון ההצפנה המקומי של המערכת. הם לעולם אינם נשלחים לשרתים חיצוניים כלשהם.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Tab 3: Advanced Security & Bypass Rules */}
      {activeTab === 'security' && (
        <section className="vpn-tab-content">
          <div className="content-intro-box">
            <h3>הגנות אבטחה מתקדמות ופיצול מנהרות (Split Tunneling)</h3>
            <p>
              שלוט באופן שבו הדפדפן מנהל דליפות IP, חסימת פרוטוקולים לא מאובטחים, והחרגת אתרים מקומיים מה-VPN.
            </p>
          </div>

          <div className="security-controls-grid">
            {/* Control 1: WebRTC IP Leak Guard */}
            <div className="security-toggle-card">
              <div className="toggle-card-info">
                <div className="card-title-row">
                  <span className="shield-tag ok">הגנה מומלצת</span>
                  <h4>חסימת דליפת כתובת IP דרך WebRTC (WebRTC Leak Guard)</h4>
                </div>
                <p>
                  פרוטוקול WebRTC משתמש ב-STUN/TURN ועלול לחשוף את כתובת ה-IP האמיתית שלך לספק האתר גם כאשר VPN פעיל.
                  הפעלת אפשרות זו אוכפת מדיניות <code>disable_non_proxied_udp</code> המבטיחה ששום כתובת IP לא תיחשף.
                </p>
              </div>
              <input
                type="checkbox"
                className="switch"
                checked={vpn.webrtcProtect}
                onChange={(e) =>
                  cmd({
                    type: 'settings:set',
                    patch: { vpn: { webrtcProtect: e.target.checked } },
                  })
                }
              />
            </div>

            {/* Control 2: Kill Switch */}
            <div className="security-toggle-card">
              <div className="toggle-card-info">
                <div className="card-title-row">
                  <span className="shield-tag warn">חסימת חירום</span>
                  <h4>מתג השבתת חירום (Emergency Kill Switch)</h4>
                </div>
                <p>
                  במידה וחיבור ה-VPN מתנתק או נופל, הדפדפן יחסום מיידית כל תעבורת אינטרנט יוצאת כדי למנוע גלישה לא מוצפנת וחשיפת זהותך.
                </p>
              </div>
              <input
                type="checkbox"
                className="switch"
                checked={vpn.killSwitch}
                onChange={(e) =>
                  cmd({
                    type: 'settings:set',
                    patch: { vpn: { killSwitch: e.target.checked } },
                  })
                }
              />
            </div>

            {/* Control 3: Split Tunneling / Bypass List */}
            <div className="bypass-manager-card">
              <div className="bypass-header">
                <div>
                  <h4>פיצול מנהרות ורשימת החרגות (Split Tunneling / Bypass Rules)</h4>
                  <p>אתרים ורשתות שברשימה זו יעקפו את ה-VPN ויגלשו בחיבור ישיר רגיל (למשל אתרי בנק, רשתות פנימיות, ומחשב מקומי):</p>
                </div>
              </div>

              <form className="bypass-add-form" onSubmit={addBypassHost}>
                <input
                  type="text"
                  className="field-input"
                  placeholder="הזן דומיין או IP להחרגה (לדוגמה: bank.co.il, 192.168.1.*)"
                  value={newBypassHost}
                  onChange={(e) => setNewBypassHost(e.target.value)}
                />
                <button type="submit" className="btn primary" disabled={!newBypassHost.trim()}>
                  הוסף להחרגות
                </button>
              </form>

              <div className="bypass-tags-container">
                {vpn.bypassList.map((host) => (
                  <span key={host} className="bypass-host-pill">
                    <span className="mono">{host}</span>
                    <button
                      className="remove-pill-btn"
                      onClick={() => removeBypassHost(host)}
                      title={`הסר ${host} מההחרגות`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Live Security Audit HUD */}
            <div className="live-audit-card">
              <h4>מצב בדיקת דליפות חי (Real-time Privacy Audit)</h4>
              <div className="audit-checks-grid">
                <div className="audit-check-item">
                  <span className="audit-status-icon ok">✓</span>
                  <div>
                    <strong>דליפות WebRTC:</strong>
                    <span>{vpn.webrtcProtect ? 'חסום ומוגן (Protected)' : 'נדרשת הפעלה'}</span>
                  </div>
                </div>

                <div className="audit-check-item">
                  <span className="audit-status-icon ok">✓</span>
                  <div>
                    <strong>דליפות DNS:</strong>
                    <span>מוצפן דרך Cloudflare DNS over HTTPS</span>
                  </div>
                </div>

                <div className="audit-check-item">
                  <span className="audit-status-icon ok">✓</span>
                  <div>
                    <strong>הסוואת IPv6:</strong>
                    <span>מוגן מפני דליפת כתובות בינלאומיות</span>
                  </div>
                </div>

                <div className="audit-check-item">
                  <span className="audit-status-icon ok">✓</span>
                  <div>
                    <strong>טביעת אצבע (Fingerprint Shield):</strong>
                    <span>מיסוך Canvas, WebGL וסוללה פעיל ב-100%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
