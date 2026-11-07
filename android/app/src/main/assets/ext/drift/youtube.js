// Same YouTube ad skipper the Chromium engine injects (AdBlock.kt).
(function () {
  if (window.__driftYt) return; window.__driftYt = true;
  var s = document.createElement('style');
  s.textContent = '#masthead-ad,#player-ads,ytd-ad-slot-renderer,ytd-in-feed-ad-layout-renderer,ytd-banner-promo-renderer,' +
    'ytd-promoted-sparkles-web-renderer,ytd-companion-slot-renderer,ytd-display-ad-renderer,.ytp-ad-overlay-container,' +
    '.ytp-ad-text-overlay,ytm-promoted-sparkles-web-renderer,ytm-companion-ad-renderer,ad-slot-renderer{display:none!important}';
  (document.head || document.documentElement).appendChild(s);
  var mutedByUs = false;
  setInterval(function () {
    var p = document.querySelector('#movie_player, .html5-video-player');
    var v = p && p.querySelector('video');
    if (!p || !v) return;
    if (p.classList.contains('ad-showing')) {
      if (!v.muted) { v.muted = true; mutedByUs = true; }
      if (isFinite(v.duration) && v.duration > 0) v.currentTime = v.duration;
      document.querySelectorAll('.ytp-skip-ad-button,.ytp-ad-skip-button,.ytp-ad-skip-button-modern,.ytp-ad-skip-button-slot button').forEach(function (b) { b.click(); });
    } else if (mutedByUs) { v.muted = false; mutedByUs = false; }
  }, 250);
})();
