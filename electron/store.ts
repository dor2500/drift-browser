import { app, safeStorage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { CredentialEntry, SavedSession, SpaceState, SplitState, TabGroup, TabState } from '../shared/types';

export type PersistedTab = Pick<TabState, 'id' | 'url' | 'title' | 'favicon' | 'spaceId' | 'pinned' | 'essential' | 'muted' | 'groupId'>;

export interface Persisted {
  version: 1;
  tabs: PersistedTab[];
  spaces: SpaceState[];
  activeSpaceId: string;
  compact: boolean;
  sidebarWidth: number;
  split?: SplitState;
  tabGroups?: TabGroup[];
}

const file = () => path.join(app.getPath('userData'), 'session.json');
const savedSessionsFile = () => path.join(app.getPath('userData'), 'saved-sessions.json');

export function loadSavedSessions(): SavedSession[] {
  try {
    const raw = fs.readFileSync(savedSessionsFile(), 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function saveSavedSessions(list: SavedSession[]): void {
  try {
    fs.writeFileSync(savedSessionsFile(), JSON.stringify(list, null, 2));
  } catch (err) {
    console.error('[drift] failed to save sessions', err);
  }
}

const passwordsFile = () => path.join(app.getPath('userData'), 'passwords.json');

interface StoredCredential {
  id: string;
  url: string;
  username: string;
  encPassword: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

function encryptSecret(plain: string): string {
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return `enc:${safeStorage.encryptString(plain).toString('base64')}`;
    }
  } catch {
    /* fallback below */
  }
  return `b64:${Buffer.from(plain, 'utf8').toString('base64')}`;
}

function decryptSecret(cipher: string): string {
  try {
    if (cipher.startsWith('enc:') && safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(Buffer.from(cipher.slice(4), 'base64'));
    }
    if (cipher.startsWith('b64:')) {
      return Buffer.from(cipher.slice(4), 'base64').toString('utf8');
    }
  } catch {
    /* fallback below */
  }
  return cipher;
}

export function loadPasswords(): CredentialEntry[] {
  try {
    const raw = fs.readFileSync(passwordsFile(), 'utf8');
    const list = JSON.parse(raw) as StoredCredential[];
    if (!Array.isArray(list)) return [];
    return list.map((item) => ({
      id: item.id,
      url: item.url,
      username: item.username,
      password: decryptSecret(item.encPassword),
      notes: item.notes,
      createdAt: item.createdAt || Date.now(),
      updatedAt: item.updatedAt || Date.now(),
    }));
  } catch {
    return [];
  }
}

export function savePasswordEntry(
  entry: Omit<CredentialEntry, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
): CredentialEntry {
  const current = loadPasswords();
  const now = Date.now();
  const id = entry.id || `pwd-${now}-${Math.random().toString(36).slice(2, 7)}`;
  const existingIndex = current.findIndex((x) => x.id === id);
  const updated: CredentialEntry = {
    id,
    url: entry.url.trim(),
    username: entry.username.trim(),
    password: entry.password,
    notes: entry.notes?.trim(),
    createdAt: existingIndex >= 0 ? current[existingIndex].createdAt : now,
    updatedAt: now,
  };

  const nextList = [...current];
  if (existingIndex >= 0) {
    nextList[existingIndex] = updated;
  } else {
    nextList.unshift(updated);
  }

  const storedList: StoredCredential[] = nextList.map((item) => ({
    id: item.id,
    url: item.url,
    username: item.username,
    encPassword: encryptSecret(item.password),
    notes: item.notes,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }));

  try {
    fs.writeFileSync(passwordsFile(), JSON.stringify(storedList, null, 2));
  } catch (err) {
    console.error('[drift] failed to save passwords', err);
  }
  return updated;
}

export function deletePasswordEntry(id: string): boolean {
  const current = loadPasswords();
  const filtered = current.filter((x) => x.id !== id);
  if (filtered.length === current.length) return false;
  const storedList: StoredCredential[] = filtered.map((item) => ({
    id: item.id,
    url: item.url,
    username: item.username,
    encPassword: encryptSecret(item.password),
    notes: item.notes,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }));
  try {
    fs.writeFileSync(passwordsFile(), JSON.stringify(storedList, null, 2));
    return true;
  } catch (err) {
    console.error('[drift] failed to delete password', err);
    return false;
  }
}

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
