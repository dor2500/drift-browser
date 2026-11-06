import { useState } from 'react';
import { hostOf, permissionLabel } from '../../shared/permissions';
import type { PermissionPrompt } from '../../shared/types';
import { cmd } from '../lib';
import { Icon, type IconName } from './Icon';

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
        <span className="perm-site">{hostOf(prompt.origin)}</span> wants to
      </div>
      <ul className="perm-list">
        {prompt.kinds.map((k) => (
          <li key={k}>
            <Icon name={iconForPermission(k)} size={15} />
            {permissionLabel(k)}
          </li>
        ))}
      </ul>
      <label className="perm-remember">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
        Remember for this site
      </label>
      <div className="perm-actions">
        <button className="perm-btn" onClick={() => respond(false)}>
          Block
        </button>
        <button className="perm-btn primary" onClick={() => respond(true)} autoFocus>
          Allow
        </button>
      </div>
      {extra > 0 && <div className="perm-more">+{extra} more waiting</div>}
    </div>
  );
}
