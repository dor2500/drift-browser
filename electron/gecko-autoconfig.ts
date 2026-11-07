/**
 * Drift inside the Gecko engine, through Firefox's autoconfig (the mechanism
 * LibreWolf and enterprise setups use). Only Drift's own portable copy of the
 * engine gets these files, never a Firefox the user installed.
 *
 * - The window is titled "Drift", not "Mozilla Firefox".
 * - Settings (about:preferences) gets a "Drift" section with Drift's own options.
 *   Each one changes the engine right away and is saved to Drift's settings.json,
 *   so Chromium and Gecko keep the same settings.
 * - "Back to Chromium" starts Drift and closes the engine.
 */

/** defaults/pref/autoconfig.js: tells Gecko to run drift.cfg at startup. */
export const AUTOCONFIG_JS = `// Drift: load drift.cfg (managed by Drift)
pref("general.config.filename", "drift.cfg");
pref("general.config.obscure_value", 0);
pref("general.config.sandbox_enabled", false);
`;

/** drift.cfg: privileged startup script. Its first line must be a comment. */
export const DRIFT_CFG = String.raw`// Drift for the Gecko engine. Managed by Drift; rewritten whenever Drift starts the engine.
(function () {
  const { Services } = globalThis.Services ? globalThis : ChromeUtils.importESModule("resource://gre/modules/Services.sys.mjs");
  const pref = (name, fallback) => {
    try { return Services.prefs.getStringPref(name); } catch (e) { return fallback; }
  };
  // Lets Drift (and anyone curious) see that Drift's script is active in this engine.
  Services.prefs.setStringPref("drift.cfg.active", String(Date.now()));
  const he = pref("drift.lang", "en") === "he";
  const T = he ? {
    drift: "Drift", lead: "ההגדרות של Drift. הן נשמרות גם למנוע Chromium.",
    back: "חזרה למנוע Chromium", engine: "מנוע Gecko (Firefox) של Drift",
    look: "מראה", style: "סגנון", zen: "Zen (כרטיסיות אנכיות)", chrome: "Chrome", edge: "Edge", brave: "Brave", opera: "Opera", firefox: "Firefox", tor: "Tor Browser (מראה בלבד)",
    restart: "שינוי הסגנון יחול בפתיחה הבאה של המנוע.",
    search: "מנוע חיפוש", privacy: "פרטיות ואבטחה",
    adblock: "חסימת פרסומות ורכיבי מעקב (uBlock Origin)", https: "מצב HTTPS בלבד",
    gpc: "לבקש מאתרים לא למכור או לשתף את המידע שלי", strip: "הסרת פרמטרי מעקב מקישורים",
    webrtc: "הגנה על כתובת ה-IP ב-WebRTC", general: "כללי",
    smooth: "גלילה חלקה", confirm: "אישור לפני סגירת כמה כרטיסיות", restore: "פתיחת הכרטיסיות מהפעם הקודמת",
    dark: "מצב כהה לכל האתרים",
  } : {
    drift: "Drift", lead: "Drift's settings. They are shared with the Chromium engine.",
    back: "Back to the Chromium engine", engine: "Drift's Gecko (Firefox) engine",
    look: "Look", style: "Style", zen: "Zen (vertical tabs)", chrome: "Chrome", edge: "Edge", brave: "Brave", opera: "Opera", firefox: "Firefox", tor: "Tor Browser (look only)",
    restart: "A new style applies the next time the engine starts.",
    search: "Search engine", privacy: "Privacy and security",
    adblock: "Block ads and trackers (uBlock Origin)", https: "HTTPS-Only mode",
    gpc: "Tell sites not to sell or share my data", strip: "Remove tracking parameters from links",
    webrtc: "Protect my IP address in WebRTC", general: "General",
    smooth: "Smooth scrolling", confirm: "Ask before closing several tabs", restore: "Reopen the tabs from last time",
    dark: "Dark mode for every site",
  };
  const SEARCH = { google: "Google", duckduckgo: "DuckDuckGo", bing: "Bing", brave: "Brave Search", startpage: "Startpage" };
  const UBLOCK = "uBlock0@raymondhill.net";

  // ---------------------------------------------------------------- Drift's settings file
  // Drift hands its settings over in a pref when it starts the engine; changes are
  // written back to Drift's settings.json (and the pref, for the rest of this run).
  const settingsPath = pref("drift.settingsFile", "");
  function currentSettings() {
    try { return JSON.parse(pref("drift.settings", "{}")); } catch (e) { return {}; }
  }
  const merge = (s, patch) => Object.assign({}, s, patch, patch.privacy ? { privacy: Object.assign({}, s.privacy || {}, patch.privacy) } : {});
  async function saveSettings(win, patch) {
    Services.prefs.setStringPref("drift.settings", JSON.stringify(merge(currentSettings(), patch)));
    if (!settingsPath) return;
    let file = {};
    try { file = await win.IOUtils.readJSON(settingsPath); } catch (e) {}
    await win.IOUtils.writeJSON(settingsPath, merge(file, patch));
  }

  // ---------------------------------------------------------------- live changes in the engine
  function setBool(name, v) { Services.prefs.setBoolPref(name, v); }
  async function applyAdblock(on) {
    Services.prefs.setStringPref("browser.contentblocking.category", on ? "strict" : "standard");
    try {
      const { AddonManager } = ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs");
      const a = await AddonManager.getAddonByID(UBLOCK);
      if (a) await (on ? a.enable() : a.disable());
    } catch (e) {}
  }
  async function applySearch(id) {
    try {
      await Services.search.init();
      const e = Services.search.getEngineByName(SEARCH[id]);
      if (e) await Services.search.setDefault(e, Ci.nsISearchService.CHANGE_REASON_USER);
    } catch (e) {}
  }
  function applyStyle(theme) {
    const vertical = theme === "zen";
    setBool("sidebar.revamp", vertical);
    setBool("sidebar.verticalTabs", vertical);
  }

  function backToChromium(win) {
    try {
      const cmd = JSON.parse(pref("drift.launch", "[]"));
      if (!cmd.length) return;
      const exe = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
      exe.initWithPath(cmd[0]);
      const proc = Cc["@mozilla.org/process/util;1"].createInstance(Ci.nsIProcess);
      proc.init(exe);
      const args = cmd.slice(1).concat(["drift-engine://chromium"]);
      proc.runw(false, args, args.length);
      // Give Drift a moment to read this session, then close the engine.
      win.setTimeout(() => Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit), 1500);
    } catch (e) { Cu.reportError(e); }
  }

  // ---------------------------------------------------------------- the "Drift" pane in about:preferences
  function buildPane(win, open) {
    const doc = win.document;
    const categories = doc.getElementById("categories");
    const main = doc.getElementById("mainPrefPane");
    if (!categories || !main || doc.getElementById("category-drift")) return;
    const xul = (tag, attrs) => { const el = doc.createXULElement(tag); for (const k in attrs || {}) el.setAttribute(k, attrs[k]); return el; };
    const html = (tag, attrs, text) => { const el = doc.createElement(tag); for (const k in attrs || {}) el.setAttribute(k, attrs[k]); if (text) el.textContent = text; return el; };

    // Sidebar entry, first in the list. Newer Gecko uses <moz-page-nav>; older ones a richlistbox.
    let item;
    if (categories.localName === "moz-page-nav") {
      item = html("moz-page-nav-button", { id: "category-drift", view: "paneDrift", iconsrc: "chrome://global/skin/icons/settings.svg" }, T.drift);
    } else {
      item = xul("richlistitem", { id: "category-drift", class: "category", value: "paneDrift", "aria-label": T.drift });
      const icon = xul("image", { class: "category-icon" });
      icon.style.listStyleImage = "url(chrome://global/skin/icons/settings.svg)";
      item.append(icon, xul("label", { class: "category-name", flex: "1", value: T.drift }));
    }
    const firstShown = Array.from(categories.children).find((k) => !k.hidden);
    categories.insertBefore(item, firstShown || categories.firstElementChild);
    // Firefox shows a pane's elements when its category is chosen.
    if (typeof win.register_module === "function") win.register_module("paneDrift", { init() {} });

    const pane = [];
    const add = (el) => { el.setAttribute("data-category", "paneDrift"); el.hidden = true; pane.push(el); main.append(el); return el; };

    const header = add(html("div", { class: "header" }));
    header.append(html("h1", { class: "header-name" }, T.drift));

    const group = (title, note) => {
      const box = add(xul("groupbox", {}));
      box.append(html("h2", {}, title));
      if (note) box.append(html("p", { class: "description-deemphasized" }, note));
      return box;
    };

    {
      const s = currentSettings();
      const p = s.privacy || {};
      const top = group(T.engine, T.lead);
      const back = xul("button", { label: T.back, class: "accessory-button" });
      back.addEventListener("command", () => backToChromium(win));
      top.append(back);

      const check = (box, text, value, onChange) => {
        const c = xul("checkbox", { label: text });
        c.checked = !!value;
        c.addEventListener("command", () => onChange(c.checked));
        box.append(c);
      };
      const select = (box, text, value, options, onChange) => {
        const row = html("div", { style: "display:flex;align-items:center;gap:8px;margin-block:4px" });
        row.append(xul("label", { value: text }));
        const list = xul("menulist", {});
        const popup = xul("menupopup", {});
        for (const [id, name] of options) popup.append(xul("menuitem", { label: name, value: id }));
        list.append(popup);
        list.value = value;
        list.addEventListener("command", () => onChange(list.value));
        row.append(list);
        box.append(row);
      };

      const look = group(T.look, T.restart);
      select(look, T.style, s.theme || "zen", [["zen", T.zen], ["chrome", T.chrome], ["edge", T.edge], ["firefox", T.firefox], ["brave", T.brave], ["opera", T.opera], ["tor", T.tor]], (v) => {
        applyStyle(v);
        saveSettings(win, { theme: v });
      });
      select(look, T.search, s.searchEngine || "google", Object.entries(SEARCH), (v) => {
        applySearch(v);
        saveSettings(win, { searchEngine: v });
      });

      const priv = group(T.privacy);
      check(priv, T.adblock, s.adblock !== false, (v) => { applyAdblock(v); saveSettings(win, { adblock: v }); });
      check(priv, T.https, p.httpsOnly !== false, (v) => { setBool("dom.security.https_only_mode", v); saveSettings(win, { privacy: { httpsOnly: v } }); });
      check(priv, T.gpc, p.gpc !== false, (v) => {
        setBool("privacy.globalprivacycontrol.enabled", v);
        setBool("privacy.donottrackheader.enabled", v);
        saveSettings(win, { privacy: { gpc: v } });
      });
      check(priv, T.strip, p.stripTracking !== false, (v) => {
        setBool("privacy.query_stripping.enabled", v);
        setBool("privacy.query_stripping.enabled.pbmode", v);
        saveSettings(win, { privacy: { stripTracking: v } });
      });
      check(priv, T.webrtc, p.webrtcProtect !== false, (v) => {
        setBool("media.peerconnection.ice.default_address_only", v);
        setBool("media.peerconnection.ice.no_host", v);
        saveSettings(win, { privacy: { webrtcProtect: v } });
      });

      const gen = group(T.general);
      check(gen, T.smooth, s.smoothScrolling !== false, (v) => { setBool("general.smoothScroll", v); saveSettings(win, { smoothScrolling: v }); });
      check(gen, T.confirm, !!s.confirmClose, (v) => { setBool("browser.tabs.warnOnClose", v); saveSettings(win, { confirmClose: v }); });
      check(gen, T.restore, s.restoreSession !== false, (v) => { Services.prefs.setIntPref("browser.startup.page", v ? 3 : 1); saveSettings(win, { restoreSession: v }); });
      check(gen, T.dark, !!s.forceDark, (v) => { Services.prefs.setIntPref("layout.css.prefers-color-scheme.content-override", v ? 0 : 2); saveSettings(win, { forceDark: v }); });

      if (open && typeof win.gotoPref === "function") win.gotoPref("paneDrift");
    }
  }

  // ---------------------------------------------------------------- window title
  function brandWindow(win) {
    const root = win.document.documentElement;
    if (!root || root.getAttribute("windowtype") !== "navigator:browser") return;
    // Firefox's translations would put its own name back; the title is Drift's from here on.
    root.removeAttribute("data-l10n-id");
    root.setAttribute("data-title-default", "Drift");
    root.setAttribute("data-title-private", "Drift (private)");
    root.setAttribute("data-content-title-default", "CONTENTTITLE — Drift".replace("CONTENTTITLE", "$" + "{content-title}"));
    root.setAttribute("data-content-title-private", "CONTENTTITLE — Drift (private)".replace("CONTENTTITLE", "$" + "{content-title}"));
    // Newer Gecko builds the title from its own strings; swap the name there too.
    const gb = win.gBrowser;
    if (gb && typeof gb.getWindowTitleForBrowser === "function" && !gb.driftTitle) {
      const original = gb.getWindowTitleForBrowser.bind(gb);
      gb.getWindowTitleForBrowser = (browser) =>
        String(original(browser)).replace(/(Mozilla )?Firefox( Private Browsing| \S+ Browsing)?/g, (m, a, priv) => (priv ? "Drift (private)" : "Drift"));
      gb.driftTitle = true;
    }
    if (gb && gb.updateTitlebar) gb.updateTitlebar();
  }

  // Problems are kept in a pref instead of breaking the engine.
  const guard = (stage, fn) => {
    try { fn(); } catch (e) { Services.prefs.setStringPref("drift.cfg.error", stage + ": " + e); }
  };
  // Every document the engine's own process creates; Settings is one of them.
  const seen = (doc) => {
    const uri = String(doc.documentURI || "");
    if (!uri.startsWith("about:preferences") && !uri.startsWith("about:settings")) return;
    const win = doc.defaultView;
    if (!win) return;
    // Firefox builds its panes on load; add Drift's right after. "#drift" opens it directly.
    const open = uri.endsWith("#drift");
    win.addEventListener("load", () => guard("pane", () => buildPane(win, open)), { once: true });
  };
  // Ad blocking follows Drift's setting each time the engine starts.
  let adblockApplied = false;
  const startup = (win) => {
    // Each new browser window is titled "Drift".
    guard("title", () => brandWindow(win));
    if (adblockApplied) return;
    adblockApplied = true;
    let on = true;
    try { on = Services.prefs.getBoolPref("drift.adblock"); } catch (e) {}
    applyAdblock(on);
  };
  Services.obs.addObserver(startup, "browser-delayed-startup-finished");
  Services.obs.addObserver(seen, "document-element-inserted");
})();
`;
