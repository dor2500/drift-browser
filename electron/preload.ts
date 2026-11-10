import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { BrowserState, Command, DriftApi, Pane, UiEvent } from '../shared/types';

const subscribe = <T>(channel: string, cb: (v: T) => void) => {
  const h = (_e: IpcRendererEvent, v: T) => cb(v);
  ipcRenderer.on(channel, h);
  return () => {
    ipcRenderer.off(channel, h);
  };
};

const api: DriftApi = {
  platform: process.platform,
  getState: () => ipcRenderer.invoke('drift:get-state'),
  cmd: (c: Command) => ipcRenderer.invoke('drift:cmd', c),
  layout: (panes: Pane[]) => ipcRenderer.send('drift:layout', panes),
  overlay: (open: boolean) => ipcRenderer.invoke('drift:overlay', open),
  tabMenu: (id: string) => ipcRenderer.send('drift:tab-menu', id),
  spaceMenu: (id: string) => ipcRenderer.send('drift:space-menu', id),
  siteMenu: () => ipcRenderer.send('drift:site-menu'),
  appMenu: () => ipcRenderer.send('drift:app-menu'),
  spacesMenu: () => ipcRenderer.send('drift:spaces-menu'),
  env: () => ipcRenderer.invoke('drift:env'),
  sitePermissions: () => ipcRenderer.invoke('drift:site-permissions'),
  shieldMenu: () => ipcRenderer.send('drift:shield-menu'),
  downloadsMenu: () => ipcRenderer.send('drift:downloads-menu'),
  googleStatus: () => ipcRenderer.invoke('drift:google-status'),
  isDefaultBrowser: () => ipcRenderer.invoke('drift:is-default-browser'),
  topSites: () => ipcRenderer.invoke('drift:top-sites'),
  stats: () => ipcRenderer.invoke('drift:stats'),
  geckoStatus: () => ipcRenderer.invoke('drift:gecko-status'),
  downloadGecko: () => ipcRenderer.invoke('drift:gecko-download'),
  otherBrowsers: () => ipcRenderer.invoke('drift:other-browsers'),
  locale: () => ipcRenderer.invoke('drift:locale'),
  languages: () => ipcRenderer.invoke('drift:languages'),
  installLanguage: (code) => ipcRenderer.invoke('drift:install-language', code),
  suggest: (query) => ipcRenderer.invoke('drift:suggest', query),
  getBookmarks: () => ipcRenderer.invoke('drift:get-bookmarks'),
  getSavedSessions: () => ipcRenderer.invoke('drift:sessions-list'),
  saveSessionSnapshot: (name, tabs, spaceName) => ipcRenderer.invoke('drift:sessions-save', name, tabs, spaceName),
  deleteSavedSession: (id) => ipcRenderer.invoke('drift:sessions-delete', id),
  restoreSavedSession: (id, newSpace) => ipcRenderer.invoke('drift:sessions-restore', id, newSpace),
  importSources: () => ipcRenderer.invoke('drift:import-sources'),
  runImport: (source, options) => ipcRenderer.invoke('drift:import', source, options),
  onState: (cb) => subscribe<BrowserState>('drift:state', cb),
  onUi: (cb) => subscribe<UiEvent>('drift:ui', cb),
};

contextBridge.exposeInMainWorld('drift', api);
