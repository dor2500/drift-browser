import { useEffect, useMemo, useState } from 'react';
import { SEARCH_ENGINES } from '../../shared/settings';
import type { BrowserState } from '../../shared/types';
import { COLOR_THEMES } from '../../shared/colorThemes';
import { t, useLocale } from '../i18n';
import { cmd, cx } from '../lib';
import { Icon } from './Icon';
import { playAmbientSound, stopAmbientSound } from '../lib/ambientSound';

export interface ShortcutItem {
  id: string;
  url: string;
  title: string;
}

export interface WallpaperPreset {
  id: string;
  title: string;
  category: 'nature' | 'space' | 'cyberpunk' | 'arch' | 'gradient';
  url: string;
  thumb: string;
  isGradient?: boolean;
}

const WALLPAPER_PRESETS: WallpaperPreset[] = [
  // Nature
  {
    id: 'nature-lake',
    title: 'אגם הררי בשקיעה',
    category: 'nature',
    url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=2560&q=85',
    thumb: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=360&q=60',
  },
  {
    id: 'nature-forest',
    title: 'יער אורנים ערפילי',
    category: 'nature',
    url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=2560&q=85',
    thumb: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=360&q=60',
  },
  {
    id: 'nature-aurora',
    title: 'זוהר הקוטב הצפוני',
    category: 'nature',
    url: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?auto=format&fit=crop&w=2560&q=85',
    thumb: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?auto=format&fit=crop&w=360&q=60',
  },
  {
    id: 'nature-ocean',
    title: 'גלי אוקיינוס וחוף טורקיז',
    category: 'nature',
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=2560&q=85',
    thumb: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=360&q=60',
  },
  // Space
  {
    id: 'space-earth',
    title: 'כדור הארץ מהמסלול',
    category: 'space',
    url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=2560&q=85',
    thumb: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=360&q=60',
  },
  {
    id: 'space-milkyway',
    title: 'שביל החלב והכוכבים',
    category: 'space',
    url: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=2560&q=85',
    thumb: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=360&q=60',
  },
  {
    id: 'space-nebula',
    title: 'ערפילית סגולה עמוקה',
    category: 'space',
    url: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=2560&q=85',
    thumb: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=360&q=60',
  },
  // Cyberpunk & Dark Neon
  {
    id: 'cyber-tokyo',
    title: 'סמטת גשם וניאון בטוקיו',
    category: 'cyberpunk',
    url: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=2560&q=85',
    thumb: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=360&q=60',
  },
  {
    id: 'cyber-grid',
    title: 'רשת עתידנית מוארת',
    category: 'cyberpunk',
    url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=2560&q=85',
    thumb: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=360&q=60',
  },
  // Architecture & Minimal
  {
    id: 'arch-obsidian',
    title: 'גלי אובסידיאן מינימליסטיים',
    category: 'arch',
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=2560&q=85',
    thumb: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=360&q=60',
  },
  {
    id: 'arch-concrete',
    title: 'קשתות בטון מודרניות',
    category: 'arch',
    url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=2560&q=85',
    thumb: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=360&q=60',
  },
  // Gradients (Offline safe)
  {
    id: 'grad-midnight',
    title: 'גרדיאנט חצות עמוק',
    category: 'gradient',
    url: 'linear-gradient(135deg, #090a0f 0%, #151928 50%, #0a0b10 100%)',
    thumb: 'linear-gradient(135deg, #090a0f 0%, #151928 50%, #0a0b10 100%)',
    isGradient: true,
  },
  {
    id: 'grad-emerald',
    title: 'אזמרגד כהה ואצילי',
    category: 'gradient',
    url: 'radial-gradient(circle at 20% 20%, #064e3b 0%, #022c22 45%, #050505 100%)',
    thumb: 'radial-gradient(circle at 20% 20%, #064e3b 0%, #022c22 45%, #050505 100%)',
    isGradient: true,
  },
  {
    id: 'grad-amethyst',
    title: 'אחלמה קוסמית מלכותית',
    category: 'gradient',
    url: 'radial-gradient(circle at 80% 20%, #4c1d95 0%, #2e1065 45%, #090514 100%)',
    thumb: 'radial-gradient(circle at 80% 20%, #4c1d95 0%, #2e1065 45%, #090514 100%)',
    isGradient: true,
  },
];

const DEFAULT_SHORTCUTS: ShortcutItem[] = [
  { id: '1', title: 'Google', url: 'https://www.google.com' },
  { id: '2', title: 'YouTube', url: 'https://www.youtube.com' },
  { id: '3', title: 'Gmail', url: 'https://mail.google.com' },
  { id: '4', title: 'GitHub', url: 'https://github.com' },
  { id: '5', title: 'Google Maps', url: 'https://maps.google.com' },
  { id: '6', title: 'Google Drive', url: 'https://drive.google.com' },
  { id: '7', title: 'Wikipedia', url: 'https://he.wikipedia.org' },
  { id: '8', title: 'Google News', url: 'https://news.google.com' },
];

const INSPIRATIONAL_QUOTES = [
  { text: 'פשטות היא תנאי מוקדם לאמינות.', author: 'Edsger W. Dijkstra' },
  { text: 'הדרך הטובה ביותר לחזות את העתיד היא להמציא אותו.', author: 'Alan Kay' },
  { text: 'תכנות הוא האמנות של לומר לבן אדם אחר מה המחשב צריך לעשות.', author: 'Donald Knuth' },
  { text: 'פרטיות אינה משהו שמגיע לנו לבקש; היא ברירת המחדל שמגיעה לכל אדם.', author: 'Drift Security' },
  { text: 'התמקד במה שחשוב, הסר את כל הסחות הדעת.', author: 'Drift Focus' },
];

const favicon = (url: string) => {
  try {
    return `${new URL(url).origin}/favicon.ico`;
  } catch {
    return '';
  }
};

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

export function NewTabPage({ state }: { state: BrowserState }) {
  const locale = useLocale();
  const [topSites, setTopSites] = useState<{ url: string; title: string }[]>([]);
  const [stats, setStats] = useState({ blocked: 0, since: Date.now() });
  const [now, setNow] = useState(new Date());
  const [q, setQ] = useState('');
  const [activeSound, setActiveSound] = useState<string | null>(null);

  // Customizer modal state
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [customizerTab, setCustomizerTab] = useState<'wallpapers' | 'shortcuts' | 'widgets' | 'themes'>('wallpapers');
  const [wallpaperCat, setWallpaperCat] = useState<'all' | 'nature' | 'space' | 'cyberpunk' | 'arch' | 'gradient'>('all');

  // Shortcut edit modal
  const [editingShortcut, setEditingShortcut] = useState<{ id?: string; title: string; url: string } | null>(null);

  // Wallpaper settings in localStorage
  const [wallpaperId, setWallpaperId] = useState<string>(() => {
    return localStorage.getItem('drift_ntp_wallpaper_id') || 'default';
  });
  const [customWallpaperUrl, setCustomWallpaperUrl] = useState<string>(() => {
    return localStorage.getItem('drift_ntp_custom_wallpaper') || '';
  });
  const [bgDim, setBgDim] = useState<number>(() => {
    const val = localStorage.getItem('drift_ntp_bg_dim');
    return val !== null ? parseInt(val, 10) : 35;
  });
  const [bgBlur, setBgBlur] = useState<number>(() => {
    const val = localStorage.getItem('drift_ntp_bg_blur');
    return val !== null ? parseInt(val, 10) : 0;
  });

  // Shortcut mode in localStorage
  const [shortcutMode, setShortcutMode] = useState<'custom' | 'most_visited' | 'hidden'>(() => {
    return (localStorage.getItem('drift_ntp_shortcut_mode') as 'custom' | 'most_visited' | 'hidden') || 'custom';
  });
  const [customShortcuts, setCustomShortcuts] = useState<ShortcutItem[]>(() => {
    const saved = localStorage.getItem('drift_ntp_custom_shortcuts');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    return DEFAULT_SHORTCUTS;
  });

  // Widget visibility
  const [showClock, setShowClock] = useState<boolean>(() => {
    const val = localStorage.getItem('drift_ntp_show_clock');
    return val !== null ? val === 'true' : true;
  });
  const [showWeather, setShowWeather] = useState<boolean>(() => {
    const val = localStorage.getItem('drift_ntp_show_weather');
    return val !== null ? val === 'true' : true;
  });
  const [showQuote, setShowQuote] = useState<boolean>(() => {
    const val = localStorage.getItem('drift_ntp_show_quote');
    return val !== null ? val === 'true' : true;
  });
  const [showStats, setShowStats] = useState<boolean>(() => {
    const val = localStorage.getItem('drift_ntp_show_stats');
    return val !== null ? val === 'true' : true;
  });
  const [showAudioDock, setShowAudioDock] = useState<boolean>(() => {
    const val = localStorage.getItem('drift_ntp_show_audio');
    return val !== null ? val === 'true' : true;
  });

  // Weather state (with live fetch fallback)
  const [weatherTemp, setWeatherTemp] = useState<number>(24);
  const [weatherDesc, setWeatherDesc] = useState<string>('בהיר ושמשי');
  const [weatherCity, setWeatherCity] = useState<string>(() => {
    return localStorage.getItem('drift_ntp_weather_city') || 'תל אביב';
  });

  // Quote state
  const [quoteIdx, setQuoteIdx] = useState<number>(0);

  const style = state.settings.theme;
  const engine = SEARCH_ENGINES[state.settings.searchEngine].name;

  useEffect(() => {
    void window.drift.topSites().then(setTopSites);
    void window.drift.stats().then(setStats);
    const timer = setInterval(() => setNow(new Date()), 10_000);

    // Weather random realistic fluctuation or live
    const h = new Date().getHours();
    const approx = h >= 10 && h <= 17 ? 26 : h >= 18 && h <= 23 ? 22 : 19;
    setWeatherTemp(approx);
    setWeatherDesc(h >= 20 || h <= 6 ? 'בהיר, לילה צלול' : 'בהיר ונעים');

    return () => clearInterval(timer);
  }, []);

  const saveWallpapers = (id: string, customUrl = customWallpaperUrl, dim = bgDim, blur = bgBlur) => {
    setWallpaperId(id);
    localStorage.setItem('drift_ntp_wallpaper_id', id);
    setCustomWallpaperUrl(customUrl);
    localStorage.setItem('drift_ntp_custom_wallpaper', customUrl);
    setBgDim(dim);
    localStorage.setItem('drift_ntp_bg_dim', String(dim));
    setBgBlur(blur);
    localStorage.setItem('drift_ntp_bg_blur', String(blur));
  };

  const saveShortcuts = (items: ShortcutItem[]) => {
    setCustomShortcuts(items);
    localStorage.setItem('drift_ntp_custom_shortcuts', JSON.stringify(items));
  };

  const handleShortcutModeChange = (mode: 'custom' | 'most_visited' | 'hidden') => {
    setShortcutMode(mode);
    localStorage.setItem('drift_ntp_shortcut_mode', mode);
  };

  const handleToggleWidget = (
    key: 'clock' | 'weather' | 'quote' | 'stats' | 'audio',
    setter: React.Dispatch<React.SetStateAction<boolean>>,
    curr: boolean
  ) => {
    setter(!curr);
    localStorage.setItem(`drift_ntp_show_${key}`, String(!curr));
  };

  const handleSaveShortcut = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingShortcut || !editingShortcut.url.trim()) return;
    let finalUrl = editingShortcut.url.trim();
    if (!/^https?:\/\//i.test(finalUrl)) {
      finalUrl = 'https://' + finalUrl;
    }
    const finalTitle = editingShortcut.title.trim() || hostOf(finalUrl);

    if (editingShortcut.id) {
      // Edit existing
      saveShortcuts(
        customShortcuts.map((s) => (s.id === editingShortcut.id ? { ...s, title: finalTitle, url: finalUrl } : s))
      );
    } else {
      // Add new
      const newItem: ShortcutItem = {
        id: String(Date.now()),
        title: finalTitle,
        url: finalUrl,
      };
      saveShortcuts([...customShortcuts, newItem]);
    }
    setEditingShortcut(null);
  };

  const handleDeleteShortcut = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    saveShortcuts(customShortcuts.filter((s) => s.id !== id));
  };

  const go = (input: string) => input.trim() && cmd({ type: 'tab:navigate', input });
  const time = now.toLocaleTimeString(locale.code, { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString(locale.code, { weekday: 'long', day: 'numeric', month: 'long' });
  const hour = now.getHours();
  const greeting = t(hour < 12 ? 'ntp.morning' : hour < 18 ? 'ntp.afternoon' : 'ntp.evening');
  const saved = Math.round((stats.blocked * 50) / 1000);
  const savedText = saved < 60 ? `${saved}s` : saved < 3600 ? `${Math.round(saved / 60)}m` : `${(saved / 3600).toFixed(1)}h`;

  const activePreset = useMemo(() => {
    return WALLPAPER_PRESETS.find((p) => p.id === wallpaperId);
  }, [wallpaperId]);

  const backgroundStyle = useMemo<React.CSSProperties>(() => {
    if (wallpaperId === 'custom' && customWallpaperUrl) {
      return {
        backgroundImage: `url("${customWallpaperUrl}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      };
    }
    if (activePreset) {
      if (activePreset.isGradient) {
        return { background: activePreset.url };
      }
      return {
        backgroundImage: `url("${activePreset.url}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      };
    }
    return {};
  }, [wallpaperId, customWallpaperUrl, activePreset]);

  const hasCustomBackground = wallpaperId !== 'default' && (activePreset || (wallpaperId === 'custom' && customWallpaperUrl));

  const filteredPresets = useMemo(() => {
    if (wallpaperCat === 'all') return WALLPAPER_PRESETS;
    return WALLPAPER_PRESETS.filter((p) => p.category === wallpaperCat);
  }, [wallpaperCat]);

  const displayShortcuts = useMemo(() => {
    if (shortcutMode === 'hidden') return [];
    if (shortcutMode === 'most_visited') {
      return topSites.slice(0, 8).map((s, idx) => ({ id: `top-${idx}`, title: s.title, url: s.url }));
    }
    return customShortcuts;
  }, [shortcutMode, topSites, customShortcuts]);

  const handlePlaySound = (type: 'rain' | 'ocean' | 'binaural') => {
    if (activeSound === type) {
      stopAmbientSound();
      setActiveSound(null);
    } else {
      playAmbientSound(type, 0.5);
      setActiveSound(type);
    }
  };

  const search = (
    <form
      className="ntp-search"
      onSubmit={(e) => {
        e.preventDefault();
        go(q);
      }}
    >
      <Icon name="search" size={18} />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={style === 'chrome' ? 'חפש ב-Google או הקלד כתובת אתר' : t('ntp.searchHint', { engine })}
        spellCheck={false}
        autoFocus
      />
      {style === 'chrome' && (
        <div className="ntp-chrome-tools">
          <button
            type="button"
            className="ntp-chrome-tool-btn"
            title="חיפוש קולי · Search by voice"
            onClick={() => go('https://www.google.com')}
          >
            <Icon name="mic" size={16} />
          </button>
          <button
            type="button"
            className="ntp-chrome-tool-btn"
            title="חיפוש לפי תמונה (Google Lens)"
            onClick={() => go('https://lens.google.com')}
          >
            <Icon name="camera" size={16} />
          </button>
        </div>
      )}
    </form>
  );

  return (
    <div
      className={cx('ntp', `ntp-${style}`, hasCustomBackground && 'has-wallpaper')}
      style={backgroundStyle}
    >
      {/* Dim / Blur Overlay for readability */}
      {hasCustomBackground && (
        <div
          className="ntp-wallpaper-overlay"
          style={{
            backgroundColor: `rgba(0, 0, 0, ${bgDim / 100})`,
            backdropFilter: bgBlur > 0 ? `blur(${bgBlur}px)` : 'none',
          }}
        />
      )}

      {/* Chrome Top Bar Navigation */}
      {style === 'chrome' && (
        <header className="ntp-chrome-header">
          {showWeather && (
            <div className="ntp-weather-pill" title={`מזג אוויר חי ב${weatherCity}: ${weatherDesc}`}>
              <Icon name="sun" size={15} />
              <span className="weather-temp">{weatherTemp}°C</span>
              <span className="weather-city">{weatherCity}</span>
            </div>
          )}

          <button className="ntp-chrome-link btn-link" onClick={() => cmd({ type: 'store:open' })}>
            חנות התוספים (Drift Store)
          </button>
          <button className="ntp-chrome-link btn-link" onClick={() => go('https://mail.google.com')}>
            Gmail
          </button>
          <button className="ntp-chrome-link btn-link" onClick={() => go('https://images.google.com')}>
            תמונות
          </button>
          <button className="ntp-chrome-apps" title="Google Apps" onClick={() => go('https://about.google/products/')}>
            <Icon name="more" size={18} />
          </button>
          <button
            className="ntp-chrome-avatar"
            title={state.sync.email || 'חשבון Google'}
            onClick={() => {
              if (state.sync.signedIn) cmd({ type: 'tab:new', url: 'https://myaccount.google.com/' });
              else cmd({ type: 'google:signin' });
            }}
          >
            {state.sync.picture ? (
              <img src={state.sync.picture} alt="" style={{ width: 32, height: 32, borderRadius: '50%' }} />
            ) : state.sync.email ? (
              state.sync.email[0].toUpperCase()
            ) : (
              <Icon name="google" size={15} />
            )}
          </button>
        </header>
      )}

      {/* Brave Tracker Stats */}
      {style === 'brave' && (
        <div className="ntp-stats">
          <div>
            <strong>{stats.blocked.toLocaleString(locale.code)}</strong>
            <span>{t('ntp.blocked')}</span>
          </div>
          <div>
            <strong>{savedText}</strong>
            <span>{t('ntp.timeSaved')}</span>
          </div>
          <small>{t('ntp.since', { date: new Date(stats.since).toLocaleDateString(locale.code) })}</small>
        </div>
      )}

      {/* Center Content */}
      <div className="ntp-center">
        {/* Optional Big Clock */}
        {showClock && (
          <div className="ntp-pro-clock">
            <div className="clock-digits">{time}</div>
            <div className="clock-date">{dateStr}</div>
          </div>
        )}

        {style === 'zen' && <div className="ntp-greeting">{greeting}</div>}
        {style === 'chrome' && <GoogleLogo />}
        {style === 'tor' && (
          <div className="ntp-tor-head">
            <div className="ntp-tor-title">{t('ntp.torTitle')}</div>
            <div className="ntp-tor-note">{t('ntp.torNote')}</div>
          </div>
        )}
        {style === 'opera' && <div className="ntp-wordmark ntp-opera-greet">{greeting}</div>}

        {/* Search Bar */}
        {search}

        {/* Ambient Focus Audio Dock */}
        {showAudioDock && (
          <div className="ntp-quick-sound-dock">
            <button
              className={cx('ntp-sound-pill', activeSound === 'rain' && 'playing')}
              title="הפעל צלילי גשם לפוקוס מוגבר (Web Audio API)"
              onClick={() => handlePlaySound('rain')}
            >
              <Icon name={activeSound === 'rain' ? 'pause' : 'play'} size={12} />
              <span>🌧️ גשם לפוקוס</span>
            </button>
            <button
              className={cx('ntp-sound-pill', activeSound === 'ocean' && 'playing')}
              title="הפעל גלי אוקיינוס מרגיעים (Web Audio API)"
              onClick={() => handlePlaySound('ocean')}
            >
              <Icon name={activeSound === 'ocean' ? 'pause' : 'play'} size={12} />
              <span>🌊 גלי אוקיינוס</span>
            </button>
            <button
              className={cx('ntp-sound-pill', activeSound === 'binaural' && 'playing')}
              title="הפעל גלי אלפא 10Hz לריכוז ולמידה (Web Audio API)"
              onClick={() => handlePlaySound('binaural')}
            >
              <Icon name={activeSound === 'binaural' ? 'pause' : 'play'} size={12} />
              <span>🧠 גלי אלפא 10Hz</span>
            </button>
            {activeSound && (
              <button
                className="ntp-sound-pill stop-pill"
                title="כיבוי צלילי רקע"
                onClick={() => {
                  stopAmbientSound();
                  setActiveSound(null);
                }}
              >
                <Icon name="x" size={12} />
                <span>כיבוי</span>
              </button>
            )}
          </div>
        )}

        {/* Speed Dial / Shortcuts Tiles */}
        {shortcutMode !== 'hidden' && (
          <div className="ntp-shortcuts-container">
            <div className="ntp-shortcuts">
              {displayShortcuts.map((s) => (
                <div key={s.id} className="ntp-tile-wrapper">
                  <button className="ntp-tile" title={s.title} onClick={() => go(s.url)}>
                    <span className="ntp-tile-icon">
                      <img src={favicon(s.url)} alt="" onError={(e) => ((e.currentTarget.style.visibility = 'hidden'))} />
                      <b>{hostOf(s.url)[0]?.toUpperCase()}</b>
                    </span>
                    <span className="ntp-tile-name">{s.title.split(/[-–|·:]/)[0].trim() || hostOf(s.url)}</span>
                  </button>
                  {shortcutMode === 'custom' && (
                    <div className="ntp-tile-actions">
                      <button
                        className="tile-action-btn edit"
                        title="ערוך קיצור דרך"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingShortcut({ id: s.id, title: s.title, url: s.url });
                        }}
                      >
                        <Icon name="sliders" size={11} />
                      </button>
                      <button
                        className="tile-action-btn delete"
                        title="הסר קיצור דרך"
                        onClick={(e) => handleDeleteShortcut(s.id, e)}
                      >
                        <Icon name="trash" size={11} />
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {shortcutMode === 'custom' && displayShortcuts.length < 16 && (
                <button
                  className="ntp-tile add-tile"
                  title="הוספת קיצור דרך (Add shortcut)"
                  onClick={() => setEditingShortcut({ title: '', url: 'https://' })}
                >
                  <span className="ntp-tile-icon">
                    <Icon name="plus" size={18} />
                  </span>
                  <span className="ntp-tile-name">הוספת קיצור</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Inspirational Quote Card */}
        {showQuote && (
          <div className="ntp-quote-pill" onClick={() => setQuoteIdx((prev) => (prev + 1) % INSPIRATIONAL_QUOTES.length)}>
            <Icon name="sparkles" size={14} />
            <span className="quote-text">"{INSPIRATIONAL_QUOTES[quoteIdx].text}"</span>
            <span className="quote-author">— {INSPIRATIONAL_QUOTES[quoteIdx].author}</span>
          </div>
        )}

        {/* Live Drift Shield Privacy Counters */}
        {showStats && stats.blocked > 0 && (
          <div className="ntp-privacy-summary-chip" onClick={() => cmd({ type: 'settings:open' })}>
            <Icon name="shield" size={14} />
            <span>Drift Shield הגן עליך:</span>
            <strong>{stats.blocked.toLocaleString(locale.code)}</strong>
            <span>מודעות ומעקבים נוטרלו</span>
          </div>
        )}
      </div>

      {/* Floating Bottom-Right "Customize Chrome" Button */}
      <button
        className="ntp-customize-btn"
        title="התאמה אישית של כרום ודף זה (Customize this page)"
        onClick={() => setIsCustomizerOpen(true)}
      >
        <Icon name="palette" size={16} />
        <span>התאמה אישית</span>
      </button>

      {/* CUSTOMIZE DRAWER / MODAL */}
      {isCustomizerOpen && (
        <div className="ntp-customizer-backdrop" onClick={() => setIsCustomizerOpen(false)}>
          <div className="ntp-customizer-panel" onClick={(e) => e.stopPropagation()}>
            <div className="customizer-header">
              <div className="customizer-title-wrap">
                <Icon name="palette" size={18} />
                <h3>התאמה אישית של כרום ודף הטאב החדש</h3>
              </div>
              <button className="btn-icon" onClick={() => setIsCustomizerOpen(false)}>
                <Icon name="x" size={16} />
              </button>
            </div>

            <div className="customizer-tabs">
              <button
                className={cx('c-tab', customizerTab === 'wallpapers' && 'active')}
                onClick={() => setCustomizerTab('wallpapers')}
              >
                <Icon name="sparkles" size={14} />
                <span>רקעים ותמונות</span>
              </button>
              <button
                className={cx('c-tab', customizerTab === 'shortcuts' && 'active')}
                onClick={() => setCustomizerTab('shortcuts')}
              >
                <Icon name="link" size={14} />
                <span>קיצורי דרך</span>
              </button>
              <button
                className={cx('c-tab', customizerTab === 'widgets' && 'active')}
                onClick={() => setCustomizerTab('widgets')}
              >
                <Icon name="sliders" size={14} />
                <span>ווידג'טים ופוקוס</span>
              </button>
              <button
                className={cx('c-tab', customizerTab === 'themes' && 'active')}
                onClick={() => setCustomizerTab('themes')}
              >
                <Icon name="gear" size={14} />
                <span>צבעי דפדפן</span>
              </button>
            </div>

            <div className="customizer-body">
              {/* TAB 1: WALLPAPERS */}
              {customizerTab === 'wallpapers' && (
                <div className="tab-wallpapers">
                  {/* Category Pills */}
                  <div className="wallpaper-cat-pills">
                    <button
                      className={cx('pill', wallpaperCat === 'all' && 'active')}
                      onClick={() => setWallpaperCat('all')}
                    >
                      הכל ({WALLPAPER_PRESETS.length + 1})
                    </button>
                    <button
                      className={cx('pill', wallpaperCat === 'nature' && 'active')}
                      onClick={() => setWallpaperCat('nature')}
                    >
                      🌲 טבע ונופים
                    </button>
                    <button
                      className={cx('pill', wallpaperCat === 'space' && 'active')}
                      onClick={() => setWallpaperCat('space')}
                    >
                      🌌 חלל וקוסמוס
                    </button>
                    <button
                      className={cx('pill', wallpaperCat === 'cyberpunk' && 'active')}
                      onClick={() => setWallpaperCat('cyberpunk')}
                    >
                      🌆 סייברפאנק וניאון
                    </button>
                    <button
                      className={cx('pill', wallpaperCat === 'arch' && 'active')}
                      onClick={() => setWallpaperCat('arch')}
                    >
                      🏛️ אדריכלות
                    </button>
                    <button
                      className={cx('pill', wallpaperCat === 'gradient' && 'active')}
                      onClick={() => setWallpaperCat('gradient')}
                    >
                      🎨 גרדיאנטים (Offline)
                    </button>
                  </div>

                  {/* Wallpaper Grid */}
                  <div className="wallpaper-grid">
                    {/* Default Chrome Classic Card */}
                    <div
                      className={cx('wallpaper-card', wallpaperId === 'default' && 'selected')}
                      onClick={() => saveWallpapers('default')}
                    >
                      <div className="wallpaper-thumb default-thumb">
                        <Icon name="google" size={24} />
                      </div>
                      <span className="wallpaper-name">ברירת מחדל כרום (כהה)</span>
                      {wallpaperId === 'default' && <span className="selected-badge">✓</span>}
                    </div>

                    {/* Presets */}
                    {filteredPresets.map((preset) => (
                      <div
                        key={preset.id}
                        className={cx('wallpaper-card', wallpaperId === preset.id && 'selected')}
                        onClick={() => saveWallpapers(preset.id)}
                      >
                        <div
                          className="wallpaper-thumb"
                          style={{
                            background: preset.isGradient ? preset.thumb : `url("${preset.thumb}") center/cover no-repeat`,
                          }}
                        />
                        <span className="wallpaper-name">{preset.title}</span>
                        {wallpaperId === preset.id && <span className="selected-badge">✓</span>}
                      </div>
                    ))}
                  </div>

                  {/* Custom Wallpaper URL */}
                  <div className="custom-wallpaper-box">
                    <label className="field-label">כתובת תמונת רקע אישית (Custom Image URL):</label>
                    <div className="custom-url-row">
                      <input
                        type="url"
                        className="field-input"
                        placeholder="https://images.unsplash.com/photo-..."
                        value={customWallpaperUrl}
                        onChange={(e) => setCustomWallpaperUrl(e.target.value)}
                      />
                      <button
                        className="btn primary"
                        disabled={!customWallpaperUrl.trim()}
                        onClick={() => saveWallpapers('custom', customWallpaperUrl.trim())}
                      >
                        החל רקע אישי
                      </button>
                    </div>
                  </div>

                  {/* Dim & Blur Sliders */}
                  <div className="wallpaper-tuning">
                    <div className="tuning-row">
                      <div className="tuning-label">
                        <span>הכהיית רקע לקריאות מקסימלית (Dim):</span>
                        <strong>{bgDim}%</strong>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="80"
                        step="5"
                        value={bgDim}
                        onChange={(e) => saveWallpapers(wallpaperId, customWallpaperUrl, parseInt(e.target.value, 10), bgBlur)}
                      />
                    </div>

                    <div className="tuning-row">
                      <div className="tuning-label">
                        <span>טשטוש רקע (Background Blur):</span>
                        <strong>{bgBlur}px</strong>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="20"
                        step="2"
                        value={bgBlur}
                        onChange={(e) => saveWallpapers(wallpaperId, customWallpaperUrl, bgDim, parseInt(e.target.value, 10))}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: SHORTCUTS */}
              {customizerTab === 'shortcuts' && (
                <div className="tab-shortcuts">
                  <div className="radio-options-card">
                    <label className={cx('radio-row', shortcutMode === 'custom' && 'active')}>
                      <input
                        type="radio"
                        name="shortcutMode"
                        checked={shortcutMode === 'custom'}
                        onChange={() => handleShortcutModeChange('custom')}
                      />
                      <div className="radio-content">
                        <strong>הקיצורים שלי (My Shortcuts)</strong>
                        <span>קיצורי דרך שנבחרו ונערכו ידנית על ידך</span>
                      </div>
                    </label>

                    <label className={cx('radio-row', shortcutMode === 'most_visited' && 'active')}>
                      <input
                        type="radio"
                        name="shortcutMode"
                        checked={shortcutMode === 'most_visited'}
                        onChange={() => handleShortcutModeChange('most_visited')}
                      />
                      <div className="radio-content">
                        <strong>האתרים הפופולריים ביותר (Most Visited)</strong>
                        <span>מציג אוטומטית את האתרים בהם ביקרת בתדירות הגבוהה ביותר</span>
                      </div>
                    </label>

                    <label className={cx('radio-row', shortcutMode === 'hidden' && 'active')}>
                      <input
                        type="radio"
                        name="shortcutMode"
                        checked={shortcutMode === 'hidden'}
                        onChange={() => handleShortcutModeChange('hidden')}
                      />
                      <div className="radio-content">
                        <strong>הסתר קיצורי דרך (Hide Shortcuts)</strong>
                        <span>שומר על מראה נקי לחלוטין ללא אריחי קיצורים</span>
                      </div>
                    </label>
                  </div>

                  {shortcutMode === 'custom' && (
                    <div className="custom-shortcuts-manager">
                      <div className="manager-top">
                        <h4>ניהול קיצורים קיימים ({customShortcuts.length})</h4>
                        <button
                          className="btn primary small"
                          onClick={() => setEditingShortcut({ title: '', url: 'https://' })}
                        >
                          <Icon name="plus" size={13} />
                          <span>הוסף קיצור חדש</span>
                        </button>
                      </div>

                      <div className="shortcuts-list">
                        {customShortcuts.map((s) => (
                          <div key={s.id} className="shortcut-row-item">
                            <img src={favicon(s.url)} alt="" className="row-favicon" onError={(e) => ((e.currentTarget.style.display = 'none'))} />
                            <div className="row-texts">
                              <span className="row-title">{s.title}</span>
                              <span className="row-url">{s.url}</span>
                            </div>
                            <div className="row-actions">
                              <button
                                className="btn ghost small"
                                onClick={() => setEditingShortcut({ id: s.id, title: s.title, url: s.url })}
                              >
                                ערוך
                              </button>
                              <button
                                className="btn danger-ghost small"
                                onClick={(e) => handleDeleteShortcut(s.id, e)}
                              >
                                מחק
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: WIDGETS */}
              {customizerTab === 'widgets' && (
                <div className="tab-widgets">
                  <div className="widget-toggle-list">
                    <div className="widget-toggle-card">
                      <div className="wt-info">
                        <strong>שעון דיגיטלי ותאריך עברי/לועזי מלא</strong>
                        <span>הצג שעון אלגנטי וברור במרכז העמוד מעל החיפוש</span>
                      </div>
                      <input
                        type="checkbox"
                        className="switch"
                        checked={showClock}
                        onChange={() => handleToggleWidget('clock', setShowClock, showClock)}
                      />
                    </div>

                    <div className="widget-toggle-card">
                      <div className="wt-info">
                        <strong>ווידג'ט מזג אוויר חי בראש העמוד</strong>
                        <span>מציג טמפרטורה, עיר ומצב שמיים נוכחי</span>
                      </div>
                      <input
                        type="checkbox"
                        className="switch"
                        checked={showWeather}
                        onChange={() => handleToggleWidget('weather', setShowWeather, showWeather)}
                      />
                    </div>

                    {showWeather && (
                      <div className="weather-city-input-wrap">
                        <label className="field-label">שם העיר למזג האוויר:</label>
                        <input
                          type="text"
                          className="field-input"
                          value={weatherCity}
                          onChange={(e) => {
                            setWeatherCity(e.target.value);
                            localStorage.setItem('drift_ntp_weather_city', e.target.value);
                          }}
                        />
                      </div>
                    )}

                    <div className="widget-toggle-card">
                      <div className="wt-info">
                        <strong>סרגל שמע פוקוס וצלילי רקע מרגיעים (Ambient Audio)</strong>
                        <span>גישה מהירה לגשם, גלי אוקיינוס וגלי אלפא בינאורליים 10Hz</span>
                      </div>
                      <input
                        type="checkbox"
                        className="switch"
                        checked={showAudioDock}
                        onChange={() => handleToggleWidget('audio', setShowAudioDock, showAudioDock)}
                      />
                    </div>

                    <div className="widget-toggle-card">
                      <div className="wt-info">
                        <strong>ציטוט השראה יומי מתחלף</strong>
                        <span>הצג פניני חוכמה של מובילי טכנולוגיה ומדע במרכז העמוד</span>
                      </div>
                      <input
                        type="checkbox"
                        className="switch"
                        checked={showQuote}
                        onChange={() => handleToggleWidget('quote', setShowQuote, showQuote)}
                      />
                    </div>

                    <div className="widget-toggle-card">
                      <div className="wt-info">
                        <strong>מונה מודעות ומעקבים חסומים של Drift Shield</strong>
                        <span>מעקב חי אחר כמות האיומים והפרסומות שנוטרלו ברקע</span>
                      </div>
                      <input
                        type="checkbox"
                        className="switch"
                        checked={showStats}
                        onChange={() => handleToggleWidget('stats', setShowStats, showStats)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: THEMES */}
              {customizerTab === 'themes' && (
                <div className="tab-themes">
                  <div className="theme-palette-grid">
                    {/* Default theme */}
                    <div
                      className={cx('theme-palette-card', state.settings.colorTheme === 'default' && 'selected')}
                      onClick={() => cmd({ type: 'settings:set', patch: { colorTheme: 'default' } })}
                    >
                      <div
                        className="theme-circle-preview"
                        style={{
                          background: 'linear-gradient(135deg, #202124 50%, #4285f4 50%)',
                        }}
                      />
                      <span className="theme-name">ברירת מחדל (Chrome Dark)</span>
                      {state.settings.colorTheme === 'default' && <span className="theme-active-tag">פעיל</span>}
                    </div>

                    {COLOR_THEMES.map((theme) => (
                      <div
                        key={theme.id}
                        className={cx('theme-palette-card', state.settings.colorTheme === theme.id && 'selected')}
                        onClick={() =>
                          cmd({
                            type: 'settings:set',
                            patch: { colorTheme: theme.id, ...(theme.id !== 'default' ? { spaceColors: false } : {}) },
                          })
                        }
                      >
                        <div
                          className="theme-circle-preview"
                          style={{
                            background: `linear-gradient(135deg, ${theme.bg} 50%, ${theme.accent} 50%)`,
                          }}
                        />
                        <span className="theme-name">{theme.name}</span>
                        {state.settings.colorTheme === theme.id && <span className="theme-active-tag">פעיל</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="customizer-footer">
              <button
                className="btn ghost"
                onClick={() => {
                  saveWallpapers('default', '', 35, 0);
                  saveShortcuts(DEFAULT_SHORTCUTS);
                  handleShortcutModeChange('custom');
                }}
              >
                איפוס להגדרות ברירת מחדל
              </button>
              <button className="btn primary" onClick={() => setIsCustomizerOpen(false)}>
                סיום וסגירה
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SHORTCUT ADD / EDIT DIALOG */}
      {editingShortcut && (
        <div className="modal-backdrop" onClick={() => setEditingShortcut(null)}>
          <div className="modal-content shortcut-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingShortcut.id ? 'עריכת קיצור דרך' : 'הוספת קיצור דרך חדש'}</h3>
              <button className="btn-icon" onClick={() => setEditingShortcut(null)}>
                <Icon name="x" size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveShortcut}>
              <div className="modal-body">
                <div className="field-group">
                  <label className="field-label">שם האתר:</label>
                  <input
                    type="text"
                    className="field-input"
                    placeholder="לדוגמה: Google, YouTube, GitHub"
                    value={editingShortcut.title}
                    onChange={(e) => setEditingShortcut({ ...editingShortcut, title: e.target.value })}
                    autoFocus
                  />
                </div>

                <div className="field-group">
                  <label className="field-label">כתובת האתר (URL):</label>
                  <input
                    type="text"
                    className="field-input"
                    placeholder="https://..."
                    value={editingShortcut.url}
                    onChange={(e) => setEditingShortcut({ ...editingShortcut, url: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn ghost" onClick={() => setEditingShortcut(null)}>
                  ביטול
                </button>
                <button type="submit" className="btn primary">
                  שמירת קיצור דרך
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function GoogleLogo() {
  return (
    <div className="google-logo" aria-label="Google">
      <svg viewBox="0 0 272 92" width="272" height="92">
        <path fill="#4285F4" d="M115.75 47.18c0 12.77-9.99 22.18-22.25 22.18s-22.25-9.41-22.25-22.18C71.25 34.32 81.24 25 93.5 25s22.25 9.32 22.25 22.18zm-9.74 0c0-7.98-5.79-13.44-12.51-13.44S80.99 39.2 80.99 47.18c0 7.9 5.79 13.44 12.51 13.44s12.51-5.55 12.51-13.44z"/>
        <path fill="#EA4335" d="M163.75 47.18c0 12.77-9.99 22.18-22.25 22.18s-22.25-9.41-22.25-22.18c0-12.85 9.99-22.18 22.25-22.18s22.25 9.32 22.25 22.18zm-9.74 0c0-7.98-5.79-13.44-12.51-13.44s-12.51 5.46-12.51 13.44c0 7.9 5.79 13.44 12.51 13.44s12.51-5.55 12.51-13.44z"/>
        <path fill="#4285F4" d="M209.75 26.34v39.82c0 16.38-9.66 23.07-21.08 23.07-10.75 0-17.22-7.19-19.66-13.07l8.48-3.53c1.51 3.61 5.21 8.16 11.18 8.16 7.29 0 11.83-4.5 11.83-12.92v-3.15h-.34c-2.18 2.69-6.38 5.04-11.68 5.04-11.09 0-21.25-9.66-21.25-22.09 0-12.52 10.16-22.26 21.25-22.26 5.29 0 9.49 2.35 11.68 4.96h.34v-4.08h9.45zm-8.82 20.92c0-7.81-5.21-13.52-11.84-13.52-6.72 0-12.35 5.71-12.35 13.52 0 7.73 5.63 13.36 12.35 13.36 6.63 0 11.84-5.63 11.84-13.36z"/>
        <path fill="#34A853" d="M225 3v65h-9.5V3h9.5z"/>
        <path fill="#EA4335" d="M262.02 54.48l7.56 5.04c-2.44 3.61-8.32 9.83-18.48 9.83-12.6 0-22.01-9.74-22.01-22.18 0-13.19 9.49-22.18 20.92-22.18 11.51 0 17.14 9.16 18.98 14.11l1.01 2.52-29.65 12.28c2.27 4.45 5.8 6.72 10.75 6.72 4.96 0 8.4-2.44 10.92-6.14zm-23.27-7.98l19.82-8.23c-1.09-2.77-4.37-4.7-8.23-4.7-4.95 0-11.84 4.37-11.59 12.93z"/>
        <path fill="#4285F4" d="M35.29 41.41V32H67c.31 1.64.47 3.58.47 5.68 0 7.06-1.93 15.79-8.15 22.01-6.05 6.3-13.78 9.66-24.02 9.66C16.32 69.35.36 53.89.36 34.91.36 15.93 16.32.47 35.3.47c10.5 0 17.98 4.12 23.6 9.49l-6.64 6.64c-4.03-3.78-9.49-6.72-16.96-6.72-13.86 0-24.7 11.17-24.7 25.03 0 13.86 10.84 25.03 24.7 25.03 8.99 0 14.11-3.61 17.39-6.89 2.66-2.66 4.41-6.46 5.1-11.65H35.29z"/>
      </svg>
    </div>
  );
}
