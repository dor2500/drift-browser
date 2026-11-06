import { useEffect, useReducer } from 'react';
import { translate, type LocaleBundle, type MessageKey, type Vars } from '../shared/i18n';

let current: LocaleBundle = { code: 'en', dir: 'ltr', messages: {}, system: 'en' };
const listeners = new Set<() => void>();

/** Apply a language: strings, <html lang> and right-to-left layout. */
export function setLocale(bundle: LocaleBundle) {
  current = bundle;
  document.documentElement.lang = bundle.code;
  document.documentElement.dir = bundle.dir;
  listeners.forEach((l) => l());
}

export async function loadLocale() {
  setLocale(await window.drift.locale());
}

export const t = (key: MessageKey, vars?: Vars) => translate(current.messages, key, vars);

/** Re-render when the language changes. App calls this once at the top. */
export function useLocale() {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    listeners.add(force);
    return () => {
      listeners.delete(force);
    };
  }, []);
  return current;
}
