package app.drift.browser

import android.annotation.SuppressLint
import android.app.Activity
import android.app.DownloadManager
import android.content.Context
import android.graphics.Bitmap
import android.net.Uri
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.webkit.CookieManager
import android.webkit.URLUtil
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID
import kotlin.concurrent.thread

class Tab(val id: String, url: String, title: String, var spaceId: String, pinned: Boolean = false) {
    var url by mutableStateOf(url)
    var title by mutableStateOf(title)
    var pinned by mutableStateOf(pinned)
    var icon by mutableStateOf<Bitmap?>(null)
    var progress by mutableIntStateOf(100)
    var blocked by mutableIntStateOf(0)
    var canGoBack by mutableStateOf(false)
    var canGoForward by mutableStateOf(false)
    var desktop by mutableStateOf(false)
    var webView: WebView? = null
}

class Space(val id: String, name: String, val color: Long) {
    var name by mutableStateOf(name)
}

/** Drift's colours for spaces (desktop: ACCENTS in electron/browser.ts). */
val SPACE_COLORS = listOf(0xFF8AA4FF, 0xFFF5A97F, 0xFFA6DA95, 0xFFF5BDE6, 0xFF91D7E3, 0xFFEED49F, 0xFFC6A0F6, 0xFFEE99A0)

/**
 * Tabs, spaces and their WebViews. Tabs and spaces survive restarts
 * (SharedPreferences); a tab's WebView is created when it is first shown.
 */
class BrowserModel(private val activity: Activity) {
    val tabs = mutableStateListOf<Tab>()
    val spaces = mutableStateListOf<Space>()
    var activeSpaceId by mutableStateOf("")
    var activeTabId by mutableStateOf<String?>(null)
    var adblockOn by mutableStateOf(true)
    var updateVersion by mutableStateOf<String?>(null)
    var updateUrl: String? = null
    var findMatches by mutableIntStateOf(0)
    var findActive by mutableIntStateOf(0)

    private val prefs = activity.getSharedPreferences("drift", Context.MODE_PRIVATE)
    private val adblock = AdBlock(activity)
    private val main = Handler(Looper.getMainLooper())

    val activeTab: Tab? get() = tabs.firstOrNull { it.id == activeTabId }
    fun tabsIn(spaceId: String) = tabs.filter { it.spaceId == spaceId }.sortedByDescending { it.pinned }

    init {
        load()
    }

    // ------------------------------------------------------------ tabs & spaces

    fun newTab(url: String = Url.HOME, activate: Boolean = true): Tab {
        val t = Tab(UUID.randomUUID().toString(), url, Url.display(url), activeSpaceId)
        tabs.add(t)
        if (activate) activeTabId = t.id
        save()
        return t
    }

    fun activate(t: Tab) {
        activeSpaceId = t.spaceId
        activeTabId = t.id
        save()
    }

    fun close(t: Tab) {
        val siblings = tabsIn(t.spaceId)
        val index = siblings.indexOf(t)
        t.webView?.destroy()
        tabs.remove(t)
        if (activeTabId == t.id) {
            val rest = tabsIn(t.spaceId)
            activeTabId = rest.getOrNull(index.coerceAtMost(rest.size - 1))?.id
        }
        save()
    }

    fun closeAllIn(spaceId: String) {
        tabs.filter { it.spaceId == spaceId && !it.pinned }.forEach { it.webView?.destroy(); tabs.remove(it) }
        if (tabs.none { it.id == activeTabId }) activeTabId = tabsIn(spaceId).firstOrNull()?.id
        save()
    }

    fun newSpace(name: String): Space {
        val s = Space(UUID.randomUUID().toString(), name, SPACE_COLORS[spaces.size % SPACE_COLORS.size])
        spaces.add(s)
        switchSpace(s)
        return s
    }

    fun switchSpace(s: Space) {
        activeSpaceId = s.id
        activeTabId = tabsIn(s.id).firstOrNull()?.id
        save()
    }

    fun navigate(input: String) {
        val url = Url.normalize(input)
        val t = activeTab ?: newTab(url)
        t.url = url
        t.webView?.loadUrl(url)
        save()
    }

    fun openIncoming(url: String) {
        val existing = tabs.firstOrNull { it.url == url }
        if (existing != null) activate(existing) else newTab(url)
    }

    // ------------------------------------------------------------ WebViews

    @SuppressLint("SetJavaScriptEnabled")
    fun webViewFor(t: Tab): WebView {
        t.webView?.let { return it }
        val wv = WebView(activity)
        val s = wv.settings
        s.javaScriptEnabled = true
        s.domStorageEnabled = true
        s.mediaPlaybackRequiresUserGesture = true
        s.setSupportZoom(true)
        s.builtInZoomControls = true
        s.displayZoomControls = false
        s.loadWithOverviewMode = true
        s.useWideViewPort = true
        // Google refuses sign-in from in-app WebViews, which identify themselves with "; wv".
        s.userAgentString = s.userAgentString.replace("; wv", "")
        CookieManager.getInstance().setAcceptThirdPartyCookies(wv, false)

        wv.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                if (adblockOn && !request.isForMainFrame && adblock.isBlocked(request.url.host)) {
                    main.post { t.blocked += 1 }
                    return adblock.emptyResponse()
                }
                return null
            }

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val scheme = request.url.scheme ?: return false
                if (scheme == "http" || scheme == "https") return false
                // intent:, mailto:, tel: … hand to the system.
                return runCatching { activity.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, request.url)); true }.getOrDefault(true)
            }

            override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
                t.url = url
                t.blocked = 0
                t.progress = 5
                favicon?.let { t.icon = it }
            }

            override fun onPageFinished(view: WebView, url: String) {
                t.url = url
                t.title = view.title?.takeIf { it.isNotBlank() } ?: Url.display(url)
                t.canGoBack = view.canGoBack()
                t.canGoForward = view.canGoForward()
                t.progress = 100
                if (adblockOn && Url.host(url).endsWith("youtube.com")) view.evaluateJavascript(AdBlock.YOUTUBE_SKIPPER, null)
                save()
            }

            override fun doUpdateVisitedHistory(view: WebView, url: String, isReload: Boolean) {
                t.url = url
                t.canGoBack = view.canGoBack()
                t.canGoForward = view.canGoForward()
            }
        }
        wv.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView, newProgress: Int) {
                t.progress = newProgress
            }

            override fun onReceivedTitle(view: WebView, title: String?) {
                if (!title.isNullOrBlank()) t.title = title
            }

            override fun onReceivedIcon(view: WebView, icon: Bitmap?) {
                t.icon = icon
            }
        }
        wv.setFindListener { active, matches, _ ->
            findActive = if (matches == 0) 0 else active + 1
            findMatches = matches
        }
        wv.setDownloadListener { url, userAgent, contentDisposition, mimeType, _ ->
            val name = URLUtil.guessFileName(url, contentDisposition, mimeType)
            val req = DownloadManager.Request(Uri.parse(url))
                .setMimeType(mimeType)
                .addRequestHeader("User-Agent", userAgent)
                .addRequestHeader("Cookie", CookieManager.getInstance().getCookie(url) ?: "")
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name)
            (activity.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager).enqueue(req)
            Toast.makeText(activity, activity.getString(R.string.downloading, name), Toast.LENGTH_SHORT).show()
        }
        t.webView = wv
        wv.loadUrl(t.url)
        return wv
    }

    fun setDesktop(t: Tab, on: Boolean) {
        t.desktop = on
        t.webView?.let { wv ->
            val mobile = WebView(activity).settings.userAgentString.replace("; wv", "")
            wv.settings.userAgentString = if (on) mobile.replace(Regex("\\(Linux; Android [^)]*\\)"), "(X11; Linux x86_64)").replace(" Mobile", "") else mobile
            wv.settings.useWideViewPort = true
            wv.reload()
        }
    }

    fun trimMemory() {
        // Keep only the visible tab's page when Android is short on memory.
        tabs.filter { it.id != activeTabId }.forEach { it.webView?.destroy(); it.webView = null }
    }

    // ------------------------------------------------------------ updates

    /** Same GitHub Releases the desktop app updates from; the APK is attached to each release. */
    fun checkForUpdate() {
        thread {
            runCatching {
                val c = URL("https://api.github.com/repos/dor2500/drift-browser/releases/latest").openConnection() as HttpURLConnection
                c.setRequestProperty("Accept", "application/vnd.github+json")
                c.connectTimeout = 8000
                c.readTimeout = 8000
                val json = JSONObject(c.inputStream.bufferedReader().readText())
                val version = json.getString("tag_name").removePrefix("v")
                val assets = json.getJSONArray("assets")
                val apk = (0 until assets.length()).map { assets.getJSONObject(it) }.firstOrNull { it.getString("name").endsWith(".apk") }
                if (apk != null && isNewer(version, BuildConfig.VERSION_NAME)) {
                    main.post {
                        updateVersion = version
                        updateUrl = apk.getString("browser_download_url")
                    }
                }
            }
        }
    }

    private fun isNewer(a: String, b: String): Boolean {
        val pa = a.split(".").map { it.toIntOrNull() ?: 0 }
        val pb = b.split(".").map { it.toIntOrNull() ?: 0 }
        for (i in 0 until 3) if (pa.getOrElse(i) { 0 } != pb.getOrElse(i) { 0 }) return pa.getOrElse(i) { 0 } > pb.getOrElse(i) { 0 }
        return false
    }

    // ------------------------------------------------------------ persistence

    fun save() {
        val json = JSONObject()
        json.put("activeSpace", activeSpaceId)
        json.put("activeTab", activeTabId ?: "")
        json.put("adblock", adblockOn)
        json.put("spaces", JSONArray().apply { spaces.forEach { put(JSONObject().put("id", it.id).put("name", it.name).put("color", it.color)) } })
        json.put("tabs", JSONArray().apply {
            tabs.forEach { put(JSONObject().put("id", it.id).put("url", it.url).put("title", it.title).put("space", it.spaceId).put("pinned", it.pinned)) }
        })
        prefs.edit().putString("session", json.toString()).apply()
    }

    private fun load() {
        val raw = prefs.getString("session", null)
        if (raw != null) runCatching {
            val json = JSONObject(raw)
            adblockOn = json.optBoolean("adblock", true)
            val sp = json.getJSONArray("spaces")
            for (i in 0 until sp.length()) sp.getJSONObject(i).let { spaces.add(Space(it.getString("id"), it.getString("name"), it.getLong("color"))) }
            val ts = json.getJSONArray("tabs")
            for (i in 0 until ts.length()) ts.getJSONObject(i).let {
                tabs.add(Tab(it.getString("id"), it.getString("url"), it.getString("title"), it.getString("space"), it.optBoolean("pinned")))
            }
            activeSpaceId = json.getString("activeSpace")
            activeTabId = json.getString("activeTab").ifEmpty { null }
        }
        if (spaces.isEmpty()) {
            spaces.add(Space(UUID.randomUUID().toString(), activity.getString(R.string.home), SPACE_COLORS[0]))
            activeSpaceId = spaces[0].id
        }
        if (spaces.none { it.id == activeSpaceId }) activeSpaceId = spaces[0].id
        if (tabs.isEmpty()) newTab()
        if (tabs.none { it.id == activeTabId }) activeTabId = tabsIn(activeSpaceId).firstOrNull()?.id ?: tabs.first().id
    }
}
