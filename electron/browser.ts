import {
  BrowserWindow,
  Menu,
  WebContentsView,
  clipboard,
  session,
  type ContextMenuParams,
  type Input,
  type MenuItemConstructorOptions,
  type WebContents,
} from 'electron';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import {
  ESSENTIALS_MAX,
  SIDEBAR_MAX,
  SIDEBAR_MIN,
  type BrowserState,
  type Command,
  type DropPosition,
  type DropZone,
  type GlanceState,
  type ImportBrowser,
  type ImportOptions,
  type ImportResult,
  type MediaState,
  type Pane,
  type Snapshot,
  type SpaceState,
  type SplitState,
  type TabState,
  type UiEvent,
} from '../shared/types';
import { SEARCH_ENGINES, type Settings, type SettingsPatch } from '../shared/settings';
import { contentRadiusFor } from '../shared/themes';
import { SETTINGS_URL, internalTitle, isInternalUrl, normalizeInput } from '../shared/url';
import { permissionShortName, hostOf } from '../shared/permissions';
import { AdBlock, hostOfUrl } from './adblock';
import { HistoryIndex } from './history';
import { readSource, sourceName } from './importer';
import { Permissions, originOf } from './permissions';
import { applyPatch, loadSettings, saveSettings } from './settings';
import * as store from './store';
import { Updater } from './updater';
import { I18n } from './i18n';

export const PARTITION = 'persist:drift';

/** Read once the app is ready (Browser is only constructed after that). */
let RTL = false;
const RTL_LANGS = new Set(['he', 'iw', 'ar', 'fa', 'ur', 'yi', 'ps', 'sd', 'ug', 'ckb', 'dv']);
export function detectRtl(locale: string) {
  RTL = RTL_LANGS.has(locale.toLowerCase().split('-')[0]);
}

const ACCENTS = ['#8aa4ff', '#f5a97f', '#a6da95', '#f5bde6', '#91d7e3', '#eed49f', '#c6a0f6', '#ee99a0'];
const ICONS = ['🏠', '💼', '🎮', '📚', '🎨', '🎵', '🧪', '✈️', '🛒', '💬'];

const newId = () => randomUUID();
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Owns the browser model (tabs, spaces, split view) and one native
 * WebContentsView per loaded tab. The React shell is a pure view of
 * `state()`: it sends Commands and reports where each pane should sit.
 */
export class Browser {
  private tabs: TabState[] = [];
  private spaces: SpaceState[] = [];
  private activeSpaceId = '';
  private split?: SplitState;
  private glance?: GlanceState;
  private compact = false;
  private sidebarWidth = 260;

  private views = new Map<string, WebContentsView>();
  private shown = new Set<string>();
  private panes: Pane[] = [];
  private overlay = false;
  private overlaySeq = 0;
  private fullscreenTab?: string;
  private closed: { url: string; spaceId: string }[] = [];
  private emitQueued = false;

  readonly permissions: Permissions;
  readonly updater: Updater;
  readonly history = new HistoryIndex();
  readonly adblock: AdBlock;
  private settings: Settings = loadSettings();
  readonly i18n = new I18n(() => this.settings.language);
  private media?: MediaState;

  constructor(private win: BrowserWindow) {
    this.updater = new Updater(() => this.settings, () => this.emit(), (k) => this.i18n.t(k));
    this.permissions = new Permissions({
      tabIdFor: (wc) => [...this.views].find(([, v]) => v.webContents === wc)?.[0],
      changed: () => this.emit(),
    });
    this.permissions.install(session.fromPartition(PARTITION));
    this.adblock = new AdBlock({
      enabled: () => this.settings.adblock,
      isPaused: (url) => this.sitePaused(url),
      blocked: (wcId, count) => {
        const id = this.tabIdForWc(wcId);
        const t = this.tab(id);
        if (t && t.blocked !== count) {
          t.blocked = count;
          this.emit();
        }
      },
    });
    void this.adblock.init(session.fromPartition(PARTITION));
    this.restore(store.load());
    win.on('resize', () => this.fullscreenTab && this.applyLayout());
    this.updater.schedule();
  }

  private get searchUrl() {
    return SEARCH_ENGINES[this.settings.searchEngine].url;
  }

  private get contentRadius() {
    return contentRadiusFor(this.settings);
  }

  private setSettings(patch: SettingsPatch) {
    const before = this.settings;
    this.settings = applyPatch(before, patch);
    saveSettings(this.settings);
    if (contentRadiusFor(before) !== this.contentRadius) {
      for (const v of this.views.values()) (v as unknown as { setBorderRadius?: (r: number) => void }).setBorderRadius?.(this.contentRadius);
    }
    if (patch.updates || patch.onboarded !== undefined) this.updater.schedule();
    if (patch.adblock !== undefined) this.adblock.apply();
    if (patch.language !== undefined) this.i18n.reload();
    this.emit();
  }

  private openSettings() {
    const existing = this.tabs.find((t) => !t.glanceOf && t.url.startsWith(SETTINGS_URL));
    if (existing) this.activate(existing.id);
    else this.createTab({ url: SETTINGS_URL });
  }

  // ---------------------------------------------------------------- model

  private restore(d: store.Persisted | null) {
    if (d) {
      this.spaces = d.spaces;
      this.activeSpaceId = d.spaces.some((s) => s.id === d.activeSpaceId) ? d.activeSpaceId : d.spaces[0].id;
      this.tabs = d.tabs
        .filter((t) => !('glanceOf' in t) && (t.essential || this.spaces.some((s) => s.id === t.spaceId)))
        // "Restore session" off: only pinned tabs and Essentials come back.
        .filter((t) => this.settings.restoreSession || t.pinned || t.essential)
        .map((t) => ({ ...t, muted: !!t.muted, loading: false, canGoBack: false, canGoForward: false, audible: false }));
      this.compact = !!d.compact;
      this.sidebarWidth = clamp(d.sidebarWidth ?? 260, SIDEBAR_MIN, SIDEBAR_MAX);
      if (d.split?.tabIds.every((id) => this.tab(id))) this.split = d.split;
      for (const s of this.spaces) if (s.activeTabId && !this.tab(s.activeTabId)) s.activeTabId = undefined;
      if (!this.settings.restoreSession && !this.tabs.some((t) => !t.essential && t.spaceId === this.activeSpaceId)) {
        this.createTab({ url: this.settings.homePage });
      }
      return;
    }
    const home: SpaceState = { id: newId(), name: this.i18n.t('spaces.home'), icon: ICONS[0], accent: ACCENTS[0] };
    this.spaces = [home];
    this.activeSpaceId = home.id;
    this.createTab({ url: this.settings.homePage });
  }

  private tab(id?: string) {
    return id ? this.tabs.find((t) => t.id === id) : undefined;
  }

  private get space() {
    return this.spaces.find((s) => s.id === this.activeSpaceId)!;
  }

  get activeTabId() {
    return this.space.activeTabId;
  }

  /** Tabs in sidebar order for a space: essentials, pinned, then regular. */
  private visibleIn(spaceId: string) {
    const own = this.tabs.filter((t) => !t.essential && !t.glanceOf && t.spaceId === spaceId);
    return [...this.tabs.filter((t) => t.essential), ...own.filter((t) => t.pinned), ...own.filter((t) => !t.pinned)];
  }

  state(): BrowserState {
    return {
      tabs: this.tabs,
      spaces: this.spaces,
      activeSpaceId: this.activeSpaceId,
      activeTabId: this.activeTabId,
      split: this.split,
      glance: this.glance,
      prompts: this.permissions.prompts,
      media: this.media,
      settings: this.settings,
      updates: this.updater.status,
      compact: this.compact,
      sidebarWidth: this.sidebarWidth,
    };
  }

  persisted(): store.Persisted {
    return {
      version: 1,
      tabs: this.tabs.filter((t) => !t.glanceOf).map(({ id, url, title, favicon, spaceId, pinned, essential, muted }) => ({
        id, url, title, favicon, spaceId, pinned, essential, muted,
      })),
      spaces: this.spaces,
      activeSpaceId: this.activeSpaceId,
      compact: this.compact,
      sidebarWidth: this.sidebarWidth,
      split: this.split,
    };
  }

  /** Coalesces many small changes (title, favicon, loading) into one push per tick. */
  private emit() {
    if (this.emitQueued) return;
    this.emitQueued = true;
    setImmediate(() => {
      this.emitQueued = false;
      if (this.win.isDestroyed()) return;
      this.win.webContents.send('drift:state', this.state());
      store.save(this.persisted());
      this.applyLayout();
    });
  }

  private ui(e: UiEvent) {
    this.win.webContents.focus();
    this.win.webContents.send('drift:ui', e);
  }

  // ---------------------------------------------------------------- tabs

  private createTab(o: { url?: string; spaceId?: string; background?: boolean; afterId?: string }) {
    const t = this.newTabState(o.url ? normalizeInput(o.url, this.searchUrl) : this.settings.homePage, o.spaceId);
    const opener = this.tab(o.afterId);
    if (opener && !opener.essential && !opener.pinned && opener.spaceId === t.spaceId) {
      this.tabs.splice(this.tabs.indexOf(opener) + 1, 0, t);
    } else {
      // Like Zen/Arc: new tabs land at the top of the regular list, under "New Tab".
      const first = this.tabs.findIndex((x) => !x.essential && !x.pinned && x.spaceId === t.spaceId);
      this.tabs.splice(first === -1 ? this.tabs.length : first, 0, t);
    }
    // Like Chrome: tabs you open start loading right away, even in the
    // background. Only tabs restored from the last session load lazily.
    if (!isInternalUrl(t.url) && this.win.webContents) this.ensureView(t);
    if (o.background) this.emit();
    else this.activate(t.id);
    return t;
  }

  private newTabState(url: string, spaceId?: string): TabState {
    return {
      id: newId(),
      url,
      title: isInternalUrl(url) ? internalTitle(url) : url,
      spaceId: spaceId && this.spaces.some((s) => s.id === spaceId) ? spaceId : this.activeSpaceId,
      pinned: false,
      essential: false,
      loading: false,
      canGoBack: false,
      canGoForward: false,
      audible: false,
      muted: false,
    };
  }

  private activate(id: string) {
    const t = this.tab(id);
    if (!t || t.glanceOf) return;
    // Moving to another tab dismisses the Glance, like Zen.
    if (this.glance && this.glance.parentId !== id) this.closeTab(this.glance.id, false);
    if (!t.essential && t.spaceId !== this.activeSpaceId) this.activeSpaceId = t.spaceId;
    this.space.activeTabId = id;
    this.emit();
  }

  private closeTab(id = this.glance?.id ?? this.activeTabId, remember = true) {
    const t = this.tab(id);
    if (!t || !id) return;
    if (this.glance?.parentId === id) this.closeTab(this.glance.id, false);
    if (this.glance?.id === id) this.glance = undefined;
    if (remember && !t.glanceOf) {
      this.closed.push({ url: t.url, spaceId: t.spaceId });
      if (this.closed.length > 25) this.closed.shift();
    }

    let replacement: string | undefined;
    if (this.split?.tabIds.includes(id)) {
      replacement = this.split.tabIds.find((x) => x !== id);
      this.split = undefined;
    }
    for (const s of this.spaces) {
      if (s.activeTabId !== id) continue;
      const list = this.visibleIn(s.id);
      const i = list.findIndex((x) => x.id === id);
      s.activeTabId = replacement ?? (list[i + 1] ?? list[i - 1])?.id;
    }
    this.tabs = this.tabs.filter((x) => x.id !== id);
    this.permissions.dismissTab(id);
    if (this.media?.tabId === id) this.media = undefined;
    this.destroyView(id);
    this.emit();
  }

  private setTab(c: Extract<Command, { type: 'tab:set' }>) {
    const t = this.tab(c.id);
    if (!t) return;
    if (c.essential !== undefined) {
      if (c.essential && !t.essential && this.tabs.filter((x) => x.essential).length >= ESSENTIALS_MAX) return;
      t.essential = c.essential;
      if (c.essential) t.pinned = false;
      else t.spaceId = this.activeSpaceId;
    }
    if (c.pinned !== undefined && !t.essential) t.pinned = c.pinned;
    if (c.spaceId && c.spaceId !== t.spaceId && this.spaces.some((s) => s.id === c.spaceId)) {
      const from = this.spaces.find((s) => s.id === t.spaceId);
      if (from?.activeTabId === t.id) {
        const list = this.visibleIn(from.id).filter((x) => x.id !== t.id && !x.essential);
        from.activeTabId = list[0]?.id;
      }
      if (this.split?.tabIds.includes(t.id)) this.split = undefined;
      t.spaceId = c.spaceId;
      t.essential = false;
    }
    if (c.muted !== undefined) {
      t.muted = c.muted;
      this.views.get(t.id)?.webContents.setAudioMuted(c.muted);
    }
    this.emit();
  }

  private move(c: { id: string; zone: DropZone; targetId?: string; position?: DropPosition }) {
    const t = this.tab(c.id);
    const target = this.tab(c.targetId);
    if (!t || target?.id === t.id) return;
    if (c.zone === 'essentials' && !t.essential && this.tabs.filter((x) => x.essential).length >= ESSENTIALS_MAX) return;
    t.essential = c.zone === 'essentials';
    t.pinned = c.zone === 'pinned';
    if (!t.essential) t.spaceId = this.activeSpaceId;
    this.tabs.splice(this.tabs.indexOf(t), 1);
    const at = target ? this.tabs.indexOf(target) + (c.position === 'after' ? 1 : 0) : this.tabs.length;
    this.tabs.splice(at, 0, t);
    this.emit();
  }

  private switchSpace(id: string) {
    if (!this.spaces.some((s) => s.id === id)) return;
    if (this.glance) this.closeTab(this.glance.id, false);
    this.activeSpaceId = id;
    const s = this.space;
    if (!this.tab(s.activeTabId)) s.activeTabId = this.visibleIn(id).find((t) => !t.essential)?.id;
    this.emit();
  }

  private wc(id?: string): WebContents | undefined {
    const v = this.views.get(id ?? this.glance?.id ?? this.activeTabId ?? '');
    return v && !v.webContents.isDestroyed() ? v.webContents : undefined;
  }

  run(c: Command): void {
    switch (c.type) {
      case 'tab:new':
        this.createTab(c);
        break;
      case 'tab:activate':
        this.activate(c.id);
        break;
      case 'tab:close':
        this.closeTab(c.id);
        break;
      case 'tab:navigate': {
        const t = this.tab(c.id ?? this.glance?.id ?? this.activeTabId);
        if (!t) {
          this.createTab({ url: c.input });
          break;
        }
        t.url = normalizeInput(c.input, this.searchUrl);
        if (isInternalUrl(t.url)) {
          this.destroyView(t.id);
          Object.assign(t, { title: internalTitle(t.url), favicon: undefined, loading: false, canGoBack: false, canGoForward: false });
        } else {
          this.wc(t.id)?.loadURL(t.url).catch(() => {});
        }
        this.emit();
        break;
      }
      case 'tab:back':
        this.wc(c.id)?.navigationHistory.goBack();
        break;
      case 'tab:forward':
        this.wc(c.id)?.navigationHistory.goForward();
        break;
      case 'tab:reload':
        this.wc(c.id)?.reload();
        break;
      case 'tab:move':
        this.move(c);
        break;
      case 'tab:set':
        this.setTab(c);
        break;
      case 'tab:reopen': {
        const last = this.closed.pop();
        if (last) this.createTab({ url: last.url, spaceId: last.spaceId });
        break;
      }
      case 'tab:cycle': {
        const list = this.visibleIn(this.activeSpaceId);
        if (!list.length) break;
        const i = list.findIndex((t) => t.id === this.activeTabId);
        this.activate(list[(i + c.dir + list.length) % list.length].id);
        break;
      }
      case 'split:create': {
        const [a, b] = c.ids.map((id) => this.tab(id));
        if (!a || !b || a === b) break;
        if (!b.essential && !a.essential) b.spaceId = a.spaceId;
        this.split = { tabIds: [a.id, b.id], ratio: 0.5 };
        this.activate(a.id);
        break;
      }
      case 'split:ratio':
        if (this.split) {
          this.split.ratio = clamp(c.ratio, 0.15, 0.85);
          this.emit();
        }
        break;
      case 'split:close':
        this.split = undefined;
        this.emit();
        break;
      case 'permission:reset':
        if (c.kind) this.permissions.setDecision(c.origin, c.kind, undefined);
        else this.permissions.clearSite(c.origin);
        this.emit();
        break;
      case 'settings:set':
        this.setSettings(c.patch);
        break;
      case 'settings:open':
        this.openSettings();
        break;
      case 'updates:check':
        void this.updater.checkApp();
        void this.updater.checkEngine();
        break;
      case 'updates:install':
        this.updater.install();
        break;
      case 'adblock:site': {
        const list = this.settings.adblockPaused.filter((h) => h !== c.host);
        this.setSettings({ adblockPaused: c.paused ? [...list, c.host] : list });
        this.wc()?.reload();
        break;
      }
      case 'media:control':
        this.mediaControl(c.id, c.action);
        break;
      case 'permission:respond':
        this.permissions.respond(c.id, c.allow, c.remember);
        break;
      case 'glance:close':
        if (this.glance) this.closeTab(this.glance.id, false);
        break;
      case 'glance:expand': {
        const t = this.promoteGlance();
        if (t) this.activate(t.id);
        break;
      }
      case 'glance:split': {
        const parentId = this.glance?.parentId;
        const t = this.promoteGlance();
        if (t && parentId) this.run({ type: 'split:create', ids: [parentId, t.id] });
        break;
      }
      case 'space:new': {
        const n = this.spaces.length;
        const s: SpaceState = { id: newId(), name: this.i18n.t('spaces.default', { n: n + 1 }), icon: ICONS[n % ICONS.length], accent: ACCENTS[n % ACCENTS.length] };
        this.spaces.push(s);
        this.activeSpaceId = s.id;
        this.emit();
        this.ui({ type: 'space:rename', id: s.id });
        break;
      }
      case 'space:activate':
        this.switchSpace(c.id);
        break;
      case 'space:cycle': {
        const i = this.spaces.findIndex((s) => s.id === this.activeSpaceId);
        this.switchSpace(this.spaces[(i + c.dir + this.spaces.length) % this.spaces.length].id);
        break;
      }
      case 'space:set': {
        const s = this.spaces.find((x) => x.id === c.id);
        if (!s) break;
        if (c.name?.trim()) s.name = c.name.trim().slice(0, 40);
        if (c.icon) s.icon = c.icon;
        if (c.accent) s.accent = c.accent;
        this.emit();
        break;
      }
      case 'space:delete': {
        if (this.spaces.length <= 1) break;
        for (const t of this.tabs.filter((x) => !x.essential && x.spaceId === c.id)) this.destroyView(t.id);
        this.tabs = this.tabs.filter((x) => x.essential || x.spaceId !== c.id);
        if (this.split && !this.split.tabIds.every((id) => this.tab(id))) this.split = undefined;
        this.spaces = this.spaces.filter((s) => s.id !== c.id);
        if (this.activeSpaceId === c.id) this.switchSpace(this.spaces[0].id);
        this.emit();
        break;
      }
      case 'space:clear':
        for (const t of this.tabs.filter((x) => !x.essential && !x.pinned && x.spaceId === c.id)) this.closeTab(t.id);
        break;
      case 'ui:compact':
        this.compact = c.value ?? !this.compact;
        this.emit();
        break;
      case 'ui:sidebarWidth':
        this.sidebarWidth = clamp(Math.round(c.width), SIDEBAR_MIN, SIDEBAR_MAX);
        this.emit();
        break;
      case 'win:minimize':
        this.win.minimize();
        break;
      case 'win:maximize':
        if (this.win.isMaximized()) this.win.unmaximize();
        else this.win.maximize();
        break;
      case 'win:close':
        this.win.close();
        break;
    }
  }

  // ---------------------------------------------------------------- glance

  /** Alt+click from a page: find which tab sent it, then open the Glance. */
  glanceFrom(sender: WebContents, p: { url?: unknown; x?: unknown; y?: unknown }) {
    for (const [id, v] of this.views) {
      if (v.webContents === sender) {
        void this.openGlance(id, String(p?.url ?? ''), { x: Number(p?.x) || 0, y: Number(p?.y) || 0 });
        return;
      }
    }
  }

  /**
   * Glance: preview a link in a floating card over the current page. The
   * preview is a real tab marked `glanceOf`, so it gets title, favicon and
   * navigation for free, and can become a normal tab without reloading.
   */
  private async openGlance(parentId: string, url: string, point?: { x: number; y: number }) {
    const parent = this.tab(parentId);
    if (!parent || !/^https?:/i.test(url)) return;
    // Alt+click inside a Glance just navigates the Glance.
    if (parent.glanceOf) {
      this.wc(parentId)?.loadURL(url).catch(() => {});
      return;
    }
    if (this.glance) this.closeTab(this.glance.id, false);
    if (this.activeTabId !== parentId) this.activate(parentId);

    const pane = this.panes.find((p) => p.tabId === parentId);
    const origin = pane && point ? { x: pane.rect.x + point.x, y: pane.rect.y + point.y } : undefined;
    // Native views paint above HTML, so the page behind the card becomes a dimmed screenshot.
    const snapshots = await this.captureVisible();
    if (this.win.isDestroyed()) return;
    const backdrop: UiEvent = { type: 'glance:backdrop', snapshots };
    this.win.webContents.send('drift:ui', backdrop);

    const t = this.newTabState(url, parent.essential ? this.activeSpaceId : parent.spaceId);
    t.glanceOf = parentId;
    this.tabs.push(t);
    this.glance = { id: t.id, parentId, origin };
    this.emit();
  }

  /** Turns the Glance into an ordinary tab placed right after its parent. */
  private promoteGlance(): TabState | undefined {
    const g = this.glance;
    const t = this.tab(g?.id);
    if (!g || !t) return undefined;
    this.glance = undefined;
    t.glanceOf = undefined;
    this.tabs.splice(this.tabs.indexOf(t), 1);
    const parent = this.tab(g.parentId);
    if (parent && !parent.essential && !parent.pinned) {
      this.tabs.splice(this.tabs.indexOf(parent) + 1, 0, t);
    } else {
      const first = this.tabs.findIndex((x) => !x.essential && !x.pinned && !x.glanceOf && x.spaceId === t.spaceId);
      this.tabs.splice(first === -1 ? this.tabs.length : first, 0, t);
    }
    return t;
  }

  private async captureVisible(): Promise<Snapshot[]> {
    const shots = await Promise.all(
      this.panes.map(async (p) => {
        const wc = this.wc(p.tabId);
        if (!wc || !this.shown.has(p.tabId)) return null;
        try {
          const img = await wc.capturePage();
          return { tabId: p.tabId, dataUrl: 'data:image/jpeg;base64,' + img.toJPEG(82).toString('base64') };
        } catch {
          return null;
        }
      }),
    );
    return shots.filter((s): s is Snapshot => s !== null);
  }

  // ---------------------------------------------------------------- views

  private ensureView(t: TabState) {
    let v = this.views.get(t.id);
    if (v) return v;
    v = new WebContentsView({
      webPreferences: {
        partition: PARTITION,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        preload: path.join(__dirname, 'tab-preload.js'),
      },
    });
    v.setBackgroundColor('#1b1b1b');
    // Rounded web content, available on recent Electron versions.
    (v as unknown as { setBorderRadius?: (r: number) => void }).setBorderRadius?.(this.contentRadius);
    v.setVisible(false);
    this.win.contentView.addChildView(v);
    this.views.set(t.id, v);
    this.wire(t.id, v.webContents);
    if (t.muted) v.webContents.setAudioMuted(true);
    v.webContents.loadURL(t.url).catch(() => {});
    return v;
  }

  private destroyView(id: string) {
    const v = this.views.get(id);
    if (!v) return;
    this.views.delete(id);
    this.shown.delete(id);
    if (this.fullscreenTab === id) this.fullscreenTab = undefined;
    try {
      this.win.contentView.removeChildView(v);
    } catch {
      /* window already gone */
    }
    if (!v.webContents.isDestroyed()) v.webContents.close();
  }

  private wire(id: string, wc: WebContents) {
    const patch = (p: Partial<TabState>) => {
      const t = this.tab(id);
      if (!t) return;
      Object.assign(t, p);
      this.emit();
    };
    const nav = () => ({
      url: wc.getURL() || this.tab(id)?.url || '',
      canGoBack: wc.navigationHistory.canGoBack(),
      canGoForward: wc.navigationHistory.canGoForward(),
    });

    wc.on('did-start-loading', () => patch({ loading: true }));
    wc.on('did-stop-loading', () => patch({ loading: false, ...nav() }));
    wc.on('did-start-navigation', (e) => {
      if (e.isMainFrame && !e.isSameDocument) {
        this.adblock.reset(wc.id);
        patch({ blocked: 0 });
      }
    });
    wc.on('did-navigate', () => {
      // A new document can't answer the old page's prompts.
      this.permissions.dismissTab(id);
      if (this.media?.tabId === id) this.media = undefined;
      patch(nav());
      if (!this.tab(id)?.glanceOf) this.history.visit(wc.getURL(), wc.getTitle());
    });
    wc.on('did-navigate-in-page', (_e, _url, isMainFrame) => {
      patch(nav());
      if (isMainFrame) this.history.visit(wc.getURL(), wc.getTitle());
    });
    wc.on('page-title-updated', (_e, title) => {
      patch({ title });
      this.history.title(wc.getURL(), title);
    });
    wc.on('page-favicon-updated', (_e, icons) => icons[0] && patch({ favicon: icons[0] }));
    wc.on('media-started-playing', () => {
      this.media = { tabId: id, playing: true };
      patch({ audible: true });
    });
    wc.on('media-paused', () => {
      if (this.media?.tabId === id) this.media = { tabId: id, playing: false };
      patch({ audible: false });
    });
    wc.on('enter-html-full-screen', () => {
      this.fullscreenTab = id;
      this.win.setFullScreen(true);
      this.applyLayout();
    });
    wc.on('leave-html-full-screen', () => {
      this.fullscreenTab = undefined;
      this.win.setFullScreen(false);
      this.applyLayout();
    });
    // Clicking into the other half of a split view makes it the active tab.
    wc.on('focus', () => {
      const s = this.split;
      if (s?.tabIds.includes(id) && this.activeTabId !== id && s.tabIds.includes(this.activeTabId ?? '')) {
        this.space.activeTabId = id;
        this.emit();
      }
    });
    wc.on('before-input-event', (e, input) => {
      if (this.shortcut(input)) e.preventDefault();
    });
    wc.on('context-menu', (_e, p) => this.pageMenu(id, wc, p));
    wc.setWindowOpenHandler(({ url, disposition }) => {
      // Real popups (OAuth, payment windows) keep window.opener, so let them open.
      if (disposition === 'new-window') {
        return { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true, backgroundColor: '#1b1b1b' } };
      }
      const opener = this.tab(id);
      // Like Zen, links that leave an Essential open in a Glance so the pinned app stays put.
      if (opener?.essential && disposition === 'foreground-tab') {
        void this.openGlance(id, url);
        return { action: 'deny' };
      }
      this.createTab({
        url,
        afterId: id,
        spaceId: opener?.essential ? this.activeSpaceId : opener?.spaceId,
        background: disposition === 'background-tab',
      });
      return { action: 'deny' };
    });
  }

  /** The shell reports where each visible tab should be drawn. */
  setPanes(panes: Pane[]) {
    this.panes = panes;
    for (const p of panes) {
      const t = this.tab(p.tabId);
      if (t && !isInternalUrl(t.url)) this.ensureView(t);
    }
    this.applyLayout();
  }

  private applyLayout() {
    if (this.win.isDestroyed()) return;
    let rects: Map<string, Pane['rect']>;
    if (this.fullscreenTab) {
      const [width, height] = this.win.getContentSize();
      rects = new Map([[this.fullscreenTab, { x: 0, y: 0, width, height }]]);
    } else {
      // While a Glance is open only its card is live; the pages behind it are screenshots.
      const g = this.glance;
      const live = this.overlay ? [] : this.panes.filter((p) => (g ? p.tabId === g.id : !this.tab(p.tabId)?.glanceOf));
      rects = new Map(live.map((p) => [p.tabId, p.rect] as const));
    }
    // In right-to-left UI languages (Hebrew, Arabic…) Chromium mirrors native
    // child-view coordinates, so flip x back to match the shell's CSS layout.
    const contentWidth = this.win.getContentSize()[0];
    const place = (r: Pane['rect']) => (RTL ? { ...r, x: contentWidth - r.x - r.width } : r);
    for (const [id, v] of this.views) {
      const r = rects.get(id);
      if (r && r.width > 0 && r.height > 0) {
        v.setBounds(place(r));
        if (!this.shown.has(id)) {
          v.setVisible(true);
          this.shown.add(id);
          if (id === (this.glance?.id ?? this.activeTabId)) v.webContents.focus();
        }
      } else if (this.shown.has(id)) {
        v.setVisible(false);
        this.shown.delete(id);
      }
    }
  }

  /**
   * Native views always paint above the shell's HTML, so before an HTML popup
   * (the command bar) covers the page we swap the views for screenshots.
   */
  async setOverlay(open: boolean): Promise<Snapshot[]> {
    const seq = ++this.overlaySeq;
    const snaps = open ? await this.captureVisible() : [];
    if (seq !== this.overlaySeq) return [];
    this.overlay = open;
    this.applyLayout();
    return snaps;
  }

  // ---------------------------------------------------------------- input & menus

  shortcut(i: Input): boolean {
    if (i.type !== 'keyDown') return false;
    const ctrl = i.control || i.meta;
    const k = i.key.toLowerCase();
    const run = (c: Command) => (this.run(c), true);

    if (k === 'escape' && this.glance && !this.overlay) return run({ type: 'glance:close' });

    if (ctrl && !i.alt && !i.shift && k === 't') return this.ui({ type: 'commandbar', mode: 'new' }), true;
    if (ctrl && !i.alt && !i.shift && k === ',') return run({ type: 'settings:open' });
    if ((ctrl && !i.alt && k === 'l') || k === 'f6') return this.ui({ type: 'commandbar', mode: 'current' }), true;
    if (ctrl && !i.alt && !i.shift && k === 'w') return run({ type: 'tab:close' });
    if (ctrl && i.shift && !i.alt && k === 't') return run({ type: 'tab:reopen' });
    if (ctrl && k === 'tab') return run({ type: 'tab:cycle', dir: i.shift ? -1 : 1 });
    if (ctrl && i.alt && k === 'c') return run({ type: 'ui:compact' });
    if (ctrl && i.alt && k === 'arrowright') return run({ type: 'space:cycle', dir: 1 });
    if (ctrl && i.alt && k === 'arrowleft') return run({ type: 'space:cycle', dir: -1 });
    if (ctrl && i.alt && k === 'v') {
      if (this.split?.tabIds.includes(this.activeTabId ?? '')) return run({ type: 'split:close' });
      const list = this.visibleIn(this.activeSpaceId);
      const i2 = list.findIndex((t) => t.id === this.activeTabId);
      const other = list[i2 + 1] ?? list[i2 - 1];
      if (this.activeTabId && other) this.run({ type: 'split:create', ids: [this.activeTabId, other.id] });
      return true;
    }
    if (ctrl && !i.alt && /^[1-9]$/.test(i.key)) {
      const list = this.visibleIn(this.activeSpaceId);
      const t = i.key === '9' ? list.at(-1) : list[Number(i.key) - 1];
      if (t) this.activate(t.id);
      return true;
    }
    if ((ctrl && !i.shift && k === 'r') || k === 'f5') return run({ type: 'tab:reload' });
    if (i.alt && !ctrl && k === 'arrowleft') return run({ type: 'tab:back' });
    if (i.alt && !ctrl && k === 'arrowright') return run({ type: 'tab:forward' });
    if (k === 'f12' || (ctrl && i.shift && !i.alt && k === 'i')) {
      const wc = this.wc();
      if (wc) {
        if (wc.isDevToolsOpened()) wc.closeDevTools();
        else wc.openDevTools({ mode: 'right' });
      }
      return true;
    }
    if (ctrl && i.shift && i.alt && k === 'i') {
      this.win.webContents.openDevTools({ mode: 'detach' });
      return true;
    }
    return false;
  }

  tabMenu(id: string) {
    const t = this.tab(id);
    if (!t) return;
    const active = this.activeTabId;
    const inSplit = !!this.split?.tabIds.includes(id);
    const items: MenuItemConstructorOptions[] = [
      { label: t.essential ? this.i18n.t('menu.removeEssential') : this.i18n.t('menu.addEssential'), click: () => this.run({ type: 'tab:set', id, essential: !t.essential }) },
      { label: t.pinned ? this.i18n.t('menu.unpin') : this.i18n.t('menu.pin'), enabled: !t.essential, click: () => this.run({ type: 'tab:set', id, pinned: !t.pinned }) },
      inSplit
        ? { label: this.i18n.t('menu.closeSplit'), click: () => this.run({ type: 'split:close' }) }
        : { label: this.i18n.t('menu.splitWithCurrent'), enabled: !!active && active !== id, click: () => active && this.run({ type: 'split:create', ids: [active, id] }) },
      { type: 'separator' },
      { label: t.muted ? this.i18n.t('menu.unmute') : this.i18n.t('menu.mute'), click: () => this.run({ type: 'tab:set', id, muted: !t.muted }) },
      { label: this.i18n.t('menu.reload'), click: () => this.run({ type: 'tab:reload', id }) },
      { label: this.i18n.t('menu.duplicate'), click: () => this.createTab({ url: t.url, afterId: id }) },
      { label: this.i18n.t('menu.copyLink'), click: () => clipboard.writeText(t.url) },
      {
        label: this.i18n.t('menu.moveTo'),
        enabled: this.spaces.length > 1,
        submenu: this.spaces
          .filter((s) => s.id !== t.spaceId || t.essential)
          .map((s) => ({ label: `${s.icon}  ${s.name}`, click: () => this.run({ type: 'tab:set', id, spaceId: s.id }) })),
      },
      { type: 'separator' },
      { label: this.i18n.t('menu.closeTab'), accelerator: 'Ctrl+W', click: () => this.run({ type: 'tab:close', id }) },
    ];
    Menu.buildFromTemplate(items).popup({ window: this.win });
  }

  /** Remembered permissions for the site in the focused tab (lock icon in the URL pill). */
  siteMenu() {
    const t = this.tab(this.glance?.id ?? this.activeTabId);
    if (!t || !/^https?:/i.test(t.url)) return;
    const origin = originOf(t.url);
    const decisions = this.permissions.siteDecisions(origin);
    const items: MenuItemConstructorOptions[] = [{ label: hostOf(origin), enabled: false }, { type: 'separator' }];
    if (decisions.length === 0) items.push({ label: this.i18n.t('menu.noPermissions'), enabled: false });
    for (const [kind, d] of decisions) {
      items.push({
        label: `${permissionShortName(kind, this.i18n.t)}: ${d === 'allow' ? this.i18n.t('menu.allowed') : this.i18n.t('menu.blocked')}`,
        submenu: [
          { label: this.i18n.t('menu.allow'), type: 'radio', checked: d === 'allow', click: () => this.permissions.setDecision(origin, kind, 'allow') },
          { label: this.i18n.t('menu.block'), type: 'radio', checked: d === 'block', click: () => this.permissions.setDecision(origin, kind, 'block') },
          { type: 'separator' },
          { label: this.i18n.t('menu.askNext'), click: () => this.permissions.setDecision(origin, kind, undefined) },
        ],
      });
    }
    if (decisions.length > 0) {
      items.push(
        { type: 'separator' },
        { label: this.i18n.t('menu.resetReload'), click: () => (this.permissions.clearSite(origin), this.wc(t.id)?.reload()) },
      );
    }
    Menu.buildFromTemplate(items).popup({ window: this.win });
  }

  // ---------------------------------------------------------------- ad blocking

  private tabIdForWc(wcId: number) {
    for (const [id, v] of this.views) if (!v.webContents.isDestroyed() && v.webContents.id === wcId) return id;
    return undefined;
  }

  /** Paused for this site or any parent domain (pausing example.com covers www.example.com). */
  private sitePaused(url: string) {
    const host = hostOfUrl(url);
    return !!host && this.settings.adblockPaused.some((h) => host === h || host.endsWith('.' + h));
  }

  adblockActiveFor(url: string) {
    return this.adblock.activeFor(url);
  }

  /** The shield in the address bar: blocked count and per-site switch, like Brave Shields. */
  shieldMenu() {
    const t = this.tab(this.glance?.id ?? this.activeTabId);
    const host = t ? hostOfUrl(t.url) : '';
    const on = this.settings.adblock;
    const paused = !!host && this.sitePaused(t!.url);
    const items: MenuItemConstructorOptions[] = [
      { label: host ? `${this.i18n.t('menu.shields')} · ${host}` : this.i18n.t('menu.shields'), enabled: false },
      {
        label: !on ? this.i18n.t('menu.shieldsOff') : !this.adblock.ready ? this.i18n.t('menu.shieldsLoading') : paused ? this.i18n.t('menu.shieldsPaused') : this.i18n.t('menu.shieldsCount', { count: t?.blocked ?? 0 }),
        enabled: false,
      },
      { type: 'separator' },
      {
        label: this.i18n.t('menu.blockSite'),
        type: 'checkbox',
        checked: on && !paused,
        enabled: on && !!host,
        click: () => this.run({ type: 'adblock:site', host, paused: !paused }),
      },
      {
        label: this.i18n.t('menu.blockAll'),
        type: 'checkbox',
        checked: on,
        click: () => {
          this.setSettings({ adblock: !on });
          this.wc()?.reload();
        },
      },
      { type: 'separator' },
      { label: this.i18n.t('menu.adSettings'), click: () => this.openSettings() },
    ];
    Menu.buildFromTemplate(items).popup({ window: this.win });
  }

  // ---------------------------------------------------------------- media

  /** Play/pause and next/previous for the page playing audio or video (YouTube, Spotify, SoundCloud…). */
  private mediaControl(id: string, action: 'toggle' | 'next' | 'prev') {
    const wc = this.wc(id);
    if (!wc) return;
    const scripts = {
      toggle: `(() => { const all = [...document.querySelectorAll('video, audio')]; const m = all.find((x) => !x.paused) || all[0]; if (m) m.paused ? m.play() : m.pause(); })()`,
      next: `(() => { const b = document.querySelector('.ytp-next-button, [data-testid=control-button-skip-forward], .skipControl__next'); if (b) b.click(); })()`,
      prev: `(() => { const v = document.querySelector('video, audio'); if (v && v.currentTime > 3) { v.currentTime = 0; return; } const b = document.querySelector('.ytp-prev-button, [data-testid=control-button-skip-back], .skipControl__previous'); if (b) b.click(); })()`,
    };
    void wc.executeJavaScript(scripts[action], true).catch(() => {});
  }

  // ---------------------------------------------------------------- import

  /** Bring bookmarks, history and (from Zen) spaces and pinned tabs from another browser. */
  async runImport(source: ImportBrowser, options: ImportOptions): Promise<ImportResult> {
    const r: ImportResult = { source, bookmarks: 0, history: 0, spaces: 0, pinned: 0, essentials: 0, tabs: 0 };
    let data: ReturnType<typeof readSource>;
    try {
      data = readSource(source);
    } catch (e) {
      r.error = String((e as Error)?.message ?? e);
      return r;
    }
    const name = sourceName(source);
    this.history.add(data.bookmarks, name);
    this.history.add(data.history, name);
    r.bookmarks = data.bookmarks.length;
    r.history = data.history.length;

    // Tabs from another browser start unloaded and load when you open them.
    const addTab = (url: string, title: string, spaceId: string, flags: Partial<TabState>) => {
      const t = { ...this.newTabState(url, spaceId), title: title || url, ...flags };
      this.tabs.push(t);
      return t;
    };
    const icon: Record<ImportBrowser, string> = { zen: '🧘', firefox: '🦊', chrome: '🌐', brave: '🦁', edge: '🌊' };

    if (data.zen && options.zenSpaces && data.zen.tabs.length) {
      const ids = new Map<string, string>();
      data.zen.spaces.forEach((zs, i) => {
        const n = this.spaces.length;
        const s: SpaceState = { id: newId(), name: zs.name, icon: i === 0 ? icon.zen : ICONS[n % ICONS.length], accent: ACCENTS[n % ACCENTS.length] };
        this.spaces.push(s);
        ids.set(zs.id, s.id);
        r.spaces++;
      });
      const fallback = ids.values().next().value ?? this.activeSpaceId;
      let room = ESSENTIALS_MAX - this.tabs.filter((t) => t.essential).length;
      const seenEssentials = new Set(this.tabs.filter((t) => t.essential).map((t) => t.url));
      for (const zt of data.zen.tabs) {
        const spaceId = ids.get(zt.spaceId) ?? fallback;
        if (zt.essential) {
          if (room > 0 && !seenEssentials.has(zt.url)) {
            addTab(zt.url, zt.title, spaceId, { essential: true, favicon: zt.favicon });
            seenEssentials.add(zt.url);
            room--;
            r.essentials++;
          }
        } else if (zt.pinned) {
          addTab(zt.url, zt.title, spaceId, { pinned: true, favicon: zt.favicon });
          r.pinned++;
        } else if (r.tabs < 200) {
          addTab(zt.url, zt.title, spaceId, { favicon: zt.favicon });
          r.tabs++;
        }
      }
    } else if (options.bookmarksAsPinned && data.bookmarkBar.length) {
      const n = this.spaces.length;
      const s: SpaceState = { id: newId(), name: this.i18n.t('imp.from', { browser: name }), icon: icon[source], accent: ACCENTS[n % ACCENTS.length] };
      this.spaces.push(s);
      r.spaces = 1;
      for (const b of data.bookmarkBar.slice(0, 40)) {
        addTab(b.url, b.title, s.id, { pinned: true });
        r.pinned++;
      }
    }
    this.emit();
    return r;
  }

  /** The ⋮ menu in top-tab layouts. */
  appMenu() {
    const items: MenuItemConstructorOptions[] = [
      { label: this.i18n.t('menu.newTab'), accelerator: 'Ctrl+T', click: () => this.ui({ type: 'commandbar', mode: 'new' }) },
      { label: this.i18n.t('menu.reopen'), accelerator: 'Ctrl+Shift+T', enabled: this.closed.length > 0, click: () => this.run({ type: 'tab:reopen' }) },
      { label: this.i18n.t('menu.newSpace'), click: () => this.run({ type: 'space:new' }) },
      { type: 'separator' },
      { label: this.i18n.t('menu.verticalTabs'), type: 'checkbox', checked: this.settings.verticalTabs, click: () => this.setSettings({ verticalTabs: !this.settings.verticalTabs }) },
      { label: this.i18n.t('menu.splitNext'), accelerator: 'Ctrl+Alt+V', click: () => this.shortcut({ type: 'keyDown', key: 'v', control: true, alt: true } as Input) },
      { type: 'separator' },
      { label: this.i18n.t('menu.settings'), accelerator: 'Ctrl+,', click: () => this.openSettings() },
      { label: this.i18n.t('menu.devtools'), accelerator: 'F12', click: () => this.shortcut({ type: 'keyDown', key: 'F12' } as Input) },
      { type: 'separator' },
      { label: this.i18n.t('menu.exit'), click: () => this.win.close() },
    ];
    Menu.buildFromTemplate(items).popup({ window: this.win });
  }

  /** Space switcher button at the start of the top tab strip. */
  spacesMenu() {
    const items: MenuItemConstructorOptions[] = this.spaces.map((s) => ({
      label: `${s.icon}  ${s.name}`,
      type: 'radio',
      checked: s.id === this.activeSpaceId,
      click: () => this.switchSpace(s.id),
    }));
    items.push(
      { type: 'separator' },
      { label: this.i18n.t('menu.newSpace'), click: () => this.run({ type: 'space:new' }) },
      { label: this.i18n.t('menu.editSpace'), click: () => this.spaceMenu(this.activeSpaceId) },
    );
    Menu.buildFromTemplate(items).popup({ window: this.win });
  }

  spaceMenu(id: string) {
    const s = this.spaces.find((x) => x.id === id);
    if (!s) return;
    const items: MenuItemConstructorOptions[] = [
      { label: this.i18n.t('menu.renameSpace'), click: () => this.ui({ type: 'space:rename', id }) },
      { label: this.i18n.t('menu.icon'), submenu: ICONS.map((icon) => ({ label: icon, type: 'radio', checked: s.icon === icon, click: () => this.run({ type: 'space:set', id, icon }) })) },
      { label: this.i18n.t('menu.colour'), submenu: ACCENTS.map((accent) => ({ label: accent, type: 'radio', checked: s.accent === accent, click: () => this.run({ type: 'space:set', id, accent }) })) },
      { type: 'separator' },
      { label: this.i18n.t('menu.clearSpace'), click: () => this.run({ type: 'space:clear', id }) },
      { label: this.i18n.t('menu.deleteSpace'), enabled: this.spaces.length > 1, click: () => this.run({ type: 'space:delete', id }) },
    ];
    Menu.buildFromTemplate(items).popup({ window: this.win });
  }

  private pageMenu(id: string, wc: WebContents, p: ContextMenuParams) {
    const items: MenuItemConstructorOptions[] = [];
    const sep: MenuItemConstructorOptions = { type: 'separator' };
    if (p.linkURL) {
      items.push(
        { label: this.i18n.t('menu.openNewTab'), click: () => this.createTab({ url: p.linkURL, afterId: id, background: true }) },
        { label: this.i18n.t('menu.openGlance'), sublabel: 'Alt+Click', click: () => void this.openGlance(id, p.linkURL, { x: p.x, y: p.y }) },
        {
          label: this.i18n.t('menu.openSplit'),
          click: () => {
            const t = this.createTab({ url: p.linkURL, afterId: id, background: true });
            this.run({ type: 'split:create', ids: [id, t.id] });
          },
        },
        { label: this.i18n.t('menu.copyLink'), click: () => clipboard.writeText(p.linkURL) },
        sep,
      );
    }
    if (p.mediaType === 'image' && p.srcURL) {
      items.push(
        { label: this.i18n.t('menu.openImage'), click: () => this.createTab({ url: p.srcURL, afterId: id }) },
        { label: this.i18n.t('menu.copyImage'), click: () => wc.copyImageAt(p.x, p.y) },
        sep,
      );
    }
    if (p.isEditable) {
      items.push({ role: 'undo' }, { role: 'redo' }, sep, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }, sep);
    } else if (p.selectionText.trim()) {
      const q = p.selectionText.trim();
      items.push({ role: 'copy' }, { label: this.i18n.t('menu.searchFor', { text: q.length > 30 ? q.slice(0, 30) + '…' : q }), click: () => this.createTab({ url: q, afterId: id }) }, sep);
    }
    items.push(
      { label: this.i18n.t('menu.back'), enabled: wc.navigationHistory.canGoBack(), click: () => wc.navigationHistory.goBack() },
      { label: this.i18n.t('menu.forward'), enabled: wc.navigationHistory.canGoForward(), click: () => wc.navigationHistory.goForward() },
      { label: this.i18n.t('menu.reload'), click: () => wc.reload() },
      sep,
      { label: this.i18n.t('menu.inspect'), click: () => wc.inspectElement(p.x, p.y) },
    );
    Menu.buildFromTemplate(items).popup({ window: this.win });
  }
}
