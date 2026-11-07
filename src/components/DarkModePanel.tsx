import type { DarkModeSettings } from '../../shared/settings';
import { darkModeActions } from '../lib';
import { useT } from '../i18n';
import { Icon } from './Icon';

function hostFromUrl(url?: string): string {
  if (!url || !/^https?:/i.test(url)) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

export function DarkModePanel({
  darkMode,
  activeUrl,
  onClose,
}: {
  darkMode: DarkModeSettings;
  activeUrl?: string;
  onClose?: () => void;
}) {
  const { t } = useT();
  const host = hostFromUrl(activeUrl);
  const isDisabledForSite = !!host && darkMode.disabledHosts.includes(host);
  const isForcedForSite = !!host && darkMode.forcedHosts.includes(host);
  const siteDarkActive = darkMode.enabled ? !isDisabledForSite : isForcedForSite;

  return (
    <div className="dm-panel">
      <div className="dm-head">
        <div className="dm-title">
          <Icon name="moon" size={16} />
          <div>
            <div className="dm-title-text">{t('dm.title')}</div>
            <div className="dm-sub-text">{t('dm.subtitle')}</div>
          </div>
        </div>
        {onClose && (
          <button className="tb-btn" onClick={onClose} title={t('win.close')}>
            <Icon name="x" size={14} />
          </button>
        )}
      </div>

      {/* Global Dark Mode Switch */}
      <div className="dm-row">
        <div>
          <div className="set-label">{t('dm.enabled')}</div>
          <div className="set-hint">Applies live to all open tabs without restarting</div>
        </div>
        <button
          role="switch"
          aria-checked={darkMode.enabled}
          className={`switch ${darkMode.enabled ? 'is-on' : ''}`}
          onClick={() => darkModeActions.update({ enabled: !darkMode.enabled })}
        >
          <span />
        </button>
      </div>

      {/* Per-Site Quick Toggle */}
      {host && (
        <div className="dm-site-box">
          <div className="dm-site-info">
            <Icon name="globe" size={14} />
            <span className="dm-site-host">{host}</span>
            <span className={`dm-site-badge ${siteDarkActive ? 'is-on' : ''}`}>
              {siteDarkActive ? 'Dark Active' : 'Light / Original'}
            </span>
          </div>
          <button
            className={`set-action ${siteDarkActive ? 'is-primary' : ''}`}
            onClick={() => darkModeActions.toggleForHost(host)}
          >
            {siteDarkActive ? 'Disable for this site' : 'Force Dark on this site'}
          </button>
        </div>
      )}

      {/* Rendering Mode */}
      <div className="dm-row">
        <div className="set-label">Rendering Engine Mode</div>
        <select
          className="set-select"
          value={darkMode.mode}
          onChange={(e) =>
            darkModeActions.update({ mode: e.target.value as DarkModeSettings['mode'] })
          }
        >
          <option value="smart">{t('dm.mode.smart')}</option>
          <option value="filter">{t('dm.mode.filter')}</option>
          <option value="chromium">{t('dm.mode.chromium')}</option>
        </select>
      </div>

      {/* Sliders: Brightness, Contrast, Sepia, Grayscale */}
      <div className="dm-sliders">
        <div className="dm-slider-row">
          <div className="dm-slider-head">
            <span>{t('dm.brightness')}</span>
            <span>{darkMode.brightness}%</span>
          </div>
          <input
            type="range"
            min={50}
            max={150}
            value={darkMode.brightness}
            onChange={(e) => darkModeActions.update({ brightness: Number(e.target.value) })}
          />
        </div>

        <div className="dm-slider-row">
          <div className="dm-slider-head">
            <span>{t('dm.contrast')}</span>
            <span>{darkMode.contrast}%</span>
          </div>
          <input
            type="range"
            min={50}
            max={150}
            value={darkMode.contrast}
            onChange={(e) => darkModeActions.update({ contrast: Number(e.target.value) })}
          />
        </div>

        <div className="dm-slider-row">
          <div className="dm-slider-head">
            <span>{t('dm.sepia')}</span>
            <span>{darkMode.sepia}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={darkMode.sepia}
            onChange={(e) => darkModeActions.update({ sepia: Number(e.target.value) })}
          />
        </div>

        <div className="dm-slider-row">
          <div className="dm-slider-head">
            <span>{t('dm.grayscale')}</span>
            <span>{darkMode.grayscale}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={darkMode.grayscale}
            onChange={(e) => darkModeActions.update({ grayscale: Number(e.target.value) })}
          />
        </div>

        <div className="dm-slider-actions">
          <button className="set-link" onClick={() => darkModeActions.resetFilters()}>
            Reset colour filters to default
          </button>
        </div>
      </div>

      {/* Per-site exception chips */}
      {(darkMode.disabledHosts.length > 0 || darkMode.forcedHosts.length > 0) && (
        <div className="dm-exceptions">
          {darkMode.disabledHosts.length > 0 && (
            <div className="dm-exc-group">
              <div className="set-hint">Excluded sites (always original theme):</div>
              <div className="set-chips">
                {darkMode.disabledHosts.map((h) => (
                  <button
                    key={h}
                    className="set-chip"
                    onClick={() =>
                      darkModeActions.update({
                        disabledHosts: darkMode.disabledHosts.filter((x) => x !== h),
                      })
                    }
                  >
                    <span>{h}</span>
                    <Icon name="x" size={11} />
                  </button>
                ))}
              </div>
            </div>
          )}
          {darkMode.forcedHosts.length > 0 && (
            <div className="dm-exc-group">
              <div className="set-hint">Forced dark sites:</div>
              <div className="set-chips">
                {darkMode.forcedHosts.map((h) => (
                  <button
                    key={h}
                    className="set-chip"
                    onClick={() =>
                      darkModeActions.update({
                        forcedHosts: darkMode.forcedHosts.filter((x) => x !== h),
                      })
                    }
                  >
                    <span>{h}</span>
                    <Icon name="x" size={11} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

