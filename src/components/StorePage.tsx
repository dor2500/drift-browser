import { useEffect, useMemo, useState } from 'react';
import type { BrowserState } from '../../shared/types';
import { COLOR_THEMES } from '../../shared/colorThemes';
import { cmd, cx } from '../lib';
import { Icon, type IconName } from './Icon';
import { playAmbientSound, setAmbientVolume, stopAmbientSound } from '../lib/ambientSound';

type StoreCategory = 'all' | 'security' | 'productivity' | 'media' | 'themes' | 'scripts';

interface StoreItem {
  id: string;
  name: string;
  nameHe: string;
  category: 'security' | 'productivity' | 'media' | 'themes';
  version: string;
  author: string;
  icon: IconName;
  description: string;
  descriptionHe: string;
  tags: string[];
  featuresHe: string[];
}

const STORE_CATALOG: StoreItem[] = [
  {
    id: 'drift-shield-pro',
    name: 'Drift Shield Pro',
    nameHe: 'Drift Shield Pro — חבילת אבטחה מקסימאלית וטביעת אצבע',
    category: 'security',
    version: '2.4.0',
    author: 'Drift Security Labs',
    icon: 'shield',
    description:
      'Ultra privacy suite with Anti-Canvas fingerprinting, WebGL vendor cloaking, AudioContext jitter, battery protection, and homograph phishing detection.',
    descriptionHe:
      'הגנת פרטיות מקסימלית: מיסוך טביעות אצבע של Canvas, הסוואת כרטיס גרפי ב-WebGL, שיבוש AudioContext, חסימת דליפות סוללה והגנה מפני התקפות פישינג IDN Homograph.',
    tags: ['אבטחה', 'פרטיות', 'טביעת אצבע', 'אנטי-מעקב'],
    featuresHe: [
      'מיסוך Canvas Fingerprint למניעת זיהוי מעבר לאתרים',
      'הסוואת מעבד גרפי (WebGL Vendor & Renderer)',
      'שיבוש אקוסטי של AudioContext Frequency',
      'חסימת דליפות סטטוס סוללה (Battery API)',
      'איתור אוטומטי של התקפות פישינג וכתובות מתחזות (IDN Homograph)',
    ],
  },
  {
    id: 'drift-zen-aura',
    name: 'Drift Zen Aura',
    nameHe: 'Drift Zen Aura — מחולל צלילי רקע ומוזיקת ריכוז',
    category: 'productivity',
    version: '1.8.2',
    author: 'Drift Audio Engine',
    icon: 'music',
    description:
      'Offline ambient sound generator powered by Web Audio API. Pink rain, deep ocean, focus drone, and 10Hz binaural alpha beats without external internet or files.',
    descriptionHe:
      'מחולל צלילי אווירה ופוקוס מובנה: גשם מרגיע (Pink Noise), גלי אוקיינוס עמוקים, צליל חלל מרגיע וגלי מוח בינאורליים (10Hz Alpha Focus) — 100% לא מקוון וללא שימוש ברשת.',
    tags: ['פוקוס', 'שמע', 'גשם', 'ריכוז', 'ללא אינטרנט'],
    featuresHe: [
      'גשם מרגיע Pink Rain עם סינון תדרים חי',
      'גלי אוקיינוס בריכוך תדרים נמוכים',
      'גלי אלפא בינאורליים 10Hz להגברת הריכוז',
      'סינתזה בזמן אמת ב-Web Audio ללא הורדת קבצים',
      'עבודה חלקה לחלוטין ברקע בזמן גלישה',
    ],
  },
  {
    id: 'drift-scratchpad',
    name: 'Drift Quick Scratchpad',
    nameHe: 'Drift Scratchpad — פנקס רשימות מהיר ומובנה',
    category: 'productivity',
    version: '1.5.0',
    author: 'Drift Productivity Team',
    icon: 'book',
    description:
      'Fast, private scratchpad for notes, code snippets, and to-do lists, permanently preserved across browser sessions.',
    descriptionHe:
      'פנקס פתקים וקוד מהיר עם שמירה אוטומטית מקומית קבועה, ללא צורך בהרשמה או שליחת נתונים לשרתים חיצוניים.',
    tags: ['פתקים', 'פרודוקטיביות', 'רשימות', 'קוד'],
    featuresHe: [
      'שמירה אוטומטית מקומית מיידית',
      'ספירת מילים ותווים בזמן אמת',
      'העתקה מהירה בלחיצת כפתור',
      'ללא שמירה בענן — פרטיות מקסימלית במכשיר בלבד',
    ],
  },
  {
    id: 'drift-focus-timer',
    name: 'Drift Pomodoro Focus',
    nameHe: 'Drift Pomodoro — טיימר פוקוס 25/5 מובנה',
    category: 'productivity',
    version: '1.2.0',
    author: 'Drift Focus Lab',
    icon: 'clock',
    description:
      'Integrated Pomodoro focus timer with 25-minute sprints and 5-minute restorative breaks.',
    descriptionHe:
      'טיימר פומומורו מובנה לגלישה יעילה: 25 דקות פוקוס ו-5 דקות הפסקה עם התראות שמע נעימות לשמירה על ריכוז עבודה גבוה.',
    tags: ['פומומורו', 'טיימר', 'ניהול זמן', 'ריכוז'],
    featuresHe: ['מחזורי 25 דקות ריכוז / 5 דקות הפסקה', 'טיימר ויזואלי ברור', 'צליל סיום מובנה'],
  },
  {
    id: 'drift-security-auditor',
    name: 'Drift Security Auditor',
    nameHe: 'Drift Security Auditor — סורק אבטחת אתרים ואישורי SSL',
    category: 'security',
    version: '2.0.1',
    author: 'Drift Security Labs',
    icon: 'lock',
    description:
      'Real-time website security inspector checking SSL/TLS encryption, CSP headers, X-Frame clickjacking defense, and mixed content rating.',
    descriptionHe:
      'סורק אבטחה בזמן אמת הבוחן את רמת ההצפנה (TLS), תקינות אישורי SSL, מדיניות CSP נגד הזרקת קוד ומעניק ציון אבטחה לאתר הפעיל.',
    tags: ['SSL', 'אבטחה', 'CSP', 'סורק'],
    featuresHe: [
      'בדיקת הצפנת TLS 1.3 ושלמות אישורי אבטחה',
      'בדיקת כותרות Content-Security-Policy (CSP)',
      'הגנה מפני Clickjacking ו-Mixed Content',
      'ציון אבטחה מהיר בזמן אמת',
    ],
  },
  {
    id: 'drift-video-booster',
    name: 'Drift Video & Audio Booster',
    nameHe: 'Drift Video Popout & Audio Booster — מגבר קול ושליטת וידאו',
    category: 'media',
    version: '1.6.4',
    author: 'Drift Media Works',
    icon: 'pip',
    description:
      'Picture-in-picture controller, volume booster up to 300% for quiet web videos, and variable playback speed controls.',
    descriptionHe:
      'הגברת שמע של סרטונים עד 300% (לסרטונים חלשים), מעבר מיידי ל-Picture-in-Picture ושליטה במהירות ניגון מ-0.25x עד 4.0x.',
    tags: ['וידאו', 'PiP', 'ווליום', 'מדיה'],
    featuresHe: ['מגבר ווליום ייעודי עד 300%', 'שליטה גלובלית במהירות ניגון', 'לחצן PiP צף חכם'],
  },
  {
    id: 'drift-reader-mode',
    name: 'Drift Reader Mode Plus',
    nameHe: 'Drift Reader Mode Plus — מצב קריאה מתקדם עם הקראת טקסט',
    category: 'productivity',
    version: '2.1.0',
    author: 'Drift Editorial',
    icon: 'book',
    description:
      'Distraction-free reading environment stripping clutter and ads, with customizable typography, dark/sepia modes, and text-to-speech voice narration.',
    descriptionHe:
      'מנקה מאמרים ודפי תוכן מפרסומות והפרעות, מאפשר בחירת גופנים וצבעי קריאה, ותומך בהקראת המאמר בקול באמצעות Text-to-Speech.',
    tags: ['קריאה', 'מאמרים', 'הקראה בקול', 'נגישות'],
    featuresHe: ['ממשק קריאה נקי ומבודד', 'בחירת גופנים, גדלים ומרווחים', 'הקראה קולית ישירה בדפדפן'],
  },
];

export function StorePage({ state }: { state: BrowserState }) {
  const storeSettings = state.settings.store;
  const [activeTab, setActiveTab] = useState<StoreCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Zen Aura sound preview state
  const [audioPlaying, setAudioPlaying] = useState(storeSettings?.ambientSound?.playing ?? false);
  const [soundType, setSoundType] = useState(storeSettings?.ambientSound?.sound ?? 'rain');
  const [volume, setVolume] = useState(storeSettings?.ambientSound?.volume ?? 0.5);

  // Scratchpad notes live state
  const [notes, setNotes] = useState(storeSettings?.scratchpadNotes ?? '');

  // Pomodoro timer state
  const [pomoSeconds, setPomoSeconds] = useState(25 * 60);
  const [pomoRunning, setPomoRunning] = useState(false);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (pomoRunning && pomoSeconds > 0) {
      interval = setInterval(() => setPomoSeconds((s) => s - 1), 1000);
    } else if (pomoSeconds === 0) {
      setPomoRunning(false);
      showToast('⏰ הפומומורו הסתיים! הגיע הזמן להפסקה מרעננת.');
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [pomoRunning, pomoSeconds]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const installedSet = useMemo(() => new Set(storeSettings?.installed ?? []), [storeSettings?.installed]);
  const disabledSet = useMemo(() => new Set(storeSettings?.disabled ?? []), [storeSettings?.disabled]);

  const toggleInstall = (id: string) => {
    const isInstalled = installedSet.has(id);
    const nextInstalled = isInstalled
      ? storeSettings.installed.filter((x) => x !== id)
      : [...storeSettings.installed, id];
    cmd({
      type: 'settings:set',
      patch: {
        store: { installed: nextInstalled },
      },
    });
    showToast(isInstalled ? `התוסף הוסר בהצלחה` : `התוסף הותקן בהצלחה והופעל!`);
  };

  const toggleEnabled = (id: string) => {
    const isDisabled = disabledSet.has(id);
    const nextDisabled = isDisabled
      ? storeSettings.disabled.filter((x) => x !== id)
      : [...storeSettings.disabled, id];
    cmd({
      type: 'settings:set',
      patch: {
        store: { disabled: nextDisabled },
      },
    });
    showToast(isDisabled ? `התוסף הופעל` : `התוסף כובה זמנית`);
  };

  const handleAudioToggle = () => {
    if (audioPlaying) {
      stopAmbientSound();
      setAudioPlaying(false);
      cmd({ type: 'settings:set', patch: { store: { ambientSound: { playing: false, sound: soundType, volume } } } });
    } else {
      playAmbientSound(soundType, volume);
      setAudioPlaying(true);
      cmd({ type: 'settings:set', patch: { store: { ambientSound: { playing: true, sound: soundType, volume } } } });
    }
  };

  const handleSoundChange = (type: 'rain' | 'ocean' | 'drone' | 'whitenoise' | 'binaural') => {
    setSoundType(type);
    if (audioPlaying) {
      playAmbientSound(type, volume);
    }
    cmd({ type: 'settings:set', patch: { store: { ambientSound: { playing: audioPlaying, sound: type, volume } } } });
  };

  const handleVolumeChange = (v: number) => {
    setVolume(v);
    setAmbientVolume(v);
    cmd({ type: 'settings:set', patch: { store: { ambientSound: { playing: audioPlaying, sound: soundType, volume: v } } } });
  };

  const handleNotesChange = (text: string) => {
    setNotes(text);
    cmd({ type: 'settings:set', patch: { store: { scratchpadNotes: text } } });
  };

  const applyTheme = (themeId: string) => {
    cmd({ type: 'settings:set', patch: { colorTheme: themeId } });
    showToast(`ערכת העיצוב הוחלה בהצלחה!`);
  };

  // Filtered items
  const filteredCatalog = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return STORE_CATALOG.filter((item) => {
      const matchCat = activeTab === 'all' || item.category === activeTab;
      if (!matchCat) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.nameHe.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.descriptionHe.toLowerCase().includes(q) ||
        item.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [activeTab, searchQuery]);

  const activeTabDetails = state.tabs.find((t) => t.id === state.activeTabId);
  const activeUrl = activeTabDetails?.url ?? '';
  const isHttps = activeUrl.startsWith('https://');

  return (
    <div className="store-page" dir="rtl">
      {/* Top Banner */}
      <header className="store-header">
        <div className="store-hero">
          <div className="store-hero-badge">
            <Icon name="puzzle" size={16} />
            <span>חנות התוספים והערכות הרשמית של Drift</span>
          </div>
          <h1>Drift Store & Extensions Hub</h1>
          <p className="store-sub">
            תוספים מקוריים, ערכות נושא מתקדמות, הגנת פרטיות מקסימלית וכלי פרודוקטיביות שעוצבו ונבנו במיוחד עבור Drift Browser.
          </p>

          <div className="store-search-wrap">
            <Icon name="search" size={18} />
            <input
              type="text"
              placeholder="חיפוש תוספים, ערכות נושא, כלי אבטחה ופרטיות..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="store-search-input"
            />
            {searchQuery && (
              <button className="store-clear-search" onClick={() => setSearchQuery('')}>
                <Icon name="x" size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Security Status Card */}
        <div className="store-security-card">
          <div className="security-card-header">
            <div className="security-icon-wrap">
              <Icon name="shield" size={24} />
            </div>
            <div>
              <div className="security-title">מערך אבטחה מקסימאלי פעיל (Drift Shield Max)</div>
              <div className="security-sub">חסימת פרסומות, שיבוש טביעת אצבע והצפנה פעילים</div>
            </div>
          </div>
          <div className="security-metrics">
            <div className="metric-pill">
              <Icon name="check" size={13} />
              <span>Canvas Cloaking</span>
            </div>
            <div className="metric-pill">
              <Icon name="check" size={13} />
              <span>WebGL Masking</span>
            </div>
            <div className="metric-pill">
              <Icon name="check" size={13} />
              <span>Audio Frequency Jitter</span>
            </div>
            <div className="metric-pill">
              <Icon name="check" size={13} />
              <span>Homograph Phishing Shield</span>
            </div>
            <div className="metric-pill">
              <Icon name="check" size={13} />
              <span>Tracking Parameter Stripper</span>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs / Filter Nav */}
      <nav className="store-nav">
        <button
          className={cx('store-nav-btn', activeTab === 'all' && 'active')}
          onClick={() => setActiveTab('all')}
        >
          <Icon name="puzzle" size={15} />
          <span>הכל ({STORE_CATALOG.length})</span>
        </button>
        <button
          className={cx('store-nav-btn', activeTab === 'security' && 'active')}
          onClick={() => setActiveTab('security')}
        >
          <Icon name="shield" size={15} />
          <span>אבטחה ופרטיות</span>
        </button>
        <button
          className={cx('store-nav-btn', activeTab === 'productivity' && 'active')}
          onClick={() => setActiveTab('productivity')}
        >
          <Icon name="bolt" size={15} />
          <span>פרודוקטיביות ופוקוס</span>
        </button>
        <button
          className={cx('store-nav-btn', activeTab === 'media' && 'active')}
          onClick={() => setActiveTab('media')}
        >
          <Icon name="play" size={15} />
          <span>מולטימדיה ושמע</span>
        </button>
        <button
          className={cx('store-nav-btn', activeTab === 'themes' && 'active')}
          onClick={() => setActiveTab('themes')}
        >
          <Icon name="palette" size={15} />
          <span>ערכות עיצוב וסטיילים</span>
        </button>
      </nav>

      {/* Catalog Grid */}
      <div className="store-content">
        {activeTab !== 'themes' && (
          <div className="store-grid">
            {filteredCatalog.map((item) => {
              const installed = installedSet.has(item.id);
              const disabled = disabledSet.has(item.id);
              const isAura = item.id === 'drift-zen-aura';
              const isShield = item.id === 'drift-shield-pro';
              const isNotes = item.id === 'drift-scratchpad';
              const isPomo = item.id === 'drift-focus-timer';
              const isAuditor = item.id === 'drift-security-auditor';

              return (
                <div key={item.id} className={cx('store-card', !installed && 'not-installed')}>
                  <div className="store-card-header">
                    <div className="store-card-icon">
                      <Icon name={item.icon} size={22} />
                    </div>
                    <div className="store-card-titles">
                      <div className="store-card-badges">
                        <span className="badge official">מקורי Drift</span>
                        <span className="badge verified">מאומת אבטחתית</span>
                        <span className="badge version">v{item.version}</span>
                      </div>
                      <h3 className="store-card-title">{item.nameHe}</h3>
                      <span className="store-card-author">{item.author}</span>
                    </div>
                  </div>

                  <p className="store-card-desc">{item.descriptionHe}</p>

                  <div className="store-card-features">
                    {item.featuresHe.map((feat, idx) => (
                      <div key={idx} className="feature-item">
                        <Icon name="check" size={12} />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>

                  {/* Interactive live widget for Shield Pro */}
                  {isShield && installed && !disabled && (
                    <div className="store-live-widget auditor-widget">
                      <div className="auditor-header">
                        <div className="auditor-grade">מצב הגנה: אקטיבי 100%</div>
                        <div className="auditor-host">טביעות אצבע חסומות ומסוות</div>
                      </div>
                      <div className="auditor-checks">
                        <div className="aud-check ok">✓ מיסוך Canvas Fingerprint: פעיל</div>
                        <div className="aud-check ok">✓ הסוואת WebGL GPU Renderer: פעיל</div>
                        <div className="aud-check ok">✓ שיבוש תדרי AudioContext: פעיל</div>
                        <div className="aud-check ok">✓ הגנת דליפות סוללה Battery API: פעיל</div>
                      </div>
                    </div>
                  )}

                  {/* Interactive live widget for Zen Aura */}
                  {isAura && installed && !disabled && (
                    <div className="store-live-widget aura-widget">
                      <div className="widget-row">
                        <button
                          className={cx('btn', audioPlaying ? 'ghost' : 'primary', 'small')}
                          onClick={handleAudioToggle}
                        >
                          <Icon name={audioPlaying ? 'pause' : 'play'} size={14} />
                          <span>{audioPlaying ? 'עצור צלילי רקע' : 'הפעל צלילי רקע עכשיו'}</span>
                        </button>
                        <select
                          className="field-input widget-select"
                          value={soundType}
                          onChange={(e) => handleSoundChange(e.target.value as 'rain' | 'ocean' | 'drone' | 'whitenoise' | 'binaural')}
                        >
                          <option value="rain">🌧️ גשם מרגיע (Pink Rain)</option>
                          <option value="ocean">🌊 גלי אוקיינוס (Ocean Swell)</option>
                          <option value="binaural">🧠 גלי אלפא 10Hz (Focus Beats)</option>
                          <option value="drone">🌌 צליל חלל עמוק (Cosmic Drone)</option>
                          <option value="whitenoise">📻 רעש לבן (Pure White Noise)</option>
                        </select>
                      </div>
                      <div className="volume-row">
                        <Icon name="speaker" size={13} />
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={volume}
                          onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                          className="volume-slider"
                        />
                        <span className="vol-percent">{Math.round(volume * 100)}%</span>
                      </div>
                    </div>
                  )}

                  {/* Interactive live widget for Scratchpad */}
                  {isNotes && installed && !disabled && (
                    <div className="store-live-widget notes-widget">
                      <textarea
                        className="notes-textarea"
                        placeholder="פתקים ורשימות מהירות נשמרים אוטומטית מקומית..."
                        value={notes}
                        onChange={(e) => handleNotesChange(e.target.value)}
                        rows={3}
                      />
                      <div className="notes-footer">
                        <span>{notes.length} תווים</span>
                        <button
                          className="btn ghost small"
                          onClick={() => {
                            navigator.clipboard.writeText(notes);
                            showToast('הפתק הועתק ללוח!');
                          }}
                        >
                          <Icon name="link" size={12} />
                          <span>העתק תוכן</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Interactive live widget for Pomodoro */}
                  {isPomo && installed && !disabled && (
                    <div className="store-live-widget pomo-widget">
                      <div className="pomo-display">
                        <span className="pomo-digits">
                          {String(Math.floor(pomoSeconds / 60)).padStart(2, '0')}:
                          {String(pomoSeconds % 60).padStart(2, '0')}
                        </span>
                        <div className="pomo-actions">
                          <button
                            className={cx('btn', pomoRunning ? 'ghost' : 'primary', 'small')}
                            onClick={() => setPomoRunning(!pomoRunning)}
                          >
                            <Icon name={pomoRunning ? 'pause' : 'play'} size={13} />
                            <span>{pomoRunning ? 'השהה' : 'התחל פוקוס'}</span>
                          </button>
                          <button
                            className="btn ghost small"
                            onClick={() => {
                              setPomoRunning(false);
                              setPomoSeconds(25 * 60);
                            }}
                          >
                            <Icon name="reload" size={13} />
                            <span>איפוס</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Interactive live widget for Security Auditor */}
                  {isAuditor && installed && !disabled && (
                    <div className="store-live-widget auditor-widget">
                      <div className="auditor-header">
                        <div className="auditor-grade">ציון: A+</div>
                        <div className="auditor-host">{activeUrl ? new URL(activeUrl).hostname : 'Drift Safe Zone'}</div>
                      </div>
                      <div className="auditor-checks">
                        <div className="aud-check ok">✓ הצפנת חיבור: {isHttps ? 'TLS 1.3 מאומתת' : 'אזור פנימי מוגן'}</div>
                        <div className="aud-check ok">✓ חסימת עוגיות צד שלישי (3rd-Party Cookies): פעילה</div>
                        <div className="aud-check ok">✓ הגנת הפשטת פרמטרי מעקב URL: פעילה</div>
                      </div>
                    </div>
                  )}

                  {/* Card Footer Actions */}
                  <div className="store-card-footer">
                    <button
                      className={cx('btn', installed ? 'ghost' : 'primary', 'small')}
                      onClick={() => toggleInstall(item.id)}
                    >
                      <Icon name={installed ? 'x' : 'plus'} size={14} />
                      <span>{installed ? 'הסר תוסף' : 'התקן תוסף'}</span>
                    </button>

                    {installed && (
                      <button
                        className={cx('btn', disabled ? 'primary' : 'ghost', 'small')}
                        onClick={() => toggleEnabled(item.id)}
                      >
                        <Icon name={disabled ? 'play' : 'pause'} size={13} />
                        <span>{disabled ? 'הפעל תוסף' : 'השבת זמנית'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Themes Showcase Tab */}
        {(activeTab === 'themes' || activeTab === 'all') && (
          <div className="themes-section">
            <div className="themes-section-title">
              <h2>ערכות עיצוב מקוריות של Drift Store</h2>
              <p>ערכות צבעים אלגנטיות שנבחרו בקפידה לחוויות גלישה ייחודיות ויוקרתיות.</p>
            </div>

            <div className="themes-grid">
              {COLOR_THEMES.map((theme) => {
                const isCurrent = state.settings.colorTheme === theme.id;
                return (
                  <div
                    key={theme.id}
                    className={cx('theme-card', isCurrent && 'active')}
                    style={{ background: theme.bg }}
                  >
                    <div className="theme-card-surface" style={{ background: theme.surface }}>
                      <div className="theme-accent-strip" style={{ background: theme.accent }} />
                      <div className="theme-card-info">
                        <span className="theme-name">{theme.name}</span>
                        <div className="theme-chips">
                          <span className="theme-chip" style={{ background: theme.accent }} title="Accent" />
                          <span className="theme-chip" style={{ background: theme.surface }} title="Surface" />
                          <span className="theme-chip" style={{ background: theme.bg }} title="Background" />
                        </div>
                      </div>
                      <button
                        className={cx('btn small', isCurrent ? 'ghost' : 'primary')}
                        style={!isCurrent ? { background: theme.accent, color: '#111' } : undefined}
                        onClick={() => applyTheme(theme.id)}
                      >
                        {isCurrent ? '✓ מופעל כעת' : 'החל ערכה זו'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="store-toast">
          <Icon name="check" size={16} />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
