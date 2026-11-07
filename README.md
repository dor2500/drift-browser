<p align="center"><img src="assets/png/icon-128.png" width="96" alt="Drift icon"></p>

<h1 align="center">Drift</h1>

<p align="center">A dark, minimal Chromium browser with Zen-style vertical tabs, spaces, split view and Glance, plus Chrome, Firefox and Brave styles, a built-in ad blocker and automatic Chromium security updates.</p>

<p align="center"><img src="docs/screenshots/style-zen.png" width="860" alt="Drift in Zen style"></p>

## Install

**Windows**, in PowerShell:

```powershell
irm https://raw.githubusercontent.com/dor2500/drift-browser/main/install.ps1 | iex
```

**macOS / Linux**, in a terminal:

```bash
curl -fsSL https://raw.githubusercontent.com/dor2500/drift-browser/main/install.sh | sh
```

**Android**: download `Drift-x.y.z.apk` from [Releases](https://github.com/dor2500/drift-browser/releases/latest) and open it (allow installing from your browser or Files app when Android asks). Drift checks for new versions itself and offers them in its ⋮ menu.

Or download `Drift-Setup-x.y.z.exe` (Windows), the `.dmg` (macOS) or the `.AppImage` / `.deb` (Linux) from [Releases](https://github.com/dor2500/drift-browser/releases/latest). Installed copies update themselves. Builds aren't code-signed yet, so Windows SmartScreen may say "More info → Run anyway", and on macOS the install script clears the download-quarantine flag.

## Features

- **Four styles, each with its browser's real layout.** Colours and shapes were measured from the copies installed on the developer's PC:

  | Zen | Chrome |
  |---|---|
  | ![Zen](docs/screenshots/style-zen.png) | ![Chrome](docs/screenshots/style-chrome.png) |
  | **Firefox** | **Brave** |
  | ![Firefox](docs/screenshots/style-firefox.png) | ![Brave](docs/screenshots/style-brave.png) |

- **Vertical tabs, Essentials, pinned tabs, Spaces** (swipe or Ctrl+Alt+←/→), **compact mode**, **split view** and **Glance** (Alt+click a link to preview it).
- **Built-in ad and tracker blocking.** EasyList, EasyPrivacy and uBlock filters plus a YouTube ad skipper. The shield in the address bar shows the blocked count and pauses blocking per site.

  ![Shield and media controls](docs/screenshots/adblock-youtube.png)

- **Import from Zen, Firefox, Chrome, Brave and Edge.** Bookmarks and history become address-bar suggestions. From Zen, your spaces, pinned tabs, Essentials and open tabs come across too.

  ![Zen import](docs/screenshots/zen-import.png)

- **Everyday tools:** find in page (Ctrl+F), zoom remembered per site, downloads (Ctrl+J), picture-in-picture, print, page source, screenshots (Ctrl+Shift+S), translate page, and sleeping tabs that free memory.
- **Command actions:** type an action name in the address bar (or start with `>`) to run it, as in Arc and Vivaldi.
- **Colour themes:** Ocean, Midnight, Nord, Dracula, Catppuccin, Tokyo Night, Gruvbox and more on top of any style, plus a custom accent. Optional dark mode for every website.

  ![Ocean theme with the find bar](docs/screenshots/theme-ocean-find.png)

- **Google sign-in** for Gmail, YouTube and Drive. Chrome Sync is Chrome-only. **Open page in** any other installed browser, with per-site "always open in…" rules.
- **Two engines.** Chromium is built in. **Gecko** (the Firefox engine) runs Firefox with a Drift-managed, LibreWolf-style hardened profile that follows Drift's own settings: your privacy choices, search engine, style (vertical tabs for Zen, top tabs for Chrome/Brave/Firefox), ad blocking with uBlock Origin, and a Drift start page with your pinned tabs and top sites. Switch in Settings → Engine; your tabs move both ways. Drift uses the Firefox on your PC or downloads the official build from Mozilla.
- **Privacy by default.** No telemetry, analytics or crash reporting. HTTPS-First, tracking-parameter stripping, third-party cookie blocking, Global Privacy Control and Do Not Track, and WebRTC IP protection. Settings lists every server Drift contacts on its own, and each one can be switched off.
- **New-tab pages per style.** Chrome (search pill and shortcuts), Brave (trackers blocked, time saved and a clock), Firefox Home, and a calm Zen clock. Settings pages follow the style too, with "Search settings" that works in any language.
- **Media controls** in the sidebar for whatever is playing.
- **Permission prompts** for camera, microphone, location and notifications, with per-site answers you can change from the lock icon.
- **Languages:** English and Hebrew built in (Hebrew lays out right to left). More languages download on demand from [`locales/`](locales/).

  ![Hebrew](docs/screenshots/hebrew-rtl.png)

- **First-run setup** for style, import, search engine and update source, and a **settings page** for everything.

  | First run | Settings |
  |---|---|
  | ![First run](docs/screenshots/first-run.png) | ![Settings](docs/screenshots/settings.png) |

## Drift for Android

A native Kotlin + Jetpack Compose app in [`android/`](android/) with **two engines built in**: Chromium (Android System WebView) and **Gecko** (Mozilla's GeckoView, the engine of Firefox for Android). Each tab runs on either one: pick the engine for new tabs in Settings, or move any tab from the menu. Also:
- **Material You** design: colours from your wallpaper (Android 12+, or your space's colour), light, dark or system theme, Material 3 components throughout, and a themed icon.
- A rounded floating page and a thumb-friendly bottom bar (address pill with a shield, tab counter, menu sheet with quick actions).
- Tabs in spaces, kept across restarts, and a tab grid.
- Ad and tracker blocking on both engines (Drift's list on Chromium, Firefox's Enhanced Tracking Protection on Gecko) plus the YouTube ad skipper.
- **Private tabs** (Incognito): nothing saved, screenshots blocked, a separate cookie jar.
- **History** and **bookmarks** (on the phone only), a start page with your most-visited sites, suggestions as you type.
- **Reader view**, translate page, print or save as PDF, add to home screen, find in page, desktop site, long-press menus for links and images, video full screen, file uploads and downloads.
- Settings: search engine (Google, DuckDuckGo, Brave Search, Startpage, Bing, Ecosia, Qwant), text size, dark web pages, HTTPS-Only, Global Privacy Control, third-party cookies, JavaScript, clear browsing data.
- Google sign-in that works (the WebView's `; wv` marker that Google blocks is removed).
- English and Hebrew.

Download `Drift-x.y.z.apk` for most phones (64-bit ARM); `-armeabi-v7a` and `-x86_64` builds are there for older phones and emulators. Each APK is about 90 MB because it carries Gecko. Build locally with `cd android` then `gradlew assembleRelease`; CI builds signed APKs for every release.

| Light | Menu | Dark tabs | Settings |
|---|---|---|---|
| ![Android light](docs/screenshots/android-material-light.png) | ![Android menu](docs/screenshots/android-material-menu.png) | ![Android dark tabs](docs/screenshots/android-material-dark-tabs.png) | ![Android settings](docs/screenshots/android-material-settings.png) |

| Gecko engine | Engine per tab | Engines in Settings | Reader view |
|---|---|---|---|
| ![Gecko](docs/screenshots/android-gecko.png) | ![Engine menu](docs/screenshots/android-engine-menu.png) | ![Engines](docs/screenshots/android-settings-engines.png) | ![Reader](docs/screenshots/android-reader.png) |

## Updates and Chromium security

Drift's engine is the Chromium inside Electron. Electron ships each new Chromium about every 8 weeks, with security fixes backported in between.

- `.github/workflows/engine-watch.yml` runs **every day**. When a newer stable Electron is out, it upgrades Drift, bumps the version and publishes a release.
- `.github/workflows/release.yml` builds Windows, macOS and Linux and publishes one GitHub Release. Installed copies download it in the background and install it on restart.
- To publish your own release:

  ```bash
  npm version patch
  ```

  ```bash
  git push --follow-tags
  ```

## Develop

```bash
npm install
npm run dev              # Vite + HMR for the UI, launches Electron
npm run build && npm start
npm run update-engine    # newest Electron/Chromium (add --dry-run to just check)
npm run icons            # re-render assets/icon.svg into PNG + .ico
npm run dist             # local installer for this OS into release/
```

```
electron/   main.ts · browser.ts (tabs, spaces, native views) · adblock.ts · importer.ts · history.ts · permissions.ts
            settings.ts · i18n.ts · updater.ts · env.ts · store.ts · preload.ts · tab-preload.ts · mozlz4.ts
shared/     types.ts (Command / BrowserState contract) · settings.ts · themes.ts · i18n.ts · locales/ (en, he) · url.ts
src/        App.tsx · components/ (Sidebar, TopBar, ContentArea, CommandBar, Glance, Onboarding, SettingsPage, …) · styles/
locales/    downloadable language packs + index.json
assets/     icon.svg → icon.png, icon.ico, png/ sizes
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how it works and why Electron, and [docs/FEATURES.md](docs/FEATURES.md) for a feature-by-feature comparison with other browsers and the roadmap.

## Shortcuts

| Keys | Action |
|---|---|
| Ctrl+T / Ctrl+L | New tab / edit address |
| Ctrl+W, Ctrl+Shift+T | Close / reopen tab |
| Ctrl+Tab, Ctrl+1…9 | Cycle / jump tabs |
| Ctrl+Alt+← / → | Previous / next space |
| Ctrl+Alt+C | Compact mode |
| Ctrl+Alt+V | Split view with the next tab |
| Alt+click a link | Glance (Esc closes) |
| Ctrl+F, Ctrl+J | Find in page, downloads |
| Ctrl +/−/0 | Zoom in / out / reset |
| Ctrl+P, Ctrl+U, Ctrl+Shift+S | Print, page source, screenshot |
| Ctrl+D | Pin or unpin the tab |
| Ctrl+, | Settings |
| Alt+← / →, Ctrl+R | Back / forward, reload |
| F12 | DevTools |

On macOS, use Cmd instead of Ctrl.
