import { app, BrowserWindow, ipcMain, Menu, nativeTheme, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron';
import path from 'node:path';
import type { Command, ImportBrowser, ImportOptions, Pane } from '../shared/types';
import { Browser, detectRtl } from './browser';
import { otherBrowsers, readEnv } from './env';
import { detectSources } from './importer';
import { loadSettings } from './settings';
import * as store from './store';

const DEV_URL = process.env.DRIFT_DEV_URL;

app.setName('Drift');
// Groups Drift's windows under its own taskbar icon on Windows.
app.setAppUserModelId('app.drift.browser');
// Some sites (Google sign-in among them) refuse user agents that mention Electron.
app.userAgentFallback = app.userAgentFallback.replace(/\s(Electron|drift-browser|Drift)\/\S+/g, '');
nativeTheme.themeSource = 'dark';
if (loadSettings().forceDark) app.commandLine.appendSwitch('enable-features', 'WebContentsForceDark');

let win: BrowserWindow | undefined;
let browser: Browser | undefined;

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
  win.webContents.on('before-input-event', (e, input) => {
    if (browser?.shortcut(input)) e.preventDefault();
  });
  win.once('ready-to-show', () => win?.show());
  win.on('close', () => browser && store.saveNow(browser.persisted()));

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
ipcMain.on('drift:downloads-menu', (e) => fromShell(e) && browser?.downloadsMenu());
ipcMain.handle('drift:google-status', (e) => (fromShell(e) ? browser?.googleStatus() : false));
ipcMain.handle('drift:other-browsers', (e) => (fromShell(e) ? otherBrowsers().map(({ id, name }) => ({ id, name })) : []));
ipcMain.handle('drift:locale', (e) => (fromShell(e) ? browser?.i18n.bundle() : undefined));
ipcMain.handle('drift:languages', (e) => (fromShell(e) ? browser?.i18n.list() : undefined));
ipcMain.handle('drift:install-language', (e, code: string) => (fromShell(e) ? browser?.i18n.install(String(code)) : false));
ipcMain.handle('drift:suggest', (e, q: string) => (fromShell(e) ? browser?.history.suggest(String(q ?? '')) : []));
ipcMain.handle('drift:import-sources', (e) => (fromShell(e) ? detectSources() : []));
ipcMain.handle('drift:import', (e, source: ImportBrowser, options: ImportOptions) =>
  fromShell(e) ? browser?.runImport(source, options) : undefined,
);
// Asked by tab-preload.js on YouTube: should the ad skipper run on this page?
ipcMain.handle('drift:adblock-active', (e) => browser?.adblockActiveFor(e.sender.getURL()) ?? false);

app.whenReady().then(() => {
  detectRtl(app.getLocale());

  // Pages may not embed <webview> tags.
  app.on('web-contents-created', (_e, wc) => wc.on('will-attach-webview', (ev) => ev.preventDefault()));

  // macOS needs an application menu for Cmd+Q and for copy/paste in text fields.
  if (process.platform === 'darwin') {
    Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' }]));
  }

  createWindow();
});

app.on('window-all-closed', () => app.quit());
app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && app.isReady() && createWindow());
