package app.drift.browser

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.graphics.Bitmap
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.print.PrintManager
import android.view.View
import android.webkit.CookieManager
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.webkit.ProfileStore
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature

/** Options shared by every page; read when a page is created and on [applyPrefs]. */
class EnginePrefs(
    val adblock: () -> Boolean,
    val javascript: () -> Boolean,
    val textScale: () -> Int,
    val thirdPartyCookies: () -> Boolean,
    val httpsOnly: () -> Boolean,
    val darkPages: () -> Boolean,
)

/** Chromium: Android System WebView (Chrome's engine, updated through Google Play). */
@SuppressLint("SetJavaScriptEnabled")
class ChromiumEngine(
    private val activity: Activity,
    private val events: PageEvents,
    private val prefs: EnginePrefs,
    private val adblock: AdBlock,
    private val private: Boolean,
) : PageEngine {
    override val kind = EngineKind.CHROMIUM
    private val main = Handler(Looper.getMainLooper())
    private val wv = WebView(activity)
    override val view: View get() = wv
    private var customViewCallback: WebChromeClient.CustomViewCallback? = null
    /** Hosts that failed over HTTPS, so HTTPS-Only falls back to http for them. */
    private val httpOk = HashSet<String>()

    init {
        if (private) usePrivateProfile(wv)
        val s = wv.settings
        s.domStorageEnabled = true
        s.mediaPlaybackRequiresUserGesture = true
        s.setSupportZoom(true)
        s.builtInZoomControls = true
        s.displayZoomControls = false
        s.loadWithOverviewMode = true
        s.useWideViewPort = true
        // Google refuses sign-in from in-app WebViews, which identify themselves with "; wv".
        s.userAgentString = s.userAgentString.replace("; wv", "")
        applyPrefs()

        wv.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                if (prefs.adblock() && !request.isForMainFrame && adblock.isBlocked(request.url.host)) {
                    main.post { events.onBlocked() }
                    return adblock.emptyResponse()
                }
                return null
            }

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url
                val scheme = url.scheme ?: return false
                if (scheme == "https") return false
                if (scheme == "http") {
                    // HTTPS-Only: try the secure address first, like Firefox and Chrome's HTTPS-First.
                    if (prefs.httpsOnly() && request.isForMainFrame && url.host !in httpOk) {
                        view.loadUrl(url.buildUpon().scheme("https").build().toString())
                        return true
                    }
                    return false
                }
                if (scheme == "about" || scheme == "data" || scheme == "blob" || scheme == "javascript") return false
                events.onExternal(url)
                return true
            }

            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                // An upgraded address that has no HTTPS: allow plain http for that host.
                val u = request.url
                if (request.isForMainFrame && prefs.httpsOnly() && u.scheme == "https" && u.host != null && u.host !in httpOk) {
                    httpOk.add(u.host!!)
                    view.loadUrl(u.buildUpon().scheme("http").build().toString())
                }
            }

            override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
                events.onPageStart(url)
                favicon?.let { events.onIcon(it) }
            }

            override fun onPageFinished(view: WebView, url: String) {
                view.title?.takeIf { it.isNotBlank() }?.let { events.onTitle(it) }
                events.onHistory(view.canGoBack(), view.canGoForward())
                if (prefs.adblock() && Url.host(url).endsWith("youtube.com")) view.evaluateJavascript(AdBlock.YOUTUBE_SKIPPER, null)
                events.onPageFinished(url)
            }

            override fun doUpdateVisitedHistory(view: WebView, url: String, isReload: Boolean) {
                events.onUrl(url)
                events.onHistory(view.canGoBack(), view.canGoForward())
            }
        }
        wv.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView, newProgress: Int) = events.onProgress(newProgress)
            override fun onReceivedTitle(view: WebView, title: String?) { if (!title.isNullOrBlank()) events.onTitle(title) }
            override fun onReceivedIcon(view: WebView, icon: Bitmap?) { icon?.let { events.onIcon(it) } }

            override fun onShowCustomView(view: View, callback: CustomViewCallback) {
                customViewCallback = callback
                events.onFullscreen(view, true)
            }

            override fun onHideCustomView() {
                customViewCallback = null
                events.onFullscreen(null, false)
            }

            override fun onShowFileChooser(view: WebView, callback: ValueCallback<Array<Uri>>, params: FileChooserParams): Boolean {
                val types = params.acceptTypes.filter { it.isNotBlank() }.toTypedArray()
                events.pickFiles(types, params.mode == FileChooserParams.MODE_OPEN_MULTIPLE) { callback.onReceiveValue(it) }
                return true
            }

            override fun onCloseWindow(window: WebView) = events.onCloseRequest()
        }
        wv.setFindListener { active, matches, _ -> events.onFind(if (matches == 0) 0 else active + 1, matches) }
        wv.setDownloadListener { url, userAgent, contentDisposition, mimeType, _ ->
            events.onDownload(url, mimeType, android.webkit.URLUtil.guessFileName(url, contentDisposition, mimeType), null, userAgent)
        }
        wv.setOnLongClickListener {
            val hit = wv.hitTestResult
            when (hit.type) {
                WebView.HitTestResult.SRC_ANCHOR_TYPE -> { events.onContextMenu(hit.extra, null, null); true }
                WebView.HitTestResult.IMAGE_TYPE -> { events.onContextMenu(null, hit.extra, null); true }
                WebView.HitTestResult.SRC_IMAGE_ANCHOR_TYPE -> {
                    // The link address arrives asynchronously in the message's data.
                    val image = hit.extra
                    val reply = Handler(Looper.getMainLooper()) { m -> events.onContextMenu(m.data.getString("url"), image, null); true }
                    wv.requestFocusNodeHref(reply.obtainMessage())
                    true
                }
                else -> false
            }
        }
    }

    /** Re-reads the shared options (Settings changed). */
    fun applyPrefs() {
        val s = wv.settings
        s.javaScriptEnabled = prefs.javascript()
        s.textZoom = prefs.textScale()
        CookieManager.getInstance().setAcceptThirdPartyCookies(wv, prefs.thirdPartyCookies())
        if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
            WebSettingsCompat.setAlgorithmicDarkeningAllowed(s, prefs.darkPages())
        }
    }

    override fun load(url: String) = wv.loadUrl(url)
    override fun goBack() = wv.goBack()
    override fun goForward() = wv.goForward()
    override fun reload() = wv.reload()
    override fun stop() = wv.stopLoading()
    override fun find(query: String) = wv.findAllAsync(query)
    override fun findNext(forward: Boolean) = wv.findNext(forward)
    override fun clearFind() = wv.clearMatches()

    override fun setDesktop(on: Boolean) {
        val mobile = WebView(activity).settings.userAgentString.replace("; wv", "")
        wv.settings.userAgentString = if (on) mobile.replace(Regex("\\(Linux; Android [^)]*\\)"), "(X11; Linux x86_64)").replace(" Mobile", "") else mobile
        wv.settings.useWideViewPort = true
        wv.reload()
    }

    override fun exitFullscreen() {
        customViewCallback?.onCustomViewHidden()
        customViewCallback = null
    }

    override fun print(jobName: String) {
        val pm = activity.getSystemService(Context.PRINT_SERVICE) as PrintManager
        pm.print(jobName, wv.createPrintDocumentAdapter(jobName), null)
    }

    override fun setActive(active: Boolean) {
        if (active) wv.onResume() else wv.onPause()
    }

    override fun destroy() {
        (wv.parent as? android.view.ViewGroup)?.removeView(wv)
        wv.destroy()
    }

    companion object {
        const val PRIVATE_PROFILE = "drift-private"

        /** Whether this WebView can keep private tabs apart (cookies, storage) with a separate profile. */
        val privateSupported: Boolean get() = WebViewFeature.isFeatureSupported(WebViewFeature.MULTI_PROFILE)

        private fun usePrivateProfile(wv: WebView) {
            ProfileStore.getInstance().getOrCreateProfile(PRIVATE_PROFILE)
            WebViewCompat.setProfile(wv, PRIVATE_PROFILE)
        }

        /** Forgets everything the private tabs stored. Call once no private page is open. */
        fun clearPrivate() {
            if (!privateSupported) return
            runCatching { ProfileStore.getInstance().deleteProfile(PRIVATE_PROFILE) }
        }
    }
}
