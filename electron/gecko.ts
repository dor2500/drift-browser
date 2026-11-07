import { app, net } from 'electron';
import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { decodeMozLz4 } from './mozlz4';
import { SEARCH_ENGINES, type Settings } from '../shared/settings';
import { AUTOCONFIG_JS, DRIFT_CFG } from './gecko-autoconfig';

const run = promisify(execFile);

/**
 * Drift's second engine: Gecko, the Firefox engine. Electron only contains
 * Chromium, so Drift keeps its own portable copy of the engine: Mozilla's
 * official, signed build, unpacked into Drift's data folder. Nothing is
 * installed: no registry entries, shortcuts, uninstaller or background
 * services, and a Firefox the user may have installed is never used or changed.
 * Drift's profile (privacy-hardened, LibreWolf-style), policies and an
 * autoconfig script make it Drift: its settings, look, ad blocking and name.
 */
export interface GeckoStatus {
  available: boolean;
  exe?: string;
  version?: string;
}

const enginesDir = () => path.join(app.getPath('userData'), 'engines');
/**
 * The engine's files. On Windows they go where per-user programs live
 * (%LOCALAPPDATA%\Programs\Drift Gecko): Windows refuses to load the engine's
 * libraries from ordinary AppData folders, and it isn't data that should roam.
 */
const ownDir = () =>
  process.platform === 'win32' && process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, 'Programs', `${path.basename(app.getPath('userData'))} Gecko`)
    : path.join(enginesDir(), 'gecko');
export const geckoProfile = () => path.join(enginesDir(), 'gecko-profile');

/** Where the engine's files live inside Drift's copy (the folder holding the executable and omni.ja). */
function engineRoot(): string {
  return process.platform === 'darwin'
    ? path.join(ownDir(), 'Firefox.app', 'Contents', 'Resources')
    : process.platform === 'win32'
      ? ownDir()
      : path.join(ownDir(), 'firefox');
}

function engineExe(): string {
  return process.platform === 'win32'
    ? path.join(ownDir(), 'firefox.exe')
    : process.platform === 'darwin'
      ? path.join(ownDir(), 'Firefox.app', 'Contents', 'MacOS', 'firefox')
      : path.join(ownDir(), 'firefox', 'firefox');
}

function engineVersion(): string | undefined {
  try {
    const ini = fs.readFileSync(path.join(engineRoot(), 'application.ini'), 'utf8');
    return /^Version=(.+)$/m.exec(ini)?.[1]?.trim();
  } catch {
    return undefined;
  }
}

export function geckoStatus(): GeckoStatus {
  const exe = engineExe();
  return fs.existsSync(exe) ? { available: true, exe, version: engineVersion() } : { available: false };
}

/**
 * Fetch Mozilla's official build and unpack it into Drift's folder as a portable engine.
 * Windows: the package is unpacked with its own /ExtractDir option, so its installer never runs.
 */
export async function downloadGecko(lang: string, settings?: Settings): Promise<GeckoStatus> {
  const osName = process.platform === 'win32' ? 'win64' : process.platform === 'darwin' ? 'osx' : 'linux64';
  const url = `https://download.mozilla.org/?product=firefox-latest-ssl&os=${osName}&lang=${encodeURIComponent(lang === 'he' ? 'he' : lang === 'en' ? 'en-US' : lang)}`;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'drift-gecko-'));
  try {
    const res = await net.fetch(url);
    if (!res.ok) throw new Error(`Mozilla download failed (${res.status})`);
    const file = path.join(tmp, process.platform === 'win32' ? 'gecko.exe' : process.platform === 'darwin' ? 'gecko.dmg' : 'gecko.tar.xz');
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    fs.rmSync(ownDir(), { recursive: true, force: true });
    fs.mkdirSync(ownDir(), { recursive: true });
    if (process.platform === 'win32') {
      const out = path.join(tmp, 'unpacked');
      await run(file, [`/ExtractDir=${out}`]);
      fs.cpSync(path.join(out, 'core'), ownDir(), { recursive: true });
    } else if (process.platform === 'darwin') {
      const { stdout } = await run('hdiutil', ['attach', '-nobrowse', '-quiet', file]);
      const mount = stdout.trim().split('\t').pop() ?? '/Volumes/Firefox';
      await run('cp', ['-R', path.join(mount, 'Firefox.app'), ownDir()]);
      await run('hdiutil', ['detach', '-quiet', mount]);
    } else {
      await run('tar', ['-xf', file, '-C', ownDir()]);
    }
    if (settings) writeEngineConfig(settings);
    return geckoStatus();
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/** Drift's files inside the engine: policies plus the autoconfig that adds Drift's settings and name. */
function writeEngineConfig(settings: Settings) {
  writePolicies(settings);
  const prefDir = path.join(engineRoot(), 'defaults', 'pref');
  fs.mkdirSync(prefDir, { recursive: true });
  fs.writeFileSync(path.join(prefDir, 'autoconfig.js'), AUTOCONFIG_JS);
  fs.writeFileSync(path.join(engineRoot(), 'drift.cfg'), DRIFT_CFG);
}

/** Enterprise policies for Drift's own Firefox copy: no telemetry, studies, Pocket or sponsored content. */
function writePolicies(settings: Settings) {
  const dist = path.join(engineRoot(), 'distribution');
  fs.mkdirSync(dist, { recursive: true });
  fs.writeFileSync(
    path.join(dist, 'policies.json'),
    JSON.stringify(
      {
        policies: {
          DisableTelemetry: true,
          DisableFirefoxStudies: true,
          DisablePocket: true,
          DisableFeedbackCommands: true,
          DisableDefaultBrowserAgent: true,
          DontCheckDefaultBrowser: true,
          NoDefaultBookmarks: true,
          OverrideFirstRunPage: '',
          OverridePostUpdatePage: '',
          FirefoxHome: { SponsoredTopSites: false, SponsoredPocket: false, Pocket: false, Highlights: false, Locked: false },
          FirefoxSuggest: { SponsoredSuggestions: false, ImproveSuggest: false, Locked: false },
          UserMessaging: { ExtensionRecommendations: false, FeatureRecommendations: false, SkipOnboarding: true, MoreFromMozilla: false, Locked: false },
          EnableTrackingProtection: { Value: true, Cryptomining: true, Fingerprinting: true, EmailTracking: true, Locked: false },
          // Drift's search engine becomes the engine's default too.
          SearchEngines: { Default: SEARCH_ENGINES[settings.searchEngine].name },
          // Ad blocking like Drift's Chromium side: uBlock Origin, kept up to date by Mozilla's add-on site.
          // Installed once; the Drift settings switch turns it on and off.
          ExtensionSettings: { [UBLOCK_ID]: { installation_mode: 'normal_installed', install_url: UBLOCK_URL, private_browsing: true } },
        },
      },
      null,
      2,
    ),
  );
}

export const UBLOCK_ID = 'uBlock0@raymondhill.net';
const UBLOCK_URL = 'https://addons.mozilla.org/firefox/downloads/latest/ublock-origin/latest.xpi';

/** Privacy-hardened prefs (LibreWolf / Arkenfox-inspired, kept compatible), following Drift's own settings. */
function userJs(lang: string, s: Settings) {
  const p = s.privacy;
  // Zen style: vertical tabs. Chrome, Brave and Firefox styles: Firefox's tabs on top.
  const vertical = s.theme === 'zen' && s.verticalTabs;
  const prefs: Record<string, string | number | boolean> = {
    // Telemetry, studies, crash reports and data collection: off.
    'toolkit.telemetry.enabled': false,
    'toolkit.telemetry.unified': false,
    'toolkit.telemetry.archive.enabled': false,
    'toolkit.telemetry.server': '',
    'toolkit.telemetry.newProfilePing.enabled': false,
    'toolkit.telemetry.shutdownPingSender.enabled': false,
    'toolkit.telemetry.updatePing.enabled': false,
    'toolkit.telemetry.bhrPing.enabled': false,
    'toolkit.telemetry.firstShutdownPing.enabled': false,
    'datareporting.healthreport.uploadEnabled': false,
    'datareporting.policy.dataSubmissionEnabled': false,
    'datareporting.usage.uploadEnabled': false,
    'app.shield.optoutstudies.enabled': false,
    'app.normandy.enabled': false,
    'app.normandy.api_url': '',
    'breakpad.reportURL': '',
    'browser.tabs.crashReporting.sendReport': false,
    'browser.crashReports.unsubmittedCheck.autoSubmit2': false,
    'browser.discovery.enabled': false,
    'browser.ping-centre.telemetry': false,
    'browser.newtabpage.activity-stream.feeds.telemetry': false,
    'browser.newtabpage.activity-stream.telemetry': false,
    'browser.newtabpage.activity-stream.showSponsored': false,
    'browser.newtabpage.activity-stream.showSponsoredTopSites': false,
    'browser.newtabpage.activity-stream.feeds.section.topstories': false,
    'extensions.pocket.enabled': false,
    'browser.urlbar.suggest.quicksuggest.sponsored': false,
    'browser.urlbar.suggest.quicksuggest.nonsponsored': false,
    'extensions.htmlaboutaddons.recommendations.enabled': false,
    'extensions.getAddons.showPane': false,
    'browser.shopping.experience2023.enabled': false,
    'browser.ml.chat.enabled': false,
    // Tracking protection and privacy signals, from Drift's Privacy settings.
    'browser.contentblocking.category': s.adblock ? 'strict' : 'standard',
    'privacy.globalprivacycontrol.enabled': p.gpc,
    'privacy.donottrackheader.enabled': p.gpc,
    'privacy.query_stripping.enabled': p.stripTracking,
    'privacy.query_stripping.enabled.pbmode': p.stripTracking,
    'dom.security.https_only_mode': p.httpsOnly,
    'media.peerconnection.ice.default_address_only': p.webrtcProtect,
    'media.peerconnection.ice.no_host': p.webrtcProtect,
    // Quiet startup: no welcome pages, default-browser nags or "what's new".
    'browser.shell.checkDefaultBrowser': false,
    'browser.aboutwelcome.enabled': false,
    'trailhead.firstrun.didSeeAboutWelcome': true,
    'browser.startup.homepage_override.mstone': 'ignore',
    'startup.homepage_welcome_url': '',
    'startup.homepage_welcome_url.additional': '',
    'browser.aboutConfig.showWarning': false,
    'browser.startup.page': s.restoreSession ? 3 : 1,
    'browser.startup.homepage': 'file:///' + path.join(geckoProfile(), 'drift-home.html').replace(/\\/g, '/'),
    // General settings carried over from Drift.
    'browser.tabs.warnOnClose': s.confirmClose,
    'general.smoothScroll': s.smoothScrolling,
    'layers.acceleration.disabled': !s.hardwareAcceleration,
    'gfx.webrender.software': !s.hardwareAcceleration,
    'browser.tabs.unloadOnLowMemory': s.sleepAfter > 0,
    'layout.css.prefers-color-scheme.content-override': s.forceDark ? 0 : 2,
    // Drift look.
    'sidebar.revamp': vertical,
    'sidebar.verticalTabs': vertical,
    'sidebar.visibility': vertical ? 'always-show' : 'hide-sidebar',
    'browser.uidensity': s.theme === 'zen' ? 1 : 0,
    'extensions.activeThemeID': 'firefox-compact-dark@mozilla.org',
    'toolkit.legacyUserProfileCustomizations.stylesheets': true,
    'intl.locale.requested': lang === 'he' ? 'he' : '',
    // Read by drift.cfg (Drift's section in Settings).
    'drift.lang': lang === 'he' ? 'he' : 'en',
    'drift.settingsFile': path.join(app.getPath('userData'), 'settings.json'),
    'drift.launch': JSON.stringify([process.execPath, ...(app.isPackaged ? [] : [app.getAppPath()])]),
    'drift.adblock': s.adblock,
    'drift.settings': JSON.stringify({
      theme: s.theme, searchEngine: s.searchEngine, adblock: s.adblock, privacy: s.privacy,
      smoothScrolling: s.smoothScrolling, confirmClose: s.confirmClose, restoreSession: s.restoreSession, forceDark: s.forceDark,
    }),
  };
  const lines = Object.entries(prefs).map(([k, v]) => `user_pref(${JSON.stringify(k)}, ${typeof v === 'string' ? JSON.stringify(v) : v});`);
  return `// Drift Gecko engine profile. Managed by Drift: this file is rewritten each time Drift starts the engine.\n${lines.join('\n')}\n`;
}

function userChromeCss(accent: string, theme: Settings['theme']) {
  // The Firefox style is Firefox as it ships; the others get Drift's colours and rounded page.
  if (theme === 'firefox' || theme === 'tor') return '/* Drift: Firefox-based style, stock look. */\n';
  return `/* Drift look for the Gecko engine. Managed by Drift. */
:root {
  --drift-accent: ${accent};
  --drift-bg: #141414;
  --drift-surface: #1b1b1b;
  --toolbar-bgcolor: var(--drift-bg) !important;
  --toolbar-field-background-color: #1f1f24 !important;
  --tab-selected-bgcolor: color-mix(in srgb, var(--drift-accent) 22%, rgba(255, 255, 255, 0.12)) !important;
  --tab-border-radius: 10px !important;
  --toolbarbutton-border-radius: 8px !important;
}
#navigator-toolbox, #nav-bar, #TabsToolbar, #sidebar-main, sidebar-main, #browser {
  background: radial-gradient(130% 70% at 0% 0%, color-mix(in srgb, var(--drift-accent) 22%, transparent), transparent 62%), var(--drift-bg) !important;
  border: 0 !important;
}
#urlbar-background { border-radius: 10px !important; border: 0 !important; }
#tabbrowser-tabbox { margin: 0 8px 8px 0 !important; border-radius: 10px !important; overflow: hidden !important; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35) !important; }
#firefox-view-button, #alltabs-button, #pageActionButton { display: none !important; }
`;
}

export interface Shortcut {
  title: string;
  url: string;
}

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

/** The Gecko engine's start page: Drift's search box, your pinned tabs and top sites, and the way back to Chromium. */
function homeHtml(lang: string, s: Settings, accent: string, shortcuts: Shortcut[]) {
  const he = lang === 'he';
  const engine = SEARCH_ENGINES[s.searchEngine];
  const tiles = shortcuts
    .slice(0, 12)
    .map((t) => `<a class="tile" href="${esc(t.url)}"><span class="ic">${esc(hostOf(t.url).charAt(0).toUpperCase())}</span><span class="nm">${esc(t.title || hostOf(t.url))}</span></a>`)
    .join('');
  const placeholder = he ? `חיפוש ב-${engine.name}` : `Search with ${engine.name}`;
  return `<!doctype html><html lang="${he ? 'he' : 'en'}" dir="${he ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>Drift</title>
<style>:root{--a:${accent}}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;background:radial-gradient(90% 60% at 20% 0%,color-mix(in srgb,var(--a) 22%,transparent),transparent 60%),#141414;color:#e8e8e8;font:15px system-ui,sans-serif}
main{width:min(640px,90%);margin:auto 0;padding:48px 0;display:flex;flex-direction:column;align-items:center;gap:26px}
h1{margin:0;font-size:44px;font-weight:600;letter-spacing:-1px;color:var(--a)}
form{width:100%;display:flex;align-items:center;gap:10px;height:52px;padding:0 20px;border-radius:26px;background:#1f1f24;box-shadow:0 0 0 1px #2c2c33}
input{flex:1;border:0;outline:0;background:none;color:inherit;font:inherit;font-size:16px}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;width:100%}
.tile{display:grid;justify-items:center;gap:8px;padding:12px 4px;border-radius:14px;color:inherit;text-decoration:none}.tile:hover{background:#ffffff12}
.ic{display:grid;place-items:center;width:48px;height:48px;border-radius:14px;background:color-mix(in srgb,var(--a) 28%,#25252b);font-size:20px;font-weight:600}
.nm{max-width:110px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:12.5px;color:#a8a8b3}
footer{display:flex;gap:10px;align-items:center;padding:18px;color:#8a8a95;font-size:13px}
a.btn{padding:8px 14px;border-radius:10px;background:var(--a);color:#111;text-decoration:none;font-weight:600}</style></head>
<body><main><h1>Drift</h1>
<form action="${esc(engine.url.replace(/\?q=$/, ''))}" method="get"><input name="q" autofocus placeholder="${esc(placeholder)}"></form>
${tiles ? `<div class="grid">${tiles}</div>` : ''}</main>
<footer><span>${he ? 'מנוע Gecko (Firefox) עם הגדרות הפרטיות של Drift' : 'Gecko (Firefox) engine with Drift’s privacy settings'}</span>
<a class="btn" href="drift-engine://chromium">${he ? 'חזרה ל-Chromium' : 'Back to Chromium'}</a></footer></body></html>`;
}

export interface GeckoLaunch {
  lang: string;
  accent: string;
  settings: Settings;
  /** Pinned tabs, Essentials and top sites for the start page; omitted = keep the last ones. */
  shortcuts?: Shortcut[];
}

/** Write the managed profile from Drift's settings and start the Gecko engine with these tabs. */
export async function launchGecko(urls: string[], o: GeckoLaunch): Promise<boolean> {
  const st = geckoStatus();
  if (!st.available || !st.exe) return false;
  const dir = geckoProfile();
  fs.mkdirSync(path.join(dir, 'chrome'), { recursive: true });
  const saved = path.join(dir, 'drift-shortcuts.json');
  let shortcuts: Shortcut[] = o.shortcuts ?? [];
  if (o.shortcuts) fs.writeFileSync(saved, JSON.stringify(o.shortcuts));
  else {
    try {
      shortcuts = JSON.parse(fs.readFileSync(saved, 'utf8')) as Shortcut[];
    } catch {
      /* none yet */
    }
  }
  fs.writeFileSync(path.join(dir, 'user.js'), userJs(o.lang, o.settings));
  fs.writeFileSync(path.join(dir, 'chrome', 'userChrome.css'), userChromeCss(o.accent, o.settings.theme));
  fs.writeFileSync(path.join(dir, 'drift-home.html'), homeHtml(o.lang, o.settings, o.accent, shortcuts));
  writeEngineConfig(o.settings);
  const web = urls.filter((u) => /^https?:\/\//i.test(u)).slice(0, 60);
  const child = spawn(st.exe, ['-profile', dir, '-no-remote', ...web], { detached: true, stdio: 'ignore' });
  child.unref();
  return true;
}

/** Open tabs from the Gecko engine's last session, to bring back into Chromium. */
export function readGeckoSession(): string[] {
  const dir = geckoProfile();
  for (const f of ['sessionstore-backups/recovery.jsonlz4', 'sessionstore.jsonlz4', 'sessionstore-backups/previous.jsonlz4']) {
    const p = path.join(dir, f);
    if (!fs.existsSync(p)) continue;
    try {
      type Win = { tabs?: { entries?: { url?: string }[]; index?: number }[] };
      const s = JSON.parse(decodeMozLz4(fs.readFileSync(p))) as { windows?: Win[] };
      const urls: string[] = [];
      for (const w of s.windows ?? [])
        for (const t of w.tabs ?? []) {
          const e = t.entries?.[Math.max(0, (t.index ?? t.entries.length) - 1)];
          if (e?.url && /^https?:\/\//i.test(e.url)) urls.push(e.url);
        }
      return urls;
    } catch {
      /* try the next file */
    }
  }
  return [];
}
