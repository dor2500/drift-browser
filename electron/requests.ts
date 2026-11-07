import type { ElectronBlocker } from '@ghostery/adblocker-electron';
import { webContents, type Session } from 'electron';
import type { PrivacySettings } from '../shared/settings';

/**
 * Electron allows one listener per request event per session, so every
 * request-level feature lives here, in order:
 *   1. HTTPS-first upgrade of plain-http pages (with fallback, see Browser)
 *   2. Tracking-parameter stripping on page loads (utm_*, fbclid, gclid, …)
 *   3. Ad and tracker blocking (Ghostery engine), unless paused for the site
 *   4. Privacy signals (Global Privacy Control, Do Not Track)
 *   5. Third-party cookie blocking (Cookie / Set-Cookie on cross-site requests)
 */
export interface RequestHooks {
  privacy(): PrivacySettings;
  engine(): 'chromium' | 'gecko';
  adblockActive(): boolean;
  blocker(): ElectronBlocker | undefined;
  isPaused(pageUrl: string): boolean;
  /** Hosts whose https upgrade failed, so they load over http. */
  httpAllowed(host: string): boolean;
  geckoUA(): string;
}

const TRACKING_PARAMS =
  /^(utm_[a-z_]+|fbclid|gclid|gclsrc|dclid|gbraid|wbraid|msclkid|mc_cid|mc_eid|yclid|_hsenc|_hsmi|igshid|mkt_tok|oly_anon_id|oly_enc_id|vero_id|wickedid|twclid|ttclid|li_fat_id|s_cid|_openstat|rb_clickid|epik)$/i;

/** Two-part public suffixes common enough to matter (example.co.il, example.co.uk …). */
const SECOND_LEVEL = /^(co|com|org|net|gov|ac|edu|ne|or|go|gob|muni)\.[a-z]{2}$/i;

export function siteOf(host: string): string {
  const parts = host.toLowerCase().replace(/\.$/, '').split('.');
  if (parts.length <= 2 || /^\d+$/.test(parts[parts.length - 1])) return parts.join('.');
  const lastTwo = parts.slice(-2).join('.');
  return SECOND_LEVEL.test(lastTwo) ? parts.slice(-3).join('.') : lastTwo;
}

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
};

export function stripTracking(url: string): string | undefined {
  try {
    const u = new URL(url);
    let changed = false;
    for (const key of [...u.searchParams.keys()]) {
      if (TRACKING_PARAMS.test(key)) {
        u.searchParams.delete(key);
        changed = true;
      }
    }
    return changed ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

const isLocal = (host: string) => host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || /^[\d.]+$/.test(host) || host.includes(':');

export class RequestHub {
  /** Main-frame URLs upgraded to https, so a failure can fall back to http. */
  readonly upgraded = new Set<string>();

  constructor(
    private ses: Session,
    private hooks: RequestHooks,
  ) {}

  private topSite(wcId: number | undefined, url: string, mainFrame: boolean) {
    if (mainFrame) return siteOf(hostOf(url));
    const wc = wcId !== undefined ? webContents.fromId(wcId) : undefined;
    return wc && !wc.isDestroyed() ? siteOf(hostOf(wc.getURL())) : '';
  }

  private pageUrl(wcId: number | undefined, url: string, mainFrame: boolean) {
    if (mainFrame) return url;
    const wc = wcId !== undefined ? webContents.fromId(wcId) : undefined;
    return wc && !wc.isDestroyed() ? wc.getURL() : '';
  }

  /** (Re)register all listeners; called again whenever the ad blocker toggles, since it replaces them. */
  install() {
    const { ses, hooks } = this;

    ses.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (details, cb) => {
      const p = hooks.privacy();
      const main = details.resourceType === 'mainFrame';
      if (main && p.httpsOnly && details.url.startsWith('http://')) {
        const host = hostOf(details.url);
        if (host && !isLocal(host) && !hooks.httpAllowed(host)) {
          const https = 'https://' + details.url.slice('http://'.length);
          this.upgraded.add(https);
          return cb({ redirectURL: https });
        }
      }
      if (main && p.stripTracking) {
        const clean = stripTracking(details.url);
        if (clean) return cb({ redirectURL: clean });
      }
      const blocker = hooks.blocker();
      if (blocker && hooks.adblockActive() && !hooks.isPaused(this.pageUrl(details.webContentsId, details.url, main))) {
        return blocker.onBeforeRequest(details, cb);
      }
      cb({});
    });

    ses.webRequest.onBeforeSendHeaders({ urls: ['<all_urls>'] }, (details, cb) => {
      const p = hooks.privacy();
      const headers: Record<string, string> = { ...details.requestHeaders };
      const host = hostOf(details.url);
      if (hooks.engine() === 'gecko') {
        headers['User-Agent'] = hooks.geckoUA();
        for (const k of Object.keys(headers)) if (/^sec-ch-ua/i.test(k)) delete headers[k];
      } else {
        const majorVer = (process.versions.chrome || '134').split('.')[0];
        headers['sec-ch-ua'] = `"Google Chrome";v="${majorVer}", "Chromium";v="${majorVer}", "Not?A_Brand";v="24"`;
        headers['sec-ch-ua-mobile'] = '?0';
        headers['sec-ch-ua-platform'] = process.platform === 'win32' ? '"Windows"' : process.platform === 'darwin' ? '"macOS"' : '"Linux"';
      }
      if (p.gpc) {
        headers['Sec-GPC'] = '1';
        headers['DNT'] = '1';
      }
      if (p.block3pCookies && details.resourceType !== 'mainFrame') {
        const top = this.topSite(details.webContentsId, details.url, false);
        if (top && siteOf(host) !== top) for (const k of Object.keys(headers)) if (k.toLowerCase() === 'cookie') delete headers[k];
      }
      cb({ requestHeaders: headers });
    });

    ses.webRequest.onHeadersReceived({ urls: ['<all_urls>'] }, (details, cb) => {
      const p = hooks.privacy();
      const main = details.resourceType === 'mainFrame';
      const strip = (headers: Record<string, string | string[]> | undefined): Record<string, string[]> | undefined => {
        if (!headers) return undefined;
        const norm = () => Object.fromEntries(Object.entries(headers).map(([k, v]) => [k, Array.isArray(v) ? v : [v]]));
        if (!p.block3pCookies || main) return norm();
        const top = this.topSite(details.webContentsId, details.url, false);
        if (!top || siteOf(hostOf(details.url)) === top) return norm();
        const out: Record<string, string[]> = {};
        for (const [k, v] of Object.entries(headers)) if (k.toLowerCase() !== 'set-cookie') out[k] = Array.isArray(v) ? v : [v];
        return out;
      };
      const blocker = hooks.blocker();
      if (blocker && hooks.adblockActive() && !hooks.isPaused(this.pageUrl(details.webContentsId, details.url, main))) {
        return blocker.onHeadersReceived(details, (resp) => cb({ ...resp, responseHeaders: strip(resp.responseHeaders ?? details.responseHeaders) }));
      }
      cb({ responseHeaders: strip(details.responseHeaders) });
    });
  }
}
