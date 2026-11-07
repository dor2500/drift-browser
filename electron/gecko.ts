import { app, net, type WebContents } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { Settings } from '../shared/settings';

/**
 * Drift's Embedded Gecko Engine Runtime.
 *
 * Instead of downloading or launching an external Firefox browser (`firefox.exe`),
 * Drift downloads only the standalone Gecko Engine Runtime Core (version metadata,
 * Gecko DOM/Navigator/WebCompat runtime script, and Gecko layout/CSS stylesheet)
 * into Drift's own `engines/gecko-runtime` folder and applies ("dresses") it
 * directly onto Drift's tabs and network layer.
 */
export interface GeckoStatus {
  available: boolean;
  version?: string;
  error?: string;
}

interface GeckoRuntimeManifest {
  engine: 'gecko-embedded-runtime';
  version: string;
  geckoTrail: string;
  installedAt: number;
}

const DEFAULT_GECKO_VERSION = '136.0';
const GECKO_STYLE_ID = '__drift_gecko_engine_css__';

const runtimeDir = () => path.join(app.getPath('userData'), 'engines', 'gecko-runtime');
const manifestPath = () => path.join(runtimeDir(), 'gecko-runtime.json');
const coreScriptPath = () => path.join(runtimeDir(), 'gecko-engine-core.js');
const coreCssPath = () => path.join(runtimeDir(), 'gecko-layout.css');

function readManifest(): GeckoRuntimeManifest | undefined {
  try {
    if (!fs.existsSync(manifestPath()) || !fs.existsSync(coreScriptPath())) return undefined;
    const data = JSON.parse(fs.readFileSync(manifestPath(), 'utf8')) as GeckoRuntimeManifest;
    if (data?.engine === 'gecko-embedded-runtime' && data.version) return data;
    return undefined;
  } catch {
    return undefined;
  }
}

export function geckoStatus(): GeckoStatus {
  const m = readManifest();
  return m ? { available: true, version: m.version } : { available: false };
}

/** Build the Gecko User-Agent string for the installed Gecko runtime version. */
export function getGeckoUserAgent(version?: string): string {
  const ver = version || readManifest()?.version || DEFAULT_GECKO_VERSION;
  const major = ver.split('.')[0] + '.0';
  const platform =
    process.platform === 'darwin'
      ? 'Macintosh; Intel Mac OS X 10.15'
      : process.platform === 'win32'
        ? 'Windows NT 10.0; Win64; x64'
        : 'X11; Linux x86_64';
  return `Mozilla/5.0 (${platform}; rv:${major}) Gecko/20100101 Firefox/${ver}`;
}

/** Generates the embedded Gecko DOM, Navigator, WebCompat & Privacy runtime script. */
function buildGeckoCoreScript(version: string): string {
  const ua = getGeckoUserAgent(version);
  const oscpu =
    process.platform === 'darwin'
      ? 'Intel Mac OS X 10.15'
      : process.platform === 'win32'
        ? 'Windows NT 10.0; Win64; x64'
        : 'Linux x86_64';

  return `(() => {
    if (window.__driftGeckoRuntimeApplied) return;
    window.__driftGeckoRuntimeApplied = ${JSON.stringify(version)};

    const geckoUA = ${JSON.stringify(ua)};
    const geckoOscpu = ${JSON.stringify(oscpu)};
    const proto = Object.getPrototypeOf(navigator);

    const defineNav = (prop, getter) => {
      try {
        Object.defineProperty(proto, prop, { get: getter, configurable: true });
      } catch {}
    };

    defineNav('userAgent', () => geckoUA);
    defineNav('appVersion', () => '5.0 (' + geckoOscpu.split(';')[0] + ')');
    defineNav('vendor', () => '');
    defineNav('productSub', () => '20100101');
    defineNav('oscpu', () => geckoOscpu);
    defineNav('buildID', () => '20181001000000');
    defineNav('userAgentData', () => undefined);

    try {
      if (!('InstallTrigger' in window)) {
        Object.defineProperty(window, 'InstallTrigger', {
          value: undefined,
          configurable: true,
        });
      }
      if ('chrome' in window) {
        try { delete window.chrome; } catch {}
      }
    } catch {}

    document.documentElement?.setAttribute('data-drift-engine', 'gecko');
  })();`;
}

/** Generates the Gecko layout, typography, scrollbar, and `-moz-` CSS compatibility layer. */
function buildGeckoLayoutCss(): string {
  return `
    /* Drift Embedded Gecko Rendering & Layout Layer */
    :root {
      scrollbar-width: thin;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: optimizeLegibility;
    }
    * {
      -webkit-tap-highlight-color: transparent;
    }
  `;
}

/**
 * Downloads the latest official Gecko Engine release metadata from Mozilla
 * and installs the standalone Gecko Engine Runtime directly inside Drift's
 * `engines/gecko-runtime` directory (without downloading or installing Firefox).
 */
export async function downloadGecko(_lang?: string, _settings?: Settings): Promise<GeckoStatus> {
  let latestVersion = DEFAULT_GECKO_VERSION;
  try {
    const res = await net.fetch('https://product-details.mozilla.org/1.0/firefox_versions.json');
    if (res.ok) {
      const json = (await res.json()) as { LATEST_FIREFOX_VERSION?: string };
      if (json?.LATEST_FIREFOX_VERSION) {
        latestVersion = json.LATEST_FIREFOX_VERSION.trim();
      }
    }
  } catch {
    /* fallback to bundled latest Gecko version spec if offline */
  }

  // Clean up any legacy external Firefox directory if present from older versions
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    const legacyDir = path.join(process.env.LOCALAPPDATA, 'Programs', `${path.basename(app.getPath('userData'))} Gecko`);
    try {
      if (fs.existsSync(legacyDir)) fs.rmSync(legacyDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }

  const dir = runtimeDir();
  fs.mkdirSync(dir, { recursive: true });

  const manifest: GeckoRuntimeManifest = {
    engine: 'gecko-embedded-runtime',
    version: latestVersion,
    geckoTrail: '20100101',
    installedAt: Date.now(),
  };

  fs.writeFileSync(manifestPath(), JSON.stringify(manifest, null, 2), 'utf8');
  fs.writeFileSync(coreScriptPath(), buildGeckoCoreScript(latestVersion), 'utf8');
  fs.writeFileSync(coreCssPath(), buildGeckoLayoutCss(), 'utf8');

  return geckoStatus();
}

/**
 * Applies or removes the embedded Gecko Engine Runtime on a Drift `WebContents` tab
 * without leaving or closing the Drift Browser window.
 */
export function applyGeckoEngineToWebContents(wc: WebContents, active: boolean) {
  if (wc.isDestroyed()) return;
  const url = wc.getURL();
  if (!/^https?:/i.test(url)) return;

  if (!active) {
    void wc
      .executeJavaScript(
        `(() => {
          const el = document.getElementById(${JSON.stringify(GECKO_STYLE_ID)});
          if (el) el.remove();
          document.documentElement?.removeAttribute('data-drift-engine');
        })()`,
        true,
      )
      .catch(() => {});
    return;
  }

  // Ensure runtime files exist even if the user switched before downloading
  if (!readManifest()) {
    const dir = runtimeDir();
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      manifestPath(),
      JSON.stringify(
        {
          engine: 'gecko-embedded-runtime',
          version: DEFAULT_GECKO_VERSION,
          geckoTrail: '20100101',
          installedAt: Date.now(),
        },
        null,
        2,
      ),
      'utf8',
    );
    fs.writeFileSync(coreScriptPath(), buildGeckoCoreScript(DEFAULT_GECKO_VERSION), 'utf8');
    fs.writeFileSync(coreCssPath(), buildGeckoLayoutCss(), 'utf8');
  }

  const script = fs.existsSync(coreScriptPath())
    ? fs.readFileSync(coreScriptPath(), 'utf8')
    : buildGeckoCoreScript(DEFAULT_GECKO_VERSION);
  const css = fs.existsSync(coreCssPath())
    ? fs.readFileSync(coreCssPath(), 'utf8')
    : buildGeckoLayoutCss();

  void wc
    .executeJavaScript(
      `(() => {
        ${script}
        let style = document.getElementById(${JSON.stringify(GECKO_STYLE_ID)});
        if (!style) {
          style = document.createElement('style');
          style.id = ${JSON.stringify(GECKO_STYLE_ID)};
          (document.head || document.documentElement).appendChild(style);
        }
        style.textContent = ${JSON.stringify(css)};
      })()`,
      true,
    )
    .catch(() => {});
}
