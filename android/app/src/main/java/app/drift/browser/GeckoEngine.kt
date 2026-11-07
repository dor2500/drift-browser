package app.drift.browser

import android.app.Activity
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.print.PrintManager
import android.view.View
import org.mozilla.geckoview.AllowOrDeny
import org.mozilla.geckoview.ContentBlocking
import org.mozilla.geckoview.GeckoResult
import org.mozilla.geckoview.GeckoRuntime
import org.mozilla.geckoview.GeckoRuntimeSettings
import org.mozilla.geckoview.GeckoSession
import org.mozilla.geckoview.GeckoSession.PromptDelegate
import org.mozilla.geckoview.GeckoSession.PromptDelegate.PromptResponse
import org.mozilla.geckoview.GeckoSessionSettings
import org.mozilla.geckoview.GeckoView
import org.mozilla.geckoview.GeckoViewPrintDocumentAdapter
import org.mozilla.geckoview.StorageController
import org.mozilla.geckoview.WebResponse
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

/**
 * Gecko: Mozilla's GeckoView, the engine of Firefox for Android, built into Drift.
 * One runtime per process, created the first time a Gecko tab opens.
 */
object Gecko {
    @Volatile private var runtime: GeckoRuntime? = null

    val started: Boolean get() = runtime != null

    fun runtime(context: Context, prefs: EnginePrefs, gpc: Boolean, colorScheme: Int): GeckoRuntime {
        runtime?.let { return it }
        val settings = GeckoRuntimeSettings.Builder()
            .contentBlocking(blocking(prefs))
            .javaScriptEnabled(prefs.javascript())
            .globalPrivacyControlEnabled(gpc)
            .automaticFontSizeAdjustment(false)
            .fontSizeFactor(prefs.textScale() / 100f)
            .preferredColorScheme(colorScheme)
            .allowInsecureConnections(if (prefs.httpsOnly()) GeckoRuntimeSettings.HTTPS_ONLY else GeckoRuntimeSettings.ALLOW_ALL)
            .aboutConfigEnabled(false)
            .consoleOutput(BuildConfig.DEBUG)
            .remoteDebuggingEnabled(BuildConfig.DEBUG)
            .build()
        val r = GeckoRuntime.create(context.applicationContext, settings)
        // Drift's own add-on: the YouTube ad skipper (Gecko's tracking protection does the network blocking).
        r.webExtensionController.ensureBuiltIn("resource://android/assets/ext/drift/", "drift@drift.app")
            .accept({ ext -> if (ext != null) r.webExtensionController.setAllowedInPrivateBrowsing(ext, true) }, { })
        runtime = r
        return r
    }

    /** Firefox's Enhanced Tracking Protection: ads, analytics, social, cryptominers and fingerprinters. */
    private fun blocking(prefs: EnginePrefs): ContentBlocking.Settings {
        val cats = if (prefs.adblock()) {
            ContentBlocking.AntiTracking.DEFAULT or ContentBlocking.AntiTracking.CRYPTOMINING or ContentBlocking.AntiTracking.FINGERPRINTING
        } else ContentBlocking.AntiTracking.NONE
        // Total Cookie Protection (each site gets its own cookie jar), as in Firefox; or all third-party cookies blocked.
        val cookies = if (prefs.thirdPartyCookies()) ContentBlocking.CookieBehavior.ACCEPT_FIRST_PARTY_AND_ISOLATE_OTHERS else ContentBlocking.CookieBehavior.ACCEPT_FIRST_PARTY
        return ContentBlocking.Settings.Builder()
            .antiTracking(cats)
            .cookieBehavior(cookies)
            .cookieBehaviorPrivateMode(ContentBlocking.CookieBehavior.ACCEPT_FIRST_PARTY)
            .safeBrowsing(ContentBlocking.SafeBrowsing.DEFAULT)
            .queryParameterStrippingEnabled(true)
            .queryParameterStrippingPrivateBrowsingEnabled(true)
            .build()
    }

    /** Applies changed Settings to a running engine. */
    fun apply(prefs: EnginePrefs, gpc: Boolean, colorScheme: Int) {
        val r = runtime ?: return
        val s = r.settings
        s.setJavaScriptEnabled(prefs.javascript())
        s.setGlobalPrivacyControl(gpc)
        s.setFontSizeFactor(prefs.textScale() / 100f)
        s.setPreferredColorScheme(colorScheme)
        s.setAllowInsecureConnections(if (prefs.httpsOnly()) GeckoRuntimeSettings.HTTPS_ONLY else GeckoRuntimeSettings.ALLOW_ALL)
        val cb = s.contentBlocking
        val fresh = blocking(prefs)
        cb.setAntiTracking(fresh.antiTrackingCategories)
        cb.setCookieBehavior(fresh.cookieBehavior)
    }

    fun clearData(cookies: Boolean, cache: Boolean) {
        val r = runtime ?: return
        var flags = 0L
        if (cookies) flags = flags or StorageController.ClearFlags.SITE_DATA
        if (cache) flags = flags or StorageController.ClearFlags.ALL_CACHES
        if (flags != 0L) r.storageController.clearData(flags)
    }

    /** Gecko's version, e.g. "159.0". */
    val version: String get() = org.mozilla.geckoview.BuildConfig.MOZ_APP_VERSION
}

class GeckoEngine(
    private val activity: Activity,
    /** Replaced when a page opened by another page is adopted by its own tab. */
    var events: PageEvents,
    private val prefs: EnginePrefs,
    private val runtime: GeckoRuntime,
    private val private: Boolean,
    existing: GeckoSession? = null,
) : PageEngine {
    override val kind = EngineKind.GECKO
    private val main = Handler(Looper.getMainLooper())
    private val session: GeckoSession = existing ?: GeckoSession(settings(private, false))
    private val geckoView = GeckoView(activity)
    override val view: View get() = geckoView
    private var desktop = false
    private var lastIconHost: String? = null

    init {
        session.navigationDelegate = object : GeckoSession.NavigationDelegate {
            override fun onLocationChange(session: GeckoSession, url: String?, perms: MutableList<GeckoSession.PermissionDelegate.ContentPermission>, hasUserGesture: Boolean) {
                if (url != null) {
                    events.onUrl(url)
                    fetchIcon(url)
                }
            }
            override fun onCanGoBack(session: GeckoSession, canGoBack: Boolean) { back = canGoBack; events.onHistory(back, forward) }
            override fun onCanGoForward(session: GeckoSession, canGoForward: Boolean) { forward = canGoForward; events.onHistory(back, forward) }

            override fun onLoadRequest(session: GeckoSession, request: GeckoSession.NavigationDelegate.LoadRequest): GeckoResult<AllowOrDeny>? {
                val uri = Uri.parse(request.uri)
                val scheme = uri.scheme ?: return null
                if (scheme in INTERNAL_SCHEMES) return null
                // intent:, mailto:, tel:, market: … go to the app that handles them.
                main.post { events.onExternal(uri) }
                return GeckoResult.fromValue(AllowOrDeny.DENY)
            }

            override fun onNewSession(session: GeckoSession, uri: String): GeckoResult<GeckoSession> {
                val child = GeckoSession(settings(private, false))
                val engine = GeckoEngine(activity, NoEvents, prefs, runtime, private, child)
                events.onNewTab(uri, engine)
                return GeckoResult.fromValue(child)
            }
        }
        session.progressDelegate = object : GeckoSession.ProgressDelegate {
            override fun onPageStart(session: GeckoSession, url: String) = events.onPageStart(url)
            override fun onPageStop(session: GeckoSession, success: Boolean) = events.onPageFinished(currentUrl ?: "")
            override fun onProgressChange(session: GeckoSession, progress: Int) = events.onProgress(progress)
        }
        session.contentDelegate = object : GeckoSession.ContentDelegate {
            override fun onTitleChange(session: GeckoSession, title: String?) { if (!title.isNullOrBlank()) events.onTitle(title) }
            override fun onFullScreen(session: GeckoSession, fullScreen: Boolean) = events.onFullscreen(null, fullScreen)
            override fun onCloseRequest(session: GeckoSession) = events.onCloseRequest()
            override fun onContextMenu(session: GeckoSession, screenX: Int, screenY: Int, element: GeckoSession.ContentDelegate.ContextElement) {
                val image = if (element.type == GeckoSession.ContentDelegate.ContextElement.TYPE_IMAGE) element.srcUri else null
                if (element.linkUri != null || image != null) events.onContextMenu(element.linkUri, image, element.linkText)
            }
            override fun onExternalResponse(session: GeckoSession, response: WebResponse) {
                val disposition = response.headers.entries.firstOrNull { it.key.equals("content-disposition", true) }?.value
                val type = response.headers.entries.firstOrNull { it.key.equals("content-type", true) }?.value?.substringBefore(';')
                events.onDownload(response.uri, type, android.webkit.URLUtil.guessFileName(response.uri, disposition, type), response.body, null)
            }
            override fun onCrash(session: GeckoSession) = restart()
            override fun onKill(session: GeckoSession) = restart()
        }
        session.contentBlockingDelegate = object : ContentBlocking.Delegate {
            override fun onContentBlocked(session: GeckoSession, event: ContentBlocking.BlockEvent) { events.onBlocked() }
        }
        session.promptDelegate = Prompts()
        // Same defaults as Drift's Chromium side: no location, notifications or camera for sites;
        // muted autoplay, DRM video and first-party storage are fine.
        session.permissionDelegate = object : GeckoSession.PermissionDelegate {
            override fun onContentPermissionRequest(session: GeckoSession, perm: GeckoSession.PermissionDelegate.ContentPermission): GeckoResult<Int> {
                val allow = perm.permission in setOf(
                    GeckoSession.PermissionDelegate.PERMISSION_AUTOPLAY_INAUDIBLE,
                    GeckoSession.PermissionDelegate.PERMISSION_PERSISTENT_STORAGE,
                    GeckoSession.PermissionDelegate.PERMISSION_MEDIA_KEY_SYSTEM_ACCESS,
                    GeckoSession.PermissionDelegate.PERMISSION_STORAGE_ACCESS,
                )
                return GeckoResult.fromValue(if (allow) GeckoSession.PermissionDelegate.ContentPermission.VALUE_ALLOW else GeckoSession.PermissionDelegate.ContentPermission.VALUE_DENY)
            }
        }
        session.setActive(true)
        if (existing == null) session.open(runtime) else if (!session.isOpen) session.open(runtime)
        geckoView.setSession(session)
    }

    private var back = false
    private var forward = false
    private var currentUrl: String? = null

    private fun restart() {
        if (session.isOpen) session.close()
        session.open(runtime)
        currentUrl?.let { session.loadUri(it) }
    }

    /** Gecko has no favicon callback; ask the site for its icon once per host. */
    private fun fetchIcon(url: String) {
        currentUrl = url
        val host = Uri.parse(url).host ?: return
        if (host == lastIconHost) return
        lastIconHost = host
        val scheme = Uri.parse(url).scheme ?: return
        if (scheme != "https" && scheme != "http") return
        thread {
            runCatching {
                val c = URL("$scheme://$host/favicon.ico").openConnection() as HttpURLConnection
                c.connectTimeout = 5000
                c.readTimeout = 5000
                c.instanceFollowRedirects = true
                val bmp = c.inputStream.use { BitmapFactory.decodeStream(it) }
                if (bmp != null) main.post { events.onIcon(bmp) }
            }
        }
    }

    override fun load(url: String) = session.loadUri(url)
    override fun goBack() = session.goBack()
    override fun goForward() = session.goForward()
    override fun reload() = session.reload()
    override fun stop() = session.stop()

    override fun find(query: String) {
        if (query.isEmpty()) { clearFind(); return }
        session.finder.find(query, 0).accept { r -> if (r != null) events.onFind(r.current, r.total) }
    }

    override fun findNext(forward: Boolean) {
        session.finder.find(null, if (forward) 0 else GeckoSession.FINDER_FIND_BACKWARDS).accept { r -> if (r != null) events.onFind(r.current, r.total) }
    }

    override fun clearFind() = session.finder.clear()

    override fun setDesktop(on: Boolean) {
        desktop = on
        session.settings.setUserAgentMode(if (on) GeckoSessionSettings.USER_AGENT_MODE_DESKTOP else GeckoSessionSettings.USER_AGENT_MODE_MOBILE)
        session.settings.setViewportMode(if (on) GeckoSessionSettings.VIEWPORT_MODE_DESKTOP else GeckoSessionSettings.VIEWPORT_MODE_MOBILE)
        session.reload()
    }

    override fun exitFullscreen() = session.exitFullScreen()

    override fun print(jobName: String) {
        session.saveAsPdf().accept { pdf ->
            if (pdf == null) return@accept
            val pm = activity.getSystemService(Context.PRINT_SERVICE) as PrintManager
            pm.print(jobName, GeckoViewPrintDocumentAdapter(pdf, activity), null)
        }
    }

    override fun setActive(active: Boolean) = session.setActive(active)

    override fun destroy() {
        (geckoView.parent as? android.view.ViewGroup)?.removeView(geckoView)
        geckoView.releaseSession()
        session.close()
    }

    // ---------------------------------------------------------------- dialogs

    private inner class Prompts : PromptDelegate {
        override fun onAlertPrompt(session: GeckoSession, prompt: PromptDelegate.AlertPrompt): GeckoResult<PromptResponse> {
            val r = GeckoResult<PromptResponse>()
            events.prompt(Prompt.Alert(prompt.title, prompt.message ?: "") { r.complete(prompt.dismiss()) })
            return r
        }

        override fun onButtonPrompt(session: GeckoSession, prompt: PromptDelegate.ButtonPrompt): GeckoResult<PromptResponse> {
            val r = GeckoResult<PromptResponse>()
            events.prompt(Prompt.Confirm(prompt.title, prompt.message ?: "") { ok ->
                r.complete(prompt.confirm(if (ok) PromptDelegate.ButtonPrompt.Type.POSITIVE else PromptDelegate.ButtonPrompt.Type.NEGATIVE))
            })
            return r
        }

        override fun onTextPrompt(session: GeckoSession, prompt: PromptDelegate.TextPrompt): GeckoResult<PromptResponse> {
            val r = GeckoResult<PromptResponse>()
            events.prompt(Prompt.Text(prompt.title, prompt.message ?: "", prompt.defaultValue ?: "") { text ->
                r.complete(if (text == null) prompt.dismiss() else prompt.confirm(text))
            })
            return r
        }

        override fun onChoicePrompt(session: GeckoSession, prompt: PromptDelegate.ChoicePrompt): GeckoResult<PromptResponse> {
            val r = GeckoResult<PromptResponse>()
            // Flatten <optgroup>s; separators and disabled items are left out.
            val flat = ArrayList<PromptDelegate.ChoicePrompt.Choice>()
            fun walk(list: Array<PromptDelegate.ChoicePrompt.Choice>) {
                for (c in list) {
                    if (c.items != null) walk(c.items!!) else if (!c.separator && !c.disabled) flat.add(c)
                }
            }
            walk(prompt.choices)
            val multiple = prompt.type == PromptDelegate.ChoicePrompt.Type.MULTIPLE
            events.prompt(Prompt.Choice(prompt.title ?: prompt.message, flat.map { it.id to it.label }, flat.filter { it.selected }.map { it.id }.toSet(), multiple) { ids ->
                r.complete(
                    when {
                        ids == null -> prompt.dismiss()
                        multiple -> prompt.confirm(ids.toTypedArray())
                        else -> prompt.confirm(ids.first())
                    },
                )
            })
            return r
        }

        /** Date and time fields: typed in the format the page expects. */
        override fun onDateTimePrompt(session: GeckoSession, prompt: PromptDelegate.DateTimePrompt): GeckoResult<PromptResponse> {
            val r = GeckoResult<PromptResponse>()
            val format = when (prompt.type) {
                PromptDelegate.DateTimePrompt.Type.DATE -> "YYYY-MM-DD"
                PromptDelegate.DateTimePrompt.Type.MONTH -> "YYYY-MM"
                PromptDelegate.DateTimePrompt.Type.WEEK -> "YYYY-W01"
                PromptDelegate.DateTimePrompt.Type.TIME -> "HH:MM"
                else -> "YYYY-MM-DDTHH:MM"
            }
            events.prompt(Prompt.Text(prompt.title, format, prompt.defaultValue ?: "") { text ->
                r.complete(if (text == null) prompt.dismiss() else prompt.confirm(text))
            })
            return r
        }

        override fun onPopupPrompt(session: GeckoSession, prompt: PromptDelegate.PopupPrompt): GeckoResult<PromptResponse> =
            GeckoResult.fromValue(prompt.confirm(AllowOrDeny.ALLOW))

        override fun onBeforeUnloadPrompt(session: GeckoSession, prompt: PromptDelegate.BeforeUnloadPrompt): GeckoResult<PromptResponse> =
            GeckoResult.fromValue(prompt.confirm(AllowOrDeny.ALLOW))

        override fun onRepostConfirmPrompt(session: GeckoSession, prompt: PromptDelegate.RepostConfirmPrompt): GeckoResult<PromptResponse> {
            val r = GeckoResult<PromptResponse>()
            events.prompt(Prompt.Confirm(null, activity.getString(R.string.repost)) { ok -> r.complete(prompt.confirm(if (ok) AllowOrDeny.ALLOW else AllowOrDeny.DENY)) })
            return r
        }

        override fun onFilePrompt(session: GeckoSession, prompt: PromptDelegate.FilePrompt): GeckoResult<PromptResponse> {
            val r = GeckoResult<PromptResponse>()
            val types = prompt.mimeTypes?.filter { it.isNotBlank() }?.toTypedArray() ?: emptyArray()
            events.pickFiles(types, prompt.type == PromptDelegate.FilePrompt.Type.MULTIPLE) { uris ->
                r.complete(if (uris.isNullOrEmpty()) prompt.dismiss() else prompt.confirm(activity, uris))
            }
            return r
        }
    }

    companion object {
        private val INTERNAL_SCHEMES = setOf("http", "https", "about", "data", "blob", "file", "resource", "moz-extension", "javascript", "view-source")

        fun settings(private: Boolean, desktop: Boolean): GeckoSessionSettings = GeckoSessionSettings.Builder()
            .usePrivateMode(private)
            .useTrackingProtection(true)
            .suspendMediaWhenInactive(false)
            .userAgentMode(if (desktop) GeckoSessionSettings.USER_AGENT_MODE_DESKTOP else GeckoSessionSettings.USER_AGENT_MODE_MOBILE)
            .viewportMode(if (desktop) GeckoSessionSettings.VIEWPORT_MODE_DESKTOP else GeckoSessionSettings.VIEWPORT_MODE_MOBILE)
            .build()
    }
}

/** Placeholder until a page opened by another page is adopted by its own tab. */
object NoEvents : PageEvents {
    override fun onUrl(url: String) {}
    override fun onTitle(title: String) {}
    override fun onIcon(icon: Bitmap) {}
    override fun onProgress(progress: Int) {}
    override fun onPageStart(url: String) {}
    override fun onPageFinished(url: String) {}
    override fun onHistory(canGoBack: Boolean, canGoForward: Boolean) {}
    override fun onBlocked() {}
    override fun onFind(active: Int, total: Int) {}
    override fun onContextMenu(link: String?, image: String?, text: String?) {}
    override fun onFullscreen(view: View?, on: Boolean) {}
    override fun onNewTab(url: String?, engine: PageEngine?) {}
    override fun onDownload(url: String, mimeType: String?, fileName: String?, body: java.io.InputStream?, userAgent: String?) {}
    override fun onExternal(uri: Uri) {}
    override fun onCloseRequest() {}
    override fun pickFiles(mimeTypes: Array<String>, multiple: Boolean, result: (Array<Uri>?) -> Unit) = result(null)
    override fun prompt(p: Prompt) {}
}
