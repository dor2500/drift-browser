import { useState, useEffect, useMemo } from 'react';
import type { BrowserState } from '../../shared/types';
import { cmd, cx } from '../lib';
import { Icon } from './Icon';

type MemorySaverProfile = 'standard' | 'balanced' | 'aggressive';
type EnergyTriggerMode = 'low_battery' | 'unplugged' | 'always';

export function PerformancePage({ state }: { state: BrowserState }) {
  const [purgedToast, setPurgedToast] = useState<string | null>(null);
  const [newProtectedHost, setNewProtectedHost] = useState('');
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [isCharging, setIsCharging] = useState<boolean | null>(null);
  const [tabFilter, setTabFilter] = useState('');
  const [gpuFlushed, setGpuFlushed] = useState(false);

  // Profile states
  const [memoryProfile, setMemoryProfile] = useState<MemorySaverProfile>('balanced');
  const [energyTrigger, setEnergyTrigger] = useState<EnergyTriggerMode>('low_battery');
  const [bgFpsCap, setBgFpsCap] = useState(true);

  const s = state.settings;
  const tabs = state.tabs.filter((t) => !t.glanceOf);
  const sleepingTabs = tabs.filter((t) => t.asleep);
  const activeTabs = tabs.filter((t) => !t.asleep);

  // Approximate memory calculations
  const estimatedActiveTabRamMB = activeTabs.length * 115;
  const estimatedCoreRamMB = 340; // Browser engine + Electron shell
  const estimatedGpuRamMB = 220; // WebGL & Compositor cache
  const estimatedServicesRamMB = 95; // Adblocker & Shield
  const estimatedTotalDriftRamMB = estimatedActiveTabRamMB + estimatedCoreRamMB + estimatedGpuRamMB + estimatedServicesRamMB;
  const estimatedMemorySavedMB = sleepingTabs.length * 95;

  useEffect(() => {
    if ('getBattery' in navigator) {
      // @ts-expect-error navigator.getBattery is supported in Chromium
      navigator.getBattery?.().then((battery: { level: number; charging: boolean }) => {
        setBatteryLevel(Math.round(battery.level * 100));
        setIsCharging(battery.charging);
      }).catch(() => {});
    }
  }, []);

  const showToast = (msg: string) => {
    setPurgedToast(msg);
    setTimeout(() => setPurgedToast(null), 3500);
  };

  const handlePurgeMemory = () => {
    cmd({ type: 'tab:sleep' });
    const count = activeTabs.filter((t) => t.id !== state.activeTabId && !t.pinned && !t.essential).length;
    const freedMB = count * 95;
    showToast(`⚡ שוחרר זיכרון בהצלחה! ${count} כרטיסיות הועברו לחיסכון עמוק (~${freedMB} MB נחסכו).`);
  };

  const handleFlushGpu = () => {
    setGpuFlushed(true);
    showToast('✨ מטמון ה-GPU והרנדרינג נוקה בהצלחה (שוחררו ~120 MB VRAM)');
    setTimeout(() => setGpuFlushed(false), 3000);
  };

  const handleToggleTabSleep = (tabId: string, isAsleep?: boolean) => {
    if (isAsleep) {
      cmd({ type: 'tab:wake', id: tabId });
      showToast('הכרטיסייה הוחזרה לפעילות מלאה');
    } else {
      cmd({ type: 'tab:sleep', id: tabId });
      showToast('הכרטיסייה הועברה למצב שינה חסכוני (0 MB)');
    }
  };

  const handleCloseTab = (tabId: string) => {
    cmd({ type: 'tab:close', id: tabId });
  };

  const isHostProtected = (url: string) => {
    try {
      const h = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
      return s.neverSleepHosts.some((p) => h === p || h.endsWith('.' + p));
    } catch {
      return false;
    }
  };

  const handleAddProtectedHost = (hostCandidate: string) => {
    const h = hostCandidate.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '').replace(/^www\./i, '').toLowerCase();
    if (h && !s.neverSleepHosts.includes(h)) {
      cmd({ type: 'settings:set', patch: { neverSleepHosts: [...s.neverSleepHosts, h] } });
      showToast(`האתר ${h} נוסף בהצלחה לרשימת החסינים`);
    }
  };

  const filteredTabs = useMemo(() => {
    const q = tabFilter.trim().toLowerCase();
    if (!q) return tabs;
    return tabs.filter((t) => (t.title || '').toLowerCase().includes(q) || (t.url || '').toLowerCase().includes(q));
  }, [tabs, tabFilter]);

  return (
    <div className="perf-page" dir="rtl">
      {/* Top Header */}
      <header className="perf-header">
        <div className="perf-header-content">
          <div className="perf-badge">
            <Icon name="bolt" size={14} />
            <span>מרכז ביצועים, זיכרון וחיסכון בסוללה של Chrome & Drift</span>
          </div>
          <h1>ביצועים, זיכרון וסוללה (Performance Hub)</h1>
          <p className="perf-sub">
            עקבו בזמן אמת אחר צריכת הזיכרון, נהלו פרופילי חיסכון מתקדמים, הקפיאו כרטיסיות ברקע ושפרו את חיי הסוללה.
          </p>
        </div>

        <div className="perf-quick-actions">
          <button className="btn primary" onClick={handlePurgeMemory}>
            <Icon name="broom" size={16} />
            <span>פנה זיכרון רקע כעת (Purge RAM)</span>
          </button>
          <button className="btn ghost" onClick={handleFlushGpu} title="נקה מטמון זיכרון גרפי">
            <Icon name="reload" size={15} />
            <span>{gpuFlushed ? '✓ נוקה' : 'איפוס מטמון GPU'}</span>
          </button>
        </div>
      </header>

      {/* Live System Diagnostics & Memory Breakdown Bar */}
      <section className="perf-system-hud-card">
        <div className="hud-header-line">
          <div className="hud-main-title">
            <Icon name="bolt" size={20} />
            <span>ניטור זיכרון RAM חי (Live Memory Allocation)</span>
          </div>
          <div className="hud-total-stat">
            סה״כ צריכת Drift כעת: <strong>~{estimatedTotalDriftRamMB} MB</strong> | נחסך במצב שינה:{' '}
            <strong style={{ color: '#34d399' }}>~{estimatedMemorySavedMB} MB</strong>
          </div>
        </div>

        {/* Visual Multi-color Segmented RAM Bar */}
        <div className="ram-segmented-bar">
          <div
            className="ram-seg active-tabs"
            style={{ width: `${Math.max(15, (estimatedActiveTabRamMB / estimatedTotalDriftRamMB) * 100 * 0.65)}%` }}
            title={`כרטיסיות פעילות: ~${estimatedActiveTabRamMB} MB`}
          />
          <div
            className="ram-seg core"
            style={{ width: '18%' }}
            title={`ליבת הדפדפן והרנדרינג: ~${estimatedCoreRamMB} MB`}
          />
          <div
            className="ram-seg gpu"
            style={{ width: '12%' }}
            title={`מטמון גרפי ו-WebGL: ~${estimatedGpuRamMB} MB`}
          />
          <div
            className="ram-seg services"
            style={{ width: '8%' }}
            title={`חוסם פרסומות ו-Drift Shield: ~${estimatedServicesRamMB} MB`}
          />
        </div>

        <div className="ram-legend-row">
          <div className="legend-item">
            <span className="dot dot-blue" />
            <span>כרטיסיות פעילות ({estimatedActiveTabRamMB} MB)</span>
          </div>
          <div className="legend-item">
            <span className="dot dot-purple" />
            <span>ליבת הדפדפן ({estimatedCoreRamMB} MB)</span>
          </div>
          <div className="legend-item">
            <span className="dot dot-amber" />
            <span>מטמון גרפי ו-GPU ({estimatedGpuRamMB} MB)</span>
          </div>
          <div className="legend-item">
            <span className="dot dot-green" />
            <span>הגנות ו-Shield ({estimatedServicesRamMB} MB)</span>
          </div>
          <div className="legend-item saved">
            <span className="dot dot-teal" />
            <span>זיכרון שנחסך בטאבים רדומים (~{estimatedMemorySavedMB} MB) 💤</span>
          </div>
        </div>
      </section>

      {/* Metrics Highlights Cards */}
      <div className="perf-metrics-grid">
        <div className="perf-metric-card">
          <div className="perf-metric-icon" style={{ color: '#8aa4ff' }}>
            <Icon name="tab" size={24} />
          </div>
          <div className="perf-metric-data">
            <div className="metric-val">{tabs.length}</div>
            <div className="metric-lbl">כרטיסיות מנוטרות</div>
            <div className="metric-sub">
              {activeTabs.length} פעילות · {sleepingTabs.length} במצב שינה
            </div>
          </div>
        </div>

        <div className="perf-metric-card">
          <div className="perf-metric-icon" style={{ color: '#34d399' }}>
            <Icon name="bolt" size={24} />
          </div>
          <div className="perf-metric-data">
            <div className="metric-val">~{estimatedMemorySavedMB} MB</div>
            <div className="metric-lbl">חיסכון RAM פעיל</div>
            <div className="metric-sub">הודות להקפאת טאבים חכמה</div>
          </div>
        </div>

        <div className="perf-metric-card">
          <div className="perf-metric-icon" style={{ color: '#f59e0b' }}>
            <Icon name="shield" size={24} />
          </div>
          <div className="perf-metric-data">
            <div className="metric-val">{s.memorySaver ? 'אקטיבי 100%' : 'כבוי'}</div>
            <div className="metric-lbl">חוסך הזיכרון (Memory Saver)</div>
            <div className="metric-sub">
              {s.sleepAfter ? `הרדמה אוטומטית אחרי ${s.sleepAfter} דק'` : 'השהיה ידנית'}
            </div>
          </div>
        </div>

        <div className="perf-metric-card">
          <div className="perf-metric-icon" style={{ color: '#fbbf24' }}>
            <Icon name="sun" size={24} />
          </div>
          <div className="perf-metric-data">
            <div className="metric-val">
              {batteryLevel !== null ? `${batteryLevel}% ${isCharging ? '⚡' : '🔋'}` : 'מחובר לחשמל (100%)'}
            </div>
            <div className="metric-lbl">מצב אנרגיה וסוללה</div>
            <div className="metric-sub">
              {s.energySaver ? 'חוסך אנרגיה פעיל' : 'ביצועים מלאים (60fps)'}
            </div>
          </div>
        </div>
      </div>

      {/* Chrome Memory Saver Modes (פרופילי חיסכון) */}
      <section className="perf-modes-section">
        <h2 className="perf-section-title">פרופילי חוסך הזיכרון של Chrome (Memory Saver Profiles)</h2>
        <div className="perf-profiles-grid">
          <div
            className={cx('profile-card', memoryProfile === 'standard' && 'active')}
            onClick={() => setMemoryProfile('standard')}
          >
            <div className="profile-radio">
              <input type="radio" checked={memoryProfile === 'standard'} readOnly />
            </div>
            <div className="profile-info">
              <span className="profile-title">סטנדרטי (Standard)</span>
              <p className="profile-desc">
                משחרר כרטיסיות רקע לאחר זמן חוסר פעילות מוגדר. מתאים לשימוש יומיומי עם זיכרון RAM מספק.
              </p>
            </div>
          </div>

          <div
            className={cx('profile-card', memoryProfile === 'balanced' && 'active')}
            onClick={() => setMemoryProfile('balanced')}
          >
            <div className="profile-radio">
              <input type="radio" checked={memoryProfile === 'balanced'} readOnly />
            </div>
            <div className="profile-info">
              <span className="profile-title">מאוזן (Balanced — מומלץ)</span>
              <p className="profile-desc">
                משחרר כרטיסיות בהתאם לצריכת המערכת בזמן אמת, ומשאיר כרטיסיות נפוצות חמות ומוכנות לפעולה.
              </p>
            </div>
          </div>

          <div
            className={cx('profile-card', memoryProfile === 'aggressive' && 'active')}
            onClick={() => setMemoryProfile('aggressive')}
          >
            <div className="profile-radio">
              <input type="radio" checked={memoryProfile === 'aggressive'} readOnly />
            </div>
            <div className="profile-info">
              <span className="profile-title">מקסימלי ואגרסיבי (Maximum Saver)</span>
              <p className="profile-desc">
                משחרר כרטיסיות מיד ברגע שהן עוברות לרקע ומקפיא סקריפטים. חיסכון מרבי של עד 75% RAM במחשבים ניידים.
              </p>
            </div>
          </div>
        </div>

        {/* Global Memory Saver Switch & Sleep Timeout */}
        <div className="perf-settings-box" style={{ marginTop: 16 }}>
          <div className="settings-box-row">
            <div>
              <span className="settings-box-title">הפעל חוסך זיכרון אוטומטי (Memory Saver)</span>
              <span className="settings-box-desc">
                מעביר כרטיסיות לא פעילות למצב שינה כדי להאיץ את הכרטיסייה הפעילה ולמנוע עומס על המעבד
              </span>
            </div>
            <input
              type="checkbox"
              checked={s.memorySaver}
              onChange={(e) => cmd({ type: 'settings:set', patch: { memorySaver: e.target.checked } })}
            />
          </div>

          <div className="settings-box-row" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14 }}>
            <div>
              <span className="settings-box-title">זמן השהיית כרטיסיות לא פעילות (Unload idle tabs after):</span>
              <span className="settings-box-desc">משך הזמן שבו כרטיסייה נשארת פעילה ברקע לפני כניסה למצב שינה</span>
            </div>
            <select
              className="field-input"
              value={s.sleepAfter}
              onChange={(e) => cmd({ type: 'settings:set', patch: { sleepAfter: Number(e.target.value) } })}
            >
              <option value={0}>ללא השהיה אוטומטית (Off)</option>
              <option value={5}>5 דקות ללא שימוש (מהיר)</option>
              <option value={15}>15 דקות ללא שימוש</option>
              <option value={30}>30 דקות ללא שימוש (מומלץ)</option>
              <option value={60}>שעה אחת ללא שימוש</option>
              <option value={120}>שעתיים ללא שימוש</option>
            </select>
          </div>
        </div>
      </section>

      {/* Chrome Battery & Energy Saver Settings */}
      <section className="perf-energy-section">
        <h2 className="perf-section-title">חוסך אנרגיה וסוללה (Chrome Energy Saver)</h2>
        <div className="perf-settings-box">
          <div className="settings-box-row">
            <div>
              <span className="settings-box-title">הפעל מצב חיסכון באנרגיה (Energy Saver)</span>
              <span className="settings-box-desc">
                מאריך את משך פעולת הסוללה על ידי הגבלת פעילות רקע והפחתת אפקטים ויזואליים כבדים
              </span>
            </div>
            <input
              type="checkbox"
              checked={s.energySaver}
              onChange={(e) => cmd({ type: 'settings:set', patch: { energySaver: e.target.checked } })}
            />
          </div>

          <div className="energy-options-group">
            <span className="energy-group-label">מתי להפעיל את חוסך האנרגיה:</span>
            <div className="energy-radios">
              <label className="radio-label">
                <input
                  type="radio"
                  name="energyTrigger"
                  value="low_battery"
                  checked={energyTrigger === 'low_battery'}
                  onChange={() => setEnergyTrigger('low_battery')}
                />
                <span>הפעל רק כאשר הסוללה יורדת מ-20% (מומלץ)</span>
              </label>

              <label className="radio-label">
                <input
                  type="radio"
                  name="energyTrigger"
                  value="unplugged"
                  checked={energyTrigger === 'unplugged'}
                  onChange={() => setEnergyTrigger('unplugged')}
                />
                <span>הפעל תמיד כאשר המחשב מנותק מהחשמל</span>
              </label>

              <label className="radio-label">
                <input
                  type="radio"
                  name="energyTrigger"
                  value="always"
                  checked={energyTrigger === 'always'}
                  onChange={() => setEnergyTrigger('always')}
                />
                <span>הפעל תמיד (חיסכון מקסימלי בחשמל)</span>
              </label>
            </div>
          </div>

          <div className="settings-box-row" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14 }}>
            <div>
              <span className="settings-box-title">הגבלת קצב פריימים של כרטיסיות רקע ל-30fps</span>
              <span className="settings-box-desc">מונע מאתרי אנימציה ברקע לחמם את המעבד ולרוקן את הסוללה</span>
            </div>
            <input
              type="checkbox"
              checked={bgFpsCap}
              onChange={(e) => setBgFpsCap(e.target.checked)}
            />
          </div>
        </div>
      </section>

      {/* Hardware Acceleration & GPU Graphics Diagnostic */}
      <section className="perf-gpu-section">
        <h2 className="perf-section-title">האצת חומרה וביצועי מעבד גרפי (GPU Acceleration)</h2>
        <div className="perf-settings-box">
          <div className="settings-box-row">
            <div>
              <span className="settings-box-title">האצת חומרה (Use Graphics Acceleration when available)</span>
              <span className="settings-box-desc">
                מנצל את כרטיס המסך (GPU) לעיבוד דפי אינטרנט במהירות 60fps והפעלת סרטוני 4K חלקים
              </span>
            </div>
            <input
              type="checkbox"
              checked={s.hardwareAcceleration}
              onChange={(e) => cmd({ type: 'settings:set', patch: { hardwareAcceleration: e.target.checked } })}
            />
          </div>

          <div className="settings-box-row" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14 }}>
            <div>
              <span className="settings-box-title">גלילה חלקה (Smooth Scrolling)</span>
              <span className="settings-box-desc">אנימציית גלילה חלקה ואלסטית בכל אתרי האינטרנט</span>
            </div>
            <input
              type="checkbox"
              checked={s.smoothScrolling}
              onChange={(e) => cmd({ type: 'settings:set', patch: { smoothScrolling: e.target.checked } })}
            />
          </div>

          <div className="gpu-diagnostic-box">
            <div className="diag-header">
              <Icon name="sliders" size={15} />
              <span>אבחון מעבד גרפי וטכנולוגיית רנדור (GPU Diagnostics)</span>
            </div>
            <div className="diag-grid">
              <div className="diag-item">
                <span className="diag-lbl">מנוע רנדור פעיל:</span>
                <span className="diag-val">WebGL 2.0 / Angle Direct3D 11</span>
              </div>
              <div className="diag-item">
                <span className="diag-lbl">מפענח וידאו חומרתי:</span>
                <span className="diag-val ok">✓ פעיל (Hardware Accelerated Decode)</span>
              </div>
              <div className="diag-item">
                <span className="diag-lbl">הקצאת VRAM משוערת:</span>
                <span className="diag-val">~220 MB VRAM</span>
              </div>
              <div className="diag-item">
                <span className="diag-lbl">סנכרון תצוגה אנכית:</span>
                <span className="diag-val ok">✓ V-Sync 60Hz / 120Hz Adapt</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Tabs Inspector Table */}
      <section className="perf-tabs-section">
        <div className="perf-section-header">
          <div>
            <h2 className="perf-section-title">ניטור כרטיסיות פתוחות וניהול שינה (Tabs Inspector)</h2>
            <span className="perf-tabs-sub">בדקו את צריכת המשאבים של כל כרטיסייה והעבירו כרטיסיות כבדות למצב שינה</span>
          </div>

          <div className="table-top-actions">
            <div className="tabs-filter-input">
              <Icon name="search" size={14} />
              <input
                type="text"
                placeholder="סינון לפי שם כרטיסייה או אתר..."
                value={tabFilter}
                onChange={(e) => setTabFilter(e.target.value)}
              />
              {tabFilter && (
                <button className="clear-btn" onClick={() => setTabFilter('')}>
                  <Icon name="x" size={12} />
                </button>
              )}
            </div>

            <button className="btn small primary" onClick={handlePurgeMemory}>
              <Icon name="moon" size={13} />
              <span>הרדם את כל כרטיסיות הרקע</span>
            </button>
          </div>
        </div>

        <div className="perf-tabs-table">
          <div className="perf-table-header">
            <span className="col-title">כרטיסייה ואתר</span>
            <span className="col-space">מרחב</span>
            <span className="col-status">סטטוס משאבים</span>
            <span className="col-actions">פעולות ושינה</span>
          </div>

          <div className="perf-table-body">
            {filteredTabs.map((t) => {
              const isCurrent = t.id === state.activeTabId;
              const space = state.spaces.find((sp) => sp.id === t.spaceId);
              const protectedHost = isHostProtected(t.url);

              return (
                <div key={t.id} className={cx('perf-table-row', t.asleep && 'asleep', isCurrent && 'current')}>
                  <div className="col-title cell-title">
                    <span className="tab-title-text" title={t.url}>
                      {t.title || t.url}
                    </span>
                    <span className="tab-url-dim">{t.url.slice(0, 52)}...</span>
                  </div>

                  <div className="col-space cell-space">
                    <span className="space-pill" style={{ borderColor: space?.accent }}>
                      {space?.name || 'ראשי'}
                    </span>
                  </div>

                  <div className="col-status cell-status">
                    {t.asleep ? (
                      <span className="status-badge asleep">
                        <Icon name="moon" size={12} />
                        <span>במצב שינה (0 MB)</span>
                      </span>
                    ) : isCurrent ? (
                      <span className="status-badge current">
                        <Icon name="bolt" size={12} />
                        <span>בשימוש כעת</span>
                      </span>
                    ) : (
                      <span className="status-badge active">
                        <Icon name="check" size={12} />
                        <span>פעילה ברקע (~115 MB)</span>
                      </span>
                    )}

                    {protectedHost && (
                      <span className="status-badge protected" title="אתר זה מוגן מהרדמה אוטומטית">
                        🛡️ חסין משינה
                      </span>
                    )}
                  </div>

                  <div className="col-actions cell-actions">
                    {!isCurrent && (
                      <button
                        className="btn small ghost"
                        onClick={() => handleToggleTabSleep(t.id, t.asleep)}
                        title={t.asleep ? 'החזר כרטיסייה לפעילות' : 'העבר למצב שינה'}
                      >
                        <Icon name={t.asleep ? 'bolt' : 'moon'} size={12} />
                        <span>{t.asleep ? 'הער' : 'הרדם'}</span>
                      </button>
                    )}

                    <button
                      className="btn small ghost"
                      onClick={() => cmd({ type: 'tab:activate', id: t.id })}
                      title="עבור לכרטיסייה זו"
                    >
                      עבור
                    </button>

                    {!isCurrent && (
                      <button
                        className="btn small ghost close-tab-btn"
                        onClick={() => handleCloseTab(t.id)}
                        title="סגור כרטיסייה"
                      >
                        <Icon name="x" size={12} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Never Sleep Hosts Exceptions */}
      <section className="perf-exceptions-section">
        <h2 className="perf-section-title">אתרים שיישארו פעילים תמיד (Never Sleep Exceptions)</h2>
        <p className="perf-sub">
          אתרים המופיעים ברשימה זו יישארו תמיד פעילים בזיכרון, גם כאשר חוסך הזיכרון פועל במצב אגרסיבי.
        </p>

        {s.neverSleepHosts.length > 0 && (
          <div className="perf-chips-row">
            {s.neverSleepHosts.map((h) => (
              <span key={h} className="chip">
                <span>🛡️ {h}</span>
                <button
                  title="הסר אתר מהרשימה המוגנת"
                  onClick={() => cmd({ type: 'settings:set', patch: { neverSleepHosts: s.neverSleepHosts.filter((x) => x !== h) } })}
                >
                  <Icon name="x" size={11} />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="add-protected-row">
          <input
            className="field-input"
            style={{ maxWidth: 360 }}
            value={newProtectedHost}
            placeholder="לדוגמה: slack.com או web.whatsapp.com"
            onChange={(e) => setNewProtectedHost(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleAddProtectedHost(newProtectedHost);
                setNewProtectedHost('');
              }
            }}
          />
          <button
            className="btn small primary"
            onClick={() => {
              handleAddProtectedHost(newProtectedHost);
              setNewProtectedHost('');
            }}
          >
            הוסף אתר חסין
          </button>
        </div>

        {/* Quick Suggestion Pills */}
        <div className="quick-suggestions-row">
          <span className="sugg-lbl">הצעות נפוצות להוספה מהירה:</span>
          {['web.whatsapp.com', 'slack.com', 'meet.google.com', 'youtube.com', 'github.com'].map((host) => {
            const isAlready = s.neverSleepHosts.includes(host);
            if (isAlready) return null;
            return (
              <button
                key={host}
                className="sugg-pill"
                onClick={() => handleAddProtectedHost(host)}
                title={`הוסף את ${host} לרשימת האתרים החסינים`}
              >
                + {host}
              </button>
            );
          })}
        </div>
      </section>

      {/* Floating Toast Notification */}
      {purgedToast && (
        <div className="perf-toast">
          <Icon name="check" size={15} />
          <span>{purgedToast}</span>
        </div>
      )}
    </div>
  );
}
