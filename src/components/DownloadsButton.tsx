import type { DownloadInfo } from '../../shared/types';
import { cmd, cx } from '../lib';
import { Icon } from './Icon';

/** Shows overall download progress; opens the downloads hub (Ctrl+J). */
export function DownloadsButton({ downloads, className }: { downloads: DownloadInfo[]; className: string }) {
  if (downloads.length === 0) return null;
  const active = downloads.filter((d) => d.state === 'progressing');
  const total = active.reduce((n, d) => n + d.total, 0);
  const got = active.reduce((n, d) => n + d.received, 0);
  const pct = active.length && total > 0 ? got / total : 0;
  return (
    <button
      className={cx(className, 'downloads-btn', active.length > 0 && 'busy')}
      title="הורדות · Downloads (Ctrl+J)"
      onClick={() => cmd({ type: 'downloads:open' })}
      onContextMenu={(e) => {
        e.preventDefault();
        window.drift.downloadsMenu();
      }}
    >
      <Icon name="download" size={15} />
      {active.length > 0 && (
        <svg className="dl-ring" viewBox="0 0 36 36" aria-hidden>
          <circle cx="18" cy="18" r="16" pathLength="100" strokeDasharray={`${Math.max(4, pct * 100)} 100`} />
        </svg>
      )}
    </button>
  );
}
