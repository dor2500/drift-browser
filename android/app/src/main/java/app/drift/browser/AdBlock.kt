package app.drift.browser

import android.content.Context
import android.webkit.WebResourceResponse
import java.io.ByteArrayInputStream

/**
 * Network-level ad and tracker blocking from a bundled domain list
 * (assets/blocklist.txt), plus the same YouTube video-ad skipper the desktop
 * app injects. A request is blocked when its host or any parent domain is listed.
 */
class AdBlock(context: Context) {
    private val domains: Set<String> =
        context.assets.open("blocklist.txt").bufferedReader().useLines { lines ->
            lines.map { it.trim().lowercase() }.filter { it.isNotEmpty() && !it.startsWith("#") }.toHashSet()
        }

    fun isBlocked(host: String?): Boolean {
        var h = host?.lowercase() ?: return false
        while (true) {
            if (h in domains) return true
            val dot = h.indexOf('.')
            if (dot < 0 || dot == h.lastIndexOf('.')) return false
            h = h.substring(dot + 1)
        }
    }

    /** An empty answer, so the page sees the request fail quietly. */
    fun emptyResponse() = WebResourceResponse("text/plain", "utf-8", 204, "No Content", emptyMap(), ByteArrayInputStream(ByteArray(0)))

    companion object {
        /** Hides YouTube ad slots and fast-forwards / skips video ads (desktop: electron/tab-preload.ts). */
        val YOUTUBE_SKIPPER = """
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
        """.trimIndent()
    }
}
