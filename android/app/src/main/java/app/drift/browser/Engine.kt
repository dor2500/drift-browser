package app.drift.browser

import android.graphics.Bitmap
import android.net.Uri
import android.view.View
import java.io.InputStream

/** The two engines a tab can run on. */
enum class EngineKind(val id: String) {
    CHROMIUM("chromium"),
    GECKO("gecko");

    companion object {
        fun of(id: String?) = entries.firstOrNull { it.id == id } ?: CHROMIUM
    }
}

/**
 * One page, on either engine. The UI and the model talk only to this, so every
 * feature (find, desktop mode, print, context menus, downloads) works the same on
 * Chromium (Android System WebView) and Gecko (Mozilla GeckoView).
 */
interface PageEngine {
    val kind: EngineKind
    val view: View
    fun load(url: String)
    fun goBack()
    fun goForward()
    fun reload()
    fun stop()
    fun find(query: String)
    fun findNext(forward: Boolean)
    fun clearFind()
    fun setDesktop(on: Boolean)
    fun exitFullscreen()
    fun print(jobName: String)
    fun setActive(active: Boolean) {}
    fun destroy()
}

/** What the engine reports back about its page; the model applies it to the tab. */
interface PageEvents {
    fun onUrl(url: String)
    fun onTitle(title: String)
    fun onIcon(icon: Bitmap)
    fun onProgress(progress: Int)
    fun onPageStart(url: String)
    fun onPageFinished(url: String)
    fun onHistory(canGoBack: Boolean, canGoForward: Boolean)
    fun onBlocked()
    fun onFind(active: Int, total: Int)
    fun onContextMenu(link: String?, image: String?, text: String?)
    fun onFullscreen(view: View?, on: Boolean)
    fun onNewTab(url: String?, engine: PageEngine?)
    fun onDownload(url: String, mimeType: String?, fileName: String?, body: InputStream?, userAgent: String?)
    fun onExternal(uri: Uri)
    fun onCloseRequest()
    fun pickFiles(mimeTypes: Array<String>, multiple: Boolean, result: (Array<Uri>?) -> Unit)
    fun prompt(p: Prompt)
}

/** In-page dialogs (alert, confirm, prompt, <select>) shown by Drift's own Material UI. */
sealed class Prompt {
    abstract val title: String?

    data class Alert(override val title: String?, val message: String, val done: () -> Unit) : Prompt()
    data class Confirm(override val title: String?, val message: String, val result: (Boolean) -> Unit) : Prompt()
    data class Text(override val title: String?, val message: String, val default: String, val result: (String?) -> Unit) : Prompt()
    data class Choice(override val title: String?, val items: List<Pair<String, String>>, val selected: Set<String>, val multiple: Boolean, val result: (List<String>?) -> Unit) : Prompt()
}
