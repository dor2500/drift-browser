// Types shared by the Electron main process, the preload bridge and the React shell.
import type { Settings, SettingsPatch } from './settings';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TabState {
  id: string;
  url: string;
  title: string;
  favicon?: string;
  /** Owning space. Essentials ignore it and show in every space. */
  spaceId: string;
  pinned: boolean;
  essential: boolean;
  loading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  audible: boolean;
  muted: boolean;
  /** Set while the tab is a Glance preview floating over this parent tab. */
  glanceOf?: string;
}

export interface SpaceState {
  id: string;
  name: string;
  icon: string;
  /** Accent colour; drives the window gradient and the selected-tab tint. */
  accent: string;
  activeTabId?: string;
}

export interface SplitState {
  tabIds: [string, string];
  /** Share of the width given to the first pane (0.15 – 0.85). */
  ratio: number;
}

export interface GlanceState {
  /** The preview tab (a real tab with glanceOf set). */
  id: string;
  parentId: string;
  /** Where the link was clicked, in shell window coordinates; the card grows from here. */
  origin?: { x: number; y: number };
}

/** A site is waiting for an answer to a permission request. */
export interface PermissionPrompt {
  id: string;
  tabId: string;
  origin: string;
  /** Kinds being asked for, e.g. ['camera', 'microphone']; see shared/permissions.ts. */
  kinds: string[];
}

export type AppUpdateState = 'idle' | 'checking' | 'none' | 'available' | 'downloading' | 'ready' | 'error' | 'disabled' | 'dev';

export interface UpdateStatus {
  app: { state: AppUpdateState; version?: string; progress?: number; message?: string; checkedAt?: number };
  /**
   * Chromium engine versions: what Drift runs, what the newest Electron ships,
   * and Google Chrome's current stable release.
   */
  engine: {
    current: string;
    latestElectron?: string;
    latestElectronChrome?: string;
    chromeStable?: string;
    /** The newest Electron carries a newer Chromium major than Drift's. */
    newer?: boolean;
    checking?: boolean;
    checkedAt?: number;
    error?: string;
  };
}

export interface DriftEnv {
  /** Which browsers are installed on this PC (for the theme picker). */
  browsers: { zen: boolean; firefox: boolean; brave: boolean; chrome: boolean };
  packaged: boolean;
  versions: { app: string; electron: string; chrome: string; node: string };
}

export type SitePermissions = Record<string, Record<string, 'allow' | 'block'>>;

export interface BrowserState {
  tabs: TabState[];
  spaces: SpaceState[];
  activeSpaceId: string;
  activeTabId?: string;
  split?: SplitState;
  glance?: GlanceState;
  prompts: PermissionPrompt[];
  settings: Settings;
  updates: UpdateStatus;
  compact: boolean;
  sidebarWidth: number;
}

/** A placeholder rectangle in the shell where a tab's native web view goes. */
export interface Pane {
  tabId: string;
  rect: Rect;
}

export interface Snapshot {
  tabId: string;
  dataUrl: string;
}

export type DropZone = 'essentials' | 'pinned' | 'tabs';
export type DropPosition = 'before' | 'after';

export type Command =
  | { type: 'tab:new'; url?: string; spaceId?: string; background?: boolean; afterId?: string }
  | { type: 'tab:activate'; id: string }
  | { type: 'tab:close'; id?: string }
  | { type: 'tab:navigate'; input: string; id?: string }
  | { type: 'tab:back' | 'tab:forward' | 'tab:reload'; id?: string }
  | { type: 'tab:move'; id: string; zone: DropZone; targetId?: string; position?: DropPosition }
  | { type: 'tab:set'; id: string; pinned?: boolean; essential?: boolean; spaceId?: string; muted?: boolean }
  | { type: 'tab:reopen' }
  | { type: 'tab:cycle'; dir: 1 | -1 }
  | { type: 'split:create'; ids: [string, string] }
  | { type: 'split:ratio'; ratio: number }
  | { type: 'split:close' }
  | { type: 'glance:close' | 'glance:expand' | 'glance:split' }
  | { type: 'permission:respond'; id: string; allow: boolean; remember: boolean }
  | { type: 'permission:reset'; origin: string; kind?: string }
  | { type: 'settings:set'; patch: SettingsPatch }
  | { type: 'settings:open' }
  | { type: 'updates:check' }
  | { type: 'updates:install' }
  | { type: 'space:new' }
  | { type: 'space:activate'; id: string }
  | { type: 'space:cycle'; dir: 1 | -1 }
  | { type: 'space:set'; id: string; name?: string; icon?: string; accent?: string }
  | { type: 'space:delete'; id: string }
  | { type: 'space:clear'; id: string }
  | { type: 'ui:compact'; value?: boolean }
  | { type: 'ui:sidebarWidth'; width: number }
  | { type: 'win:minimize' | 'win:maximize' | 'win:close' };

/** Events the main process pushes to the shell (mostly keyboard shortcuts). */
export type UiEvent =
  | { type: 'commandbar'; mode: 'new' | 'current' }
  | { type: 'space:rename'; id: string }
  | { type: 'glance:backdrop'; snapshots: Snapshot[] };

export interface DriftApi {
  getState(): Promise<BrowserState>;
  cmd(c: Command): Promise<void>;
  layout(panes: Pane[]): void;
  overlay(open: boolean): Promise<Snapshot[]>;
  tabMenu(id: string): void;
  spaceMenu(id: string): void;
  siteMenu(): void;
  appMenu(): void;
  spacesMenu(): void;
  env(): Promise<DriftEnv>;
  sitePermissions(): Promise<SitePermissions>;
  onState(cb: (s: BrowserState) => void): () => void;
  onUi(cb: (e: UiEvent) => void): () => void;
}

export const SIDEBAR_MIN = 220;
export const SIDEBAR_MAX = 420;
export const ESSENTIALS_MAX = 12;
