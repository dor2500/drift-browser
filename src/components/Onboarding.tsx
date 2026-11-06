import { useEffect, useState } from 'react';
import { SEARCH_ENGINES, type SearchEngineId } from '../../shared/settings';
import type { BrowserState, DriftEnv } from '../../shared/types';
import { cmd, cx } from '../lib';
import { Icon } from './Icon';
import { ThemePicker } from './ThemePicker';
import { Toggle, UpdateSourceForm } from './UpdatePanels';

const STEPS = ['Look', 'Search', 'Updates'] as const;

/**
 * First-run setup: pick a look modelled on a familiar browser, a search
 * engine, and where updates come from. Each choice applies live, so the
 * real sidebar behind the dialog changes as you click.
 */
export function Onboarding({ state }: { state: BrowserState }) {
  const [step, setStep] = useState(0);
  const [env, setEnv] = useState<DriftEnv>();
  useEffect(() => void window.drift.env().then(setEnv), []);
  const s = state.settings;
  const finish = () => cmd({ type: 'settings:set', patch: { onboarded: true } });
  const last = step === STEPS.length - 1;

  return (
    <div className="onboarding-backdrop">
      <div className="onboarding" role="dialog" aria-label="Set up Drift">
        <header className="ob-header">
          <div>
            <div className="ob-kicker">
              <img className="ob-logo" src="./icon.svg" alt="" />
              Welcome to Drift
            </div>
            <h1>
              {step === 0 && 'Which look do you want?'}
              {step === 1 && 'Pick a search engine'}
              {step === 2 && 'Where should updates come from?'}
            </h1>
          </div>
          <ol className="ob-steps">
            {STEPS.map((name, i) => (
              <li key={name} className={cx(i === step && 'current', i < step && 'done')}>
                <span>{i < step ? <Icon name="check" size={12} /> : i + 1}</span>
                {name}
              </li>
            ))}
          </ol>
        </header>

        <div className="ob-body">
          {step === 0 && (
            <>
              <p className="ob-lead">
                Each style is modelled on a browser you know, and its colours and shapes were measured from the copy installed on this PC. You can change this any
                time in Settings.
              </p>
              <ThemePicker value={s.theme} env={env} />
              <Toggle
                checked={s.spaceColors}
                onChange={(spaceColors) => cmd({ type: 'settings:set', patch: { spaceColors } })}
                label="Colour the window with each space"
                hint="Zen's signature tint. Turn off to keep the style's own accent."
              />
            </>
          )}

          {step === 1 && (
            <div className="engine-list">
              {(Object.keys(SEARCH_ENGINES) as SearchEngineId[]).map((id) => (
                <label key={id} className={cx('source-option', s.searchEngine === id && 'selected')}>
                  <input
                    type="radio"
                    name="engine"
                    checked={s.searchEngine === id}
                    onChange={() => cmd({ type: 'settings:set', patch: { searchEngine: id, homePage: SEARCH_ENGINES[id].home } })}
                  />
                  <span className="source-text">
                    <span className="source-title">{SEARCH_ENGINES[id].name}</span>
                    <span className="source-body">{new URL(SEARCH_ENGINES[id].home).host}</span>
                  </span>
                </label>
              ))}
            </div>
          )}

          {step === 2 && (
            <>
              <p className="ob-lead">
                Drift runs on Chromium {env?.versions.chrome ?? ''}. Google ships a new Chrome every 4 weeks, and Electron, Drift's engine, packages each new
                Chromium about every 8 weeks with security fixes in between. New engines reach you inside Drift updates, from the source you pick here.
              </p>
              <UpdateSourceForm u={s.updates} />
              <Toggle
                checked={s.updates.autoCheck}
                onChange={(autoCheck) => cmd({ type: 'settings:set', patch: { updates: { autoCheck } } })}
                label="Check for updates automatically"
                hint="On startup and every 6 hours."
              />
              <Toggle
                checked={s.updates.engineAlerts}
                onChange={(engineAlerts) => cmd({ type: 'settings:set', patch: { updates: { engineAlerts } } })}
                label="Tell me when a newer Chromium is out"
                hint="Compares Drift's engine with the latest Electron and Chrome releases."
              />
            </>
          )}
        </div>

        <footer className="ob-footer">
          <button className="btn ghost" onClick={finish}>
            Skip setup
          </button>
          <div className="ob-nav">
            {step > 0 && (
              <button className="btn" onClick={() => setStep(step - 1)}>
                Back
              </button>
            )}
            <button className="btn primary" onClick={() => (last ? finish() : setStep(step + 1))}>
              {last ? 'Start browsing' : 'Next'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
