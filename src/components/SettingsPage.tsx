import { useEffect, useState } from 'react';
import { hostOf, permissionShortName } from '../../shared/permissions';
import { SEARCH_ENGINES, type SearchEngineId } from '../../shared/settings';
import type { BrowserState, DriftEnv, SitePermissions } from '../../shared/types';
import { cmd, cx } from '../lib';
import { Icon } from './Icon';
import { ThemePicker } from './ThemePicker';
import { CommitInput, EngineCard, Toggle, UpdateSourceForm } from './UpdatePanels';

const SECTIONS = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'general', label: 'General' },
  { id: 'privacy', label: 'Site permissions' },
  { id: 'updates', label: 'Updates' },
  { id: 'about', label: 'About' },
] as const;

/** drift://settings, drawn by the shell inside the content pane (no web view). */
export function SettingsPage({ state }: { state: BrowserState }) {
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
          <Icon name="gear" size={18} /> Settings
        </div>
        {SECTIONS.map((x) => (
          <button key={x.id} className={cx('settings-nav-item', section === x.id && 'active')} onClick={() => go(x.id)}>
            {x.label}
          </button>
        ))}
      </nav>

      <div className="settings-scroll">
        <section id="settings-appearance" className="settings-section">
          <h2>Appearance</h2>
          <ThemePicker value={s.theme} env={env} />
          <Toggle
            checked={s.spaceColors}
            onChange={(spaceColors) => cmd({ type: 'settings:set', patch: { spaceColors } })}
            label="Colour the window with each space"
            hint="Off keeps the style's own accent colour in every space."
          />
          <Toggle
            checked={s.verticalTabs}
            onChange={(verticalTabs) => cmd({ type: 'settings:set', patch: { verticalTabs } })}
            label="Vertical tabs"
            hint="Tabs in a sidebar like Zen. Off puts them across the top, the way Chrome, Firefox and Brave do by default."
          />
          <Toggle
            checked={state.compact}
            onChange={(value) => cmd({ type: 'ui:compact', value })}
            label="Compact mode"
            hint="Hide the sidebar until you point at the left edge (Ctrl+Alt+C)."
          />
        </section>

        <section id="settings-general" className="settings-section">
          <h2>General</h2>
          <div className="field">
            <span className="field-label">Search engine</span>
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
            <span className="field-label">Home page (new tabs from links and startup)</span>
            <CommitInput value={s.homePage} placeholder="https://…" onCommit={(homePage) => cmd({ type: 'settings:set', patch: { homePage } })} />
          </div>
          <Toggle
            checked={s.restoreSession}
            onChange={(restoreSession) => cmd({ type: 'settings:set', patch: { restoreSession } })}
            label="Reopen last session's tabs on startup"
            hint="Pinned tabs and Essentials always come back."
          />
        </section>

        <section id="settings-privacy" className="settings-section">
          <h2>Site permissions</h2>
          <p className="settings-lead">Answers you asked Drift to remember. Anything not listed will ask again.</p>
          {sites.length === 0 && <div className="empty-note">No remembered permissions yet.</div>}
          {sites.map(([origin, kinds]) => (
            <div key={origin} className="site-row">
              <div className="site-host">{hostOf(origin)}</div>
              <div className="site-chips">
                {Object.entries(kinds).map(([kind, d]) => (
                  <span key={kind} className={cx('chip', d)}>
                    {permissionShortName(kind)}: {d === 'allow' ? 'Allowed' : 'Blocked'}
                    <button title="Ask next time" onClick={() => void reset(origin, kind)}>
                      <Icon name="x" size={11} />
                    </button>
                  </span>
                ))}
              </div>
              <button className="btn small" onClick={() => void reset(origin)}>
                Reset site
              </button>
            </div>
          ))}
        </section>

        <section id="settings-updates" className="settings-section">
          <h2>Updates</h2>
          <EngineCard status={state.updates} env={env} />
          <h3>Update source</h3>
          <UpdateSourceForm u={s.updates} />
          <div className="field">
            <span className="field-label">Channel</span>
            <select
              className="field-input"
              value={s.updates.channel}
              onChange={(e) => cmd({ type: 'settings:set', patch: { updates: { channel: e.target.value as 'stable' | 'beta' } } })}
            >
              <option value="stable">Stable</option>
              <option value="beta">Beta (pre-releases)</option>
            </select>
          </div>
          <Toggle
            checked={s.updates.autoCheck}
            onChange={(autoCheck) => cmd({ type: 'settings:set', patch: { updates: { autoCheck } } })}
            label="Check automatically"
            hint="On startup and every 6 hours."
          />
          <Toggle
            checked={s.updates.engineAlerts}
            onChange={(engineAlerts) => cmd({ type: 'settings:set', patch: { updates: { engineAlerts } } })}
            label="Alert me about newer Chromium engines"
          />
        </section>

        <section id="settings-about" className="settings-section">
          <h2>About</h2>
          <div className="engine-rows about">
            <div className="engine-row">
              <span>Drift</span>
              <span className="mono">{env?.versions.app}</span>
            </div>
            <div className="engine-row">
              <span>Electron</span>
              <span className="mono">{env?.versions.electron}</span>
            </div>
            <div className="engine-row">
              <span>Chromium</span>
              <span className="mono">{env?.versions.chrome}</span>
            </div>
            <div className="engine-row">
              <span>Build</span>
              <span>{env?.packaged ? 'Installed' : 'Development'}</span>
            </div>
          </div>
          <button className="btn" onClick={() => cmd({ type: 'settings:set', patch: { onboarded: false } })}>
            Run first-time setup again
          </button>
        </section>
      </div>
    </div>
  );
}
