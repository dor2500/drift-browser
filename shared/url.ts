export const SEARCH_URL = 'https://www.google.com/search?q=';
export const HOME_URL = 'https://www.google.com/';

const SCHEME = /^(https?|file|about|chrome|data|view-source|drift):/i;

/**
 * Schemes Drift will navigate to from data it did not get from the user typing
 * in the address bar — synced pins, cross-device handoff, imported sessions.
 * Only web and Drift's own pages; never file:/data:/view-source:/chrome:/about:,
 * which such a source could use to read local files or spoof chrome.
 */
const SAFE_REMOTE_SCHEME = /^(https?|drift):/i;
export const isSafeRemoteUrl = (url: string): boolean => SAFE_REMOTE_SCHEME.test(url.trim());

/** Pages drawn by the shell itself instead of a web view. */
export const SETTINGS_URL = 'drift://settings';
export const NEWTAB_URL = 'drift://newtab';
export const STORE_URL = 'drift://store';
export const SHORTCUTS_URL = 'drift://shortcuts';
export const PERFORMANCE_URL = 'drift://performance';
export const BOOKMARKS_URL = 'drift://bookmarks';
export const SESSIONS_URL = 'drift://sessions';
export const HISTORY_URL = 'drift://history';
export const DOWNLOADS_URL = 'drift://downloads';
export const PASSWORDS_URL = 'drift://passwords';

export const isInternalUrl = (url: string) => url.startsWith('drift://');
export const internalTitle = (url: string) => {
  if (url.startsWith(SETTINGS_URL)) return 'Settings';
  if (url.startsWith(NEWTAB_URL)) return 'New Tab';
  if (url.startsWith(STORE_URL)) return 'Drift Store';
  if (url.startsWith(SHORTCUTS_URL)) return 'קיצורי מקלדת · Shortcuts';
  if (url.startsWith(PERFORMANCE_URL)) return 'ביצועים וזיכרון · Performance';
  if (url.startsWith(BOOKMARKS_URL)) return 'מנהל הסימניות · Bookmarks';
  if (url.startsWith(SESSIONS_URL)) return 'סשנים שמורים · Tab Stash & Sessions';
  if (url.startsWith(HISTORY_URL)) return 'היסטוריית גלישה · History';
  if (url.startsWith(DOWNLOADS_URL)) return 'מנהל ההורדות · Downloads';
  if (url.startsWith(PASSWORDS_URL)) return 'מנהל הסיסמאות · Passwords';
  return 'Drift';
};

const SEARCH_HOSTS = /(^|\.)(google\.[a-z.]+|duckduckgo\.com|bing\.com|search\.brave\.com|startpage\.com)$/i;
const HOST_LIKE = /^(localhost|\d{1,3}(\.\d{1,3}){3})(:\d+)?(\/.*)?$/i;
const DOMAIN = /^[^/\s]+\.[a-z]{2,}(:\d+)?([/?#].*)?$/i;

export function looksLikeUrl(input: string): boolean {
  const s = input.trim();
  if (!s || /\s/.test(s)) return false;
  return SCHEME.test(s) || HOST_LIKE.test(s) || DOMAIN.test(s);
}

/** Turns omnibox input into a URL: keeps real URLs, adds a scheme, or builds a search. */
export function normalizeInput(input: string, searchUrl = SEARCH_URL): string {
  const s = input.trim();
  if (!looksLikeUrl(s)) return searchUrl + encodeURIComponent(s);
  if (SCHEME.test(s)) return s;
  return (HOST_LIKE.test(s) ? 'http://' : 'https://') + s;
}

/** Short form for the sidebar URL pill: host + path, or the search query. */
export function displayUrl(url: string): string {
  try {
    const u = new URL(url);
    if (isInternalUrl(url)) return internalTitle(url);
    if (SEARCH_HOSTS.test(u.hostname) && u.searchParams.get('q')) return u.searchParams.get('q')!;
    const path = u.pathname === '/' ? '' : u.pathname;
    return (u.host || u.protocol) + path;
  } catch {
    return url;
  }
}
