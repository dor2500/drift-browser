import { useEffect, useState } from 'react';
import { hostOf, permissionShortName } from '../../shared/permissions';
import { SEARCH_ENGINES, type SearchEngineId } from '../../shared/settings';
import type { BrowserState, DriftEnv, SitePermissions } from '../../shared/types';
import { cmd, cx } from '../lib';
import { Icon } from './Icon';
import { ImportPanel } from './ImportPanel';
import { ColorThemePicker } from './ColorThemePicker';
import { LanguagePicker } from './LanguagePicker';
import { ThemePicker } from './ThemePicker';
import { CommitInput, EngineCard, Toggle, UpdateSourceForm } from './UpdatePanels';
import { t, useLocale } from '../i18n';

const SECTIONS = ['appearance', 'language', 'general', 'privacy', 'import', 'updates', 'about'] as const;

/** drift://settings, drawn by the shell inside the content pane (no web view). */
export function SettingsPage({ state }: { state: BrowserState }) {
  const locale = useLocale();
  const [google, setGoogle] = useState(false);
  const [browsers, setBrowsers] = useState<{ id: string; name: string }[]>([]);
  // Force-dark only changes after a restart, so remember what this run started with.
  const [startDark] = useState(state.settings.forceDark);
  useEffect(() => {
    void window.drift.googleStatus().then(setGoogle);
    void window.drift.otherBrowsers().then(setBrowsers);
  }, [state.activeTabId]);
  const s = state.settings;
  const [env, setEnv] = useState<DriftEnv>();
  const [perms, setPerms] = useState<SitePermissions>({});
  const [section, setSection] = useState<string>('appearance');

  useEffect(() => void window.drift.env().then(setEnv), []);
  // Prompts answered elsewhere change the list, so re-read when they change.
  useEffect(() => void window.drift.sitePermissions().then(setPerms), [state.prompts.length]);

  const go = (id: string) => {
    setSection(id);
    document.getElementById(`settings-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const reset = async (origin: string, kind?: string) => {
    await window.drift.cmd({ type: 'permission:reset', origin, kind });
    setPerms(await window.drift.sitePermissions());
  };
  const sites = Object.entries(perms).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="settings-page">
      <nav className="settings-nav">
        <div className="settings-title">
          <Icon name="gear" size={18} /> {t('set.title')}
        </div>
        {SECTIONS.map((id) => (
          <button key={id} className={cx('settings-nav-item', section === id && 'active')} onClick={() => go(id)}>
            {t(`set.nav.${id}`)}
          </button>
        ))}
      </nav>

      <div className="settings-scroll">
        <section id="settings-appearance" className="settings-section">
          <h2>{t('set.nav.appearance')}</h2>
          <ThemePicker value={s.theme} env={env} />
          <h3>{t('set.colorTheme')}</h3>
          <p className="settings-lead">{t('set.colorThemeHint')}</p>
          <ColorThemePicker settings={s} />
          <Toggle
            checked={s.spaceColors}
            onChange={(spaceColors) => cmd({ type: 'settings:set', patch: { spaceColors } })}
            label={t('set.spaceColors')}
            hint={t('set.spaceColorsHint')}
          />
          <Toggle
            checked={s.verticalTabs}
            onChange={(verticalTabs) => cmd({ type: 'settings:set', patch: { verticalTabs } })}
            label={t('set.verticalTabs')}
            hint={t('set.verticalTabsHint')}
          />
          <Toggle
            checked={state.compact}
            onChange={(value) => cmd({ type: 'ui:compact', value })}
            label={t('set.compact')}
            hint={t('set.compactHint')}
          />
        </section>

        <section id="settings-language" className="settings-section">
          <h2>{t('set.nav.language')}</h2>
          <LanguagePicker value={s.language} system={locale.system} />
        </section>

        <section id="settings-general" className="settings-section">
          <h2>{t('set.nav.general')}</h2>
          <div className="field">
            <span className="field-label">{t('set.searchEngine')}</span>
            <select
              className="field-input"
              value={s.searchEngine}
              onChange={(e) => cmd({ type: 'settings:set', patch: { searchEngine: e.target.value as SearchEngineId } })}
            >
              {(Object.keys(SEARCH_ENGINES) as SearchEngineId[]).map((id) => (
                <option key={id} value={id}>
                  {SEARCH_ENGINES[id].name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <span className="field-label">{t('set.homePage')}</span>
            <CommitInput value={s.homePage} placeholder="https://…" onCommit={(homePage) => cmd({ type: 'settings:set', patch: { homePage } })} />
          </div>
          <div className="field">
            <span className="field-label">{t('set.sleep')}</span>
            <select className="field-input" value={s.sleepAfter} onChange={(e) => cmd({ type: 'settings:set', patch: { sleepAfter: Number(e.target.value) } })}>
              <option value={0}>{t('set.sleepOff')}</option>
              {[15, 30, 60, 120].map((n) => (
                <option key={n} value={n}>
                  {t('set.sleepMinutes', { n })}
                </option>
              ))}
            </select>
            <span className="toggle-hint">{t('set.sleepHint')}</span>
          </div>
          <Toggle
            checked={s.forceDark}
            onChange={(forceDark) => cmd({ type: 'settings:set', patch: { forceDark } })}
            label={t('set.forceDark')}
            hint={t('set.forceDarkHint')}
          />
          {s.forceDark !== startDark && (
            <button className="btn small" onClick={() => cmd({ type: 'app:restart' })}>
              {t('set.restartNow')}
            </button>
          )}
          <h3>{t('set.google')}</h3>
          <p className="settings-lead">{t('set.googleHint')}</p>
          <div className="google-row">
            {google ? (
              <>
                <span className="google-ok">
                  <Icon name="check" size={14} /> {t('set.googleSignedIn')}
                </span>
                <button className="btn small" onClick={() => cmd({ type: 'tab:new', url: 'https://myaccount.google.com/' })}>
                  {t('set.googleManage')}
                </button>
              </>
            ) : (
              <button className="btn" onClick={() => cmd({ type: 'google:signin' })}>
                <Icon name="google" size={15} /> {t('set.googleSignIn')}
              </button>
            )}
          </div>
          <h3>{t('set.openIn')}</h3>
          {Object.keys(s.openInRules).length === 0 ? (
            <div className="empty-note">
              {t('set.openInNone')} {t('set.openInHint')}
            </div>
          ) : (
            <div className="site-chips">
              {Object.entries(s.openInRules).map(([h, b]) => (
                <span key={h} className="chip">
                  {h} → {browsers.find((x) => x.id === b)?.name ?? b}
                  <button onClick={() => cmd({ type: 'openin:remove', host: h })}>
                    <Icon name="x" size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <Toggle
            checked={s.restoreSession}
            onChange={(restoreSession) => cmd({ type: 'settings:set', patch: { restoreSession } })}
            label={t('set.restore')}
            hint={t('set.restoreHint')}
          />
        </section>

        <section id="settings-privacy" className="settings-section">
          <h2>{t('set.nav.privacy')}</h2>
          <Toggle
            checked={s.adblock}
            onChange={(adblock) => cmd({ type: 'settings:set', patch: { adblock } })}
            label={t('set.adblock')}
            hint={t('set.adblockHint')}
          />
          {s.adblockPaused.length > 0 && (
            <div className="site-row">
              <div className="site-host">{t('set.pausedOn')}</div>
              <div className="site-chips">
                {s.adblockPaused.map((h) => (
                  <span key={h} className="chip">
                    {h}
                    <button title={t('set.unpause')} onClick={() => cmd({ type: 'adblock:site', host: h, paused: false })}>
                      <Icon name="x" size={11} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
          <h3>{t('set.sitePermissions')}</h3>
          <p className="settings-lead">{t('set.sitePermissionsLead')}</p>
          {sites.length === 0 && <div className="empty-note">{t('set.noPermissions')}</div>}
          {sites.map(([origin, kinds]) => (
            <div key={origin} className="site-row">
              <div className="site-host">{hostOf(origin)}</div>
              <div className="site-chips">
                {Object.entries(kinds).map(([kind, d]) => (
                  <span key={kind} className={cx('chip', d)}>
                    {permissionShortName(kind, t)}: {d === 'allow' ? t('set.allowed') : t('set.blocked')}
                    <button title={t('set.askNext')} onClick={() => void reset(origin, kind)}>
                      <Icon name="x" size={11} />
                    </button>
                  </span>
                ))}
              </div>
              <button className="btn small" onClick={() => void reset(origin)}>
                {t('set.resetSite')}
              </button>
            </div>
          ))}
        </section>

        <section id="settings-import" className="settings-section">
          <h2>{t('set.nav.import')}</h2>
          <ImportPanel />
        </section>

        <section id="settings-updates" className="settings-section">
          <h2>{t('set.nav.updates')}</h2>
          <EngineCard status={state.updates} env={env} />
          <h3>{t('set.updateSource')}</h3>
          <UpdateSourceForm u={s.updates} />
          <div className="field">
            <span className="field-label">{t('set.channel')}</span>
            <select
              className="field-input"
              value={s.updates.channel}
              onChange={(e) => cmd({ type: 'settings:set', patch: { updates: { channel: e.target.value as 'stable' | 'beta' } } })}
            >
              <option value="stable">{t('set.channelStable')}</option>
              <option value="beta">{t('set.channelBeta')}</option>
            </select>
          </div>
          <Toggle
            checked={s.updates.autoCheck}
            onChange={(autoCheck) => cmd({ type: 'settings:set', patch: { updates: { autoCheck } } })}
            label={t('set.autoCheck')}
            hint={t('set.autoCheckHint')}
          />
          <Toggle
            checked={s.updates.engineAlerts}
            onChange={(engineAlerts) => cmd({ type: 'settings:set', patch: { updates: { engineAlerts } } })}
            label={t('set.engineAlerts')}
          />
        </section>

        <section id="settings-about" className="settings-section">
          <h2>{t('set.nav.about')}</h2>
          <div className="engine-rows about">
            <div className="engine-row">
              <span>Drift</span>
              <span className="mono">{env?.versions.app}</span>
            </div>
            <div className="engine-row">
              <span>{t('set.electron')}</span>
              <span className="mono">{env?.versions.electron}</span>
            </div>
            <div className="engine-row">
              <span>{t('set.chromium')}</span>
              <span className="mono">{env?.versions.chrome}</span>
            </div>
            <div className="engine-row">
              <span>{t('set.build')}</span>
              <span>{env?.packaged ? t('set.buildInstalled') : t('set.buildDev')}</span>
            </div>
          </div>
          <button className="btn" onClick={() => cmd({ type: 'settings:set', patch: { onboarded: false } })}>
            {t('set.rerunSetup')}
          </button>
        </section>
      </div>
    </div>
  );
}
