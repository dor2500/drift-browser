import { useEffect, useState } from 'react';
import { t } from '../i18n';
import { cmd, cx } from '../lib';
import { Icon } from './Icon';

type Gecko = { available: boolean; version?: string; error?: string };

/** Chromium (built in) or Embedded Gecko Runtime applied directly inside Drift Browser. */
export function EnginePicker({ engine, chromium }: { engine: 'chromium' | 'gecko'; chromium: string }) {
  const [gecko, setGecko] = useState<Gecko>();
  const [busy, setBusy] = useState(false);
  useEffect(() => void window.drift.geckoStatus().then(setGecko), [engine]);

  const download = async () => {
    setBusy(true);
    const res = await window.drift.downloadGecko();
    setGecko(res);
    setBusy(false);
  };

  const switchToGecko = async () => {
    if (!gecko?.available) {
      await download();
    }
    cmd({ type: 'engine:switch', engine: 'gecko' });
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
          {engine !== 'chromium' && (
            <div className="engine-actions">
              <button className="btn primary" onClick={() => cmd({ type: 'engine:switch', engine: 'chromium' })}>
                {t('eng.switchChromium')}
              </button>
            </div>
          )}
        </div>
        <div className={cx('engine-option', engine === 'gecko' && 'selected')}>
          <div className="engine-head">
            <Icon name="fox" size={20} />
            <span className="source-title">{t('eng.gecko')}</span>
            {engine === 'gecko' && <span className="engine-badge">{t('eng.inUse')}</span>}
          </div>
          <span className="source-body">{t('eng.geckoBody')}</span>
          <span className="source-body">
            {gecko?.available ? t('eng.geckoReady', { version: gecko.version ?? '' }) : gecko ? t('eng.geckoMissing') : ''}
          </span>
          {gecko?.error && <span className="import-result error">{gecko.error}</span>}
          <div className="engine-actions">
            {gecko && !gecko.available && (
              <button className="btn" disabled={busy} onClick={() => void download()}>
                <Icon name="download" size={14} /> {busy ? t('eng.downloading') : t('eng.download')}
              </button>
            )}
            {gecko?.available && engine !== 'gecko' && (
              <button className="btn primary" disabled={busy} onClick={() => void switchToGecko()}>
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
