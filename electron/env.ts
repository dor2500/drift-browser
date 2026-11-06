import { app } from 'electron';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { DriftEnv } from '../shared/types';

const PF = process.env.ProgramFiles ?? 'C:\\Program Files';
const PF86 = process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)';
const LOCAL = process.env.LOCALAPPDATA ?? '';
const APPS = '/Applications';
const BIN = ['/usr/bin', '/usr/local/bin', '/opt', '/snap/bin'];
const onPath = (names: string[]) => BIN.flatMap((d) => names.map((n) => path.join(d, n)));

/** Known install locations, used to label "installed on this PC" in the theme picker. */
const WIN: Record<keyof DriftEnv['browsers'], string[]> = {
  zen: [path.join(PF, 'Zen Browser', 'zen.exe'), path.join(LOCAL, 'Zen Browser', 'zen.exe')],
  firefox: [path.join(PF, 'Mozilla Firefox', 'firefox.exe'), path.join(PF86, 'Mozilla Firefox', 'firefox.exe')],
  brave: [
    path.join(PF, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
    path.join(LOCAL, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
  ],
  chrome: [
    path.join(PF, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(PF86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(LOCAL, 'Google', 'Chrome', 'Application', 'chrome.exe'),
  ],
};

const MAC: Record<keyof DriftEnv['browsers'], string[]> = {
  zen: [path.join(APPS, 'Zen.app'), path.join(APPS, 'Zen Browser.app')],
  firefox: [path.join(APPS, 'Firefox.app')],
  brave: [path.join(APPS, 'Brave Browser.app')],
  chrome: [path.join(APPS, 'Google Chrome.app')],
};

const LINUX: Record<keyof DriftEnv['browsers'], string[]> = {
  zen: onPath(['zen', 'zen-browser', 'zen/zen']),
  firefox: onPath(['firefox']),
  brave: onPath(['brave', 'brave-browser']),
  chrome: onPath(['google-chrome', 'google-chrome-stable']),
};

const CANDIDATES = process.platform === 'win32' ? WIN : process.platform === 'darwin' ? MAC : LINUX;

const EDGE: string[] =
  process.platform === 'win32'
    ? [path.join(PF86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(PF, 'Microsoft', 'Edge', 'Application', 'msedge.exe')]
    : process.platform === 'darwin'
      ? [path.join(APPS, 'Microsoft Edge.app')]
      : onPath(['microsoft-edge', 'microsoft-edge-stable']);

export const BROWSER_NAMES: Record<string, string> = { zen: 'Zen', firefox: 'Firefox', chrome: 'Google Chrome', brave: 'Brave', edge: 'Microsoft Edge' };

/** Installed browsers Drift can hand a page to, with the path that launches each. */
export function otherBrowsers(): { id: string; name: string; exe: string }[] {
  const all: Record<string, string[]> = { ...CANDIDATES, edge: EDGE };
  return Object.entries(all)
    .map(([id, paths]) => ({ id, name: BROWSER_NAMES[id], exe: paths.find((p) => p && fs.existsSync(p)) ?? '' }))
    .filter((b) => b.exe);
}

export function openInBrowser(id: string, url: string): boolean {
  const b = otherBrowsers().find((x) => x.id === id);
  if (!b || !/^https?:/i.test(url)) return false;
  const child =
    process.platform === 'darwin' ? spawn('open', ['-a', b.exe, url], { detached: true, stdio: 'ignore' }) : spawn(b.exe, [url], { detached: true, stdio: 'ignore' });
  child.unref();
  return true;
}

export function readEnv(): DriftEnv {
  const browsers = Object.fromEntries(
    Object.entries(CANDIDATES).map(([k, paths]) => [k, paths.some((p) => p && fs.existsSync(p))]),
  ) as DriftEnv['browsers'];
  return {
    browsers,
    packaged: app.isPackaged,
    versions: {
      app: app.getVersion(),
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
    },
  };
}
