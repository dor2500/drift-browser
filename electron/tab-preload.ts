/// <reference lib="dom" />
// Runs in every web page (isolated world, sandboxed):
//  1. Alt+click on a link opens a Glance instead of downloading it.
//  2. On YouTube, a video-ad skipper backs up the ad-block filters.
import { ipcRenderer } from 'electron';

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
  '#player-ads',
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

  // While a video ad plays: mute it, jump to its end and press Skip. Restore
  // the sound afterwards so the real video isn't left muted.
  let mutedByUs = false;
  setInterval(() => {
    const player = document.querySelector('#movie_player, .html5-video-player');
    const video = player?.querySelector('video');
    if (!player || !video) return;
    if (player.classList.contains('ad-showing')) {
      if (!video.muted) {
        video.muted = true;
        mutedByUs = true;
      }
      if (Number.isFinite(video.duration) && video.duration > 0) video.currentTime = video.duration;
      document.querySelectorAll<HTMLElement>(YT_SKIP_BUTTONS).forEach((b) => b.click());
    } else if (mutedByUs) {
      video.muted = false;
      mutedByUs = false;
    }
  }, 250);
}

if (/(^|\.)youtube\.com$/i.test(location.hostname) && window.top === window) {
  ipcRenderer
    .invoke('drift:adblock-active')
    .then((on: boolean) => on && startYouTubeAdSkipper())
    .catch(() => {});
}
