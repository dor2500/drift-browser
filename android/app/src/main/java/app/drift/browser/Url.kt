package app.drift.browser

import android.net.Uri

/** Same rules as the desktop address bar (shared/url.ts). */
object Url {
    private const val SEARCH = "https://www.google.com/search?q="
    const val HOME = "https://www.google.com/"
    private val scheme = Regex("^(https?|file|about|data|view-source):", RegexOption.IGNORE_CASE)
    private val hostLike = Regex("^(localhost|\\d{1,3}(\\.\\d{1,3}){3})(:\\d+)?(/.*)?$", RegexOption.IGNORE_CASE)
    private val domain = Regex("^[^/\\s]+\\.[a-z]{2,}(:\\d+)?([/?#].*)?$", RegexOption.IGNORE_CASE)

    fun looksLikeUrl(input: String): Boolean {
        val s = input.trim()
        if (s.isEmpty() || s.any { it.isWhitespace() }) return false
        return scheme.containsMatchIn(s) || hostLike.matches(s) || domain.matches(s)
    }

    fun normalize(input: String): String {
        val s = input.trim()
        if (!looksLikeUrl(s)) return SEARCH + Uri.encode(s)
        if (scheme.containsMatchIn(s)) return s
        return (if (hostLike.matches(s)) "http://" else "https://") + s
    }

    fun host(url: String): String = runCatching { Uri.parse(url).host?.removePrefix("www.") ?: "" }.getOrDefault("")

    /** Short form for the address pill: the search query, or host + path. */
    fun display(url: String): String {
        val u = runCatching { Uri.parse(url) }.getOrNull() ?: return url
        if (u.host?.contains("google.") == true && u.path == "/search") u.getQueryParameter("q")?.let { return it }
        val path = if (u.path.isNullOrEmpty() || u.path == "/") "" else u.path
        return (u.host?.removePrefix("www.") ?: url) + path
    }
}
