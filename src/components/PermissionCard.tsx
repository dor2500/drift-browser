import { useState } from 'react';
import { hostOf, permissionLabel } from '../../shared/permissions';
import type { PermissionPrompt } from '../../shared/types';
import { cmd } from '../lib';
import { Icon, type IconName } from './Icon';
import { t } from '../i18n';

export function iconForPermission(kind: string): IconName {
  if (kind === 'camera') return 'camera';
  if (kind === 'microphone') return 'mic';
  if (kind === 'geolocation') return 'location';
  if (kind === 'notifications') return 'bell';
  return 'shield';
}

/**
 * A permission request, shown in the sidebar under the URL pill. It lives in
 * the sidebar because HTML can't be drawn over the native page.
 */
export function PermissionCard({ prompt, extra }: { prompt: PermissionPrompt; extra: number }) {
  const [remember, setRemember] = useState(true);
  const respond = (allow: boolean) => cmd({ type: 'permission:respond', id: prompt.id, allow, remember });

  return (
    <div className="perm-card" role="alertdialog" aria-label={`${hostOf(prompt.origin)} permission request`}>
      <div className="perm-head">
        {t('perm.wantsTo', { site: '\u0000' }).split('\u0000').map((part, i) => (i === 0 ? part : [<span key="s" className="perm-site">{hostOf(prompt.origin)}</span>, part]))}
      </div>
      <ul className="perm-list">
        {prompt.kinds.map((k) => (
          <li key={k}>
            <Icon name={iconForPermission(k)} size={15} />
            {permissionLabel(k, t)}
          </li>
        ))}
      </ul>
      <label className="perm-remember">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
        {t('perm.remember')}
      </label>
      <div className="perm-actions">
        <button className="perm-btn" onClick={() => respond(false)}>
          {t('perm.block')}
        </button>
        <button className="perm-btn primary" onClick={() => respond(true)} autoFocus>
          {t('perm.allow')}
        </button>
      </div>
      {extra > 0 && <div className="perm-more">{t('perm.more', { count: extra })}</div>}
    </div>
  );
}
