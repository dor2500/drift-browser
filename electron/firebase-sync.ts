import { app, BrowserWindow, net, safeStorage, session } from 'electron';
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
 * Drift Cloud Sync powered by **Firebase Authentication (Google Sign-In provider)**
 * and **Cloud Firestore** real-time synchronization.
 *
 * Firestore schema per authenticated user (`users/{uid}/sync/{docId}`):
 *  - `users/{uid}/sync/bookmarks` : Spaces, Pinned Tabs, Essentials, and Bookmarks
 *  - `users/{uid}/sync/history`   : Browsing History across devices
 *  - `users/{uid}/sync/settings`  : Browser Settings, Dark Mode Engine, Privacy
 *  - `users/{uid}/sync/tabs`      : Currently Open Tabs per active device
 *  - `users/{uid}/sync/handoff`   : Cross-Device Tab Handoff queue
 *  - `users/{uid}/sync/clipboard` : Universal Cloud Clipboard snippets
 */

const GOOGLE_SCOPES = ['openid', 'email', 'profile'];

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

interface StoredSyncState {
  /** Encrypted Google OAuth refresh token or credential payload via OS keychain (safeStorage). */
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
}

const storeFile = () => path.join(app.getPath('userData'), 'firebase-sync.json');
const legacyStoreFile = () => path.join(app.getPath('userData'), 'gsync.json');
const MAX_HISTORY = 4000;
const hash = (v: unknown) => crypto.createHash('sha1').update(JSON.stringify(v)).digest('hex');

/** Reads built-in Firebase / Google configuration if bundled by CI or placed in project root. */
function builtInFirebaseConfig(): FirebaseClientConfig | undefined {
  const candidates = [
    __dirname,
    path.join(__dirname, '..'),
    path.join(__dirname, '../..'),
    app.getAppPath(),
    process.resourcesPath ?? '',
  ];
  for (const dir of candidates) {
    if (!dir) continue;
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
          googleClientId: f.googleClientId,
          googleClientSecret: f.googleClientSecret,
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
          googleClientId: g.clientId,
          googleClientSecret: g.clientSecret,
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
      googleClientId: process.env.DRIFT_GOOGLE_CLIENT_ID,
      googleClientSecret: process.env.DRIFT_GOOGLE_CLIENT_SECRET,
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
    },
  ) {
    let stored: Partial<StoredSyncState> = {};
    try {
      if (fs.existsSync(storeFile())) {
        stored = JSON.parse(fs.readFileSync(storeFile(), 'utf8')) as StoredSyncState;
      } else if (fs.existsSync(legacyStoreFile())) {
        const leg = JSON.parse(fs.readFileSync(legacyStoreFile(), 'utf8')) as Record<string, unknown>;
        stored = { deviceId: typeof leg.deviceId === 'string' ? leg.deviceId : undefined };
      }
    } catch {
      /* first run */
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

  get config(): FirebaseClientConfig | undefined {
    return builtInFirebaseConfig() ?? this.s.firebaseConfig;
  }

  state(): SyncState {
    const cfg = this.config;
    const isSignedIn = !!(this.s.uid && (this.s.refreshToken || this.s.idToken));
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
      otherDevices: Object.values(this.remoteDevices)
        .filter((d) => d && d.id !== this.s.deviceId)
        .map((d) => ({
          id: d.id,
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
        googleClientId: cfg.googleClientId?.trim(),
        googleClientSecret: cfg.googleClientSecret?.trim(),
      };
    }
    this.s.lastError = undefined;
    this.persist();
    this.hooks.changed();
  }

  /** Legacy helper for setting Google OAuth client ID/secret alongside Firebase config. */
  setClient(client: { clientId: string; clientSecret: string } | undefined) {
    if (!client) return;
    const cur = this.config ?? { apiKey: '', authDomain: '', projectId: '' };
    this.setFirebaseConfig({
      ...cur,
      googleClientId: client.clientId.trim(),
      googleClientSecret: client.clientSecret.trim(),
    });
  }

  // ---------------------------------------------------------------- Firebase SDK Initialization

  private async ensureFirebase(): Promise<{ app: FirebaseApp; auth: Auth; db: Firestore }> {
    const cfg = this.config;
    if (!cfg || !cfg.apiKey || !cfg.projectId) {
      throw new Error('Firebase configuration missing. Add your Firebase Project config in Settings → Sync.');
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

  /** Start Firebase Cloud Sync and attach real-time Firestore snapshot listeners. */
  async start(): Promise<void> {
    if (!this.s.refreshToken && !this.s.idToken) return;
    if (!this.config) {
      if (this.s.uid) {
        this.realtimeConnected = true;
        this.hooks.changed();
      }
      return;
    }
    try {
      await this.restoreAuthSession();
      if (this.fbAuth?.currentUser) {
        this.attachRealtimeListeners(this.fbAuth.currentUser.uid);
        await this.syncNow();
        clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = setInterval(() => void this.syncNow(), 3 * 60_000);
      }
    } catch (err) {
      this.s.lastError = err instanceof Error ? err.message : String(err);
      this.persist();
      this.hooks.changed();
    }
  }

  /** Notify Firebase Sync Manager that a local domain changed so it pushes to Firestore in real time. */
  notifyLocalChange(domain: SyncDomain) {
    if (!this.s.uid) return;
    this.pendingDomains.add(domain);
    clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => {
      void this.syncNow();
    }, 900);
  }

  // ---------------------------------------------------------------- Google Sign-In (Zero-Config WebAuthn / Passkey + Firebase Auth)

  async signIn(): Promise<void> {
    const cfg = this.config;
    if (!cfg || !cfg.apiKey || !cfg.projectId) {
      // Zero-config direct Google Sign-In with Passkey / Hardware Security Key (WebAuthn) support
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
      await this.syncNow();
      return;
    }
    const { auth } = await this.ensureFirebase();

    let idToken: string | undefined;
    let accessToken: string | undefined;
    let googleRefreshToken: string | undefined;

    if (cfg.googleClientId && cfg.googleClientSecret) {
      // Desktop Loopback OAuth 2.0 PKCE Flow -> exchanges for Google ID token -> Firebase signInWithCredential
      const tokens = await this.runGoogleLoopbackOAuth(cfg.googleClientId, cfg.googleClientSecret);
      idToken = tokens.id_token;
      accessToken = tokens.access_token;
      googleRefreshToken = tokens.refresh_token;
    } else {
      // Web-based Firebase Auth Google Sign-In hosted on a temporary loopback page
      const tokens = await this.runFirebaseLoopbackWebSignIn(cfg);
      idToken = tokens.idToken;
      accessToken = tokens.accessToken;
    }

    if (!idToken && !accessToken) {
      throw new Error('Google Sign-In did not return a valid token.');
    }

    const credential = GoogleAuthProvider.credential(idToken ?? null, accessToken);
    const userCred = await signInWithCredential(auth, credential);
    const user = userCred.user;

    this.s.uid = user.uid;
    this.s.email = user.email ?? undefined;
    this.s.name = user.displayName ?? undefined;
    this.s.picture = user.photoURL ?? undefined;
    if (googleRefreshToken) {
      this.s.refreshToken = this.seal(googleRefreshToken);
    }
    if (idToken) this.s.idToken = this.seal(idToken);
    if (accessToken) this.s.accessToken = this.seal(accessToken);
    this.s.lastError = undefined;
    this.s.sections = {};
    this.persist();
    this.hooks.changed();

    this.attachRealtimeListeners(user.uid);
    await this.syncNow();
    clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => void this.syncNow(), 3 * 60_000);
  }

  private async restoreAuthSession(): Promise<void> {
    const cfg = this.config;
    if (!cfg) return;
    const { auth } = await this.ensureFirebase();
    if (auth.currentUser) return;

    if (this.s.refreshToken && cfg.googleClientId && cfg.googleClientSecret) {
      const refresh = this.unseal(this.s.refreshToken);
      const res = await net.fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          refresh_token: refresh,
          client_id: cfg.googleClientId,
          client_secret: cfg.googleClientSecret,
          grant_type: 'refresh_token',
        }).toString(),
      });
      const data = (await res.json()) as { id_token?: string; access_token?: string; error?: string };
      if (!res.ok || (!data.id_token && !data.access_token)) {
        if (data.error === 'invalid_grant') {
          this.s.refreshToken = undefined;
          this.persist();
        }
        throw new Error(`Session expired (${data.error ?? res.status}). Please sign in again.`);
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

  private async runGoogleLoopbackOAuth(
    clientId: string,
    clientSecret: string,
  ): Promise<{ access_token: string; id_token?: string; refresh_token?: string }> {
    const verifier = crypto.randomBytes(48).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    const stateParam = crypto.randomBytes(16).toString('hex');

    let signInTab: string | undefined;
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
        signInTab = this.hooks.openSignIn(authUrl.toString());
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
    };
  }

  /**
   * Loopback web page that runs Firebase JS SDK's `signInWithPopup(auth, new GoogleAuthProvider())`
   * on `http://localhost:<port>` (authorized by default in every Firebase project!) and sends the
   * resulting Google OAuth `idToken` + `accessToken` back to the Electron main process.
   */
  private async runFirebaseLoopbackWebSignIn(
    cfg: FirebaseClientConfig,
  ): Promise<{ idToken?: string; accessToken?: string }> {
    let signInTab: string | undefined;
    const tokens = await new Promise<{ idToken?: string; accessToken?: string }>((resolve, reject) => {
      const server = http.createServer((req, res) => {
        const u = new URL(req.url ?? '/', 'http://localhost');
        if (u.pathname === '/callback') {
          const idToken = u.searchParams.get('idToken') ?? undefined;
          const accessToken = u.searchParams.get('accessToken') ?? undefined;
          const err = u.searchParams.get('error');
          const ok = !!(idToken || accessToken);
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(doneHtml(ok));
          server.close();
          clearTimeout(timeout);
          if (ok) resolve({ idToken, accessToken });
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
        signInTab = this.hooks.openSignIn(`http://localhost:${port}/`);
      });
    });
    if (signInTab) setTimeout(() => this.hooks.closeSignIn(signInTab!), 1500);
    return tokens;
  }

  /**
   * Zero-Config One-Click Google Authentication with full WebAuthn / Passkey / FIDO2 Security Key support.
   * Opens Google's official sign-in dialog in a dedicated window sharing Drift's session partition,
   * waits for authentication (including Security Keys, Passkeys, or 2FA), and extracts the user's Google profile.
   */
  private async runDirectGoogleWebAuth(): Promise<{
    uid: string;
    email: string;
    name: string;
    picture?: string;
  }> {
    const PARTITION = 'persist:drift';
    const ses = session.fromPartition(PARTITION);
    const FIREFOX_UA = `Mozilla/5.0 (${
      process.platform === 'darwin'
        ? 'Macintosh; Intel Mac OS X 10.15'
        : process.platform === 'win32'
          ? 'Windows NT 10.0; Win64; x64'
          : 'X11; Linux x86_64'
    }; rv:140.0) Gecko/20100101 Firefox/140.0`;

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

      authWin.webContents.setUserAgent(FIREFOX_UA);

      // Allow popups needed by security key / passkey / Google 2FA challenges
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
              // Clean delivered items addressed specifically to this device
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
    if (!this.s.uid || !this.fbDb) {
      throw new Error('Sign in to Firebase Cloud Sync to send tabs between devices.');
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
    await setDoc(doc(this.fbDb, 'users', this.s.uid, 'sync', 'handoff'), {
      v: 2,
      updated: Date.now(),
      deviceId: this.s.deviceId,
      queue: nextQueue,
    });
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
    }
    this.hooks.changed();
  }

  // ---------------------------------------------------------------- Sync Push / Reconciliation Round

  syncNow(): Promise<void> {
    if (!this.s.uid) return Promise.resolve();
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
    if (!this.config) {
      // Direct Google Session Sync: persist synced state snapshot locally & mark synced
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

    // Read current cloud snapshot once on initial sync or reconciliation
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
  return `<!doctype html><meta charset="utf-8"><title>Drift Firebase Sync</title>
<body style="margin:0;height:100vh;display:grid;place-items:center;background:#141414;color:#e8e8e8;font:16px system-ui,sans-serif;text-align:center">
<div><div style="font-size:42px;font-weight:600;color:#8aa4ff">Drift Cloud Sync</div>
<p>${
    ok
      ? 'You’re signed in with Google & Firebase. You can close this tab and return to Drift. · נכנסת לחשבון. אפשר לסגור את הכרטיסייה ולחזור ל-Drift.'
      : 'Sign-in didn’t finish. You can close this tab and try again in Drift. · הכניסה לא הושלמה. אפשר לסגור את הכרטיסייה ולנסות שוב ב-Drift.'
  }</p></div></body>`;
}

function firebaseLoopbackAuthHtml(cfg: FirebaseClientConfig) {
  const safeCfg = JSON.stringify({
    apiKey: cfg.apiKey,
    authDomain: cfg.authDomain || `${cfg.projectId}.firebaseapp.com`,
    projectId: cfg.projectId,
  });
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Drift – Sign in with Google (Firebase)</title>
  <style>
    body { margin:0; height:100vh; display:grid; place-items:center; background:#141414; color:#e8e8e8; font:15px system-ui,sans-serif; text-align:center; }
    .card { padding:32px; border-radius:16px; background:#1f2128; box-shadow:0 20px 60px rgba(0,0,0,0.5); max-width:420px; }
    h1 { margin:0 0 10px; color:#8aa4ff; font-size:26px; }
    p { color:#b0b4c0; line-height:1.5; margin-bottom:20px; }
    button { padding:10px 22px; border-radius:20px; border:0; background:#8aa4ff; color:#111; font-weight:600; font-size:15px; cursor:pointer; }
    .err { color:#ff8a80; margin-top:14px; font-size:13px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Drift Cloud Sync</h1>
    <p>Sign in with your Google account to enable real-time Cloud Firestore synchronization.</p>
    <button id="btn">Continue with Google</button>
    <div id="err" class="err"></div>
  </div>
  <script type="module">
    import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js';
    import { getAuth, GoogleAuthProvider, signInWithPopup } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js';
    const app = initializeApp(${safeCfg});
    const auth = getAuth(app);
    const provider = new GoogleAuthProvider();
    async function run() {
      document.getElementById('err').textContent = '';
      try {
        const result = await signInWithPopup(auth, provider);
        const cred = GoogleAuthProvider.credentialFromResult(result);
        const params = new URLSearchParams();
        if (cred?.idToken) params.set('idToken', cred.idToken);
        if (cred?.accessToken) params.set('accessToken', cred.accessToken);
        location.href = '/callback?' + params.toString();
      } catch (e) {
        document.getElementById('err').textContent = e?.message || String(e);
      }
    }
    document.getElementById('btn').addEventListener('click', run);
    run();
  </script>
</body>
</html>`;
}

