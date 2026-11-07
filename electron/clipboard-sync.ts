import { clipboard } from 'electron';
import type { StateManager } from './state-manager';

/**
 * Universal Cloud Clipboard Monitor (`ClipboardMonitor`).
 *
 * Monitors the system clipboard for newly copied text snippets and records them
 * into `StateManager` so they are synced in real time across devices logged into
 * the same Firebase account.
 */
export class ClipboardMonitor {
  private timer?: NodeJS.Timeout;
  private lastSeenText = '';

  constructor(
    private state: StateManager,
    private getDeviceMeta: () => { deviceId: string; deviceName: string; shouldMonitor: () => boolean },
  ) {
    try {
      this.lastSeenText = String(clipboard.readText() ?? '').trim();
    } catch {
      this.lastSeenText = '';
    }
  }

  start() {
    clearInterval(this.timer);
    this.timer = setInterval(() => this.poll(), 1800);
  }

  stop() {
    clearInterval(this.timer);
    this.timer = undefined;
  }

  /** Write a snippet to the OS clipboard without triggering a local re-capture loop. */
  writeSystemClipboard(text: string) {
    const clean = text.trim();
    if (!clean) return;
    this.lastSeenText = clean;
    try {
      clipboard.writeText(clean);
    } catch {
      /* ignore */
    }
  }

  /** Manually capture current OS clipboard or explicit text and push to Cloud Clipboard. */
  captureNow(explicitText?: string) {
    const raw = explicitText ?? String(clipboard.readText() ?? '');
    const clean = raw.trim();
    if (!clean) return;
    this.lastSeenText = clean;
    const { deviceId, deviceName } = this.getDeviceMeta();
    this.state.addClipboardSnippet(clean, deviceId, deviceName);
  }

  private poll() {
    const meta = this.getDeviceMeta();
    if (!this.state.settings.clipboardSync.enabled || !meta.shouldMonitor()) return;
    try {
      const current = String(clipboard.readText() ?? '').trim();
      if (!current || current === this.lastSeenText || current.length > 15_000) return;
      this.lastSeenText = current;
      this.state.addClipboardSnippet(current, meta.deviceId, meta.deviceName);
    } catch {
      /* clipboard busy */
    }
  }
}
