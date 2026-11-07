import type { WebContents } from 'electron';
import type { DarkModeSettings } from '../shared/settings';
import { hostOfUrl } from './adblock';

const STYLE_ELEMENT_ID = '__drift_dark_mode_engine__';

/**
 * Advanced Dark Mode Engine (`DarkModeEngine`).
 *
 * Dynamically injects and updates a customizable dark theme stylesheet into
 * websites that do not natively support dark mode, with per-site rules and
 * live Brightness, Contrast, Sepia, and Grayscale controls.
 */
export class DarkModeEngine {
  constructor(private getSettings: () => DarkModeSettings) {}

  /** Returns whether Dark Mode Engine is active for a given URL. */
  isActiveForUrl(url: string): boolean {
    if (!/^https?:/i.test(url)) return false;
    const host = hostOfUrl(url);
    if (!host) return false;
    const cfg = this.getSettings();
    const isDisabled = cfg.disabledHosts.some((h) => host === h || host.endsWith('.' + h));
    if (isDisabled) return false;
    const isForced = cfg.forcedHosts.some((h) => host === h || host.endsWith('.' + h));
    if (isForced) return true;
    return cfg.enabled;
  }

  /** Toggle dark mode for a specific host and return updated settings patch. */
  toggleHost(host: string): Partial<DarkModeSettings> {
    const cleanHost = host.trim().toLowerCase().replace(/^www\./, '');
    if (!cleanHost) return {};
    const cfg = this.getSettings();
    const currentlyActive = this.isActiveForUrl(`https://${cleanHost}/`);

    let disabledHosts = cfg.disabledHosts.filter((h) => h !== cleanHost);
    let forcedHosts = cfg.forcedHosts.filter((h) => h !== cleanHost);

    if (currentlyActive) {
      if (cfg.enabled) disabledHosts = [...disabledHosts, cleanHost];
    } else {
      if (!cfg.enabled) forcedHosts = [...forcedHosts, cleanHost];
    }
    return { disabledHosts, forcedHosts };
  }

  /** Build the CSS string for the current DarkModeSettings. */
  buildCss(cfg: DarkModeSettings): string {
    const b = (cfg.brightness / 100).toFixed(2);
    const c = (cfg.contrast / 100).toFixed(2);
    const s = (cfg.sepia / 100).toFixed(2);
    const g = (cfg.grayscale / 100).toFixed(2);

    if (cfg.mode === 'filter') {
      const filterChain = `brightness(${b}) contrast(${c}) sepia(${s}) grayscale(${g})`;
      return `
        :root {
          color-scheme: dark !important;
          filter: ${filterChain} !important;
        }
        html, body {
          background-color: #14161a !important;
          color: #e4e6eb !important;
        }
        a { color: #8ab4f8 !important; }
      `;
    }

    // 'smart' mode: high-contrast intelligent inversion that preserves images, videos, canvas, and SVGs
    const rootFilter = `invert(0.92) hue-rotate(180deg) brightness(${b}) contrast(${c}) sepia(${s}) grayscale(${g})`;
    const mediaCounterFilter = `invert(1) hue-rotate(180deg)`;

    return `
      html[data-drift-dark="active"] {
        color-scheme: dark !important;
        filter: ${rootFilter} !important;
        background-color: #ffffff !important;
      }
      html[data-drift-dark="active"] img,
      html[data-drift-dark="active"] video,
      html[data-drift-dark="active"] picture,
      html[data-drift-dark="active"] canvas,
      html[data-drift-dark="active"] iframe,
      html[data-drift-dark="active"] embed,
      html[data-drift-dark="active"] object,
      html[data-drift-dark="active"] svg image,
      html[data-drift-dark="active"] [style*="background-image"]:not(body):not(html) {
        filter: ${mediaCounterFilter} !important;
      }
      html[data-drift-dark="custom-adjust"] {
        filter: brightness(${b}) contrast(${c}) sepia(${s}) grayscale(${g}) !important;
      }
    `;
  }

  /** Apply or remove Dark Mode Engine styles on a single WebContents instance. */
  applyToWebContents(wc: WebContents) {
    if (wc.isDestroyed()) return;
    const url = wc.getURL();
    const active = this.isActiveForUrl(url);
    const cfg = this.getSettings();

    if (!active || cfg.mode === 'chromium') {
      void wc
        .executeJavaScript(
          `(() => {
            const el = document.getElementById(${JSON.stringify(STYLE_ELEMENT_ID)});
            if (el) el.remove();
            if (document.documentElement) document.documentElement.removeAttribute('data-drift-dark');
          })()`,
          true,
        )
        .catch(() => {});
      return;
    }

    const css = this.buildCss(cfg);
    const isForced = cfg.forcedHosts.some((h) => {
      const host = hostOfUrl(url);
      return host === h || host.endsWith('.' + h);
    });

    const script = `(() => {
      const root = document.documentElement;
      if (!root) return;
      let style = document.getElementById(${JSON.stringify(STYLE_ELEMENT_ID)});
      if (!style) {
        style = document.createElement('style');
        style.id = ${JSON.stringify(STYLE_ELEMENT_ID)};
        (document.head || root).appendChild(style);
      }
      style.textContent = ${JSON.stringify(css)};

      // In smart mode, check if the website is already natively dark (unless explicitly forced on this host)
      const isForced = ${JSON.stringify(isForced)};
      const mode = ${JSON.stringify(cfg.mode)};
      if (mode === 'smart' && !isForced) {
        root.removeAttribute('data-drift-dark');
        const checkNativeDark = () => {
          const cs = getComputedStyle(document.body || root);
          const bg = cs.backgroundColor || getComputedStyle(root).backgroundColor || '';
          const m = bg.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
          if (m) {
            const r = Number(m[1]), g = Number(m[2]), b = Number(m[3]);
            const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
            if (luminance > 0 && luminance < 0.28) {
              root.setAttribute('data-drift-dark', 'custom-adjust');
              return;
            }
          }
          root.setAttribute('data-drift-dark', 'active');
        };
        checkNativeDark();
      } else {
        root.setAttribute('data-drift-dark', 'active');
      }
    })()`;

    void wc.executeJavaScript(script, true).catch(() => {});
  }
}

