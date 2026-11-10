import { useMemo, useState } from 'react';
import type { BrowserState, DownloadInfo } from '../../shared/types';
import { cmd, cx } from '../lib';
import { Icon, type IconName } from './Icon';

interface Props {
  state: BrowserState;
}

export function DownloadsPage({ state }: Props) {
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const downloads = state.downloads || [];

  const handleCopyLink = (d: DownloadInfo) => {
    void navigator.clipboard.writeText(d.url);
    setCopiedId(d.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return downloads;
    return downloads.filter(
      (d) => d.filename.toLowerCase().includes(q) || d.url.toLowerCase().includes(q)
    );
  }, [downloads, search]);

  const formatSize = (bytes: number) => {
    if (bytes <= 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const totalBytes = useMemo(() => {
    return downloads.reduce((acc, d) => acc + (d.received || 0), 0);
  }, [downloads]);

  const activeCount = useMemo(() => {
    return downloads.filter((d) => d.state === 'progressing').length;
  }, [downloads]);

  const completedCount = useMemo(() => {
    return downloads.filter((d) => d.state === 'completed').length;
  }, [downloads]);

  const getFileCategory = (filename: string): { icon: IconName; color: string; label: string } => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
      return { icon: 'inbox', color: '#eab308', label: 'ארכיון (Archive)' };
    }
    if (['exe', 'msi', 'dmg', 'pkg', 'deb', 'rpm'].includes(ext)) {
      return { icon: 'bolt', color: '#ec4899', label: 'יישום / התקנה (App)' };
    }
    if (['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt'].includes(ext)) {
      return { icon: 'book', color: '#3b82f6', label: 'מסמך (Document)' };
    }
    if (['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(ext)) {
      return { icon: 'music', color: '#a855f7', label: 'אודיו (Audio)' };
    }
    if (['mp4', 'mkv', 'webm', 'mov', 'avi'].includes(ext)) {
      return { icon: 'play', color: '#ef4444', label: 'וידאו (Video)' };
    }
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) {
      return { icon: 'sparkles', color: '#10b981', label: 'תמונה (Image)' };
    }
    return { icon: 'download', color: '#06b6d4', label: 'קובץ (File)' };
  };

  const getDomain = (url: string) => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  };

  return (
    <div className="downloads-hub-page" dir="rtl">
      {/* Header Banner */}
      <header className="downloads-hub-header">
        <div className="downloads-header-left">
          <div className="downloads-header-icon">
            <Icon name="download" size={26} />
          </div>
          <div>
            <h1 className="downloads-title">מנהל ההורדות (Downloads Hub)</h1>
            <p className="downloads-subtitle">
              צפייה בהורדות, בדיקת קבצים והתקדמות בזמן אמת · Drift Smart Downloads Engine
            </p>
          </div>
        </div>

        <div className="downloads-header-actions">
          <button
            className="btn downloads-action-btn"
            onClick={() => cmd({ type: 'downloads:chooseFolder' })}
            title="בחר תיקיית הורדות"
          >
            <Icon name="folder" size={15} />
            <span>תיקיית הורדות</span>
          </button>
          <button
            className="btn downloads-action-btn"
            onClick={() => cmd({ type: 'tab:new', url: 'drift://settings#settings-downloads' })}
            title="הגדרות הורדה בכרום"
          >
            <Icon name="gear" size={15} />
            <span>הגדרות</span>
          </button>
          {downloads.length > 0 && (
            <button
              className="btn downloads-action-btn danger"
              onClick={() => cmd({ type: 'downloads:clear' })}
              title="נקה היסטוריית הורדות שהסתיימו"
            >
              <Icon name="trash" size={14} />
              <span>נקה רשימה</span>
            </button>
          )}
        </div>
      </header>

      {/* Stats Summary Bar */}
      <div className="downloads-stats-bar">
        <div className="download-stat-card">
          <span className="stat-label">סה"כ קבצים ברשימה</span>
          <span className="stat-value">{downloads.length}</span>
        </div>
        <div className="download-stat-card">
          <span className="stat-label">הורדות פעילות כעת</span>
          <span className={cx('stat-value', activeCount > 0 && 'pulse-text')}>
            {activeCount}
          </span>
        </div>
        <div className="download-stat-card">
          <span className="stat-label">הורדות שהושלמו</span>
          <span className="stat-value">{completedCount}</span>
        </div>
        <div className="download-stat-card">
          <span className="stat-label">נפח קבצים כולל</span>
          <span className="stat-value">{formatSize(totalBytes)}</span>
        </div>
      </div>

      {/* Search Input */}
      <div className="downloads-filter-strip">
        <div className="downloads-search-box">
          <Icon name="search" size={16} />
          <input
            type="text"
            className="downloads-search-input"
            placeholder="חפש בקבצים שהורדו לפי שם קובץ או אתר מקור... (Search Downloads)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="downloads-search-clear" onClick={() => setSearch('')}>
              <Icon name="x" size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Downloads List */}
      <div className="downloads-content-scroll">
        {filtered.length === 0 ? (
          <div className="downloads-empty-state">
            <Icon name="download" size={48} />
            <h3>{search ? 'לא נמצאו הורדות תואמות' : 'אין הורדות כרגע'}</h3>
            <p>
              {search
                ? 'בדוק את מילות החיפוש או נקה את שורת החיפוש לצפייה בכל הקבצים.'
                : 'קבצים שתוריד בזמן הגלישה יוצגו כאן עם מעקב מהירות, פתיחה ישירה והצגה בתיקייה.'}
            </p>
            {downloads.length === 0 && (
              <button
                className="btn small"
                onClick={() => cmd({ type: 'tab:new', url: 'drift://store' })}
              >
                בקר בחנות Drift Store
              </button>
            )}
          </div>
        ) : (
          <div className="downloads-cards-grid">
            {filtered.map((d) => {
              const fileType = getFileCategory(d.filename);
              const domain = getDomain(d.url);
              const percent =
                d.total > 0 ? Math.min(100, Math.round((d.received / d.total) * 100)) : 0;

              return (
                <div
                  key={d.id}
                  className={cx(
                    'download-item-card',
                    d.state === 'progressing' && 'in-progress',
                    d.state === 'completed' && 'completed',
                    (d.state === 'cancelled' || d.state === 'interrupted') && 'failed'
                  )}
                >
                  <div className="download-card-body">
                    <div
                      className="download-type-icon"
                      style={{ background: `${fileType.color}15`, color: fileType.color }}
                    >
                      <Icon name={fileType.icon} size={24} />
                    </div>

                    <div className="download-info">
                      <div className="download-title-row">
                        <button
                          className="download-filename-btn"
                          title={d.filename}
                          disabled={d.state !== 'completed'}
                          onClick={() => cmd({ type: 'download:open', id: d.id })}
                        >
                          {d.filename}
                        </button>
                        <span
                          className="download-category-badge"
                          style={{ borderColor: `${fileType.color}35`, color: fileType.color }}
                        >
                          {fileType.label}
                        </span>
                      </div>

                      <div className="download-url-row">
                        <span className="download-domain">{domain}</span>
                        <span className="download-dot">•</span>
                        <span className="download-timestamp">
                          {new Date(d.startedAt).toLocaleString('he-IL', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </span>
                      </div>

                      {/* Progress Bar for Active Downloads */}
                      {d.state === 'progressing' && (
                        <div className="download-progress-container">
                          <div className="download-progress-bar">
                            <div
                              className="download-progress-fill"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          <div className="download-progress-meta">
                            <span>
                              {formatSize(d.received)} {d.total > 0 ? `מתוך ${formatSize(d.total)}` : ''}
                            </span>
                            <span>{percent}%</span>
                          </div>
                        </div>
                      )}

                      {/* Completed / Failed Meta */}
                      {d.state !== 'progressing' && (
                        <div className="download-status-row">
                          {d.state === 'completed' && (
                            <span className="download-status-badge success">
                              <Icon name="check" size={13} />
                              הושלם ({formatSize(d.received)})
                            </span>
                          )}
                          {d.state === 'cancelled' && (
                            <span className="download-status-badge cancelled">
                              בוטל
                            </span>
                          )}
                          {d.state === 'interrupted' && (
                            <span className="download-status-badge error">
                              ההורדה הופסקה
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="download-card-actions">
                    {d.state === 'completed' && (
                      <button
                        className="btn small primary download-btn"
                        onClick={() => cmd({ type: 'download:open', id: d.id })}
                      >
                        <Icon name="play" size={13} />
                        פתח קובץ
                      </button>
                    )}
                    {d.state === 'progressing' && (
                      <button
                        className="btn small danger download-btn"
                        onClick={() => cmd({ type: 'download:cancel', id: d.id })}
                      >
                        <Icon name="x" size={13} />
                        בטל הורדה
                      </button>
                    )}
                    <button
                      className="btn small download-btn"
                      onClick={() => cmd({ type: 'download:show', id: d.id })}
                      title="הצג קובץ בסייר הקבצים"
                    >
                      <Icon name="folder" size={13} />
                      הצג בתיקייה
                    </button>
                    <button
                      className="btn small download-btn"
                      onClick={() => handleCopyLink(d)}
                      title="העתק כתובת קישור להורדה"
                    >
                      <Icon name={copiedId === d.id ? 'check' : 'copy'} size={13} />
                      {copiedId === d.id ? 'הועתק!' : 'העתק קישור'}
                    </button>
                    <button
                      className="btn small ghost-btn danger-hover"
                      onClick={() => cmd({ type: 'download:remove', id: d.id })}
                      title="הסר פריט זה מרשימת ההורדות"
                    >
                      <Icon name="trash" size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
