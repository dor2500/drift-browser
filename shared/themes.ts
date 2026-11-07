import type { Settings, ThemeId } from './settings';

export interface ThemeInfo {
  id: ThemeId;
  name: string;
  tagline: string;
  /** Where the numbers came from. */
  source: string;
  /** Used when space colours are off. */
  accent: string;
  /** Default for "tint the window with the space colour". */
  spaceColors: boolean;
  /** The browser's own default layout: sidebar tabs (Zen) or a top tab strip. */
  verticalTabs: boolean;
  /** Corner radius of web content; also applied to the native views. */
  contentRadius: number;
  /** Colours for the small preview in the theme picker. */
  preview: { window: string; sidebar: string; surface: string; tab: string; text: string };
}

// Token values live in src/styles/themes.css and modes.css under [data-theme="…"].
// Zen, Firefox, Brave, Chrome and Edge were measured from the browsers installed on
// this PC; Opera and Tor Browser follow their published designs.
export const THEMES: Record<ThemeId, ThemeInfo> = {
  zen: {
    id: 'zen',
    name: 'Zen style',
    tagline: 'Vertical tabs, floating rounded page, colour-tinted spaces.',
    source: 'Zen 1.24b (zen-theme.css, vertical-tabs.css)',
    accent: '#8aa4ff',
    spaceColors: true,
    verticalTabs: true,
    contentRadius: 8,
    preview: { window: '#141414', sidebar: '#1d1f2b', surface: '#1b1b1b', tab: '#3a3d4d', text: '#e8e8e8' },
  },
  firefox: {
    id: 'firefox',
    name: 'Firefox style',
    tagline: 'Tabs on top, separate tab strip, floating rounded tabs, violet accent.',
    source: 'Firefox 159 (design-system tokens, browser-colors.css)',
    accent: '#b89cff',
    spaceColors: false,
    verticalTabs: false,
    contentRadius: 8,
    preview: { window: '#1c1b22', sidebar: '#1c1b22', surface: '#2b2a33', tab: '#42414d', text: '#fbfbfe' },
  },
  brave: {
    id: 'brave',
    name: 'Brave style',
    tagline: 'Chromium layout with Brave Leo colours and rounded tabs.',
    source: 'Brave 1.99 (Leo tokens in brave_resources.pak)',
    accent: '#5b67e8',
    spaceColors: false,
    verticalTabs: false,
    contentRadius: 4,
    preview: { window: '#141415', sidebar: '#141415', surface: '#1c1c1d', tab: '#303032', text: '#e4e4e5' },
  },
  chrome: {
    id: 'chrome',
    name: 'Chrome style',
    tagline: 'Tabs on top that merge into the toolbar, pill omnibox, ⋮ menu.',
    source: 'Chrome 156 (cr_elements colour fallbacks in resources.pak)',
    accent: '#a8c7fa',
    spaceColors: false,
    verticalTabs: false,
    contentRadius: 0,
    preview: { window: '#1f1f1f', sidebar: '#1f1f1f', surface: '#27282a', tab: '#333438', text: '#e3e3e3' },
  },
  edge: {
    id: 'edge',
    name: 'Edge style',
    tagline: 'Tabs on top, Fluent greys, the page set in a rounded frame.',
    source: 'Microsoft Edge 157 (measured from its window on this PC)',
    accent: '#a7c9fc',
    spaceColors: false,
    verticalTabs: false,
    contentRadius: 8,
    preview: { window: '#202020', sidebar: '#202020', surface: '#242424', tab: '#333333', text: '#ffffff' },
  },
  opera: {
    id: 'opera',
    name: 'Opera style',
    tagline: 'Opera One: tab islands on top, a sidebar rail of shortcuts, red accent.',
    source: 'Opera One design (Opera is not installed on this PC)',
    accent: '#ff4b5c',
    spaceColors: false,
    verticalTabs: false,
    contentRadius: 10,
    preview: { window: '#16171d', sidebar: '#1d1f27', surface: '#22242c', tab: '#30323b', text: '#e8e9ee' },
  },
  tor: {
    id: 'tor',
    name: 'Tor Browser style',
    tagline: 'The Tor Browser look (Firefox layout, Tor purple, New Identity). Looks only: Drift does not use the Tor network.',
    source: 'Tor Browser 14 design (Firefox ESR based)',
    accent: '#9059ff',
    spaceColors: false,
    verticalTabs: false,
    contentRadius: 0,
    preview: { window: '#1c1b22', sidebar: '#1c1b22', surface: '#2b2a33', tab: '#42414d', text: '#fbfbfe' },
  },
};

/** Settings sections in the order each browser shows them (see the mode.* labels). */
export type SettingsSection = 'sync' | 'appearance' | 'engine' | 'language' | 'general' | 'privacy' | 'import' | 'updates' | 'about';
export const SETTINGS_ORDER: Record<ThemeId, SettingsSection[]> = {
  zen: ['sync', 'appearance', 'engine', 'language', 'general', 'privacy', 'import', 'updates', 'about'],
  chrome: ['sync', 'import', 'privacy', 'engine', 'appearance', 'general', 'language', 'updates', 'about'],
  edge: ['sync', 'import', 'privacy', 'appearance', 'general', 'language', 'engine', 'updates', 'about'],
  firefox: ['appearance', 'general', 'privacy', 'sync', 'language', 'engine', 'import', 'updates', 'about'],
  tor: ['appearance', 'general', 'privacy', 'sync', 'language', 'engine', 'import', 'updates', 'about'],
  brave: ['general', 'sync', 'appearance', 'privacy', 'import', 'language', 'engine', 'updates', 'about'],
  opera: ['general', 'sync', 'appearance', 'privacy', 'import', 'language', 'engine', 'updates', 'about'],
};

/** Rounded floating page only in sidebar layouts; top-tab browsers draw the page edge to edge. */
export function contentRadiusFor(s: Pick<Settings, 'theme' | 'verticalTabs'>): number {
  return s.verticalTabs ? THEMES[s.theme].contentRadius : 0;
}

export const THEME_ORDER: ThemeId[] = ['zen', 'chrome', 'edge', 'firefox', 'brave', 'opera', 'tor'];
