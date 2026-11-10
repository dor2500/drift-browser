import { useEffect, useRef, useState } from 'react';
import type { DownloadInfo } from '../../shared/types';
import { cmd, cx } from '../lib';
import { Icon } from './Icon';

function formatBytes(bytes: number) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/** Shows overall download progress and quick floating Chrome Download Bubble flyout (Ctrl+J). */
export function DownloadsButton({ downloads, className }: { downloads: DownloadInfo[]; className: string }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', handleDown);
    return () => window.removeEventListener('mousedown', handleDown);
  }, [open]);

  if (downloads.length === 0) return null;
  const active = downloads.filter((d) => d.state === 'progressing');
  const total = active.reduce((n, d) => n + d.total, 0);
  const got = active.reduce((n, d) => n + d.received, 0);
  const pct = active.length && total > 0 ? got / total : 0;
  const recent = downloads.slice(-4).reverse();

  return (
    <div className="downloads-btn-wrap" ref={containerRef}>
      <button
        className={cx(className, 'downloads-btn', active.length > 0 && 'busy', open && 'active')}
        title="הורדות אחרונות · Downloads (Ctrl+J)"
        onClick={() => setOpen((o) => !o)}
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

      {open && (
        <div className="downloads-bubble-flyout" dir="rtl">
          <div className="bubble-header">
            <span className="bubble-title">הורדות אחרונות (Downloads)</span>
            <button className="bubble-close-btn" onClick={() => setOpen(false)} title="סגור חלונית">
              <Icon name="x" size={13} />
            </button>
          </div>

          <div className="bubble-list">
            {recent.map((d) => {
              const isProgressing = d.state === 'progressing';
              const isCompleted = d.state === 'completed';
              const progressPct = d.total > 0 ? Math.round((d.received / d.total) * 100) : 0;

              return (
                <div key={d.id} className="bubble-item">
                  <div className="bubble-item-icon">
                    <Icon name="download" size={16} />
                  </div>
                  <div className="bubble-item-content">
                    <div className="bubble-item-name" title={d.filename}>
                      {d.filename}
                    </div>
                    <div className="bubble-item-sub">
                      {isProgressing ? (
                        <span>{formatBytes(d.received)} מתוך {formatBytes(d.total)} ({progressPct}%)</span>
                      ) : isCompleted ? (
                        <span className="bubble-status-completed">
                          <Icon name="check" size={11} /> {formatBytes(d.total || d.received)} · הושלם
                        </span>
                      ) : (
                        <span className="bubble-status-failed">נכשל / בוטל</span>
                      )}
                      {d.sha256 && (
                        <span className="bubble-sha-tag" title={`SHA-256: ${d.sha256}`}>
                          <Icon name="lock" size={10} /> SHA-256
                        </span>
                      )}
                    </div>
                    {isProgressing && (
                      <div className="bubble-prog-track">
                        <div className="bubble-prog-fill" style={{ width: `${progressPct}%` }} />
                      </div>
                    )}
                  </div>
                  <div className="bubble-item-actions">
                    {isCompleted && (
                      <>
                        <button
                          className="btn-bubble-action primary"
                          title="פתח קובץ זה"
                          onClick={() => cmd({ type: 'download:open', id: d.id })}
                        >
                          פתח
                        </button>
                        <button
                          className="btn-bubble-action"
                          title="הצג קובץ בתיקיית ההורדות"
                          onClick={() => cmd({ type: 'download:show', id: d.id })}
                        >
                          תיקייה
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bubble-footer">
            <button
              className="bubble-footer-btn"
              onClick={() => {
                setOpen(false);
                cmd({ type: 'downloads:open' });
              }}
            >
              הצג את כל ההורדות (Ctrl+J)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
