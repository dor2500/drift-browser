import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type {
  AiMessage,
  AiState,
  ClipboardItemEntry,
  DownloadInfo,
  FindState,
  GlanceState,
  MediaState,
  SpaceState,
  SplitState,
  TabState,
} from '../shared/types';
import type { Settings, SettingsPatch } from '../shared/settings';
import { applyPatch, loadSettings, saveSettings } from './settings';
import * as store from './store';

export type SyncDomain = 'bookmarks' | 'tabs' | 'history' | 'settings' | 'clipboard';

const clipboardStorePath = () => path.join(app.getPath('userData'), 'clipboard-history.json');
const MAX_CLIPBOARD_ITEMS = 30;

/**
 * Modular State Management Module (`StateManager`).
 *
 * Separates UI components and native view orchestration from domain state
 * and cloud synchronization. Tracks local mutations across domains
 * (`bookmarks`, `tabs`, `history`, `settings`, `clipboard`) and notifies
 * the Firebase Cloud Sync manager in real time without circular loops.
 */
export class StateManager extends EventEmitter {
  tabs: TabState[] = [];
  spaces: SpaceState[] = [];
  activeSpaceId = '';
  split?: SplitState;
  glance?: GlanceState;
  compact = false;
  sidebarWidth = 260;
  settings: Settings = loadSettings();
  media?: MediaState;
  downloads: DownloadInfo[] = [];
  find?: FindState;
  clipboard: ClipboardItemEntry[] = [];
  ai: AiState = {
    open: false,
    status: 'idle',
    ollamaOnline: false,
    availableModels: [],
    selectedModel: '',
    messages: [],
  };

  /** True while applying incoming cloud snapshot data so we don't echo it back to Firestore. */
  private applyingRemote = false;

  constructor() {
    super();
    this.ai.selectedModel = this.settings.ai.model;
    this.loadClipboard();
  }

  /** Run a mutation originating from remote Firestore snapshot without re-triggering a cloud push. */
  withRemoteUpdate(fn: () => void) {
    this.applyingRemote = true;
    try {
      fn();
    } finally {
      this.applyingRemote = false;
    }
    this.emit('state:updated');
  }

  /** Notify listeners that a local domain changed so Firestore Sync can push it. */
  notifyDomainChanged(domain: SyncDomain) {
    if (!this.applyingRemote) {
      this.emit('domain:changed', domain);
    }
    this.emit('state:updated');
  }

  updateSettings(patch: SettingsPatch): { before: Settings; after: Settings } {
    const before = this.settings;
    this.settings = applyPatch(before, patch);
    saveSettings(this.settings);
    if (patch.ai?.model !== undefined && patch.ai.model) {
      this.ai.selectedModel = patch.ai.model;
    }
    this.notifyDomainChanged('settings');
    return { before, after: this.settings };
  }

  // ---------------------------------------------------------------- Universal Cloud Clipboard state

  private loadClipboard() {
    try {
      const raw = JSON.parse(fs.readFileSync(clipboardStorePath(), 'utf8')) as ClipboardItemEntry[];
      if (Array.isArray(raw)) {
        this.clipboard = raw.filter((x) => x && typeof x.text === 'string' && x.id).slice(0, MAX_CLIPBOARD_ITEMS);
      }
    } catch {
      this.clipboard = [];
    }
  }

  private saveClipboard() {
    try {
      fs.writeFileSync(clipboardStorePath(), JSON.stringify(this.clipboard));
    } catch {
      /* best effort */
    }
  }

  addClipboardSnippet(text: string, deviceId: string, deviceName: string): ClipboardItemEntry | undefined {
    const clean = text.trim();
    if (!clean || clean.length > 20_000) return undefined;
    // Deduplicate if identical text is already at the top
    if (this.clipboard[0]?.text === clean) return undefined;

    const existing = this.clipboard.find((c) => c.text === clean);
    const entry: ClipboardItemEntry = {
      id: existing?.id ?? randomUUID(),
      text: clean,
      deviceId,
      deviceName,
      createdAt: Date.now(),
      pinned: existing?.pinned,
    };

    const rest = this.clipboard.filter((c) => c.text !== clean);
    const pinned = rest.filter((c) => c.pinned);
    const unpinned = rest.filter((c) => !c.pinned);
    this.clipboard = [entry, ...pinned, ...unpinned].slice(0, MAX_CLIPBOARD_ITEMS);
    this.saveClipboard();
    this.notifyDomainChanged('clipboard');
    return entry;
  }

  setClipboardPin(id: string, pinned: boolean) {
    const item = this.clipboard.find((c) => c.id === id);
    if (!item) return;
    item.pinned = pinned;
    this.saveClipboard();
    this.notifyDomainChanged('clipboard');
  }

  deleteClipboardItem(id: string) {
    this.clipboard = this.clipboard.filter((c) => c.id !== id);
    this.saveClipboard();
    this.notifyDomainChanged('clipboard');
  }

  clearClipboard() {
    this.clipboard = this.clipboard.filter((c) => c.pinned);
    this.saveClipboard();
    this.notifyDomainChanged('clipboard');
  }

  mergeRemoteClipboard(remoteItems: ClipboardItemEntry[]): ClipboardItemEntry | undefined {
    if (!Array.isArray(remoteItems)) return undefined;
    const prevTopId = this.clipboard[0]?.id;
    const map = new Map<string, ClipboardItemEntry>();
    for (const raw of [...this.clipboard, ...remoteItems]) {
      if (!raw || typeof raw.text !== 'string' || !raw.text.trim()) continue;
      // createdAt arrives from other devices and is attacker-controllable; clamp
      // it to a sane range so a forged far-future timestamp can't force a
      // malicious snippet to always win "newest" (and thus auto-apply).
      const createdAt = Number.isFinite(raw.createdAt) ? Math.min(Math.max(0, raw.createdAt), Date.now()) : 0;
      const item = { ...raw, createdAt };
      const cur = map.get(item.text);
      if (!cur || item.createdAt > cur.createdAt) {
        map.set(item.text, { ...item, pinned: cur?.pinned || item.pinned });
      }
    }
    const merged = [...map.values()]
      .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.createdAt - a.createdAt)
      .slice(0, MAX_CLIPBOARD_ITEMS);

    this.clipboard = merged;
    this.saveClipboard();
    const newest = merged.find((x) => !x.pinned) ?? merged[0];
    return newest && newest.id !== prevTopId ? newest : undefined;
  }

  // ---------------------------------------------------------------- Local AI Assistant state

  setAiOpen(open?: boolean) {
    this.ai.open = open ?? !this.ai.open;
    this.emit('state:updated');
  }

  setAiStatus(status: AiState['status'], error?: string) {
    this.ai.status = status;
    this.ai.error = error;
    this.emit('state:updated');
  }

  setAiModels(models: string[], online: boolean) {
    this.ai.ollamaOnline = online;
    this.ai.availableModels = models;
    if (!this.ai.selectedModel && models.length > 0) {
      this.ai.selectedModel = this.settings.ai.model || models[0];
    } else if (this.settings.ai.model && models.includes(this.settings.ai.model)) {
      this.ai.selectedModel = this.settings.ai.model;
    }
    this.emit('state:updated');
  }

  appendAiMessage(msg: Omit<AiMessage, 'id' | 'timestamp'>): AiMessage {
    const full: AiMessage = {
      ...msg,
      id: randomUUID(),
      timestamp: Date.now(),
    };
    this.ai.messages = [...this.ai.messages, full].slice(-60);
    this.emit('state:updated');
    return full;
  }

  updateAiMessageContent(id: string, content: string) {
    const target = this.ai.messages.find((m) => m.id === id);
    if (!target) return;
    target.content = content;
    this.emit('state:updated');
  }

  clearAiMessages() {
    this.ai.messages = [];
    this.ai.error = undefined;
    this.ai.status = 'idle';
    this.emit('state:updated');
  }

  persisted(): store.Persisted {
    return {
      version: 1,
      tabs: this.tabs
        .filter((t) => !t.glanceOf)
        .map(({ id, url, title, favicon, spaceId, pinned, essential, muted }) => ({
          id,
          url,
          title,
          favicon,
          spaceId,
          pinned,
          essential,
          muted,
        })),
      spaces: this.spaces,
      activeSpaceId: this.activeSpaceId,
      compact: this.compact,
      sidebarWidth: this.sidebarWidth,
      split: this.split,
    };
  }
}

