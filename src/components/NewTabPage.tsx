import { useEffect, useState } from 'react';
import { SEARCH_ENGINES } from '../../shared/settings';
import type { BrowserState } from '../../shared/types';
import { t, useLocale } from '../i18n';
import { cmd } from '../lib';
import { Icon } from './Icon';

type Site = { url: string; title: string };

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

/**
 * drift://newtab, shaped like the chosen browser's own new-tab page:
 * Chrome (search pill + round shortcuts), Edge (search box + rounded tiles),
 * Brave (blocked-tracker stats + clock), Firefox (Firefox Home shortcuts),
 * Opera (Speed Dial), Tor Browser (purple welcome), Zen (calm clock).
 */
export function NewTabPage({ state }: { state: BrowserState }) {
  const locale = useLocale();
  const [sites, setSites] = useState<Site[]>([]);
  const [stats, setStats] = useState({ blocked: 0, since: Date.now() });
  const [now, setNow] = useState(new Date());
  const [q, setQ] = useState('');
  const style = state.settings.theme;
  const engine = SEARCH_ENGINES[state.settings.searchEngine].name;

  useEffect(() => {
    void window.drift.topSites().then(setSites);
    void window.drift.stats().then(setStats);
    const timer = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(timer);
  }, []);

  const go = (input: string) => input.trim() && cmd({ type: 'tab:navigate', input });
  const time = now.toLocaleTimeString(locale.code, { hour: '2-digit', minute: '2-digit' });
  const hour = now.getHours();
  const greeting = t(hour < 12 ? 'ntp.morning' : hour < 18 ? 'ntp.afternoon' : 'ntp.evening');
  // Brave counts about 50 ms saved per blocked request.
  const saved = Math.round((stats.blocked * 50) / 1000);
  const savedText = saved < 60 ? `${saved}s` : saved < 3600 ? `${Math.round(saved / 60)}m` : `${(saved / 3600).toFixed(1)}h`;

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

  const defaultChromeSites: Site[] = [
    { url: 'https://www.google.com', title: 'Google' },
    { url: 'https://www.youtube.com', title: 'YouTube' },
    { url: 'https://mail.google.com', title: 'Gmail' },
    { url: 'https://maps.google.com', title: 'Google Maps' },
    { url: 'https://drive.google.com', title: 'Google Drive' },
    { url: 'https://github.com', title: 'GitHub' },
    { url: 'https://en.wikipedia.org', title: 'Wikipedia' },
    { url: 'https://news.google.com', title: 'Google News' },
  ];
  const displaySites = sites.length > 0 ? sites : style === 'chrome' ? defaultChromeSites : [];

  const shortcuts = (
    <div className="ntp-shortcuts">
      {displaySites.length === 0 && <div className="ntp-empty">{t('ntp.empty')}</div>}
      {displaySites.map((s) => (
        <button key={s.url} className="ntp-tile" title={s.title} onClick={() => go(s.url)}>
          <span className="ntp-tile-icon">
            <img src={favicon(s.url)} alt="" onError={(e) => ((e.currentTarget.style.visibility = 'hidden'))} />
            <b>{hostOf(s.url)[0]?.toUpperCase()}</b>
          </span>
          <span className="ntp-tile-name">{s.title.split(/[-–|·:]/)[0].trim() || hostOf(s.url)}</span>
        </button>
      ))}
      {style === 'chrome' && (
        <button
          className="ntp-tile"
          title="הוספת קיצור דרך (Add shortcut)"
          onClick={() => {
            const u = window.prompt('כתובת האתר (URL):', 'https://');
            if (u && /^https?:/i.test(u.trim())) go(u.trim());
          }}
        >
          <span className="ntp-tile-icon">
            <Icon name="plus" size={18} />
          </span>
          <span className="ntp-tile-name">הוספת קיצור דרך</span>
        </button>
      )}
    </div>
  );

  return (
    <div className={`ntp ntp-${style}`}>
      {style === 'chrome' && (
        <header className="ntp-chrome-header">
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
      {(style === 'brave' || style === 'zen') && <div className="ntp-clock">{time}</div>}
      {style === 'edge' && <div className="ntp-edge-time">{time}</div>}
      <div className="ntp-center">
        {style === 'zen' && <div className="ntp-greeting">{greeting}</div>}
        {style === 'chrome' && <GoogleLogo />}
        {style === 'tor' && (
          <div className="ntp-tor-head">
            <div className="ntp-tor-title">{t('ntp.torTitle')}</div>
            <div className="ntp-tor-note">{t('ntp.torNote')}</div>
          </div>
        )}
        {style === 'opera' && <div className="ntp-wordmark ntp-opera-greet">{greeting}</div>}
        {search}
        {(style === 'firefox' || style === 'opera') && <h3 className="ntp-heading">{t(style === 'opera' ? 'ntp.speedDial' : 'ntp.shortcuts')}</h3>}
        {shortcuts}
      </div>
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
