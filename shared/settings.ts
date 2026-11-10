export type ThemeId = 'zen' | 'firefox' | 'brave' | 'chrome' | 'edge' | 'opera' | 'tor';
export type SearchEngineId = 'google' | 'duckduckgo' | 'bing' | 'brave' | 'startpage' | 'yahoo' | 'ecosia';
export type UpdateSource = 'github' | 'custom' | 'off';
export type DarkEngineMode = 'smart' | 'filter' | 'chromium';
export type BookmarksBarMode = 'always' | 'newtab' | 'never';
export type FontSizePreset = 'xsmall' | 'small' | 'medium' | 'large' | 'xlarge';
export type StartupMode = 'newtab' | 'continue' | 'urls';
export type SafeBrowsingMode = 'enhanced' | 'standard' | 'off';
export type DnsOverHttpsMode = 'auto' | 'cloudflare' | 'google' | 'quad9' | 'adguard' | 'mullvad' | 'off';
export type PreloadPagesMode = 'standard' | 'extended' | 'off';

export type VpnMode = 'builtin' | 'custom' | 'pac';
export type VpnLocationId = 'ch-zurich' | 'de-frankfurt' | 'nl-amsterdam' | 'us-ny' | 'jp-tokyo' | 'sg-singapore' | 'gb-london';
export type VpnProtocol = 'socks5' | 'http' | 'https';

export interface VpnCustomServer {
  protocol: VpnProtocol;
  host: string;
  port: number;
  username: string;
  password: string;
}

export interface VpnSettings {
  /** Master toggle for Drift VPN & Secure Proxy */
  enabled: boolean;
  /** Connection mode: built-in Drift Secure Tunnel, custom private server, or PAC URL */
  mode: VpnMode;
  /** Preset location ID when mode === 'builtin' */
  builtinLocation: VpnLocationId;
  /** Custom / Private VPN connection details */
  customServer: VpnCustomServer;
  /** PAC script URL when mode === 'pac' */
  pacUrl: string;
  /** WebRTC IP leak protection: prevents LAN/WAN IP exposure via WebRTC STUN/TURN */
  webrtcProtect: boolean;
  /** Emergency kill switch: blocks outgoing requests if proxy drops */
  killSwitch: boolean;
  /** Bypass list / Split tunneling: hosts or IP patterns that bypass VPN */
  bypassList: string[];
}

export const DEFAULT_VPN_SETTINGS: VpnSettings = {
  enabled: false,
  mode: 'builtin',
  builtinLocation: 'ch-zurich',
  customServer: {
    protocol: 'socks5',
    host: '',
    port: 1080,
    username: '',
    password: '',
  },
  pacUrl: '',
  webrtcProtect: true,
  killSwitch: false,
  bypassList: ['localhost', '127.0.0.1', '*.local'],
};

export interface AutofillSettings {
  /** Offer to save passwords when logging into websites. */
  offerToSavePasswords: boolean;
  /** Automatically sign in to websites using stored credentials. */
  autoSignIn: boolean;
  /** Save and fill payment methods and credit cards. */
  saveAndFillPayments: boolean;
  /** Save and fill physical addresses, emails, and phone numbers. */
  saveAndFillAddresses: boolean;
}

export const DEFAULT_AUTOFILL_SETTINGS: AutofillSettings = {
  offerToSavePasswords: true,
  autoSignIn: true,
  saveAndFillPayments: true,
  saveAndFillAddresses: true,
};

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
  /** Chrome Safe Browsing protection level. */
  safeBrowsing: SafeBrowsingMode;
  /** Secure DNS (DNS-over-HTTPS) provider. */
  dnsOverHttps: DnsOverHttpsMode;
  /** Block unsolicited pop-ups and redirects. */
  blockPopups: boolean;
  /** Advanced anti-fingerprinting shield (Canvas, WebGL, AudioContext, Battery cloaking). */
  antiFingerprint: boolean;
}

export interface StoreCustomScript {
  id: string;
  name: string;
  match: string;
  code: string;
  enabled: boolean;
}

export interface StoreSettings {
  /** IDs of installed extensions/mods. */
  installed: string[];
  /** IDs of disabled extensions/mods. */
  disabled: string[];
  /** Active custom theme ID installed from Drift Store. */
  activeTheme?: string;
  /** Custom user scripts / mods. */
  customScripts: StoreCustomScript[];
  /** Anti-fingerprint shield active status. */
  antiFingerprint: boolean;
  /** Built-in Drift Zen Aura ambient sound generator. */
  ambientSound: {
    playing: boolean;
    sound: 'rain' | 'ocean' | 'drone' | 'whitenoise' | 'binaural';
    volume: number;
  };
  /** Fast persistent scratchpad notes. */
  scratchpadNotes: string;
}

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  installed: [
    'drift-shield-pro',
    'drift-zen-aura',
    'drift-reader-mode',
    'drift-scratchpad',
    'drift-security-auditor',
    'drift-video-booster',
  ],
  disabled: [],
  activeTheme: '',
  customScripts: [],
  antiFingerprint: true,
  ambientSound: { playing: false, sound: 'rain', volume: 0.5 },
  scratchpadNotes: '',
};

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
  /** Chrome Appearance: show the Home button in the toolbar. */
  showHomeButton: boolean;
  /** Chrome Appearance: when to show the horizontal Bookmarks Bar. */
  showBookmarksBar: BookmarksBarMode;
  /** Chrome Appearance: default page zoom percentage (e.g. 100). */
  defaultZoom: number;
  /** Chrome Appearance: default page font size preset. */
  fontSize: FontSizePreset;
  /** Chrome Appearance: show preview cards when hovering over tabs. */
  tabHoverCard: boolean;
  /** Swipe tabs left or right to close them. */
  swipeToCloseTabs: boolean;
  /** Chrome On Startup mode ('newtab' | 'continue' | 'urls'). */
  startupMode: StartupMode;
  /** Custom URLs opened on startup when startupMode === 'urls'. */
  startupUrls: string[];
  /** Chrome Performance: Memory Saver toggle. */
  memorySaver: boolean;
  /** Chrome Performance: Hosts that Memory Saver never puts to sleep. */
  neverSleepHosts: string[];
  /** Chrome Performance: Energy Saver toggle (limits background activity & frame rate). */
  energySaver: boolean;
  /** Chrome Performance: Preload pages mode. */
  preloadPages: PreloadPagesMode;
  /** Chrome Downloads: custom download directory path (empty = OS default Downloads folder). */
  downloadPath: string;
  /** Chrome Downloads: show downloads menu automatically when a download finishes. */
  showDownloadsWhenDone: boolean;
  /** Chrome Languages: enable spell check in text fields. */
  spellCheck: boolean;
  /** Chrome Languages: offer to translate pages in other languages. */
  offerTranslation: boolean;
  /** Chrome Accessibility: high contrast accessibility mode. */
  highContrast: boolean;
  /** Chrome System: continue running background apps when browser is closed. */
  backgroundApps: boolean;
  /** Chrome Accessibility: navigate pages with a text cursor (F7). */
  caretBrowsing: boolean;
  autofill: AutofillSettings;
  privacy: PrivacySettings;
  updates: UpdateSettings;
  store: StoreSettings;
  vpn: VpnSettings;
}

export type SettingsPatch = Partial<Omit<Settings, 'updates' | 'privacy' | 'darkMode' | 'ai' | 'clipboardSync' | 'store' | 'autofill' | 'vpn'>> & {
  updates?: Partial<UpdateSettings>;
  privacy?: Partial<PrivacySettings>;
  darkMode?: Partial<DarkModeSettings>;
  ai?: Partial<AiSettings>;
  clipboardSync?: Partial<ClipboardSyncSettings>;
  store?: Partial<StoreSettings>;
  autofill?: Partial<AutofillSettings>;
  vpn?: Partial<VpnSettings>;
};

export const SEARCH_ENGINES: Record<SearchEngineId, { name: string; url: string; home: string }> = {
  google: { name: 'Google', url: 'https://www.google.com/search?q=', home: 'https://www.google.com/' },
  duckduckgo: { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=', home: 'https://duckduckgo.com/' },
  bing: { name: 'Bing', url: 'https://www.bing.com/search?q=', home: 'https://www.bing.com/' },
  brave: { name: 'Brave Search', url: 'https://search.brave.com/search?q=', home: 'https://search.brave.com/' },
  startpage: { name: 'Startpage', url: 'https://www.startpage.com/do/search?q=', home: 'https://www.startpage.com/' },
  yahoo: { name: 'Yahoo', url: 'https://search.yahoo.com/search?p=', home: 'https://www.yahoo.com/' },
  ecosia: { name: 'Ecosia', url: 'https://www.ecosia.org/search?q=', home: 'https://www.ecosia.org/' },
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
  showHomeButton: true,
  showBookmarksBar: 'always',
  defaultZoom: 100,
  fontSize: 'medium',
  tabHoverCard: true,
  swipeToCloseTabs: true,
  startupMode: 'continue',
  startupUrls: ['https://www.google.com/'],
  memorySaver: true,
  neverSleepHosts: [],
  energySaver: false,
  preloadPages: 'standard',
  downloadPath: '',
  showDownloadsWhenDone: true,
  spellCheck: true,
  offerTranslation: true,
  highContrast: false,
  backgroundApps: false,
  caretBrowsing: false,
  autofill: { ...DEFAULT_AUTOFILL_SETTINGS },
  privacy: {
    httpsOnly: true,
    stripTracking: true,
    block3pCookies: true,
    gpc: true,
    webrtcProtect: true,
    engineCheck: true,
    chromeCompare: false,
    safeBrowsing: 'standard',
    dnsOverHttps: 'auto',
    blockPopups: true,
    antiFingerprint: true,
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
  store: { ...DEFAULT_STORE_SETTINGS },
  vpn: { ...DEFAULT_VPN_SETTINGS },
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
    store: { ...(base.store ?? DEFAULT_STORE_SETTINGS), ...(patch.store ?? {}) },
    autofill: { ...(base.autofill ?? DEFAULT_AUTOFILL_SETTINGS), ...(patch.autofill ?? {}) },
    vpn: {
      ...(base.vpn ?? DEFAULT_VPN_SETTINGS),
      ...(patch.vpn ?? {}),
      customServer: {
        ...(base.vpn?.customServer ?? DEFAULT_VPN_SETTINGS.customServer),
        ...(patch.vpn?.customServer ?? {}),
      },
      bypassList: patch.vpn?.bypassList ? [...patch.vpn.bypassList] : (base.vpn?.bypassList ?? DEFAULT_VPN_SETTINGS.bypassList),
    },
  };
  if (patch.theme && patch.theme !== base.theme && patch.verticalTabs === undefined) {
    if (patch.theme === 'chrome' || patch.theme === 'firefox' || patch.theme === 'brave') {
      next.verticalTabs = false;
      if (patch.spaceColors === undefined) next.spaceColors = false;
    } else if (patch.theme === 'zen') {
      next.verticalTabs = true;
      if (patch.spaceColors === undefined) next.spaceColors = true;
    }
  }
  if (patch.forceDark !== undefined && patch.darkMode?.enabled === undefined) {
    next.darkMode.enabled = patch.forceDark;
  }
  return next;
}
