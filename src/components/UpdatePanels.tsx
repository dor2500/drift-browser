import { useEffect, useState } from 'react';
import type { UpdateSettings, UpdateSource } from '../../shared/settings';
import type { DriftEnv, UpdateStatus } from '../../shared/types';
import { cmd, cx } from '../lib';
import { Icon } from './Icon';

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

const SOURCES: { id: UpdateSource; title: string; body: string }[] = [
  { id: 'github', title: 'GitHub Releases', body: 'Recommended. Drift checks a GitHub repository for new releases.' },
  { id: 'custom', title: 'Your own update server', body: 'An https:// folder holding latest.yml and the installers.' },
  { id: 'off', title: 'Manual only', body: 'Never check automatically. You install new versions yourself.' },
];

/** Where updates come from: used in first-run setup and in Settings. */
export function UpdateSourceForm({ u }: { u: UpdateSettings }) {
  return (
    <div className="source-list">
      {SOURCES.map((s) => (
        <label key={s.id} className={cx('source-option', u.source === s.id && 'selected')}>
          <input type="radio" name="update-source" checked={u.source === s.id} onChange={() => setUpdates({ source: s.id })} />
          <span className="source-text">
            <span className="source-title">{s.title}</span>
            <span className="source-body">{s.body}</span>
            {u.source === s.id && s.id === 'github' && (
              <CommitInput value={u.githubRepo} placeholder="owner/repository, e.g. dor2500/drift-browser" onCommit={(githubRepo) => setUpdates({ githubRepo })} />
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

const APP_STATE_TEXT: Record<UpdateStatus['app']['state'], string> = {
  idle: 'Not checked yet',
  checking: 'Checking…',
  none: 'Drift is up to date',
  available: 'Update found, downloading…',
  downloading: 'Downloading update…',
  ready: 'Update ready: restart to install',
  error: 'Update check failed',
  disabled: 'Automatic updates are off',
  dev: 'Development build',
};

/** Shows Drift's version and Chromium engine next to the newest available ones. */
export function EngineCard({ status, env }: { status: UpdateStatus; env?: DriftEnv }) {
  const e = status.engine;
  const a = status.app;
  return (
    <div className="engine-card">
      <div className="engine-rows">
        <Row label="Drift" value={env?.versions.app ?? '…'} />
        <Row label="Chromium engine in Drift" value={e.current} />
        <Row label="Newest Electron release" value={e.latestElectron ? `${e.latestElectron} (Chromium ${e.latestElectronChrome})` : '—'} />
        <Row label="Google Chrome stable" value={e.chromeStable ?? '—'} />
      </div>
      {e.newer && (
        <div className="engine-note highlight">
          A newer Chromium ({e.latestElectronChrome?.split('.')[0]}) is available. It reaches Drift as a new Drift version: from your update source when installed,
          or with <code>npm run update-engine</code> in development.
        </div>
      )}
      {e.error && <div className="engine-note error">{e.error}</div>}
      <div className="engine-status">
        <span className={cx('status-dot', a.state)} />
        <span>
          {APP_STATE_TEXT[a.state]}
          {a.version ? ` (${a.version})` : ''}
          {a.state === 'downloading' && a.progress !== undefined ? ` ${a.progress}%` : ''}
        </span>
      </div>
      {a.message && <div className="engine-note">{a.message}</div>}
      <div className="engine-actions">
        <button className="btn" disabled={e.checking || a.state === 'checking'} onClick={() => cmd({ type: 'updates:check' })}>
          <Icon name="reload" size={14} /> {e.checking || a.state === 'checking' ? 'Checking…' : 'Check now'}
        </button>
        {a.state === 'ready' && (
          <button className="btn primary" onClick={() => cmd({ type: 'updates:install' })}>
            <Icon name="download" size={14} /> Restart and update
          </button>
        )}
        {e.checkedAt && <span className="engine-checked">Last checked {new Date(e.checkedAt).toLocaleTimeString()}</span>}
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
