/// <reference lib="dom" />
// Runs in every web page (isolated world, sandboxed):
//  1. Alt+click on a link opens a Glance instead of downloading it.
//  2. On YouTube, a video-ad skipper backs up the ad-block filters.
//  3. Ensures Google Chrome vendor & runtime identity for web applications.
import { ipcRenderer } from 'electron';

try {
  if (typeof Object.defineProperty === 'function') {
    Object.defineProperty(navigator, 'vendor', { get: () => 'Google Inc.', configurable: true });
  }
} catch {}

window.addEventListener(
  'click',
  (e) => {
    if (!e.isTrusted || !e.altKey || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const link = e.composedPath().find((n): n is HTMLAnchorElement => n instanceof HTMLAnchorElement && !!n.href);
    if (!link || !/^https?:/i.test(link.href)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    ipcRenderer.send('drift:glance', { url: link.href, x: e.clientX, y: e.clientY });
  },
  true,
);

// ------------------------------------------------------------------ YouTube

const YT_HIDE = [
  '#masthead-ad',
  'ytd-ad-slot-renderer',
  'ytd-in-feed-ad-layout-renderer',
  'ytd-banner-promo-renderer',
  'ytd-statement-banner-renderer',
  'ytd-promoted-sparkles-web-renderer',
  'ytd-companion-slot-renderer',
  'ytd-display-ad-renderer',
  'ytd-rich-item-renderer:has(ytd-ad-slot-renderer)',
  '.ytp-ad-overlay-container',
  '.ytp-ad-text-overlay',
  'ytm-promoted-sparkles-web-renderer',
];
const YT_SKIP_BUTTONS = '.ytp-skip-ad-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-ad-skip-button-slot button';

function startYouTubeAdSkipper() {
  const style = document.createElement('style');
  style.textContent = `${YT_HIDE.join(',')}{display:none!important}`;
  const attach = () => (document.head || document.documentElement).appendChild(style);
  if (document.documentElement) attach();
  else document.addEventListener('DOMContentLoaded', attach, { once: true });

  // While a video ad plays: mute it, safely accelerate it and press Skip.
  // Never seek past actual content or seek long videos (that would end real videos!).
  let mutedByUs = false;
  setInterval(() => {
    const player = document.querySelector('#movie_player, .html5-video-player');
    const video = player?.querySelector('video');
    if (!player || !video) return;

    const isAd = player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting');
    if (isAd) {
      // Only speed up or seek if this is genuinely a short ad clip (< 180s)
      if (Number.isFinite(video.duration) && video.duration > 0 && video.duration < 180) {
        if (!video.muted) {
          video.muted = true;
          mutedByUs = true;
        }
        video.playbackRate = 16;
        if (video.currentTime < video.duration - 0.2) {
          video.currentTime = video.duration - 0.1;
        }
      }
      document.querySelectorAll<HTMLElement>(YT_SKIP_BUTTONS).forEach((b) => {
        try { b.click(); } catch {}
      });
    } else {
      if (video.playbackRate > 2) {
        video.playbackRate = 1;
      }
      if (mutedByUs) {
        video.muted = false;
        mutedByUs = false;
      }
    }
  }, 250);
}

if (/(^|\.)youtube\.com$/i.test(location.hostname) && window.top === window) {
  ipcRenderer
    .invoke('drift:adblock-active')
    .then((on: boolean) => on && startYouTubeAdSkipper())
    .catch(() => {});
}
