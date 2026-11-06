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
  onState: (cb) => subscribe<BrowserState>('drift:state', cb),
  onUi: (cb) => subscribe<UiEvent>('drift:ui', cb),
};

contextBridge.exposeInMainWorld('drift', api);
