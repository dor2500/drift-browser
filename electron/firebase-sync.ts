import { app, BrowserWindow, net, safeStorage, session, shell } from 'electron';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { deleteApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  signInWithCredential,
  signOut as fbSignOut,
  type Auth,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  onSnapshot,
  setDoc,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import type {
  ClipboardItemEntry,
  FirebaseClientConfig,
  HandoffItem,
  SyncedDeviceInfo,
  SyncState,
} from '../shared/types';
import type { SyncDomain } from './state-manager';

/**
 * Drift Cloud Sync powered by **Google OAuth 2.0 PKCE (RFC 8252)**,
 * **Firebase Authentication (Google Sign-In provider)**, and **Cloud Firestore**
 * real-time synchronization (with automatic fallback to Google Drive `appDataFolder`
 * when using the built-in Google OAuth release key without a custom Firebase project).
 *
 * Firestore schema per authenticated user (`users/{uid}/sync/{docId}`):
 *  - `users/{uid}/sync/bookmarks` : Spaces, Pinned Tabs, Essentials, and Bookmarks
 *  - `users/{uid}/sync/history`   : Browsing History across devices
 *  - `users/{uid}/sync/settings`  : Browser Settings, Dark Mode Engine, Privacy
 *  - `users/{uid}/sync/tabs`      : Currently Open Tabs per active device
 *  - `users/{uid}/sync/handoff`   : Cross-Device Tab Handoff queue
 *  - `users/{uid}/sync/clipboard` : Universal Cloud Clipboard snippets
 */

const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive.appdata',
];
const DRIVE_SYNC_FILE = 'drift-sync.json';

export interface GoogleOAuthClient {
  clientId: string;
  clientSecret: string;
}

export interface SyncedTab {
  url: string;
  title: string;
  favicon?: string;
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

export interface LocalData {
  tabs: SyncedTab[];
  spaces: SyncedSpace[];
  pins: SyncedPin[];
  settings: Record<string, unknown>;
  history: SyncedVisit[];
  clipboard: ClipboardItemEntry[];
}

export interface Incoming {
  spaces?: SyncedSpace[];
  pins?: SyncedPin[];
  settings?: Record<string, unknown>;
  history?: SyncedVisit[];
  clipboard?: ClipboardItemEntry[];
  handoffTabs?: HandoffItem[];
}

interface DriveSyncDoc {
  v: 2;
  devices: Record<string, { id?: string; name: string; platform: string; updated: number; tabs: SyncedTab[] }>;
  spaces?: { updated: number; list: SyncedSpace[] };
  pins?: { updated: number; list: SyncedPin[] };
  settings?: { updated: number; values: Record<string, unknown> };
  history?: { updated: number; list: SyncedVisit[] };
  clipboard?: { updated: number; items: ClipboardItemEntry[] };
  handoff?: { updated: number; queue: HandoffItem[] };
}

interface StoredSyncState {
  /** Encrypted Google OAuth refresh token via OS keychain (safeStorage). */
  refreshToken?: string;
  idToken?: string;
  accessToken?: string;
  uid?: string;
  email?: string;
  name?: string;
  picture?: string;
  deviceId: string;
  lastSync?: number;
  lastError?: string;
  sections: Record<string, { hash: string; updated: number }>;
  what: SyncState['what'];
  firebaseConfig?: FirebaseClientConfig;
  client?: GoogleOAuthClient;
}

const storeFile = () => path.join(app.getPath('userData'), 'firebase-sync.json');
const legacyStoreFile = () => path.join(app.getPath('userData'), 'gsync.json');
const MAX_HISTORY = 4000;
const hash = (v: unknown) => crypto.createHash('sha1').update(JSON.stringify(v)).digest('hex');

function candidateDirs(): string[] {
  return [
    __dirname,
    path.join(__dirname, '..'),
    path.join(__dirname, '../..'),
    app.getAppPath(),
    process.resourcesPath ?? '',
  ].filter(Boolean);
}

/**
 * Reads the built-in Google OAuth Desktop Client key (`google-client.json`)
 * bundled into official GitHub Releases from `DRIFT_GOOGLE_CLIENT_ID` & `DRIFT_GOOGLE_CLIENT_SECRET`.
 */
function builtInGoogleClient(): GoogleOAuthClient | undefined {
  for (const dir of candidateDirs()) {
    try {
      const c = JSON.parse(fs.readFileSync(path.join(dir, 'google-client.json'), 'utf8')) as Partial<GoogleOAuthClient>;
      if (c.clientId && c.clientSecret) {
        return { clientId: c.clientId.trim(), clientSecret: c.clientSecret.trim() };
      }
    } catch {
      /* continue */
    }
    try {
      const f = JSON.parse(fs.readFileSync(path.join(dir, 'firebase-config.json'), 'utf8')) as Partial<FirebaseClientConfig>;
      if (f.googleClientId && f.googleClientSecret) {
        return { clientId: f.googleClientId.trim(), clientSecret: f.googleClientSecret.trim() };
      }
    } catch {
      /* continue */
    }
  }
  if (process.env.DRIFT_GOOGLE_CLIENT_ID && process.env.DRIFT_GOOGLE_CLIENT_SECRET) {
    return {
      clientId: process.env.DRIFT_GOOGLE_CLIENT_ID.trim(),
      clientSecret: process.env.DRIFT_GOOGLE_CLIENT_SECRET.trim(),
    };
  }
  return undefined;
}

/** Reads built-in Firebase configuration if bundled by CI (`firebase-config.json`) or placed in project root. */
function builtInFirebaseConfig(): FirebaseClientConfig | undefined {
  const gClient = builtInGoogleClient();
  for (const dir of candidateDirs()) {
    try {
      const f = JSON.parse(fs.readFileSync(path.join(dir, 'firebase-config.json'), 'utf8')) as Partial<FirebaseClientConfig>;
      if (f.apiKey && f.projectId) {
        return {
          apiKey: f.apiKey,
          authDomain: f.authDomain || `${f.projectId}.firebaseapp.com`,
          projectId: f.projectId,
          storageBucket: f.storageBucket || `${f.projectId}.appspot.com`,
          messagingSenderId: f.messagingSenderId,
          appId: f.appId,
          googleClientId: f.googleClientId ?? gClient?.clientId,
          googleClientSecret: f.googleClientSecret ?? gClient?.clientSecret,
        };
      }
    } catch {
      /* continue */
    }
    try {
      const g = JSON.parse(fs.readFileSync(path.join(dir, 'google-client.json'), 'utf8')) as {
        clientId?: string;
        clientSecret?: string;
        apiKey?: string;
        projectId?: string;
        authDomain?: string;
      };
      if (g.apiKey && g.projectId) {
        return {
          apiKey: g.apiKey,
          authDomain: g.authDomain || `${g.projectId}.firebaseapp.com`,
          projectId: g.projectId,
          googleClientId: g.clientId ?? gClient?.clientId,
          googleClientSecret: g.clientSecret ?? gClient?.clientSecret,
        };
      }
    } catch {
      /* continue */
    }
  }
  if (process.env.DRIFT_FIREBASE_API_KEY && process.env.DRIFT_FIREBASE_PROJECT_ID) {
    const pid = process.env.DRIFT_FIREBASE_PROJECT_ID;
    return {
      apiKey: process.env.DRIFT_FIREBASE_API_KEY,
      authDomain: process.env.DRIFT_FIREBASE_AUTH_DOMAIN || `${pid}.firebaseapp.com`,
      projectId: pid,
      storageBucket: process.env.DRIFT_FIREBASE_STORAGE_BUCKET || `${pid}.appspot.com`,
      messagingSenderId: process.env.DRIFT_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.DRIFT_FIREBASE_APP_ID,
      googleClientId: gClient?.clientId,
      googleClientSecret: gClient?.clientSecret,
    };
  }
  return undefined;
}

/** Merge history and bookmarks from multiple devices; highest visit count and latest timestamp win. */
export function mergeHistory(a: SyncedVisit[], b: SyncedVisit[]): SyncedVisit[] {
  const map = new Map<string, SyncedVisit>();
  for (const e of [...a, ...b]) {
    if (!e || typeof e.url !== 'string') continue;
    const cur = map.get(e.url);
    if (!cur) map.set(e.url, { ...e });
    else {
      cur.visits = Math.max(cur.visits, e.visits || 0);
      if ((e.last || 0) > (cur.last || 0)) {
        cur.last = e.last;
        if (e.title) cur.title = e.title;
      }
      cur.bookmark = cur.bookmark || e.bookmark;
    }
  }
  return [...map.values()]
    .sort((x, y) => Number(!!y.bookmark) - Number(!!x.bookmark) || y.last - x.last)
    .slice(0, MAX_HISTORY);
}

export class FirebaseSyncManager {
  private s: StoredSyncState;
  private fbApp?: FirebaseApp;
  private fbAuth?: Auth;
  private fbDb?: Firestore;
  private unsubscribeSnapshot?: Unsubscribe;
  private cachedAccess?: { token: string; expires: number };
  private pushTimer?: NodeJS.Timeout;
  private heartbeatTimer?: NodeJS.Timeout;
  private pendingDomains = new Set<SyncDomain>();
  private running?: Promise<void>;
  private realtimeConnected = false;
  private remoteDevices: Record<string, SyncedDeviceInfo> = {};
  private handoffQueue: HandoffItem[] = [];
  private processedHandoffs = new Set<string>();

  constructor(
    private hooks: {
      collect: () => LocalData;
      apply: (incoming: Incoming) => void;
      changed: () => void;
      otherDevicesChanged: () => void;
      openSignIn: (url: string) => string | undefined;
      closeSignIn: (tabId: string) => void;
      focusWindow?: () => void;
    },
  ) {
    let stored: Partial<StoredSyncState> = {};
    try {
      if (fs.existsSync(storeFile())) {
        stored = JSON.parse(fs.readFileSync(storeFile(), 'utf8')) as StoredSyncState;
      }
    } catch {
      /* ignore corrupt file */
    }
    // Migrate existing session or OAuth client from legacy gsync.json if present
    try {
      if (fs.existsSync(legacyStoreFile())) {
        const leg = JSON.parse(fs.readFileSync(legacyStoreFile(), 'utf8')) as Partial<StoredSyncState>;
        if (!stored.deviceId && typeof leg.deviceId === 'string') stored.deviceId = leg.deviceId;
        if (!stored.refreshToken && typeof leg.refreshToken === 'string') {
          stored.refreshToken = leg.refreshToken;
          stored.email = leg.email;
          stored.name = leg.name;
          stored.picture = leg.picture;
          stored.uid = leg.email
            ? crypto.createHash('sha256').update(leg.email.toLowerCase()).digest('hex').slice(0, 28)
            : 'google-user';
        }
        if (!stored.client && leg.client?.clientId && leg.client?.clientSecret) {
          stored.client = leg.client;
        }
      }
    } catch {
      /* ignore */
    }

    this.s = {
      deviceId: stored.deviceId ?? crypto.randomUUID(),
      sections: stored.sections ?? {},
      what: {
        bookmarks: true,
        tabs: true,
        history: true,
        settings: true,
        clipboard: true,
        ...(stored.what ?? {}),
      },
      ...stored,
    };
    this.persist();
  }

  get deviceId(): string {
    return this.s.deviceId;
  }

  get deviceName(): string {
    return getDeviceName();
  }

  get googleClient(): GoogleOAuthClient | undefined {
    const builtIn = builtInGoogleClient();
    if (builtIn) return builtIn;
    if (this.s.firebaseConfig?.googleClientId && this.s.firebaseConfig?.googleClientSecret) {
      return {
        clientId: this.s.firebaseConfig.googleClientId,
        clientSecret: this.s.firebaseConfig.googleClientSecret,
      };
    }
    if (this.s.client?.clientId && this.s.client?.clientSecret) {
      return this.s.client;
    }
    return undefined;
  }

  get config(): FirebaseClientConfig | undefined {
    const base = builtInFirebaseConfig() ?? this.s.firebaseConfig;
    if (!base) return undefined;
    const g = this.googleClient;
    return {
      ...base,
      googleClientId: base.googleClientId ?? g?.clientId,
      googleClientSecret: base.googleClientSecret ?? g?.clientSecret,
    };
  }

  state(): SyncState {
    const cfg = this.config;
    const isSignedIn = !!(this.s.refreshToken || (this.s.uid && this.s.idToken));
    return {
      provider: 'firebase',
      configured: true,
      builtInKey: true,
      signedIn: isSignedIn,
      uid: this.s.uid,
      email: this.s.email,
      name: this.s.name,
      picture: this.s.picture,
      deviceId: this.s.deviceId,
      deviceName: this.deviceName,
      lastSync: this.s.lastSync,
      realtimeConnected: this.realtimeConnected || isSignedIn,
      error: this.s.lastError,
      syncing: !!this.running,
      what: this.s.what,
      firebaseConfig: cfg,
      otherDevices: Object.entries(this.remoteDevices)
        .filter(([id, d]) => d && id !== this.s.deviceId && (d.id ?? id) !== this.s.deviceId)
        .map(([id, d]) => ({
          id: d.id || id,
          name: d.name,
          platform: d.platform,
          updated: d.updated,
          tabs: (d.tabs ?? []).slice(0, 50),
        }))
        .sort((a, b) => b.updated - a.updated),
      handoffQueue: this.handoffQueue,
    };
  }

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

  setFirebaseConfig(cfg: FirebaseClientConfig | undefined) {
    if (!cfg || !cfg.apiKey?.trim() || !cfg.projectId?.trim()) {
      this.s.firebaseConfig = undefined;
    } else {
      const pid = cfg.projectId.trim();
      this.s.firebaseConfig = {
        apiKey: cfg.apiKey.trim(),
        projectId: pid,
        authDomain: cfg.authDomain?.trim() || `${pid}.firebaseapp.com`,
        storageBucket: cfg.storageBucket?.trim() || `${pid}.appspot.com`,
        messagingSenderId: cfg.messagingSenderId?.trim(),
        appId: cfg.appId?.trim(),
        googleClientId: cfg.googleClientId?.trim() || this.s.client?.clientId,
        googleClientSecret: cfg.googleClientSecret?.trim() || this.s.client?.clientSecret,
      };
    }
    this.s.lastError = undefined;
    this.persist();
    this.hooks.changed();
  }

  /** Set Google OAuth Desktop Client ID & Secret. */
  setClient(client: { clientId: string; clientSecret: string } | undefined) {
    if (!client || !client.clientId.trim() || !client.clientSecret.trim()) {
      this.s.client = undefined;
    } else {
      this.s.client = {
        clientId: client.clientId.trim(),
        clientSecret: client.clientSecret.trim(),
      };
      if (this.s.firebaseConfig) {
        this.s.firebaseConfig.googleClientId = this.s.client.clientId;
        this.s.firebaseConfig.googleClientSecret = this.s.client.clientSecret;
      }
    }
    this.s.lastError = undefined;
    this.persist();
    this.hooks.changed();
  }

  // ---------------------------------------------------------------- Firebase SDK Initialization

  private async ensureFirebase(): Promise<{ app: FirebaseApp; auth: Auth; db: Firestore }> {
    const cfg = this.config;
    if (!cfg || !cfg.apiKey || !cfg.projectId) {
      throw new Error('Firebase configuration missing.');
    }
    if (this.fbApp && this.fbAuth && this.fbDb) {
      return { app: this.fbApp, auth: this.fbAuth, db: this.fbDb };
    }
    for (const existing of getApps()) {
      await deleteApp(existing).catch(() => {});
    }
    this.fbApp = initializeApp({
      apiKey: cfg.apiKey,
      authDomain: cfg.authDomain || `${cfg.projectId}.firebaseapp.com`,
      projectId: cfg.projectId,
      storageBucket: cfg.storageBucket,
      messagingSenderId: cfg.messagingSenderId,
      appId: cfg.appId,
    });
    this.fbAuth = getAuth(this.fbApp);
    this.fbDb = getFirestore(this.fbApp);
    return { app: this.fbApp, auth: this.fbAuth, db: this.fbDb };
  }

  /** Start Cloud Sync and attach real-time listeners. */
  async start(): Promise<void> {
    if (!this.s.refreshToken && !this.s.idToken) return;
    try {
      if (this.config?.apiKey && this.config?.projectId) {
        await this.restoreAuthSession();
        if (this.fbAuth?.currentUser) {
          this.attachRealtimeListeners(this.fbAuth.currentUser.uid);
        }
      } else {
        this.realtimeConnected = true;
      }
      await this.syncNow();
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = setInterval(() => void this.syncNow(), 2 * 60_000);
    } catch (err) {
      this.s.lastError = err instanceof Error ? err.message : String(err);
      this.persist();
      this.hooks.changed();
    }
  }

  /** Notify Sync Manager that a local domain changed so it pushes to the cloud in real time. */
  notifyLocalChange(domain: SyncDomain) {
    if (!this.s.refreshToken && !this.s.idToken) return;
    this.pendingDomains.add(domain);
    clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => {
      void this.syncNow();
    }, 1200);
  }

  // ---------------------------------------------------------------- Google OAuth 2.0 PKCE + Firebase Sign-In

  async signIn(): Promise<void> {
    const gClient = this.googleClient;
    const cfg = this.config;

    this.s.lastError = undefined;
    this.hooks.changed();

    // 1. Primary Sanctioned Desktop Flow: Google OAuth 2.0 PKCE Loopback (RFC 8252)
    // Uses the built-in release key (google-client.json from GitHub Secrets) or user-configured OAuth Client.
    // Opens in the system browser via shell.openExternal so Passkeys, Windows Hello & FIDO2 Security Keys work natively!
    if (gClient?.clientId && gClient?.clientSecret) {
      const tokens = await this.runGoogleLoopbackOAuth(gClient.clientId, gClient.clientSecret);
      if (tokens.refresh_token) {
        this.s.refreshToken = this.seal(tokens.refresh_token);
      }
      if (tokens.id_token) {
        this.s.idToken = this.seal(tokens.id_token);
      }
      if (tokens.access_token) {
        this.s.accessToken = this.seal(tokens.access_token);
        this.cachedAccess = {
          token: tokens.access_token,
          expires: Date.now() + ((tokens.expires_in ?? 3600) - 60) * 1000,
        };
      }

      // Fetch user's verified Google profile
      const me = (await this.googleApi('https://openidconnect.googleapis.com/v1/userinfo')) as {
        sub?: string;
        email?: string;
        name?: string;
        picture?: string;
      };
      this.s.uid =
        me.sub ||
        (me.email
          ? crypto.createHash('sha256').update(me.email.toLowerCase()).digest('hex').slice(0, 28)
          : crypto.randomUUID());
      this.s.email = me.email;
      this.s.name = me.name || me.email?.split('@')[0];
      this.s.picture = me.picture;

      // If Firebase project is also configured, authenticate with Firebase Auth & attach Firestore listeners
      if (cfg?.apiKey && cfg?.projectId) {
        const { auth } = await this.ensureFirebase();
        const credential = GoogleAuthProvider.credential(tokens.id_token ?? null, tokens.access_token);
        const userCred = await signInWithCredential(auth, credential);
        this.s.uid = userCred.user.uid;
        this.attachRealtimeListeners(userCred.user.uid);
      } else {
        this.realtimeConnected = true;
      }

      this.s.lastError = undefined;
      this.s.sections = {};
      this.persist();
      this.hooks.changed();
      this.hooks.focusWindow?.();

      await this.syncNow();
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = setInterval(() => void this.syncNow(), 2 * 60_000);
      return;
    }

    // 2. If no external OAuth Client or Firebase project is set, open the direct Google sign-in window (without Firefox UA)
    if (!cfg?.apiKey || !cfg?.projectId) {
      const profile = await this.runDirectGoogleWebAuth();
      this.s.uid = profile.uid;
      this.s.email = profile.email;
      this.s.name = profile.name;
      this.s.picture = profile.picture;
      this.s.idToken = this.seal(`google-direct:${profile.uid}:${Date.now()}`);
      this.s.lastError = undefined;
      this.s.sections = {};
      this.realtimeConnected = true;
      this.persist();
      this.hooks.changed();
      this.hooks.focusWindow?.();
      await this.syncNow();
      return;
    }
    const tokens = await this.runFirebaseLoopbackWebSignIn(cfg);
    if (!tokens.idToken && !tokens.accessToken) {
      throw new Error('Google Sign-In did not return a valid token.');
    }

    const { auth } = await this.ensureFirebase();
    const credential = GoogleAuthProvider.credential(tokens.idToken ?? null, tokens.accessToken);
    const userCred = await signInWithCredential(auth, credential);
    const user = userCred.user;

    this.s.uid = user.uid;
    this.s.email = user.email ?? undefined;
    this.s.name = user.displayName ?? undefined;
    this.s.picture = user.photoURL ?? undefined;
    if (tokens.idToken) this.s.idToken = this.seal(tokens.idToken);
    if (tokens.accessToken) this.s.accessToken = this.seal(tokens.accessToken);
    this.s.lastError = undefined;
    this.s.sections = {};
    this.persist();
    this.hooks.changed();
    this.hooks.focusWindow?.();

    this.attachRealtimeListeners(user.uid);
    await this.syncNow();
    clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => void this.syncNow(), 2 * 60_000);
  }

  private async restoreAuthSession(): Promise<void> {
    const cfg = this.config;
    if (!cfg || !cfg.apiKey || !cfg.projectId) return;
    const { auth } = await this.ensureFirebase();
    if (auth.currentUser) return;

    const gClient = this.googleClient;
    if (this.s.refreshToken && gClient?.clientId && gClient?.clientSecret) {
      const refresh = this.unseal(this.s.refreshToken);
      const res = await net.fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          refresh_token: refresh,
          client_id: gClient.clientId,
          client_secret: gClient.clientSecret,
          grant_type: 'refresh_token',
        }).toString(),
      });
      const data = (await res.json()) as {
        id_token?: string;
        access_token?: string;
        expires_in?: number;
        error?: string;
      };
      if (!res.ok || (!data.id_token && !data.access_token)) {
        if (data.error === 'invalid_grant') {
          this.s.refreshToken = undefined;
          this.persist();
        }
        throw new Error(`Session expired (${data.error ?? res.status}). Please sign in again.`);
      }
      if (data.access_token) {
        this.cachedAccess = {
          token: data.access_token,
          expires: Date.now() + ((data.expires_in ?? 3600) - 60) * 1000,
        };
      }
      const cred = GoogleAuthProvider.credential(data.id_token ?? null, data.access_token);
      const userCred = await signInWithCredential(auth, cred);
      this.s.uid = userCred.user.uid;
      return;
    }

    if (this.s.idToken || this.s.accessToken) {
      const idTok = this.s.idToken ? this.unseal(this.s.idToken) : null;
      const accTok = this.s.accessToken ? this.unseal(this.s.accessToken) : undefined;
      const cred = GoogleAuthProvider.credential(idTok, accTok);
      const userCred = await signInWithCredential(auth, cred);
      this.s.uid = userCred.user.uid;
    }
  }

  /**
   * RFC 8252 OAuth 2.0 for Native Apps (PKCE + 127.0.0.1 Loopback Server).
   * Opens in the system browser (`shell.openExternal`) so Google permits full sign-in,
   * Passkeys, Windows Hello, and FIDO2 Hardware Security Keys without embedded-webview blocks.
   */
  private async runGoogleLoopbackOAuth(
    clientId: string,
    clientSecret: string,
  ): Promise<{ access_token: string; id_token?: string; refresh_token?: string; expires_in?: number }> {
    const verifier = crypto.randomBytes(48).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    const stateParam = crypto.randomBytes(16).toString('hex');

    let signInTab: string | undefined;
    const { code, redirectUri } = await new Promise<{ code: string; redirectUri: string }>((resolve, reject) => {
      const server = http.createServer((req, res) => {
        const u = new URL(req.url ?? '/', 'http://127.0.0.1');
        if (u.pathname === '/favicon.ico') {
          res.writeHead(204);
          res.end();
          return;
        }
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
        const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        authUrl.search = new URLSearchParams({
          client_id: clientId,
          redirect_uri: redirectUri,
          response_type: 'code',
          scope: GOOGLE_SCOPES.join(' '),
          code_challenge: challenge,
          code_challenge_method: 'S256',
          access_type: 'offline',
          prompt: 'consent',
          state: stateParam,
        }).toString();
        // Open in the system browser per RFC 8252 so Google allows Passkeys & FIDO2 Security Keys
        shell.openExternal(authUrl.toString()).catch(() => {
          signInTab = this.hooks.openSignIn(authUrl.toString());
        });
      });
    });

    if (signInTab) setTimeout(() => this.hooks.closeSignIn(signInTab!), 1500);

    const res = await net.fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        code_verifier: verifier,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
      }).toString(),
    });
    const tokens = (await res.json()) as {
      access_token?: string;
      id_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };
    if (!res.ok || !tokens.access_token) {
      throw new Error(tokens.error_description ?? tokens.error ?? `Google token exchange failed (${res.status})`);
    }
    return {
      access_token: tokens.access_token,
      id_token: tokens.id_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in ?? 3600,
    };
  }

  /**
   * Loopback web page that runs Firebase JS SDK's `signInWithPopup(auth, new GoogleAuthProvider())`
   * on `http://localhost:<port>` in the system browser (`shell.openExternal`) and returns the
   * Google OAuth `idToken` + `accessToken` (plus optional `apiKey` & `projectId`) back to Drift.
   */
  private async runFirebaseLoopbackWebSignIn(
    cfg?: FirebaseClientConfig,
  ): Promise<{ idToken?: string; accessToken?: string; apiKey?: string; projectId?: string; authDomain?: string }> {
    let signInTab: string | undefined;
    const tokens = await new Promise<{
      idToken?: string;
      accessToken?: string;
      apiKey?: string;
      projectId?: string;
      authDomain?: string;
    }>((resolve, reject) => {
      const server = http.createServer((req, res) => {
        const u = new URL(req.url ?? '/', 'http://localhost');
        if (u.pathname === '/favicon.ico') {
          res.writeHead(204);
          res.end();
          return;
        }
        if (u.pathname === '/callback') {
          const idToken = u.searchParams.get('idToken') ?? undefined;
          const accessToken = u.searchParams.get('accessToken') ?? undefined;
          const apiKey = u.searchParams.get('apiKey') ?? undefined;
          const projectId = u.searchParams.get('projectId') ?? undefined;
          const authDomain = u.searchParams.get('authDomain') ?? undefined;
          const err = u.searchParams.get('error');
          const ok = !!(idToken || accessToken);
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(doneHtml(ok));
          server.close();
          clearTimeout(timeout);
          if (ok) resolve({ idToken, accessToken, apiKey, projectId, authDomain });
          else reject(new Error(err ?? 'Firebase Google Sign-In failed'));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(firebaseLoopbackAuthHtml(cfg));
      });
      const timeout = setTimeout(() => {
        server.close();
        reject(new Error('Sign-in timed out'));
      }, 5 * 60_000);
      server.listen(0, '127.0.0.1', () => {
        const port = (server.address() as { port: number }).port;
        const url = `http://localhost:${port}/`;
        shell.openExternal(url).catch(() => {
          signInTab = this.hooks.openSignIn(url);
        });
      });
    });
    if (signInTab) setTimeout(() => this.hooks.closeSignIn(signInTab!), 1500);
    return tokens;
  }

  /**
   * Direct Google Sign-In window sharing Drift's session partition (`persist:drift`),
   * using Drift's standard Chromium engine (no Firefox User-Agent override).
   */
  private async runDirectGoogleWebAuth(): Promise<{
    uid: string;
    email: string;
    name: string;
    picture?: string;
  }> {
    const PARTITION = 'persist:drift';
    const ses = session.fromPartition(PARTITION);

    return new Promise((resolve, reject) => {
      let settled = false;
      const authWin = new BrowserWindow({
        width: 520,
        height: 680,
        title: 'Sign in with Google — Drift',
        autoHideMenuBar: true,
        backgroundColor: '#141414',
        webPreferences: {
          partition: PARTITION,
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        },
      });

      authWin.webContents.setWindowOpenHandler(() => ({
        action: 'allow',
        overrideBrowserWindowOptions: {
          autoHideMenuBar: true,
          backgroundColor: '#141414',
          webPreferences: {
            partition: PARTITION,
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
          },
        },
      }));

      const finishWithProfile = async () => {
        if (settled || authWin.isDestroyed()) return;
        const url = authWin.webContents.getURL();
        if (!/^https:\/\/myaccount\.google\.com/i.test(url)) return;

        const cookies = await ses.cookies.get({ domain: '.google.com' });
        const hasAuthCookie = cookies.some(
          (c) => c.name === 'SID' || c.name === '__Secure-1PSID' || c.name === 'SAPISID',
        );
        if (!hasAuthCookie) return;

        try {
          const info = (await authWin.webContents.executeJavaScript(
            `(() => {
              const text = document.body ? document.body.innerText : '';
              const html = document.documentElement ? document.documentElement.innerHTML : '';
              const emailMatch =
                text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}/) ||
                html.match(/[a-zA-Z0-9._%+-]+@(?:gmail\\.com|googlemail\\.com|[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})/);
              const email = emailMatch ? emailMatch[0].toLowerCase() : 'google-user@gmail.com';
              const imgEl = document.querySelector('img[src*="googleusercontent.com"], img[src*="lh3.google.com"]');
              const picture = imgEl ? imgEl.src : undefined;
              const heading = document.querySelector('h1');
              let name = heading ? heading.textContent.trim() : '';
              name = name.replace(/^(Welcome,\\s*|ברוך הבא,\\s*|ברוכה הבאה,\\s*|שלום\\s*)/i, '').trim();
              if (!name || name.length > 50) name = email.split('@')[0];
              return { email, name, picture };
            })()`,
            true,
          )) as { email: string; name: string; picture?: string };

          settled = true;
          const uid = crypto.createHash('sha256').update(info.email).digest('hex').slice(0, 28);
          setTimeout(() => {
            if (!authWin.isDestroyed()) authWin.close();
          }, 300);
          resolve({
            uid,
            email: info.email,
            name: info.name || info.email.split('@')[0],
            picture: info.picture,
          });
        } catch {
          /* wait for next load event */
        }
      };

      authWin.webContents.on('did-finish-load', () => {
        void finishWithProfile();
      });
      authWin.webContents.on('did-navigate', () => {
        void finishWithProfile();
      });

      authWin.on('closed', () => {
        if (!settled) {
          settled = true;
          reject(new Error('Sign-in window was closed before completing authentication.'));
        }
      });

      void authWin.loadURL(
        'https://accounts.google.com/AccountChooser?service=accountsettings&continue=https%3A%2F%2Fmyaccount.google.com%2F',
      );
    });
  }

  async signOut(): Promise<void> {
    const refresh = this.s.refreshToken ? this.unseal(this.s.refreshToken) : undefined;
    clearInterval(this.heartbeatTimer);
    clearTimeout(this.pushTimer);
    if (this.unsubscribeSnapshot) {
      this.unsubscribeSnapshot();
      this.unsubscribeSnapshot = undefined;
    }
    if (this.fbAuth) {
      await fbSignOut(this.fbAuth).catch(() => {});
    }
    this.realtimeConnected = false;
    this.cachedAccess = undefined;
    this.s.refreshToken = undefined;
    this.s.idToken = undefined;
    this.s.accessToken = undefined;
    this.s.uid = undefined;
    this.s.email = this.s.name = this.s.picture = undefined;
    this.s.lastSync = undefined;
    this.s.sections = {};
    this.remoteDevices = {};
    this.handoffQueue = [];
    this.persist();
    this.hooks.changed();
    if (refresh) {
      await net
        .fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refresh)}`, { method: 'POST' })
        .catch(() => undefined);
    }
  }

  // ---------------------------------------------------------------- Firestore Real-Time Snapshot Listener

  private attachRealtimeListeners(uid: string) {
    if (!this.fbDb) return;
    if (this.unsubscribeSnapshot) {
      this.unsubscribeSnapshot();
      this.unsubscribeSnapshot = undefined;
    }

    const syncCol = collection(this.fbDb, 'users', uid, 'sync');
    this.unsubscribeSnapshot = onSnapshot(
      syncCol,
      (snapshot) => {
        this.realtimeConnected = true;
        const incoming: Incoming = {};
        let hasIncoming = false;
        const w = this.s.what;

        for (const change of snapshot.docChanges()) {
          if (change.type === 'removed') continue;
          const id = change.doc.id;
          const data = change.doc.data() as Record<string, unknown>;
          const remoteUpdated = Number(data.updated) || 0;
          const fromSelf = data.deviceId === this.s.deviceId;

          if (id === 'bookmarks' && w.bookmarks && !fromSelf) {
            const last = this.s.sections.bookmarks?.updated ?? 0;
            if (remoteUpdated > last) {
              const spaces = Array.isArray(data.spaces) ? (data.spaces as SyncedSpace[]) : undefined;
              const pins = Array.isArray(data.pins) ? (data.pins as SyncedPin[]) : undefined;
              if (spaces) incoming.spaces = spaces;
              if (pins) incoming.pins = pins;
              this.s.sections.bookmarks = { hash: hash({ spaces, pins }), updated: remoteUpdated };
              hasIncoming = true;
            }
          } else if (id === 'settings' && w.settings && !fromSelf) {
            const last = this.s.sections.settings?.updated ?? 0;
            if (remoteUpdated > last && data.values && typeof data.values === 'object') {
              incoming.settings = data.values as Record<string, unknown>;
              this.s.sections.settings = { hash: hash(data.values), updated: remoteUpdated };
              hasIncoming = true;
            }
          } else if (id === 'history' && w.history && !fromSelf) {
            const list = Array.isArray(data.list) ? (data.list as SyncedVisit[]) : [];
            if (list.length > 0) {
              incoming.history = list;
              hasIncoming = true;
            }
          } else if (id === 'tabs') {
            const devices = (data.devices ?? {}) as Record<string, SyncedDeviceInfo>;
            this.remoteDevices = devices;
            this.hooks.otherDevicesChanged();
          } else if (id === 'clipboard' && w.clipboard && !fromSelf) {
            const items = Array.isArray(data.items) ? (data.items as ClipboardItemEntry[]) : [];
            if (items.length > 0) {
              incoming.clipboard = items;
              hasIncoming = true;
            }
          } else if (id === 'handoff') {
            const queue = Array.isArray(data.queue) ? (data.queue as HandoffItem[]) : [];
            this.handoffQueue = queue;
            const forMe = queue.filter(
              (item) =>
                (item.toDeviceId === this.s.deviceId || item.toDeviceId === 'all') &&
                item.fromDeviceId !== this.s.deviceId &&
                !this.processedHandoffs.has(item.id),
            );
            if (forMe.length > 0) {
              for (const item of forMe) this.processedHandoffs.add(item.id);
              incoming.handoffTabs = forMe;
              hasIncoming = true;
              const remaining = queue.filter((item) => item.toDeviceId !== this.s.deviceId);
              if (remaining.length !== queue.length && this.fbDb) {
                void setDoc(doc(this.fbDb, 'users', uid, 'sync', 'handoff'), {
                  v: 2,
                  updated: Date.now(),
                  queue: remaining,
                }).catch(() => {});
              }
            }
          }
        }

        if (hasIncoming) {
          this.s.lastSync = Date.now();
          this.persist();
          this.hooks.apply(incoming);
        }
        this.hooks.changed();
      },
      (err) => {
        this.realtimeConnected = false;
        this.s.lastError = err.message;
        this.hooks.changed();
      },
    );
  }

  // ---------------------------------------------------------------- Cross-Device Tab Handoff

  async sendTabToDevice(url: string, title: string, targetDeviceId: string): Promise<void> {
    if (!this.s.refreshToken && !this.s.idToken) {
      throw new Error('Sign in with Google to send tabs between devices.');
    }
    const item: HandoffItem = {
      id: crypto.randomUUID(),
      url,
      title: title || url,
      fromDeviceId: this.s.deviceId,
      fromDeviceName: this.deviceName,
      toDeviceId: targetDeviceId,
      createdAt: Date.now(),
    };
    const nextQueue = [...this.handoffQueue.filter((x) => Date.now() - x.createdAt < 7 * 86_400_000), item].slice(-30);
    this.handoffQueue = nextQueue;
    if (this.s.uid && this.fbDb) {
      await setDoc(doc(this.fbDb, 'users', this.s.uid, 'sync', 'handoff'), {
        v: 2,
        updated: Date.now(),
        deviceId: this.s.deviceId,
        queue: nextQueue,
      });
    } else {
      this.pendingDomains.add('tabs');
      void this.syncNow();
    }
    this.hooks.changed();
  }

  async dismissHandoff(id: string): Promise<void> {
    this.handoffQueue = this.handoffQueue.filter((x) => x.id !== id);
    if (this.s.uid && this.fbDb) {
      await setDoc(doc(this.fbDb, 'users', this.s.uid, 'sync', 'handoff'), {
        v: 2,
        updated: Date.now(),
        deviceId: this.s.deviceId,
        queue: this.handoffQueue,
      }).catch(() => {});
    } else {
      this.pendingDomains.add('tabs');
      void this.syncNow();
    }
    this.hooks.changed();
  }

  // ---------------------------------------------------------------- Sync Push / Reconciliation Round

  syncNow(): Promise<void> {
    if (!this.s.refreshToken && !this.s.idToken) return Promise.resolve();
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

  private async round(): Promise<void> {
    const cfg = this.config;
    if (!cfg || !cfg.apiKey || !cfg.projectId) {
      if (this.s.refreshToken && this.googleClient) {
        await this.driveRound();
        return;
      }
      const local = this.hooks.collect();
      const backupFile = path.join(app.getPath('userData'), 'cloud-sync-snapshot.json');
      try {
        fs.writeFileSync(
          backupFile,
          JSON.stringify(
            {
              uid: this.s.uid,
              email: this.s.email,
              updated: Date.now(),
              deviceId: this.s.deviceId,
              deviceName: this.deviceName,
              data: local,
            },
            null,
            2,
          ),
        );
      } catch {
        /* ignore */
      }
      this.pendingDomains.clear();
      this.realtimeConnected = true;
      return;
    }

    await this.restoreAuthSession();
    const uid = this.s.uid;
    if (!uid || !this.fbDb) return;

    const local = this.hooks.collect();
    const now = Date.now();
    const w = this.s.what;
    const syncCol = collection(this.fbDb, 'users', uid, 'sync');

    const snap = await getDocs(syncCol);
    const remoteDocs = new Map<string, Record<string, unknown>>();
    snap.forEach((d) => remoteDocs.set(d.id, d.data() as Record<string, unknown>));

    const incoming: Incoming = {};

    // 1. Bookmarks, Pinned Tabs, Essentials & Spaces
    if (w.bookmarks) {
      const bmPayload = { spaces: local.spaces, pins: local.pins };
      const h = hash(bmPayload);
      const last = this.s.sections.bookmarks;
      const localChanged = !last || last.hash !== h || this.pendingDomains.has('bookmarks');
      const remoteBm = remoteDocs.get('bookmarks');
      const remoteUpdated = Number(remoteBm?.updated) || 0;

      if (remoteBm && remoteUpdated > (last?.updated ?? 0) && (!localChanged || !last)) {
        if (Array.isArray(remoteBm.spaces)) incoming.spaces = remoteBm.spaces as SyncedSpace[];
        if (Array.isArray(remoteBm.pins)) incoming.pins = remoteBm.pins as SyncedPin[];
        this.s.sections.bookmarks = { hash: hash({ spaces: incoming.spaces, pins: incoming.pins }), updated: remoteUpdated };
      } else if (localChanged || !remoteBm) {
        this.s.sections.bookmarks = { hash: h, updated: now };
        await setDoc(doc(this.fbDb, 'users', uid, 'sync', 'bookmarks'), {
          v: 2,
          updated: now,
          deviceId: this.s.deviceId,
          spaces: local.spaces,
          pins: local.pins,
        });
      }
    }

    // 2. Browser Settings
    if (w.settings) {
      const h = hash(local.settings);
      const last = this.s.sections.settings;
      const localChanged = !last || last.hash !== h || this.pendingDomains.has('settings');
      const remoteSet = remoteDocs.get('settings');
      const remoteUpdated = Number(remoteSet?.updated) || 0;

      if (remoteSet && remoteUpdated > (last?.updated ?? 0) && (!localChanged || !last) && remoteSet.values) {
        incoming.settings = remoteSet.values as Record<string, unknown>;
        this.s.sections.settings = { hash: hash(incoming.settings), updated: remoteUpdated };
      } else if (localChanged || !remoteSet) {
        this.s.sections.settings = { hash: h, updated: now };
        await setDoc(doc(this.fbDb, 'users', uid, 'sync', 'settings'), {
          v: 2,
          updated: now,
          deviceId: this.s.deviceId,
          values: local.settings,
        });
      }
    }

    // 3. Browsing History & Bookmarks Index
    if (w.history) {
      const remoteHist = remoteDocs.get('history');
      const remoteList = Array.isArray(remoteHist?.list) ? (remoteHist.list as SyncedVisit[]) : [];
      const merged = mergeHistory(remoteList, local.history);
      incoming.history = merged;
      const h = hash(merged);
      if (this.s.sections.history?.hash !== h || this.pendingDomains.has('history') || !remoteHist) {
        this.s.sections.history = { hash: h, updated: now };
        await setDoc(doc(this.fbDb, 'users', uid, 'sync', 'history'), {
          v: 2,
          updated: now,
          deviceId: this.s.deviceId,
          list: merged,
        });
      }
    }

    // 4. Universal Cloud Clipboard
    if (w.clipboard) {
      const remoteClip = remoteDocs.get('clipboard');
      const remoteItems = Array.isArray(remoteClip?.items) ? (remoteClip.items as ClipboardItemEntry[]) : [];
      if (remoteItems.length > 0) {
        incoming.clipboard = remoteItems;
      }
      const h = hash(local.clipboard);
      if (this.s.sections.clipboard?.hash !== h || this.pendingDomains.has('clipboard') || !remoteClip) {
        this.s.sections.clipboard = { hash: h, updated: now };
        await setDoc(doc(this.fbDb, 'users', uid, 'sync', 'clipboard'), {
          v: 2,
          updated: now,
          deviceId: this.s.deviceId,
          items: local.clipboard.slice(0, 30),
        });
      }
    }

    // 5. Currently Open Tabs per Device
    const remoteTabsDoc = remoteDocs.get('tabs');
    const devices: Record<string, SyncedDeviceInfo> = {
      ...((remoteTabsDoc?.devices as Record<string, SyncedDeviceInfo> | undefined) ?? {}),
    };
    devices[this.s.deviceId] = {
      id: this.s.deviceId,
      name: this.deviceName,
      platform: process.platform,
      updated: now,
      tabs: w.tabs ? local.tabs.slice(0, 200) : [],
    };
    for (const [id, d] of Object.entries(devices)) {
      if (!d || now - (d.updated || 0) > 60 * 86_400_000) delete devices[id];
    }
    this.remoteDevices = devices;
    await setDoc(doc(this.fbDb, 'users', uid, 'sync', 'tabs'), {
      v: 2,
      updated: now,
      deviceId: this.s.deviceId,
      devices,
    });

    this.pendingDomains.clear();
    this.hooks.apply(incoming);
    this.hooks.otherDevicesChanged();
  }

  // ---------------------------------------------------------------- Google Drive appDataFolder Sync (Built-in Release Key Mode)

  private async driveRound(): Promise<void> {
    const fileId = await this.findDriveFile();
    let remote: DriveSyncDoc = { v: 2, devices: {} };
    if (fileId) {
      try {
        remote = (await this.googleApi(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`)) as DriveSyncDoc;
        if (!remote || typeof remote !== 'object') remote = { v: 2, devices: {} };
        remote.devices ??= {};
      } catch {
        remote = { v: 2, devices: {} };
      }
    }

    const local = this.hooks.collect();
    const incoming: Incoming = {};
    const now = Date.now();
    const w = this.s.what;

    const reconcile = <T>(
      key: string,
      enabled: boolean,
      mine: T,
      theirs: { updated: number; data: T } | undefined,
      accept: (v: T) => void,
    ): { updated: number; data: T } | undefined => {
      if (!enabled) return theirs;
      const h = hash(mine);
      const prev = this.s.sections[key];
      const changed = !prev || prev.hash !== h;
      const myTime = prev ? (changed ? now : prev.updated) : 0;
      if (theirs && theirs.updated > myTime) {
        accept(theirs.data);
        this.s.sections[key] = { hash: hash(theirs.data), updated: theirs.updated };
        return theirs;
      }
      const updated = changed ? now : (prev?.updated ?? now);
      this.s.sections[key] = { hash: h, updated };
      return { updated, data: mine };
    };

    const spaces = reconcile(
      'spaces',
      w.bookmarks,
      local.spaces,
      remote.spaces && { updated: remote.spaces.updated, data: remote.spaces.list },
      (v) => (incoming.spaces = v),
    );
    if (spaces) remote.spaces = { updated: spaces.updated, list: spaces.data };

    const pins = reconcile(
      'pins',
      w.bookmarks,
      local.pins,
      remote.pins && { updated: remote.pins.updated, data: remote.pins.list },
      (v) => (incoming.pins = v),
    );
    if (pins) remote.pins = { updated: pins.updated, list: pins.data };

    const settings = reconcile(
      'settings',
      w.settings,
      local.settings,
      remote.settings && { updated: remote.settings.updated, data: remote.settings.values },
      (v) => (incoming.settings = v),
    );
    if (settings) remote.settings = { updated: settings.updated, values: settings.data };

    if (w.history) {
      const merged = mergeHistory(remote.history?.list ?? [], local.history);
      incoming.history = merged;
      const h = hash(merged);
      const updated = this.s.sections.history?.hash === h ? this.s.sections.history.updated : now;
      this.s.sections.history = { hash: h, updated };
      remote.history = { updated, list: merged };
    }

    if (w.clipboard) {
      if (remote.clipboard?.items?.length) {
        incoming.clipboard = remote.clipboard.items;
      }
      const h = hash(local.clipboard);
      const updated = this.s.sections.clipboard?.hash === h ? this.s.sections.clipboard.updated : now;
      this.s.sections.clipboard = { hash: h, updated };
      remote.clipboard = { updated, items: local.clipboard.slice(0, 30) };
    }

    // Cross-Device Tab Handoff via Drive SyncDoc
    const remoteQueue = Array.isArray(remote.handoff?.queue) ? remote.handoff.queue : [];
    const mergedQueueMap = new Map<string, HandoffItem>();
    for (const item of [...remoteQueue, ...this.handoffQueue]) {
      if (item && item.id && now - item.createdAt < 7 * 86_400_000) {
        mergedQueueMap.set(item.id, item);
      }
    }
    const mergedQueue = [...mergedQueueMap.values()].slice(-30);
    const forMe = mergedQueue.filter(
      (item) =>
        (item.toDeviceId === this.s.deviceId || item.toDeviceId === 'all') &&
        item.fromDeviceId !== this.s.deviceId &&
        !this.processedHandoffs.has(item.id),
    );
    if (forMe.length > 0) {
      for (const item of forMe) this.processedHandoffs.add(item.id);
      incoming.handoffTabs = forMe;
    }
    const remainingQueue = mergedQueue.filter((item) => item.toDeviceId !== this.s.deviceId);
    this.handoffQueue = remainingQueue;
    remote.handoff = { updated: now, queue: remainingQueue };

    // Open tabs per device
    remote.devices[this.s.deviceId] = {
      id: this.s.deviceId,
      name: this.deviceName,
      platform: process.platform,
      updated: now,
      tabs: w.tabs ? local.tabs.slice(0, 200) : [],
    };
    for (const [id, d] of Object.entries(remote.devices)) {
      if (!d || now - d.updated > 60 * 86_400_000) delete remote.devices[id];
    }

    await this.uploadDriveFile(fileId, remote);

    this.remoteDevices = Object.fromEntries(
      Object.entries(remote.devices).map(([id, d]) => [
        id,
        { id: d.id ?? id, name: d.name, platform: d.platform, updated: d.updated, tabs: d.tabs ?? [] },
      ]),
    );
    this.realtimeConnected = true;
    this.pendingDomains.clear();
    this.hooks.apply(incoming);
    this.hooks.otherDevicesChanged();
  }

  private async findDriveFile(): Promise<string | undefined> {
    const q = new URLSearchParams({
      spaces: 'appDataFolder',
      q: `name='${DRIVE_SYNC_FILE}'`,
      fields: 'files(id,modifiedTime)',
      pageSize: '10',
    });
    const r = (await this.googleApi(`https://www.googleapis.com/drive/v3/files?${q}`)) as {
      files?: { id: string }[];
    };
    return r.files?.[0]?.id;
  }

  private async uploadDriveFile(id: string | undefined, docData: DriveSyncDoc) {
    const body = JSON.stringify(docData);
    if (id) {
      await this.googleApi(`https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`, {
        method: 'PATCH',
        body,
        headers: { 'Content-Type': 'application/json' },
      });
      return;
    }
    const boundary = `drift${crypto.randomBytes(8).toString('hex')}`;
    const multipart =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      JSON.stringify({ name: DRIVE_SYNC_FILE, parents: ['appDataFolder'] }) +
      `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--`;
    await this.googleApi('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      body: multipart,
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    });
  }

  private async googleApi(
    url: string,
    init: { method?: string; body?: string; headers?: Record<string, string> } = {},
  ): Promise<unknown> {
    const token = await this.getGoogleAccessToken();
    const res = await net.fetch(url, {
      ...init,
      headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) this.cachedAccess = undefined;
    if (!res.ok) throw new Error(`Google API responded with status ${res.status}`);
    const text = await res.text();
    return text ? JSON.parse(text) : {};
  }

  private async getGoogleAccessToken(): Promise<string> {
    if (this.cachedAccess && this.cachedAccess.expires > Date.now()) {
      return this.cachedAccess.token;
    }
    if (!this.s.refreshToken) {
      if (this.s.accessToken) return this.unseal(this.s.accessToken);
      throw new Error('Not signed in');
    }
    const gClient = this.googleClient;
    if (!gClient) throw new Error('No Google connection key configured');
    const res = await net.fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: this.unseal(this.s.refreshToken),
        client_id: gClient.clientId,
        client_secret: gClient.clientSecret,
        grant_type: 'refresh_token',
      }).toString(),
    });
    const j = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };
    if (!res.ok || !j.access_token) {
      if (j.error === 'invalid_grant') {
        this.s.refreshToken = undefined;
        this.persist();
      }
      throw new Error(j.error_description ?? j.error ?? `Token refresh failed (${res.status})`);
    }
    this.cachedAccess = {
      token: j.access_token,
      expires: Date.now() + ((j.expires_in ?? 3600) - 60) * 1000,
    };
    return j.access_token;
  }

  // ---------------------------------------------------------------- OS Keychain Persistence

  private seal(v: string) {
    return safeStorage.isEncryptionAvailable()
      ? `enc:${safeStorage.encryptString(v).toString('base64')}`
      : `raw:${Buffer.from(v).toString('base64')}`;
  }

  private unseal(v: string) {
    if (v.startsWith('enc:')) return safeStorage.decryptString(Buffer.from(v.slice(4), 'base64'));
    return Buffer.from(v.slice(4), 'base64').toString();
  }

  private persist() {
    try {
      fs.writeFileSync(storeFile(), JSON.stringify(this.s, null, 2));
    } catch {
      /* best effort */
    }
  }
}

function getDeviceName() {
  const kind = process.platform === 'win32' ? 'Windows' : process.platform === 'darwin' ? 'Mac' : 'Linux';
  return `${os.hostname()} (${kind})`;
}

function doneHtml(ok: boolean) {
  return `<!doctype html><meta charset="utf-8"><title>Drift Cloud Sync</title>
<body style="margin:0;height:100vh;display:grid;place-items:center;background:#141414;color:#e8e8e8;font:16px system-ui,sans-serif;text-align:center">
<div><div style="font-size:42px;font-weight:600;color:#8aa4ff">Drift Cloud Sync</div>
<p>${
    ok
      ? 'You’re signed in with Google. You can close this tab and return to Drift. · נכנסת לחשבון בהצלחה! אפשר לסגור את הכרטיסייה ולחזור ל-Drift.'
      : 'Sign-in didn’t finish. You can close this tab and try again in Drift. · הכניסה לא הושלמה. אפשר לסגור את הכרטיסייה ולנסות שוב ב-Drift.'
  }</p></div>
<script>if (${ok ? 'true' : 'false'}) { setTimeout(() => { try { window.close(); } catch {} }, 1200); }</script>
</body>`;
}

function firebaseLoopbackAuthHtml(cfg?: FirebaseClientConfig) {
  const safeCfg = JSON.stringify({
    apiKey: cfg?.apiKey || '',
    authDomain: cfg?.authDomain || (cfg?.projectId ? `${cfg.projectId}.firebaseapp.com` : ''),
    projectId: cfg?.projectId || '',
  });
  return `<!doctype html>
<html dir="rtl" lang="he">
<head>
  <meta charset="utf-8">
  <title>Drift – כניסה עם Google (Firebase Cloud Sync)</title>
  <style>
    body { margin:0; min-height:100vh; display:grid; place-items:center; background:#141414; color:#e8e8e8; font:15px system-ui,sans-serif; text-align:center; padding:20px; box-sizing:border-box; }
    .card { padding:32px; border-radius:16px; background:#1f2128; box-shadow:0 20px 60px rgba(0,0,0,0.5); max-width:480px; width:100%; }
    h1 { margin:0 0 10px; color:#8aa4ff; font-size:24px; }
    p { color:#b0b4c0; line-height:1.5; margin-bottom:18px; font-size:14px; }
    input, textarea { width:100%; box-sizing:border-box; padding:10px 12px; margin-bottom:10px; border-radius:10px; border:1px solid #343846; background:#15171c; color:#e8e8e8; font:13px monospace; direction:ltr; text-align:left; }
    button { padding:11px 24px; border-radius:20px; border:0; background:#8aa4ff; color:#111; font-weight:600; font-size:15px; cursor:pointer; width:100%; margin-top:6px; }
    button:hover { opacity:0.92; }
    .err { color:#ff8a80; margin-top:14px; font-size:13px; direction:ltr; }
    .setup { text-align:right; margin-bottom:14px; }
    .setup label { display:block; font-size:12px; color:#9aa0b0; margin-bottom:6px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Drift Cloud Sync</h1>
    <p>התחברות מאובטחת עם חשבון Google בדפדפן המערכת (כולל תמיכה מלאה ב-Passkeys, Windows Hello ומפתחות אבטחה פיזיים FIDO2).</p>
    <div id="setupBox" class="setup" style="display:none">
      <label>הדביקו כאן את ה-firebaseConfig של הפרויקט שלכם (או apiKey ו-projectId):</label>
      <textarea id="snippet" rows="3" placeholder="Paste firebaseConfig snippet or JSON (apiKey + projectId)..."></textarea>
      <input id="apiKey" placeholder="Firebase apiKey (AIzaSy...)" />
      <input id="projectId" placeholder="Firebase projectId (e.g. drift-sync)" />
    </div>
    <button id="btn">כניסה עם Google · Continue with Google</button>
    <div id="err" class="err"></div>
  </div>
  <script type="module">
    import { initializeApp, getApps, deleteApp } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js';
    import { getAuth, GoogleAuthProvider, signInWithPopup } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js';
    const initial = ${safeCfg};
    const setupBox = document.getElementById('setupBox');
    const apiKeyInput = document.getElementById('apiKey');
    const projectIdInput = document.getElementById('projectId');
    const snippetInput = document.getElementById('snippet');

    apiKeyInput.value = initial.apiKey || '';
    projectIdInput.value = initial.projectId || '';
    if (!initial.apiKey || !initial.projectId) {
      setupBox.style.display = 'block';
    }

    snippetInput.addEventListener('input', () => {
      const raw = snippetInput.value;
      const k = raw.match(/apiKey\\s*[:=]\\s*["']([^"']+)["']/)?.[1];
      const p = raw.match(/projectId\\s*[:=]\\s*["']([^"']+)["']/)?.[1];
      if (k) apiKeyInput.value = k;
      if (p) projectIdInput.value = p;
    });

    async function run() {
      document.getElementById('err').textContent = '';
      const apiKey = apiKeyInput.value.trim();
      const projectId = projectIdInput.value.trim();
      if (!apiKey || !projectId) {
        setupBox.style.display = 'block';
        document.getElementById('err').textContent = 'Please enter your Firebase apiKey and projectId first.';
        return;
      }
      const authDomain = initial.authDomain || (projectId + '.firebaseapp.com');
      try {
        for (const existing of getApps()) await deleteApp(existing);
        const app = initializeApp({ apiKey, authDomain, projectId });
        const auth = getAuth(app);
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        const cred = GoogleAuthProvider.credentialFromResult(result);
        const params = new URLSearchParams();
        if (cred?.idToken) params.set('idToken', cred.idToken);
        if (cred?.accessToken) params.set('accessToken', cred.accessToken);
        params.set('apiKey', apiKey);
        params.set('projectId', projectId);
        params.set('authDomain', authDomain);
        location.href = '/callback?' + params.toString();
      } catch (e) {
        setupBox.style.display = 'block';
        document.getElementById('err').textContent = e?.message || String(e);
      }
    }
    document.getElementById('btn').addEventListener('click', run);
    if (initial.apiKey && initial.projectId) run();
  </script>
</body>
</html>`;
}
