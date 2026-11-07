import { useEffect, useState } from 'react';
import { SEARCH_ENGINES, type SearchEngineId } from '../../shared/settings';
import type { BrowserState, DriftEnv } from '../../shared/types';
import { cmd, cx } from '../lib';
import { Icon } from './Icon';
import { ColorThemePicker } from './ColorThemePicker';
import { ImportPanel } from './ImportPanel';
import { ThemePicker } from './ThemePicker';
import { Toggle, UpdateSourceForm } from './UpdatePanels';
import { t } from '../i18n';

const STEPS = ['look', 'import', 'search', 'updates'] as const;

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
              {t('ob.welcome')}
            </div>
            <h1>
              {t(`ob.title.${STEPS[step]}`)}
            </h1>
          </div>
          <ol className="ob-steps">
            {STEPS.map((name, i) => (
              <li key={name} className={cx(i === step && 'current', i < step && 'done')}>
                <span>{i < step ? <Icon name="check" size={12} /> : i + 1}</span>
                {t(`ob.step.${name}`)}
              </li>
            ))}
          </ol>
        </header>

        <div className="ob-body">
          {step === 0 && (
            <>
              <p className="ob-lead">{t('ob.lead.look')}</p>
              <ThemePicker value={s.theme} env={env} />
              <ColorThemePicker settings={s} compact />
              <Toggle
                checked={s.spaceColors}
                onChange={(spaceColors) => cmd({ type: 'settings:set', patch: { spaceColors } })}
                label={t('set.spaceColors')}
                hint={t('set.spaceColorsHint')}
              />
            </>
          )}

          {step === 1 && (
            <>
              <ImportPanel />
              <div className="google-row">
                <button className="btn" onClick={() => cmd({ type: 'google:signin' })}>
                  <Icon name="google" size={15} /> {t('set.googleSignIn')}
                </button>
                <span className="toggle-hint">{t('set.googleHint')}</span>
              </div>
            </>
          )}

          {step === 2 && (
            <div className="engine-list">
              {(Object.keys(SEARCH_ENGINES) as SearchEngineId[]).map((id) => (
                <label key={id} className={cx('source-option', s.searchEngine === id && 'selected')}>
                  <input
                    type="radio"
                    name="engine"
                    checked={s.searchEngine === id}
                    onChange={() => cmd({ type: 'settings:set', patch: { searchEngine: id } })}
                  />
                  <span className="source-text">
                    <span className="source-title">{SEARCH_ENGINES[id].name}</span>
                    <span className="source-body">{new URL(SEARCH_ENGINES[id].home).host}</span>
                  </span>
                </label>
              ))}
            </div>
          )}

          {step === 3 && (
            <>
              <p className="ob-lead">{t('ob.lead.updates', { chrome: env?.versions.chrome ?? '' })}</p>
              <UpdateSourceForm u={s.updates} />
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
                hint={t('set.engineAlertsHint')}
              />
            </>
          )}
        </div>

        <footer className="ob-footer">
          <button className="btn ghost" onClick={finish}>
            {t('ob.skip')}
          </button>
          <div className="ob-nav">
            {step > 0 && (
              <button className="btn" onClick={() => setStep(step - 1)}>
                {t('ob.back')}
              </button>
            )}
            <button className="btn primary" onClick={() => (last ? finish() : setStep(step + 1))}>
              {last ? t('ob.start') : t('ob.next')}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
