import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_SETTINGS, SEARCH_ENGINES, mergeSettings, type Settings, type SettingsPatch } from '../shared/settings';
import { THEMES } from '../shared/themes';

const file = () => path.join(app.getPath('userData'), 'settings.json');

/** Drops anything invalid so a hand-edited or old file can't break startup. */
function sanitize(s: Settings): Settings {
  const d = DEFAULT_SETTINGS;
  const u = s.updates;
  return {
    onboarded: !!s.onboarded,
    engine: s.engine === 'gecko' ? 'gecko' : 'chromium',
    language: typeof s.language === 'string' && /^(auto|[a-z]{2,3}(-[A-Za-z]{2,4})?)$/.test(s.language) ? s.language : 'auto',
    theme: s.theme in THEMES ? s.theme : d.theme,
    spaceColors: typeof s.spaceColors === 'boolean' ? s.spaceColors : d.spaceColors,
    verticalTabs: typeof s.verticalTabs === 'boolean' ? s.verticalTabs : THEMES[s.theme in THEMES ? s.theme : d.theme].verticalTabs,
    searchEngine: s.searchEngine in SEARCH_ENGINES ? s.searchEngine : d.searchEngine,
    homePage: typeof s.homePage === 'string' && /^(https?|drift):/i.test(s.homePage) ? s.homePage : d.homePage,
    restoreSession: typeof s.restoreSession === 'boolean' ? s.restoreSession : d.restoreSession,
    newTabPage: s.newTabPage === 'home' ? 'home' : 'newtab',
    confirmClose: !!s.confirmClose,
    smoothScrolling: typeof s.smoothScrolling === 'boolean' ? s.smoothScrolling : true,
    hardwareAcceleration: typeof s.hardwareAcceleration === 'boolean' ? s.hardwareAcceleration : true,
    adblock: typeof s.adblock === 'boolean' ? s.adblock : d.adblock,
    adblockPaused: Array.isArray(s.adblockPaused) ? [...new Set(s.adblockPaused.filter((h) => typeof h === 'string' && h.length < 256))] : [],
    sleepAfter: [0, 15, 30, 60, 120].includes(s.sleepAfter) ? s.sleepAfter : d.sleepAfter,
    forceDark: !!s.forceDark,
    siteZoom:
      s.siteZoom && typeof s.siteZoom === 'object'
        ? Object.fromEntries(Object.entries(s.siteZoom).filter(([h, z]) => h.length < 256 && typeof z === 'number' && z >= -3 && z <= 5).slice(0, 500))
        : {},
    colorTheme: typeof s.colorTheme === 'string' && /^[a-z0-9-]{1,32}$/.test(s.colorTheme) ? s.colorTheme : 'default',
    customAccent: typeof s.customAccent === 'string' && /^(#[0-9a-fA-F]{6})?$/.test(s.customAccent) ? s.customAccent : '',
    openInRules:
      s.openInRules && typeof s.openInRules === 'object'
        ? Object.fromEntries(
            Object.entries(s.openInRules).filter(([h, b]) => h.length < 256 && ['zen', 'firefox', 'chrome', 'brave', 'edge'].includes(b as string)).slice(0, 200),
          )
        : {},
    privacy: Object.fromEntries(
      Object.entries(d.privacy).map(([k, def]) => [k, typeof (s.privacy as unknown as Record<string, unknown> | undefined)?.[k] === 'boolean' ? (s.privacy as unknown as Record<string, boolean>)[k] : def]),
    ) as Settings['privacy'],
    updates: {
      source: ['github', 'custom', 'off'].includes(u?.source) ? u.source : d.updates.source,
      githubRepo: typeof u?.githubRepo === 'string' ? u.githubRepo.trim() : '',
      customUrl: typeof u?.customUrl === 'string' ? u.customUrl.trim() : '',
      channel: u?.channel === 'beta' ? 'beta' : 'stable',
      autoCheck: typeof u?.autoCheck === 'boolean' ? u.autoCheck : d.updates.autoCheck,
      engineAlerts: typeof u?.engineAlerts === 'boolean' ? u.engineAlerts : d.updates.engineAlerts,
    },
  };
}

export function loadSettings(): Settings {
  try {
    return sanitize(mergeSettings(DEFAULT_SETTINGS, JSON.parse(fs.readFileSync(file(), 'utf8')) as SettingsPatch));
  } catch {
    return { ...DEFAULT_SETTINGS, updates: { ...DEFAULT_SETTINGS.updates } };
  }
}

export function applyPatch(current: Settings, patch: SettingsPatch): Settings {
  return sanitize(mergeSettings(current, patch));
}

export function saveSettings(s: Settings) {
  try {
    fs.writeFileSync(file(), JSON.stringify(s, null, 1));
  } catch (err) {
    console.error('[drift] failed to save settings', err);
  }
}
