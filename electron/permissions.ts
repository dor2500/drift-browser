import { app, type Session, type WebContents } from 'electron';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { PermissionPrompt } from '../shared/types';

type Decision = 'allow' | 'block';
type Saved = Record<string, Record<string, Decision>>; // origin -> kind -> decision

/** Harmless or already gated by a user gesture / OS security dialog (including WebAuthn / FIDO2 Security Keys / Passkeys). */
const ALWAYS = new Set([
  'fullscreen',
  'clipboard-sanitized-write',
  'pointerLock',
  'mediaKeySystem',
  'publickey-credentials-get',
  'publickey-credentials-create',
]);

/** Asked through the sidebar prompt. Anything not listed here is denied. */
const PROMPTABLE = new Set([
  'media',
  'geolocation',
  'notifications',
  'clipboard-read',
  'midi',
  'midiSysex',
  'idle-detection',
  'storage-access',
  'top-level-storage-access',
  'window-management',
  'keyboardLock',
  'speaker-selection',
  'openExternal',
  'fileSystem',
]);

interface Details {
  requestingUrl?: string;
  mediaTypes?: string[];
  mediaType?: string;
  externalURL?: string;
}

const file = () => path.join(app.getPath('userData'), 'permissions.json');

function originOf(url: string): string {
  try {
    const o = new URL(url).origin;
    return o === 'null' ? url : o;
  } catch {
    return url;
  }
}

/** Splits one Electron permission request into the kinds we remember per site. */
function kindsFor(permission: string, d: Details): string[] {
  if (permission === 'media') {
    const types = d.mediaTypes?.length ? d.mediaTypes : ['video', 'audio'];
    return [...new Set(types.map((t) => (t === 'video' ? 'camera' : 'microphone')))];
  }
  if (permission === 'openExternal') {
    try {
      return [`openExternal:${new URL(d.externalURL ?? '').protocol.replace(/:$/, '')}`];
    } catch {
      return ['openExternal:unknown'];
    }
  }
  return [permission];
}

export interface PermissionHooks {
  /** Which tab a request came from; undefined for popups and other windows. */
  tabIdFor(wc: WebContents): string | undefined;
  /** The prompt list changed, so push new state to the shell. */
  changed(): void;
}

/**
 * Per-site permission decisions with a prompt queue. Electron grants every
 * permission by default; this replaces that with Chrome-like behaviour:
 * ask once, optionally remember, and drop prompts when the page goes away.
 */
export class Permissions {
  prompts: PermissionPrompt[] = [];
  private callbacks = new Map<string, ((granted: boolean) => void)[]>();
  private saved: Saved = {};
  private saveTimer?: NodeJS.Timeout;

  constructor(private hooks: PermissionHooks) {
    try {
      this.saved = JSON.parse(fs.readFileSync(file(), 'utf8')) as Saved;
    } catch {
      this.saved = {};
    }
  }

  install(ses: Session) {
    ses.setPermissionRequestHandler((wc, permission, callback, details) =>
      this.request(wc, permission, callback, details as unknown as Details),
    );
    // Synchronous checks (navigator.permissions.query, Notification.permission,
    // device labels). Electron has no "ask" answer here: only remembered allows are true.
    ses.setPermissionCheckHandler((_wc, permission, requestingOrigin, details) => {
      if (ALWAYS.has(permission)) return true;
      const d = details as unknown as Details;
      const kind =
        permission === 'media'
          ? d.mediaType === 'video'
            ? 'camera'
            : d.mediaType === 'audio'
              ? 'microphone'
              : undefined
          : permission;
      return !!kind && this.saved[originOf(requestingOrigin)]?.[kind] === 'allow';
    });
  }

  private request(wc: WebContents, permission: string, callback: (granted: boolean) => void, d: Details) {
    if (ALWAYS.has(permission)) return callback(true);
    const origin = originOf(d.requestingUrl || wc.getURL());
    if (!PROMPTABLE.has(permission)) return callback(false);
    const tabId = this.hooks.tabIdFor(wc);
    if (!tabId) return callback(false);
    const kinds = kindsFor(permission, d);
    const saved = this.saved[origin] ?? {};
    if (kinds.some((k) => saved[k] === 'block')) return callback(false);
    const ask = kinds.filter((k) => saved[k] !== 'allow');
    if (ask.length === 0) return callback(true);

    // Pages often ask twice in a row; answer both with one prompt.
    const same = this.prompts.find(
      (p) => p.tabId === tabId && p.origin === origin && p.kinds.length === ask.length && ask.every((k) => p.kinds.includes(k)),
    );
    if (same) {
      this.callbacks.get(same.id)!.push(callback);
      return;
    }
    const prompt: PermissionPrompt = { id: randomUUID(), tabId, origin, kinds: ask };
    this.prompts.push(prompt);
    this.callbacks.set(prompt.id, [callback]);
    this.hooks.changed();
  }

  respond(id: string, allow: boolean, remember: boolean) {
    const p = this.prompts.find((x) => x.id === id);
    if (!p) return;
    if (remember) {
      const site = (this.saved[p.origin] ??= {});
      for (const k of p.kinds) site[k] = allow ? 'allow' : 'block';
      this.save();
    }
    this.settle(p.id, allow);
  }

  /** Deny and drop a tab's prompts: it navigated away or closed. */
  dismissTab(tabId: string) {
    for (const p of this.prompts.filter((x) => x.tabId === tabId)) this.settle(p.id, false);
  }

  /** Remembered decisions for one site, for the site-permissions menu. */
  siteDecisions(origin: string): [string, Decision][] {
    return Object.entries(this.saved[originOf(origin)] ?? {});
  }

  setDecision(origin: string, kind: string, decision: Decision | undefined) {
    const o = originOf(origin);
    const site = (this.saved[o] ??= {});
    if (decision) site[kind] = decision;
    else delete site[kind];
    if (Object.keys(site).length === 0) delete this.saved[o];
    this.save();
  }

  all(): Record<string, Record<string, Decision>> {
    return JSON.parse(JSON.stringify(this.saved));
  }

  clearSite(origin: string) {
    delete this.saved[originOf(origin)];
    this.save();
  }

  clearAll() {
    this.saved = {};
    this.save();
  }

  private settle(id: string, granted: boolean) {
    const cbs = this.callbacks.get(id) ?? [];
    this.callbacks.delete(id);
    this.prompts = this.prompts.filter((x) => x.id !== id);
    for (const cb of cbs) cb(granted);
    this.hooks.changed();
  }

  private save() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      try {
        fs.writeFileSync(file(), JSON.stringify(this.saved, null, 1));
      } catch (err) {
        console.error('[drift] failed to save permissions', err);
      }
    }, 200);
  }
}

export { originOf };
