import { app, BrowserWindow, ipcMain, Menu, nativeTheme, session, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron';
import path from 'node:path';
import type { Command, ImportBrowser, ImportOptions, Pane } from '../shared/types';
import { Browser, detectRtl, PARTITION } from './browser';
import { otherBrowsers, readEnv } from './env';
import { downloadGecko, geckoStatus } from './gecko';
import { detectSources } from './importer';
import { loadSettings } from './settings';
import * as store from './store';

const DEV_URL = process.env.DRIFT_DEV_URL;

app.setName('Drift');
// Development runs keep their own data, so testing never touches an installed Drift.
if (!app.isPackaged) app.setPath('userData', app.getPath('userData') + ' Dev');
// Groups Drift's windows under its own taskbar icon on Windows.
app.setAppUserModelId('app.drift.browser');
// Ensure 100% authentic Google Chrome identity across all web engines and services
const chromeVer = process.versions.chrome || '134.0.0.0';
app.userAgentFallback =
  process.platform === 'win32'
    ? `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVer} Safari/537.36`
    : process.platform === 'darwin'
      ? `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVer} Safari/537.36`
      : `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVer} Safari/537.36`;
nativeTheme.themeSource = 'dark';
{
  const early = loadSettings();
  if (early.forceDark) app.commandLine.appendSwitch('enable-features', 'WebContentsForceDark');
  if (!early.smoothScrolling) app.commandLine.appendSwitch('disable-smooth-scrolling');
  if (!early.hardwareAcceleration) app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
}

let win: BrowserWindow | undefined;
let browser: Browser | undefined;
let confirmedClose = false;

/** Only the shell window may drive the browser over IPC, never a web page. */
const fromShell = (e: IpcMainEvent | IpcMainInvokeEvent) => !!win && e.sender === win.webContents;

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 760,
    minHeight: 495,
    title: 'Drift',
    icon: path.join(__dirname, '../../assets/icon.png'),
    titleBarStyle: 'hidden', // Windows/Linux: Drift draws its own window buttons
    trafficLightPosition: { x: 14, y: 13 }, // macOS: keep the system buttons, inset into Drift's top row
    backgroundColor: '#141414',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      // The shell is tiny; keep it rendering while the window is covered so
      // tab titles and favicons are current the moment you switch back.
      backgroundThrottling: false,
    },
  });

  browser = new Browser(win);
  // The shell window holds the privileged `drift` IPC surface (authorized by
  // sender === win.webContents). Never let it navigate to, or open, anything
  // but the app itself, so a stray link/redirect can't hand that surface to a
  // remote origin.
  const isShellUrl = (url: string) => (DEV_URL ? url.startsWith(DEV_URL) : url.startsWith('file://'));
  win.webContents.on('will-navigate', (e, url) => {
    if (!isShellUrl(url)) e.preventDefault();
  });
  win.webContents.on('will-redirect', (e, url) => {
    if (!isShellUrl(url)) e.preventDefault();
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('before-input-event', (e, input) => {
    if (browser?.shortcut(input)) e.preventDefault();
  });
  win.once('ready-to-show', () => win?.show());
  win.on('close', (e) => {
    if (browser?.shouldConfirmClose() && !confirmedClose) {
      e.preventDefault();
      void browser.confirmClose().then((ok) => {
        if (!ok) return;
        confirmedClose = true;
        win?.close();
      });
      return;
    }
    if (browser) store.saveNow(browser.persisted());
  });

  if (DEV_URL) void win.loadURL(DEV_URL);
  else void win.loadFile(path.join(__dirname, '../../dist/index.html'));
}

ipcMain.handle('drift:get-state', (e) => (fromShell(e) ? browser?.state() : undefined));
ipcMain.handle('drift:cmd', (e, c: Command) => {
  if (fromShell(e)) browser?.run(c);
});
ipcMain.handle('drift:overlay', (e, open: boolean) => (fromShell(e) ? browser?.setOverlay(open) ?? [] : []));
ipcMain.on('drift:layout', (e, panes: Pane[]) => fromShell(e) && browser?.setPanes(panes));
// Sent by tab-preload.js from inside web pages (Alt+click on a link).
ipcMain.on('drift:glance', (e, p) => browser?.glanceFrom(e.sender, p));
ipcMain.on('drift:tab-menu', (e, id: string) => fromShell(e) && browser?.tabMenu(id));
ipcMain.on('drift:space-menu', (e, id: string) => fromShell(e) && browser?.spaceMenu(id));
ipcMain.on('drift:site-menu', (e) => fromShell(e) && browser?.siteMenu());
ipcMain.on('drift:app-menu', (e) => fromShell(e) && browser?.appMenu());
ipcMain.on('drift:spaces-menu', (e) => fromShell(e) && browser?.spacesMenu());
ipcMain.handle('drift:env', (e) => (fromShell(e) ? readEnv() : undefined));
ipcMain.handle('drift:site-permissions', (e) => (fromShell(e) ? browser?.permissions.all() : undefined));
ipcMain.on('drift:shield-menu', (e) => fromShell(e) && browser?.shieldMenu());
ipcMain.handle('drift:top-sites', (e) => (fromShell(e) ? browser?.history.topSites(8) : []));
ipcMain.handle('drift:stats', (e) => (fromShell(e) ? browser?.stats() : undefined));
ipcMain.handle('drift:gecko-status', (e) => (fromShell(e) ? geckoStatus() : undefined));
ipcMain.handle('drift:gecko-download', async (e) => {
  if (!fromShell(e) || !browser) return undefined;
  try {
    return await downloadGecko(browser.language, browser.currentSettings);
  } catch (err) {
    return { available: false, error: String((err as Error)?.message ?? err) };
  }
});
ipcMain.on('drift:downloads-menu', (e) => fromShell(e) && browser?.downloadsMenu());
ipcMain.handle('drift:google-status', (e) => (fromShell(e) ? browser?.googleStatus() : false));
ipcMain.handle('drift:is-default-browser', (e) => (fromShell(e) ? app.isDefaultProtocolClient('http') : false));
ipcMain.handle('drift:other-browsers', (e) => (fromShell(e) ? otherBrowsers().map(({ id, name }) => ({ id, name })) : []));
ipcMain.handle('drift:locale', (e) => (fromShell(e) ? browser?.i18n.bundle() : undefined));
ipcMain.handle('drift:languages', (e) => (fromShell(e) ? browser?.i18n.list() : undefined));
ipcMain.handle('drift:install-language', (e, code: string) => (fromShell(e) ? browser?.i18n.install(String(code)) : false));
ipcMain.handle('drift:suggest', (e, q: string) => (fromShell(e) ? browser?.history.suggest(String(q ?? '')) : []));
ipcMain.handle('drift:get-bookmarks', (e) => (fromShell(e) ? browser?.history.getBookmarks() : []));
ipcMain.handle('drift:history-list', (e, limit?: number) => (fromShell(e) ? browser?.history.getAllHistory(limit) : []));
ipcMain.handle('drift:history-delete', (e, url: string) => (fromShell(e) ? browser?.history.deleteEntry(url) : false));
ipcMain.handle('drift:history-clear', (e, sinceMs?: number) => {
  if (!fromShell(e) || !browser) return false;
  browser.history.clearHistory(sinceMs);
  return true;
});
ipcMain.handle('drift:sessions-list', (e) => (fromShell(e) ? browser?.getSavedSessions() : []));
ipcMain.handle('drift:sessions-save', (e, name: string, tabs: any[], spaceName?: string) =>
  fromShell(e) ? browser?.saveSessionSnapshot(name, tabs, spaceName) : undefined
);
ipcMain.handle('drift:sessions-delete', (e, id: string) => (fromShell(e) ? browser?.deleteSavedSession(id) : undefined));
ipcMain.handle('drift:sessions-restore', (e, id: string, newSpace?: boolean) =>
  fromShell(e) ? browser?.restoreSavedSession(id, newSpace) : undefined
);
ipcMain.handle('drift:passwords-list', (e) => (fromShell(e) ? store.loadPasswords() : []));
ipcMain.handle('drift:passwords-save', (e, entry) => (fromShell(e) ? store.savePasswordEntry(entry) : undefined));
ipcMain.handle('drift:passwords-delete', (e, id: string) => (fromShell(e) ? store.deletePasswordEntry(id) : false));
ipcMain.handle('drift:cookies-list', async (e, filter?: { domain?: string }) => {
  if (!fromShell(e)) return [];
  const ses = session.fromPartition(PARTITION);
  return await ses.cookies.get(filter || {});
});
ipcMain.handle('drift:cookies-remove', async (e, url: string, name: string) => {
  if (!fromShell(e)) return false;
  const ses = session.fromPartition(PARTITION);
  await ses.cookies.remove(url, name);
  return true;
});
ipcMain.handle('drift:cookies-remove-domain', async (e, domain: string) => {
  if (!fromShell(e)) return false;
  const ses = session.fromPartition(PARTITION);
  const cookies = await ses.cookies.get({ domain });
  for (const c of cookies) {
    const protocol = c.secure ? 'https://' : 'http://';
    const rawDom = c.domain || domain;
    const dom = rawDom.startsWith('.') ? rawDom.slice(1) : rawDom;
    const url = `${protocol}${dom}${c.path || '/'}`;
    await ses.cookies.remove(url, c.name).catch(() => {});
  }
  return true;
});
ipcMain.handle('drift:cookies-clear-all', async (e) => {
  if (!fromShell(e)) return false;
  const ses = session.fromPartition(PARTITION);
  await ses.clearStorageData({ storages: ['cookies', 'localstorage', 'indexdb', 'cachestorage'] });
  return true;
});
ipcMain.handle('drift:cookies-set', async (e, details: { url: string; name: string; value: string; domain?: string; path?: string; secure?: boolean; httpOnly?: boolean; expirationDate?: number }) => {
  if (!fromShell(e)) return false;
  const ses = session.fromPartition(PARTITION);
  await ses.cookies.set(details);
  return true;
});
ipcMain.handle('drift:extensions-list', (e) => (fromShell(e) ? browser?.getInstalledExtensions() : []));
ipcMain.handle('drift:extensions-load-unpacked', (e) => (fromShell(e) ? browser?.loadUnpackedExtension() : null));
ipcMain.handle('drift:extensions-remove', (e, id: string) => (fromShell(e) ? browser?.removeExtension(id) : false));
ipcMain.handle('drift:extensions-toggle', (e, id: string, enabled: boolean) => (fromShell(e) ? browser?.toggleExtension(id, enabled) : false));
ipcMain.handle('drift:extensions-update-settings', (e, id: string, patch: any) => (fromShell(e) ? browser?.updateExtensionSettings(id, patch) : false));
ipcMain.handle('drift:import-sources', (e) => (fromShell(e) ? detectSources() : []));
ipcMain.handle('drift:import', (e, source: ImportBrowser, options: ImportOptions) =>
  fromShell(e) ? browser?.runImport(source, options) : undefined,
);
// Asked by tab-preload.js on YouTube: should the ad skipper run on this page?
ipcMain.handle('drift:adblock-active', (e) => browser?.adblockActiveFor(e.sender.getURL()) ?? false);

// One Drift at a time; links like drift-engine://chromium reach the running copy.
const ENGINE_LINK = 'drift-engine://';
const engineLink = (argv: string[]) => argv.find((a) => a.startsWith(ENGINE_LINK));
if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', (_e, argv) => {
  if (engineLink(argv)) browser?.returnFromGecko();
  else if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});
app.on('open-url', (e, url) => {
  // macOS delivers protocol links here.
  e.preventDefault();
  if (url.startsWith(ENGINE_LINK)) browser?.returnFromGecko();
});

app.whenReady().then(async () => {
  detectRtl(app.getLocale());

  // Only the installed app registers the link, so development runs never take it over.
  if (app.isPackaged) app.setAsDefaultProtocolClient('drift-engine');

  const returning = !!engineLink(process.argv);

  // Pages may not embed <webview> tags.
  app.on('web-contents-created', (_e, wc) => wc.on('will-attach-webview', (ev) => ev.preventDefault()));

  // macOS needs an application menu for Cmd+Q and for copy/paste in text fields.
  if (process.platform === 'darwin') {
    Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' }]));
  }

  createWindow();
  if (returning) setTimeout(() => browser?.returnFromGecko(), 1500);
});

app.on('window-all-closed', () => app.quit());

// "Clear cookies and site data when Drift closes": finish clearing before quitting.
let clearedOnExit = false;
app.on('will-quit', (e) => {
  if (clearedOnExit || !browser?.wantsClearOnExit) return;
  e.preventDefault();
  void browser
    .clearSiteData()
    .catch(() => undefined)
    .finally(() => {
      clearedOnExit = true;
      app.quit();
    });
});
app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && app.isReady() && createWindow());
