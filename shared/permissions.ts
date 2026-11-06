import { en } from './locales/en';
import type { MessageKey, Translate } from './i18n';

// A permission "kind" is what gets remembered per site: usually Electron's
// permission name, with media split into camera and microphone and
// external-app links kept per protocol ("openExternal:mailto").

const known = (key: string): key is MessageKey => key in en;

export function permissionLabel(kind: string, t: Translate): string {
  if (kind.startsWith('openExternal:')) return t('perm.openExternal', { protocol: kind.slice('openExternal:'.length) });
  const key = `perm.${kind}`;
  return known(key) ? t(key) : kind;
}

export function permissionShortName(kind: string, t: Translate): string {
  if (kind.startsWith('openExternal:')) return t('permShort.openExternal', { protocol: kind.slice('openExternal:'.length) });
  const key = `permShort.${kind}`;
  return known(key) ? t(key) : kind;
}

export function hostOf(origin: string): string {
  try {
    return new URL(origin).host || origin;
  } catch {
    return origin;
  }
}
