export type ThemeId = 'zen' | 'firefox' | 'brave' | 'chrome' | 'edge' | 'opera' | 'tor';
export type SearchEngineId = 'google' | 'duckduckgo' | 'bing' | 'brave' | 'startpage';
export type UpdateSource = 'github' | 'custom' | 'off';
export type DarkEngineMode = 'smart' | 'filter' | 'chromium';

export interface UpdateSettings {
  /** Where Drift downloads new versions (each one also carries a newer Chromium). */
  source: UpdateSource;
  /** "owner/repo" whose GitHub Releases hold Drift builds. */
  githubRepo: string;
  /** Base https:// URL of a generic update server (latest.yml + installers). */
  customUrl: string;
  channel: 'stable' | 'beta';
  autoCheck: boolean;
  /** Show a badge when a newer Chromium engine is available upstream. */
  engineAlerts: boolean;
}

export interface PrivacySettings {
  /** Load sites over https when possible, falling back to http if it fails (HTTPS-First). */
  httpsOnly: boolean;
  /** Remove tracking parameters (utm_*, fbclid, gclid, …) from links you open. */
  stripTracking: boolean;
  /** Don't send or accept cookies on requests to other sites than the page's. */
  block3pCookies: boolean;
  /** Send Global Privacy Control and Do Not Track. */
  gpc: boolean;
  /** Keep WebRTC from revealing your local network address. */
  webrtcProtect: boolean;
  /** Compare Drift's Chromium with the newest Electron (contacts releases.electronjs.org). */
  engineCheck: boolean;
  /** Also compare with Google Chrome's stable version (contacts Google). Off by default. */
  chromeCompare: boolean;
}

export interface DarkModeSettings {
  /** Master toggle for the live Advanced Dark Mode Engine. */
  enabled: boolean;
  /** Rendering strategy: 'smart' (intelligent inversion preserving media), 'filter' (custom surface/filter), or 'chromium' (native flag). */
  mode: DarkEngineMode;
  /** Page brightness percentage (50–130). */
  brightness: number;
  /** Page contrast percentage (60–150). */
  contrast: number;
  /** Warmth / sepia percentage (0–100). */
  sepia: number;
  /** Grayscale percentage (0–100). */
  grayscale: number;
  /** Hosts where dark mode is explicitly disabled by the user. */
  disabledHosts: string[];
  /** Hosts where dark mode is forced on even when global enabled is false. */
  forcedHosts: string[];
}

export interface AiSettings {
  /** Base URL of the local Ollama server (never leaves the device). */
  endpoint: string;
  /** Preferred Ollama model name (empty = auto-select first installed model). */
  model: string;
  /** Default system prompt for the local AI assistant. */
  systemPrompt: string;
  /** Automatically attach readable text from the active tab as context. */
  includePageContext: boolean;
  /** Target language for one-click page translation. */
  targetLanguage: string;
}

export interface ClipboardSyncSettings {
  /** Sync copied text snippets across signed-in devices via Firestore. */
  enabled: boolean;
  /** Automatically write incoming cloud clipboard snippets to the local OS clipboard. */
  autoApplyToSystem: boolean;
}

export interface Settings {
  /** False until the first-run setup has been completed. */
  onboarded: boolean;
  /** Rendering engine: Chromium (built in) or Gecko (Firefox engine, run with a Drift-managed profile). */
  engine: 'chromium' | 'gecko';
  /** "auto" follows the system language; otherwise a language code such as "he". */
  language: string;
  theme: ThemeId;
  /** Tint the window with each space's colour (Zen), or keep the theme's own accent. */
  spaceColors: boolean;
  /** Tabs in a sidebar (Zen) or across the top (Chrome, Firefox, Brave). Picking a style sets its native layout. */
  verticalTabs: boolean;
  searchEngine: SearchEngineId;
  homePage: string;
  /** Reopen last session's regular tabs on startup (pinned tabs and Essentials always come back). */
  restoreSession: boolean;
  /** What a new tab shows: Drift's new-tab page (styled per browser) or the home page. */
  newTabPage: 'newtab' | 'home';
  /** Ask before closing a window with several tabs open. */
  confirmClose: boolean;
  /** Chromium smooth scrolling (applies after restart). */
  smoothScrolling: boolean;
  /** GPU rendering (applies after restart); turn off if pages flicker or go blank. */
  hardwareAcceleration: boolean;
  /** Built-in ad and tracker blocking (EasyList/uBlock-style filters + YouTube ad skipping). */
  adblock: boolean;
  /** Also hide cookie banners, newsletter pop-ups and other annoyances (Brave, Opera, Firefox). */
  hideAnnoyances: boolean;
  /** Clear cookies and site data when Drift closes (Chrome, Firefox, Brave). */
  clearOnExit: boolean;
  /** Ask where to save each download (Chrome, Edge, Firefox). */
  askDownloadLocation: boolean;
  /** Hosts where blocking is paused, e.g. "example.com". */
  adblockPaused: string[];
  /** Unload tabs idle this many minutes (0 = never), like Edge's sleeping tabs. */
  sleepAfter: number;
  /** Chromium's force-dark rendering for every website (applies after restart). */
  forceDark: boolean;
  /** Advanced Dark Mode Engine settings (applies live without restart). */
  darkMode: DarkModeSettings;
  /** Local AI Assistant (Ollama) settings. */
  ai: AiSettings;
  /** Universal Cloud Clipboard settings. */
  clipboardSync: ClipboardSyncSettings;
  /** Remembered zoom level per site host. */
  siteZoom: Record<string, number>;
  /** Colour theme on top of the browser style ("default" keeps the style's colours). */
  colorTheme: string;
  /** Optional accent override, e.g. "#4fb3ff" ("" = theme's accent). */
  customAccent: string;
  /** Sites that always open in another installed browser, e.g. { "bank.example": "firefox" }. */
  openInRules: Record<string, string>;
  privacy: PrivacySettings;
  updates: UpdateSettings;
}

export type SettingsPatch = Partial<Omit<Settings, 'updates' | 'privacy' | 'darkMode' | 'ai' | 'clipboardSync'>> & {
  updates?: Partial<UpdateSettings>;
  privacy?: Partial<PrivacySettings>;
  darkMode?: Partial<DarkModeSettings>;
  ai?: Partial<AiSettings>;
  clipboardSync?: Partial<ClipboardSyncSettings>;
};

export const SEARCH_ENGINES: Record<SearchEngineId, { name: string; url: string; home: string }> = {
  google: { name: 'Google', url: 'https://www.google.com/search?q=', home: 'https://www.google.com/' },
  duckduckgo: { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=', home: 'https://duckduckgo.com/' },
  bing: { name: 'Bing', url: 'https://www.bing.com/search?q=', home: 'https://www.bing.com/' },
  brave: { name: 'Brave Search', url: 'https://search.brave.com/search?q=', home: 'https://search.brave.com/' },
  startpage: { name: 'Startpage', url: 'https://www.startpage.com/do/search?q=', home: 'https://www.startpage.com/' },
};

export const DEFAULT_DARK_MODE: DarkModeSettings = {
  enabled: false,
  mode: 'smart',
  brightness: 100,
  contrast: 100,
  sepia: 0,
  grayscale: 0,
  disabledHosts: [],
  forcedHosts: [],
};

export const DEFAULT_AI_SETTINGS: AiSettings = {
  endpoint: 'http://localhost:11434',
  model: '',
  systemPrompt: 'You are Drift AI, a helpful, concise, privacy-first local browser assistant running on Ollama.',
  includePageContext: true,
  targetLanguage: 'English',
};

export const DEFAULT_CLIPBOARD_SYNC: ClipboardSyncSettings = {
  enabled: true,
  autoApplyToSystem: true,
};

export const DEFAULT_SETTINGS: Settings = {
  onboarded: false,
  engine: 'chromium',
  language: 'auto',
  theme: 'zen',
  spaceColors: true,
  verticalTabs: true,
  searchEngine: 'google',
  homePage: 'https://www.google.com/',
  restoreSession: true,
  newTabPage: 'newtab',
  confirmClose: false,
  smoothScrolling: true,
  hardwareAcceleration: true,
  adblock: true,
  hideAnnoyances: false,
  clearOnExit: false,
  askDownloadLocation: false,
  adblockPaused: [],
  sleepAfter: 30,
  forceDark: false,
  darkMode: DEFAULT_DARK_MODE,
  ai: DEFAULT_AI_SETTINGS,
  clipboardSync: DEFAULT_CLIPBOARD_SYNC,
  siteZoom: {},
  colorTheme: 'default',
  customAccent: '',
  openInRules: {},
  privacy: {
    httpsOnly: true,
    stripTracking: true,
    block3pCookies: true,
    gpc: true,
    webrtcProtect: true,
    engineCheck: true,
    chromeCompare: false,
  },
  updates: {
    source: 'github',
    // Official Drift releases; installed copies update from here.
    githubRepo: 'dor2500/drift-browser',
    customUrl: '',
    channel: 'stable',
    autoCheck: true,
    engineAlerts: true,
  },
};

export function mergeSettings(base: Settings, patch: SettingsPatch): Settings {
  const next: Settings = {
    ...base,
    ...patch,
    updates: { ...base.updates, ...(patch.updates ?? {}) },
    privacy: { ...base.privacy, ...(patch.privacy ?? {}) },
    darkMode: { ...(base.darkMode ?? DEFAULT_DARK_MODE), ...(patch.darkMode ?? {}) },
    ai: { ...(base.ai ?? DEFAULT_AI_SETTINGS), ...(patch.ai ?? {}) },
    clipboardSync: { ...(base.clipboardSync ?? DEFAULT_CLIPBOARD_SYNC), ...(patch.clipboardSync ?? {}) },
  };
  if (patch.forceDark !== undefined && patch.darkMode?.enabled === undefined) {
    next.darkMode.enabled = patch.forceDark;
  }
  return next;
}
