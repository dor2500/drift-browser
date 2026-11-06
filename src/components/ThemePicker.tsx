import type { ThemeId } from '../../shared/settings';
import { THEMES, THEME_ORDER } from '../../shared/themes';
import type { DriftEnv } from '../../shared/types';
import { cmd, cx } from '../lib';
import { Icon } from './Icon';

/** Theme cards with a tiny mock of the browser in each style. Picking one applies it live. */
export function ThemePicker({ value, env }: { value: ThemeId; env?: DriftEnv }) {
  return (
    <div className="theme-grid">
      {THEME_ORDER.map((id) => {
        const t = THEMES[id];
        const p = t.preview;
        const installed = env?.browsers[id];
        return (
          <button
            key={id}
            className={cx('theme-card', value === id && 'selected')}
            onClick={() => cmd({ type: 'settings:set', patch: { theme: id, spaceColors: t.spaceColors, verticalTabs: t.verticalTabs } })}
          >
            <div className={cx('theme-preview', !t.verticalTabs && 'top-tabs')} style={{ background: p.window }}>
              <div className="tp-sidebar" style={{ background: p.sidebar }}>
                <i style={{ background: p.tab }} />
                <i style={{ background: p.text, opacity: 0.18 }} />
                <i style={{ background: p.text, opacity: 0.18 }} />
              </div>
              <div
                className="tp-page"
                style={{ background: p.surface, borderRadius: t.contentRadius, margin: t.contentRadius ? 5 : 0, marginLeft: 0 }}
              >
                <i style={{ background: t.accent }} />
              </div>
            </div>
            <div className="theme-meta">
              <div className="theme-name">
                {t.name}
                {value === id && <Icon name="check" size={14} />}
              </div>
              <div className="theme-tagline">{t.tagline}</div>
              <div className={cx('theme-source', installed && 'installed')}>
                {installed ? 'Installed on this PC · ' : ''}
                {t.source}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
