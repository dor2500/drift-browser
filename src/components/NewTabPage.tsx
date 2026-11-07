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
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('ntp.searchHint', { engine })} spellCheck={false} autoFocus />
    </form>
  );

  const shortcuts = (
    <div className="ntp-shortcuts">
      {sites.length === 0 && <div className="ntp-empty">{t('ntp.empty')}</div>}
      {sites.map((s) => (
        <button key={s.url} className="ntp-tile" title={s.title} onClick={() => go(s.url)}>
          <span className="ntp-tile-icon">
            <img src={favicon(s.url)} alt="" onError={(e) => ((e.currentTarget.style.visibility = 'hidden'))} />
            <b>{hostOf(s.url)[0]?.toUpperCase()}</b>
          </span>
          <span className="ntp-tile-name">{s.title.split(/[-–|·:]/)[0].trim() || hostOf(s.url)}</span>
        </button>
      ))}
    </div>
  );

  return (
    <div className={`ntp ntp-${style}`}>
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
        {style === 'chrome' && <div className="ntp-wordmark">{engine}</div>}
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
