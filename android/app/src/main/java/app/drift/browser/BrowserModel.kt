package app.drift.browser

import android.app.Activity
import android.app.DownloadManager
import android.content.ClipData
import android.content.ClipboardManager
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
import android.view.View
import android.webkit.CookieManager
import android.webkit.WebStorage
import android.webkit.WebView
import android.widget.Toast
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.core.content.pm.ShortcutInfoCompat
import androidx.core.content.pm.ShortcutManagerCompat
import androidx.core.graphics.drawable.IconCompat
import org.json.JSONArray
import org.json.JSONObject
import org.mozilla.geckoview.GeckoRuntimeSettings
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.Locale
import java.util.UUID
import kotlin.concurrent.thread

class Tab(val id: String, url: String, title: String, var spaceId: String, pinned: Boolean = false, val private: Boolean = false, engineKind: EngineKind = EngineKind.CHROMIUM) {
    var url by mutableStateOf(url)
    var title by mutableStateOf(title)
    var pinned by mutableStateOf(pinned)
    var icon by mutableStateOf<Bitmap?>(null)
    var progress by mutableIntStateOf(100)
    var blocked by mutableIntStateOf(0)
    var canGoBack by mutableStateOf(false)
    var canGoForward by mutableStateOf(false)
    var desktop by mutableStateOf(false)
    var engineKind by mutableStateOf(engineKind)
    /** Bumped when the page view is replaced (engine switched), so the UI re-attaches it. */
    var generation by mutableIntStateOf(0)
    var engine: PageEngine? = null
}

class Space(val id: String, name: String, val color: Long) {
    var name by mutableStateOf(name)
}

data class ContextTarget(val link: String?, val image: String?, val text: String?)

sealed class ReaderState {
    data object Loading : ReaderState()
    data object Failed : ReaderState()
    data class Ready(val article: Article) : ReaderState()
}

/** Drift's colours for spaces (desktop: ACCENTS in electron/browser.ts). */
val SPACE_COLORS = listOf(0xFF8AA4FF, 0xFFF5A97F, 0xFFA6DA95, 0xFFF5BDE6, 0xFF91D7E3, 0xFFEED49F, 0xFFC6A0F6, 0xFFEE99A0)

/**
 * Tabs, spaces, settings and the pages behind them. Each tab runs on Chromium
 * or Gecko; the page itself is created the first time the tab is shown.
 */
class BrowserModel(private val activity: Activity) {
    val tabs = mutableStateListOf<Tab>()
    val spaces = mutableStateListOf<Space>()
    var activeSpaceId by mutableStateOf("")
    var activeTabId by mutableStateOf<String?>(null)
    val library = Library(activity)

    // Settings ---------------------------------------------------------------
    var adblockOn by mutableStateOf(true)
    var themeMode by mutableIntStateOf(THEME_SYSTEM)
    var dynamicColor by mutableStateOf(true)
    var defaultEngine by mutableStateOf(EngineKind.CHROMIUM)
    var searchEngineId by mutableStateOf("google")
    var textScale by mutableIntStateOf(100)
    var javascript by mutableStateOf(true)
    var httpsOnly by mutableStateOf(true)
    var gpc by mutableStateOf(true)
    /** Off: all third-party cookies blocked. On: allowed, but Gecko keeps them per site (Total Cookie Protection). */
    var thirdPartyCookies by mutableStateOf(false)
    var darkPages by mutableStateOf(false)
    var saveHistory by mutableStateOf(true)

    // Transient UI state -----------------------------------------------------
    var updateVersion by mutableStateOf<String?>(null)
    var updateUrl: String? = null
    var findMatches by mutableIntStateOf(0)
    var findActive by mutableIntStateOf(0)
    var contextTarget by mutableStateOf<ContextTarget?>(null)
    var prompt by mutableStateOf<Prompt?>(null)
    var fullscreen by mutableStateOf(false)
    var fullscreenView by mutableStateOf<View?>(null)
    var reader by mutableStateOf<ReaderState?>(null)
    var showPrivate by mutableStateOf(false)

    /** Set by the activity: opens the system file picker. */
    var filePicker: ((Array<String>, Boolean, (Array<Uri>?) -> Unit) -> Unit)? = null

    private val prefs = activity.getSharedPreferences("drift", Context.MODE_PRIVATE)
    private val adblock = AdBlock(activity)
    private val main = Handler(Looper.getMainLooper())
    val enginePrefs = EnginePrefs(
        adblock = { adblockOn },
        javascript = { javascript },
        textScale = { textScale },
        thirdPartyCookies = { thirdPartyCookies },
        httpsOnly = { httpsOnly },
        darkPages = { darkPages },
    )

    val activeTab: Tab? get() = tabs.firstOrNull { it.id == activeTabId }
    fun tabsIn(spaceId: String) = tabs.filter { it.spaceId == spaceId && !it.private }.sortedByDescending { it.pinned }
    val privateTabs: List<Tab> get() = tabs.filter { it.private }

    init {
        load()
        Url.search = SEARCH_ENGINES.firstOrNull { it.id == searchEngineId } ?: SEARCH_ENGINES[0]
    }

    // ------------------------------------------------------------ tabs & spaces

    fun newTab(url: String = Url.HOME, private: Boolean = false, activate: Boolean = true, engine: EngineKind = defaultEngine): Tab {
        // Chromium keeps private tabs apart only with WebView profiles; without them Gecko takes the private tab.
        val kind = if (private && engine == EngineKind.CHROMIUM && !ChromiumEngine.privateSupported) EngineKind.GECKO else engine
        val t = Tab(UUID.randomUUID().toString(), url, Url.display(url), activeSpaceId, private = private, engineKind = kind)
        tabs.add(t)
        if (activate) activate(t)
        save()
        return t
    }

    fun activate(t: Tab) {
        if (activeTabId != t.id) activeTab?.engine?.setActive(false)
        if (!t.private) activeSpaceId = t.spaceId
        activeTabId = t.id
        t.engine?.setActive(true)
        showPrivate = t.private
        save()
    }

    fun close(t: Tab) {
        val siblings = if (t.private) privateTabs else tabsIn(t.spaceId)
        val index = siblings.indexOf(t)
        t.engine?.destroy()
        tabs.remove(t)
        if (t.private && privateTabs.isEmpty()) ChromiumEngine.clearPrivate()
        if (activeTabId == t.id) {
            val rest = if (t.private) privateTabs else tabsIn(t.spaceId)
            val next = rest.getOrNull(index.coerceAtMost(rest.size - 1)) ?: tabsIn(activeSpaceId).firstOrNull()
            if (next != null) activate(next) else activeTabId = null
        }
        save()
    }

    fun closeAllIn(spaceId: String) {
        tabs.filter { it.spaceId == spaceId && !it.pinned && !it.private }.forEach { it.engine?.destroy(); tabs.remove(it) }
        if (tabs.none { it.id == activeTabId }) activeTabId = tabsIn(spaceId).firstOrNull()?.id
        save()
    }

    fun closePrivate() {
        privateTabs.forEach { it.engine?.destroy(); tabs.remove(it) }
        ChromiumEngine.clearPrivate()
        if (tabs.none { it.id == activeTabId }) activeTabId = tabsIn(activeSpaceId).firstOrNull()?.id
        showPrivate = false
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
        showPrivate = false
        tabsIn(s.id).firstOrNull()?.let { activate(it) } ?: run { activeTabId = null }
        save()
    }

    fun navigate(input: String) {
        val url = Url.normalize(input)
        val t = activeTab ?: newTab(url)
        t.url = url
        t.title = Url.display(url)
        if (Url.isHome(url)) {
            t.engine?.destroy(); t.engine = null; t.generation++
        } else {
            t.engine?.load(url) ?: run { t.generation++ }
        }
        save()
    }

    fun openIncoming(url: String) {
        val existing = tabs.firstOrNull { it.url == url && !it.private }
        if (existing != null) activate(existing) else newTab(url)
    }

    // ------------------------------------------------------------ engines

    /** The tab's page, created on first use with the tab's engine. */
    fun engineFor(t: Tab): PageEngine {
        t.engine?.let { return it }
        val events = TabEvents(t)
        val e: PageEngine = when (t.engineKind) {
            EngineKind.CHROMIUM -> ChromiumEngine(activity, events, enginePrefs, adblock, t.private)
            EngineKind.GECKO -> GeckoEngine(activity, events, enginePrefs, geckoRuntime(), t.private)
        }
        t.engine = e
        if (t.desktop) e.setDesktop(true)
        e.load(t.url)
        return e
    }

    private fun geckoRuntime() = Gecko.runtime(activity, enginePrefs, gpc, geckoColorScheme())

    private fun geckoColorScheme() = when (themeMode) {
        THEME_LIGHT -> GeckoRuntimeSettings.COLOR_SCHEME_LIGHT
        THEME_DARK -> GeckoRuntimeSettings.COLOR_SCHEME_DARK
        else -> GeckoRuntimeSettings.COLOR_SCHEME_SYSTEM
    }

    /** Moves one tab to the other engine, keeping its address. */
    fun setTabEngine(t: Tab, kind: EngineKind) {
        if (t.engineKind == kind) return
        if (t.private && kind == EngineKind.CHROMIUM && !ChromiumEngine.privateSupported) {
            toast(R.string.private_needs_gecko)
            return
        }
        t.engine?.destroy()
        t.engine = null
        t.engineKind = kind
        t.progress = 100
        t.blocked = 0
        t.generation++
        save()
    }

    /** The engine for new tabs; [moveOpenTabs] also moves every open tab over. */
    fun setDefaultEngine(kind: EngineKind, moveOpenTabs: Boolean) {
        defaultEngine = kind
        if (moveOpenTabs) tabs.forEach { setTabEngine(it, kind) }
        save()
    }

    /** Settings changed: tell both engines. */
    fun applyPrefs() {
        Url.search = SEARCH_ENGINES.firstOrNull { it.id == searchEngineId } ?: SEARCH_ENGINES[0]
        tabs.forEach { (it.engine as? ChromiumEngine)?.applyPrefs() }
        Gecko.apply(enginePrefs, gpc, geckoColorScheme())
        save()
    }

    fun setDesktop(t: Tab, on: Boolean) {
        t.desktop = on
        t.engine?.setDesktop(on)
    }

    fun trimMemory() {
        // Keep only the visible tab's page when Android is short on memory.
        tabs.filter { it.id != activeTabId }.forEach { it.engine?.destroy(); it.engine = null; it.generation++ }
    }

    /** Clears what the user chose, on both engines. */
    fun clearData(history: Boolean, cookies: Boolean, cache: Boolean) {
        if (history) library.clearHistory()
        if (cookies) {
            CookieManager.getInstance().removeAllCookies(null)
            WebStorage.getInstance().deleteAllData()
        }
        if (cache) WebView(activity).apply { clearCache(true); destroy() }
        Gecko.clearData(cookies, cache)
        toast(R.string.cleared)
    }

    // ------------------------------------------------------------ page actions

    fun toggleBookmark(t: Tab) = library.toggleBookmark(t.url, t.title)

    fun translate(t: Tab) {
        val lang = Locale.getDefault().language.let { if (it == "iw") "he" else it }
        newTab("https://translate.google.com/translate?sl=auto&tl=$lang&u=" + Uri.encode(t.url), private = t.private, engine = t.engineKind)
    }

    fun openReader(t: Tab) {
        reader = ReaderState.Loading
        val ua = WebView(activity).settings.userAgentString.replace("; wv", "")
        thread {
            val result = runCatching { Reader.extract(t.url, ua) }.getOrNull()
            main.post { reader = if (result != null && result.blocks.isNotEmpty()) ReaderState.Ready(result) else ReaderState.Failed }
        }
    }

    fun print(t: Tab) = t.engine?.print(t.title.ifBlank { "Drift" })

    fun addToHomeScreen(t: Tab) {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(t.url)).setPackage(activity.packageName)
        val icon = t.icon?.let { IconCompat.createWithBitmap(it) } ?: IconCompat.createWithResource(activity, R.mipmap.ic_launcher)
        val info = ShortcutInfoCompat.Builder(activity, "drift-" + t.url.hashCode())
            .setShortLabel(t.title.ifBlank { Url.host(t.url) }.take(24))
            .setIcon(icon)
            .setIntent(intent)
            .build()
        if (!ShortcutManagerCompat.requestPinShortcut(activity, info, null)) toast(R.string.shortcut_failed)
    }

    fun copy(text: String) {
        (activity.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager).setPrimaryClip(ClipData.newPlainText("link", text))
        if (Build.VERSION.SDK_INT < 33) toast(R.string.copied)
    }

    fun share(text: String) {
        activity.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text), null))
    }

    fun download(url: String) = startDownload(url, null, android.webkit.URLUtil.guessFileName(url, null, null), null, null)

    // ------------------------------------------------------------ downloads & intents

    private fun startDownload(url: String, mimeType: String?, fileName: String?, body: InputStream?, userAgent: String?) {
        val name = fileName ?: android.webkit.URLUtil.guessFileName(url, null, mimeType)
        if (body != null && Build.VERSION.SDK_INT >= 29) {
            // Gecko hands over the response itself; save it straight to Downloads.
            thread {
                val ok = runCatching {
                    val values = ContentValues().apply {
                        put(MediaStore.Downloads.DISPLAY_NAME, name)
                        mimeType?.let { put(MediaStore.Downloads.MIME_TYPE, it) }
                        put(MediaStore.Downloads.IS_PENDING, 1)
                    }
                    val resolver = activity.contentResolver
                    val item = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)!!
                    resolver.openOutputStream(item)!!.use { out -> body.use { it.copyTo(out) } }
                    values.clear(); values.put(MediaStore.Downloads.IS_PENDING, 0)
                    resolver.update(item, values, null, null)
                }.isSuccess
                main.post { toast(if (ok) R.string.downloaded else R.string.download_failed, name) }
            }
            toast(R.string.downloading, name)
            return
        }
        if (!url.startsWith("http")) { toast(R.string.download_failed, name); return }
        runCatching {
            val req = DownloadManager.Request(Uri.parse(url))
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name)
            mimeType?.let { req.setMimeType(it) }
            userAgent?.let { req.addRequestHeader("User-Agent", it) }
            CookieManager.getInstance().getCookie(url)?.let { req.addRequestHeader("Cookie", it) }
            (activity.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager).enqueue(req)
            toast(R.string.downloading, name)
        }.onFailure { toast(R.string.download_failed, name) }
    }

    private fun openExternal(uri: Uri) {
        runCatching {
            val intent = if (uri.scheme == "intent") Intent.parseUri(uri.toString(), Intent.URI_INTENT_SCHEME) else Intent(Intent.ACTION_VIEW, uri)
            intent.addCategory(Intent.CATEGORY_BROWSABLE)
            intent.component = null
            intent.selector = null
            if (intent.resolveActivity(activity.packageManager) != null) {
                activity.startActivity(intent)
            } else {
                // Sites pass a web address to use when the app isn't installed.
                intent.getStringExtra("browser_fallback_url")?.let { navigate(it) }
            }
        }
    }

    private fun toast(res: Int, vararg args: Any) = Toast.makeText(activity, activity.getString(res, *args), Toast.LENGTH_SHORT).show()

    /** What each tab's page reports, applied to that tab. */
    private inner class TabEvents(private val t: Tab) : PageEvents {
        override fun onUrl(url: String) { t.url = url }
        override fun onTitle(title: String) {
            t.title = title
            if (!t.private && saveHistory) library.visit(t.url, title)
        }
        override fun onIcon(icon: Bitmap) { t.icon = icon }
        override fun onProgress(progress: Int) { t.progress = progress }
        override fun onPageStart(url: String) {
            t.url = url
            t.blocked = 0
            t.progress = 5
        }
        override fun onPageFinished(url: String) {
            if (url.isNotEmpty()) t.url = url
            t.progress = 100
            if (!t.private && saveHistory) library.visit(t.url, t.title)
            save()
        }
        override fun onHistory(canGoBack: Boolean, canGoForward: Boolean) { t.canGoBack = canGoBack; t.canGoForward = canGoForward }
        override fun onBlocked() { t.blocked += 1 }
        override fun onFind(active: Int, total: Int) { findActive = active; findMatches = total }
        override fun onContextMenu(link: String?, image: String?, text: String?) { contextTarget = ContextTarget(link, image, text) }
        override fun onFullscreen(view: View?, on: Boolean) { fullscreen = on; fullscreenView = view }
        override fun onNewTab(url: String?, engine: PageEngine?) {
            val tab = Tab(UUID.randomUUID().toString(), url ?: "", Url.display(url ?: ""), t.spaceId, private = t.private, engineKind = engine?.kind ?: t.engineKind)
            if (engine is GeckoEngine) { engine.events = TabEvents(tab); tab.engine = engine }
            tabs.add(tabs.indexOf(t) + 1, tab)
            activate(tab)
        }
        override fun onDownload(url: String, mimeType: String?, fileName: String?, body: InputStream?, userAgent: String?) = startDownload(url, mimeType, fileName, body, userAgent)
        override fun onExternal(uri: Uri) = openExternal(uri)
        override fun onCloseRequest() = close(t)
        override fun pickFiles(mimeTypes: Array<String>, multiple: Boolean, result: (Array<Uri>?) -> Unit) {
            filePicker?.invoke(mimeTypes, multiple, result) ?: result(null)
        }
        override fun prompt(p: Prompt) { prompt = p }
    }

    // ------------------------------------------------------------ updates

    /** Same GitHub Releases the desktop app updates from; one APK per processor type is attached to each release. */
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
                val apks = (0 until assets.length()).map { assets.getJSONObject(it) }.filter { it.getString("name").endsWith(".apk") }
                val apk = pickApk(apks.map { it.getString("name") })?.let { n -> apks.first { it.getString("name") == n } }
                if (apk != null && isNewer(version, BuildConfig.VERSION_NAME)) {
                    main.post {
                        updateVersion = version
                        updateUrl = apk.getString("browser_download_url")
                    }
                }
            }
        }
    }

    /** Drift-x.apk is for 64-bit ARM phones (most phones); others carry their processor type in the name. */
    private fun pickApk(names: List<String>): String? {
        val abi = Build.SUPPORTED_ABIS.firstOrNull() ?: "arm64-v8a"
        return names.firstOrNull { it.endsWith("-$abi.apk") }
            ?: names.firstOrNull { n -> ABI_SUFFIXES.none { n.endsWith("-$it.apk") } }
            ?: names.firstOrNull()
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
        json.put("activeTab", activeTab?.takeIf { !it.private }?.id ?: "")
        json.put("adblock", adblockOn)
        json.put("theme", themeMode)
        json.put("dynamic", dynamicColor)
        json.put("engine", defaultEngine.id)
        json.put("search", searchEngineId)
        json.put("textScale", textScale)
        json.put("javascript", javascript)
        json.put("httpsOnly", httpsOnly)
        json.put("gpc", gpc)
        json.put("thirdPartyCookies", thirdPartyCookies)
        json.put("darkPages", darkPages)
        json.put("saveHistory", saveHistory)
        json.put("spaces", JSONArray().apply { spaces.forEach { put(JSONObject().put("id", it.id).put("name", it.name).put("color", it.color)) } })
        // Private tabs are never written to disk.
        json.put("tabs", JSONArray().apply {
            tabs.filter { !it.private }.forEach {
                put(JSONObject().put("id", it.id).put("url", it.url).put("title", it.title).put("space", it.spaceId).put("pinned", it.pinned).put("engine", it.engineKind.id))
            }
        })
        prefs.edit().putString("session", json.toString()).apply()
    }

    private fun load() {
        val raw = prefs.getString("session", null)
        if (raw != null) runCatching {
            val json = JSONObject(raw)
            adblockOn = json.optBoolean("adblock", true)
            themeMode = json.optInt("theme", THEME_SYSTEM)
            dynamicColor = json.optBoolean("dynamic", true)
            defaultEngine = EngineKind.of(json.optString("engine"))
            searchEngineId = json.optString("search", "google")
            textScale = json.optInt("textScale", 100)
            javascript = json.optBoolean("javascript", true)
            httpsOnly = json.optBoolean("httpsOnly", true)
            gpc = json.optBoolean("gpc", true)
            thirdPartyCookies = json.optBoolean("thirdPartyCookies", false)
            darkPages = json.optBoolean("darkPages", false)
            saveHistory = json.optBoolean("saveHistory", true)
            val sp = json.getJSONArray("spaces")
            for (i in 0 until sp.length()) sp.getJSONObject(i).let { spaces.add(Space(it.getString("id"), it.getString("name"), it.getLong("color"))) }
            val ts = json.getJSONArray("tabs")
            for (i in 0 until ts.length()) ts.getJSONObject(i).let {
                tabs.add(Tab(it.getString("id"), it.getString("url"), it.getString("title"), it.getString("space"), it.optBoolean("pinned"), engineKind = EngineKind.of(it.optString("engine"))))
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

    companion object {
        val ABI_SUFFIXES = listOf("arm64-v8a", "armeabi-v7a", "x86_64", "x86")
    }
}
