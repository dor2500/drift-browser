import { app, safeStorage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { AutofillData, CredentialEntry, SavedAddress, SavedCreditCard, SavedSession, SpaceState, SplitState, TabGroup, TabState } from '../shared/types';

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

const extensionsFile = () => path.join(app.getPath('userData'), 'extensions.json');

export interface StoredExtension {
  id: string;
  name: string;
  version: string;
  path: string;
  enabled: boolean;
  description?: string;
  allowIncognito?: boolean;
  allowFileAccess?: boolean;
  siteAccess?: 'all' | 'onclick' | 'specific';
  specificSites?: string[];
  permissions?: string[];
}

export function loadStoredExtensions(): StoredExtension[] {
  try {
    const raw = fs.readFileSync(extensionsFile(), 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function saveStoredExtensions(list: StoredExtension[]): void {
  try {
    fs.writeFileSync(extensionsFile(), JSON.stringify(list, null, 2));
  } catch (err) {
    console.error('[drift] failed to save extensions', err);
  }
}

const autofillFile = () => path.join(app.getPath('userData'), 'autofill.json');

interface StoredCreditCard {
  id: string;
  nameOnCard: string;
  encCardNumber: string;
  lastFour: string;
  expMonth: string;
  expYear: string;
  nickname?: string;
  brand: 'visa' | 'mastercard' | 'amex' | 'discover' | 'generic';
  createdAt: number;
}

interface StoredAutofill {
  cards: StoredCreditCard[];
  addresses: SavedAddress[];
}

function detectCardBrand(num: string): 'visa' | 'mastercard' | 'amex' | 'discover' | 'generic' {
  const clean = num.replace(/\D/g, '');
  if (/^4/.test(clean)) return 'visa';
  if (/^(5[1-5]|222[1-9]|22[3-9]|2[3-6]|27[01]|2720)/.test(clean)) return 'mastercard';
  if (/^3[47]/.test(clean)) return 'amex';
  if (/^(6011|65|64[4-9]|622)/.test(clean)) return 'discover';
  return 'generic';
}

function readStoredAutofill(): StoredAutofill {
  try {
    const raw = fs.readFileSync(autofillFile(), 'utf8');
    const data = JSON.parse(raw);
    return {
      cards: Array.isArray(data?.cards) ? data.cards : [],
      addresses: Array.isArray(data?.addresses) ? data.addresses : [],
    };
  } catch {
    return { cards: [], addresses: [] };
  }
}

function writeStoredAutofill(data: StoredAutofill): void {
  try {
    fs.writeFileSync(autofillFile(), JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('[drift] failed to save autofill data', err);
  }
}

export function loadAutofillData(): AutofillData {
  const stored = readStoredAutofill();
  const decryptedCards: SavedCreditCard[] = stored.cards.map((c) => {
    const dec = decryptSecret(c.encCardNumber);
    return {
      id: c.id,
      nameOnCard: c.nameOnCard,
      cardNumber: dec,
      lastFour: c.lastFour,
      expMonth: c.expMonth,
      expYear: c.expYear,
      nickname: c.nickname,
      brand: c.brand,
      createdAt: c.createdAt,
    };
  });
  return {
    cards: decryptedCards,
    addresses: stored.addresses,
  };
}

export function saveCreditCard(card: Omit<SavedCreditCard, 'id' | 'createdAt' | 'lastFour' | 'brand'> & { id?: string }): SavedCreditCard {
  const stored = readStoredAutofill();
  const cleanNum = card.cardNumber.replace(/\D/g, '');
  const lastFour = cleanNum.slice(-4) || '••••';
  const brand = detectCardBrand(cleanNum);
  const now = Date.now();
  const id = card.id || String(now);

  const encCardNumber = encryptSecret(cleanNum);
  const newStoredCard: StoredCreditCard = {
    id,
    nameOnCard: card.nameOnCard,
    encCardNumber,
    lastFour,
    expMonth: card.expMonth,
    expYear: card.expYear,
    nickname: card.nickname,
    brand,
    createdAt: now,
  };

  const updatedCards = stored.cards.filter((c) => c.id !== id);
  updatedCards.push(newStoredCard);
  writeStoredAutofill({ ...stored, cards: updatedCards });

  return {
    id,
    nameOnCard: card.nameOnCard,
    cardNumber: cleanNum,
    lastFour,
    expMonth: card.expMonth,
    expYear: card.expYear,
    nickname: card.nickname,
    brand,
    createdAt: now,
  };
}

export function deleteCreditCard(id: string): boolean {
  const stored = readStoredAutofill();
  const nextCards = stored.cards.filter((c) => c.id !== id);
  writeStoredAutofill({ ...stored, cards: nextCards });
  return true;
}

export function saveAddress(addr: Omit<SavedAddress, 'id' | 'createdAt'> & { id?: string }): SavedAddress {
  const stored = readStoredAutofill();
  const now = Date.now();
  const id = addr.id || String(now);

  const newAddr: SavedAddress = {
    id,
    fullName: addr.fullName,
    company: addr.company,
    streetAddress: addr.streetAddress,
    city: addr.city,
    stateProvince: addr.stateProvince,
    postalCode: addr.postalCode,
    country: addr.country,
    phone: addr.phone,
    email: addr.email,
    createdAt: now,
  };

  const updatedAddrs = stored.addresses.filter((a) => a.id !== id);
  updatedAddrs.push(newAddr);
  writeStoredAutofill({ ...stored, addresses: updatedAddrs });

  return newAddr;
}

export function deleteAddress(id: string): boolean {
  const stored = readStoredAutofill();
  const nextAddrs = stored.addresses.filter((a) => a.id !== id);
  writeStoredAutofill({ ...stored, addresses: nextAddrs });
  return true;
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
