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

// ------------------------------------------------------------------ Picture-in-Picture

function injectYouTubePipButton() {
  const tryInject = () => {
    const controls = document.querySelector('.ytp-right-controls');
    if (!controls || controls.querySelector('.drift-ytp-pip-button')) return;

    const btn = document.createElement('button');
    btn.className = 'ytp-button drift-ytp-pip-button';
    btn.title = 'תמונה בתוך תמונה (Picture-in-Picture - Alt+P)';
    btn.setAttribute('aria-label', 'Picture-in-Picture');
    btn.style.verticalAlign = 'top';
    btn.style.textAlign = 'center';
    btn.innerHTML = `
      <svg height="100%" version="1.1" viewBox="0 0 36 36" width="100%">
        <path fill="#fff" d="M25,17 L17,17 L17,23 L25,23 L25,17 Z M29,25 L29,11 C29,9.9 28.1,9 27,9 L9,9 C7.9,9 7,9.9 7,11 L7,25 C7,26.1 7.9,27 9,27 L27,27 C28.1,27 29,26.1 29,25 Z M27,25 L9,25 L9,11 L27,11 L27,25 Z"/>
      </svg>
    `;

    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const video = document.querySelector<HTMLVideoElement>('#movie_player video, .html5-video-player video');
      if (!video) return;
      try {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else {
          video.disablePictureInPicture = false;
          await video.requestPictureInPicture();
        }
      } catch (err) {
        console.warn('[drift pip error]', err);
      }
    });

    const fullscreenBtn = controls.querySelector('.ytp-fullscreen-button');
    if (fullscreenBtn) {
      controls.insertBefore(btn, fullscreenBtn);
    } else {
      controls.appendChild(btn);
    }
  };

  setInterval(tryInject, 1000);
  tryInject();
}

function initGenericPipSupport() {
  const style = document.createElement('style');
  style.textContent = `
    .__drift_pip_btn {
      position: absolute;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 11px;
      border-radius: 20px;
      background: rgba(20, 20, 24, 0.88);
      backdrop-filter: blur(8px);
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.18);
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.2s ease, transform 0.15s ease, background 0.15s ease;
      pointer-events: none;
      user-select: none;
      border: none;
      outline: none;
    }
    .__drift_pip_btn:hover {
      background: rgba(35, 35, 45, 0.98);
      transform: scale(1.04);
    }
    .__drift_pip_btn svg {
      width: 14px;
      height: 14px;
      fill: currentColor;
    }
    .__drift_pip_btn.visible {
      opacity: 0.92;
      pointer-events: auto;
    }
  `;
  const attachStyle = () => (document.head || document.documentElement).appendChild(style);
  if (document.documentElement) attachStyle();
  else document.addEventListener('DOMContentLoaded', attachStyle, { once: true });

  let btn: HTMLButtonElement | null = null;
  let activeVideo: HTMLVideoElement | null = null;
  let hideTimeout: ReturnType<typeof setTimeout> | null = null;

  const getOrCreateBtn = () => {
    if (btn) return btn;
    btn = document.createElement('button');
    btn.className = '__drift_pip_btn';
    btn.title = 'תמונה בתוך תמונה · Picture-in-Picture (Alt+P)';
    btn.innerHTML = `
      <svg viewBox="0 0 24 24"><path d="M19 11h-8v6h8v-6zm4 8V4.98C23 3.88 22.1 3 21 3H3c-1.1 3-2 3.88-2 4.98V19c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2zm-2 .02H3V4.97h18v14.05z"/></svg>
      <span>PiP</span>
    `;
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!activeVideo) return;
      try {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else {
          activeVideo.disablePictureInPicture = false;
          await activeVideo.requestPictureInPicture();
        }
      } catch (err) {
        console.warn('[drift pip error]', err);
      }
    });
    (document.body || document.documentElement).appendChild(btn);
    return btn;
  };

  const positionBtn = (video: HTMLVideoElement) => {
    if (location.hostname.includes('youtube.com')) return;
    const r = video.getBoundingClientRect();
    if (r.width < 160 || r.height < 100) return;
    const b = getOrCreateBtn();
    b.style.top = `${window.scrollY + r.top + 10}px`;
    b.style.left = `${window.scrollX + r.right - 70}px`;
    b.classList.add('visible');
    activeVideo = video;
  };

  document.addEventListener(
    'mouseover',
    (e) => {
      const target = e.target as HTMLElement;
      const video = target instanceof HTMLVideoElement ? target : target.closest?.('video');
      if (video instanceof HTMLVideoElement) {
        if (hideTimeout) clearTimeout(hideTimeout);
        positionBtn(video);
      }
    },
    true,
  );

  document.addEventListener(
    'mouseout',
    (e) => {
      const target = e.target as HTMLElement;
      if (target instanceof HTMLVideoElement || target === btn || btn?.contains(target)) {
        if (hideTimeout) clearTimeout(hideTimeout);
        hideTimeout = setTimeout(() => {
          btn?.classList.remove('visible');
        }, 800);
      }
    },
    true,
  );
}

if (window.top === window) {
  if (/(^|\.)youtube\.com$/i.test(location.hostname)) {
    injectYouTubePipButton();
    ipcRenderer
      .invoke('drift:adblock-active')
      .then((on: boolean) => on && startYouTubeAdSkipper())
      .catch(() => {});
  } else {
    initGenericPipSupport();
  }
}
