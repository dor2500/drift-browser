import { useEffect, useState } from 'react';
import type { UpdateSettings, UpdateSource } from '../../shared/settings';
import type { MessageKey } from '../../shared/i18n';
import type { DriftEnv, UpdateStatus } from '../../shared/types';
import { cmd, cx } from '../lib';
import { Icon } from './Icon';
import { t } from '../i18n';

const setUpdates = (updates: Partial<UpdateSettings>) => cmd({ type: 'settings:set', patch: { updates } });

/** Text input that saves on Enter or when it loses focus. */
export function CommitInput({ value, onCommit, placeholder }: { value: string; onCommit: (v: string) => void; placeholder?: string }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <input
      className="field-input"
      value={draft}
      placeholder={placeholder}
      spellCheck={false}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onCommit(draft)}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="toggle-row">
      <span>
        <span className="toggle-label">{label}</span>
        {hint && <span className="toggle-hint">{hint}</span>}
      </span>
      <input type="checkbox" className="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

const SOURCES: { id: UpdateSource; title: MessageKey; body: MessageKey }[] = [
  { id: 'github', title: 'upd.github', body: 'upd.githubBody' },
  { id: 'custom', title: 'upd.custom', body: 'upd.customBody' },
  { id: 'off', title: 'upd.off', body: 'upd.offBody' },
];

/** Where updates come from: used in first-run setup and in Settings. */
export function UpdateSourceForm({ u }: { u: UpdateSettings }) {
  return (
    <div className="source-list">
      {SOURCES.map((s) => (
        <label key={s.id} className={cx('source-option', u.source === s.id && 'selected')}>
          <input type="radio" name="update-source" checked={u.source === s.id} onChange={() => setUpdates({ source: s.id })} />
          <span className="source-text">
            <span className="source-title">{t(s.title)}</span>
            <span className="source-body">{t(s.body)}</span>
            {u.source === s.id && s.id === 'github' && (
              <CommitInput value={u.githubRepo} placeholder={t('upd.githubPlaceholder')} onCommit={(githubRepo) => setUpdates({ githubRepo })} />
            )}
            {u.source === s.id && s.id === 'custom' && (
              <CommitInput value={u.customUrl} placeholder="https://updates.example.com/drift/" onCommit={(customUrl) => setUpdates({ customUrl })} />
            )}
          </span>
        </label>
      ))}
    </div>
  );
}



/** Shows Drift's version and Chromium engine next to the newest available ones. */
export function EngineCard({ status, env }: { status: UpdateStatus; env?: DriftEnv }) {
  const e = status.engine;
  const a = status.app;
  return (
    <div className="engine-card">
      <div className="engine-rows">
        <Row label={t('upd.drift')} value={env?.versions.app ?? '…'} />
        <Row label={t('upd.engineCurrent')} value={e.current} />
        <Row label={t('upd.engineElectron')} value={e.latestElectron ? `${e.latestElectron} (Chromium ${e.latestElectronChrome})` : '—'} />
        <Row label={t('upd.engineChrome')} value={e.chromeStable ?? '—'} />
      </div>
      {e.newer && (
        <div className="engine-note highlight">{t('upd.newer', { major: e.latestElectronChrome?.split('.')[0] ?? '' })}</div>
      )}
      {e.error && <div className="engine-note error">{e.error}</div>}
      <div className="engine-status">
        <span className={cx('status-dot', a.state)} />
        <span>
          {t(`upd.state.${a.state}`)}
          {a.version ? ` (${a.version})` : ''}
          {a.state === 'downloading' && a.progress !== undefined ? ` ${a.progress}%` : ''}
        </span>
      </div>
      {a.message && <div className="engine-note">{a.message}</div>}
      <div className="engine-actions">
        <button className="btn" disabled={e.checking || a.state === 'checking'} onClick={() => cmd({ type: 'updates:check' })}>
          <Icon name="reload" size={14} /> {e.checking || a.state === 'checking' ? t('upd.checking') : t('upd.check')}
        </button>
        {a.state === 'ready' && (
          <button className="btn primary" onClick={() => cmd({ type: 'updates:install' })}>
            <Icon name="download" size={14} /> {t('upd.restart')}
          </button>
        )}
        {e.checkedAt && <span className="engine-checked">{t('upd.lastChecked', { time: new Date(e.checkedAt).toLocaleTimeString() })}</span>}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="engine-row">
      <span>{label}</span>
      <span className="mono">{value}</span>
    </div>
  );
}

/** True when the sidebar's settings button should show a dot. */
export function hasUpdateBadge(status: UpdateStatus, engineAlerts: boolean) {
  return status.app.state === 'ready' || (engineAlerts && !!status.engine.newer);
}
