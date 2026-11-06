export type ThemeId = 'zen' | 'firefox' | 'brave' | 'chrome';
export type SearchEngineId = 'google' | 'duckduckgo' | 'bing' | 'brave' | 'startpage';
export type UpdateSource = 'github' | 'custom' | 'off';

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

export interface Settings {
  /** False until the first-run setup has been completed. */
  onboarded: boolean;
  theme: ThemeId;
  /** Tint the window with each space's colour (Zen), or keep the theme's own accent. */
  spaceColors: boolean;
  /** Tabs in a sidebar (Zen) or across the top (Chrome, Firefox, Brave). Picking a style sets its native layout. */
  verticalTabs: boolean;
  searchEngine: SearchEngineId;
  homePage: string;
  /** Reopen last session's regular tabs on startup (pinned tabs and Essentials always come back). */
  restoreSession: boolean;
  updates: UpdateSettings;
}

export type SettingsPatch = Partial<Omit<Settings, 'updates'>> & { updates?: Partial<UpdateSettings> };

export const SEARCH_ENGINES: Record<SearchEngineId, { name: string; url: string; home: string }> = {
  google: { name: 'Google', url: 'https://www.google.com/search?q=', home: 'https://www.google.com/' },
  duckduckgo: { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=', home: 'https://duckduckgo.com/' },
  bing: { name: 'Bing', url: 'https://www.bing.com/search?q=', home: 'https://www.bing.com/' },
  brave: { name: 'Brave Search', url: 'https://search.brave.com/search?q=', home: 'https://search.brave.com/' },
  startpage: { name: 'Startpage', url: 'https://www.startpage.com/do/search?q=', home: 'https://www.startpage.com/' },
};

export const DEFAULT_SETTINGS: Settings = {
  onboarded: false,
  theme: 'zen',
  spaceColors: true,
  verticalTabs: true,
  searchEngine: 'google',
  homePage: 'https://www.google.com/',
  restoreSession: true,
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
  return { ...base, ...patch, updates: { ...base.updates, ...(patch.updates ?? {}) } };
}
