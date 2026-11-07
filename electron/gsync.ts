import { app, net, safeStorage, shell } from 'electron';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import type { SyncState } from '../shared/types';

/**
 * Drift Sync: everything Drift keeps (bookmarks and pins, spaces, open tabs,
 * history, settings) synced between your devices and backed up to your
 * Google account.
 *
 * Google lets only Google Chrome use Chrome Sync, so Drift keeps its own copy
 * in Google Drive's app data folder: a private space only Drift can read,
 * hidden from your Drive files and counted against your Drive storage.
 * Sign-in happens in your default browser (Google doesn't allow sign-in inside
 * embedded windows), with PKCE and a one-time local address to receive the answer.
 */

const SCOPES = ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/drive.appdata'];
const FILE_NAME = 'drift-sync.json';

export interface GoogleClient {
  clientId: string;
  clientSecret: string;
}

interface Stored {
  /** Encrypted with the OS keychain (safeStorage). */
  refreshToken?: string;
  email?: string;
  name?: string;
  picture?: string;
  deviceId: string;
  lastSync?: number;
  lastError?: string;
  /** Per-section hash and time of the last change, so the newer side wins. */
  sections: Record<string, { hash: string; updated: number }>;
  /** What to sync; all on by default. */
  what: SyncState['what'];
  /** A connection key entered in Settings, when the build has none. */
  client?: GoogleClient;
}

const storeFile = () => path.join(app.getPath('userData'), 'gsync.json');

/** The Google connection key: built in (CI writes it next to the app), or entered by the user. */
function builtInClient(): GoogleClient | undefined {
  for (const dir of [__dirname, path.join(__dirname, '..'), app.getAppPath(), process.resourcesPath ?? '']) {
    try {
      const c = JSON.parse(fs.readFileSync(path.join(dir, 'google-client.json'), 'utf8')) as GoogleClient;
      if (c.clientId && c.clientSecret) return c;
    } catch {
      /* not here */
    }
  }
  return undefined;
}

// ---------------------------------------------------------------- the synced document

export interface SyncedTab {
  url: string;
  title: string;
}
export interface SyncedPin {
  url: string;
  title: string;
  spaceId: string;
  essential: boolean;
}
export interface SyncedSpace {
  id: string;
  name: string;
  icon: string;
  accent: string;
}
export interface SyncedVisit {
  url: string;
  title: string;
  visits: number;
  last: number;
  bookmark?: boolean;
}

export interface SyncDoc {
  v: 1;
  devices: Record<string, { name: string; platform: string; updated: number; tabs: SyncedTab[] }>;
  spaces?: { updated: number; list: SyncedSpace[] };
  pins?: { updated: number; list: SyncedPin[] };
  settings?: { updated: number; values: Record<string, unknown> };
  history?: { updated: number; list: SyncedVisit[] };
}

/** What Drift has right now, for one sync round. */
export interface LocalData {
  tabs: SyncedTab[];
  spaces: SyncedSpace[];
  pins: SyncedPin[];
  settings: Record<string, unknown>;
  history: SyncedVisit[];
}

/** What the sync round decided Drift should take from the account. */
export interface Incoming {
  spaces?: SyncedSpace[];
  pins?: SyncedPin[];
  settings?: Record<string, unknown>;
  history?: SyncedVisit[];
}

const MAX_HISTORY = 4000;
const hash = (v: unknown) => crypto.createHash('sha1').update(JSON.stringify(v)).digest('hex');

/** History and bookmarks from every device: one entry per address, the most visits and latest visit win. */
export function mergeHistory(a: SyncedVisit[], b: SyncedVisit[]): SyncedVisit[] {
  const map = new Map<string, SyncedVisit>();
  for (const e of [...a, ...b]) {
    const cur = map.get(e.url);
    if (!cur) map.set(e.url, { ...e });
    else {
      cur.visits = Math.max(cur.visits, e.visits);
      if (e.last > cur.last) {
        cur.last = e.last;
        if (e.title) cur.title = e.title;
      }
      cur.bookmark = cur.bookmark || e.bookmark;
    }
  }
  return [...map.values()].sort((x, y) => Number(!!y.bookmark) - Number(!!x.bookmark) || y.last - x.last).slice(0, MAX_HISTORY);
}

export class GoogleSync {
  private s: Stored;
  private access?: { token: string; expires: number };
  private timer?: NodeJS.Timeout;
  private running?: Promise<void>;

  constructor(
    private hooks: {
      collect: () => LocalData;
      apply: (incoming: Incoming) => void;
      changed: () => void;
      otherDevicesChanged: () => void;
    },
  ) {
    let stored: Partial<Stored> = {};
    try {
      stored = JSON.parse(fs.readFileSync(storeFile(), 'utf8')) as Stored;
    } catch {
      /* first run */
    }
    this.s = {
      deviceId: stored.deviceId ?? crypto.randomUUID(),
      sections: stored.sections ?? {},
      what: { bookmarks: true, tabs: true, history: true, settings: true, ...(stored.what ?? {}) },
      ...stored,
    } as Stored;
    this.persist();
  }

  private remoteDevices: SyncDoc['devices'] = {};

  // ---------------------------------------------------------------- state for the UI

  get client(): GoogleClient | undefined {
    return builtInClient() ?? this.s.client;
  }

  state(): SyncState {
    return {
      configured: !!this.client,
      builtInKey: !!builtInClient(),
      signedIn: !!this.s.refreshToken,
      email: this.s.email,
      name: this.s.name,
      picture: this.s.picture,
      lastSync: this.s.lastSync,
      error: this.s.lastError,
      syncing: !!this.running,
      what: this.s.what,
      otherDevices: Object.entries(this.remoteDevices)
        .filter(([id]) => id !== this.s.deviceId)
        .map(([, d]) => ({ name: d.name, platform: d.platform, updated: d.updated, tabs: d.tabs.slice(0, 50) }))
        .sort((a, b) => b.updated - a.updated),
    };
  }

  /** Shows a problem (for example a cancelled sign-in) in Settings. */
  fail(message: string) {
    this.s.lastError = message;
    this.persist();
    this.hooks.changed();
  }

  setWhat(what: Partial<SyncState['what']>) {
    this.s.what = { ...this.s.what, ...what };
    this.persist();
    this.hooks.changed();
  }

  setClient(client: GoogleClient | undefined) {
    this.s.client = client && client.clientId.trim() ? { clientId: client.clientId.trim(), clientSecret: client.clientSecret.trim() } : undefined;
    this.persist();
    this.hooks.changed();
  }

  /** Sync now, then every few minutes while Drift is open. */
  start() {
    if (!this.s.refreshToken) return;
    void this.syncNow();
    clearInterval(this.timer);
    this.timer = setInterval(() => void this.syncNow(), 5 * 60_000);
  }

  // ---------------------------------------------------------------- sign-in

  async signIn(): Promise<void> {
    const client = this.client;
    if (!client) throw new Error('No Google connection key');
    const verifier = crypto.randomBytes(48).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    const stateParam = crypto.randomBytes(16).toString('hex');

    // A one-time local address receives Google's answer (the loopback flow for desktop apps).
    const { code, redirectUri } = await new Promise<{ code: string; redirectUri: string }>((resolve, reject) => {
      const server = http.createServer((req, res) => {
        const u = new URL(req.url ?? '/', 'http://127.0.0.1');
        const got = u.searchParams.get('code');
        const err = u.searchParams.get('error');
        const ok = !!got && u.searchParams.get('state') === stateParam;
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(doneHtml(ok));
        server.close();
        clearTimeout(timeout);
        if (ok) resolve({ code: got!, redirectUri });
        else reject(new Error(err ?? 'Sign-in was cancelled'));
      });
      let redirectUri = '';
      const timeout = setTimeout(() => {
        server.close();
        reject(new Error('Sign-in timed out'));
      }, 5 * 60_000);
      server.listen(0, '127.0.0.1', () => {
        const port = (server.address() as { port: number }).port;
        redirectUri = `http://127.0.0.1:${port}`;
        const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        auth.search = new URLSearchParams({
          client_id: client.clientId,
          redirect_uri: redirectUri,
          response_type: 'code',
          scope: SCOPES.join(' '),
          code_challenge: challenge,
          code_challenge_method: 'S256',
          access_type: 'offline',
          prompt: 'consent',
          state: stateParam,
        }).toString();
        void shell.openExternal(auth.toString());
      });
    });

    const tokens = await this.token({
      code,
      code_verifier: verifier,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });
    if (!tokens.refresh_token) throw new Error('Google did not grant offline access');
    this.s.refreshToken = this.seal(tokens.refresh_token);
    this.access = { token: tokens.access_token, expires: Date.now() + (tokens.expires_in - 60) * 1000 };
    const me = (await this.api('https://openidconnect.googleapis.com/v1/userinfo')) as { email?: string; name?: string; picture?: string };
    this.s.email = me.email;
    this.s.name = me.name;
    this.s.picture = me.picture;
    this.s.lastError = undefined;
    // A fresh sign-in starts from the account's copy, merging this device into it.
    this.s.sections = {};
    this.persist();
    this.hooks.changed();
    this.start();
  }

  async signOut(): Promise<void> {
    const refresh = this.s.refreshToken ? this.unseal(this.s.refreshToken) : undefined;
    clearInterval(this.timer);
    this.s.refreshToken = undefined;
    this.s.email = this.s.name = this.s.picture = undefined;
    this.s.lastSync = undefined;
    this.s.sections = {};
    this.access = undefined;
    this.remoteDevices = {};
    this.persist();
    this.hooks.changed();
    if (refresh) {
      await net.fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refresh)}`, { method: 'POST' }).catch(() => undefined);
    }
  }

  // ---------------------------------------------------------------- one sync round

  syncNow(): Promise<void> {
    if (!this.s.refreshToken) return Promise.resolve();
    if (this.running) return this.running;
    this.running = this.round()
      .then(() => {
        this.s.lastSync = Date.now();
        this.s.lastError = undefined;
      })
      .catch((err: Error) => {
        this.s.lastError = err.message;
      })
      .finally(() => {
        this.running = undefined;
        this.persist();
        this.hooks.changed();
      });
    this.hooks.changed();
    return this.running;
  }

  private async round() {
    const local = this.hooks.collect();
    const file = await this.findFile();
    const remote: SyncDoc = file ? ((await this.api(`https://www.googleapis.com/drive/v3/files/${file}?alt=media`)) as SyncDoc) : { v: 1, devices: {} };
    if (!remote.devices) remote.devices = {};
    const now = Date.now();
    const incoming: Incoming = {};
    const w = this.s.what;

    /** Newer side wins: local changes since the last round are pushed, otherwise the account's newer copy comes in. */
    const section = <T>(name: 'spaces' | 'pins' | 'settings', mine: T, theirs: { updated: number } | undefined, take: () => T): { updated: number } & Record<string, unknown> => {
      const h = hash(mine);
      const last = this.s.sections[name];
      const localChanged = !last || last.hash !== h;
      const localUpdated = localChanged ? now : last.updated;
      if (theirs && theirs.updated > (last?.updated ?? 0) && (!localChanged || !last)) {
        // The account has something newer (or this device is new to the account).
        const value = take();
        this.s.sections[name] = { hash: hash(value), updated: theirs.updated };
        (incoming as Record<string, unknown>)[name] = value;
        return theirs as { updated: number } & Record<string, unknown>;
      }
      this.s.sections[name] = { hash: h, updated: localUpdated };
      return { updated: localUpdated, [name === 'settings' ? 'values' : 'list']: mine };
    };

    if (w.bookmarks) {
      remote.spaces = section('spaces', local.spaces, remote.spaces, () => remote.spaces!.list) as SyncDoc['spaces'];
      remote.pins = section('pins', local.pins, remote.pins, () => remote.pins!.list) as SyncDoc['pins'];
    }
    if (w.settings) {
      remote.settings = section('settings', local.settings, remote.settings, () => remote.settings!.values) as SyncDoc['settings'];
    }
    if (w.history) {
      const merged = mergeHistory(remote.history?.list ?? [], local.history);
      incoming.history = merged;
      remote.history = { updated: now, list: merged };
    }
    remote.devices[this.s.deviceId] = {
      name: deviceName(),
      platform: process.platform,
      updated: now,
      tabs: w.tabs ? local.tabs.slice(0, 200) : [],
    };
    // Devices silent for 60 days drop off the list.
    for (const [id, d] of Object.entries(remote.devices)) if (now - d.updated > 60 * 86_400_000) delete remote.devices[id];

    await this.upload(file, remote);
    this.remoteDevices = remote.devices;
    this.hooks.apply(incoming);
    this.hooks.otherDevicesChanged();
  }

  // ---------------------------------------------------------------- Google APIs

  private async findFile(): Promise<string | undefined> {
    const q = new URLSearchParams({ spaces: 'appDataFolder', q: `name='${FILE_NAME}'`, fields: 'files(id,modifiedTime)', pageSize: '10' });
    const r = (await this.api(`https://www.googleapis.com/drive/v3/files?${q}`)) as { files?: { id: string }[] };
    return r.files?.[0]?.id;
  }

  private async upload(id: string | undefined, doc: SyncDoc) {
    const body = JSON.stringify(doc);
    if (id) {
      await this.api(`https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`, { method: 'PATCH', body, headers: { 'Content-Type': 'application/json' } });
      return;
    }
    const boundary = `drift${crypto.randomBytes(8).toString('hex')}`;
    const multipart =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      JSON.stringify({ name: FILE_NAME, parents: ['appDataFolder'] }) +
      `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--`;
    await this.api('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      body: multipart,
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    });
  }

  private async api(url: string, init: { method?: string; body?: string; headers?: Record<string, string> } = {}): Promise<unknown> {
    const token = await this.accessToken();
    const res = await net.fetch(url, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` } });
    if (res.status === 401) this.access = undefined;
    if (!res.ok) throw new Error(`Google answered ${res.status}`);
    const text = await res.text();
    return text ? JSON.parse(text) : {};
  }

  private async accessToken(): Promise<string> {
    if (this.access && this.access.expires > Date.now()) return this.access.token;
    if (!this.s.refreshToken) throw new Error('Not signed in');
    const t = await this.token({ refresh_token: this.unseal(this.s.refreshToken), grant_type: 'refresh_token' });
    this.access = { token: t.access_token, expires: Date.now() + (t.expires_in - 60) * 1000 };
    return t.access_token;
  }

  private async token(params: Record<string, string>): Promise<{ access_token: string; refresh_token?: string; expires_in: number }> {
    const client = this.client;
    if (!client) throw new Error('No Google connection key');
    const res = await net.fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ ...params, client_id: client.clientId, client_secret: client.clientSecret }).toString(),
    });
    const j = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string; error_description?: string };
    if (!res.ok || !j.access_token) {
      // A revoked or expired sign-in: forget it, so the UI asks to sign in again.
      if (j.error === 'invalid_grant') {
        this.s.refreshToken = undefined;
        this.persist();
      }
      throw new Error(j.error_description ?? j.error ?? `Sign-in failed (${res.status})`);
    }
    return { access_token: j.access_token, refresh_token: j.refresh_token, expires_in: j.expires_in ?? 3600 };
  }

  // ---------------------------------------------------------------- storage

  private seal(v: string) {
    return safeStorage.isEncryptionAvailable() ? `enc:${safeStorage.encryptString(v).toString('base64')}` : `raw:${Buffer.from(v).toString('base64')}`;
  }

  private unseal(v: string) {
    if (v.startsWith('enc:')) return safeStorage.decryptString(Buffer.from(v.slice(4), 'base64'));
    return Buffer.from(v.slice(4), 'base64').toString();
  }

  private persist() {
    try {
      fs.writeFileSync(storeFile(), JSON.stringify(this.s));
    } catch {
      /* best effort */
    }
  }
}

function deviceName() {
  const kind = process.platform === 'win32' ? 'Windows' : process.platform === 'darwin' ? 'Mac' : 'Linux';
  return `${os.hostname()} (${kind})`;
}

function doneHtml(ok: boolean) {
  return `<!doctype html><meta charset="utf-8"><title>Drift</title>
<body style="margin:0;height:100vh;display:grid;place-items:center;background:#141414;color:#e8e8e8;font:16px system-ui,sans-serif;text-align:center">
<div><div style="font-size:42px;font-weight:600;color:#8aa4ff">Drift</div>
<p>${ok ? 'You’re signed in. You can close this tab and go back to Drift. · נכנסת לחשבון. אפשר לסגור את הכרטיסייה ולחזור ל-Drift.' : 'Sign-in didn’t finish. You can close this tab and try again in Drift. · הכניסה לא הושלמה. אפשר לסגור את הכרטיסייה ולנסות שוב ב-Drift.'}</p></div></body>`;
}
