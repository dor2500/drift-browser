# Drift

A dark, minimal Chromium browser (Electron + React) with Zen-style vertical tabs, Essentials, Spaces, split view and compact mode. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the Zen analysis and design decisions.

```bash
npm install
npm run dev              # Vite + HMR for the UI, launches Electron
npm run build && npm start   # production build
npm run update-engine    # move to the newest Electron/Chromium (add --dry-run to just check)
npm run icons            # re-render assets/icon.svg into PNG + .ico
npm run dist             # Windows installer into release/ (local, not published)
```

## Download

Get the latest **Drift Setup x.y.z.exe** from [Releases](https://github.com/dor2500/drift-browser/releases/latest). Installed copies update themselves from there: the update downloads in the background and installs when Drift restarts. The installer isn't code-signed yet, so Windows SmartScreen may show "More info → Run anyway".

## Releasing updates

- **Your own release:** bump the version and push a tag. GitHub Actions builds the installer and publishes the release; users receive it automatically.
  ```bash
  npm version patch
  git push --follow-tags
  ```
- **Chromium security updates:** `.github/workflows/engine-watch.yml` runs daily. Chrome's security fixes reach Drift through Electron's patched releases. When a newer stable Electron appears, the workflow upgrades it, bumps Drift's version, and publishes a release on its own, so users stay within a day of Electron's fixes.

## Styles, settings and updates

On first launch Drift asks which **style** you want, which **search engine** to use, and **where updates come from**. Each style copies the real browser's layout as well as its colours. All four were measured from the copies installed on this PC:

| Style | Layout | Measured from |
|---|---|---|
| Zen | Vertical tabs, floating rounded page, space-tinted glow | Zen 1.24b `omni.ja` |
| Firefox | Tabs on top, separate tab strip, floating rounded tabs | Firefox 159 design tokens |
| Brave | Chromium layout, Leo colours, rounded tabs | Brave 1.99 `brave_resources.pak` |
| Chrome | Selected tab merges into toolbar, pill omnibox, ⋮ menu | Chrome 156 `resources.pak` |

Settings (`Ctrl+,`, the gear, or ⋮ → Settings) holds appearance, vertical tabs, search engine, home page, session restore, remembered site permissions, update source and versions.

**Updates and Chromium:** Drift's engine is the Chromium inside Electron. It can't take Google's Chrome updates directly. Electron ships each new Chromium about every 8 weeks, with security fixes in between. Settings → Updates shows Drift's Chromium next to the newest Electron and Google's Chrome stable. New engines reach installed copies as Drift updates from your chosen source (GitHub Releases or your own server). In development, `npm run update-engine` upgrades and rebuilds.


## Project layout

```
electron/   main.ts · browser.ts (tab/space model + native views) · permissions.ts · settings.ts · updater.ts · env.ts · store.ts · preload.ts · tab-preload.ts
shared/     types.ts (Command / BrowserState contract) · settings.ts · themes.ts · permissions.ts · url.ts
assets/     icon.svg (source) → icon.png, icon.ico, png/ sizes
src/        App.tsx · components/ (Sidebar, TopBar, ContentArea, CommandBar, Glance, Onboarding, SettingsPage, …) · styles/ (tokens, themes, topbar, pages, app)
```

## Shortcuts

| Keys | Action |
|---|---|
| Ctrl+T / Ctrl+L | New tab / edit address (floating URL bar) |
| Ctrl+W, Ctrl+Shift+T | Close / reopen tab |
| Ctrl+Tab, Ctrl+1…9 | Cycle / jump tabs |
| Ctrl+Alt+← / → | Previous / next space (or swipe sideways on the sidebar) |
| Ctrl+Alt+C | Compact mode |
| Ctrl+Alt+V | Toggle split view with the next tab |
| Alt+click a link | Glance: preview it in a floating card (Esc closes) |
| Alt+← / →, Ctrl+R | Back / forward, reload |
| F12 | DevTools for the page (Ctrl+Shift+Alt+I for the shell) |

When a site asks for the camera, microphone, location, notifications and so on, a card appears in the sidebar (tick “Remember” to keep the answer). Click the lock icon in the URL pill to change what a site may do.

Right-click a tab for Essentials, pin, split, mute and moving it between spaces. Right-click a space to rename it or change its icon or colour. Drag tabs between Essentials, pinned and regular.
