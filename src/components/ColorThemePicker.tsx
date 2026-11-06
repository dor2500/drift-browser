import { COLOR_THEMES } from '../../shared/colorThemes';
import type { Settings } from '../../shared/settings';
import { t } from '../i18n';
import { cmd, cx } from '../lib';
import { Icon } from './Icon';

/** Colour themes (Ocean, Nord, Dracula…) layered on the chosen browser style, plus a custom accent. */
export function ColorThemePicker({ settings, compact = false }: { settings: Settings; compact?: boolean }) {
  const set = (colorTheme: string) => cmd({ type: 'settings:set', patch: { colorTheme, ...(colorTheme !== 'default' ? { spaceColors: false } : {}) } });
  return (
    <div className="color-themes">
      <div className="swatch-grid">
        <button className={cx('swatch', settings.colorTheme === 'default' && 'selected')} onClick={() => set('default')} title={t('set.themeDefault')}>
          <span className="swatch-chip default" />
          <span className="swatch-name">{t('set.themeDefault')}</span>
        </button>
        {COLOR_THEMES.map((c) => (
          <button key={c.id} className={cx('swatch', settings.colorTheme === c.id && 'selected')} onClick={() => set(c.id)} title={c.name}>
            <span className="swatch-chip" style={{ background: `linear-gradient(135deg, ${c.bg} 0 55%, ${c.surface} 55% 100%)` }}>
              <i style={{ background: c.accent }} />
            </span>
            <span className="swatch-name">{c.name}</span>
            {settings.colorTheme === c.id && <Icon name="check" size={12} />}
          </button>
        ))}
      </div>
      {!compact && (
        <div className="accent-row">
          <label className="accent-pick">
            <input
              type="color"
              value={settings.customAccent || '#8aa4ff'}
              onChange={(e) => cmd({ type: 'settings:set', patch: { customAccent: e.target.value, spaceColors: false } })}
            />
            {t('set.customAccent')}
          </label>
          {settings.customAccent && (
            <button className="btn small ghost" onClick={() => cmd({ type: 'settings:set', patch: { customAccent: '' } })}>
              {t('set.customAccentReset')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
