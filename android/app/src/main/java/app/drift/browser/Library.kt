package app.drift.browser

import android.content.Context
import androidx.compose.runtime.mutableStateListOf
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

data class Visit(val url: String, val title: String, val time: Long)
data class Bookmark(val url: String, val title: String, val time: Long)

/**
 * History and bookmarks, kept on the phone only (files in the app's private storage).
 * Private tabs never write here.
 */
class Library(context: Context) {
    private val historyFile = File(context.filesDir, "history.json")
    private val bookmarksFile = File(context.filesDir, "bookmarks.json")
    val history = mutableStateListOf<Visit>()
    val bookmarks = mutableStateListOf<Bookmark>()

    init {
        read(historyFile) { history.add(Visit(it.getString("url"), it.optString("title"), it.getLong("time"))) }
        read(bookmarksFile) { bookmarks.add(Bookmark(it.getString("url"), it.optString("title"), it.getLong("time"))) }
    }

    fun visit(url: String, title: String) {
        if (!url.startsWith("http")) return
        // A reload or a title update replaces the latest entry instead of adding one.
        val last = history.firstOrNull()
        if (last != null && last.url == url) history[0] = last.copy(title = title.ifBlank { last.title })
        else history.add(0, Visit(url, title, System.currentTimeMillis()))
        while (history.size > MAX_HISTORY) history.removeAt(history.lastIndex)
        saveHistory()
    }

    fun removeVisit(v: Visit) { history.remove(v); saveHistory() }

    /** Removes visits newer than [since] (0 = all). */
    fun clearHistory(since: Long = 0) {
        history.removeAll { it.time >= since }
        saveHistory()
    }

    fun isBookmarked(url: String) = bookmarks.any { it.url == url }

    fun toggleBookmark(url: String, title: String) {
        val b = bookmarks.firstOrNull { it.url == url }
        if (b != null) bookmarks.remove(b) else bookmarks.add(0, Bookmark(url, title, System.currentTimeMillis()))
        write(bookmarksFile, bookmarks.map { JSONObject().put("url", it.url).put("title", it.title).put("time", it.time) })
    }

    fun removeBookmark(b: Bookmark) = toggleBookmark(b.url, b.title)

    /** Most-visited sites for the start page, one per host. */
    fun topSites(limit: Int): List<Visit> =
        history.groupBy { Url.host(it.url) }
            .filterKeys { it.isNotEmpty() }
            .entries.sortedByDescending { it.value.size }
            .take(limit)
            .map { (_, visits) -> visits.first().let { v -> v.copy(url = Uri.root(v.url)) } }

    fun suggest(q: String, limit: Int): List<Visit> {
        if (q.isBlank()) return emptyList()
        val seen = HashSet<String>()
        return (bookmarks.map { Visit(it.url, it.title, it.time) } + history)
            .filter { (it.url.contains(q, true) || it.title.contains(q, true)) && seen.add(it.url) }
            .take(limit)
    }

    private fun saveHistory() = write(historyFile, history.map { JSONObject().put("url", it.url).put("title", it.title).put("time", it.time) })

    private fun write(f: File, items: List<JSONObject>) {
        runCatching { f.writeText(JSONArray().apply { items.forEach { put(it) } }.toString()) }
    }

    private fun read(f: File, each: (JSONObject) -> Unit) {
        if (!f.isFile) return
        runCatching { val a = JSONArray(f.readText()); for (i in 0 until a.length()) each(a.getJSONObject(i)) }
    }

    private object Uri {
        fun root(url: String): String = runCatching { android.net.Uri.parse(url).let { "${it.scheme}://${it.host}/" } }.getOrDefault(url)
    }

    companion object {
        const val MAX_HISTORY = 5000
    }
}
