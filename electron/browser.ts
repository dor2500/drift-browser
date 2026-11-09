import {
  BrowserWindow,
  ClipboardItem,
  dialog,
  DownloadItem,
  Menu,
  app,
  shell,
  WebContentsView,
  clipboard,
  session,
  type ContextMenuParams,
  type Input,
  type MenuItemConstructorOptions,
  type WebContents,
} from 'electron';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  ESSENTIALS_MAX,
  SIDEBAR_MAX,
  SIDEBAR_MIN,
  type BrowserState,
  type Command,
  type DropPosition,
  type DownloadInfo,
  type DropZone,
  type FindState,
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
import { DEFAULT_SETTINGS, SEARCH_ENGINES, type FontSizePreset, type Settings, type SettingsPatch } from '../shared/settings';
import { THEMES, contentRadiusFor } from '../shared/themes';
import type { MessageKey } from '../shared/i18n';
import { NEWTAB_URL, SETTINGS_URL, STORE_URL, SHORTCUTS_URL, internalTitle, isInternalUrl, isSafeRemoteUrl, normalizeInput } from '../shared/url';
import { permissionShortName, hostOf } from '../shared/permissions';
import { AdBlock, hostOfUrl } from './adblock';
import { BROWSER_NAMES, openInBrowser, otherBrowsers } from './env';
import { applyGeckoEngineToWebContents, downloadGecko, geckoStatus, getGeckoUserAgent } from './gecko';
import { FirebaseSyncManager, type Incoming, type LocalData } from './firebase-sync';
import { HistoryIndex } from './history';
import { RequestHub } from './requests';
import { readSource, sourceName } from './importer';
import { Permissions, originOf } from './permissions';
import { applyPatch, loadSettings, saveSettings } from './settings';
import * as store from './store';
import { Updater } from './updater';
import { I18n } from './i18n';
import { StateManager, type SyncDomain } from './state-manager';
import { DarkModeEngine } from './dark-mode-engine';
import { OllamaService } from './ollama-service';
import { ClipboardMonitor } from './clipboard-sync';

export const PARTITION = 'persist:drift';

/** Read once the app is ready (Browser is only constructed after that). */
let RTL = false;
const RTL_LANGS = new Set(['he', 'iw', 'ar', 'fa', 'ur', 'yi', 'ps', 'sd', 'ug', 'ckb', 'dv']);
export function detectRtl(locale: string) {
  RTL = RTL_LANGS.has(locale.toLowerCase().split('-')[0]);
}

const ACCENTS = ['#8aa4ff', '#f5a97f', '#a6da95', '#f5bde6', '#91d7e3', '#eed49f', '#c6a0f6', '#ee99a0'];
/** Space icons (drawn by the shell's icon set; older emoji values are migrated). */
const ICONS = ['home', 'work', 'game', 'book', 'palette', 'music', 'flask', 'plane', 'cart', 'chat'];
const EMOJI_ICONS: Record<string, string> = {
  '🏠': 'home', '💼': 'work', '🎮': 'game', '📚': 'book', '🎨': 'palette', '🎵': 'music', '🧪': 'flask', '✈️': 'plane', '🛒': 'cart', '💬': 'chat',
  '📥': 'inbox', '🧘': 'home', '🦊': 'fox', '🌐': 'globe', '🦁': 'shield', '🌊': 'globe',
};

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

  readonly stateMgr = new StateManager();
  readonly permissions: Permissions;
  readonly updater: Updater;
  readonly history: HistoryIndex;
  readonly adblock: AdBlock;
  readonly darkEngine: DarkModeEngine;
  readonly ollama: OllamaService;
  readonly clipboardMonitor: ClipboardMonitor;
  private sync!: FirebaseSyncManager;
  private settings: Settings = loadSettings();
  /** Hosts whose https upgrade failed; they load over http. */
  private httpOk = new Set<string>();
  private hub!: RequestHub;
  readonly i18n = new I18n(() => this.settings.language);
  private media?: MediaState;
  private blockedTotal = 0;
  private statsSince = Date.now();
  private downloads: DownloadInfo[] = [];
  private downloadItems = new Map<string, DownloadItem>();
  private find?: FindState;
  /** When each tab was last in front, for sleeping tabs. */
  private lastActive = new Map<string, number>();

  constructor(private win: BrowserWindow) {
    this.stateMgr.settings = this.settings;
    this.history = new HistoryIndex(() => this.stateMgr.notifyDomainChanged('history'));
    this.darkEngine = new DarkModeEngine(() => this.settings.darkMode);
    this.ollama = new OllamaService(this.stateMgr, () => this.wc());
    this.clipboardMonitor = new ClipboardMonitor(this.stateMgr, () => ({
      deviceId: this.sync?.deviceId ?? 'local',
      deviceName: this.sync?.deviceName ?? 'This Device',
      shouldMonitor: () => this.settings.clipboardSync.enabled,
    }));
    this.stateMgr.on('state:updated', () => this.emit());
    this.stateMgr.on('domain:changed', (domain: SyncDomain) => this.sync?.notifyLocalChange(domain));

    this.updater = new Updater(() => this.settings, () => this.emit(), (k) => this.i18n.t(k));
    this.permissions = new Permissions({
      tabIdFor: (wc) => [...this.views].find(([, v]) => v.webContents === wc)?.[0],
      changed: () => this.emit(),
    });
    this.permissions.install(session.fromPartition(PARTITION));
    this.setupDownloads(session.fromPartition(PARTITION));
    setInterval(() => this.sleepIdleTabs(), 60_000);
    this.adblock = new AdBlock({
      enabled: () => this.settings.adblock,
      isPaused: (url) => this.sitePaused(url),
      toggled: () => this.hub?.install(),
      blocked: (wcId, count) => {
        const id = this.tabIdForWc(wcId);
        const t = this.tab(id);
        this.blockedTotal++;
        if (t && t.blocked !== count) {
          t.blocked = count;
          this.emit();
        }
      },
    });
    this.hub = new RequestHub(session.fromPartition(PARTITION), {
      privacy: () => this.settings.privacy,
      engine: () => this.settings.engine,
      adblockActive: () => this.adblock.isActive,
      blocker: () => this.adblock.engine,
      isPaused: (url) => this.sitePaused(url),
      httpAllowed: (host) => this.httpOk.has(host),
      geckoUA: () => getGeckoUserAgent(),
    });
    this.hub.install();
    void this.adblock.init(session.fromPartition(PARTITION), this.settings.hideAnnoyances);
    this.restore(store.load());
    this.sync = new FirebaseSyncManager({
      collect: () => this.collectForSync(),
      apply: (incoming) => this.applySynced(incoming),
      changed: () => this.emit(),
      otherDevicesChanged: () => this.emit(),
      openSignIn: (url) => this.createTab({ url }).id,
      closeSignIn: (id) => this.closeTab(id, false),
      focusWindow: () => {
        if (!this.win.isDestroyed()) {
          if (this.win.isMinimized()) this.win.restore();
          this.win.focus();
        }
      },
    });
    void this.sync.start();
    this.clipboardMonitor.start();
    void this.ollama.refreshModels();
    this.applyDnsOverHttps();
    session.fromPartition(PARTITION).setSpellCheckerEnabled(this.settings.spellCheck);
    win.on('resize', () => this.fullscreenTab && this.applyLayout());
    this.updater.schedule();
    try {
      const st = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'stats.json'), 'utf8')) as { blocked?: number; since?: number };
      this.blockedTotal = Number(st.blocked) || 0;
      this.statsSince = Number(st.since) || Date.now();
    } catch {
      /* first run */
    }
    setInterval(() => {
      try {
        fs.writeFileSync(path.join(app.getPath('userData'), 'stats.json'), JSON.stringify({ blocked: this.blockedTotal, since: this.statsSince }));
      } catch {
        /* ignore */
      }
    }, 30_000);
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
    this.stateMgr.settings = this.settings;
    saveSettings(this.settings);
    this.stateMgr.notifyDomainChanged('settings');
    if (contentRadiusFor(before) !== this.contentRadius) {
      for (const v of this.views.values()) (v as unknown as { setBorderRadius?: (r: number) => void }).setBorderRadius?.(this.contentRadius);
    }
    if (patch.updates || patch.onboarded !== undefined) this.updater.schedule();
    if (patch.adblock !== undefined) this.adblock.apply();
    if (patch.hideAnnoyances !== undefined) void this.adblock.setAnnoyances(this.settings.hideAnnoyances);
    if (patch.privacy?.webrtcProtect !== undefined) {
      for (const v of this.views.values()) v.webContents.setWebRTCIPHandlingPolicy(this.settings.privacy.webrtcProtect ? 'default_public_interface_only' : 'default');
    }
    if (patch.darkMode !== undefined || patch.forceDark !== undefined) {
      this.applyDarkModeToAllViews();
    }
    if (patch.ai?.endpoint !== undefined) {
      void this.ollama.refreshModels();
    }
    if (patch.ai?.model !== undefined && patch.ai.model) {
      this.stateMgr.ai.selectedModel = patch.ai.model;
    }
    if (patch.privacy?.dnsOverHttps !== undefined) {
      this.applyDnsOverHttps();
    }
    if (patch.spellCheck !== undefined) {
      session.fromPartition(PARTITION).setSpellCheckerEnabled(this.settings.spellCheck);
    }
    if (patch.defaultZoom !== undefined) {
      for (const id of this.views.keys()) this.applySiteZoom(id);
    }
    if (patch.fontSize !== undefined) {
      for (const v of this.views.values()) {
        if (!v.webContents.isDestroyed()) this.applyFontSize(v.webContents);
      }
    }
    if (patch.energySaver !== undefined) {
      for (const v of this.views.values()) {
        if (!v.webContents.isDestroyed()) {
          v.webContents.setBackgroundThrottling(this.settings.energySaver);
          v.webContents.setFrameRate(this.settings.energySaver ? 30 : 60);
        }
      }
    }
    if (patch.language !== undefined) this.i18n.reload();
    this.emit();
  }

  private applyDnsOverHttps() {
    const mode = this.settings.privacy.dnsOverHttps;
    const servers: Record<string, string> = {
      cloudflare: 'https://cloudflare-dns.com/dns-query',
      google: 'https://dns.google/dns-query',
      quad9: 'https://dns.quad9.net/dns-query',
    };
    try {
      if (mode === 'off') {
        app.configureHostResolver({ secureDnsMode: 'off' });
      } else if (mode === 'auto') {
        app.configureHostResolver({ secureDnsMode: 'automatic' });
      } else if (servers[mode]) {
        app.configureHostResolver({ secureDnsMode: 'secure', secureDnsServers: [servers[mode]] });
      }
    } catch {
      /* ignore if called before ready */
    }
  }

  private fontSizePx(preset: FontSizePreset = this.settings.fontSize): number {
    const map: Record<FontSizePreset, number> = {
      xsmall: 12,
      small: 14,
      medium: 16,
      large: 18,
      xlarge: 20,
    };
    return map[preset] ?? 16;
  }

  private applyFontSize(wc: WebContents) {
    if (this.settings.fontSize === 'medium') return;
    const px = this.fontSizePx();
    void wc.insertCSS(`html { font-size: ${px}px !important; }`).catch(() => {});
  }

  private applyDarkModeToAllViews() {
    for (const v of this.views.values()) {
      if (!v.webContents.isDestroyed()) {
        this.darkEngine.applyToWebContents(v.webContents);
      }
    }
  }

  private openSettings() {
    const existing = this.tabs.find((t) => !t.glanceOf && t.url.startsWith(SETTINGS_URL));
    if (existing) this.activate(existing.id);
    else this.createTab({ url: SETTINGS_URL });
  }

  private openStore() {
    const existing = this.tabs.find((t) => !t.glanceOf && t.url.startsWith(STORE_URL));
    if (existing) this.activate(existing.id);
    else this.createTab({ url: STORE_URL });
  }

  private openShortcuts() {
    const existing = this.tabs.find((t) => !t.glanceOf && t.url.startsWith(SHORTCUTS_URL));
    if (existing) this.activate(existing.id);
    else this.createTab({ url: SHORTCUTS_URL });
  }

  // ---------------------------------------------------------------- model

  private restore(d: store.Persisted | null) {
    const continueSession =
      this.settings.startupMode === 'continue' ||
      (this.settings.startupMode !== 'newtab' && this.settings.startupMode !== 'urls' && this.settings.restoreSession);
    if (d) {
      this.spaces = d.spaces.map((s) => ({ ...s, icon: EMOJI_ICONS[s.icon] ?? s.icon }));
      this.activeSpaceId = d.spaces.some((s) => s.id === d.activeSpaceId) ? d.activeSpaceId : d.spaces[0].id;
      this.tabs = d.tabs
        .filter((t) => !('glanceOf' in t) && (t.essential || this.spaces.some((s) => s.id === t.spaceId)))
        .filter((t) => continueSession || t.pinned || t.essential)
        .map((t) => ({ ...t, muted: !!t.muted, loading: false, canGoBack: false, canGoForward: false, audible: false }));
      this.compact = !!d.compact;
      this.sidebarWidth = clamp(d.sidebarWidth ?? 260, SIDEBAR_MIN, SIDEBAR_MAX);
      if (d.split?.tabIds.every((id) => this.tab(id))) this.split = d.split;
      for (const s of this.spaces) if (s.activeTabId && !this.tab(s.activeTabId)) s.activeTabId = undefined;
      if (!continueSession) {
        if (this.settings.startupMode === 'urls' && this.settings.startupUrls.length > 0) {
          for (const u of this.settings.startupUrls) {
            if (u.trim()) this.createTab({ url: u.trim() });
          }
        } else if (!this.tabs.some((t) => !t.essential && t.spaceId === this.activeSpaceId)) {
          this.createTab({ url: this.settings.startupMode === 'newtab' ? NEWTAB_URL : this.settings.homePage });
        }
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
      tabs: this.tabs.map((t) => (isInternalUrl(t.url) || this.views.has(t.id) ? t : { ...t, asleep: true })),
      spaces: this.spaces,
      activeSpaceId: this.activeSpaceId,
      activeTabId: this.activeTabId,
      split: this.split,
      glance: this.glance,
      prompts: this.permissions.prompts,
      media: this.media,
      downloads: this.downloads,
      find: this.find,
      settings: this.settings,
      updates: this.updater.status,
      compact: this.compact,
      sidebarWidth: this.sidebarWidth,
      sync: this.sync.state(),
      clipboard: this.stateMgr.clipboard,
      ai: this.stateMgr.ai,
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
    const target = o.url ? normalizeInput(o.url, this.searchUrl) : this.settings.newTabPage === 'newtab' ? NEWTAB_URL : this.settings.homePage;
    if (this.handOff(target)) return this.tab(this.activeTabId) ?? this.newTabState(target, o.spaceId);
    const t = this.newTabState(target, o.spaceId);
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
    this.stateMgr.notifyDomainChanged('tabs');
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
    const prev = this.space.activeTabId;
    if (prev && prev !== id) this.lastActive.set(prev, Date.now());
    this.lastActive.set(id, Date.now());
    if (this.find && this.find.tabId !== id) this.closeFind();
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
    this.stateMgr.notifyDomainChanged('tabs');
    if (t.pinned || t.essential) this.stateMgr.notifyDomainChanged('bookmarks');
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
    this.stateMgr.notifyDomainChanged('tabs');
    this.stateMgr.notifyDomainChanged('bookmarks');
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
    this.stateMgr.notifyDomainChanged('tabs');
    this.stateMgr.notifyDomainChanged('bookmarks');
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
        const next = normalizeInput(c.input, this.searchUrl);
        if (this.handOff(next)) break;
        t.url = next;
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
      case 'store:open':
        this.openStore();
        break;
      case 'shortcuts:open':
        this.openShortcuts();
        break;
      case 'settings:reset':
        this.setSettings({ ...DEFAULT_SETTINGS, onboarded: true });
        break;
      case 'privacy:newIdentity':
        void this.newIdentity();
        break;
      case 'privacy:clearData':
        void this.clearBrowsingData(c.range, c.history, c.cookies, c.cache);
        break;
      case 'downloads:chooseFolder':
        void this.chooseDownloadFolder();
        break;
      case 'app:setDefaultBrowser':
        try {
          app.setAsDefaultProtocolClient('http');
          app.setAsDefaultProtocolClient('https');
        } catch (e) {
          console.warn('[drift] failed to set as default protocol client', e);
        }
        this.emit();
        break;
      case 'win:incognito':
        this.openIncognitoWindow(c.url);
        break;
      case 'win:taskManager':
        this.openTaskManagerWindow();
        break;
      case 'bookmark:toggle': {
        const t = this.tab(this.activeTabId);
        const url = c.url ?? t?.url;
        const title = c.title ?? t?.title ?? url ?? '';
        if (url && /^https?:/i.test(url)) {
          this.history.toggleBookmark(url, title);
          if (t && !t.essential) {
            t.pinned = !t.pinned;
            this.stateMgr.notifyDomainChanged('bookmarks');
            this.emit();
          }
        }
        break;
      }
      case 'page:readingMode':
        this.toggleReadingMode();
        break;
      case 'sync:signin':
        void this.sync.signIn().catch((err: Error) => this.sync.fail(err.message));
        break;
      case 'sync:signout':
        void this.sync.signOut();
        break;
      case 'sync:now':
        void this.sync.syncNow();
        break;
      case 'sync:what':
        this.sync.setWhat(c.what);
        void this.sync.syncNow();
        break;
      case 'sync:key':
        this.sync.setClient({ clientId: c.clientId, clientSecret: c.clientSecret });
        break;
      case 'sync:firebase-config':
        this.sync.setFirebaseConfig(c.config);
        break;
      case 'handoff:send':
        void this.sync.sendTabToDevice(c.url, c.title, c.targetDeviceId).catch((err: Error) => this.sync.fail(err.message));
        break;
      case 'handoff:dismiss':
        void this.sync.dismissHandoff(c.id);
        break;
      case 'clipboard:push':
        this.clipboardMonitor.captureNow(c.text);
        break;
      case 'clipboard:copy': {
        const entry = this.stateMgr.clipboard.find((x) => x.id === c.id);
        if (entry) this.clipboardMonitor.writeSystemClipboard(entry.text);
        break;
      }
      case 'clipboard:pin':
        this.stateMgr.setClipboardPin(c.id, c.pinned);
        break;
      case 'clipboard:delete':
        this.stateMgr.deleteClipboardItem(c.id);
        break;
      case 'clipboard:clear':
        this.stateMgr.clearClipboard();
        break;
      case 'darkmode:toggle-site': {
        const dmPatch = this.darkEngine.toggleHost(c.host);
        this.setSettings({ darkMode: dmPatch });
        break;
      }
      case 'darkmode:update':
        this.setSettings({ darkMode: c.patch });
        break;
      case 'ai:toggle':
        this.stateMgr.setAiOpen(c.open);
        if (this.stateMgr.ai.open && !this.stateMgr.ai.ollamaOnline) {
          void this.ollama.refreshModels();
        }
        break;
      case 'ai:prompt':
        void this.ollama.runPrompt({ prompt: c.prompt, action: c.action, includePage: c.includePage });
        break;
      case 'ai:clear':
        this.ollama.stop();
        this.stateMgr.clearAiMessages();
        break;
      case 'ai:stop':
        this.ollama.stop();
        break;
      case 'ai:refresh-models':
        void this.ollama.refreshModels();
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
      case 'find:query': {
        const wc = this.wc();
        const id = this.glance?.id ?? this.activeTabId;
        if (!wc || !id) break;
        if (!c.text) {
          wc.stopFindInPage('clearSelection');
          this.find = { tabId: id, active: 0, matches: 0 };
          this.emit();
          break;
        }
        // findNext: true starts a new search; false moves through the current one.
        wc.findInPage(c.text, { forward: c.forward ?? true, findNext: !c.next });
        break;
      }
      case 'find:stop':
        this.closeFind();
        this.emit();
        break;
      case 'zoom':
        this.zoomTab(this.glance?.id ?? this.activeTabId, c.dir);
        break;
      case 'download:open': {
        const d = this.downloads.find((x) => x.id === c.id);
        if (d?.state === 'completed') void shell.openPath(d.path);
        break;
      }
      case 'download:show': {
        const d = this.downloads.find((x) => x.id === c.id);
        if (d) shell.showItemInFolder(d.path);
        break;
      }
      case 'download:cancel':
        this.downloadItems.get(c.id)?.cancel();
        break;
      case 'downloads:clear':
        this.downloads = this.downloads.filter((d) => d.state === 'progressing');
        this.emit();
        break;
      case 'page:print':
        this.wc()?.print();
        break;
      case 'page:source': {
        const t = this.tab(this.activeTabId);
        if (t && /^https?:/.test(t.url)) this.createTab({ url: `view-source:${t.url}`, afterId: t.id });
        break;
      }
      case 'page:screenshot':
        void this.screenshot();
        break;
      case 'page:translate': {
        const t = this.tab(this.activeTabId);
        if (t && /^https?:/.test(t.url)) {
          const lang = this.i18n.bundle().code;
          this.createTab({ url: `https://translate.google.com/translate?sl=auto&tl=${lang}&u=${encodeURIComponent(t.url)}`, afterId: t.id });
        }
        break;
      }
      case 'page:qr': {
        const url = c.url || this.wc()?.getURL() || '';
        if (url) this.openQrCodeWindow(url);
        break;
      }
      case 'tab:duplicate': {
        const t = this.tab(c.id);
        if (t) this.createTab({ url: t.url, afterId: t.id });
        break;
      }
      case 'tab:muteOthers': {
        for (const t of this.tabs) {
          if (t.id !== c.id && !t.muted) {
            this.run({ type: 'tab:set', id: t.id, muted: true });
          }
        }
        break;
      }
      case 'tab:closeRight': {
        const spaceTabs = this.visibleIn(this.activeSpaceId).filter((t) => !t.essential && !t.pinned);
        const idx = spaceTabs.findIndex((t) => t.id === c.id);
        if (idx !== -1) {
          for (let i = idx + 1; i < spaceTabs.length; i++) {
            this.closeTab(spaceTabs[i].id, true);
          }
        }
        break;
      }
      case 'tab:closeOthers': {
        const spaceTabs = this.visibleIn(this.activeSpaceId).filter((t) => !t.essential && !t.pinned);
        for (const t of spaceTabs) {
          if (t.id !== c.id) {
            this.closeTab(t.id, true);
          }
        }
        break;
      }
      case 'page:pip': {
        const targetWc = this.wc(this.media?.tabId ?? this.activeTabId);
        if (!targetWc) break;
        const pipScript = `(async () => {
          try {
            if (document.pictureInPictureElement) {
              await document.exitPictureInPicture();
              return;
            }
            const ytVid = document.querySelector('#movie_player video, .html5-video-player video');
            if (ytVid) {
              ytVid.disablePictureInPicture = false;
              await ytVid.requestPictureInPicture();
              return;
            }
            const allVideos = Array.from(document.querySelectorAll('video'));
            const playing = allVideos.find((v) => !v.paused && v.readyState >= 1) || allVideos[0];
            if (playing) {
              playing.disablePictureInPicture = false;
              await playing.requestPictureInPicture();
              return;
            }
            for (const el of document.querySelectorAll('*')) {
              if (el.shadowRoot) {
                const sv = el.shadowRoot.querySelector('video');
                if (sv) {
                  sv.disablePictureInPicture = false;
                  await sv.requestPictureInPicture();
                  return;
                }
              }
            }
          } catch (e) {
            console.warn('[drift pip error]', e);
          }
        })()`;
        void targetWc.executeJavaScript(pipScript, true).catch(() => {});
        break;
      }
      case 'split:toggle': {
        if (this.split?.tabIds.includes(this.activeTabId ?? '')) {
          this.run({ type: 'split:close' });
          break;
        }
        const list = this.visibleIn(this.activeSpaceId);
        const i2 = list.findIndex((t) => t.id === this.activeTabId);
        const other = list[i2 + 1] ?? list[i2 - 1];
        if (this.activeTabId && other) this.run({ type: 'split:create', ids: [this.activeTabId, other.id] });
        break;
      }
      case 'google:signin':
        this.createTab({ url: 'https://accounts.google.com/ServiceLogin?continue=https%3A%2F%2Fmyaccount.google.com%2F' });
        break;
      case 'openin:remove': {
        const openInRules = { ...this.settings.openInRules };
        delete openInRules[c.host];
        this.setSettings({ openInRules });
        break;
      }
      case 'engine:switch':
        void this.switchEngine(c.engine);
        break;
      case 'app:restart':
        app.relaunch();
        app.quit();
        break;
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
        this.stateMgr.notifyDomainChanged('bookmarks');
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
        this.stateMgr.notifyDomainChanged('bookmarks');
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
        this.stateMgr.notifyDomainChanged('bookmarks');
        this.stateMgr.notifyDomainChanged('tabs');
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
        defaultFontSize: this.fontSizePx(),
        backgroundThrottling: this.settings.energySaver,
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
    if (this.settings.energySaver) v.webContents.setFrameRate(30);
    if (this.settings.privacy.webrtcProtect) v.webContents.setWebRTCIPHandlingPolicy('default_public_interface_only');
    this.lastActive.set(t.id, Date.now());
    t.asleep = undefined;
    this.signInUserAgent(v.webContents, t.url);
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
    wc.on('will-navigate', (e) => {
      if (this.handOff(e.url)) e.preventDefault();
    });
    wc.on('did-start-navigation', (e) => {
      if (e.isMainFrame && !e.isSameDocument) this.signInUserAgent(wc, e.url);
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
    wc.on('dom-ready', () => {
      applyGeckoEngineToWebContents(wc, this.settings.engine === 'gecko');
      this.darkEngine.applyToWebContents(wc);
    });
    wc.on('did-finish-load', () => {
      this.applySiteZoom(id);
      this.applyFontSize(wc);
      applyGeckoEngineToWebContents(wc, this.settings.engine === 'gecko');
      this.darkEngine.applyToWebContents(wc);
      this.stateMgr.notifyDomainChanged('tabs');
    });
    wc.on('did-fail-load', (_e, code, _desc, url, isMainFrame) => {
      if (!isMainFrame || code === -3 || !this.hub.upgraded.has(url)) return; // -3: aborted
      this.hub.upgraded.delete(url);
      // Only fall back to plaintext http when the failure means the host has no
      // HTTPS listener (connection refused/reset/closed/failed/timeout, address
      // unreachable, TLS protocol/cipher mismatch). NEVER downgrade on a
      // certificate error (-200..-299) or any other code: a forged/invalid
      // certificate is exactly the signal an SSL-strip MITM produces, so
      // downgrading there would strip TLS on an active attack.
      const HTTP_FALLBACK_CODES = new Set([-100, -101, -102, -104, -107, -109, -113, -118]);
      if (!HTTP_FALLBACK_CODES.has(code)) return;
      const host = hostOfUrl(url);
      if (!host) return;
      this.httpOk.add(new URL(url).hostname);
      void wc.loadURL('http://' + url.slice('https://'.length)).catch(() => {});
    });
    wc.on('zoom-changed', (_e, dir) => this.zoomTab(id, dir === 'in' ? 1 : -1));
    wc.on('found-in-page', (_e, r) => {
      if (this.find?.tabId !== id && (this.glance?.id ?? this.activeTabId) !== id) return;
      this.find = { tabId: id, active: r.activeMatchOrdinal, matches: r.matches };
      this.emit();
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
      // Real popups (OAuth, payment windows) keep window.opener, so let them open unless blocked.
      if (disposition === 'new-window') {
        // Allow genuine OAuth/payment popups by exact host (or a dot-boundary
        // subdomain) only — a substring test would let accounts.google.com.evil.com
        // or ?x=stripe.com through and open a real native popup window.
        const popupHost = (() => {
          try {
            return new URL(url).hostname.toLowerCase();
          } catch {
            return '';
          }
        })();
        const popupAllowed = ['accounts.google.com', 'firebaseapp.com', 'paypal.com', 'stripe.com'].some(
          (h) => popupHost === h || popupHost.endsWith('.' + h),
        );
        if (this.settings.privacy.blockPopups && !popupAllowed) {
          this.createTab({ url, afterId: id, background: false });
          return { action: 'deny' };
        }
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
    if (ctrl && i.shift && !i.alt && k === 'n') return run({ type: 'win:incognito' });
    if (ctrl && i.shift && !i.alt && k === 'b') {
      const next = this.settings.showBookmarksBar === 'always' ? 'never' : 'always';
      return run({ type: 'settings:set', patch: { showBookmarksBar: next } });
    }
    if (!ctrl && !i.alt && i.shift && k === 'escape') return run({ type: 'win:taskManager' });
    if (ctrl && i.shift && !i.alt && k === 'e') return run({ type: 'store:open' });
    if ((ctrl && k === '/') || (!ctrl && !i.alt && !i.shift && k === 'f1')) return run({ type: 'shortcuts:open' });
    if (ctrl && i.shift && !i.alt && k === 'delete') return run({ type: 'settings:open' });
    if (!ctrl && !i.alt && !i.shift && k === 'f7') {
      return run({ type: 'settings:set', patch: { caretBrowsing: !this.settings.caretBrowsing } });
    }
    if (ctrl && !i.alt && !i.shift && k === 'h') return run({ type: 'settings:open' });
    if (ctrl && !i.alt && !i.shift && k === ',') return run({ type: 'settings:open' });
    if ((ctrl && !i.alt && k === 'l') || k === 'f6') return this.ui({ type: 'commandbar', mode: 'current' }), true;
    if (ctrl && !i.alt && !i.shift && k === 'w') return run({ type: 'tab:close' });
    if (ctrl && i.shift && !i.alt && k === 't') return run({ type: 'tab:reopen' });
    if (ctrl && k === 'tab') return run({ type: 'tab:cycle', dir: i.shift ? -1 : 1 });
    if (ctrl && i.alt && k === 'c') return run({ type: 'ui:compact' });
    if (ctrl && i.alt && k === 'arrowright') return run({ type: 'space:cycle', dir: 1 });
    if (ctrl && i.alt && k === 'arrowleft') return run({ type: 'space:cycle', dir: -1 });
    if (ctrl && i.alt && k === 'v') return run({ type: 'split:toggle' });
    if ((ctrl && i.alt && k === 'r') || (!ctrl && !i.alt && !i.shift && k === 'f9')) return run({ type: 'page:readingMode' });
    if (ctrl && !i.alt && !i.shift && k === 'f') return this.ui({ type: 'find' }), true;
    if (ctrl && !i.alt && (k === '=' || k === '+')) return run({ type: 'zoom', dir: 1 });
    if (ctrl && !i.alt && (k === '-' || k === '_')) return run({ type: 'zoom', dir: -1 });
    if (ctrl && !i.alt && !i.shift && k === '0') return run({ type: 'zoom', dir: 0 });
    if (ctrl && !i.alt && !i.shift && k === 'p') return run({ type: 'page:print' });
    if (i.alt && !ctrl && !i.shift && k === 'p') return run({ type: 'page:pip' });
    if (ctrl && !i.alt && !i.shift && k === 'u') return run({ type: 'page:source' });
    if (ctrl && i.shift && !i.alt && k === 's') return run({ type: 'page:screenshot' });
    if (ctrl && i.shift && !i.alt && k === 'a') return run({ type: 'ai:toggle' });
    if (ctrl && !i.alt && !i.shift && k === 'j') return this.downloadsMenu(), true;
    if (ctrl && !i.alt && !i.shift && k === 'd') {
      const t = this.tab(this.activeTabId);
      if (t && !t.essential) this.run({ type: 'tab:set', id: t.id, pinned: !t.pinned });
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
    const otherDevices = this.sync.state().otherDevices;
    const items: MenuItemConstructorOptions[] = [
      { label: t.essential ? this.i18n.t('menu.removeEssential') : this.i18n.t('menu.addEssential'), click: () => this.run({ type: 'tab:set', id, essential: !t.essential }) },
      { label: t.pinned ? this.i18n.t('menu.unpin') : this.i18n.t('menu.pin'), enabled: !t.essential, click: () => this.run({ type: 'tab:set', id, pinned: !t.pinned }) },
      inSplit
        ? { label: this.i18n.t('menu.closeSplit'), click: () => this.run({ type: 'split:close' }) }
        : { label: this.i18n.t('menu.splitWithCurrent'), enabled: !!active && active !== id, click: () => active && this.run({ type: 'split:create', ids: [active, id] }) },
      { type: 'separator' },
      { label: t.muted ? this.i18n.t('menu.unmute') : this.i18n.t('menu.mute'), click: () => this.run({ type: 'tab:set', id, muted: !t.muted }) },
      { label: 'השתקת כרטיסיות אחרות · Mute other tabs', click: () => this.run({ type: 'tab:muteOthers', id }) },
      { label: this.i18n.t('menu.reload'), click: () => this.run({ type: 'tab:reload', id }) },
      { label: 'כרטיסייה חדשה מימין · New tab to the right', click: () => this.createTab({ afterId: id }) },
      { label: 'שכפול כרטיסייה · Duplicate tab', click: () => this.createTab({ url: t.url, afterId: id }) },
      { label: 'יצירת קוד QR עבור כרטיסייה זו · Create QR code', click: () => this.run({ type: 'page:qr', url: t.url }) },
      { label: this.i18n.t('menu.copyLink'), click: () => this.clipboardMonitor.captureNow(t.url) },
      {
        label: 'Send Tab to Device',
        enabled: /^https?:/.test(t.url) && otherDevices.length > 0,
        submenu: [
          ...otherDevices.map((d) => ({
            label: d.name,
            click: () => this.run({ type: 'handoff:send', url: t.url, title: t.title, targetDeviceId: d.id }),
          })),
          ...(otherDevices.length > 1
            ? [
                { type: 'separator' as const },
                {
                  label: 'All Synced Devices',
                  click: () => this.run({ type: 'handoff:send', url: t.url, title: t.title, targetDeviceId: 'all' }),
                },
              ]
            : []),
        ],
      },
      {
        label: this.i18n.t('menu.moveTo'),
        enabled: this.spaces.length > 1,
        submenu: this.spaces
          .filter((s) => s.id !== t.spaceId || t.essential)
          .map((s) => ({ label: s.name, click: () => this.run({ type: 'tab:set', id, spaceId: s.id }) })),
      },
      { type: 'separator' },
      { label: 'סגירת כרטיסיות מימין · Close tabs to the right', click: () => this.run({ type: 'tab:closeRight', id }) },
      { label: 'סגירת כרטיסיות אחרות · Close other tabs', click: () => this.run({ type: 'tab:closeOthers', id }) },
      { label: this.i18n.t('menu.closeTab'), accelerator: 'Ctrl+W', click: () => this.run({ type: 'tab:close', id }) },
      { type: 'separator' },
      { label: this.i18n.t('menu.reopen'), accelerator: 'Ctrl+Shift+T', enabled: this.closed.length > 0, click: () => this.run({ type: 'tab:reopen' }) },
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
    const icon: Record<ImportBrowser, string> = { zen: 'inbox', firefox: 'fox', chrome: 'globe', brave: 'shield', edge: 'globe' };

    if (data.zen && options.zenSpaces && data.zen.tabs.length) {
      const ids = new Map<string, string>();
      data.zen.spaces.forEach((zs, i) => {
        const n = this.spaces.length;
        const s: SpaceState = { id: newId(), name: zs.name, icon: ICONS[n % ICONS.length], accent: ACCENTS[n % ACCENTS.length] };
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

  // ---------------------------------------------------------------- other browsers & Google

  stats() {
    return { blocked: this.blockedTotal, since: this.statsSince };
  }

  shouldConfirmClose() {
    return this.settings.confirmClose && this.tabs.filter((t) => !t.glanceOf && !t.pinned && !t.essential).length > 1;
  }

  // ---------------------------------------------------------------- Drift Sync

  /** Settings that follow you between devices (not engine, graphics, updates or first-run state). */
  private static readonly SYNCED_SETTINGS = [
    'theme', 'colorTheme', 'customAccent', 'spaceColors', 'verticalTabs', 'searchEngine', 'homePage', 'newTabPage',
    // Security-posture settings — the `privacy` toggles (httpsOnly, safeBrowsing,
    // etc.) and the ad blocker's on/off + paused-host list — are deliberately NOT
    // synced. A compromised second device on the same account must not be able to
    // silently weaken this device's defenses; security posture stays per-device.
    'restoreSession', 'confirmClose', 'smoothScrolling', 'hideAnnoyances', 'clearOnExit',
    'sleepAfter', 'forceDark', 'darkMode', 'clipboardSync', 'siteZoom', 'openInRules', 'language',
  ] as const;

  private collectForSync(): LocalData {
    const s = this.settings as unknown as Record<string, unknown>;
    return {
      tabs: this.tabs.filter((t) => !t.glanceOf && /^https?:/.test(t.url)).map((t) => ({ url: t.url, title: t.title, favicon: t.favicon })),
      spaces: this.spaces.map(({ id, name, icon, accent }) => ({ id, name, icon, accent })),
      pins: this.tabs
        .filter((t) => (t.pinned || t.essential) && /^https?:/.test(t.url))
        .map((t) => ({ url: t.url, title: t.title, spaceId: t.spaceId, essential: !!t.essential })),
      settings: Object.fromEntries(Browser.SYNCED_SETTINGS.map((k) => [k, s[k]])),
      history: this.history.exportForSync(4000),
      clipboard: this.stateMgr.clipboard,
    };
  }

  /** Brings in what your other devices changed in Firestore. Open tabs are never closed by sync. */
  private applySynced(inc: Incoming) {
    this.stateMgr.withRemoteUpdate(() => {
      if (inc.spaces?.length) {
        const known = new Map(this.spaces.map((sp) => [sp.id, sp]));
        this.spaces = inc.spaces.map((sp) => ({ ...known.get(sp.id), ...sp }));
        const first = this.spaces[0].id;
        for (const t of this.tabs) if (!t.essential && !this.spaces.some((sp) => sp.id === t.spaceId)) t.spaceId = first;
        if (!this.spaces.some((sp) => sp.id === this.activeSpaceId)) this.activeSpaceId = first;
      }
      if (inc.pins) {
        const want = new Map(inc.pins.map((p) => [p.url, p]));
        for (const t of this.tabs) {
          const p = want.get(t.url);
          if (p) {
            t.essential = p.essential;
            t.pinned = !p.essential;
            if (!p.essential && this.spaces.some((sp) => sp.id === p.spaceId)) t.spaceId = p.spaceId;
            want.delete(t.url);
          } else if (t.pinned || t.essential) {
            // Unpinned on another device: it stays open here as a normal tab.
            t.pinned = false;
            t.essential = false;
          }
        }
        for (const p of want.values()) {
          if (!isSafeRemoteUrl(p.url)) continue; // never load file:/data: pushed from another device
          const spaceId = this.spaces.some((sp) => sp.id === p.spaceId) ? p.spaceId : this.activeSpaceId;
          const t = { ...this.newTabState(p.url, spaceId), title: p.title, pinned: !p.essential, essential: p.essential };
          this.tabs.push(t);
        }
      }
      if (inc.settings) {
        const patch: Record<string, unknown> = {};
        const cur = this.settings as unknown as Record<string, unknown>;
        for (const k of Browser.SYNCED_SETTINGS) {
          if (k in inc.settings && JSON.stringify(inc.settings[k]) !== JSON.stringify(cur[k])) {
            patch[k] = inc.settings[k];
          }
        }
        if (Object.keys(patch).length) this.setSettings(patch as SettingsPatch);
      }
      if (inc.history) this.history.importSynced(inc.history);
      if (inc.clipboard) {
        const newest = this.stateMgr.mergeRemoteClipboard(inc.clipboard);
        if (newest && newest.deviceId !== this.sync.deviceId && this.settings.clipboardSync.autoApplyToSystem) {
          this.clipboardMonitor.writeSystemClipboard(newest.text);
        }
      }
      if (inc.handoffTabs?.length) {
        for (const item of inc.handoffTabs) {
          if (!isSafeRemoteUrl(item.url)) continue; // only http(s)/drift from another device
          this.createTab({ url: item.url, background: false });
          this.ui({ type: 'handoff:received', item });
        }
      }
    });
    this.emit();
  }

  /**
   * Tor Browser's "New Identity", for Drift's own session: closes every tab and
   * forgets cookies, site data and cache, so sites can't link what comes next
   * to what came before. (It doesn't change your IP address: Drift doesn't use Tor.)
   */
  private async newIdentity() {
    const r = await dialog.showMessageBox(this.win, {
      type: 'question',
      buttons: [this.i18n.t('nid.confirm'), this.i18n.t('close.cancel')],
      defaultId: 0,
      cancelId: 1,
      message: this.i18n.t('nid.title'),
      detail: this.i18n.t('nid.body'),
    });
    if (r.response !== 0) return;
    for (const t of [...this.tabs]) this.closeTab(t.id, false);
    this.closed = [];
    const ses = session.fromPartition(PARTITION);
    await ses.clearStorageData();
    await ses.clearCache();
    this.createTab({});
    this.emit();
  }

  get wantsClearOnExit() {
    return this.settings.clearOnExit;
  }

  /** "Clear cookies and site data when Drift closes". */
  async clearSiteData() {
    const ses = session.fromPartition(PARTITION);
    await ses.clearStorageData();
    await ses.clearCache();
  }

  async confirmClose(): Promise<boolean> {
    const count = this.tabs.filter((t) => !t.glanceOf && !t.pinned && !t.essential).length;
    const r = await dialog.showMessageBox(this.win, {
      type: 'question',
      buttons: [this.i18n.t('close.confirm'), this.i18n.t('close.cancel')],
      defaultId: 0,
      cancelId: 1,
      message: this.i18n.t('close.title', { count }),
      detail: this.i18n.t('close.detail'),
    });
    return r.response === 0;
  }

  // ---------------------------------------------------------------- engines

  get language() {
    return this.i18n.bundle().code;
  }

  get accentColor() {
    return this.settings.customAccent || THEMES[this.settings.theme].accent;
  }

  /**
   * Switches the active web engine ('chromium' | 'gecko') live inside Drift Browser
   * without opening an external Firefox window or closing Drift.
   */
  private async switchEngine(engine: 'chromium' | 'gecko') {
    if (engine === 'gecko' && !geckoStatus().available) {
      await downloadGecko(this.language, this.settings);
    }
    this.setSettings({ engine });
    const wantUA = engine === 'gecko' ? getGeckoUserAgent() : app.userAgentFallback;
    session.fromPartition(PARTITION).setUserAgent(wantUA);
    for (const v of this.views.values()) {
      if (v.webContents.isDestroyed()) continue;
      this.signInUserAgent(v.webContents, v.webContents.getURL());
      applyGeckoEngineToWebContents(v.webContents, engine === 'gecko');
    }
    const activeWc = this.wc();
    if (activeWc && /^https?:/i.test(activeWc.getURL())) {
      activeWc.reload();
    }
    this.emit();
  }

  /** Settings for code outside this class that needs them (the Gecko engine download). */
  get currentSettings() {
    return this.settings;
  }

  /** Legacy protocol handler: ensures Chromium engine is selected and focuses Drift. */
  returnFromGecko() {
    void this.switchEngine('chromium');
    if (this.win.isMinimized()) this.win.restore();
    this.win.focus();
  }

  /** If a site is set to always open in another browser, send it there. */
  private handOff(url: string): boolean {
    const host = hostOfUrl(url);
    const rule = host && Object.entries(this.settings.openInRules).find(([h]) => host === h || host.endsWith('.' + h))?.[1];
    return !!rule && openInBrowser(rule, url);
  }

  /** "Open page in ▸ Firefox / Zen / Chrome …" plus an "always" rule per site. */
  private openInMenu(url: string): MenuItemConstructorOptions {
    const t = this.i18n.t;
    const host = hostOfUrl(url);
    const browsers = otherBrowsers();
    const rule = host ? this.settings.openInRules[host] : undefined;
    return {
      label: t('open.in'),
      enabled: browsers.length > 0 && /^https?:/.test(url),
      submenu: [
        ...browsers.map((b) => ({ label: b.name, click: () => void openInBrowser(b.id, url) })),
        { type: 'separator' as const },
        ...browsers.map((b) => ({
          label: t('open.always', { host, browser: b.name }),
          type: 'checkbox' as const,
          checked: rule === b.id,
          click: () => {
            const openInRules = { ...this.settings.openInRules };
            if (rule === b.id) delete openInRules[host];
            else openInRules[host] = b.id;
            this.setSettings({ openInRules });
          },
        })),
      ],
    };
  }

  private signInUserAgent(wc: WebContents, _url: string) {
    const useGecko = this.settings.engine === 'gecko';
    const want = useGecko ? getGeckoUserAgent() : app.userAgentFallback;
    if (wc.getUserAgent() !== want) wc.setUserAgent(want);
  }

  async googleStatus(): Promise<boolean> {
    const cookies = await session.fromPartition(PARTITION).cookies.get({ domain: '.google.com', name: 'SID' });
    return cookies.length > 0;
  }

  // ---------------------------------------------------------------- find, zoom, sleep

  private closeFind() {
    if (!this.find) return;
    const wc = this.wc(this.find.tabId);
    wc?.stopFindInPage('keepSelection');
    this.find = undefined;
  }

  private applySiteZoom(id: string) {
    const t = this.tab(id);
    const wc = this.wc(id);
    if (!t || !wc) return;
    const defaultLevel =
      this.settings.defaultZoom && this.settings.defaultZoom !== 100
        ? Math.log(this.settings.defaultZoom / 100) / Math.log(1.2)
        : 0;
    const level = this.settings.siteZoom[hostOfUrl(wc.getURL())] ?? defaultLevel;
    wc.setZoomLevel(level);
    const pct = Math.round(Math.pow(1.2, level) * 100);
    if ((t.zoom ?? 100) !== pct) {
      t.zoom = pct === 100 ? undefined : pct;
      this.emit();
    }
  }

  /** Chromium zoom is per site: every tab of that site follows, and it is remembered. */
  private zoomTab(id: string | undefined, dir: 1 | -1 | 0) {
    const wc = this.wc(id);
    if (!id || !wc) return;
    const host = hostOfUrl(wc.getURL());
    if (!host) return;
    const level = dir === 0 ? 0 : Math.max(-3, Math.min(5, wc.getZoomLevel() + dir * 0.5));
    const siteZoom = { ...this.settings.siteZoom };
    if (level === 0) delete siteZoom[host];
    else siteZoom[host] = level;
    this.setSettings({ siteZoom });
    for (const t of this.tabs) if (this.views.has(t.id) && hostOfUrl(t.url) === host) this.applySiteZoom(t.id);
  }

  /** Unload tabs nobody has looked at for a while, like Chrome's Memory Saver & Edge's sleeping tabs. */
  private sleepIdleTabs() {
    if (!this.settings.memorySaver) return;
    const mins = this.settings.sleepAfter;
    if (!mins) return;
    const cutoff = Date.now() - mins * 60_000;
    const keep = new Set<string>([
      ...this.panes.map((p) => p.tabId),
      ...this.spaces.map((s) => s.activeTabId ?? ''),
      ...this.permissions.prompts.map((p) => p.tabId),
      this.media?.tabId ?? '',
      this.glance?.id ?? '',
    ]);
    let changed = false;
    for (const id of [...this.views.keys()]) {
      const t = this.tab(id);
      if (!t || keep.has(id) || t.audible) continue;
      const host = hostOfUrl(t.url);
      if (host && this.settings.neverSleepHosts.some((h) => host === h || host.endsWith('.' + h))) continue;
      if ((this.lastActive.get(id) ?? Date.now()) < cutoff) {
        this.destroyView(id);
        changed = true;
      }
    }
    if (changed) this.emit();
  }

  // ---------------------------------------------------------------- downloads & screenshots

  private uniquePath(dir: string, name: string) {
    const safe = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').slice(0, 180) || 'download';
    const ext = path.extname(safe);
    const base = safe.slice(0, safe.length - ext.length);
    let candidate = path.join(dir, safe);
    for (let n = 1; fs.existsSync(candidate); n++) candidate = path.join(dir, `${base} (${n})${ext}`);
    return candidate;
  }

  /** Save straight to Downloads like Chrome does, and track progress for the downloads menu. */
  private setupDownloads(ses: Electron.Session) {
    ses.on('will-download', (_e, item, source) => {
      // A tab opened only to fetch a file is closed again, like Chrome does.
      const owner = source ? this.tabIdForWc(source.id) : undefined;
      if (owner && !source.isDestroyed() && source.navigationHistory.length() <= 1 && !/^https?:/.test(source.getURL())) {
        setTimeout(() => this.closeTab(owner, false), 0);
      }
      const targetDir =
        this.settings.downloadPath && fs.existsSync(this.settings.downloadPath)
          ? this.settings.downloadPath
          : app.getPath('downloads');
      const file = this.uniquePath(targetDir, item.getFilename());
      // "Ask where to save each file": Electron shows the save dialog when no path is set.
      if (this.settings.askDownloadLocation) item.setSaveDialogOptions({ defaultPath: file });
      else item.setSavePath(file);
      const d: DownloadInfo = {
        id: newId(),
        filename: path.basename(file),
        path: file,
        url: item.getURL(),
        received: 0,
        total: item.getTotalBytes(),
        state: 'progressing',
        startedAt: Date.now(),
      };
      this.downloads = [d, ...this.downloads].slice(0, 40);
      this.downloadItems.set(d.id, item);
      item.on('updated', (_ev, st) => {
        const chosen = item.getSavePath();
        if (chosen && chosen !== d.path) {
          d.path = chosen;
          d.filename = path.basename(chosen);
        }
        d.received = item.getReceivedBytes();
        d.total = item.getTotalBytes();
        d.state = st === 'interrupted' ? 'interrupted' : 'progressing';
        d.paused = item.isPaused();
        this.emit();
      });
      item.once('done', (_ev, st) => {
        d.received = item.getReceivedBytes();
        d.state = st;
        this.downloadItems.delete(d.id);
        this.emit();
      });
      this.emit();
    });
  }

  private size(n: number) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
    if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
    return `${(n / 1024 ** 3).toFixed(2)} GB`;
  }

  downloadsMenu() {
    const t = this.i18n.t;
    const items: MenuItemConstructorOptions[] = [];
    if (this.downloads.length === 0) items.push({ label: t('dl.none'), enabled: false });
    for (const d of this.downloads.slice(0, 15)) {
      const status =
        d.state === 'progressing'
          ? d.total > 0
            ? `${Math.round((d.received / d.total) * 100)}% · ${this.size(d.received)} / ${this.size(d.total)}`
            : this.size(d.received)
          : d.state === 'completed'
            ? `${t('dl.done')} · ${this.size(d.received)}`
            : d.state === 'cancelled'
              ? t('dl.cancelled')
              : t('dl.failed');
      items.push({
        label: `${d.filename}  —  ${status}`,
        submenu: [
          { label: t('dl.open'), enabled: d.state === 'completed', click: () => this.run({ type: 'download:open', id: d.id }) },
          { label: t('dl.show'), enabled: d.state !== 'cancelled', click: () => this.run({ type: 'download:show', id: d.id }) },
          { label: t('dl.cancel'), enabled: d.state === 'progressing', click: () => this.run({ type: 'download:cancel', id: d.id }) },
          { type: 'separator' },
          { label: t('menu.copyLink'), click: () => clipboard.writeText(d.url) },
        ],
      });
    }
    items.push(
      { type: 'separator' },
      { label: t('dl.folder'), click: () => void shell.openPath(app.getPath('downloads')) },
      { label: t('dl.clear'), enabled: this.downloads.some((d) => d.state !== 'progressing'), click: () => this.run({ type: 'downloads:clear' }) },
    );
    Menu.buildFromTemplate(items).popup({ window: this.win });
  }

  /** Visible part of the page: copied to the clipboard and saved in Downloads. */
  private async screenshot(id = this.activeTabId) {
    const wc = this.wc(id);
    if (!wc) return;
    const img = await wc.capturePage();
    void clipboard.write([new ClipboardItem({ 'image/png': new Blob([new Uint8Array(img.toPNG())], { type: 'image/png' }) })]).catch(() => {});
    const stamp = new Date().toISOString().replace('T', ' ').slice(0, 19).replace(/:/g, '.');
    const file = this.uniquePath(app.getPath('downloads'), `Drift screenshot ${stamp}.png`);
    fs.writeFileSync(file, img.toPNG());
    const d: DownloadInfo = { id: newId(), filename: path.basename(file), path: file, url: wc.getURL(), received: fs.statSync(file).size, total: 0, state: 'completed', startedAt: Date.now() };
    this.downloads = [d, ...this.downloads].slice(0, 40);
    this.emit();
  }

  /** The ⋮ menu in top-tab layouts (full Chrome menu options). */
  appMenu() {
    const items: MenuItemConstructorOptions[] = [
      { label: this.i18n.t('menu.newTab'), accelerator: 'Ctrl+T', click: () => this.ui({ type: 'commandbar', mode: 'new' }) },
      { label: 'חלון גלישה בסתר חדש · New Incognito Window', accelerator: 'Ctrl+Shift+N', click: () => this.run({ type: 'win:incognito' }) },
      { label: this.i18n.t('menu.reopen'), accelerator: 'Ctrl+Shift+T', enabled: this.closed.length > 0, click: () => this.run({ type: 'tab:reopen' }) },
      { label: this.i18n.t('menu.newSpace'), click: () => this.run({ type: 'space:new' }) },
      { type: 'separator' },
      {
        label: 'סימניות ורשימות · Bookmarks',
        submenu: [
          { label: 'הוספת דף זה לסימניות · Bookmark This Tab', accelerator: 'Ctrl+D', click: () => this.run({ type: 'bookmark:toggle' }) },
          {
            label: 'הצגת סרגל הסימניות · Show Bookmarks Bar',
            accelerator: 'Ctrl+Shift+B',
            type: 'checkbox',
            checked: this.settings.showBookmarksBar === 'always',
            click: () =>
              this.setSettings({
                showBookmarksBar: this.settings.showBookmarksBar === 'always' ? 'never' : 'always',
              }),
          },
          {
            label: 'הצגת לחצן דף הבית · Show Home Button',
            type: 'checkbox',
            checked: this.settings.showHomeButton,
            click: () => this.setSettings({ showHomeButton: !this.settings.showHomeButton }),
          },
        ],
      },
      { label: this.i18n.t('act.downloads'), accelerator: 'Ctrl+J', click: () => this.downloadsMenu() },
      { label: 'ניקוי נתוני גלישה… · Clear Browsing Data…', accelerator: 'Ctrl+Shift+Del', click: () => this.openSettings() },
      { type: 'separator' },
      {
        label: this.i18n.t('act.zoom'),
        submenu: [
          { label: this.i18n.t('act.zoomIn'), accelerator: 'Ctrl+=', click: () => this.run({ type: 'zoom', dir: 1 }) },
          { label: this.i18n.t('act.zoomOut'), accelerator: 'Ctrl+-', click: () => this.run({ type: 'zoom', dir: -1 }) },
          { label: this.i18n.t('act.zoomReset'), accelerator: 'Ctrl+0', click: () => this.run({ type: 'zoom', dir: 0 }) },
        ],
      },
      { label: this.i18n.t('act.print'), accelerator: 'Ctrl+P', click: () => this.run({ type: 'page:print' }) },
      { label: 'מצב קריאה · Reading Mode', click: () => this.run({ type: 'page:readingMode' }) },
      { label: this.i18n.t('act.find'), accelerator: 'Ctrl+F', click: () => this.ui({ type: 'find' }) },
      { label: this.i18n.t('act.screenshot'), accelerator: 'Ctrl+Shift+S', click: () => this.run({ type: 'page:screenshot' }) },
      { type: 'separator' },
      { label: 'Local AI Assistant (Ollama)', accelerator: 'Ctrl+Shift+A', click: () => this.run({ type: 'ai:toggle' }) },
      { label: 'Summarize Current Page (AI)', click: () => this.run({ type: 'ai:prompt', prompt: '', action: 'summarize', includePage: true }) },
      {
        label: 'Force Dark Mode on Sites',
        type: 'checkbox',
        checked: this.settings.darkMode.enabled,
        click: () => this.run({ type: 'darkmode:update', patch: { enabled: !this.settings.darkMode.enabled } }),
      },
      { type: 'separator' },
      {
        label: 'כלים נוספים · More Tools',
        submenu: [
          { label: 'מנהל משימות · Task Manager', accelerator: 'Shift+Esc', click: () => this.run({ type: 'win:taskManager' }) },
          { label: this.i18n.t('act.source'), accelerator: 'Ctrl+U', click: () => this.run({ type: 'page:source' }) },
          { label: this.i18n.t('menu.devtools'), accelerator: 'F12', click: () => this.shortcut({ type: 'keyDown', key: 'F12' } as Input) },
          { type: 'separator' },
          { label: this.i18n.t('menu.verticalTabs'), type: 'checkbox', checked: this.settings.verticalTabs, click: () => this.setSettings({ verticalTabs: !this.settings.verticalTabs }) },
          { label: this.i18n.t('menu.splitNext'), accelerator: 'Ctrl+Alt+V', click: () => this.shortcut({ type: 'keyDown', key: 'v', control: true, alt: true } as Input) },
        ],
      },
      { type: 'separator' },
      { label: 'קיצורי מקלדת · Keyboard Shortcuts', accelerator: 'Ctrl+/', click: () => this.openShortcuts() },
      { label: 'חנות תוספים וערכות · Drift Store', accelerator: 'Ctrl+Shift+E', click: () => this.openStore() },
      { label: this.i18n.t('menu.settings'), accelerator: 'Ctrl+,', click: () => this.openSettings() },
      { type: 'separator' },
      { label: this.i18n.t('menu.exit'), click: () => this.win.close() },
    ];
    Menu.buildFromTemplate(items).popup({ window: this.win });
  }

  private async clearBrowsingData(
    range: '1h' | '24h' | '7d' | '4w' | 'all',
    clearHist: boolean,
    clearCookies: boolean,
    clearCache: boolean,
  ) {
    const now = Date.now();
    const offsets: Record<string, number> = {
      '1h': 3600_000,
      '24h': 24 * 3600_000,
      '7d': 7 * 24 * 3600_000,
      '4w': 28 * 24 * 3600_000,
      all: now,
    };
    const since = range === 'all' ? 0 : now - (offsets[range] ?? now);
    if (clearHist) {
      this.history.clearHistory(since);
      this.stateMgr.notifyDomainChanged('history');
    }
    const ses = session.fromPartition(PARTITION);
    if (clearCookies) {
      await ses.clearStorageData({
        storages: ['cookies', 'localstorage', 'indexdb', 'serviceworkers', 'cachestorage'],
      });
    }
    if (clearCache) {
      await ses.clearCache();
    }
    this.emit();
  }

  private async chooseDownloadFolder() {
    const res = await dialog.showOpenDialog(this.win, {
      title: 'Choose Download Folder · בחירת תיקיית הורדות',
      defaultPath: this.settings.downloadPath || app.getPath('downloads'),
      properties: ['openDirectory', 'createDirectory'],
    });
    if (!res.canceled && res.filePaths[0]) {
      this.setSettings({ downloadPath: res.filePaths[0] });
    }
  }

  private openIncognitoWindow(initialUrl?: string) {
    const incogPartition = `incognito-${newId()}`;
    const incogSes = session.fromPartition(incogPartition, { cache: false });
    const incogWin = new BrowserWindow({
      width: 1220,
      height: 820,
      title: 'Drift — מצב גלישה בסתר (Incognito)',
      autoHideMenuBar: true,
      backgroundColor: '#121316',
      webPreferences: {
        partition: incogPartition,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    incogWin.on('closed', () => {
      void incogSes.clearStorageData().catch(() => {});
      void incogSes.clearCache().catch(() => {});
    });
    void incogWin.loadURL(initialUrl && /^https?:/i.test(initialUrl) ? initialUrl : this.settings.homePage);
  }

  /** Escape text interpolated into the small data: HTML chrome windows below. */
  private esc(s: string): string {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
  }

  private openTaskManagerWindow() {
    const metrics = app.getAppMetrics();
    const rows = metrics
      .map(
        (m) =>
          `<tr>
            <td>${this.esc(m.name || m.type)}</td>
            <td>${m.pid}</td>
            <td>${m.cpu.percentCPUUsage.toFixed(1)}%</td>
            <td>${(m.memory.workingSetSize / 1024).toFixed(1)} MB</td>
          </tr>`,
      )
      .join('');
    const html = `<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8"><title>מנהל משימות · Drift Task Manager</title>
    <style>
      body { margin:0; padding:20px; background:#14161b; color:#e8eaed; font:14px system-ui,sans-serif; }
      h2 { margin:0 0 14px; color:#8aa4ff; font-size:18px; }
      table { width:100%; border-collapse:collapse; background:#1d2028; border-radius:10px; overflow:hidden; }
      th, td { padding:10px 14px; text-align:right; border-bottom:1px solid #2b2f3a; }
      th { background:#242834; color:#9aa0b0; font-weight:600; font-size:12px; }
      tr:last-child td { border-bottom:0; }
    </style></head><body>
    <h2>מנהל משימות של הדפדפן · Browser Task Manager</h2>
    <table><thead><tr><th>תהליך (Process)</th><th>PID</th><th>מעבד (CPU)</th><th>זיכרון (Memory)</th></tr></thead>
    <tbody>${rows}</tbody></table></body></html>`;
    const tmWin = new BrowserWindow({
      width: 640,
      height: 460,
      title: 'מנהל משימות — Drift Task Manager',
      autoHideMenuBar: true,
      backgroundColor: '#14161b',
    });
    void tmWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  }

  private openQrCodeWindow(url: string) {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=${encodeURIComponent(url)}`;
    const html = `<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8"><title>קוד QR לשיתוף דף</title>
    <style>
      body { margin:0; padding:24px; background:#202124; color:#e8eaed; font:14px system-ui,sans-serif; text-align:center; }
      h3 { margin:0 0 10px; color:#fff; font-size:16px; font-weight:500; }
      p { margin:0 0 16px; color:#9aa0a6; font-size:12px; word-break:break-all; max-height:36px; overflow:hidden; }
      .qr-card { display:inline-block; background:#fff; padding:12px; border-radius:12px; box-shadow:0 4px 16px rgba(0,0,0,0.5); }
      img { display:block; width:220px; height:220px; }
      .btn { margin-top:16px; padding:8px 18px; border:0; border-radius:18px; background:#8ab4f8; color:#202124; font-weight:600; cursor:pointer; }
    </style></head><body>
      <h3>סריקת קוד QR לפתיחת הדף בנייד</h3>
      <p>${this.esc(url.length > 70 ? url.slice(0, 70) + '…' : url)}</p>
      <div class="qr-card"><img src="${qrUrl}" alt="QR Code" /></div>
      <br>
      <button class="btn" onclick="window.close()">סגור</button>
    </body></html>`;
    const qrWin = new BrowserWindow({
      width: 360,
      height: 440,
      resizable: false,
      title: 'קוד QR לשיתוף · Drift',
      autoHideMenuBar: true,
      backgroundColor: '#202124',
    });
    void qrWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  }

  private toggleReadingMode() {
    const wc = this.wc();
    if (!wc) return;
    void wc
      .executeJavaScript(
        `(() => {
          const existing = document.getElementById('__drift_reader_overlay');
          if (existing) {
            if (window.__drift_tts_utterance) window.speechSynthesis.cancel();
            existing.remove();
            return;
          }

          const article = document.querySelector('article, [role="main"], main, .post-content, .article-content, .entry-content') || document.body;
          const title = document.querySelector('h1')?.innerText?.trim() || document.title;
          const rawText = article.innerText || '';
          const wordCount = rawText.trim().split(/\\s+/).filter(Boolean).length;
          const readTimeMin = Math.max(1, Math.round(wordCount / 200));

          // Extract readable blocks (paragraphs, subheadings, blockquotes, images)
          const elements = Array.from(article.querySelectorAll('h2, h3, h4, p, blockquote, ul, ol, img'))
            .filter(el => {
              if (el.closest('nav, footer, header, aside, .comments, #comments, .share-buttons, .ads')) return false;
              if (el.tagName === 'IMG') {
                return (el.naturalWidth > 180 || el.width > 180) && el.src && !el.src.includes('avatar');
              }
              const t = el.innerText?.trim();
              return t && t.length > 15;
            });

          // Overlay container
          const overlay = document.createElement('div');
          overlay.id = '__drift_reader_overlay';
          overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#161820;color:#e2e8f0;overflow-y:auto;padding:0;font-family:system-ui,-apple-system,sans-serif;font-size:18px;line-height:1.8;transition:background 0.2s,color 0.2s;';

          // Reading progress bar
          const progressBar = document.createElement('div');
          progressBar.style.cssText = 'position:fixed;top:0;left:0;height:3px;background:#8aa4ff;width:0%;z-index:2147483648;transition:width 0.1s;';
          overlay.appendChild(progressBar);

          overlay.onscroll = () => {
            const total = overlay.scrollHeight - overlay.clientHeight;
            const progress = total > 0 ? (overlay.scrollTop / total) * 100 : 0;
            progressBar.style.width = progress + '%';
          };

          // Sticky Top Controls Toolbar
          const toolbar = document.createElement('div');
          toolbar.style.cssText = 'position:sticky;top:0;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 24px;background:rgba(22,24,32,0.92);backdrop-filter:blur(10px);border-bottom:1px solid rgba(255,255,255,0.1);z-index:10;flex-wrap:wrap;';

          // Left tools (Exit + Stats)
          const leftTools = document.createElement('div');
          leftTools.style.cssText = 'display:flex;align-items:center;gap:12px;';

          const closeBtn = document.createElement('button');
          closeBtn.textContent = '✕ סגור מצב קריאה (Exit)';
          closeBtn.style.cssText = 'padding:6px 14px;border-radius:18px;border:0;background:#8aa4ff;color:#090d16;font-weight:700;font-size:13px;cursor:pointer;transition:transform 0.1s;';
          closeBtn.onclick = () => {
            if (window.__drift_tts_utterance) window.speechSynthesis.cancel();
            overlay.remove();
          };

          const statsBadge = document.createElement('span');
          statsBadge.textContent = '📖 ' + readTimeMin + ' דקות קריאה · ' + wordCount.toLocaleString() + ' מילים';
          statsBadge.style.cssText = 'font-size:12px;color:rgba(255,255,255,0.7);background:rgba(255,255,255,0.08);padding:4px 10px;border-radius:12px;';

          leftTools.append(closeBtn, statsBadge);

          // Right controls (Themes, Fonts, Size, TTS)
          const rightTools = document.createElement('div');
          rightTools.style.cssText = 'display:flex;align-items:center;gap:10px;flex-wrap:wrap;';

          // Theme Buttons
          const themes = [
            { id: 'dark', name: '🌙 לילה', bg: '#161820', color: '#e2e8f0', border: 'rgba(255,255,255,0.1)' },
            { id: 'sepia', name: '📜 ספיה', bg: '#fbf0d9', color: '#433422', border: 'rgba(0,0,0,0.15)' },
            { id: 'light', name: '☀️ יום', bg: '#ffffff', color: '#202124', border: 'rgba(0,0,0,0.12)' },
            { id: 'amoled', name: '🖤 שחור', bg: '#000000', color: '#d1d5db', border: 'rgba(255,255,255,0.15)' },
          ];

          let currentTheme = themes[0];
          themes.forEach(th => {
            const btn = document.createElement('button');
            btn.textContent = th.name;
            btn.style.cssText = 'padding:4px 10px;border-radius:12px;border:1px solid ' + th.border + ';background:' + th.bg + ';color:' + th.color + ';font-size:12px;font-weight:600;cursor:pointer;';
            btn.onclick = () => {
              currentTheme = th;
              overlay.style.background = th.bg;
              overlay.style.color = th.color;
              toolbar.style.background = th.bg === '#ffffff' ? 'rgba(255,255,255,0.92)' : th.bg === '#fbf0d9' ? 'rgba(251,240,217,0.92)' : 'rgba(22,24,32,0.92)';
              toolbar.style.borderBottomColor = th.border;
            };
            rightTools.appendChild(btn);
          });

          // Font Family Switcher
          const fontSelect = document.createElement('select');
          fontSelect.style.cssText = 'padding:4px 8px;border-radius:8px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.1);color:inherit;font-size:12px;cursor:pointer;outline:none;';
          const fontOptions = [
            { label: 'אלגנטי (Sans)', val: 'system-ui,-apple-system,sans-serif' },
            { label: 'ספרותי (Serif)', val: 'Georgia,Cambria,"Times New Roman",serif' },
            { label: 'מונוספייס (Mono)', val: 'monospace' },
          ];
          fontOptions.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f.val;
            opt.textContent = f.label;
            fontSelect.appendChild(opt);
          });
          fontSelect.onchange = (e) => {
            contentWrap.style.fontFamily = e.target.value;
          };
          rightTools.appendChild(fontSelect);

          // Font Size A- / A+
          let currentSize = 18;
          const sizeMinus = document.createElement('button');
          sizeMinus.textContent = 'A-';
          sizeMinus.style.cssText = 'padding:3px 8px;border-radius:6px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.08);color:inherit;font-size:12px;font-weight:700;cursor:pointer;';
          sizeMinus.onclick = () => {
            if (currentSize > 14) {
              currentSize -= 2;
              contentWrap.style.fontSize = currentSize + 'px';
            }
          };

          const sizePlus = document.createElement('button');
          sizePlus.textContent = 'A+';
          sizePlus.style.cssText = 'padding:3px 8px;border-radius:6px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.08);color:inherit;font-size:12px;font-weight:700;cursor:pointer;';
          sizePlus.onclick = () => {
            if (currentSize < 30) {
              currentSize += 2;
              contentWrap.style.fontSize = currentSize + 'px';
            }
          };
          rightTools.append(sizeMinus, sizePlus);

          // Text to Speech (TTS) Read Aloud Button
          const ttsBtn = document.createElement('button');
          ttsBtn.textContent = '🔊 הקרא בקול';
          ttsBtn.style.cssText = 'padding:5px 12px;border-radius:14px;border:1px solid #8aa4ff;background:rgba(138,164,255,0.15);color:#8aa4ff;font-size:12px;font-weight:600;cursor:pointer;';
          let isSpeaking = false;
          ttsBtn.onclick = () => {
            if (isSpeaking) {
              window.speechSynthesis.cancel();
              isSpeaking = false;
              ttsBtn.textContent = '🔊 הקרא בקול';
              ttsBtn.style.background = 'rgba(138,164,255,0.15)';
            } else {
              const fullSpeechText = title + '. ' + Array.from(contentWrap.querySelectorAll('p, h2, h3')).map(p => p.innerText).join(' ');
              const utter = new SpeechSynthesisUtterance(fullSpeechText.slice(0, 5000));
              window.__drift_tts_utterance = utter;
              utter.onend = () => {
                isSpeaking = false;
                ttsBtn.textContent = '🔊 הקרא בקול';
                ttsBtn.style.background = 'rgba(138,164,255,0.15)';
              };
              utter.onerror = () => {
                isSpeaking = false;
                ttsBtn.textContent = '🔊 הקרא בקול';
                ttsBtn.style.background = 'rgba(138,164,255,0.15)';
              };
              window.speechSynthesis.speak(utter);
              isSpeaking = true;
              ttsBtn.textContent = '⏹ עצור הקראה';
              ttsBtn.style.background = '#8aa4ff';
              ttsBtn.style.color = '#111';
            }
          };
          rightTools.appendChild(ttsBtn);

          toolbar.append(leftTools, rightTools);
          overlay.appendChild(toolbar);

          // Content Wrapper
          const contentWrap = document.createElement('div');
          contentWrap.style.cssText = 'max-width:740px;margin:36px auto 80px;padding:0 24px;direction:auto;';

          const h1 = document.createElement('h1');
          h1.textContent = title;
          h1.style.cssText = 'font-size:32px;font-weight:800;line-height:1.3;margin-bottom:28px;letter-spacing:-0.5px;';
          contentWrap.appendChild(h1);

          if (elements.length > 0) {
            elements.forEach(node => {
              if (node.tagName === 'IMG') {
                const img = document.createElement('img');
                img.src = node.src;
                img.alt = node.alt || '';
                img.style.cssText = 'max-width:100%;height:auto;border-radius:10px;margin:20px 0;display:block;box-shadow:0 6px 18px rgba(0,0,0,0.25);';
                contentWrap.appendChild(img);
              } else {
                const el = document.createElement(node.tagName.toLowerCase());
                el.innerText = node.innerText.trim();
                if (/^h[2-4]$/i.test(node.tagName)) {
                  el.style.cssText = 'font-size:22px;font-weight:700;margin:28px 0 12px;line-height:1.4;';
                } else if (node.tagName === 'BLOCKQUOTE') {
                  el.style.cssText = 'border-inline-start:4px solid #8aa4ff;padding-inline-start:16px;margin:20px 0;font-style:italic;opacity:0.9;';
                } else {
                  el.style.cssText = 'margin:18px 0;';
                }
                contentWrap.appendChild(el);
              }
            });
          } else {
            const bodyP = document.createElement('div');
            bodyP.style.cssText = 'white-space:pre-wrap;';
            bodyP.textContent = rawText;
            contentWrap.appendChild(bodyP);
          }

          overlay.appendChild(contentWrap);
          document.body.appendChild(overlay);
        })()`,
        true,
      )
      .catch(() => {});
  }

  /** Space switcher button at the start of the top tab strip. */
  spacesMenu() {
    const items: MenuItemConstructorOptions[] = this.spaces.map((s) => ({
      label: s.name,
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
      { label: this.i18n.t('menu.icon'), submenu: ICONS.map((icon) => ({ label: this.i18n.t(`icon.${icon}` as MessageKey), type: 'radio', checked: s.icon === icon, click: () => this.run({ type: 'space:set', id, icon }) })) },
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
        { label: 'פתח קישור בחלון גלישה בסתר · Open Link in Incognito Window', click: () => this.openIncognitoWindow(p.linkURL) },
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
    if (p.mediaType === 'video' || p.mediaType === 'audio') {
      items.push(
        { label: 'תמונה בתוך תמונה · Picture in Picture (Alt+P)', accelerator: 'Alt+P', click: () => this.run({ type: 'page:pip' }) },
        sep,
      );
    }
    if (p.mediaType === 'image' && p.srcURL) {
      items.push(
        {
          label: 'חפש תמונה באמצעות Google Lens · Search Image with Google Lens',
          click: () => this.createTab({ url: `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(p.srcURL)}`, afterId: id }),
        },
        { label: this.i18n.t('menu.openImage'), click: () => this.createTab({ url: p.srcURL, afterId: id }) },
        { label: this.i18n.t('menu.copyImage'), click: () => wc.copyImageAt(p.x, p.y) },
        sep,
      );
    }
    if (p.isEditable) {
      items.push({ role: 'undo' }, { role: 'redo' }, sep, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }, sep);
    } else if (p.selectionText.trim()) {
      const q = p.selectionText.trim();
      items.push(
        { role: 'copy' },
        { label: 'Sync Selection to Cloud Clipboard', click: () => this.clipboardMonitor.captureNow(q) },
        { label: this.i18n.t('menu.searchFor', { text: q.length > 30 ? q.slice(0, 30) + '…' : q }), click: () => this.createTab({ url: q, afterId: id }) },
        { label: 'Explain Selection with Local AI', click: () => this.run({ type: 'ai:prompt', prompt: `Explain this selection:\n\n"${q}"`, action: 'explain', includePage: false }) },
        { label: 'Translate Selection with Local AI', click: () => this.run({ type: 'ai:prompt', prompt: q, action: 'translate', includePage: false }) },
        sep,
      );
    }
    const pageHost = hostOfUrl(wc.getURL());
    items.push(
      { label: this.i18n.t('menu.back'), enabled: wc.navigationHistory.canGoBack(), click: () => wc.navigationHistory.goBack() },
      { label: this.i18n.t('menu.forward'), enabled: wc.navigationHistory.canGoForward(), click: () => wc.navigationHistory.goForward() },
      { label: this.i18n.t('menu.reload'), click: () => wc.reload() },
      { label: 'יצירת קוד QR עבור דף זה · Create QR Code for this Page', click: () => this.run({ type: 'page:qr', url: wc.getURL() }) },
      { label: 'תרגום דף זה עם Google Translate', click: () => this.run({ type: 'page:translate' }) },
      sep,
      {
        label: 'Local AI Assistant (Ollama)',
        submenu: [
          { label: 'Summarize This Page', click: () => this.run({ type: 'ai:prompt', prompt: '', action: 'summarize', includePage: true }) },
          { label: 'Explain Key Concepts', click: () => this.run({ type: 'ai:prompt', prompt: '', action: 'explain', includePage: true }) },
          { label: 'Translate Page with Ollama', click: () => this.run({ type: 'ai:prompt', prompt: '', action: 'translate', includePage: true }) },
          { type: 'separator' },
          { label: 'Toggle AI Side Panel (Ctrl+Shift+A)', click: () => this.run({ type: 'ai:toggle' }) },
        ],
      },
      ...(pageHost
        ? [
            {
              label: `Dark Mode for ${pageHost}`,
              type: 'checkbox' as const,
              checked: this.darkEngine.isActiveForUrl(wc.getURL()),
              click: () => this.run({ type: 'darkmode:toggle-site', host: pageHost }),
            },
          ]
        : []),
      this.openInMenu(wc.getURL()),
      { type: 'separator' },
      { label: this.i18n.t('act.print'), accelerator: 'Ctrl+P', click: () => wc.print() },
      { label: 'תמונה בתוך תמונה · Picture in Picture', accelerator: 'Alt+P', click: () => this.run({ type: 'page:pip' }) },
      { label: this.i18n.t('act.screenshot'), accelerator: 'Ctrl+Shift+S', click: () => void this.screenshot(id) },
      { label: this.i18n.t('act.translate'), click: () => this.run({ type: 'page:translate' }) },
      { label: this.i18n.t('act.source'), accelerator: 'Ctrl+U', click: () => this.run({ type: 'page:source' }) },
      { type: 'separator' },
      { label: this.i18n.t('menu.inspect'), click: () => wc.inspectElement(p.x, p.y) },
    );
    Menu.buildFromTemplate(items).popup({ window: this.win });
  }
}
