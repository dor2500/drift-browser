import { useState, useMemo } from 'react';
import type { BrowserState } from '../../shared/types';
import { cmd, cx } from '../lib';
import { Icon, type IconName } from './Icon';

interface ShortcutDef {
  id: string;
  category: 'tabs' | 'nav' | 'split' | 'tools' | 'security';
  titleHe: string;
  descHe: string;
  keys: string[];
  icon: IconName;
  action?: () => void;
}

export function ShortcutsPage({ state: _state }: { state: BrowserState }) {
  const [query, setQuery] = useState('');
  const [activeCat, setActiveCat] = useState<'all' | 'tabs' | 'nav' | 'split' | 'tools' | 'security'>('all');
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const SHORTCUTS: ShortcutDef[] = useMemo(
    () => [
      {
        id: 'new-tab',
        category: 'tabs',
        titleHe: 'כרטיסייה חדשה ושורת חיפוש צפה',
        descHe: 'פותח את שורת הכתובות המרחפת להקלדת כתובת או שאילתת חיפוש',
        keys: ['Ctrl', 'T'],
        icon: 'plus',
        action: () => cmd({ type: 'tab:new' }),
      },
      {
        id: 'close-tab',
        category: 'tabs',
        titleHe: 'סגירת הכרטיסייה הפעילה',
        descHe: 'סוגר מיידית את הכרטיסייה הנוכחית',
        keys: ['Ctrl', 'W'],
        icon: 'x',
        action: () => cmd({ type: 'tab:close' }),
      },
      {
        id: 'reopen-tab',
        category: 'tabs',
        titleHe: 'פתיחה מחדש של כרטיסייה שנסגרה',
        descHe: 'משחזר את הכרטיסייה האחרונה שנסגרה כולל היסטוריית הגלישה שלה',
        keys: ['Ctrl', 'Shift', 'T'],
        icon: 'reload',
        action: () => cmd({ type: 'tab:reopen' }),
      },
      {
        id: 'cycle-tab',
        category: 'tabs',
        titleHe: 'מעבר לכרטיסייה הבאה / הקודמת',
        descHe: 'דפדוף מהיר בין כל הכרטיסיות הפתוחות',
        keys: ['Ctrl', 'Tab'],
        icon: 'next',
        action: () => cmd({ type: 'tab:cycle', dir: 1 }),
      },
      {
        id: 'incognito',
        category: 'security',
        titleHe: 'חלון גלישה בסתר חדש (Incognito)',
        descHe: 'פותח חלון גלישה מבודד שאינו שומר היסטוריה, עוגיות או מטמון',
        keys: ['Ctrl', 'Shift', 'N'],
        icon: 'shield',
        action: () => cmd({ type: 'win:incognito' }),
      },
      {
        id: 'store',
        category: 'tools',
        titleHe: 'חנות התוספים וההרחבות (Drift Store)',
        descHe: 'פתיחה מיידית של חנות התוספים, ערכות הנושא וכלי הפרודוקטיביות',
        keys: ['Ctrl', 'Shift', 'E'],
        icon: 'puzzle',
        action: () => cmd({ type: 'store:open' }),
      },
      {
        id: 'bookmarks',
        category: 'tools',
        titleHe: 'מנהל הסימניות (Bookmarks Manager)',
        descHe: 'פתיחת מנהל הסימניות לחיפוש, ארגון וייצוא סימניות לקובץ HTML',
        keys: ['Ctrl', 'Shift', 'O'],
        icon: 'book',
        action: () => cmd({ type: 'bookmarks:open' }),
      },
      {
        id: 'sessions',
        category: 'tools',
        titleHe: 'סשנים שמורים ושמירת כרטיסיות (Tab Stash)',
        descHe: 'פתיחת מנהל הסשנים לשמירת כרטיסיות פתוחות, פינוי זיכרון ושחזור סשנים',
        keys: ['Ctrl', 'Shift', 'S'],
        icon: 'inbox',
        action: () => cmd({ type: 'sessions:open' }),
      },
      {
        id: 'shortcuts',
        category: 'tools',
        titleHe: 'לוח קיצורי מקלדת זה',
        descHe: 'הצגת רשימת כל קיצורי הדרך והפעולות המהירות בדפדפן',
        keys: ['Ctrl', '/'],
        icon: 'sliders',
      },
      {
        id: 'performance',
        category: 'tools',
        titleHe: 'לוח ביצועים וזיכרון (Performance Dashboard)',
        descHe: 'ניטור צריכת RAM של כרטיסיות, שחרור זיכרון וניהול חוסך הסוללה',
        keys: ['Shift', 'Esc / drift://perf'],
        icon: 'bolt',
        action: () => cmd({ type: 'performance:open' }),
      },
      {
        id: 'settings',
        category: 'tools',
        titleHe: 'הגדרות הדפדפן (Settings)',
        descHe: 'פתיחת לוח ההגדרות המלא בסגנון Google Chrome',
        keys: ['Ctrl', ','],
        icon: 'gear',
        action: () => cmd({ type: 'settings:open' }),
      },
      {
        id: 'bookmarks-bar',
        category: 'nav',
        titleHe: 'הצגה / הסתרה של סרגל הסימניות',
        descHe: 'החלפה מהירה של מצב סרגל הסימניות העליון',
        keys: ['Ctrl', 'Shift', 'B'],
        icon: 'star',
      },
      {
        id: 'task-mgr',
        category: 'tools',
        titleHe: 'מנהל המשימות של הדפדפן (Task Manager)',
        descHe: 'צפייה בצריכת זיכרון, מעבד ומשאבים של כל כרטיסייה ותהליך',
        keys: ['Shift', 'Esc'],
        icon: 'bolt',
        action: () => cmd({ type: 'win:taskManager' }),
      },
      {
        id: 'clear-data',
        category: 'security',
        titleHe: 'ניקוי נתוני גלישה מהיר',
        descHe: 'מעבר ישיר לחלונית מחיקת היסטוריה, קובצי Cookie ומטמון',
        keys: ['Ctrl', 'Shift', 'Del'],
        icon: 'trash',
        action: () => cmd({ type: 'settings:open' }),
      },
      {
        id: 'split-view',
        category: 'split',
        titleHe: 'פיצול מסך ל-2 כרטיסיות (Split Screen)',
        descHe: 'הצגת שתי כרטיסיות זו לצד זו ביחסי מסך 50:50, 70:30 או 30:70',
        keys: ['Ctrl', 'Alt', 'V'],
        icon: 'split',
        action: () => cmd({ type: 'split:toggle' }),
      },
      {
        id: 'reader-mode',
        category: 'nav',
        titleHe: 'מצב קריאה מתקדם (Reader Mode Pro)',
        descHe: 'ניקוי פרסומות, שינוי גופן וגודל, רקע ספיה והקראה קולית חיה (TTS)',
        keys: ['F9', 'Ctrl+Alt+R'],
        icon: 'book',
        action: () => cmd({ type: 'page:readingMode' }),
      },
      {
        id: 'switch-space',
        category: 'split',
        titleHe: 'מעבר בין מרחבי עבודה (Spaces)',
        descHe: 'דפדוף חלק בין מרחב עבודה אישי, עבודה, לימודים ומדיה',
        keys: ['Ctrl', 'Alt', '→ / ←'],
        icon: 'work',
        action: () => cmd({ type: 'space:cycle', dir: 1 }),
      },
      {
        id: 'compact-mode',
        category: 'split',
        titleHe: 'מצב קומפקטי / מסך מלא',
        descHe: 'הסתרת סרגל הצד עד למעבר עכבר בקצה השמאלי של המסך',
        keys: ['Ctrl', 'Alt', 'C'],
        icon: 'sidebar',
        action: () => cmd({ type: 'ui:compact' }),
      },
      {
        id: 'find-page',
        category: 'nav',
        titleHe: 'חיפוש טקסט בדף (Find on page)',
        descHe: 'איתור מילים ומחרוזות טקסט בתוך דף האינטרנט הפעיל',
        keys: ['Ctrl', 'F'],
        icon: 'search',
        action: () => window.dispatchEvent(new CustomEvent('drift:find')),
      },
      {
        id: 'zoom-in',
        category: 'nav',
        titleHe: 'הגדלת תצוגת דף (Zoom in)',
        descHe: 'הגדלת גודל הטקסט והתמונות באתר הפעיל',
        keys: ['Ctrl', '+'],
        icon: 'up',
        action: () => cmd({ type: 'zoom', dir: 1 }),
      },
      {
        id: 'zoom-out',
        category: 'nav',
        titleHe: 'הקטנת תצוגת דף (Zoom out)',
        descHe: 'הקטנת גודל הטקסט והתמונות באתר הפעיל',
        keys: ['Ctrl', '-'],
        icon: 'down',
        action: () => cmd({ type: 'zoom', dir: -1 }),
      },
      {
        id: 'zoom-reset',
        category: 'nav',
        titleHe: 'איפוס מרחק תצוגה ל-100%',
        descHe: 'החזרת רמת הזום לגודל המקורי הרגיל',
        keys: ['Ctrl', '0'],
        icon: 'reload',
        action: () => cmd({ type: 'zoom', dir: 0 }),
      },
      {
        id: 'caret-browsing',
        category: 'tools',
        titleHe: 'ניווט בסמן מקלדת (Caret Browsing)',
        descHe: 'הפעלת סמן טקסט לניווט ובחירה באמצעות מקשי החצים',
        keys: ['F7'],
        icon: 'sliders',
      },
      {
        id: 'devtools',
        category: 'tools',
        titleHe: 'כלי מפתחים של Chromium (DevTools)',
        descHe: 'בדיקת אלמנטים, מסוף Console וניטור רשת Network',
        keys: ['F12'],
        icon: 'bolt',
      },
    ],
    []
  );

  const filtered = useMemo(() => {
    return SHORTCUTS.filter((s) => {
      const matchCat = activeCat === 'all' || s.category === activeCat;
      const q = query.trim().toLowerCase();
      const matchQuery =
        !q ||
        s.titleHe.toLowerCase().includes(q) ||
        s.descHe.toLowerCase().includes(q) ||
        s.keys.join(' ').toLowerCase().includes(q);
      return matchCat && matchQuery;
    });
  }, [SHORTCUTS, activeCat, query]);

  return (
    <div className="shortcuts-page">
      {/* Header */}
      <header className="shortcuts-header">
        <div className="shortcuts-header-content">
          <div className="shortcuts-badge">
            <Icon name="sliders" size={14} />
            <span>מרכז השליטה וקיצורי המקלדת של Drift</span>
          </div>
          <h1>קיצורי מקלדת ופקודות מהירות</h1>
          <p className="shortcuts-sub">
            גלו את כל צירופי המקשים שיעזרו לכם לגלוש במהירות שיא. לחצו על "בצע עכשיו" לבדיקה מיידית של כל פקודה.
          </p>
        </div>

        <div className="shortcuts-search-wrap">
          <Icon name="search" size={16} />
          <input
            className="shortcuts-search-input"
            placeholder="חפש קיצור, פעולה או מקש (לדוגמה: Ctrl+T, פיצול, זום, אבטחה)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button className="shortcuts-clear-btn" onClick={() => setQuery('')}>
              <Icon name="x" size={13} />
            </button>
          )}
        </div>
      </header>

      {/* Category Filter Navigation */}
      <nav className="shortcuts-nav">
        <button className={cx('shortcuts-nav-btn', activeCat === 'all' && 'active')} onClick={() => setActiveCat('all')}>
          <Icon name="sliders" size={14} />
          <span>כל הקיצורים ({SHORTCUTS.length})</span>
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
          <span>כלים ומפתחים</span>
        </button>
      </nav>

      {/* Shortcuts Grid */}
      <div className="shortcuts-grid">
        {filtered.map((item) => (
          <div key={item.id} className="shortcut-card">
            <div className="shortcut-card-header">
              <div className="shortcut-icon-wrap">
                <Icon name={item.icon} size={18} />
              </div>
              <div className="shortcut-keys-row">
                {item.keys.map((k, idx) => (
                  <span key={idx} className="key-wrap">
                    <kbd className="shortcut-key">{k}</kbd>
                    {idx < item.keys.length - 1 && <span className="key-plus">+</span>}
                  </span>
                ))}
              </div>
            </div>

            <h3 className="shortcut-title">{item.titleHe}</h3>
            <p className="shortcut-desc">{item.descHe}</p>

            <div className="shortcut-card-footer">
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
            </div>
          </div>
        ))}
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

