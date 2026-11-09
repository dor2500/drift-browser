import { useState, useEffect } from 'react';
import type { BrowserState } from '../../shared/types';
import { cmd, cx } from '../lib';
import { Icon } from './Icon';

export function PerformancePage({ state }: { state: BrowserState }) {
  const [purgedToast, setPurgedToast] = useState<string | null>(null);
  const [newProtectedHost, setNewProtectedHost] = useState('');
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [isCharging, setIsCharging] = useState<boolean | null>(null);

  const s = state.settings;
  const tabs = state.tabs.filter((t) => !t.glanceOf);
  const sleepingTabs = tabs.filter((t) => t.asleep);
  const activeTabs = tabs.filter((t) => !t.asleep);

  // Approximate memory saved (avg ~80MB per sleeping tab)
  const estimatedMemorySavedMB = sleepingTabs.length * 85;

  useEffect(() => {
    if ('getBattery' in navigator) {
      // @ts-expect-error navigator.getBattery is supported in Chromium
      navigator.getBattery?.().then((battery: { level: number; charging: boolean }) => {
        setBatteryLevel(Math.round(battery.level * 100));
        setIsCharging(battery.charging);
      }).catch(() => {});
    }
  }, []);

  const handlePurgeMemory = () => {
    cmd({ type: 'tab:sleep' });
    const count = activeTabs.filter((t) => t.id !== state.activeTabId && !t.pinned && !t.essential).length;
    const freedMB = count * 85;
    setPurgedToast(`שוחרר זיכרון בהצלחה! ${count} כרטיסיות הועברו לחיסכון עמוק (~${freedMB} MB נחסכו).`);
    setTimeout(() => setPurgedToast(null), 3500);
  };

  const handleToggleTabSleep = (tabId: string, isAsleep?: boolean) => {
    if (isAsleep) {
      cmd({ type: 'tab:wake', id: tabId });
    } else {
      cmd({ type: 'tab:sleep', id: tabId });
    }
  };

  const isHostProtected = (url: string) => {
    try {
      const h = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
      return s.neverSleepHosts.some((p) => h === p || h.endsWith('.' + p));
    } catch {
      return false;
    }
  };

  return (
    <div className="perf-page">
      {/* Top Header */}
      <header className="perf-header">
        <div className="perf-header-content">
          <div className="perf-badge">
            <Icon name="bolt" size={14} />
            <span>מרכז ביצועים וחיסכון בזיכרון של Drift</span>
          </div>
          <h1>ביצועים, זיכרון וסוללה (Performance & Memory)</h1>
          <p className="perf-sub">
            עקבו בזמן אמת אחר צריכת הזיכרון של הכרטיסיות, פנו משאבים בלחיצה אחת, ושפרו את מהירות המחשב וחיי הסוללה.
          </p>
        </div>

        <div className="perf-quick-actions">
          <button className="btn primary" onClick={handlePurgeMemory}>
            <Icon name="broom" size={16} />
            <span>פנה זיכרון כעת (Purge Inactive Memory)</span>
          </button>
        </div>
      </header>

      {/* Metrics Highlights Cards */}
      <div className="perf-metrics-grid">
        <div className="perf-metric-card">
          <div className="perf-metric-icon" style={{ color: '#8aa4ff' }}>
            <Icon name="tab" size={24} />
          </div>
          <div className="perf-metric-data">
            <div className="metric-val">{tabs.length}</div>
            <div className="metric-lbl">כרטיסיות פתוחות</div>
            <div className="metric-sub">
              {activeTabs.length} פעילות · {sleepingTabs.length} רדומות
            </div>
          </div>
        </div>

        <div className="perf-metric-card">
          <div className="perf-metric-icon" style={{ color: '#a6da95' }}>
            <Icon name="bolt" size={24} />
          </div>
          <div className="perf-metric-data">
            <div className="metric-val">~{estimatedMemorySavedMB} MB</div>
            <div className="metric-lbl">זיכרון RAM שנחסך</div>
            <div className="metric-sub">הודות למנגנון Memory Saver</div>
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
              {s.sleepAfter ? `הרדמה אחרי ${s.sleepAfter} דק'` : 'הרדמה מושהית'}
            </div>
          </div>
        </div>

        <div className="perf-metric-card">
          <div className="perf-metric-icon" style={{ color: '#eed49f' }}>
            <Icon name="sun" size={24} />
          </div>
          <div className="perf-metric-data">
            <div className="metric-val">
              {batteryLevel !== null ? `${batteryLevel}% ${isCharging ? '⚡' : '🔋'}` : 'מחובר לחשמל'}
            </div>
            <div className="metric-lbl">מצב אנרגיה וסוללה</div>
            <div className="metric-sub">
              {s.energySaver ? 'חוסך אנרגיה פעיל' : 'ביצועים מלאים'}
            </div>
          </div>
        </div>
      </div>

      {/* Performance Toggles Section */}
      <section className="perf-settings-section">
        <h2 className="perf-section-title">הגדרות ביצועים וחיסכון (Performance Controls)</h2>
        <div className="perf-toggles-row">
          <label className="perf-toggle-box">
            <div className="toggle-box-info">
              <span className="toggle-box-title">חוסך הזיכרון (Memory Saver)</span>
              <span className="toggle-box-desc">
                משחרר זיכרון מכרטיסיות לא פעילות ברקע כדי להאיץ את הכרטיסיות הפעילות
              </span>
            </div>
            <input
              type="checkbox"
              checked={s.memorySaver}
              onChange={(e) => cmd({ type: 'settings:set', patch: { memorySaver: e.target.checked } })}
            />
          </label>

          <label className="perf-toggle-box">
            <div className="toggle-box-info">
              <span className="toggle-box-title">חוסך האנרגיה (Energy Saver)</span>
              <span className="toggle-box-desc">
                מאריך את חיי הסוללה ע"י הגבלת קצב פריימים ואפקטים חזותיים בזמן גלישה
              </span>
            </div>
            <input
              type="checkbox"
              checked={s.energySaver}
              onChange={(e) => cmd({ type: 'settings:set', patch: { energySaver: e.target.checked } })}
            />
          </label>
        </div>

        <div className="field" style={{ marginTop: 14 }}>
          <span className="field-label">זמן השהיית כרטיסיות לא פעילות (Unload idle tabs after):</span>
          <select
            className="field-input"
            value={s.sleepAfter}
            onChange={(e) => cmd({ type: 'settings:set', patch: { sleepAfter: Number(e.target.value) } })}
          >
            <option value={0}>ללא השהיה אוטומטית (Off)</option>
            <option value={15}>15 דקות ללא שימוש</option>
            <option value={30}>30 דקות ללא שימוש (מומלץ)</option>
            <option value={60}>שעה אחת ללא שימוש</option>
            <option value={120}>שעתיים ללא שימוש</option>
          </select>
        </div>
      </section>

      {/* Interactive Tabs Inspector Table */}
      <section className="perf-tabs-section">
        <div className="perf-section-header">
          <h2 className="perf-section-title">כרטיסיות פתוחות וניטור משאבים (Tabs Inspector)</h2>
          <span className="perf-tabs-count">{tabs.length} כרטיסיות מנוטרות</span>
        </div>

        <div className="perf-tabs-table">
          <div className="perf-table-header">
            <span className="col-title">כרטיסייה</span>
            <span className="col-space">מרחב</span>
            <span className="col-status">סטטוס משאבים</span>
            <span className="col-actions">פעולות</span>
          </div>

          <div className="perf-table-body">
            {tabs.map((t) => {
              const isCurrent = t.id === state.activeTabId;
              const space = state.spaces.find((sp) => sp.id === t.spaceId);
              const protectedHost = isHostProtected(t.url);

              return (
                <div key={t.id} className={cx('perf-table-row', t.asleep && 'asleep', isCurrent && 'current')}>
                  <div className="col-title cell-title">
                    <span className="tab-title-text" title={t.url}>
                      {t.title || t.url}
                    </span>
                    <span className="tab-url-dim">{t.url.slice(0, 48)}...</span>
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
                        <span>פעילה (~85 MB)</span>
                      </span>
                    )}

                    {protectedHost && (
                      <span className="status-badge protected" title="אתר זה מוגן מהרדמה אוטומטית">
                        🛡️ חסין
                      </span>
                    )}
                  </div>

                  <div className="col-actions cell-actions">
                    {!isCurrent && (
                      <button
                        className="btn small ghost"
                        onClick={() => handleToggleTabSleep(t.id, t.asleep)}
                      >
                        <Icon name={t.asleep ? 'bolt' : 'moon'} size={12} />
                        <span>{t.asleep ? 'הער' : 'הרדם'}</span>
                      </button>
                    )}
                    <button
                      className="btn small ghost"
                      onClick={() => cmd({ type: 'tab:activate', id: t.id })}
                    >
                      עבור
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Never Sleep Hosts Exceptions */}
      <section className="perf-exceptions-section">
        <h2 className="perf-section-title">אתרים שיישארו פעילים תמיד (Never Sleep Hosts)</h2>
        <p className="perf-sub">
          אתרים ברשימה זו יישארו תמיד טעונים בזיכרון ולעולם לא יועברו למצב שינה.
        </p>

        {s.neverSleepHosts.length > 0 && (
          <div className="perf-chips-row">
            {s.neverSleepHosts.map((h) => (
              <span key={h} className="chip">
                {h}
                <button
                  title="הסר אתר"
                  onClick={() => cmd({ type: 'settings:set', patch: { neverSleepHosts: s.neverSleepHosts.filter((x) => x !== h) } })}
                >
                  <Icon name="x" size={11} />
                </button>
              </span>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 10, maxWidth: 440 }}>
          <input
            className="field-input"
            style={{ flex: 1 }}
            value={newProtectedHost}
            placeholder="לדוגמה: slack.com או web.whatsapp.com"
            onChange={(e) => setNewProtectedHost(e.target.value)}
          />
          <button
            className="btn small"
            onClick={() => {
              const h = newProtectedHost.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '').replace(/^www\./i, '').toLowerCase();
              if (h && !s.neverSleepHosts.includes(h)) {
                cmd({ type: 'settings:set', patch: { neverSleepHosts: [...s.neverSleepHosts, h] } });
              }
              setNewProtectedHost('');
            }}
          >
            הוסף אתר מוגן
          </button>
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
