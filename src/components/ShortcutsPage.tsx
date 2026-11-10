import { useState, useMemo, useEffect, useRef } from 'react';
import type { BrowserState } from '../../shared/types';
import { cmd, cx } from '../lib';
import { Icon, type IconName } from './Icon';
import { openShellPopover } from './PageActions';

interface ShortcutDef {
  id: string;
  category: 'tabs' | 'nav' | 'split' | 'tools' | 'security';
  titleHe: string;
  descHe: string;
  defaultKeys: string[];
  icon: IconName;
  action?: () => void;
}

const BASE_SHORTCUTS: ShortcutDef[] = [
  {
    id: 'new-tab',
    category: 'tabs',
    titleHe: 'כרטיסייה חדשה ושורת חיפוש צפה',
    descHe: 'פותח את שורת הכתובות המרחפת להקלדת כתובת או שאילתת חיפוש',
    defaultKeys: ['Ctrl', 'T'],
    icon: 'plus',
    action: () => cmd({ type: 'tab:new' }),
  },
  {
    id: 'close-tab',
    category: 'tabs',
    titleHe: 'סגירת הכרטיסייה הפעילה',
    descHe: 'סוגר מיידית את הכרטיסייה הנוכחית',
    defaultKeys: ['Ctrl', 'W'],
    icon: 'x',
    action: () => cmd({ type: 'tab:close' }),
  },
  {
    id: 'reopen-tab',
    category: 'tabs',
    titleHe: 'פתיחה מחדש של כרטיסייה שנסגרה',
    descHe: 'משחזר את הכרטיסייה האחרונה שנסגרה כולל היסטוריית הגלישה שלה',
    defaultKeys: ['Ctrl', 'Shift', 'T'],
    icon: 'reload',
    action: () => cmd({ type: 'tab:reopen' }),
  },
  {
    id: 'cycle-tab',
    category: 'tabs',
    titleHe: 'מעבר לכרטיסייה הבאה / הקודמת',
    descHe: 'דפדוף מהיר בין כל הכרטיסיות הפתוחות',
    defaultKeys: ['Ctrl', 'Tab'],
    icon: 'next',
    action: () => cmd({ type: 'tab:cycle', dir: 1 }),
  },
  {
    id: 'incognito',
    category: 'security',
    titleHe: 'חלון גלישה בסתר חדש (Incognito)',
    descHe: 'פותח חלון גלישה מבודד שאינו שומר היסטוריה, עוגיות או מטמון',
    defaultKeys: ['Ctrl', 'Shift', 'N'],
    icon: 'shield',
    action: () => cmd({ type: 'win:incognito' }),
  },
  {
    id: 'clear-browsing-data',
    category: 'security',
    titleHe: 'מחיקת נתוני גלישה ומטמון (Clear Browsing Data)',
    descHe: 'דיאלוג מחיקת היסטוריה, עוגיות, נתוני אתרים ומטמון לפי טווחי זמן',
    defaultKeys: ['Ctrl', 'Shift', 'Del'],
    icon: 'trash',
    action: () => cmd({ type: 'tab:new', url: 'drift://history?clear=true' }),
  },
  {
    id: 'sidepanel',
    category: 'tools',
    titleHe: 'חלונית הצד של כרום (Chrome Side Panel)',
    descHe: 'פתיחת סרגל הצד עם רשימת קריאה (Reading List), סימניות ופתקים',
    defaultKeys: ['Ctrl', 'Shift', 'P'],
    icon: 'sidebar',
    action: () => openShellPopover('sidepanel'),
  },
  {
    id: 'task-mgr',
    category: 'tools',
    titleHe: 'מנהל המשימות של הדפדפן (Task Manager)',
    descHe: 'צפייה בצריכת זיכרון, מעבד ומשאבים של כל כרטיסייה וסיום תהליכים',
    defaultKeys: ['Shift', 'Esc'],
    icon: 'bolt',
    action: () => cmd({ type: 'win:taskManager' }),
  },
  {
    id: 'reader-mode',
    category: 'nav',
    titleHe: 'מצב קריאה מתקדם (Reader Mode Pro)',
    descHe: 'ניקוי פרסומות, שמירה ל-Markdown, הדפסת PDF נקייה והקראה קולית חיה (TTS)',
    defaultKeys: ['F9'],
    icon: 'book',
    action: () => cmd({ type: 'page:readingMode' }),
  },
  {
    id: 'media-hub',
    category: 'tools',
    titleHe: 'בקרת מדיה וסאונד גלובלית (Global Media Hub & 300% Booster)',
    descHe: 'שליטה מרכזית בנגני וידאו ומוזיקה, הגברת ווליום עד 300% ומעבר שירים',
    defaultKeys: ['Ctrl', 'Alt', 'M'],
    icon: 'music',
    action: () => openShellPopover('media'),
  },
  {
    id: 'pip',
    category: 'tools',
    titleHe: 'תמונה בתוך תמונה (Picture-in-Picture)',
    descHe: 'הוצאת סרטון הווידאו בדף לתוך חלון צף מעל שאר האפליקציות',
    defaultKeys: ['Alt', 'P'],
    icon: 'pip',
    action: () => cmd({ type: 'page:pip' }),
  },
  {
    id: 'split-view',
    category: 'split',
    titleHe: 'פיצול מסך ל-2 כרטיסיות (Split Screen)',
    descHe: 'הצגת שתי כרטיסיות זו לצד זו ביחסי מסך 50:50, 70:30 או 30:70',
    defaultKeys: ['Ctrl', 'Alt', 'V'],
    icon: 'split',
    action: () => cmd({ type: 'split:toggle' }),
  },
  {
    id: 'switch-space',
    category: 'split',
    titleHe: 'מעבר בין מרחבי עבודה (Spaces)',
    descHe: 'דפדוף חלק בין מרחב עבודה אישי, עבודה, לימודים ומדיה',
    defaultKeys: ['Ctrl', 'Alt', '→'],
    icon: 'work',
    action: () => cmd({ type: 'space:cycle', dir: 1 }),
  },
  {
    id: 'compact-mode',
    category: 'split',
    titleHe: 'מצב קומפקטי / מסך מלא',
    descHe: 'הסתרת סרגל הצד עד למעבר עכבר בקצה השמאלי של המסך',
    defaultKeys: ['Ctrl', 'Alt', 'C'],
    icon: 'sidebar',
    action: () => cmd({ type: 'ui:compact' }),
  },
  {
    id: 'store',
    category: 'tools',
    titleHe: 'חנות התוספים וההרחבות (Drift Store)',
    descHe: 'פתיחה מיידית של חנות התוספים, ערכות הנושא וכלי הפרודוקטיביות',
    defaultKeys: ['Ctrl', 'Shift', 'E'],
    icon: 'puzzle',
    action: () => cmd({ type: 'store:open' }),
  },
  {
    id: 'bookmarks',
    category: 'tools',
    titleHe: 'מנהל הסימניות (Bookmarks Manager)',
    descHe: 'פתיחת מנהל הסימניות לחיפוש, ארגון וייצוא סימניות לקובץ HTML',
    defaultKeys: ['Ctrl', 'Shift', 'O'],
    icon: 'star',
    action: () => cmd({ type: 'bookmarks:open' }),
  },
  {
    id: 'history',
    category: 'tools',
    titleHe: 'היסטוריית גלישה (Browsing History)',
    descHe: 'פתיחת עמוד היסטוריית הגלישה, חיפוש ביקורים ומחיקת נתונים ומטמון',
    defaultKeys: ['Ctrl', 'H'],
    icon: 'clock',
    action: () => cmd({ type: 'history:open' }),
  },
  {
    id: 'downloads',
    category: 'tools',
    titleHe: 'מנהל ההורדות (Downloads Hub)',
    descHe: 'פתיחת מנהל ההורדות, צפייה בקבצים ופתיחה ישירה בתיקייה',
    defaultKeys: ['Ctrl', 'J'],
    icon: 'download',
    action: () => cmd({ type: 'downloads:open' }),
  },
  {
    id: 'settings',
    category: 'tools',
    titleHe: 'הגדרות הדפדפן (Settings)',
    descHe: 'פתיחת לוח ההגדרות המלא בסגנון Google Chrome',
    defaultKeys: ['Ctrl', ','],
    icon: 'gear',
    action: () => cmd({ type: 'settings:open' }),
  },
  {
    id: 'site-settings',
    category: 'security',
    titleHe: 'הגדרות אתרים והרשאות תוכן (Site Settings)',
    descHe: 'שליטה על הרשאות מצלמה, מיקרופון, מיקום, התראות ועוגיות',
    defaultKeys: ['drift://site-settings'],
    icon: 'shield',
    action: () => cmd({ type: 'tab:new', url: 'drift://site-settings' }),
  },
  {
    id: 'cookies',
    category: 'security',
    titleHe: 'חוקר עוגיות ונתוני אתרים (Cookies Explorer)',
    descHe: 'צפייה, עריכה ומחיקה של נתוני Cookie ואחסון מקומי לפי דומיין',
    defaultKeys: ['drift://cookies'],
    icon: 'shield',
    action: () => cmd({ type: 'cookies:open' }),
  },
  {
    id: 'autofill',
    category: 'tools',
    titleHe: 'מילוי אוטומטי, כרטיסי אשראי וכתובות (Autofill)',
    descHe: 'ניהול כרטיסי תשלום מוצפנים ב-Windows DPAPI וכתובות משלוח',
    defaultKeys: ['drift://autofill'],
    icon: 'key',
    action: () => cmd({ type: 'autofill:open' }),
  },
  {
    id: 'performance',
    category: 'tools',
    titleHe: 'לוח ביצועים וחיסכון בזיכרון (Memory Saver)',
    descHe: 'ניטור צריכת RAM של כרטיסיות, שחרור זיכרון וניהול חוסך הסוללה',
    defaultKeys: ['drift://performance'],
    icon: 'bolt',
    action: () => cmd({ type: 'performance:open' }),
  },
  {
    id: 'find-page',
    category: 'nav',
    titleHe: 'חיפוש טקסט בדף (Find on page)',
    descHe: 'איתור מילים ומחרוזות טקסט בתוך דף האינטרנט הפעיל',
    defaultKeys: ['Ctrl', 'F'],
    icon: 'search',
    action: () => window.dispatchEvent(new CustomEvent('drift:find')),
  },
  {
    id: 'zoom-in',
    category: 'nav',
    titleHe: 'הגדלת תצוגת דף (Zoom in)',
    descHe: 'הגדלת גודל הטקסט והתמונות באתר הפעיל',
    defaultKeys: ['Ctrl', '+'],
    icon: 'up',
    action: () => cmd({ type: 'zoom', dir: 1 }),
  },
  {
    id: 'zoom-out',
    category: 'nav',
    titleHe: 'הקטנת תצוגת דף (Zoom out)',
    descHe: 'הקטנת גודל הטקסט והתמונות באתר הפעיל',
    defaultKeys: ['Ctrl', '-'],
    icon: 'down',
    action: () => cmd({ type: 'zoom', dir: -1 }),
  },
  {
    id: 'zoom-reset',
    category: 'nav',
    titleHe: 'איפוס מרחק תצוגה ל-100%',
    descHe: 'החזרת רמת הזום לגודל המקורי הרגיל',
    defaultKeys: ['Ctrl', '0'],
    icon: 'reload',
    action: () => cmd({ type: 'zoom', dir: 0 }),
  },
  {
    id: 'devtools',
    category: 'tools',
    titleHe: 'כלי מפתחים של Chromium (DevTools)',
    descHe: 'בדיקת אלמנטים, מסוף Console וניטור רשת Network',
    defaultKeys: ['F12'],
    icon: 'bolt',
  },
];

export function ShortcutsPage({ state: _state }: { state: BrowserState }) {
  const [query, setQuery] = useState('');
  const [activeCat, setActiveCat] = useState<'all' | 'tabs' | 'nav' | 'split' | 'tools' | 'security'>('all');
  const [toast, setToast] = useState<string | null>(null);

  // Custom keybindings persistence in localStorage
  const [customKeybindings, setCustomKeybindings] = useState<Record<string, string[]>>(() => {
    try {
      const saved = localStorage.getItem('drift:custom-shortcuts');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Editing state for keybinding
  const [editingId, setEditingId] = useState<string | null>(null);
  const [recordedKeys, setRecordedKeys] = useState<string[]>([]);

  // Live Shortcut Detector / Key Sandbox
  const [detectedKeys, setDetectedKeys] = useState<string[]>([]);
  const detectorRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const saveCustomBinding = (id: string, keys: string[]) => {
    const updated = { ...customKeybindings, [id]: keys };
    setCustomKeybindings(updated);
    try {
      localStorage.setItem('drift:custom-shortcuts', JSON.stringify(updated));
    } catch {}
    showToast('הקיצור המותאם אישית נשמר בהצלחה!');
    setEditingId(null);
    setRecordedKeys([]);
  };

  const resetSingleBinding = (id: string) => {
    const updated = { ...customKeybindings };
    delete updated[id];
    setCustomKeybindings(updated);
    try {
      localStorage.setItem('drift:custom-shortcuts', JSON.stringify(updated));
    } catch {}
    showToast('הקיצור אופס לברירת המחדל');
  };

  const resetAllBindings = () => {
    if (confirm('האם אתה בטוח שברצונך לאפס את כל קיצורי המקלדת המותאמים אישית לברירת המחדל?')) {
      setCustomKeybindings({});
      try {
        localStorage.removeItem('drift:custom-shortcuts');
      } catch {}
      showToast('כל קיצורי המקלדת אופסו בהצלחה!');
    }
  };

  // Live Shortcut Detector listener on sandbox box
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when typing in regular search input
      if (
        (e.target as HTMLElement).tagName === 'INPUT' &&
        (e.target as HTMLElement).getAttribute('type') === 'text' &&
        e.target !== detectorRef.current
      ) {
        return;
      }

      const keys: string[] = [];
      if (e.ctrlKey) keys.push('Ctrl');
      if (e.shiftKey) keys.push('Shift');
      if (e.altKey) keys.push('Alt');

      const k = e.key;
      if (!['Control', 'Shift', 'Alt'].includes(k)) {
        keys.push(k.length === 1 ? k.toUpperCase() : k);
      }

      if (keys.length > 0) {
        setDetectedKeys(keys);
        if (editingId) {
          setRecordedKeys(keys);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingId]);

  // Find shortcut matching detected keys
  const detectedShortcut = useMemo(() => {
    if (detectedKeys.length === 0) return null;
    const str = detectedKeys.join('+').toLowerCase();
    return BASE_SHORTCUTS.find((s) => {
      const activeKeys = customKeybindings[s.id] || s.defaultKeys;
      return activeKeys.join('+').toLowerCase() === str;
    });
  }, [detectedKeys, customKeybindings]);

  // Export Cheat Sheet as Markdown
  const handleExportMarkdown = () => {
    let md = '# ⌨️ Drift Browser — קיצורי מקלדת ופקודות מהירות\\n\\n';
    md += '> תאריך ייצוא: ' + new Date().toLocaleDateString('he-IL') + '\\n\\n';
    md += '| פקודה / פעולה | קיצור מקשים | תיאור |\\n';
    md += '| :--- | :--- | :--- |\\n';

    BASE_SHORTCUTS.forEach((s) => {
      const k = (customKeybindings[s.id] || s.defaultKeys).map((x) => `\`${x}\``).join(' + ');
      md += `| **${s.titleHe}** | ${k} | ${s.descHe} |\\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'drift-keyboard-shortcuts.md';
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('קובץ קיצורי המקלדת יוצא בהצלחה כ-Markdown!');
  };

  const filtered = useMemo(() => {
    return BASE_SHORTCUTS.filter((s) => {
      const matchCat = activeCat === 'all' || s.category === activeCat;
      const q = query.trim().toLowerCase();
      const keys = customKeybindings[s.id] || s.defaultKeys;
      const matchQuery =
        !q ||
        s.titleHe.toLowerCase().includes(q) ||
        s.descHe.toLowerCase().includes(q) ||
        keys.join(' ').toLowerCase().includes(q);
      return matchCat && matchQuery;
    });
  }, [activeCat, query, customKeybindings]);

  return (
    <div className="shortcuts-page" dir="rtl">
      {/* Top Header */}
      <header className="shortcuts-header">
        <div className="shortcuts-header-content">
          <div className="shortcuts-badge">
            <Icon name="sliders" size={14} />
            <span>מרכז קיצורי מקלדת, פקודות והתאמה אישית של Drift</span>
          </div>
          <h1>קיצורי מקלדת ופקודות מהירות (Hotkeys Hub)</h1>
          <p className="shortcuts-sub">
            שלטו בדפדפן במהירות שיא. בדקו מקשים בזמן אמת, התאימו קיצורים אישיים, או בצעו כל פקודה בלחיצה מיידית.
          </p>
        </div>

        <div className="shortcuts-header-actions-col">
          <div className="shortcuts-search-wrap">
            <Icon name="search" size={16} />
            <input
              className="shortcuts-search-input"
              placeholder="חיפוש קיצור, פעולה או מקש (לדוגמה: Ctrl+T, F9, פיצול, זום)..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button className="shortcuts-clear-btn" onClick={() => setQuery('')}>
                <Icon name="x" size={13} />
              </button>
            )}
          </div>

          <div className="shortcuts-top-btns-row">
            <button className="btn small ghost" onClick={handleExportMarkdown} title="ייצא דף עזר כ-Markdown">
              <Icon name="book" size={13} />
              <span>ייצוא Markdown</span>
            </button>
            <button className="btn small ghost" onClick={() => window.print()} title="הדפס דף קיצורים">
              <Icon name="down" size={13} />
              <span>הדפסת דף קיצורים</span>
            </button>
            {Object.keys(customKeybindings).length > 0 && (
              <button className="btn small ghost danger" onClick={resetAllBindings}>
                <Icon name="reload" size={13} />
                <span>איפוס כל הקיצורים</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Live Shortcut Detector / Interactive Sandbox */}
      <section className="shortcut-tester-card">
        <div className="tester-header-row">
          <div className="tester-title-wrap">
            <Icon name="bolt" size={18} />
            <span>בודק מקשים אינטראקטיבי בזמן אמת (Live Key Sandbox)</span>
          </div>
          <span className="tester-hint">לחץ על כל צירוף מקשים במקלדת כדי לזהות את הפעולה המתאימה...</span>
        </div>

        <div className="tester-display-area" ref={detectorRef} tabIndex={0}>
          {detectedKeys.length > 0 ? (
            <div className="tester-keys-detected">
              <div className="detected-keys-row">
                {detectedKeys.map((k, i) => (
                  <span key={i} className="tester-key-wrap">
                    <kbd className="tester-kbd">{k}</kbd>
                    {i < detectedKeys.length - 1 && <span className="tester-plus">+</span>}
                  </span>
                ))}
              </div>

              {detectedShortcut ? (
                <div className="detected-match-pill ok">
                  <Icon name="check" size={14} />
                  <span>
                    זוהתה פעולה: <strong>{detectedShortcut.titleHe}</strong>
                  </span>
                  {detectedShortcut.action && (
                    <button
                      className="btn small primary"
                      style={{ padding: '2px 10px', height: '24px', fontSize: '11px', marginRight: '10px' }}
                      onClick={() => {
                        detectedShortcut.action?.();
                        showToast(`הופעלה הפקודה: ${detectedShortcut.titleHe}`);
                      }}
                    >
                      בצע פקודה זו
                    </button>
                  )}
                </div>
              ) : (
                <div className="detected-match-pill none">
                  <span>לא מוגדרת פעולת ברירת מחדל לצירוף זה בדפדפן</span>
                </div>
              )}
            </div>
          ) : (
            <div className="tester-placeholder">
              <Icon name="sliders" size={20} />
              <span>המערכת מאזינה להקלדה שלך... הקש Ctrl+Shift+T, F9, Shift+Esc או כל צירוף אחר</span>
            </div>
          )}
        </div>
      </section>

      {/* Category Filter Navigation */}
      <nav className="shortcuts-nav">
        <button className={cx('shortcuts-nav-btn', activeCat === 'all' && 'active')} onClick={() => setActiveCat('all')}>
          <Icon name="sliders" size={14} />
          <span>כל הקיצורים ({BASE_SHORTCUTS.length})</span>
        </button>
        <button className={cx('shortcuts-nav-btn', activeCat === 'tabs' && 'active')} onClick={() => setActiveCat('tabs')}>
          <Icon name="plus" size={14} />
          <span>כרטיסיות וחלונות</span>
        </button>
        <button className={cx('shortcuts-nav-btn', activeCat === 'nav' && 'active')} onClick={() => setActiveCat('nav')}>
          <Icon name="search" size={14} />
          <span>ניווט ושורת כתובות</span>
        </button>
        <button className={cx('shortcuts-nav-btn', activeCat === 'split' && 'active')} onClick={() => setActiveCat('split')}>
          <Icon name="split" size={14} />
          <span>מסך מפוצל ומרחבים</span>
        </button>
        <button className={cx('shortcuts-nav-btn', activeCat === 'security' && 'active')} onClick={() => setActiveCat('security')}>
          <Icon name="shield" size={14} />
          <span>אבטחה ופרטיות</span>
        </button>
        <button className={cx('shortcuts-nav-btn', activeCat === 'tools' && 'active')} onClick={() => setActiveCat('tools')}>
          <Icon name="bolt" size={14} />
          <span>כלים, מפתחים וביצועים</span>
        </button>
      </nav>

      {/* Shortcuts Grid */}
      <div className="shortcuts-grid">
        {filtered.map((item) => {
          const isCustom = !!customKeybindings[item.id];
          const currentKeys = customKeybindings[item.id] || item.defaultKeys;
          const isEditing = editingId === item.id;

          return (
            <div key={item.id} className={cx('shortcut-card', isCustom && 'is-custom')}>
              <div className="shortcut-card-header">
                <div className="shortcut-icon-wrap">
                  <Icon name={item.icon} size={18} />
                </div>

                <div className="shortcut-keys-row">
                  {currentKeys.map((k, idx) => (
                    <span key={idx} className="key-wrap">
                      <kbd className="shortcut-key">{k}</kbd>
                      {idx < currentKeys.length - 1 && <span className="key-plus">+</span>}
                    </span>
                  ))}
                  {isCustom && <span className="custom-badge-pill">מותאם</span>}
                </div>
              </div>

              <h3 className="shortcut-title">{item.titleHe}</h3>
              <p className="shortcut-desc">{item.descHe}</p>

              {/* Editing keybinding view */}
              {isEditing ? (
                <div className="shortcut-editor-box">
                  <span className="editor-prompt">הקש כעת על צירוף המקשים החדש...</span>
                  <div className="editor-keys-preview">
                    {recordedKeys.length > 0 ? (
                      recordedKeys.map((k, i) => (
                        <span key={i} className="key-wrap">
                          <kbd className="shortcut-key active">{k}</kbd>
                          {i < recordedKeys.length - 1 && <span className="key-plus">+</span>}
                        </span>
                      ))
                    ) : (
                      <span className="editor-waiting">ממתין להקשה...</span>
                    )}
                  </div>
                  <div className="editor-actions">
                    <button
                      className="btn small primary"
                      disabled={recordedKeys.length === 0}
                      onClick={() => saveCustomBinding(item.id, recordedKeys)}
                    >
                      שמור
                    </button>
                    <button className="btn small ghost" onClick={() => setEditingId(null)}>
                      ביטול
                    </button>
                  </div>
                </div>
              ) : (
                <div className="shortcut-card-footer">
                  <div className="footer-left-btns">
                    {item.action ? (
                      <button
                        className="btn small ghost action-run-btn"
                        onClick={() => {
                          item.action?.();
                          showToast(`הופעלה הפקודה: ${item.titleHe}`);
                        }}
                      >
                        <Icon name="play" size={12} />
                        <span>בצע עכשיו</span>
                      </button>
                    ) : (
                      <span className="shortcut-system-tag">קיצור מערכת</span>
                    )}

                    <button
                      className="btn small ghost customize-btn"
                      onClick={() => {
                        setEditingId(item.id);
                        setRecordedKeys([]);
                      }}
                      title="הגדר מקש מותאם אישית לפקודה זו"
                    >
                      <Icon name="sliders" size={12} />
                      <span>התאם מקש</span>
                    </button>

                    {isCustom && (
                      <button
                        className="btn small ghost reset-btn"
                        onClick={() => resetSingleBinding(item.id)}
                        title="החזר לברירת המחדל המקורית"
                      >
                        <Icon name="reload" size={11} />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="empty-shortcuts">
          <Icon name="search" size={32} />
          <p>לא נמצאו קיצורי מקלדת התואמים את החיפוש "{query}"</p>
        </div>
      )}

      {/* Floating Action Toast */}
      {toast && (
        <div className="shortcuts-toast">
          <Icon name="check" size={15} />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
