import { useEffect, useState } from 'react';
import type { ImportBrowser, ImportResult, ImportSource } from '../../shared/types';
import { cx } from '../lib';
import { Icon } from './Icon';
import { Toggle } from './UpdatePanels';
import { t } from '../i18n';

/** Import from browsers found on this PC. Used in first-run setup and in Settings. */
export function ImportPanel() {
  const [sources, setSources] = useState<ImportSource[] | null>(null);
  const [busy, setBusy] = useState<ImportBrowser | null>(null);
  const [results, setResults] = useState<Partial<Record<ImportBrowser, ImportResult>>>({});
  const [pinBar, setPinBar] = useState(true);
  const [zenSpaces, setZenSpaces] = useState(true);

  useEffect(() => void window.drift.importSources().then(setSources), []);

  const run = async (id: ImportBrowser) => {
    setBusy(id);
    const r = await window.drift.runImport(id, { bookmarksAsPinned: pinBar, zenSpaces });
    setResults((x) => ({ ...x, [id]: r }));
    setBusy(null);
  };

  if (sources === null) return <div className="empty-note">{t('imp.looking')}</div>;
  if (sources.length === 0) return <div className="empty-note">{t('imp.none')}</div>;

  return (
    <div className="import-panel">
      <div className="source-list">
        {sources.map((s) => {
          const r = results[s.id];
          return (
            <div key={s.id} className={cx('source-option', 'import-row', r && !r.error && 'selected')}>
              <span className="source-text">
                <span className="source-title">{s.name}</span>
                <span className="source-body">
                  {s.hasSpaces ? t('imp.zenBody') : t('imp.body')}
                </span>
                {r && (
                  <span className={cx('import-result', r.error && 'error')}>
                    {r.error
                      ? r.error
                      : [
                          r.spaces && t('imp.spaces', { count: r.spaces }),
                          r.essentials && t('imp.essentials', { count: r.essentials }),
                          r.pinned && t('imp.pinned', { count: r.pinned }),
                          r.tabs && t('imp.tabs', { count: r.tabs }),
                          t('imp.bookmarks', { count: r.bookmarks }),
                          t('imp.history', { count: r.history }),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                  </span>
                )}
              </span>
              <button className={cx('btn', !r && 'primary')} disabled={busy !== null} onClick={() => void run(s.id)}>
                {busy === s.id ? t('imp.importing') : r && !r.error ? (
                  <>
                    <Icon name="check" size={14} /> {t('imp.again')}
                  </>
                ) : (
                  <>
                    <Icon name="import" size={14} /> {t('imp.import')}
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
      {sources.some((s) => s.hasSpaces) && (
        <Toggle checked={zenSpaces} onChange={setZenSpaces} label={t('imp.zenSpaces')} hint={t('imp.zenSpacesHint')} />
      )}
      {sources.some((s) => !s.hasSpaces) && (
        <Toggle
          checked={pinBar}
          onChange={setPinBar}
          label={t('imp.pinBar')}
          hint={t('imp.pinBarHint')}
        />
      )}
      <p className="settings-lead">{t('imp.privacy')}</p>
    </div>
  );
}
