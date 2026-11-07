import { app, net } from 'electron';
import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { decodeMozLz4 } from './mozlz4';

const run = promisify(execFile);

/**
 * Drift's second engine: Gecko, the Firefox engine. Electron only contains
 * Chromium, so the Gecko engine is Firefox itself, started with a Drift-managed
 * profile that is privacy-hardened (LibreWolf-style prefs) and styled like Drift
 * (native vertical tabs, dark, compact). This is how Zen and LibreWolf are made.
 */
export interface GeckoStatus {
  available: boolean;
  /** "installed" = the Firefox already on this PC; "downloaded" = Drift's own copy. */
  kind?: 'installed' | 'downloaded';
  exe?: string;
  version?: string;
}

const enginesDir = () => path.join(app.getPath('userData'), 'engines');
const ownDir = () => path.join(enginesDir(), 'firefox');
export const geckoProfile = () => path.join(enginesDir(), 'gecko-profile');

function installedFirefox(): string | undefined {
  const PF = process.env.ProgramFiles ?? 'C:\\Program Files';
  const PF86 = process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)';
  const candidates =
    process.platform === 'win32'
      ? [path.join(PF, 'Mozilla Firefox', 'firefox.exe'), path.join(PF86, 'Mozilla Firefox', 'firefox.exe')]
      : process.platform === 'darwin'
        ? ['/Applications/Firefox.app/Contents/MacOS/firefox']
        : ['/usr/bin/firefox', '/usr/local/bin/firefox', '/snap/bin/firefox'];
  return candidates.find((p) => fs.existsSync(p));
}

function downloadedFirefox(): string | undefined {
  const exe =
    process.platform === 'win32'
      ? path.join(ownDir(), 'firefox.exe')
      : process.platform === 'darwin'
        ? path.join(ownDir(), 'Firefox.app', 'Contents', 'MacOS', 'firefox')
        : path.join(ownDir(), 'firefox', 'firefox');
  return fs.existsSync(exe) ? exe : undefined;
}

export function geckoStatus(): GeckoStatus {
  const own = downloadedFirefox();
  if (own) return { available: true, kind: 'downloaded', exe: own };
  const sys = installedFirefox();
  if (sys) return { available: true, kind: 'installed', exe: sys };
  return { available: false };
}

/** Fetch the official Firefox build from Mozilla into Drift's own folder (no admin rights needed). */
export async function downloadGecko(lang: string): Promise<GeckoStatus> {
  const osName = process.platform === 'win32' ? 'win64' : process.platform === 'darwin' ? 'osx' : 'linux64';
  const url = `https://download.mozilla.org/?product=firefox-latest-ssl&os=${osName}&lang=${encodeURIComponent(lang === 'he' ? 'he' : lang === 'en' ? 'en-US' : lang)}`;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'drift-gecko-'));
  try {
    const res = await net.fetch(url);
    if (!res.ok) throw new Error(`Mozilla download failed (${res.status})`);
    const file = path.join(tmp, process.platform === 'win32' ? 'firefox-setup.exe' : process.platform === 'darwin' ? 'firefox.dmg' : 'firefox.tar.xz');
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    fs.mkdirSync(ownDir(), { recursive: true });
    if (process.platform === 'win32') {
      // Mozilla's full installer: silent, into Drift's folder, no shortcuts or background services.
      await run(file, [
        '/S',
        `/InstallDirectoryPath=${ownDir()}`,
        '/DesktopShortcut=false',
        '/StartMenuShortcut=false',
        '/TaskbarShortcut=false',
        '/PrivateBrowsingShortcut=false',
        '/MaintenanceService=false',
        '/PreventRebootRequired=true',
      ]);
    } else if (process.platform === 'darwin') {
      const { stdout } = await run('hdiutil', ['attach', '-nobrowse', '-quiet', file]);
      const mount = stdout.trim().split('\t').pop() ?? '/Volumes/Firefox';
      await run('cp', ['-R', path.join(mount, 'Firefox.app'), ownDir()]);
      await run('hdiutil', ['detach', '-quiet', mount]);
    } else {
      await run('tar', ['-xf', file, '-C', ownDir()]);
    }
    writePolicies();
    return geckoStatus();
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/** Enterprise policies for Drift's own Firefox copy: no telemetry, studies, Pocket or sponsored content. */
function writePolicies() {
  const dist =
    process.platform === 'darwin'
      ? path.join(ownDir(), 'Firefox.app', 'Contents', 'Resources', 'distribution')
      : process.platform === 'win32'
        ? path.join(ownDir(), 'distribution')
        : path.join(ownDir(), 'firefox', 'distribution');
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
        },
      },
      null,
      2,
    ),
  );
}

/** Privacy-hardened prefs (LibreWolf / Arkenfox-inspired, kept compatible) plus Drift's layout. */
function userJs(lang: string) {
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
    // Tracking protection and privacy signals.
    'browser.contentblocking.category': 'strict',
    'privacy.globalprivacycontrol.enabled': true,
    'privacy.donottrackheader.enabled': true,
    'privacy.query_stripping.enabled': true,
    'privacy.query_stripping.enabled.pbmode': true,
    'dom.security.https_only_mode': true,
    'media.peerconnection.ice.default_address_only': true,
    // Quiet startup: no welcome pages, default-browser nags or "what's new".
    'browser.shell.checkDefaultBrowser': false,
    'browser.aboutwelcome.enabled': false,
    'trailhead.firstrun.didSeeAboutWelcome': true,
    'browser.startup.homepage_override.mstone': 'ignore',
    'startup.homepage_welcome_url': '',
    'startup.homepage_welcome_url.additional': '',
    'browser.aboutConfig.showWarning': false,
    'browser.startup.page': 3,
    'browser.startup.homepage': 'file:///' + path.join(geckoProfile(), 'drift-home.html').replace(/\\/g, '/'),
    // Drift look: native vertical tabs, dark, compact, custom styling.
    'sidebar.revamp': true,
    'sidebar.verticalTabs': true,
    'sidebar.visibility': 'always-show',
    'browser.uidensity': 1,
    'extensions.activeThemeID': 'firefox-compact-dark@mozilla.org',
    'layout.css.prefers-color-scheme.content-override': 0,
    'toolkit.legacyUserProfileCustomizations.stylesheets': true,
    'intl.locale.requested': lang === 'he' ? 'he' : '',
  };
  const lines = Object.entries(prefs).map(([k, v]) => `user_pref(${JSON.stringify(k)}, ${typeof v === 'string' ? JSON.stringify(v) : v});`);
  return `// Drift Gecko engine profile. Managed by Drift: this file is rewritten each time Drift starts the engine.\n${lines.join('\n')}\n`;
}

function userChromeCss(accent: string) {
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

function homeHtml(lang: string) {
  const he = lang === 'he';
  return `<!doctype html><html lang="${he ? 'he' : 'en'}" dir="${he ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>Drift · Gecko</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#141414;color:#e8e8e8;font:15px system-ui,sans-serif}
main{max-width:460px;text-align:center}h1{font-size:22px;margin:0 0 8px}p{color:#9a9aa5;line-height:1.5}
a.btn{display:inline-block;margin-top:14px;padding:10px 18px;border-radius:10px;background:#8aa4ff;color:#111;text-decoration:none;font-weight:600}</style></head>
<body><main><h1>${he ? 'Drift על מנוע Gecko' : 'Drift on the Gecko engine'}</h1>
<p>${he ? 'אתם גולשים עם מנוע Firefox, עם הגדרות פרטיות מוקשחות. אפשר לחזור למנוע Chromium בכל רגע, והכרטיסיות שלכם יעברו איתכם.' : "You're browsing with the Firefox engine and hardened privacy settings. You can switch back to Chromium at any time, and your tabs come with you."}</p>
<a class="btn" href="drift-engine://chromium">${he ? 'חזרה למנוע Chromium' : 'Back to the Chromium engine'}</a></main></body></html>`;
}

/** Write the managed profile and start the Gecko engine with these tabs. */
export function launchGecko(urls: string[], lang: string, accent: string): boolean {
  const st = geckoStatus();
  if (!st.available || !st.exe) return false;
  const dir = geckoProfile();
  fs.mkdirSync(path.join(dir, 'chrome'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'user.js'), userJs(lang));
  fs.writeFileSync(path.join(dir, 'chrome', 'userChrome.css'), userChromeCss(accent));
  fs.writeFileSync(path.join(dir, 'drift-home.html'), homeHtml(lang));
  if (st.kind === 'downloaded') writePolicies();
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
