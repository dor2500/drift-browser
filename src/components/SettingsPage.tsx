import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { en, type MessageKey } from '../../shared/locales/en';
import { SETTINGS_ORDER } from '../../shared/themes';
import { hostOf, permissionShortName } from '../../shared/permissions';
import { SEARCH_ENGINES, type SearchEngineId } from '../../shared/settings';
import type { BrowserState, DriftEnv, SitePermissions } from '../../shared/types';
import { cmd, cx } from '../lib';
import { Icon, type IconName } from './Icon';
import { ImportPanel } from './ImportPanel';
import { SyncPanel } from './SyncPanel';
import { DarkModePanel } from './DarkModePanel';
import { CloudClipboardPanel } from './CloudClipboardPanel';
import { ColorThemePicker } from './ColorThemePicker';
import { EnginePicker } from './EnginePicker';
import { LanguagePicker } from './LanguagePicker';
import { ThemePicker } from './ThemePicker';
import { CommitInput, EngineCard, Toggle, UpdateSourceForm } from './UpdatePanels';
import { t, useLocale } from '../i18n';

const SECTIONS = ['sync', 'appearance', 'engine', 'language', 'general', 'privacy', 'import', 'updates', 'about'] as const;

/** A section's name in the chosen browser's own words (Chrome's "You and Google", Edge's "Profiles"…). */
function sectionName(theme: string, id: string) {
  const key = `mode.${theme}.${id}` as MessageKey;
  const named = t(key);
  return named === key ? t(`set.nav.${id}` as MessageKey) : named;
}
const EN_KEYS: Record<string, string[]> = {
  sync: ['set.nav.sync', 'sync.'],
  appearance: ['set.nav.appearance', 'theme.', 'set.colorTheme', 'set.themeDefault', 'set.customAccent', 'set.spaceColors', 'set.verticalTabs', 'set.compact'],
  engine: ['set.nav.engine', 'eng.'],
  language: ['set.nav.language', 'set.language'],
  general: ['set.nav.general', 'set.searchEngine', 'set.homePage', 'set.newTabPage', 'set.confirmClose', 'set.askDownload', 'set.smooth', 'set.gpu', 'set.sleep', 'set.forceDark', 'set.google', 'set.openIn', 'set.restore'],
  privacy: ['set.nav.privacy', 'priv.', 'set.adblock', 'set.annoyances', 'set.clearOnExit', 'set.pausedOn', 'set.sitePermissions'],
  connections: ['priv.connections', 'conn.'],
  import: ['set.nav.import', 'imp.'],
  updates: ['set.nav.updates', 'upd.', 'set.updateSource', 'set.channel', 'set.autoCheck', 'set.engineAlerts'],
  about: ['set.nav.about', 'set.electron', 'set.chromium', 'set.build', 'set.rerunSetup'],
};
const englishFor = (section: string) =>
  Object.entries(en)
    .filter(([k]) => (EN_KEYS[section] ?? []).some((prefix) => k.startsWith(prefix)))
    .map(([, v]) => v)
    .join(' ');

const NAV_ICONS: Record<(typeof SECTIONS)[number], IconName> = {
  sync: 'google',
  appearance: 'palette',
  engine: 'globe',
  language: 'chat',
  general: 'gear',
  privacy: 'shield',
  import: 'import',
  updates: 'download',
  about: 'info',
};

/** drift://settings, drawn by the shell inside the content pane (no web view). */
export function SettingsPage({ state }: { state: BrowserState }) {
  const locale = useLocale();
  const [google, setGoogle] = useState(false);
  const [browsers, setBrowsers] = useState<{ id: string; name: string }[]>([]);
  // Force-dark only changes after a restart, so remember what this run started with.
  const [startDark] = useState(state.settings.forceDark);
  const [startSmooth] = useState(state.settings.smoothScrolling);
  const [startGpu] = useState(state.settings.hardwareAcceleration);
  useEffect(() => {
    void window.drift.googleStatus().then(setGoogle);
    void window.drift.otherBrowsers().then(setBrowsers);
  }, [state.activeTabId]);
  const s = state.settings;
  const [env, setEnv] = useState<DriftEnv>();
  const [perms, setPerms] = useState<SitePermissions>({});
  const [section, setSection] = useState<string>(SETTINGS_ORDER[state.settings.theme][0]);
  const [query, setQuery] = useState('');
  const [noMatch, setNoMatch] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  // "Search settings", as in Chrome, Brave and Firefox: hide sections that don't mention the words.
  useEffect(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    scroller.current?.querySelectorAll<HTMLElement>('.settings-section').forEach((sec) => {
      const hit = words.every((w) => sec.textContent?.toLowerCase().includes(w));
      sec.hidden = words.length > 0 && !hit;
      if (!sec.hidden) shown++;
    });
    setNoMatch(words.length > 0 && shown === 0);
  }, [query, state.settings, state.prompts.length]);

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
        <label className="settings-search">
          <Icon name="search" size={14} />
          <input value={query} placeholder={t('set.search')} onChange={(e) => setQuery(e.target.value)} />
        </label>
        {SETTINGS_ORDER[s.theme].map((id) => (
          <button key={id} className={cx('settings-nav-item', section === id && 'active')} onClick={() => go(id)}>
            <Icon name={NAV_ICONS[id]} size={16} />
            {sectionName(s.theme, id)}
          </button>
        ))}
      </nav>

      <div
        className="settings-scroll"
        ref={scroller}
        style={Object.fromEntries(SETTINGS_ORDER[s.theme].map((id, i) => [`--order-${id}`, i])) as CSSProperties}
      >
        {query && noMatch && <div className="empty-note">{t('set.searchNone', { q: query })}</div>}
        <section id="settings-sync" className="settings-section">
          <span hidden className="search-en">{englishFor('sync')}</span>
          <h2>{sectionName(s.theme, 'sync')}</h2>
          <SyncPanel sync={state.sync} activeTab={state.tabs.find((t) => t.id === state.activeTabId)} />
        </section>
        <section id="settings-appearance" className="settings-section">
          <span hidden className="search-en">{englishFor('appearance')}</span>
          <h2>{sectionName(s.theme, 'appearance')}</h2>
          <ThemePicker value={s.theme} env={env} />
          <h3>{t('set.colorTheme')}</h3>
          <p className="settings-lead">{t('set.colorThemeHint')}</p>
          <ColorThemePicker settings={s} />
          <h3>{t('dm.title')}</h3>
          <DarkModePanel darkMode={s.darkMode} activeUrl={state.tabs.find((t) => t.id === state.activeTabId)?.url} />
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

        <section id="settings-engine" className="settings-section">
          <span hidden className="search-en">{englishFor('engine')}</span>
          <h2>{sectionName(s.theme, 'engine')}</h2>
          <EnginePicker engine={s.engine} chromium={env?.versions.chrome ?? ''} />
        </section>

        <section id="settings-language" className="settings-section">
          <span hidden className="search-en">{englishFor('language')}</span>
          <h2>{sectionName(s.theme, 'language')}</h2>
          <LanguagePicker value={s.language} system={locale.system} />
        </section>

        <section id="settings-general" className="settings-section">
          <span hidden className="search-en">{englishFor('general')}</span>
          <h2>{sectionName(s.theme, 'general')}</h2>
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
          <div className="field">
            <span className="field-label">{t('set.newTabPage')}</span>
            <select className="field-input" value={s.newTabPage} onChange={(e) => cmd({ type: 'settings:set', patch: { newTabPage: e.target.value as 'newtab' | 'home' } })}>
              <option value="newtab">{t('set.newTabPageNewtab')}</option>
              <option value="home">{t('set.newTabPageHome')}</option>
            </select>
          </div>
          <Toggle checked={s.confirmClose} onChange={(confirmClose) => cmd({ type: 'settings:set', patch: { confirmClose } })} label={t('set.confirmClose')} />
          <Toggle
            checked={s.askDownloadLocation}
            onChange={(askDownloadLocation) => cmd({ type: 'settings:set', patch: { askDownloadLocation } })}
            label={t('set.askDownload')}
          />
          <Toggle
            checked={s.smoothScrolling}
            onChange={(smoothScrolling) => cmd({ type: 'settings:set', patch: { smoothScrolling } })}
            label={t('set.smooth')}
            hint={t('set.smoothHint')}
          />
          <Toggle
            checked={s.hardwareAcceleration}
            onChange={(hardwareAcceleration) => cmd({ type: 'settings:set', patch: { hardwareAcceleration } })}
            label={t('set.gpu')}
            hint={t('set.gpuHint')}
          />
          {(s.smoothScrolling !== startSmooth || s.hardwareAcceleration !== startGpu) && (
            <button className="btn small" onClick={() => cmd({ type: 'app:restart' })}>
              {t('set.restartNow')}
            </button>
          )}
          <Toggle
            checked={s.restoreSession}
            onChange={(restoreSession) => cmd({ type: 'settings:set', patch: { restoreSession } })}
            label={t('set.restore')}
            hint={t('set.restoreHint')}
          />
          <h3>{t('ai.title')}</h3>
          <p className="settings-lead">
            Connect Drift to your local Ollama server (<code>http://localhost:11434</code>) to summarize pages, translate text, or chat privately on-device. Press <code>Ctrl+Shift+A</code> or type <code>@ai</code> in the address bar.
          </p>
          <div className="field">
            <span className="field-label">Ollama API Endpoint</span>
            <CommitInput
              value={s.ai.endpoint}
              placeholder="http://localhost:11434"
              onCommit={(endpoint) => cmd({ type: 'settings:set', patch: { ai: { endpoint } } })}
            />
          </div>
          <div className="field">
            <span className="field-label">Default Ollama Model</span>
            <CommitInput
              value={s.ai.model}
              placeholder="llama3.2"
              onCommit={(model) => cmd({ type: 'settings:set', patch: { ai: { model } } })}
            />
          </div>
          <div className="field">
            <span className="field-label">Target Translation Language</span>
            <CommitInput
              value={s.ai.targetLanguage}
              placeholder="English"
              onCommit={(targetLanguage) => cmd({ type: 'settings:set', patch: { ai: { targetLanguage } } })}
            />
          </div>
          <button className="btn" onClick={() => cmd({ type: 'ai:toggle', open: true })}>
            <Icon name="sparkles" size={14} /> Open Local AI Side Panel
          </button>

          <h3>{t('clip.title')}</h3>
          <CloudClipboardPanel items={state.clipboard} settings={s.clipboardSync} sync={state.sync} />
        </section>

        <section id="settings-privacy" className="settings-section">
          <span hidden className="search-en">{englishFor('privacy')}</span>
          <h2>{sectionName(s.theme, 'privacy')}</h2>
          <Toggle
            checked={s.adblock}
            onChange={(adblock) => cmd({ type: 'settings:set', patch: { adblock } })}
            label={t('set.adblock')}
            hint={t('set.adblockHint')}
          />
          <Toggle
            checked={s.hideAnnoyances}
            onChange={(hideAnnoyances) => cmd({ type: 'settings:set', patch: { hideAnnoyances } })}
            label={t('set.annoyances')}
            hint={t('set.annoyancesHint')}
          />
          <Toggle
            checked={s.clearOnExit}
            onChange={(clearOnExit) => cmd({ type: 'settings:set', patch: { clearOnExit } })}
            label={t('set.clearOnExit')}
            hint={t('set.clearOnExitHint')}
          />
          <h3>{t('priv.title')}</h3>
          <Toggle
            checked={s.privacy.httpsOnly}
            onChange={(v) => cmd({ type: 'settings:set', patch: { privacy: { httpsOnly: v } } })}
            label={t('priv.https')}
            hint={t('priv.httpsHint')}
          />
          <Toggle
            checked={s.privacy.stripTracking}
            onChange={(v) => cmd({ type: 'settings:set', patch: { privacy: { stripTracking: v } } })}
            label={t('priv.strip')}
            hint={t('priv.stripHint')}
          />
          <Toggle
            checked={s.privacy.block3pCookies}
            onChange={(v) => cmd({ type: 'settings:set', patch: { privacy: { block3pCookies: v } } })}
            label={t('priv.cookies')}
            hint={t('priv.cookiesHint')}
          />
          <Toggle
            checked={s.privacy.gpc}
            onChange={(v) => cmd({ type: 'settings:set', patch: { privacy: { gpc: v } } })}
            label={t('priv.gpc')}
            hint={t('priv.gpcHint')}
          />
          <Toggle
            checked={s.privacy.webrtcProtect}
            onChange={(v) => cmd({ type: 'settings:set', patch: { privacy: { webrtcProtect: v } } })}
            label={t('priv.webrtc')}
            hint={t('priv.webrtcHint')}
          />
          <Toggle
            checked={s.privacy.engineCheck}
            onChange={(v) => cmd({ type: 'settings:set', patch: { privacy: { engineCheck: v } } })}
            label={t('priv.engineCheck')}
            hint={t('priv.engineCheckHint')}
          />
          <Toggle
            checked={s.privacy.chromeCompare}
            onChange={(v) => cmd({ type: 'settings:set', patch: { privacy: { chromeCompare: v } } })}
            label={t('priv.chromeCompare')}
            hint={t('priv.chromeCompareHint')}
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

        <section id="settings-connections" className="settings-section">
          <span hidden className="search-en">{englishFor('connections')}</span>
          <h3>{t('priv.connections')}</h3>
          <p className="settings-lead">{t('priv.connectionsLead')}</p>
          <ul className="conn-list">
            {(['conn.github', 'conn.electron', 'conn.google', 'conn.search', 'conn.mozilla', 'conn.translate'] as const).map((k) => (
              <li key={k}>{t(k)}</li>
            ))}
          </ul>
        </section>

        <section id="settings-import" className="settings-section">
          <span hidden className="search-en">{englishFor('import')}</span>
          <h2>{sectionName(s.theme, 'import')}</h2>
          <ImportPanel />
        </section>

        <section id="settings-updates" className="settings-section">
          <span hidden className="search-en">{englishFor('updates')}</span>
          <h2>{sectionName(s.theme, 'updates')}</h2>
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
          <span hidden className="search-en">{englishFor('about')}</span>
          <h2>{sectionName(s.theme, 'about')}</h2>
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
