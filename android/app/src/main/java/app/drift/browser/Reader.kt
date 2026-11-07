package app.drift.browser

import org.jsoup.Jsoup
import org.jsoup.nodes.Element

/** One block of an article, for Drift's reader view. */
sealed class ReaderBlock {
    data class Heading(val text: String, val level: Int) : ReaderBlock()
    data class Paragraph(val text: String) : ReaderBlock()
    data class Quote(val text: String) : ReaderBlock()
    data class Item(val text: String) : ReaderBlock()
    data class Image(val src: String, val caption: String?) : ReaderBlock()
}

data class Article(val title: String, val site: String, val byline: String?, val blocks: List<ReaderBlock>, val rtl: Boolean)

/**
 * Reader view, like Firefox's and Safari's: fetches the page and keeps only the
 * article. A small take on Readability: the element holding the most paragraph
 * text wins. Works the same whichever engine shows the page.
 */
object Reader {
    fun extract(url: String, userAgent: String): Article? {
        val doc = Jsoup.connect(url).userAgent(userAgent).timeout(15000).followRedirects(true).get()
        doc.select("script,style,noscript,nav,header,footer,aside,form,iframe,svg,button,[role=navigation],[aria-hidden=true],.ad,.ads,.advert,.share,.social,.related,.comments").remove()
        val title = doc.selectFirst("meta[property=og:title]")?.attr("content")?.takeIf { it.isNotBlank() } ?: doc.title()
        val byline = doc.selectFirst("meta[name=author]")?.attr("content")?.takeIf { it.isNotBlank() }
        val site = doc.selectFirst("meta[property=og:site_name]")?.attr("content")?.takeIf { it.isNotBlank() } ?: Url.host(url)

        // The deepest element that still holds most of the page's paragraph text is the article.
        val total = doc.select("p").sumOf { it.text().length }
        if (total < 400) return null
        val best = doc.select("article, main, [role=main], div, section")
            .filter { paragraphText(it) >= total * 0.7 }
            .maxByOrNull { it.parents().size } ?: doc.body()

        val blocks = ArrayList<ReaderBlock>()
        for (el in best.select("h1,h2,h3,h4,p,blockquote,li,figure,img")) {
            val text = el.text().trim()
            when (el.tagName()) {
                "h1", "h2", "h3", "h4" -> if (text.isNotEmpty() && text != title) blocks.add(ReaderBlock.Heading(text, el.tagName()[1].digitToInt()))
                "p" -> if (text.length > 1 && el.parents().none { it.tagName() == "blockquote" || it.tagName() == "li" }) blocks.add(ReaderBlock.Paragraph(text))
                "blockquote" -> if (text.isNotEmpty()) blocks.add(ReaderBlock.Quote(text))
                "li" -> if (text.isNotEmpty() && text.length < 600) blocks.add(ReaderBlock.Item(text))
                "img" -> {
                    if (el.parents().any { it.tagName() == "figure" }) continue
                    image(el)?.let { blocks.add(ReaderBlock.Image(it, el.attr("alt").takeIf { a -> a.isNotBlank() })) }
                }
                "figure" -> el.selectFirst("img")?.let { img -> image(img)?.let { blocks.add(ReaderBlock.Image(it, el.selectFirst("figcaption")?.text())) } }
            }
        }
        val dir = doc.selectFirst("html")?.attr("dir")
        val lang = doc.selectFirst("html")?.attr("lang") ?: ""
        val rtl = dir == "rtl" || lang.startsWith("he") || lang.startsWith("ar") || lang.startsWith("fa")
        return Article(title, site, byline, blocks, rtl)
    }

    private fun image(img: Element): String? {
        val src = img.absUrl("src").ifBlank { img.absUrl("data-src") }
        return src.takeIf { it.startsWith("http") && !it.endsWith(".svg") }
    }

    private fun paragraphText(el: Element): Int = el.select("p").sumOf { it.text().length }
}
