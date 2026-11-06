import { useEffect, useState } from 'react';
import type { LanguageInfo } from '../../shared/i18n';
import { cmd, cx } from '../lib';
import { t } from '../i18n';
import { Icon } from './Icon';

/** English and Hebrew are built in; other languages download from the project on demand. */
export function LanguagePicker({ value, system }: { value: string; system: string }) {
  const [list, setList] = useState<LanguageInfo[] | null>(null);
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = () =>
    void window.drift.languages().then((r) => {
      setList(r.languages);
      setOffline(r.offline);
    });
  useEffect(refresh, []);

  const choose = async (l: LanguageInfo) => {
    if (!l.installed) {
      setBusy(l.code);
      const ok = await window.drift.installLanguage(l.code);
      setBusy(null);
      if (!ok) return;
      refresh();
    }
    cmd({ type: 'settings:set', patch: { language: l.code } });
  };

  const systemName = list?.find((l) => l.code === system)?.native ?? system;

  return (
    <div className="language-picker">
      <p className="settings-lead">{t('set.languageHint')}</p>
      <div className="lang-grid">
        <button className={cx('lang-option', value === 'auto' && 'selected')} onClick={() => cmd({ type: 'settings:set', patch: { language: 'auto' } })}>
          <span className="lang-native">{t('set.languageAuto', { name: systemName })}</span>
          {value === 'auto' && <Icon name="check" size={14} />}
        </button>
        {(list ?? []).map((l) => (
          <button key={l.code} className={cx('lang-option', value === l.code && 'selected')} disabled={busy !== null} onClick={() => void choose(l)}>
            <span className="lang-native">{l.native}</span>
            <span className="lang-meta">
              {busy === l.code
                ? t('set.languageDownloading')
                : l.builtIn
                  ? t('set.languageBuiltIn')
                  : l.installed
                    ? t('set.languageInstalled')
                    : (
                      <>
                        <Icon name="download" size={12} /> {t('set.languageDownload')}
                      </>
                    )}
            </span>
            {value === l.code && <Icon name="check" size={14} />}
          </button>
        ))}
      </div>
      {offline && <p className="settings-lead">{t('set.languageOffline')}</p>}
    </div>
  );
}
