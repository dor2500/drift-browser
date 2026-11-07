package app.drift.browser

import android.net.Uri

/** A search engine Drift can send address-bar searches to. */
data class SearchEngine(val id: String, val name: String, val query: String)

val SEARCH_ENGINES = listOf(
    SearchEngine("google", "Google", "https://www.google.com/search?q="),
    SearchEngine("duckduckgo", "DuckDuckGo", "https://duckduckgo.com/?q="),
    SearchEngine("brave", "Brave Search", "https://search.brave.com/search?q="),
    SearchEngine("startpage", "Startpage", "https://www.startpage.com/do/search?q="),
    SearchEngine("bing", "Bing", "https://www.bing.com/search?q="),
    SearchEngine("ecosia", "Ecosia", "https://www.ecosia.org/search?q="),
    SearchEngine("qwant", "Qwant", "https://www.qwant.com/?q="),
)

/** Same rules as the desktop address bar (shared/url.ts). */
object Url {
    /** Drift's own start page, drawn natively instead of loaded by an engine. */
    const val HOME = "drift:home"
    var search: SearchEngine = SEARCH_ENGINES[0]
    private val scheme = Regex("^(https?|file|about|data|view-source|drift):", RegexOption.IGNORE_CASE)
    private val hostLike = Regex("^(localhost|\\d{1,3}(\\.\\d{1,3}){3})(:\\d+)?(/.*)?$", RegexOption.IGNORE_CASE)
    private val domain = Regex("^[^/\\s]+\\.[a-z]{2,}(:\\d+)?([/?#].*)?$", RegexOption.IGNORE_CASE)

    fun isHome(url: String?) = url == null || url == HOME || url == "about:blank" || url.isEmpty()

    fun looksLikeUrl(input: String): Boolean {
        val s = input.trim()
        if (s.isEmpty() || s.any { it.isWhitespace() }) return false
        return scheme.containsMatchIn(s) || hostLike.matches(s) || domain.matches(s)
    }

    fun normalize(input: String): String {
        val s = input.trim()
        if (!looksLikeUrl(s)) return search.query + Uri.encode(s)
        if (scheme.containsMatchIn(s)) return s
        return (if (hostLike.matches(s)) "http://" else "https://") + s
    }

    fun host(url: String): String = runCatching { Uri.parse(url).host?.removePrefix("www.") ?: "" }.getOrDefault("")

    /** Short form for the address pill: the search query, or host + path. */
    fun display(url: String): String {
        if (isHome(url)) return ""
        val u = runCatching { Uri.parse(url) }.getOrNull() ?: return url
        val host = u.host ?: return url
        // Show the query for any of the known search engines.
        SEARCH_ENGINES.firstOrNull { Uri.parse(it.query).host == u.host }?.let { u.getQueryParameter("q")?.let { q -> return q } }
        if (host.contains("google.") && u.path == "/search") u.getQueryParameter("q")?.let { return it }
        val path = if (u.path.isNullOrEmpty() || u.path == "/") "" else u.path
        return host.removePrefix("www.") + path
    }
}
