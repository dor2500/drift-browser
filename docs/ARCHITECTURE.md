# Drift: architecture

A Chromium-based browser with Zen's UI ideas: vertical tabs, Essentials, Spaces, split view, compact mode and a floating URL bar, in a dark-first design.

## 1. What the Zen install contains (scanned 2026-11-06)

`C:\Program Files\Zen Browser`: **Zen 1.24b, Gecko 159** (`application.ini`, source `github.com/zen-browser/desktop`).

| Piece | Where | Notes |
|---|---|---|
| Engine | `xul.dll` (170 MB) | Gecko. Nothing reusable for Chromium. |
| Gecko resources | `omni.ja` (71 MB) | Toolkit and Firefox resources. |
| **Zen UI** | `browser/omni.ja` (110 MB, a zip) | `chrome/browser/content/browser/zen-styles/` (38 CSS files), `zen-components/` (JS), `modules/zen/` |
| Default prefs | `browser/omni.ja → defaults/preferences/firefox.js` | All `zen.*` behaviour flags |

Key Zen modules and what they do:

- `ZenSpaceManager.mjs`, `ZenSpace.mjs`, `ZenSpacesSwipe.mjs`: Spaces (workspaces) and swipe-to-switch
- `ZenPinnedTabManager.mjs`, `ZenFolders.mjs`: pinned tabs, Essentials, folders
- `ZenViewSplitter.mjs`, `zen-split-view.css`: split view (grid, drag-to-split)
- `ZenCompactMode.mjs`, `zen-compact-mode.css`: hide the sidebar, show it on hover
- `ZenGlanceManager.mjs`: Glance (Alt+click preview pop-over)
- `zen-tabs/vertical-tabs.css` (1,427 lines): the whole tab strip

### Measured design tokens (dark scheme, Windows)

| Token | Zen variable | Value |
|---|---|---|
| Base radius | `--zen-border-radius` | 7px |
| Gap between UI elements | `--zen-element-separation` | 8px |
| Web content radius | `--zen-native-inner-radius` | max(5px, (7 − 4) × 2.3) ≈ 7–8px |
| Branding dark | `--zen-branding-dark` | `#101010` |
| Behind the page | `--zen-main-browser-background` | `#1b1b1b` |
| Panels | `--arrowpanel-background` | `rgb(31,31,31)` |
| URL bar | `--zen-urlbar-background` | accent 4% + `rgb(24,24,24)` |
| Selected tab | `--tab-background-color-selected` | `rgba(255,255,255,.18)` 95% + accent |
| Selected tab shadow | `--tab-box-shadow-selected` | `0 .8px 1.5px rgba(0,0,0,.05)` |
| Essential tile height | `--tab-min-height` | 46px, grid of about 4 |
| Essential selected fill | `--zen-essential-tab-selected-bg` | `rgba(68,64,64,.85)`, inset 2px |
| Toolbar height | `--zen-toolbar-height` | 38px |
| Space indicator | `--zen-workspace-indicator-height` | 44px |
| Sidebar min width | `--zen-toolbox-min-width` | 163px |
| Press scale | `--zen-active-tab-scale` | 0.98 |
| Compact-mode timing | `--zen-compact-mode-time` | 0.25s |
| Font (Windows) | | Segoe UI |

Accent colours come from one `--zen-primary-color` and are mixed into every surface. Drift does the same with `--accent` per space, registered with `@property` so the window gradient animates when you switch spaces.

## 2. Choosing the Chromium base

| Option | Time to first build | UI iteration | Native features | Extensions / DRM | Maintenance |
|---|---|---|---|---|---|
| **Fork Chromium** (C++ Views) | Weeks; 100 GB checkout, hours per build | Slow (C++ Views, rebuilds) | Full | Full Chrome Web Store; Widevine needs a Google licence | Very high: rebase every 4 weeks |
| **CEF** | Days | HTML shell, but you write the C++ host | High | Partial extensions | Medium, C++ |
| **Tauri** | Fast | HTML/React | On Windows it uses WebView2, **one webview per window**; multiple tabs are experimental | Poor | Low, but wrong tool for a browser |
| **Electron** ✅ | Hours | React + CSS + HMR | `WebContentsView` per tab, sessions, permissions, devtools | Partial MV3 (`electron-chrome-extensions`); Widevine via Castlabs' Electron build | Low; Chromium updates every 8 weeks |

**Decision: Electron with `WebContentsView`, a React/TypeScript shell, and a clean seam so the shell could later move into a Chromium fork.**

Why: Zen's identity is mostly UI (CSS, layout, motion). Electron gives a real Chromium tab per `WebContentsView` and lets us build the UI in the same language Zen uses (CSS). If Drift outgrows Electron, the `Command`/`BrowserState` contract in `shared/types.ts` is the API a native C++ host would implement, and the React shell could run inside a Chromium fork as a WebUI.

## 3. How Drift works

```
┌──────────── BrowserWindow (frameless) ───────────────────────────┐
│ Shell renderer (React)              │ WebContentsView per tab     │
│  Sidebar · CommandBar · placeholder │ (native, sandboxed, drawn   │
│  <div data-pane> rectangles ────────┼──► on top at reported rects)│
└─────────────────────────────────────┴────────────────────────────┘
        ▲ state (push)        │ Command (invoke)  │ layout(panes)
        └──────── electron/browser.ts: Browser (single source of truth)
```

- **Main process owns the model** (`electron/browser.ts`): tabs, spaces, split, compact mode. Every change pushes `BrowserState` to the shell and is saved (debounced) to `%APPDATA%/Drift/session.json`.
- **The shell is a view.** It sends `Command`s and never touches web content.
- **Layout is CSS.** The content area draws empty `.pane` divs; a `ResizeObserver` reports their rectangles, and the main process moves each tab's native view onto its rectangle. Split view, resizing, compact mode and the sidebar width all work without extra layout code in the main process.
- **Views load lazily**: a tab gets a `WebContentsView` only when first shown, like Zen's unloaded pinned tabs.
- **Overlays**: native views always paint above HTML. When the command bar opens, the main process captures each visible view, the shell shows those images, and the views are hidden. They come back when the bar closes.
- **Glance**: `electron/tab-preload.ts` (sandboxed, isolated world) catches trusted Alt+clicks on links and sends the URL plus click point. The preview is a real tab marked `glanceOf`, so it gets title, favicon and history for free and can become a normal tab (or a split pane) without reloading. The page behind is a dimmed screenshot. The card grows from the click point as HTML, and the native view is placed once the animation settles.
- **Permissions** (`electron/permissions.ts`): replaces Electron's grant-everything default. Fullscreen, clipboard write, pointer lock and DRM key systems are always allowed. Camera, microphone, location, notifications, clipboard read, MIDI, external-app links and a few others are asked through a card in the sidebar, where HTML can show without covering the page. Answers can be remembered per site (`%APPDATA%/Drift/permissions.json`). Everything else is denied. Prompts are dropped when the page navigates or the tab closes. Background tabs with a waiting prompt get a dot, and compact mode opens the sidebar for a prompt. The lock icon in the URL pill opens a menu to change or reset a site's remembered answers.
- **RTL fix**: in right-to-left UI languages (your Windows is in Hebrew), Chromium mirrors child-view x coordinates. `applyLayout` flips x back.

### Feature map

| Zen feature | Drift v0.1 |
|---|---|
| Vertical tabs, new tabs at the top, Clear button | ✅ |
| Essentials (global favicon grid, max 12) | ✅ drag in, or use the context menu |
| Pinned tabs per space | ✅ |
| Spaces: icon, colour, rename, delete, swipe, Ctrl+Alt+←/→ | ✅ |
| Split view: 2 panes, draggable gutter, focus outline | ✅ (Zen allows grids of 4) |
| Compact mode (Ctrl+Alt+C), hover the left edge to show | ✅ (pushes content instead of floating; see limits) |
| Floating URL bar / tab search (Ctrl+T, Ctrl+L) | ✅ |
| Drag and drop between Essentials, pinned and tabs | ✅ |
| Glance: Alt+click preview card, Esc to close, open as tab or in split; links leaving an Essential open in Glance | ✅ |
| Folders, Live Folders, Boosts (per-site CSS), Mods | ⏳ |
| Profiles/containers per space | ⏳ (`session.fromPartition` per space) |
| Extensions, DRM video, auto-update, Mica backdrop | ⏳ |

### Styles, settings and updates

- **Styles** (`shared/themes.ts`, `src/styles/themes.css`, `src/styles/topbar.css`): Zen, Firefox, Brave and Chrome, each measured from the install on this PC. Firefox came from its `omni.ja` design tokens. Brave and Chrome came from their `.pak` WebUI bundles, read with a small pak v5 parser (Brave's Leo tokens, Chrome's `cr_elements` dark fallbacks). Picking a style also picks its layout: Zen uses the sidebar (`Sidebar.tsx`); the others use a top tab strip, toolbar and omnibox (`TopBar.tsx`) with per-browser tab shapes. `settings.verticalTabs` can override either way. The native page corner radius follows the layout (`contentRadiusFor`).
- **Settings** (`electron/settings.ts`, `%APPDATA%/Drift/settings.json`, sanitised on load) are part of `BrowserState`. The settings page is an internal `drift://settings` tab drawn by the shell inside the pane, so it has no web view.
- **First-run setup** (`Onboarding.tsx`) appears while `settings.onboarded` is false and holds the same overlay the command bar uses.
- **Updates** (`electron/updater.ts`): `electron-updater` against GitHub Releases or a generic https server, stable or beta, checked on startup and every 6 hours. A separate engine check reads `releases.electronjs.org` and Google's VersionHistory API to compare Drift's Chromium with the newest Electron and Chrome stable. `scripts/update-engine.mjs` performs the upgrade in development.
- **Icon** (`assets/icon.svg`): a "D" whose stem is a vertical-tab sidebar. `npm run icons` renders the PNG sizes and a multi-size `.ico` used by the window, taskbar (AppUserModelID `app.drift.browser`) and installer.

### Known limits of the Electron approach

1. HTML cannot draw over a web page. Floating UI uses the screenshot swap. Compact mode pushes the page aside instead of floating the sidebar over it. A Chromium fork removes this limit.
2. Chrome Web Store extensions are partly supported (through `electron-chrome-extensions`).
3. Netflix-style DRM needs Castlabs' "Electron for Content Security" build.
4. The Chromium version trails Google Chrome by the time Electron needs to adopt each release (Chrome 158 vs Drift's 156 on 2026-11-06).

## 4. Roadmap

1. **Downloads UI** and **screen sharing** (`getDisplayMedia` needs a screen/window picker via `setDisplayMediaRequestHandler`).
2. **Per-space containers**: one partition per space, so logins stay separate.
3. **Boosts/Mods**: inject user CSS with `webContents.insertCSS` per host.
4. **Code signing** for the installer (removes the SmartScreen warning), and default-browser registration.
5. Split grids of 3–4 panes; folders.

## Licensing note

Zen is MPL-2.0. Drift does not copy Zen's source files, icons or branding. Measured values (radii, sizes, colour mixes) are re-implemented. Do not ship the Zen name or logo.
