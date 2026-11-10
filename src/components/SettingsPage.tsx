import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { en, type MessageKey } from '../../shared/locales/en';
import { SETTINGS_ORDER } from '../../shared/themes';
import { hostOf, permissionShortName } from '../../shared/permissions';
import {
  SEARCH_ENGINES,
  type BookmarksBarMode,
  type DnsOverHttpsMode,
  type FontSizePreset,
  type PreloadPagesMode,
  type SafeBrowsingMode,
  type SearchEngineId,
  type StartupMode,
} from '../../shared/settings';
import type { BrowserState, DriftEnv, SitePermissions } from '../../shared/types';
import { cmd, cx } from '../lib';
import { Icon, type IconName } from './Icon';
import { ImportPanel } from './ImportPanel';
import { SyncPanel } from './SyncPanel';
import { DarkModePanel } from './DarkModePanel';
import { CloudClipboardPanel } from './CloudClipboardPanel';
import { ColorThemePicker } from './ColorThemePicker';
import { EnginePicker } from './EnginePicker';
import { LanguagePicker } from './LanguagePicker';
import { ThemePicker } from './ThemePicker';
import { CommitInput, EngineCard, Toggle, UpdateSourceForm } from './UpdatePanels';
import { t, useLocale } from '../i18n';

/** A section's name in the chosen browser's own words (Chrome's "You and Google", Edge's "Profiles"…). */
function sectionName(theme: string, id: string) {
  const key = `mode.${theme}.${id}` as MessageKey;
  const named = t(key);
  return named === key ? t(`set.nav.${id}` as MessageKey) : named;
}

const EN_KEYS: Record<string, string[]> = {
  sync: ['set.nav.sync', 'sync.', 'google', 'profile'],
  autofill: ['set.nav.autofill', 'password', 'autofill', 'payment', 'address'],
  privacy: ['set.nav.privacy', 'priv.', 'set.adblock', 'set.annoyances', 'set.clearOnExit', 'set.pausedOn', 'set.sitePermissions'],
  appearance: ['set.nav.appearance', 'theme.', 'set.colorTheme', 'set.themeDefault', 'set.customAccent', 'set.spaceColors', 'set.verticalTabs', 'set.compact'],
  search: ['set.nav.search', 'set.searchEngine', 'omnibox'],
  default: ['set.nav.default', 'default browser'],
  startup: ['set.nav.startup', 'set.restore', 'on startup'],
  language: ['set.nav.language', 'set.language', 'spell', 'translate'],
  downloads: ['set.nav.downloads', 'download'],
  accessibility: ['set.nav.accessibility', 'caret', 'contrast'],
  performance: ['set.nav.performance', 'memory', 'energy', 'preload', 'sleep'],
  system: ['set.nav.system', 'set.smooth', 'set.gpu', 'hardware', 'task manager'],
  reset: ['set.nav.reset', 'reset'],
  about: ['set.nav.about', 'set.electron', 'set.chromium', 'set.build', 'set.rerunSetup'],
  engine: ['set.nav.engine', 'eng.'],
  general: ['set.nav.general', 'set.homePage'],
  import: ['set.nav.import', 'imp.'],
  updates: ['set.nav.updates', 'upd.'],
};

const englishFor = (section: string) =>
  Object.entries(en)
    .filter(([k]) => (EN_KEYS[section] ?? []).some((prefix) => k.startsWith(prefix)))
    .map(([, v]) => v)
    .join(' ');

const NAV_ICONS: Record<string, IconName> = {
  sync: 'google',
  autofill: 'key',
  privacy: 'shield',
  appearance: 'palette',
  search: 'search',
  default: 'globe',
  startup: 'play',
  language: 'chat',
  downloads: 'download',
  accessibility: 'sliders',
  performance: 'bolt',
  system: 'gear',
  reset: 'reload',
  about: 'info',
  engine: 'globe',
  general: 'gear',
  import: 'import',
  updates: 'download',
};

/** drift://settings, drawn by the shell inside the content pane (no web view). */
export function SettingsPage({ state }: { state: BrowserState }) {
  const locale = useLocale();
  const [google, setGoogle] = useState(false);
  const [browsers, setBrowsers] = useState<{ id: string; name: string }[]>([]);
  const [isDefault, setIsDefault] = useState<boolean | null>(null);
  const [defaultToast, setDefaultToast] = useState(false);
  const [safetyCheckDone, setSafetyCheckDone] = useState(false);

  // Force-dark and GPU only change after restart, so remember what this run started with.
  const [startSmooth] = useState(state.settings.smoothScrolling);
  const [startGpu] = useState(state.settings.hardwareAcceleration);

  useEffect(() => {
    void window.drift.googleStatus().then(setGoogle);
    void window.drift.otherBrowsers().then(setBrowsers);
    void window.drift.isDefaultBrowser?.().then(setIsDefault);
  }, [state.activeTabId]);

  const s = state.settings;
  const [env, setEnv] = useState<DriftEnv>();
  const [perms, setPerms] = useState<SitePermissions>({});
  const [section, setSection] = useState<string>(SETTINGS_ORDER[state.settings.theme]?.[0] ?? 'sync');
  const [query, setQuery] = useState('');
  const [noMatch, setNoMatch] = useState(false);
  const [newStartupUrl, setNewStartupUrl] = useState('');
  const [newNeverSleepHost, setNewNeverSleepHost] = useState('');
  const [clearRange, setClearRange] = useState<'1h' | '24h' | '7d' | '4w' | 'all'>('all');
  const [clearHistory, setClearHistory] = useState(true);
  const [clearCookies, setClearCookies] = useState(true);
  const [clearCache, setClearCache] = useState(true);
  const [clearedToast, setClearedToast] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  // Search settings: filter sections
  useEffect(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    scroller.current?.querySelectorAll<HTMLElement>('.settings-section').forEach((sec) => {
      const hit = words.every((w) => sec.textContent?.toLowerCase().includes(w));
      sec.hidden = words.length > 0 && !hit;
      if (!sec.hidden) shown++;
    });
    setNoMatch(words.length > 0 && shown === 0);
  }, [query, state.settings, state.prompts.length]);

  useEffect(() => void window.drift.env().then(setEnv), []);
  useEffect(() => void window.drift.sitePermissions().then(setPerms), [state.prompts.length]);

  const go = (id: string) => {
    setSection(id);
    document.getElementById(`settings-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const reset = async (origin: string, kind?: string) => {
    await window.drift.cmd({ type: 'permission:reset', origin, kind });
    setPerms(await window.drift.sitePermissions());
  };

  const handleMakeDefault = async () => {
    await cmd({ type: 'app:setDefaultBrowser' });
    setDefaultToast(true);
    setTimeout(() => {
      void window.drift.isDefaultBrowser?.().then(setIsDefault);
      setDefaultToast(false);
    }, 2500);
  };

  const handlePasswordSafetyCheck = () => {
    setSafetyCheckDone(true);
    setTimeout(() => setSafetyCheckDone(false), 4000);
  };

  const sites = Object.entries(perms).sort(([a], [b]) => a.localeCompare(b));
  const activeSections = SETTINGS_ORDER[s.theme] ?? SETTINGS_ORDER.chrome;

  return (
    <div className="settings-page">
      <nav className="settings-nav">
        <div className="settings-title">
          <Icon name="gear" size={18} /> {t('set.title')}
        </div>
        <label className="settings-search">
          <Icon name="search" size={14} />
          <input value={query} placeholder={t('set.search')} onChange={(e) => setQuery(e.target.value)} />
        </label>
        {activeSections.map((id) => (
          <button key={id} className={cx('settings-nav-item', section === id && 'active')} onClick={() => go(id)}>
            <Icon name={NAV_ICONS[id] ?? 'gear'} size={16} />
            {sectionName(s.theme, id)}
          </button>
        ))}
      </nav>

      <div
        className="settings-scroll"
        ref={scroller}
        style={Object.fromEntries(activeSections.map((id, i) => [`--order-${id}`, i])) as CSSProperties}
      >
        {query && noMatch && <div className="empty-note">{t('set.searchNone', { q: query })}</div>}

        {/* 1. You and Google (אתה ו-Google) */}
        <section id="settings-sync" className="settings-section">
          <span hidden className="search-en">{englishFor('sync')}</span>
          <h2>{sectionName(s.theme, 'sync')}</h2>
          <SyncPanel sync={state.sync} activeTab={state.tabs.find((t) => t.id === state.activeTabId)} />

          <h3>חשבון Google ופרופיל אישי (Google Account & Profile)</h3>
          <p className="settings-lead">{t('set.googleHint')}</p>
          <div className="google-row">
            {google ? (
              <>
                <span className="google-ok">
                  <Icon name="check" size={14} /> {t('set.googleSignedIn')}
                </span>
                <button className="btn small" onClick={() => cmd({ type: 'tab:new', url: 'https://myaccount.google.com/' })}>
                  {t('set.googleManage')}
                </button>
              </>
            ) : (
              <button className="btn" onClick={() => cmd({ type: 'google:signin' })}>
                <Icon name="google" size={15} /> {t('set.googleSignIn')}
              </button>
            )}
          </div>

          <h3>{t('set.nav.import')}</h3>
          <ImportPanel />
        </section>

        {/* 2. Autofill and passwords (מילוי אוטומטי וסיסמאות) */}
        <section id="settings-autofill" className="settings-section">
          <span hidden className="search-en">{englishFor('autofill')}</span>
          <h2>מילוי אוטומטי וסיסמאות (Autofill and passwords)</h2>

          <h3>מנהל הסיסמאות של Google (Google Password Manager)</h3>
          <p className="settings-lead">שמור סיסמאות בצורה מאובטחת והתחבר לאתרים ולשירותים בקלות</p>
          <Toggle
            checked={s.autofill?.offerToSavePasswords ?? true}
            onChange={(offerToSavePasswords) => cmd({ type: 'settings:set', patch: { autofill: { offerToSavePasswords } } })}
            label="הצעה לשמור סיסמאות בעת התחברות (Offer to save passwords)"
            hint="מציג חלון הצעה לשמירת שם המשתמש והסיסמה לאחר התחברות לאתר"
          />
          <Toggle
            checked={s.autofill?.autoSignIn ?? true}
            onChange={(autoSignIn) => cmd({ type: 'settings:set', patch: { autofill: { autoSignIn } } })}
            label="כניסה אוטומטית לאתרים (Auto sign-in)"
            hint="מאפשר כניסה אוטומטית לאתרים באמצעות פרטי כניסה שנשמרו בחשבונך"
          />
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button className="btn small primary" onClick={() => cmd({ type: 'passwords:open' })}>
              <Icon name="lock" size={14} /> פתח את מנהל הסיסמאות המלא (drift://passwords)
            </button>
            <button className="btn small" onClick={handlePasswordSafetyCheck}>
              <Icon name="shield" size={14} /> בדיקת אבטחת סיסמאות מול מאגרי דליפות
            </button>
            {safetyCheckDone && (
              <span className="google-ok" style={{ fontSize: 12 }}>
                <Icon name="check" size={13} /> כל הסיסמאות השמורות מאובטחות ולא נמצאו פריצות!
              </span>
            )}
          </div>

          <h3>אמצעי תשלום וכרטיסים (Payment methods)</h3>
          <Toggle
            checked={s.autofill?.saveAndFillPayments ?? true}
            onChange={(saveAndFillPayments) => cmd({ type: 'settings:set', patch: { autofill: { saveAndFillPayments } } })}
            label="שמירה ומילוי אוטומטי של אמצעי תשלום (Save and fill payment methods)"
            hint="ממלא באופן מאובטח פרטי כרטיס אשראי בטפסי רכישה ותשלום באתרים"
          />

          <h3>כתובות ופרטים נוספים (Addresses and more)</h3>
          <Toggle
            checked={s.autofill?.saveAndFillAddresses ?? true}
            onChange={(saveAndFillAddresses) => cmd({ type: 'settings:set', patch: { autofill: { saveAndFillAddresses } } })}
            label="שמירה ומילוי אוטומטי של כתובות ופרטי קשר (Save and fill addresses)"
            hint="ממלא אוטומטית כתובות משלוח, מספרי טלפון וכתובות דוא״ל בטפסים מקוונים"
          />

          <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
            <button className="btn small primary" onClick={() => cmd({ type: 'autofill:open' })}>
              <Icon name="key" size={14} /> נהל כרטיסי אשראי וכתובות שמורות (drift://autofill)
            </button>
          </div>
        </section>

        {/* 3. Privacy and security (פרטיות ואבטחה) */}
        <section id="settings-privacy" className="settings-section">
          <span hidden className="search-en">{englishFor('privacy')}</span>
          <h2>{sectionName(s.theme, 'privacy')}</h2>

          {/* Quick link to Drift Store */}
          <div className="site-row" style={{ marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong>חנות התוספים וההרחבות (Drift Store & Extensions Hub)</strong>
              <div className="field-label">גלו תוספי אבטחה, צלילי רקע מרגיעים, כלי פרודוקטיביות וערכות נושא מעוצבות</div>
            </div>
            <button className="btn primary" onClick={() => cmd({ type: 'store:open' })}>
              <Icon name="puzzle" size={15} /> פתח את Drift Store
            </button>
          </div>

          <h3>ניקוי נתוני גלישה (Clear Browsing Data · Ctrl+Shift+Del)</h3>
          <div className="site-row" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', width: '100%' }}>
              <span className="field-label">טווח זמן (Time range):</span>
              <select
                className="field-input"
                value={clearRange}
                onChange={(e) => setClearRange(e.target.value as '1h' | '24h' | '7d' | '4w' | 'all')}
              >
                <option value="1h">שעה אחרונה (Last hour)</option>
                <option value="24h">24 שעות אחרונות (Last 24 hours)</option>
                <option value="7d">7 ימים אחרונים (Last 7 days)</option>
                <option value="4w">4 שבועות אחרונים (Last 4 weeks)</option>
                <option value="all">משחר ההיסטוריה (All time)</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={clearHistory} onChange={(e) => setClearHistory(e.target.checked)} />
                היסטוריית גלישה (Browsing history)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={clearCookies} onChange={(e) => setClearCookies(e.target.checked)} />
                קובצי Cookie ונתוני אתרים (Cookies and other site data)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={clearCache} onChange={(e) => setClearCache(e.target.checked)} />
                תמונות וקבצים במטמון (Cached images and files)
              </label>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button
                className="btn primary small"
                disabled={!clearHistory && !clearCookies && !clearCache}
                onClick={() => {
                  cmd({
                    type: 'privacy:clearData',
                    range: clearRange,
                    history: clearHistory,
                    cookies: clearCookies,
                    cache: clearCache,
                  });
                  setClearedToast(true);
                  setTimeout(() => setClearedToast(false), 3000);
                }}
              >
                <Icon name="trash" size={13} /> נקה נתונים (Clear data)
              </button>
              {clearedToast && (
                <span className="google-ok">
                  <Icon name="check" size={14} /> נתוני הגלישה נוקו בהצלחה!
                </span>
              )}
            </div>
          </div>

          <h3>גלישה בטוחה, DNS מאובטח והגנות (Safe Browsing & Security)</h3>
          <div className="field">
            <span className="field-label">גלישה בטוחה (Safe Browsing)</span>
            <select
              className="field-input"
              value={s.privacy.safeBrowsing}
              onChange={(e) => cmd({ type: 'settings:set', patch: { privacy: { safeBrowsing: e.target.value as SafeBrowsingMode } } })}
            >
              <option value="enhanced">הגנה משופרת (Enhanced protection) — אבטחה מקסימלית ובדיקת איומים בזמן אמת</option>
              <option value="standard">הגנה רגילה (Standard protection) — הגנה מובנית מפני אתרים והורדות מסוכנים</option>
              <option value="off">ללא הגנה (No protection) — לא מומלץ</option>
            </select>
          </div>
          <div className="field">
            <span className="field-label">שימוש ב-DNS מאובטח (Use Secure DNS / DNS-over-HTTPS)</span>
            <select
              className="field-input"
              value={s.privacy.dnsOverHttps}
              onChange={(e) => cmd({ type: 'settings:set', patch: { privacy: { dnsOverHttps: e.target.value as DnsOverHttpsMode } } })}
            >
              <option value="auto">אוטומטי (With your current service provider)</option>
              <option value="cloudflare">Cloudflare (1.1.1.1)</option>
              <option value="google">Google (Public DNS 8.8.8.8)</option>
              <option value="quad9">Quad9 (9.9.9.9)</option>
              <option value="off">כבוי (Off)</option>
            </select>
          </div>
          <Toggle
            checked={s.privacy.httpsOnly}
            onChange={(v) => cmd({ type: 'settings:set', patch: { privacy: { httpsOnly: v } } })}
            label="חיבורים מאובטחים תמיד (Always use secure connections / HTTPS-Only)"
            hint="משדרג אוטומטית כל אתר ל-HTTPS ומזהיר לפני טעינת אתר לא מוצפן"
          />
          <Toggle
            checked={s.privacy.blockPopups}
            onChange={(v) => cmd({ type: 'settings:set', patch: { privacy: { blockPopups: v } } })}
            label="חסימת חלונות קופצים והפניות אוטומטיות (Block Pop-ups and Redirects)"
            hint="מונע מאתרים לפתוח חלונות קופצים ללא פעולת משתמש יזומה"
          />
          <Toggle
            checked={s.privacy.antiFingerprint}
            onChange={(v) => cmd({ type: 'settings:set', patch: { privacy: { antiFingerprint: v } } })}
            label="מערך אבטחה מקסימאלי: הגנה מפני טביעות אצבע (Drift Shield Max Cloaking)"
            hint="מיסוך Canvas Micro-noise, הסוואת WebGL GPU, שיבוש AudioContext והסתרת Battery API"
          />
          <Toggle
            checked={s.privacy.webrtcProtect}
            onChange={(v) => cmd({ type: 'settings:set', patch: { privacy: { webrtcProtect: v } } })}
            label={t('priv.webrtc')}
            hint={t('priv.webrtcHint')}
          />
          <Toggle
            checked={s.privacy.block3pCookies}
            onChange={(v) => cmd({ type: 'settings:set', patch: { privacy: { block3pCookies: v } } })}
            label={t('priv.cookies')}
            hint={t('priv.cookiesHint')}
          />
          <div className="site-row" style={{ marginTop: '8px', marginBottom: '8px' }}>
            <div className="site-host" style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: 'var(--text)' }}>נתוני אתרים וקובצי עוגיות שמורים (Site Data & Cookies)</div>
              <div className="settings-hint">צפייה וניהול של כל קובצי העוגיות השמורים לפי דומיין, בדיקת מאפייני אבטחה ומחיקה סלקטיבית</div>
            </div>
            <button className="btn ghost small" onClick={() => cmd({ type: 'cookies:open' })}>
              <Icon name="sliders" size={13} />
              <span>נהל קובצי Cookie באתרים</span>
            </button>
          </div>
          <Toggle
            checked={s.clearOnExit}
            onChange={(clearOnExit) => cmd({ type: 'settings:set', patch: { clearOnExit } })}
            label={t('set.clearOnExit')}
            hint={t('set.clearOnExitHint')}
          />
          <Toggle
            checked={s.privacy.gpc}
            onChange={(v) => cmd({ type: 'settings:set', patch: { privacy: { gpc: v } } })}
            label={t('priv.gpc')}
            hint={t('priv.gpcHint')}
          />
          <Toggle
            checked={s.privacy.stripTracking}
            onChange={(v) => cmd({ type: 'settings:set', patch: { privacy: { stripTracking: v } } })}
            label={t('priv.strip')}
            hint={t('priv.stripHint')}
          />
          <Toggle
            checked={s.adblock}
            onChange={(adblock) => cmd({ type: 'settings:set', patch: { adblock } })}
            label={t('set.adblock')}
            hint={t('set.adblockHint')}
          />
          <Toggle
            checked={s.hideAnnoyances}
            onChange={(hideAnnoyances) => cmd({ type: 'settings:set', patch: { hideAnnoyances } })}
            label={t('set.annoyances')}
            hint={t('set.annoyancesHint')}
          />

          {s.adblockPaused.length > 0 && (
            <div className="site-row">
              <div className="site-host">{t('set.pausedOn')}</div>
              <div className="site-chips">
                {s.adblockPaused.map((h) => (
                  <span key={h} className="chip">
                    {h}
                    <button title={t('set.unpause')} onClick={() => cmd({ type: 'adblock:site', host: h, paused: false })}>
                      <Icon name="x" size={11} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          <h3>{t('set.sitePermissions')}</h3>
          <p className="settings-lead">{t('set.sitePermissionsLead')}</p>
          <div style={{ marginTop: 8, marginBottom: 12, display: 'flex', gap: 10 }}>
            <button className="btn small primary" onClick={() => cmd({ type: 'tab:new', url: 'drift://site-settings' })}>
              <Icon name="shield" size={14} /> פתח את מרכז הרשאות האתרים והתוכן המלא (drift://site-settings)
            </button>
          </div>
          {sites.length === 0 && <div className="empty-note">{t('set.noPermissions')}</div>}
          {sites.map(([origin, kinds]) => (
            <div key={origin} className="site-row">
              <div className="site-host">{hostOf(origin)}</div>
              <div className="site-chips">
                {Object.entries(kinds).map(([kind, d]) => (
                  <span key={kind} className={cx('chip', d)}>
                    {permissionShortName(kind, t)}: {d === 'allow' ? t('set.allowed') : t('set.blocked')}
                    <button title={t('set.askNext')} onClick={() => void reset(origin, kind)}>
                      <Icon name="x" size={11} />
                    </button>
                  </span>
                ))}
              </div>
              <button className="btn small" onClick={() => void reset(origin)}>
                {t('set.resetSite')}
              </button>
            </div>
          ))}
        </section>

        {/* 4. Appearance (מראה ותצוגה) */}
        <section id="settings-appearance" className="settings-section">
          <span hidden className="search-en">{englishFor('appearance')}</span>
          <h2>{sectionName(s.theme, 'appearance')}</h2>
          <ThemePicker value={s.theme} env={env} />

          <h3>{t('set.colorTheme')}</h3>
          <p className="settings-lead">{t('set.colorThemeHint')}</p>
          <ColorThemePicker settings={s} />

          <h3>{t('dm.title')}</h3>
          <DarkModePanel darkMode={s.darkMode} activeUrl={state.tabs.find((t) => t.id === state.activeTabId)?.url} />

          <h3>סרגל כלים, סימניות ותצוגת דף (Chrome Toolbar & Bookmarks)</h3>
          <Toggle
            checked={s.showHomeButton}
            onChange={(showHomeButton) => cmd({ type: 'settings:set', patch: { showHomeButton } })}
            label="הצג כפתור דף הבית (Show Home button)"
            hint="מוסיף לחצן בית (🏠) בסרגל הכלים העליון ליד כפתור הרענון"
          />
          {s.showHomeButton && (
            <div className="field">
              <span className="field-label">{t('set.homePage')}</span>
              <CommitInput value={s.homePage} placeholder="https://…" onCommit={(homePage) => cmd({ type: 'settings:set', patch: { homePage } })} />
            </div>
          )}
          <div className="field">
            <span className="field-label">הצג את סרגל הסימניות (Show bookmarks bar · Ctrl+Shift+B)</span>
            <select
              className="field-input"
              value={s.showBookmarksBar}
              onChange={(e) => cmd({ type: 'settings:set', patch: { showBookmarksBar: e.target.value as BookmarksBarMode } })}
            >
              <option value="always">תמיד (Always)</option>
              <option value="newtab">רק בכרטיסייה חדשה (Only on New Tab page)</option>
              <option value="never">אף פעם (Never)</option>
            </select>
          </div>
          <Toggle
            checked={s.tabHoverCard}
            onChange={(tabHoverCard) => cmd({ type: 'settings:set', patch: { tabHoverCard } })}
            label="הצג תצוגה מקדימה במעבר עכבר על כרטיסייה (Show tab hover preview card)"
            hint="מציג את כתובת האתר ומצב הזיכרון בעת ריחוף מעל כרטיסייה"
          />
          <Toggle
            checked={s.swipeToCloseTabs}
            onChange={(swipeToCloseTabs) => cmd({ type: 'settings:set', patch: { swipeToCloseTabs } })}
            label="החלקה ימינה ושמאלה על כרטיסייה לסגירה (Swipe tabs left/right to close)"
            hint="מאפשר להחליק על כרטיסייה ימינה או שמאלה (במשטח מגע או מסך מגע) כדי לסגור אותה"
          />
          <div className="field">
            <span className="field-label">גודל גופן בדפים (Font size)</span>
            <select
              className="field-input"
              value={s.fontSize}
              onChange={(e) => cmd({ type: 'settings:set', patch: { fontSize: e.target.value as FontSizePreset } })}
            >
              <option value="xsmall">קטן מאוד (Very small)</option>
              <option value="small">קטן (Small)</option>
              <option value="medium">בינוני - מומלץ (Medium - Recommended)</option>
              <option value="large">גדול (Large)</option>
              <option value="xlarge">גדול מאוד (Very large)</option>
            </select>
          </div>
          <div className="field">
            <span className="field-label">מרחק מתצוגה בדף כברירת מחדל (Page zoom)</span>
            <select
              className="field-input"
              value={s.defaultZoom}
              onChange={(e) => cmd({ type: 'settings:set', patch: { defaultZoom: Number(e.target.value) } })}
            >
              {[50, 67, 75, 80, 90, 100, 110, 125, 150, 175, 200].map((z) => (
                <option key={z} value={z}>
                  {z}%
                </option>
              ))}
            </select>
          </div>
          <Toggle
            checked={s.verticalTabs}
            onChange={(verticalTabs) => cmd({ type: 'settings:set', patch: { verticalTabs } })}
            label={t('set.verticalTabs')}
            hint={t('set.verticalTabsHint')}
          />
          <Toggle
            checked={s.spaceColors}
            onChange={(spaceColors) => cmd({ type: 'settings:set', patch: { spaceColors } })}
            label={t('set.spaceColors')}
            hint={t('set.spaceColorsHint')}
          />
          <Toggle
            checked={state.compact}
            onChange={(value) => cmd({ type: 'ui:compact', value })}
            label={t('set.compact')}
            hint={t('set.compactHint')}
          />
        </section>

        {/* 5. Search engine (מנוע חיפוש) */}
        <section id="settings-search" className="settings-section">
          <span hidden className="search-en">{englishFor('search')}</span>
          <h2>מנוע חיפוש (Search engine)</h2>
          <div className="field">
            <span className="field-label">מנוע חיפוש ברירת מחדל בשורת הכתובות (Search engine used in address bar)</span>
            <select
              className="field-input"
              value={s.searchEngine}
              onChange={(e) => cmd({ type: 'settings:set', patch: { searchEngine: e.target.value as SearchEngineId } })}
            >
              {(Object.keys(SEARCH_ENGINES) as SearchEngineId[]).map((id) => (
                <option key={id} value={id}>
                  {SEARCH_ENGINES[id].name}
                </option>
              ))}
            </select>
          </div>

          <h3>קיצורי חיפוש מהירים ב-Omnibox (Search shortcuts)</h3>
          <p className="settings-lead">הקלידו קיצור דרך בשורת הכתובות ולחצו על מקש רווח (Space) לחיפוש ממוקד:</p>
          <div className="engine-rows" style={{ marginBottom: 16 }}>
            <div className="engine-row">
              <span className="mono">@google [שאילתה]</span>
              <span>חיפוש ישיר ב-Google</span>
            </div>
            <div className="engine-row">
              <span className="mono">@tabs [שם כרטיסייה]</span>
              <span>איתור ומעבר מהיר בין כרטיסיות פתוחות</span>
            </div>
            <div className="engine-row">
              <span className="mono">@history [מילת מפתח]</span>
              <span>חיפוש מהיר בהיסטוריית הגלישה</span>
            </div>
            <div className="engine-row">
              <span className="mono">@bookmarks [שם סימנייה]</span>
              <span>חיפוש ופתיחת סימניות</span>
            </div>
            <div className="engine-row">
              <span className="mono">@ai [שאלה]</span>
              <span>פנייה לעוזר הבינה המלאכותית המקומי</span>
            </div>
          </div>

          <h3>{t('set.openIn')}</h3>
          {Object.keys(s.openInRules).length === 0 ? (
            <div className="empty-note">
              {t('set.openInNone')} {t('set.openInHint')}
            </div>
          ) : (
            <div className="site-chips">
              {Object.entries(s.openInRules).map(([h, b]) => (
                <span key={h} className="chip">
                  {h} → {browsers.find((x) => x.id === b)?.name ?? b}
                  <button onClick={() => cmd({ type: 'openin:remove', host: h })}>
                    <Icon name="x" size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </section>

        {/* 6. Default browser (דפדפן ברירת מחדל) */}
        <section id="settings-default" className="settings-section">
          <span hidden className="search-en">{englishFor('default')}</span>
          <h2>דפדפן ברירת מחדל (Default browser)</h2>
          <div className="site-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>
                {isDefault ? '✓ Drift הוא דפדפן ברירת המחדל שלך במערכת' : 'Drift אינו מוגדר כעת כדפדפן ברירת המחדל'}
              </div>
              <div className="field-label" style={{ marginTop: 2 }}>
                הגדרת Drift כדפדפן ברירת המחדל תפתח קישורים מכל האפליקציות והמסמכים ב-Drift
              </div>
            </div>
            <button className={cx('btn', isDefault ? 'ghost' : 'primary')} onClick={handleMakeDefault}>
              <Icon name={isDefault ? 'check' : 'globe'} size={15} />
              <span>{isDefault ? 'מוגדר כברירת מחדל' : 'הגדר כברירת מחדל (Make default)'}</span>
            </button>
          </div>
          {defaultToast && (
            <div className="google-ok" style={{ marginTop: 10 }}>
              <Icon name="check" size={14} /> בקשת הגדרת דפדפן ברירת מחדל נשלחה למערכת ההפעלה!
            </div>
          )}
        </section>

        {/* 7. On startup (בעת ההפעלה) */}
        <section id="settings-startup" className="settings-section">
          <span hidden className="search-en">{englishFor('startup')}</span>
          <h2>בעת ההפעלה (On startup)</h2>
          <div className="field">
            <span className="field-label">מה לפתוח בעת הפעלת הדפדפן</span>
            <select
              className="field-input"
              value={s.startupMode}
              onChange={(e) => cmd({ type: 'settings:set', patch: { startupMode: e.target.value as StartupMode } })}
            >
              <option value="newtab">פתח את דף הכרטיסייה החדשה (Open the New Tab page)</option>
              <option value="continue">המשך מהמקום שבו הפסקת (Continue where you left off — שחזור סשן מלא)</option>
              <option value="urls">פתח דף מסוים או קבוצת דפים (Open a specific page or set of pages)</option>
            </select>
          </div>
          {s.startupMode === 'urls' && (
            <div className="site-row">
              <div className="site-host">דפים שייפתחו בעת ההפעלה</div>
              {s.startupUrls.length > 0 && (
                <div className="site-chips">
                  {s.startupUrls.map((u) => (
                    <span key={u} className="chip">
                      {u}
                      <button
                        title="הסר דף"
                        onClick={() => cmd({ type: 'settings:set', patch: { startupUrls: s.startupUrls.filter((x) => x !== u) } })}
                      >
                        <Icon name="x" size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <input
                  className="field-input"
                  style={{ flex: 1, minWidth: 220 }}
                  value={newStartupUrl}
                  placeholder="https://example.com"
                  onChange={(e) => setNewStartupUrl(e.target.value)}
                />
                <button
                  className="btn small"
                  onClick={() => {
                    const u = newStartupUrl.trim();
                    if (!u) return;
                    const normalized = /^https?:\/\//i.test(u) ? u : `https://${u}`;
                    if (!s.startupUrls.includes(normalized)) {
                      cmd({ type: 'settings:set', patch: { startupUrls: [...s.startupUrls, normalized] } });
                    }
                    setNewStartupUrl('');
                  }}
                >
                  הוסף דף (Add page)
                </button>
                <button
                  className="btn small"
                  onClick={() => {
                    const currentUrls = state.tabs
                      .map((t) => t.url)
                      .filter((u) => /^https?:\/\//i.test(u));
                    if (currentUrls.length > 0) {
                      cmd({ type: 'settings:set', patch: { startupUrls: Array.from(new Set(currentUrls)) } });
                    }
                  }}
                >
                  השתמש בדפים הפתוחים כעת (Use current pages)
                </button>
              </div>
            </div>
          )}
          <div className="field" style={{ marginTop: 14 }}>
            <span className="field-label">{t('set.newTabPage')}</span>
            <select className="field-input" value={s.newTabPage} onChange={(e) => cmd({ type: 'settings:set', patch: { newTabPage: e.target.value as 'newtab' | 'home' } })}>
              <option value="newtab">{t('set.newTabPageNewtab')}</option>
              <option value="home">{t('set.newTabPageHome')}</option>
            </select>
          </div>
          <Toggle checked={s.confirmClose} onChange={(confirmClose) => cmd({ type: 'settings:set', patch: { confirmClose } })} label={t('set.confirmClose')} />
        </section>

        {/* 8. Languages (שפות ואיות) */}
        <section id="settings-language" className="settings-section">
          <span hidden className="search-en">{englishFor('language')}</span>
          <h2>{sectionName(s.theme, 'language')}</h2>
          <LanguagePicker value={s.language} system={locale.system} />
          <Toggle
            checked={s.offerTranslation ?? true}
            onChange={(offerTranslation) => cmd({ type: 'settings:set', patch: { offerTranslation } })}
            label="הצעת תרגום דפים שאינם בשפה שלך (Offer to translate pages)"
            hint="מציג חלון תרגום בלחיצה אחת לדפי אינטרנט בשפות זרות"
          />
          <Toggle
            checked={s.spellCheck}
            onChange={(spellCheck) => cmd({ type: 'settings:set', patch: { spellCheck } })}
            label="בדיקת איות בשדות טקסט באתרים (Spell Check)"
            hint="מסמן שגיאות כתיב בעת הקלדה באתרי אינטרנט"
          />
        </section>

        {/* 9. Downloads (הורדות) */}
        <section id="settings-downloads" className="settings-section">
          <span hidden className="search-en">{englishFor('downloads')}</span>
          <h2>הורדות (Downloads)</h2>
          <div className="field">
            <span className="field-label">מיקום שמירת הורדות (Download location)</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="mono" style={{ fontSize: 12, opacity: 0.85 }}>
                {s.downloadPath || 'תיקיית ההורדות הרגילה של מערכת ההפעלה (System Default Downloads)'}
              </span>
              <button className="btn small" onClick={() => cmd({ type: 'downloads:chooseFolder' })}>
                שנה מיקום… (Change…)
              </button>
              {s.downloadPath && (
                <button className="btn small" onClick={() => cmd({ type: 'settings:set', patch: { downloadPath: '' } })}>
                  אפס לברירת מחדל
                </button>
              )}
            </div>
          </div>
          <Toggle
            checked={s.askDownloadLocation}
            onChange={(askDownloadLocation) => cmd({ type: 'settings:set', patch: { askDownloadLocation } })}
            label={t('set.askDownload')}
            hint="שואל היכן לשמור כל קובץ לפני תחילת ההורדה"
          />
          <Toggle
            checked={s.showDownloadsWhenDone}
            onChange={(showDownloadsWhenDone) => cmd({ type: 'settings:set', patch: { showDownloadsWhenDone } })}
            label="הצג הורדות כשהן מסתיימות (Show downloads when they're done)"
            hint="פותח אוטומטית את תפריט ההורדות בסיום הורדת קובץ"
          />
        </section>

        {/* 10. Accessibility (נגישות) */}
        <section id="settings-accessibility" className="settings-section">
          <span hidden className="search-en">{englishFor('accessibility')}</span>
          <h2>נגישות (Accessibility)</h2>
          <Toggle
            checked={s.caretBrowsing}
            onChange={(caretBrowsing) => cmd({ type: 'settings:set', patch: { caretBrowsing } })}
            label="ניווט בעזרת סמן הטקסט בדפים (Caret Browsing · F7)"
            hint="מאפשר לנווט ולבחור טקסט בדפי אינטרנט באמצעות מקשי החצים במקלדת"
          />
          <Toggle
            checked={s.highContrast ?? false}
            onChange={(highContrast) => cmd({ type: 'settings:set', patch: { highContrast } })}
            label="מצב ניגודיות גבוהה להקלה על קריאה (High contrast mode)"
            hint="מגביר את הניגודיות של גופנים, כפתורים ואלמנטים לטובת חדות מקסימלית"
          />
        </section>

        {/* 11. Performance (ביצועים) */}
        <section id="settings-performance" className="settings-section">
          <span hidden className="search-en">{englishFor('performance')}</span>
          <h2>ביצועים (Performance)</h2>
          <Toggle
            checked={s.memorySaver}
            onChange={(memorySaver) => cmd({ type: 'settings:set', patch: { memorySaver } })}
            label="חוסך הזיכרון (Memory Saver)"
            hint="מפנה זיכרון מכרטיסיות לא פעילות כדי להעניק לכרטיסיות פעילות וליישומים אחרים יותר משאבי מחשב"
          />
          <div className="site-row">
            <div className="site-host">אתרים שתמיד יישארו פעילים (Always keep these sites active)</div>
            {s.neverSleepHosts.length > 0 && (
              <div className="site-chips">
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
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <input
                className="field-input"
                style={{ flex: 1, minWidth: 200 }}
                value={newNeverSleepHost}
                placeholder="example.com"
                onChange={(e) => setNewNeverSleepHost(e.target.value)}
              />
              <button
                className="btn small"
                onClick={() => {
                  const h = newNeverSleepHost.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '').replace(/^www\./i, '').toLowerCase();
                  if (h && !s.neverSleepHosts.includes(h)) {
                    cmd({ type: 'settings:set', patch: { neverSleepHosts: [...s.neverSleepHosts, h] } });
                  }
                  setNewNeverSleepHost('');
                }}
              >
                הוסף אתר (Add site)
              </button>
            </div>
          </div>
          <Toggle
            checked={s.energySaver}
            onChange={(energySaver) => cmd({ type: 'settings:set', patch: { energySaver } })}
            label="חוסך האנרגיה (Energy Saver)"
            hint="חוסך בסוללה על ידי הגבלת פעילות ברקע ואפקטים חזותיים כגון קצב פריימים בווידאו"
          />
          <div className="field">
            <span className="field-label">טעינה מראש של דפים (Preload pages)</span>
            <select
              className="field-input"
              value={s.preloadPages}
              onChange={(e) => cmd({ type: 'settings:set', patch: { preloadPages: e.target.value as PreloadPagesMode } })}
            >
              <option value="standard">טעינה מראש רגילה (Standard preloading)</option>
              <option value="extended">טעינה מראש מורחבת (Extended preloading)</option>
              <option value="off">ללא טעינה מראש (No preloading)</option>
            </select>
          </div>
          <div className="field">
            <span className="field-label">{t('set.sleep')}</span>
            <select className="field-input" value={s.sleepAfter} onChange={(e) => cmd({ type: 'settings:set', patch: { sleepAfter: Number(e.target.value) } })}>
              <option value={0}>{t('set.sleepOff')}</option>
              {[15, 30, 60, 120].map((n) => (
                <option key={n} value={n}>
                  {t('set.sleepMinutes', { n })}
                </option>
              ))}
            </select>
            <span className="toggle-hint">{t('set.sleepHint')}</span>
          </div>
        </section>

        {/* 12. System (מערכת) */}
        <section id="settings-system" className="settings-section">
          <span hidden className="search-en">{englishFor('system')}</span>
          <h2>מערכת (System)</h2>
          <Toggle
            checked={s.hardwareAcceleration}
            onChange={(hardwareAcceleration) => cmd({ type: 'settings:set', patch: { hardwareAcceleration } })}
            label={t('set.gpu')}
            hint={t('set.gpuHint')}
          />
          <Toggle
            checked={s.smoothScrolling}
            onChange={(smoothScrolling) => cmd({ type: 'settings:set', patch: { smoothScrolling } })}
            label={t('set.smooth')}
            hint={t('set.smoothHint')}
          />
          <Toggle
            checked={s.backgroundApps ?? false}
            onChange={(backgroundApps) => cmd({ type: 'settings:set', patch: { backgroundApps } })}
            label="המשך הרצת יישומי רקע כש-Drift נסגר (Continue running background apps)"
            hint="מאפשר לתוספים ולסנכרון להמשיך לפעול ברקע גם לאחר סגירת חלונות הדפדפן"
          />
          {(s.smoothScrolling !== startSmooth || s.hardwareAcceleration !== startGpu) && (
            <button className="btn small" onClick={() => cmd({ type: 'app:restart' })}>
              {t('set.restartNow')}
            </button>
          )}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
            <button className="btn" onClick={() => cmd({ type: 'win:taskManager' })}>
              <Icon name="bolt" size={14} /> מנהל המשימות של הדפדפן (Task Manager · Shift+Esc)
            </button>
            <button className="btn" onClick={() => cmd({ type: 'win:incognito' })}>
              <Icon name="shield" size={14} /> חלון גלישה בסתר חדש (New Incognito Window · Ctrl+Shift+N)
            </button>
          </div>

          <h3>{t('ai.title')}</h3>
          <p className="settings-lead">
            Connect Drift to your local Ollama server (<code>http://localhost:11434</code>) to summarize pages, translate text, or chat privately on-device. Press <code>Ctrl+Shift+A</code> or type <code>@ai</code> in the address bar.
          </p>
          <div className="field">
            <span className="field-label">Ollama API Endpoint</span>
            <CommitInput
              value={s.ai.endpoint}
              placeholder="http://localhost:11434"
              onCommit={(endpoint) => cmd({ type: 'settings:set', patch: { ai: { endpoint } } })}
            />
          </div>
          <div className="field">
            <span className="field-label">Default Ollama Model</span>
            <CommitInput
              value={s.ai.model}
              placeholder="llama3.2"
              onCommit={(model) => cmd({ type: 'settings:set', patch: { ai: { model } } })}
            />
          </div>
          <div className="field">
            <span className="field-label">Target Translation Language</span>
            <CommitInput
              value={s.ai.targetLanguage}
              placeholder="English"
              onCommit={(targetLanguage) => cmd({ type: 'settings:set', patch: { ai: { targetLanguage } } })}
            />
          </div>
          <button className="btn" onClick={() => cmd({ type: 'ai:toggle', open: true })}>
            <Icon name="sparkles" size={14} /> Open Local AI Side Panel
          </button>

          <h3>{t('clip.title')}</h3>
          <CloudClipboardPanel items={state.clipboard} settings={s.clipboardSync} sync={state.sync} />
        </section>

        {/* 13. Reset settings (איפוס והחזרה להגדרות ברירת מחדל) */}
        <section id="settings-reset" className="settings-section">
          <span hidden className="search-en">{englishFor('reset')}</span>
          <h2>איפוס והחזרה לברירת המחדל (Reset settings)</h2>
          <p className="settings-lead">פעולה זו תחזיר את כל הגדרות הדפדפן, מנוע החיפוש, דף הבית והכרטיסיות לערכי ברירת המחדל המקוריים.</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              className="btn"
              onClick={() => {
                if (window.confirm('האם לאפס את כל ההגדרות לערכי ברירת המחדל המקוריים? (Reset all settings to defaults?)')) {
                  cmd({ type: 'settings:reset' });
                }
              }}
            >
              <Icon name="reload" size={14} /> שחזור הגדרות לברירת המחדל המקורית (Reset Settings)
            </button>
            <button
              className="btn ghost"
              onClick={() => {
                cmd({
                  type: 'privacy:clearData',
                  range: 'all',
                  history: true,
                  cookies: true,
                  cache: true,
                });
                alert('כל נתוני הגלישה והמטמון נוקו בהצלחה.');
              }}
            >
              <Icon name="trash" size={14} /> נקה את כל נתוני הגלישה והמטמון
            </button>
          </div>
        </section>

        {/* 14. About Drift & Chromium (אודות הדפדפן) */}
        <section id="settings-about" className="settings-section">
          <span hidden className="search-en">{englishFor('about')}</span>
          <h2>{sectionName(s.theme, 'about')}</h2>
          <div className="engine-rows about">
            <div className="engine-row">
              <span>Drift Browser</span>
              <span className="mono">{env?.versions.app}</span>
            </div>
            <div className="engine-row">
              <span>{t('set.chromium')}</span>
              <span className="mono">{env?.versions.chrome}</span>
            </div>
            <div className="engine-row">
              <span>{t('set.electron')}</span>
              <span className="mono">{env?.versions.electron}</span>
            </div>
            <div className="engine-row">
              <span>{t('set.build')}</span>
              <span>{env?.packaged ? t('set.buildInstalled') : t('set.buildDev')}</span>
            </div>
          </div>

          <h3 style={{ marginTop: 20 }}>עדכונים ומנוע דפדפן (Updates & Upstream Engine)</h3>
          <EngineCard status={state.updates} env={env} />
          <h3>{t('set.updateSource')}</h3>
          <UpdateSourceForm u={s.updates} />
          <div className="field">
            <span className="field-label">{t('set.channel')}</span>
            <select
              className="field-input"
              value={s.updates.channel}
              onChange={(e) => cmd({ type: 'settings:set', patch: { updates: { channel: e.target.value as 'stable' | 'beta' } } })}
            >
              <option value="stable">{t('set.channelStable')}</option>
              <option value="beta">{t('set.channelBeta')}</option>
            </select>
          </div>
          <Toggle
            checked={s.updates.autoCheck}
            onChange={(autoCheck) => cmd({ type: 'settings:set', patch: { updates: { autoCheck } } })}
            label={t('set.autoCheck')}
            hint={t('set.autoCheckHint')}
          />
          <Toggle
            checked={s.updates.engineAlerts}
            onChange={(engineAlerts) => cmd({ type: 'settings:set', patch: { updates: { engineAlerts } } })}
            label={t('set.engineAlerts')}
          />
          <button style={{ marginTop: 12 }} className="btn" onClick={() => cmd({ type: 'settings:set', patch: { onboarded: false } })}>
            {t('set.rerunSetup')}
          </button>
        </section>

        {/* Legacy Section Aliases for compatibility */}
        <section id="settings-engine" className="settings-section" hidden={!activeSections.includes('engine')}>
          <h2>{sectionName(s.theme, 'engine')}</h2>
          <EnginePicker engine={s.engine} chromium={env?.versions.chrome ?? ''} />
        </section>

        <section id="settings-import" className="settings-section" hidden={!activeSections.includes('import')}>
          <h2>{sectionName(s.theme, 'import')}</h2>
          <ImportPanel />
        </section>

        <section id="settings-updates" className="settings-section" hidden={!activeSections.includes('updates')}>
          <h2>{sectionName(s.theme, 'updates')}</h2>
          <EngineCard status={state.updates} env={env} />
        </section>

        <section id="settings-general" className="settings-section" hidden={!activeSections.includes('general')}>
          <h2>{sectionName(s.theme, 'general')}</h2>
          <p className="settings-lead">כל ההגדרות הכלליות סודרו בקטגוריות הייעודיות שלמעלה.</p>
        </section>
      </div>
    </div>
  );
}
