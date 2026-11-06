import { en, type MessageKey, type Messages } from './locales/en';
import { he } from './locales/he';

export type { MessageKey, Messages };
export type Vars = Record<string, string | number>;
export type Translate = (key: MessageKey, vars?: Vars) => string;

/** Shipped with Drift. Everything else is downloaded from the project's locales/ folder. */
export const BUILT_IN: Record<string, { name: string; native: string; messages: Messages }> = {
  en: { name: 'English', native: 'English', messages: en },
  he: { name: 'Hebrew', native: 'עברית', messages: he },
};

export const RTL = new Set(['he', 'ar', 'fa', 'ur', 'yi', 'ps', 'sd', 'ckb', 'dv']);

/** Language packs live in the repo; Drift downloads them on demand. */
export const LOCALES_URL = 'https://raw.githubusercontent.com/dor2500/drift-browser/main/locales/';

export interface LanguageInfo {
  code: string;
  name: string;
  native: string;
  builtIn: boolean;
  installed: boolean;
}

export interface LocaleBundle {
  /** Resolved language code ("auto" already applied). */
  code: string;
  dir: 'ltr' | 'rtl';
  messages: Messages;
  /** The system language, for the "Same as the system" option. */
  system: string;
}

export function translate(messages: Messages, key: MessageKey, vars?: Vars): string {
  let s: string = messages[key] ?? en[key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k: string) => (vars[k] !== undefined ? String(vars[k]) : m));
  return s;
}

/** Keeps only known keys with string values, so a downloaded pack can't inject anything else. */
export function sanitizeMessages(raw: unknown): Messages {
  const out: Messages = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (k in en && typeof v === 'string' && v.length < 2000) out[k as MessageKey] = v;
  }
  return out;
}
