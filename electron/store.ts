import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { SpaceState, SplitState, TabState } from '../shared/types';

export type PersistedTab = Pick<TabState, 'id' | 'url' | 'title' | 'favicon' | 'spaceId' | 'pinned' | 'essential' | 'muted'>;

export interface Persisted {
  version: 1;
  tabs: PersistedTab[];
  spaces: SpaceState[];
  activeSpaceId: string;
  compact: boolean;
  sidebarWidth: number;
  split?: SplitState;
}

const file = () => path.join(app.getPath('userData'), 'session.json');

export function load(): Persisted | null {
  try {
    const d = JSON.parse(fs.readFileSync(file(), 'utf8')) as Persisted;
    return d?.version === 1 && Array.isArray(d.spaces) && d.spaces.length > 0 && Array.isArray(d.tabs) ? d : null;
  } catch {
    return null;
  }
}

let timer: NodeJS.Timeout | undefined;

export function save(d: Persisted): void {
  clearTimeout(timer);
  timer = setTimeout(() => saveNow(d), 400);
}

export function saveNow(d: Persisted): void {
  clearTimeout(timer);
  try {
    const tmp = file() + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(d));
    fs.renameSync(tmp, file());
  } catch (err) {
    console.error('[drift] failed to save session', err);
  }
}
