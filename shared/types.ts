// Types shared by the Electron main process, the preload bridge and the React shell.
import type { LanguageInfo, LocaleBundle } from './i18n';
import type { DarkModeSettings, Settings, SettingsPatch } from './settings';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TabState {
  id: string;
  url: string;
  title: string;
  favicon?: string;
  /** Owning space. Essentials ignore it and show in every space. */
  spaceId: string;
  pinned: boolean;
  essential: boolean;
  loading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  audible: boolean;
  muted: boolean;
  /** Set while the tab is a Glance preview floating over this parent tab. */
  glanceOf?: string;
  /** Ads and trackers blocked on the current page. */
  blocked?: number;
  /** Page zoom in percent when not 100. */
  zoom?: number;
  /** Unloaded to save memory (sleeping or not opened yet); loads when shown. */
  asleep?: boolean;
}

export interface SpaceState {
  id: string;
  name: string;
  icon: string;
  /** Accent colour; drives the window gradient and the selected-tab tint. */
  accent: string;
  activeTabId?: string;
}

export interface SplitState {
  tabIds: [string, string];
  /** Share of the width given to the first pane (0.15 – 0.85). */
  ratio: number;
}

export interface GlanceState {
  /** The preview tab (a real tab with glanceOf set). */
  id: string;
  parentId: string;
  /** Where the link was clicked, in shell window coordinates; the card grows from here. */
  origin?: { x: number; y: number };
}

/** A site is waiting for an answer to a permission request. */
export interface PermissionPrompt {
  id: string;
  tabId: string;
  origin: string;
  /** Kinds being asked for, e.g. ['camera', 'microphone']; see shared/permissions.ts. */
  kinds: string[];
}

export type AppUpdateState = 'idle' | 'checking' | 'none' | 'available' | 'downloading' | 'ready' | 'error' | 'disabled' | 'dev';

export interface UpdateStatus {
  app: { state: AppUpdateState; version?: string; progress?: number; message?: string; checkedAt?: number };
  /**
   * Chromium engine versions: what Drift runs, what the newest Electron ships,
   * and Google Chrome's current stable release.
   */
  engine: {
    current: string;
    latestElectron?: string;
    latestElectronChrome?: string;
    chromeStable?: string;
    /** The newest Electron carries a newer Chromium major than Drift's. */
    newer?: boolean;
    checking?: boolean;
    checkedAt?: number;
    error?: string;
  };
}

export interface DriftEnv {
  /** Which browsers are installed on this PC (for the theme picker). */
  browsers: { zen: boolean; firefox: boolean; brave: boolean; chrome: boolean; edge: boolean; opera: boolean; tor: boolean };
  packaged: boolean;
  versions: { app: string; electron: string; chrome: string; node: string };
}

export type SitePermissions = Record<string, Record<string, 'allow' | 'block'>>;

/** The tab whose audio/video the media controls act on. */
export interface MediaState {
  tabId: string;
  playing: boolean;
}

export interface DownloadInfo {
  id: string;
  filename: string;
  path: string;
  url: string;
  received: number;
  total: number;
  state: 'progressing' | 'completed' | 'cancelled' | 'interrupted';
  paused?: boolean;
  startedAt: number;
}

export interface FindState {
  tabId: string;
  active: number;
  matches: number;
}

export type ImportBrowser = 'zen' | 'firefox' | 'chrome' | 'brave' | 'edge';

export interface ImportSource {
  id: ImportBrowser;
  name: string;
  /** Zen sessions also carry spaces, pinned tabs and Essentials. */
  hasSpaces: boolean;
}

export interface ImportOptions {
  /** Chrome/Brave/Edge/Firefox: bookmarks-bar items become pinned tabs in a new space (like Arc). */
  bookmarksAsPinned: boolean;
  /** Zen: bring its spaces, pinned tabs, Essentials and open tabs. */
  zenSpaces: boolean;
}

export interface ImportResult {
  source: ImportBrowser;
  bookmarks: number;
  history: number;
  spaces: number;
  pinned: number;
  essentials: number;
  tabs: number;
  error?: string;
}

export interface Suggestion {
  url: string;
  title: string;
  kind: 'bookmark' | 'history';
  source?: string;
}

/** Firebase Web & OAuth Client Configuration for Cloud Firestore Sync. */
export interface FirebaseClientConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  /** Optional Google OAuth Desktop Client ID for loopback PKCE sign-in. */
  googleClientId?: string;
  /** Optional Google OAuth Desktop Client Secret. */
  googleClientSecret?: string;
}

/** A tab sent from one device to another via Cross-Device Tab Handoff. */
export interface HandoffItem {
  id: string;
  url: string;
  title: string;
  fromDeviceId: string;
  fromDeviceName: string;
  toDeviceId: string;
  createdAt: number;
}

/** A synced device's open tabs in Firestore. */
export interface SyncedDeviceInfo {
  id: string;
  name: string;
  platform: string;
  updated: number;
  tabs: { url: string; title: string; favicon?: string }[];
}

/** Universal Cloud Clipboard entry synced across signed-in devices. */
export interface ClipboardItemEntry {
  id: string;
  text: string;
  deviceId: string;
  deviceName: string;
  createdAt: number;
  pinned?: boolean;
}

/** Local AI Assistant (Ollama) conversation message. */
export interface AiMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  action?: 'chat' | 'summarize' | 'translate' | 'explain';
}

/** Local AI Assistant (Ollama) state. */
export interface AiState {
  open: boolean;
  status: 'idle' | 'connecting' | 'streaming' | 'error';
  ollamaOnline: boolean;
  availableModels: string[];
  selectedModel: string;
  messages: AiMessage[];
  error?: string;
}

/** Drift Cloud Sync state powered by Firebase Authentication & Cloud Firestore. */
export interface SyncState {
  provider: 'firebase';
  /** A Firebase & Google connection config is available (built in or entered in Settings). */
  configured: boolean;
  builtInKey: boolean;
  signedIn: boolean;
  uid?: string;
  email?: string;
  name?: string;
  picture?: string;
  deviceId: string;
  deviceName: string;
  lastSync?: number;
  realtimeConnected: boolean;
  error?: string;
  syncing: boolean;
  what: {
    bookmarks: boolean;
    tabs: boolean;
    history: boolean;
    settings: boolean;
    clipboard: boolean;
  };
  firebaseConfig?: FirebaseClientConfig;
  otherDevices: SyncedDeviceInfo[];
  handoffQueue: HandoffItem[];
}

export type SyncWhat = SyncState['what'];

export interface BrowserState {
  tabs: TabState[];
  spaces: SpaceState[];
  activeSpaceId: string;
  activeTabId?: string;
  split?: SplitState;
  glance?: GlanceState;
  prompts: PermissionPrompt[];
  media?: MediaState;
  downloads: DownloadInfo[];
  find?: FindState;
  settings: Settings;
  updates: UpdateStatus;
  compact: boolean;
  sidebarWidth: number;
  sync: SyncState;
  clipboard: ClipboardItemEntry[];
  ai: AiState;
}

/** A placeholder rectangle in the shell where a tab's native web view goes. */
export interface Pane {
  tabId: string;
  rect: Rect;
}

export interface Snapshot {
  tabId: string;
  dataUrl: string;
}

export type DropZone = 'essentials' | 'pinned' | 'tabs';
export type DropPosition = 'before' | 'after';

export type Command =
  | { type: 'tab:new'; url?: string; spaceId?: string; background?: boolean; afterId?: string }
  | { type: 'tab:activate'; id: string }
  | { type: 'tab:close'; id?: string }
  | { type: 'tab:navigate'; input: string; id?: string }
  | { type: 'tab:back' | 'tab:forward' | 'tab:reload'; id?: string }
  | { type: 'tab:move'; id: string; zone: DropZone; targetId?: string; position?: DropPosition }
  | { type: 'tab:set'; id: string; pinned?: boolean; essential?: boolean; spaceId?: string; muted?: boolean }
  | { type: 'tab:reopen' }
  | { type: 'tab:cycle'; dir: 1 | -1 }
  | { type: 'split:create'; ids: [string, string] }
  | { type: 'split:ratio'; ratio: number }
  | { type: 'split:close' }
  | { type: 'glance:close' | 'glance:expand' | 'glance:split' }
  | { type: 'permission:respond'; id: string; allow: boolean; remember: boolean }
  | { type: 'permission:reset'; origin: string; kind?: string }
  | { type: 'settings:set'; patch: SettingsPatch }
  | { type: 'settings:open' }
  | { type: 'settings:reset' }
  | { type: 'store:open' }
  | { type: 'privacy:newIdentity' }
  | {
      type: 'privacy:clearData';
      range: '1h' | '24h' | '7d' | '4w' | 'all';
      history: boolean;
      cookies: boolean;
      cache: boolean;
    }
  | { type: 'downloads:chooseFolder' }
  | { type: 'win:incognito'; url?: string }
  | { type: 'win:taskManager' }
  | { type: 'bookmark:toggle'; url?: string; title?: string }
  | { type: 'page:readingMode' }
  | { type: 'page:qr'; url?: string }
  | { type: 'tab:duplicate'; id: string }
  | { type: 'tab:muteOthers'; id: string }
  | { type: 'tab:closeRight'; id: string }
  | { type: 'tab:closeOthers'; id: string }
  | { type: 'sync:signin' }
  | { type: 'sync:signout' }
  | { type: 'sync:now' }
  | { type: 'sync:what'; what: Partial<SyncState['what']> }
  | { type: 'sync:key'; clientId: string; clientSecret: string }
  | { type: 'sync:firebase-config'; config: FirebaseClientConfig }
  | { type: 'handoff:send'; url: string; title: string; targetDeviceId: string }
  | { type: 'handoff:dismiss'; id: string }
  | { type: 'clipboard:push'; text?: string }
  | { type: 'clipboard:copy'; id: string }
  | { type: 'clipboard:pin'; id: string; pinned: boolean }
  | { type: 'clipboard:delete'; id: string }
  | { type: 'clipboard:clear' }
  | { type: 'darkmode:toggle-site'; host: string }
  | { type: 'darkmode:update'; patch: Partial<DarkModeSettings> }
  | { type: 'ai:toggle'; open?: boolean }
  | { type: 'ai:prompt'; prompt: string; action?: 'chat' | 'summarize' | 'translate' | 'explain'; includePage?: boolean }
  | { type: 'ai:clear' }
  | { type: 'ai:stop' }
  | { type: 'ai:refresh-models' }
  | { type: 'updates:check' }
  | { type: 'adblock:site'; host: string; paused: boolean }
  | { type: 'media:control'; id: string; action: 'toggle' | 'next' | 'prev' }
  | { type: 'find:query'; text: string; forward?: boolean; next?: boolean }
  | { type: 'find:stop' }
  | { type: 'zoom'; dir: 1 | -1 | 0 }
  | { type: 'download:open' | 'download:show' | 'download:cancel'; id: string }
  | { type: 'downloads:clear' }
  | { type: 'page:print' | 'page:source' | 'page:screenshot' | 'page:translate' | 'page:pip' }
  | { type: 'split:toggle' }
  | { type: 'app:restart' }
  | { type: 'engine:switch'; engine: 'chromium' | 'gecko' }
  | { type: 'google:signin' }
  | { type: 'openin:remove'; host: string }
  | { type: 'updates:install' }
  | { type: 'space:new' }
  | { type: 'space:activate'; id: string }
  | { type: 'space:cycle'; dir: 1 | -1 }
  | { type: 'space:set'; id: string; name?: string; icon?: string; accent?: string }
  | { type: 'space:delete'; id: string }
  | { type: 'space:clear'; id: string }
  | { type: 'ui:compact'; value?: boolean }
  | { type: 'ui:sidebarWidth'; width: number }
  | { type: 'win:minimize' | 'win:maximize' | 'win:close' };

/** Events the main process pushes to the shell (mostly keyboard shortcuts). */
export type UiEvent =
  | { type: 'commandbar'; mode: 'new' | 'current' }
  | { type: 'space:rename'; id: string }
  | { type: 'glance:backdrop'; snapshots: Snapshot[] }
  | { type: 'find' }
  | { type: 'handoff:received'; item: HandoffItem };

export interface DriftApi {
  /** process.platform: 'win32' | 'darwin' | 'linux'. */
  platform: string;
  getState(): Promise<BrowserState>;
  cmd(c: Command): Promise<void>;
  layout(panes: Pane[]): void;
  overlay(open: boolean): Promise<Snapshot[]>;
  tabMenu(id: string): void;
  spaceMenu(id: string): void;
  siteMenu(): void;
  appMenu(): void;
  spacesMenu(): void;
  env(): Promise<DriftEnv>;
  sitePermissions(): Promise<SitePermissions>;
  shieldMenu(): void;
  downloadsMenu(): void;
  googleStatus(): Promise<boolean>;
  topSites(): Promise<{ url: string; title: string }[]>;
  stats(): Promise<{ blocked: number; since: number }>;
  geckoStatus(): Promise<{ available: boolean; kind?: 'installed' | 'downloaded' }>;
  downloadGecko(): Promise<{ available: boolean; kind?: 'installed' | 'downloaded'; error?: string }>;
  otherBrowsers(): Promise<{ id: string; name: string }[]>;
  locale(): Promise<LocaleBundle>;
  languages(): Promise<{ languages: LanguageInfo[]; offline: boolean }>;
  installLanguage(code: string): Promise<boolean>;
  suggest(query: string): Promise<Suggestion[]>;
  importSources(): Promise<ImportSource[]>;
  runImport(source: ImportBrowser, options: ImportOptions): Promise<ImportResult>;
  onState(cb: (s: BrowserState) => void): () => void;
  onUi(cb: (e: UiEvent) => void): () => void;
}

export const SIDEBAR_MIN = 220;
export const SIDEBAR_MAX = 420;
export const ESSENTIALS_MAX = 12;
