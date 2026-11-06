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
    theme: s.theme in THEMES ? s.theme : d.theme,
    spaceColors: typeof s.spaceColors === 'boolean' ? s.spaceColors : d.spaceColors,
    verticalTabs: typeof s.verticalTabs === 'boolean' ? s.verticalTabs : THEMES[s.theme in THEMES ? s.theme : d.theme].verticalTabs,
    searchEngine: s.searchEngine in SEARCH_ENGINES ? s.searchEngine : d.searchEngine,
    homePage: typeof s.homePage === 'string' && /^(https?|drift):/i.test(s.homePage) ? s.homePage : d.homePage,
    restoreSession: typeof s.restoreSession === 'boolean' ? s.restoreSession : d.restoreSession,
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
