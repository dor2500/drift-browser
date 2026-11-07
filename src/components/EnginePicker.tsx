import { useEffect, useState } from 'react';
import { t } from '../i18n';
import { cmd, cx } from '../lib';
import { Icon } from './Icon';

type Gecko = { available: boolean; kind?: 'installed' | 'downloaded'; error?: string };

/** Chromium (built in) or Gecko (Firefox engine with a Drift-managed, hardened profile). */
export function EnginePicker({ engine, chromium }: { engine: 'chromium' | 'gecko'; chromium: string }) {
  const [gecko, setGecko] = useState<Gecko>();
  const [busy, setBusy] = useState(false);
  useEffect(() => void window.drift.geckoStatus().then(setGecko), []);

  const download = async () => {
    setBusy(true);
    setGecko(await window.drift.downloadGecko());
    setBusy(false);
  };

  return (
    <div className="engine-picker">
      <p className="settings-lead">{t('eng.lead')}</p>
      <div className="engine-options">
        <div className={cx('engine-option', engine === 'chromium' && 'selected')}>
          <div className="engine-head">
            <Icon name="globe" size={20} />
            <span className="source-title">{t('eng.chromium')}</span>
            {engine === 'chromium' && <span className="engine-badge">{t('eng.inUse')}</span>}
          </div>
          <span className="source-body">{t('eng.chromiumBody', { version: chromium })}</span>
        </div>
        <div className={cx('engine-option', engine === 'gecko' && 'selected')}>
          <div className="engine-head">
            <Icon name="fox" size={20} />
            <span className="source-title">{t('eng.gecko')}</span>
          </div>
          <span className="source-body">{t('eng.geckoBody')}</span>
          <span className="source-body">
            {gecko?.available ? (gecko.kind === 'downloaded' ? t('eng.geckoDownloaded') : t('eng.geckoInstalled')) : gecko ? t('eng.geckoMissing') : ''}
          </span>
          {gecko?.error && <span className="import-result error">{gecko.error}</span>}
          <div className="engine-actions">
            {gecko && !gecko.available && (
              <button className="btn" disabled={busy} onClick={() => void download()}>
                <Icon name="download" size={14} /> {busy ? t('eng.downloading') : t('eng.download')}
              </button>
            )}
            {gecko?.available && (
              <button className="btn primary" onClick={() => cmd({ type: 'engine:switch', engine: 'gecko' })}>
                {t('eng.switch')}
              </button>
            )}
          </div>
          {gecko?.available && <span className="toggle-hint">{t('eng.switchHint')}</span>}
        </div>
      </div>
    </div>
  );
}
