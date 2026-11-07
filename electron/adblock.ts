import { ElectronBlocker } from '@ghostery/adblocker-electron';
import { app, ipcMain, webContents, type Session } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';

const COSMETIC_CHANNEL = '@ghostery/adblocker/inject-cosmetic-filters';

export interface AdBlockHooks {
  enabled(): boolean;
  /** Blocking is paused for the site of this page URL. */
  isPaused(pageUrl: string): boolean;
  /** A request was blocked in this web contents; `count` is the total for its current page. */
  blocked(webContentsId: number, count: number): void;
  /** Blocking was switched on or off (request listeners need re-installing). */
  toggled(): void;
}

/**
 * Built-in ad and tracker blocking using Ghostery's engine with its prebuilt
 * ads + tracking lists (EasyList, EasyPrivacy, uBlock filters, including the
 * YouTube scriptlets). Lists are cached in userData. Network, cosmetic and
 * scriptlet filtering all respect the per-site pause.
 */
export class AdBlock {
  private blocker?: ElectronBlocker;
  private ses?: Session;
  private active = false;
  private counts = new Map<number, number>();

  constructor(private hooks: AdBlockHooks) {}

  async init(ses: Session) {
    this.ses = ses;
    const cache = path.join(app.getPath('userData'), 'adblock-engine.bin');
    try {
      this.blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch, {
        path: cache,
        read: fs.readFile,
        write: fs.writeFile,
      });
    } catch (err) {
      console.error('[drift] ad-block lists unavailable:', err);
      return;
    }
    this.blocker.on('request-blocked', (req) => {
      const id = (req as { tabId?: number }).tabId;
      if (typeof id !== 'number' || id < 0) return;
      const n = (this.counts.get(id) ?? 0) + 1;
      this.counts.set(id, n);
      this.hooks.blocked(id, n);
    });
    this.apply();
  }

  get engine() {
    return this.blocker;
  }

  get isActive() {
    return this.active;
  }

  get ready() {
    return !!this.blocker;
  }

  /** Turn blocking on or off to match settings. */
  apply() {
    const ses = this.ses;
    const blocker = this.blocker;
    if (!ses || !blocker) return;
    const want = this.hooks.enabled();
    if (want && !this.active) {
      blocker.enableBlockingInSession(ses);
      this.wrapCosmetics(blocker);
      this.active = true;
    } else if (!want && this.active) {
      blocker.disableBlockingInSession(ses);
      this.active = false;
    }
    this.hooks.toggled();
  }

  /** New page in this web contents: start counting from zero. */
  reset(webContentsId: number) {
    this.counts.delete(webContentsId);
  }

  /** Should blocking (and the YouTube ad skipper) run for this page? */
  activeFor(pageUrl: string) {
    return this.active && !!pageUrl && !this.hooks.isPaused(pageUrl);
  }

  /** Ghostery's page-level (cosmetic) filters, skipped on paused sites. Network filtering lives in RequestHub. */
  private wrapCosmetics(blocker: ElectronBlocker) {
    ipcMain.removeHandler(COSMETIC_CHANNEL);
    ipcMain.handle(COSMETIC_CHANNEL, (event, url: string, msg) => {
      if (this.hooks.isPaused(event.sender.getURL() || url)) return;
      return blocker.onInjectCosmeticFilters(event, url, msg);
    });
  }
}

export function hostOfUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
