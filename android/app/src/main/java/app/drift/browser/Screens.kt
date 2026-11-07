package app.drift.browser

import android.text.format.DateUtils
import android.webkit.WebView
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.outlined.Cookie
import androidx.compose.material.icons.outlined.DarkMode
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.FormatSize
import androidx.compose.material.icons.outlined.History
import androidx.compose.material.icons.outlined.Https
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.LightMode
import androidx.compose.material.icons.outlined.Code
import androidx.compose.material.icons.outlined.Palette
import androidx.compose.material.icons.outlined.PhoneAndroid
import androidx.compose.material.icons.outlined.PrivacyTip
import androidx.compose.material.icons.outlined.Shield
import androidx.compose.material.icons.outlined.SystemUpdate
import androidx.compose.material.icons.outlined.Contrast
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LargeTopAppBar
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Slider
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.runtime.CompositionLocalProvider

/** A Material 3 page with a large collapsing title. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun Page(title: String, onClose: () -> Unit, actions: @Composable () -> Unit = {}, content: @Composable (PaddingValues) -> Unit) {
    val scroll = TopAppBarDefaults.exitUntilCollapsedScrollBehavior()
    val c = MaterialTheme.colorScheme
    Scaffold(
        modifier = Modifier.fillMaxSize().nestedScroll(scroll.nestedScrollConnection),
        containerColor = c.surfaceContainer,
        topBar = {
            LargeTopAppBar(
                title = { Text(title) },
                navigationIcon = { IconButton(onClick = onClose) { Icon(Icons.AutoMirrored.Filled.ArrowBack, stringResource(R.string.back)) } },
                actions = { actions() },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = c.surfaceContainer, scrolledContainerColor = c.surfaceContainer),
                scrollBehavior = scroll,
            )
        },
    ) { pad -> content(PaddingValues(start = 16.dp, end = 16.dp, top = pad.calculateTopPadding(), bottom = pad.calculateBottomPadding() + 24.dp)) }
}

// ---------------------------------------------------------------- settings

@Composable
fun SettingsScreen(model: BrowserModel, onClose: () -> Unit) {
    val ctx = LocalContext.current
    var askMove by remember { mutableStateOf<EngineKind?>(null) }
    var pickSearch by remember { mutableStateOf(false) }
    var clearing by remember { mutableStateOf(false) }
    Page(stringResource(R.string.settings), onClose) { pad ->
        LazyColumn(contentPadding = pad, verticalArrangement = Arrangement.spacedBy(8.dp)) {
            item { SectionLabel(stringResource(R.string.engine)) }
            item {
                ListGroup {
                    Column(Modifier.padding(16.dp)) {
                        Text(stringResource(R.string.engine_default), style = MaterialTheme.typography.titleMedium)
                        Spacer(Modifier.height(4.dp))
                        Text(stringResource(R.string.engine_explain), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Spacer(Modifier.height(12.dp))
                        EnginePicker(model.defaultEngine) { if (it != model.defaultEngine) askMove = it }
                    }
                    val chromium = WebView.getCurrentWebViewPackage()?.versionName ?: "?"
                    ListItem(
                        headlineContent = { Text(stringResource(R.string.engine_chromium)) },
                        supportingContent = { Text(stringResource(R.string.engine_chromium_desc, chromium)) },
                        leadingContent = { EngineBadge(EngineKind.CHROMIUM) },
                        colors = rowColors,
                    )
                    ListItem(
                        headlineContent = { Text(stringResource(R.string.engine_gecko)) },
                        supportingContent = { Text(stringResource(R.string.engine_gecko_desc, Gecko.version)) },
                        leadingContent = { EngineBadge(EngineKind.GECKO) },
                        colors = rowColors,
                    )
                }
            }

            item { SectionLabel(stringResource(R.string.search)) }
            item {
                ListGroup {
                    MenuRow(Icons.Filled.Search, stringResource(R.string.search_engine), Url.search.name) { pickSearch = true }
                }
            }

            item { SectionLabel(stringResource(R.string.appearance)) }
            item {
                ListGroup {
                    Column(Modifier.padding(16.dp)) {
                        Text(stringResource(R.string.theme), style = MaterialTheme.typography.titleMedium)
                        Spacer(Modifier.height(12.dp))
                        val options = listOf(
                            Triple(THEME_SYSTEM, R.string.theme_system, Icons.Outlined.PhoneAndroid),
                            Triple(THEME_LIGHT, R.string.theme_light, Icons.Outlined.LightMode),
                            Triple(THEME_DARK, R.string.theme_dark, Icons.Outlined.DarkMode),
                        )
                        SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                            options.forEachIndexed { i, (mode, label, icon) ->
                                SegmentedButton(
                                    selected = model.themeMode == mode,
                                    onClick = { model.themeMode = mode; model.applyPrefs(); applyNightMode(ctx, mode) },
                                    shape = SegmentedButtonDefaults.itemShape(i, options.size),
                                    icon = { Icon(icon, null, Modifier.size(18.dp)) },
                                ) { Text(stringResource(label), maxLines = 1) }
                            }
                        }
                    }
                    SwitchRow(
                        Icons.Outlined.Palette, stringResource(R.string.dynamic_color),
                        stringResource(if (dynamicColorSupported) R.string.dynamic_color_desc else R.string.dynamic_color_unsupported),
                        model.dynamicColor && dynamicColorSupported, enabled = dynamicColorSupported,
                    ) { model.dynamicColor = it; model.save() }
                    SwitchRow(Icons.Outlined.Contrast, stringResource(R.string.dark_pages), stringResource(R.string.dark_pages_desc), model.darkPages) {
                        model.darkPages = it; model.applyPrefs()
                    }
                    // Text size for web pages, like Chrome's and Firefox's accessibility setting.
                    var scale by remember { mutableFloatStateOf(model.textScale.toFloat()) }
                    Column(Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Outlined.FormatSize, null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
                            Spacer(Modifier.width(16.dp))
                            Text(stringResource(R.string.text_size), style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
                            Text("${scale.toInt()}%", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
                        }
                        Slider(value = scale, onValueChange = { scale = it }, valueRange = 50f..200f, steps = 14, onValueChangeFinished = {
                            model.textScale = scale.toInt(); model.applyPrefs()
                        })
                        Text(stringResource(R.string.text_size_sample), fontSize = (16 * scale / 100).sp)
                    }
                }
            }

            item { SectionLabel(stringResource(R.string.privacy)) }
            item {
                ListGroup {
                    SwitchRow(Icons.Outlined.Shield, stringResource(R.string.adblock), stringResource(R.string.adblock_desc), model.adblockOn) {
                        model.adblockOn = it; model.applyPrefs(); model.activeTab?.engine?.reload()
                    }
                    SwitchRow(Icons.Outlined.Https, stringResource(R.string.https_only), stringResource(R.string.https_only_desc), model.httpsOnly) { model.httpsOnly = it; model.applyPrefs() }
                    SwitchRow(Icons.Outlined.PrivacyTip, stringResource(R.string.gpc), stringResource(R.string.gpc_desc), model.gpc) { model.gpc = it; model.applyPrefs() }
                    SwitchRow(Icons.Outlined.Cookie, stringResource(R.string.third_party_cookies), stringResource(R.string.third_party_cookies_desc), model.thirdPartyCookies) {
                        model.thirdPartyCookies = it; model.applyPrefs()
                    }
                    SwitchRow(Icons.Outlined.Code, stringResource(R.string.javascript), stringResource(R.string.javascript_desc), model.javascript) { model.javascript = it; model.applyPrefs() }
                    SwitchRow(Icons.Outlined.History, stringResource(R.string.save_history), null, model.saveHistory) { model.saveHistory = it; model.save() }
                    MenuRow(Icons.Outlined.Delete, stringResource(R.string.clear_data), stringResource(R.string.clear_data_desc)) { clearing = true }
                }
            }

            item { SectionLabel(stringResource(R.string.about_section)) }
            item {
                ListGroup {
                    ListItem(
                        headlineContent = { Text("Drift ${BuildConfig.VERSION_NAME}") },
                        supportingContent = { Text(stringResource(R.string.about_desc)) },
                        leadingContent = { Icon(Icons.Outlined.Info, null, tint = MaterialTheme.colorScheme.onSurfaceVariant) },
                        colors = rowColors,
                    )
                    val v = model.updateVersion
                    ListItem(
                        headlineContent = { Text(if (v != null) stringResource(R.string.update_available, v) else stringResource(R.string.up_to_date)) },
                        leadingContent = { Icon(Icons.Outlined.SystemUpdate, null, tint = MaterialTheme.colorScheme.onSurfaceVariant) },
                        trailingContent = if (v != null) ({ Button(onClick = { model.updateUrl?.let { model.newTab(it) }; onClose() }) { Text(stringResource(R.string.update_now)) } }) else null,
                        colors = rowColors,
                    )
                }
            }
        }
    }

    askMove?.let { kind ->
        AlertDialog(
            onDismissRequest = { askMove = null },
            icon = { EngineBadge(kind) },
            title = { Text(stringResource(R.string.engine_switch_title, stringResource(if (kind == EngineKind.GECKO) R.string.engine_gecko else R.string.engine_chromium))) },
            text = { Text(stringResource(R.string.engine_switch_body)) },
            confirmButton = { TextButton(onClick = { model.setDefaultEngine(kind, true); askMove = null }) { Text(stringResource(R.string.engine_move_all)) } },
            dismissButton = { TextButton(onClick = { model.setDefaultEngine(kind, false); askMove = null }) { Text(stringResource(R.string.engine_new_only)) } },
        )
    }
    if (pickSearch) {
        AlertDialog(
            onDismissRequest = { pickSearch = false },
            title = { Text(stringResource(R.string.search_engine)) },
            text = {
                Column {
                    SEARCH_ENGINES.forEach { e ->
                        Row(Modifier.fillMaxWidth().clickable { model.searchEngineId = e.id; model.applyPrefs(); pickSearch = false }.padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                            RadioButton(selected = model.searchEngineId == e.id, onClick = null)
                            Spacer(Modifier.width(12.dp))
                            Text(e.name, style = MaterialTheme.typography.bodyLarge)
                        }
                    }
                }
            },
            confirmButton = { TextButton(onClick = { pickSearch = false }) { Text(stringResource(R.string.done)) } },
        )
    }
    if (clearing) ClearDataDialog(model) { clearing = false }
}

@Composable
private fun ClearDataDialog(model: BrowserModel, onDone: () -> Unit) {
    var history by remember { mutableStateOf(true) }
    var cookies by remember { mutableStateOf(true) }
    var cache by remember { mutableStateOf(true) }
    AlertDialog(
        onDismissRequest = onDone,
        icon = { Icon(Icons.Outlined.Delete, null) },
        title = { Text(stringResource(R.string.clear_data)) },
        text = {
            Column {
                listOf(
                    Triple(R.string.clear_history, history) { v: Boolean -> history = v },
                    Triple(R.string.clear_cookies, cookies) { v: Boolean -> cookies = v },
                    Triple(R.string.clear_cache, cache) { v: Boolean -> cache = v },
                ).forEach { (label, value, set) ->
                    Row(Modifier.fillMaxWidth().clickable { set(!value) }.padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(checked = value, onCheckedChange = null)
                        Spacer(Modifier.width(12.dp))
                        Text(stringResource(label))
                    }
                }
            }
        },
        confirmButton = { Button(onClick = { model.clearData(history, cookies, cache); onDone() }) { Text(stringResource(R.string.clear)) } },
        dismissButton = { TextButton(onClick = onDone) { Text(stringResource(R.string.cancel)) } },
    )
}

// ---------------------------------------------------------------- history & bookmarks

@Composable
fun HistoryScreen(model: BrowserModel, onClose: () -> Unit) {
    val ctx = LocalContext.current
    var query by remember { mutableStateOf("") }
    var confirmClear by remember { mutableStateOf(false) }
    val list = model.library.history.filter { query.isBlank() || it.title.contains(query, true) || it.url.contains(query, true) }
    Page(stringResource(R.string.history), onClose, actions = {
        IconButton(onClick = { confirmClear = true }, enabled = model.library.history.isNotEmpty()) { Icon(Icons.Outlined.Delete, stringResource(R.string.clear_history)) }
    }) { pad ->
        LazyColumn(contentPadding = pad, verticalArrangement = Arrangement.spacedBy(2.dp)) {
            item { SearchField(query) { query = it } }
            if (list.isEmpty()) item { Empty(stringResource(R.string.history_empty)) }
            var lastDay = ""
            list.take(500).forEach { v ->
                val day = DateUtils.getRelativeTimeSpanString(v.time, System.currentTimeMillis(), DateUtils.DAY_IN_MILLIS).toString()
                if (day != lastDay) {
                    lastDay = day
                    item(key = "d$day${v.time}") { SectionLabel(day) }
                }
                item(key = "v${v.time}${v.url}") {
                    LibraryRow(v.title, v.url, DateUtils.formatDateTime(ctx, v.time, DateUtils.FORMAT_SHOW_TIME), onOpen = { model.navigate(v.url); onClose() }, onRemove = { model.library.removeVisit(v) })
                }
            }
        }
    }
    if (confirmClear) {
        AlertDialog(
            onDismissRequest = { confirmClear = false },
            title = { Text(stringResource(R.string.clear_history)) },
            text = { Text(stringResource(R.string.clear_history_body)) },
            confirmButton = { TextButton(onClick = { model.library.clearHistory(); confirmClear = false }) { Text(stringResource(R.string.clear)) } },
            dismissButton = { TextButton(onClick = { confirmClear = false }) { Text(stringResource(R.string.cancel)) } },
        )
    }
}

@Composable
fun BookmarksScreen(model: BrowserModel, onClose: () -> Unit) {
    var query by remember { mutableStateOf("") }
    val list = model.library.bookmarks.filter { query.isBlank() || it.title.contains(query, true) || it.url.contains(query, true) }
    Page(stringResource(R.string.bookmarks), onClose) { pad ->
        LazyColumn(contentPadding = pad, verticalArrangement = Arrangement.spacedBy(2.dp)) {
            item { SearchField(query) { query = it } }
            if (list.isEmpty()) item { Empty(stringResource(R.string.bookmarks_empty)) }
            items(list, key = { it.url }) { b ->
                LibraryRow(b.title, b.url, Url.display(b.url), onOpen = { model.navigate(b.url); onClose() }, onRemove = { model.library.removeBookmark(b) })
            }
        }
    }
}

@Composable
private fun SearchField(value: String, onChange: (String) -> Unit) {
    val c = MaterialTheme.colorScheme
    TextField(
        value = value, onValueChange = onChange, singleLine = true,
        placeholder = { Text(stringResource(R.string.search)) },
        leadingIcon = { Icon(Icons.Filled.Search, null) },
        shape = CircleShape,
        colors = TextFieldDefaults.colors(focusedContainerColor = c.surfaceContainerHighest, unfocusedContainerColor = c.surfaceContainerHighest, focusedIndicatorColor = Color.Transparent, unfocusedIndicatorColor = Color.Transparent),
        modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp),
    )
}

@Composable
private fun Empty(text: String) {
    Box(Modifier.fillMaxWidth().heightIn(min = 200.dp), contentAlignment = Alignment.Center) {
        Text(text, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun LibraryRow(title: String, url: String, supporting: String, onOpen: () -> Unit, onRemove: () -> Unit) {
    Surface(shape = MaterialTheme.shapes.large, color = MaterialTheme.colorScheme.surfaceContainerHigh) {
        ListItem(
            headlineContent = { Text(title.ifBlank { url }, maxLines = 1, overflow = TextOverflow.Ellipsis) },
            supportingContent = { Text(supporting, maxLines = 1, overflow = TextOverflow.Ellipsis) },
            leadingContent = { SiteIcon(null, url, 36) },
            trailingContent = { IconButton(onClick = onRemove) { Icon(Icons.Filled.Close, stringResource(R.string.remove)) } },
            colors = rowColors,
            modifier = Modifier.clickable(onClick = onOpen),
        )
    }
}

// ---------------------------------------------------------------- reader view

@Composable
fun ReaderScreen(model: BrowserModel, state: ReaderState, onClose: () -> Unit) {
    var size by remember { mutableFloatStateOf(18f) }
    var serif by remember { mutableStateOf(true) }
    val title = (state as? ReaderState.Ready)?.article?.site ?: stringResource(R.string.reader_view)
    Page(title, onClose, actions = {
        TextButton(onClick = { size = (size - 2).coerceAtLeast(12f) }) { Text("A−", fontSize = 14.sp) }
        TextButton(onClick = { size = (size + 2).coerceAtMost(30f) }) { Text("A+", fontSize = 18.sp) }
        TextButton(onClick = { serif = !serif }) { Text(if (serif) "Sans" else "Serif", fontFamily = if (serif) FontFamily.SansSerif else FontFamily.Serif) }
    }) { pad ->
        when (state) {
            ReaderState.Loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            ReaderState.Failed -> Box(Modifier.fillMaxSize().padding(pad), contentAlignment = Alignment.Center) {
                Text(stringResource(R.string.reader_failed), color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            is ReaderState.Ready -> {
                val a = state.article
                val font = if (serif) FontFamily.Serif else FontFamily.SansSerif
                val dir = if (a.rtl) LayoutDirection.Rtl else LocalLayoutDirection.current
                CompositionLocalProvider(LocalLayoutDirection provides dir) {
                    LazyColumn(contentPadding = PaddingValues(start = 22.dp, end = 22.dp, top = pad.calculateTopPadding(), bottom = 48.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                        item {
                            Text(a.title, style = MaterialTheme.typography.headlineMedium, fontFamily = font, fontWeight = FontWeight.SemiBold)
                            a.byline?.let { Text(it, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 8.dp)) }
                        }
                        items(a.blocks) { b ->
                            when (b) {
                                is ReaderBlock.Heading -> Text(b.text, fontFamily = font, fontWeight = FontWeight.SemiBold, fontSize = (size + 6 - b.level).sp, modifier = Modifier.padding(top = 8.dp))
                                is ReaderBlock.Paragraph -> Text(b.text, fontFamily = font, fontSize = size.sp, lineHeight = (size * 1.6f).sp)
                                is ReaderBlock.Item -> Row { Text("•  ", fontSize = size.sp); Text(b.text, fontFamily = font, fontSize = size.sp, lineHeight = (size * 1.5f).sp) }
                                is ReaderBlock.Quote -> Surface(color = MaterialTheme.colorScheme.secondaryContainer, shape = MaterialTheme.shapes.medium) {
                                    Text(b.text, fontFamily = font, fontStyle = FontStyle.Italic, fontSize = size.sp, lineHeight = (size * 1.5f).sp, modifier = Modifier.padding(14.dp))
                                }
                                // Images stay out of reader view: they would be fetched outside the engine.
                                is ReaderBlock.Image -> b.caption?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                            }
                        }
                    }
                }
            }
        }
    }
}

// ---------------------------------------------------------------- page dialogs

@Composable
fun PromptDialog(p: Prompt, onDone: () -> Unit) {
    when (p) {
        is Prompt.Alert -> AlertDialog(
            onDismissRequest = { p.done(); onDone() },
            title = p.title?.let { { Text(it) } },
            text = { Text(p.message) },
            confirmButton = { TextButton(onClick = { p.done(); onDone() }) { Text(stringResource(R.string.ok)) } },
        )
        is Prompt.Confirm -> AlertDialog(
            onDismissRequest = { p.result(false); onDone() },
            title = p.title?.let { { Text(it) } },
            text = { Text(p.message) },
            confirmButton = { TextButton(onClick = { p.result(true); onDone() }) { Text(stringResource(R.string.ok)) } },
            dismissButton = { TextButton(onClick = { p.result(false); onDone() }) { Text(stringResource(R.string.cancel)) } },
        )
        is Prompt.Text -> {
            var value by remember { mutableStateOf(p.default) }
            AlertDialog(
                onDismissRequest = { p.result(null); onDone() },
                title = p.title?.let { { Text(it) } },
                text = {
                    Column {
                        if (p.message.isNotEmpty()) Text(p.message, modifier = Modifier.padding(bottom = 12.dp))
                        OutlinedTextField(value = value, onValueChange = { value = it }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    }
                },
                confirmButton = { TextButton(onClick = { p.result(value); onDone() }) { Text(stringResource(R.string.ok)) } },
                dismissButton = { TextButton(onClick = { p.result(null); onDone() }) { Text(stringResource(R.string.cancel)) } },
            )
        }
        is Prompt.Choice -> {
            var picked by remember { mutableStateOf(p.selected) }
            AlertDialog(
                onDismissRequest = { p.result(null); onDone() },
                title = p.title?.takeIf { it.isNotBlank() }?.let { { Text(it) } },
                text = {
                    LazyColumn(Modifier.heightIn(max = 420.dp)) {
                        items(p.items) { (id, label) ->
                            Row(
                                Modifier.fillMaxWidth().clickable {
                                    if (p.multiple) picked = if (id in picked) picked - id else picked + id
                                    else { p.result(listOf(id)); onDone() }
                                }.padding(vertical = 6.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                if (p.multiple) Checkbox(checked = id in picked, onCheckedChange = null) else RadioButton(selected = id in picked, onClick = null)
                                Spacer(Modifier.width(12.dp))
                                Text(label)
                            }
                        }
                    }
                },
                confirmButton = { if (p.multiple) TextButton(onClick = { p.result(picked.toList()); onDone() }) { Text(stringResource(R.string.ok)) } },
                dismissButton = { TextButton(onClick = { p.result(null); onDone() }) { Text(stringResource(R.string.cancel)) } },
            )
        }
    }
}
