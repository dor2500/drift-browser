import { app, net } from 'electron';
import { autoUpdater } from 'electron-updater';
import type { Settings } from '../shared/settings';
import type { UpdateStatus } from '../shared/types';

const SIX_HOURS = 6 * 60 * 60 * 1000;
const ELECTRON_RELEASES = 'https://releases.electronjs.org/releases.json';
const CHROME_STABLE = 'https://versionhistory.googleapis.com/v1/chrome/platforms/win64/channels/stable/versions?pageSize=1';

const major = (v?: string) => Number(v?.split('.')[0] ?? 0);

function newerSemver(a: string, b: string) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0);
  return false;
}

/**
 * Two kinds of update:
 *  - App updates: new Drift builds from the source chosen in Settings (GitHub
 *    Releases or a generic https server), via electron-updater. Every build
 *    carries the Chromium engine of the Electron it was built with.
 *  - Engine check: compares Drift's Chromium with the newest Electron release
 *    and Google Chrome's current stable version, so you know when a rebuild
 *    (`npm run update-engine`) would bring a newer engine.
 */
export class Updater {
  status: UpdateStatus = { app: { state: 'idle' }, engine: { current: process.versions.chrome } };
  private timer?: NodeJS.Timeout;

  constructor(
    private settings: () => Settings,
    private changed: () => void,
  ) {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on('checking-for-update', () => this.setApp({ state: 'checking' }));
    autoUpdater.on('update-not-available', () => this.setApp({ state: 'none', checkedAt: Date.now() }));
    autoUpdater.on('update-available', (i) => this.setApp({ state: 'available', version: i.version }));
    autoUpdater.on('download-progress', (p) =>
      this.setApp({ ...this.status.app, state: 'downloading', progress: Math.round(p.percent) }),
    );
    autoUpdater.on('update-downloaded', (i) => this.setApp({ state: 'ready', version: i.version }));
    autoUpdater.on('error', (e) => this.setApp({ state: 'error', message: String(e?.message ?? e).split('\n')[0] }));
  }

  /** Called on startup and whenever update settings change. */
  schedule() {
    clearInterval(this.timer);
    const u = this.settings().updates;
    if (!this.settings().onboarded || !u.autoCheck) return;
    setTimeout(() => void this.checkAll(), 8000);
    this.timer = setInterval(() => void this.checkAll(), SIX_HOURS);
  }

  async checkAll() {
    await Promise.all([this.checkApp(), this.settings().updates.engineAlerts ? this.checkEngine() : Promise.resolve()]);
  }

  async checkApp() {
    const reason = this.configure();
    if (reason) {
      this.setApp(reason);
      return;
    }
    try {
      await autoUpdater.checkForUpdates();
    } catch (e) {
      this.setApp({ state: 'error', message: String((e as Error)?.message ?? e).split('\n')[0] });
    }
  }

  install() {
    if (this.status.app.state === 'ready') autoUpdater.quitAndInstall();
  }

  async checkEngine() {
    this.status.engine = { ...this.status.engine, checking: true, error: undefined };
    this.changed();
    const [releases, chrome] = await Promise.allSettled([
      net.fetch(ELECTRON_RELEASES).then((r) => r.json() as Promise<{ version: string; chrome: string }[]>),
      net.fetch(CHROME_STABLE).then((r) => r.json() as Promise<{ versions?: { version: string }[] }>),
    ]);
    const engine: UpdateStatus['engine'] = { current: process.versions.chrome, checkedAt: Date.now() };
    if (releases.status === 'fulfilled' && Array.isArray(releases.value)) {
      let best: { version: string; chrome: string } | undefined;
      for (const r of releases.value) {
        if (!r?.version || r.version.includes('-') || !r.chrome) continue; // stable releases only
        if (!best || newerSemver(r.version, best.version)) best = r;
      }
      if (best) {
        engine.latestElectron = best.version;
        engine.latestElectronChrome = best.chrome;
        engine.newer = major(best.chrome) > major(engine.current);
      }
    }
    if (chrome.status === 'fulfilled') engine.chromeStable = chrome.value.versions?.[0]?.version;
    if (releases.status === 'rejected' && chrome.status === 'rejected') engine.error = 'Could not reach the release servers.';
    this.status.engine = engine;
    this.changed();
  }

  /** Points electron-updater at the chosen source, or says why it can't run. */
  private configure(): UpdateStatus['app'] | null {
    const u = this.settings().updates;
    if (u.source === 'off') return { state: 'disabled' };
    if (!app.isPackaged) {
      return {
        state: 'dev',
        message: 'App updates run in installed builds. In development, run "npm run update-engine" to move to the newest Chromium.',
      };
    }
    autoUpdater.allowPrerelease = u.channel === 'beta';
    if (u.source === 'github') {
      const [owner, repo] = u.githubRepo.split('/').map((x) => x.trim());
      if (!owner || !repo) return { state: 'error', message: 'Enter the GitHub repository that publishes Drift releases (owner/name).' };
      autoUpdater.setFeedURL({ provider: 'github', owner, repo });
    } else {
      if (!/^https:\/\//i.test(u.customUrl)) return { state: 'error', message: 'Enter an https:// address for the update server.' };
      autoUpdater.setFeedURL({ provider: 'generic', url: u.customUrl, channel: u.channel === 'beta' ? 'beta' : 'latest' });
    }
    return null;
  }

  private setApp(app: UpdateStatus['app']) {
    this.status.app = app;
    this.changed();
  }
}
