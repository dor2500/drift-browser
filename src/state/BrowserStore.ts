import { useEffect, useState } from 'react';
import type {
  AiState,
  BrowserState,
  ClipboardItemEntry,
  Command,
  FirebaseClientConfig,
  SyncState,
  SyncWhat,
} from '../../shared/types';
import type { DarkModeSettings, SettingsPatch } from '../../shared/settings';

type Listener = (state: BrowserState) => void;

/**
 * Modular Frontend State Store & Cloud Sync Bridge.
 * Separates UI components from IPC transport, local state subscriptions,
 * and cloud synchronization business logic.
 */
class BrowserStore {
  private current: BrowserState | null = null;
  private listeners = new Set<Listener>();
  private initialized = false;

  init() {
    if (this.initialized || typeof window === 'undefined' || !window.drift) return;
    this.initialized = true;
    void window.drift.getState().then((s) => {
      if (s && !this.current) {
        this.current = s;
        this.emit(s);
      }
    });
    window.drift.onState((s) => {
      this.current = s;
      this.emit(s);
    });
  }

  getSnapshot(): BrowserState | null {
    return this.current;
  }

  subscribe(listener: Listener): () => void {
    this.init();
    this.listeners.add(listener);
    if (this.current) listener(this.current);
    return () => {
      this.listeners.delete(listener);
    };
  }

  dispatch(command: Command): void {
    void window.drift.cmd(command);
  }

  private emit(state: BrowserState) {
    for (const listener of this.listeners) {
      listener(state);
    }
  }
}

export const browserStore = new BrowserStore();

export const cmd = (c: Command) => browserStore.dispatch(c);

/** Hook subscribing to the full BrowserState. */
export function useBrowserState(): BrowserState | null {
  const [state, setState] = useState<BrowserState | null>(() => browserStore.getSnapshot());
  useEffect(() => browserStore.subscribe(setState), []);
  return state;
}

/** Domain selector hook for Firebase Cloud Sync & Handoff state. */
export function useSyncState(): SyncState | null {
  const state = useBrowserState();
  return state?.sync ?? null;
}

/** Domain selector hook for Local AI Assistant (Ollama) state. */
export function useAiState(): AiState | null {
  const state = useBrowserState();
  return state?.ai ?? null;
}

/** Domain selector hook for Universal Cloud Clipboard items. */
export function useClipboardState(): ClipboardItemEntry[] {
  const state = useBrowserState();
  return state?.clipboard ?? [];
}

/** Domain selector hook for Advanced Dark Mode Engine settings. */
export function useDarkModeState(): DarkModeSettings | null {
  const state = useBrowserState();
  return state?.settings.darkMode ?? null;
}

// ------------------------------------------------------------------
// Domain Business Logic & Action Controllers
// ------------------------------------------------------------------

export const syncActions = {
  signIn: () => cmd({ type: 'sync:signin' }),
  signOut: () => cmd({ type: 'sync:signout' }),
  syncNow: () => cmd({ type: 'sync:now' }),
  setWhat: (what: Partial<SyncWhat>) => cmd({ type: 'sync:what', what }),
  setOAuthClient: (clientId: string, clientSecret: string) =>
    cmd({ type: 'sync:key', clientId, clientSecret }),
  setFirebaseConfig: (config: FirebaseClientConfig) =>
    cmd({ type: 'sync:firebase-config', config }),
};

export const handoffActions = {
  sendTab: (url: string, title: string, targetDeviceId: string | 'all') =>
    cmd({ type: 'handoff:send', url, title, targetDeviceId }),
  dismiss: (id: string) => cmd({ type: 'handoff:dismiss', id }),
  openRemoteTab: (url: string, background = false) =>
    cmd({ type: 'tab:new', url, background }),
};

export const clipboardActions = {
  pushCurrentOrText: (text?: string) => cmd({ type: 'clipboard:push', text }),
  copyToSystem: (id: string) => cmd({ type: 'clipboard:copy', id }),
  setPinned: (id: string, pinned: boolean) => cmd({ type: 'clipboard:pin', id, pinned }),
  remove: (id: string) => cmd({ type: 'clipboard:delete', id }),
  clearUnpinned: () => cmd({ type: 'clipboard:clear' }),
  updateSettings: (patch: SettingsPatch['clipboardSync']) =>
    cmd({ type: 'settings:set', patch: { clipboardSync: patch } }),
};

export const darkModeActions = {
  toggleForHost: (host: string) => cmd({ type: 'darkmode:toggle-site', host }),
  update: (patch: Partial<DarkModeSettings>) => cmd({ type: 'darkmode:update', patch }),
  resetFilters: () =>
    cmd({
      type: 'darkmode:update',
      patch: { brightness: 100, contrast: 100, sepia: 0, grayscale: 0 },
    }),
};

export const aiActions = {
  togglePanel: (open?: boolean) => cmd({ type: 'ai:toggle', open }),
  sendPrompt: (
    prompt: string,
    action?: 'summarize' | 'translate' | 'explain' | 'chat',
    includePage = true,
  ) => cmd({ type: 'ai:prompt', prompt, action, includePage }),
  summarizeCurrentPage: () =>
    cmd({ type: 'ai:prompt', prompt: '', action: 'summarize', includePage: true }),
  translateCurrentPage: () =>
    cmd({ type: 'ai:prompt', prompt: '', action: 'translate', includePage: true }),
  explainCurrentPage: () =>
    cmd({ type: 'ai:prompt', prompt: '', action: 'explain', includePage: true }),
  clearChat: () => cmd({ type: 'ai:clear' }),
  stopGeneration: () => cmd({ type: 'ai:stop' }),
  refreshModels: () => cmd({ type: 'ai:refresh-models' }),
  updateSettings: (patch: SettingsPatch['ai']) =>
    cmd({ type: 'settings:set', patch: { ai: patch } }),
};

