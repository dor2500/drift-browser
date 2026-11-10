import { useEffect, useState } from 'react';
import type { BrowserState, InstalledWebApp } from '../../shared/types';
import { cmd, cx } from '../lib';
import { Icon } from './Icon';

interface Props {
  state: BrowserState;
}

const POPULAR_APPS: { id: string; name: string; url: string; category: string; icon: string; desc: string }[] = [
  {
    id: 'whatsapp-web',
    name: 'WhatsApp Web',
    url: 'https://web.whatsapp.com/',
    category: 'תקשורת והודעות',
    icon: '💬',
    desc: 'הודעות, קבוצות, שיחות קוליות ושיתוף קבצים ישירות מהמחשב.',
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    url: 'https://chatgpt.com/',
    category: 'בינה מלאכותית ופרודוקטיביות',
    icon: '🤖',
    desc: 'עוזר ה-AI של OpenAI למחקר, כתיבה, תכנות וניתוח נתונים.',
  },
  {
    id: 'yt-music',
    name: 'YouTube Music',
    url: 'https://music.youtube.com/',
    category: 'מוזיקה ומדיה',
    icon: '🎵',
    desc: 'מיליוני שירים, פלייליסטים מותאמים אישית והופעות חיות.',
  },
  {
    id: 'gmail',
    name: 'Gmail',
    url: 'https://mail.google.com/',
    category: 'פרודוקטיביות ודוא"ל',
    icon: '📧',
    desc: 'שירות הדואר האלקטרוני הפופולרי עם חיפוש מהיר והגנת ספאם.',
  },
  {
    id: 'github',
    name: 'GitHub',
    url: 'https://github.com/',
    category: 'פיתוח תוכנה',
    icon: '💻',
    desc: 'ניהול קוד, Pull Requests, מעקב אחרי Issues ושיתוף פעולה בצוות.',
  },
  {
    id: 'telegram',
    name: 'Telegram Web',
    url: 'https://web.telegram.org/',
    category: 'תקשורת והודעות',
    icon: '✈️',
    desc: 'הודעות מהירות ומאובטחות, ערוצים וקבוצות ענק ללא הגבלה.',
  },
  {
    id: 'notion',
    name: 'Notion',
    url: 'https://www.notion.so/',
    category: 'פתקים ומסמכים',
    icon: '📝',
    desc: 'מרחב עבודה מחובר לפתקים, משימות, פרויקטים ומסדי נתונים.',
  },
  {
    id: 'spotify',
    name: 'Spotify Web Player',
    url: 'https://open.spotify.com/',
    category: 'מוזיקה ופודקאסטים',
    icon: '🎧',
    desc: 'האזנה למוזיקה, פודקאסטים ופלייליסטים באיכות גבוהה.',
  },
  {
    id: 'calendar',
    name: 'Google Calendar',
    url: 'https://calendar.google.com/',
    category: 'יומן ופגישות',
    icon: '📅',
    desc: 'תזמון פגישות, ניהול לו"ז אישי ועסקי ותזכורות בזמן אמת.',
  },
  {
    id: 'figma',
    name: 'Figma',
    url: 'https://www.figma.com/',
    category: 'עיצוב ופרוטוטייפינג',
    icon: '🎨',
    desc: 'עיצוב ממשקי משתמש, פרוטוטייפים אינטראקטיביים ועבודת צוות חיה.',
  },
  {
    id: 'discord',
    name: 'Discord',
    url: 'https://discord.com/app',
    category: 'קהילה וגיימינג',
    icon: '🎮',
    desc: 'צ\'אט קולי, שיחות וידאו וקהילות גיימינג וטכנולוגיה.',
  },
  {
    id: 'netflix',
    name: 'Netflix',
    url: 'https://www.netflix.com/',
    category: 'סטרימינג ווידאו',
    icon: '🎬',
    desc: 'סרטים, סדרות מקוריות ותוכניות טלוויזיה באיכות 4K HDR.',
  },
];

export function AppsPage({ state }: Props) {
  const [apps, setApps] = useState<InstalledWebApp[]>([]);
  const [search, setSearch] = useState('');
  const [installSuccessToast, setInstallSuccessToast] = useState<string | null>(null);

  const activeTab = state.tabs.find((t) => t.id === state.activeTabId);
  const activeUrl = activeTab?.url && /^https?:\/\//.test(activeTab.url) ? activeTab.url : null;
  const activeTitle = activeTab?.title || (activeUrl ? new URL(activeUrl).hostname : '');

  const loadApps = () => {
    window.drift.getWebApps?.().then((res) => {
      if (res) setApps(res);
    });
  };

  useEffect(() => {
    loadApps();
  }, []);

  const launchApp = (app: InstalledWebApp) => {
    cmd({ type: 'tab:new', url: app.url });
  };

  const uninstallApp = async (id: string) => {
    await window.drift.uninstallWebApp?.(id);
    loadApps();
  };

  const toggleOpenAsWindow = async (app: InstalledWebApp) => {
    await window.drift.updateWebApp?.(app.id, { openAsWindow: !app.openAsWindow });
    loadApps();
  };

  const installCurrentSite = async () => {
    if (!activeUrl) return;
    const installed = await window.drift.installWebApp?.({
      name: activeTitle,
      url: activeUrl,
      openAsWindow: true,
    });
    if (installed) {
      loadApps();
      showToast(`האתר "${activeTitle}" הותקן בהצלחה כאפליקציה!`);
    }
  };

  const installPopularApp = async (item: typeof POPULAR_APPS[0]) => {
    const installed = await window.drift.installWebApp?.({
      name: item.name,
      url: item.url,
      category: item.category,
      openAsWindow: true,
    });
    if (installed) {
      loadApps();
      showToast(`האפליקציה "${item.name}" נוספה לרשימה!`);
    }
  };

  const showToast = (msg: string) => {
    setInstallSuccessToast(msg);
    setTimeout(() => setInstallSuccessToast(null), 3000);
  };

  const filteredApps = apps.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase()) || a.url.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="apps-page" dir="rtl">
      {/* Hero Header */}
      <header className="apps-hero-header">
        <div className="apps-hero-title">
          <div className="apps-icon-badge">
            <Icon name="tab" size={28} />
          </div>
          <div>
            <h1>יישומי אינטרנט · Drift Web Apps Hub</h1>
            <p>התקן כל אתר אינטרנט כאפליקציה עצמאית (PWA) עם גישה ישירה, חלון ייעודי וביצועים מהירים.</p>
          </div>
        </div>

        {activeUrl && (
          <div className="apps-install-active-box">
            <div className="active-site-info">
              <span className="active-label">האתר הנוכחי:</span>
              <strong className="active-title">{activeTitle}</strong>
            </div>
            <button className="btn primary" onClick={installCurrentSite}>
              <Icon name="plus" size={14} />
              <span>התקן כ-Web App</span>
            </button>
          </div>
        )}
      </header>

      {/* Search and Filters Bar */}
      <div className="apps-search-bar">
        <div className="search-input-wrapper">
          <Icon name="search" size={15} />
          <input
            type="text"
            className="apps-search-input"
            placeholder="חיפוש באפליקציות המותקנות..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span className="apps-counter">{apps.length} אפליקציות מותקנות</span>
      </div>

      {/* Installed Apps Grid */}
      <section className="apps-section">
        <h2>אפליקציות מותקנות במחשב שלך</h2>

        {filteredApps.length === 0 ? (
          <div className="apps-empty-state">
            <Icon name="cart" size={36} />
            <p>עדיין לא הותקנו אפליקציות{search ? ' התואמות לחיפוש' : ''}.</p>
            <p className="empty-sub">בחר אפליקציה מהקטלוג למטה או לחץ "התקן כ-Web App" בדף שפתוח אצלך.</p>
          </div>
        ) : (
          <div className="apps-grid">
            {filteredApps.map((app) => (
              <div key={app.id} className="app-card">
                <div className="app-card-header">
                  <div className="app-icon-container">
                    <span className="app-icon-text">{app.name[0]?.toUpperCase() || '🌐'}</span>
                  </div>
                  <div className="app-card-details">
                    <div className="app-name">{app.name}</div>
                    <div className="app-url mono">{new URL(app.url).hostname}</div>
                  </div>
                </div>

                <div className="app-card-options">
                  <label className="app-option-toggle">
                    <input
                      type="checkbox"
                      className="switch"
                      checked={app.openAsWindow}
                      onChange={() => toggleOpenAsWindow(app)}
                    />
                    <span>פתח בחלון נפרד</span>
                  </label>
                </div>

                <div className="app-card-actions">
                  <button className="btn primary small" onClick={() => launchApp(app)}>
                    <Icon name="expand" size={12} />
                    <span>הפעל</span>
                  </button>
                  <button className="btn ghost small remove-btn" onClick={() => uninstallApp(app.id)} title="הסר אפליקציה">
                    <Icon name="trash" size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Popular Web Apps Catalog */}
      <section className="apps-section popular-section">
        <h2>קטלוג אפליקציות מומלצות להתקנה בלחיצה אחת</h2>
        <div className="popular-apps-grid">
          {POPULAR_APPS.map((item) => {
            const isInstalled = apps.some((a) => a.url === item.url || a.name === item.name);
            return (
              <div key={item.id} className="popular-app-card">
                <div className="popular-app-icon">{item.icon}</div>
                <div className="popular-app-info">
                  <div className="popular-app-name">{item.name}</div>
                  <div className="popular-app-desc">{item.desc}</div>
                  <span className="popular-app-cat">{item.category}</span>
                </div>
                <button
                  className={cx('btn small', isInstalled ? 'ghost' : 'primary')}
                  disabled={isInstalled}
                  onClick={() => installPopularApp(item)}
                >
                  {isInstalled ? '✓ מותקן' : '+ התקן'}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Toast Notification */}
      {installSuccessToast && (
        <div className="apps-toast">
          <Icon name="check" size={15} />
          <span>{installSuccessToast}</span>
        </div>
      )}
    </div>
  );
}

