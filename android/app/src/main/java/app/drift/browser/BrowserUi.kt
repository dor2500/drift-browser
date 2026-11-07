package app.drift.browser

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.automirrored.outlined.ChromeReaderMode
import androidx.compose.material.icons.automirrored.outlined.OpenInNew
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.PushPin
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.Tab
import androidx.compose.material.icons.outlined.AccountCircle
import androidx.compose.material.icons.outlined.AddToHomeScreen
import androidx.compose.material.icons.outlined.Bookmarks
import androidx.compose.material.icons.outlined.Computer
import androidx.compose.material.icons.outlined.ContentCopy
import androidx.compose.material.icons.outlined.Download
import androidx.compose.material.icons.outlined.History
import androidx.compose.material.icons.outlined.Image
import androidx.compose.material.icons.outlined.Print
import androidx.compose.material.icons.outlined.Public
import androidx.compose.material.icons.outlined.PushPin
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material.icons.outlined.Shield
import androidx.compose.material.icons.outlined.StarOutline
import androidx.compose.material.icons.outlined.SystemUpdate
import androidx.compose.material.icons.outlined.Translate
import androidx.compose.material.icons.outlined.VisibilityOff
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.FilledTonalIconButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// ---------------------------------------------------------------- shared pieces

/** Material 3 grouped list: one rounded container, rows inside. */
@Composable
fun ListGroup(content: @Composable () -> Unit) {
    Surface(shape = MaterialTheme.shapes.large, color = MaterialTheme.colorScheme.surfaceContainerHigh, modifier = Modifier.fillMaxWidth()) {
        Column { content() }
    }
}

val rowColors @Composable get() = ListItemDefaults.colors(containerColor = Color.Transparent)

@Composable
fun MenuRow(icon: ImageVector, label: String, supporting: String? = null, trailing: (@Composable () -> Unit)? = null, onClick: () -> Unit) {
    ListItem(
        headlineContent = { Text(label) },
        supportingContent = supporting?.let { { Text(it) } },
        leadingContent = { Icon(icon, null, tint = MaterialTheme.colorScheme.onSurfaceVariant) },
        trailingContent = trailing,
        colors = rowColors,
        modifier = Modifier.clickable(onClick = onClick),
    )
}

@Composable
fun SwitchRow(icon: ImageVector?, label: String, supporting: String?, checked: Boolean, enabled: Boolean = true, onChange: (Boolean) -> Unit) {
    ListItem(
        headlineContent = { Text(label) },
        supportingContent = supporting?.let { { Text(it) } },
        leadingContent = icon?.let { { Icon(it, null, tint = MaterialTheme.colorScheme.onSurfaceVariant) } },
        trailingContent = { Switch(checked = checked, onCheckedChange = null, enabled = enabled) },
        colors = rowColors,
        modifier = Modifier.clickable(enabled = enabled) { onChange(!checked) },
    )
}

@Composable
fun SectionLabel(text: String) {
    Text(text, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(start = 16.dp, top = 16.dp, bottom = 4.dp))
}

@Composable
fun SiteIcon(icon: android.graphics.Bitmap?, url: String, size: Int = 28) {
    val c = MaterialTheme.colorScheme
    Box(Modifier.size(size.dp).clip(CircleShape).background(c.surfaceContainerLowest), contentAlignment = Alignment.Center) {
        if (icon != null) Image(icon.asImageBitmap(), null, Modifier.size((size * 0.58f).dp))
        else {
            val letter = Url.host(url).firstOrNull()?.uppercaseChar()?.toString()
            if (letter != null) Text(letter, style = MaterialTheme.typography.titleSmall, color = c.primary)
            else Icon(Icons.Outlined.Public, null, tint = c.onSurfaceVariant, modifier = Modifier.size((size * 0.58f).dp))
        }
    }
}

/** Chromium / Gecko picker. */
@Composable
fun EnginePicker(selected: EngineKind, onPick: (EngineKind) -> Unit) {
    SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
        EngineKind.entries.forEachIndexed { i, kind ->
            SegmentedButton(
                selected = selected == kind,
                onClick = { onPick(kind) },
                shape = SegmentedButtonDefaults.itemShape(i, EngineKind.entries.size),
                icon = { EngineBadge(kind) },
            ) { Text(stringResource(if (kind == EngineKind.GECKO) R.string.engine_gecko else R.string.engine_chromium), maxLines = 1) }
        }
    }
}

// ---------------------------------------------------------------- bottom bar

@Composable
fun BottomBar(model: BrowserModel, onAddress: () -> Unit, onTabs: () -> Unit, onMenu: () -> Unit) {
    val tab = model.activeTab
    val c = MaterialTheme.colorScheme
    Row(Modifier.fillMaxWidth().height(72.dp).padding(horizontal = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        // Address field: a full-pill search bar, as in Material 3.
        Surface(onClick = onAddress, shape = CircleShape, color = c.surfaceContainerHighest, modifier = Modifier.weight(1f).height(52.dp)) {
            Row(Modifier.padding(start = 6.dp, end = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(40.dp), contentAlignment = Alignment.Center) {
                    when {
                        tab?.private == true -> Icon(Icons.Outlined.VisibilityOff, stringResource(R.string.private_tab), tint = c.onSurfaceVariant, modifier = Modifier.size(20.dp))
                        tab?.url?.startsWith("https://") == true -> Icon(Icons.Filled.Lock, null, tint = c.onSurfaceVariant, modifier = Modifier.size(18.dp))
                        tab == null || Url.isHome(tab.url) -> Icon(Icons.Filled.Search, null, tint = c.onSurfaceVariant, modifier = Modifier.size(20.dp))
                        else -> Icon(Icons.Outlined.Public, null, tint = c.onSurfaceVariant, modifier = Modifier.size(18.dp))
                    }
                }
                val shown = tab?.let { Url.display(it.url) }.orEmpty()
                Text(
                    shown.ifEmpty { stringResource(R.string.address_hint) },
                    style = MaterialTheme.typography.bodyLarge, color = if (shown.isEmpty()) c.onSurfaceVariant else c.onSurface,
                    maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f),
                )
                if (tab != null) {
                    EngineBadge(tab.engineKind)
                    Spacer(Modifier.width(6.dp))
                }
                if (model.adblockOn && tab != null && !Url.isHome(tab.url)) {
                    Surface(shape = CircleShape, color = c.primaryContainer, contentColor = c.onPrimaryContainer) {
                        Row(Modifier.padding(horizontal = 10.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Filled.Shield, stringResource(R.string.adblock), modifier = Modifier.size(16.dp))
                            if (tab.blocked > 0) {
                                Spacer(Modifier.width(4.dp))
                                Text(tab.blocked.coerceAtMost(999).toString(), style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }
        Spacer(Modifier.width(6.dp))
        // Tab count in a rounded square, the way Android browsers show it.
        val count = if (tab?.private == true) model.privateTabs.size else model.tabsIn(model.activeSpaceId).size
        FilledTonalIconButton(onClick = onTabs, modifier = Modifier.size(48.dp)) {
            Box(Modifier.size(22.dp).border(2.dp, c.onSecondaryContainer, RoundedCornerShape(7.dp)), contentAlignment = Alignment.Center) {
                Text(count.coerceAtMost(99).toString(), style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
            }
        }
        IconButton(onClick = onMenu, modifier = Modifier.size(48.dp)) { Icon(Icons.Filled.MoreVert, stringResource(R.string.menu)) }
    }
}

// ---------------------------------------------------------------- menu sheet

@Composable
fun MenuSheet(model: BrowserModel, onDismiss: () -> Unit, onFind: () -> Unit, onScreen: (Screen) -> Unit) {
    val tab = model.activeTab
    val c = MaterialTheme.colorScheme
    val page = tab != null && !Url.isHome(tab.url)
    Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        model.updateVersion?.let { v ->
            Card(colors = CardDefaults.cardColors(containerColor = c.tertiaryContainer, contentColor = c.onTertiaryContainer), shape = MaterialTheme.shapes.large) {
                Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Outlined.SystemUpdate, null)
                    Spacer(Modifier.width(12.dp))
                    Text(stringResource(R.string.update_available, v), style = MaterialTheme.typography.titleSmall, modifier = Modifier.weight(1f))
                    Button(onClick = { model.updateUrl?.let { model.newTab(it) }; onDismiss() }) { Text(stringResource(R.string.update_now)) }
                }
            }
        }
        // Quick actions: big tonal buttons with labels.
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
            QuickAction(Icons.AutoMirrored.Filled.ArrowBack, stringResource(R.string.back), tab?.canGoBack == true) { tab?.engine?.goBack(); onDismiss() }
            QuickAction(Icons.AutoMirrored.Filled.ArrowForward, stringResource(R.string.forward), tab?.canGoForward == true) { tab?.engine?.goForward(); onDismiss() }
            val starred = tab != null && model.library.isBookmarked(tab.url)
            QuickAction(if (starred) Icons.Filled.Star else Icons.Outlined.StarOutline, stringResource(if (starred) R.string.bookmarked else R.string.bookmark), page && tab?.private == false) { tab?.let { model.toggleBookmark(it) } }
            QuickAction(Icons.Outlined.Refresh, stringResource(R.string.reload), page) { tab?.engine?.reload(); onDismiss() }
            QuickAction(Icons.Outlined.Share, stringResource(R.string.share), page) { tab?.let { model.share(it.url) }; onDismiss() }
        }
        // The engine this tab runs on; switching reloads the page in the other engine.
        if (tab != null) {
            ListGroup {
                Column(Modifier.padding(16.dp)) {
                    Text(stringResource(R.string.engine_this_tab), style = MaterialTheme.typography.titleSmall)
                    Spacer(Modifier.height(10.dp))
                    EnginePicker(tab.engineKind) { model.setTabEngine(tab, it) }
                }
            }
        }
        ListGroup {
            MenuRow(Icons.Filled.Add, stringResource(R.string.new_tab)) { model.newTab(); onDismiss() }
            MenuRow(Icons.Outlined.VisibilityOff, stringResource(R.string.new_private_tab)) { model.newTab(private = true); onDismiss() }
            MenuRow(Icons.Outlined.History, stringResource(R.string.history)) { onScreen(Screen.HISTORY); onDismiss() }
            MenuRow(Icons.Outlined.Bookmarks, stringResource(R.string.bookmarks)) { onScreen(Screen.BOOKMARKS); onDismiss() }
        }
        if (page && tab != null) {
            ListGroup {
                MenuRow(Icons.Filled.Search, stringResource(R.string.find_in_page)) { onFind(); onDismiss() }
                MenuRow(Icons.AutoMirrored.Outlined.ChromeReaderMode, stringResource(R.string.reader_view)) { model.openReader(tab); onDismiss() }
                MenuRow(Icons.Outlined.Translate, stringResource(R.string.translate)) { model.translate(tab); onDismiss() }
                MenuRow(Icons.Outlined.Print, stringResource(R.string.print)) { model.print(tab); onDismiss() }
                MenuRow(Icons.Outlined.AddToHomeScreen, stringResource(R.string.add_to_home)) { model.addToHomeScreen(tab); onDismiss() }
                if (!tab.private) MenuRow(if (tab.pinned) Icons.Filled.PushPin else Icons.Outlined.PushPin, stringResource(if (tab.pinned) R.string.unpin else R.string.pin)) { tab.pinned = !tab.pinned; model.save(); onDismiss() }
            }
        }
        ListGroup {
            if (tab != null) SwitchRow(Icons.Outlined.Computer, stringResource(R.string.desktop_site), null, tab.desktop) { model.setDesktop(tab, it) }
            SwitchRow(
                Icons.Outlined.Shield, stringResource(R.string.adblock),
                if (tab != null && page && model.adblockOn) stringResource(R.string.blocked_count, tab.blocked) else null,
                model.adblockOn,
            ) { model.adblockOn = it; model.applyPrefs(); tab?.engine?.reload() }
        }
        ListGroup {
            MenuRow(Icons.Outlined.AccountCircle, stringResource(R.string.sign_in_google)) { model.newTab("https://accounts.google.com/"); onDismiss() }
            MenuRow(Icons.Outlined.Settings, stringResource(R.string.settings)) { onScreen(Screen.SETTINGS); onDismiss() }
        }
    }
}

@Composable
private fun QuickAction(icon: ImageVector, label: String, enabled: Boolean, onClick: () -> Unit) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.width(66.dp)) {
        FilledTonalIconButton(onClick = onClick, enabled = enabled, modifier = Modifier.size(52.dp), shape = MaterialTheme.shapes.large) {
            Icon(icon, label)
        }
        Spacer(Modifier.height(6.dp))
        Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

// ---------------------------------------------------------------- start page

/** Drift's own new-tab page: a search pill, your most-visited sites and bookmarks. */
@Composable
fun StartPage(model: BrowserModel, onSearch: () -> Unit, onOpenLibrary: (Screen) -> Unit) {
    val c = MaterialTheme.colorScheme
    val tab = model.activeTab
    val private = tab?.private == true
    val top = if (private) emptyList() else model.library.topSites(8)
    val marks = if (private) emptyList() else model.library.bookmarks.take(8)
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        item { Spacer(Modifier.height(48.dp)) }
        item {
            if (private) {
                Icon(Icons.Outlined.VisibilityOff, null, tint = c.primary, modifier = Modifier.size(56.dp))
                Spacer(Modifier.height(12.dp))
                Text(stringResource(R.string.private_tab), style = MaterialTheme.typography.headlineMedium)
                Spacer(Modifier.height(8.dp))
                Text(stringResource(R.string.private_explain), style = MaterialTheme.typography.bodyMedium, color = c.onSurfaceVariant, textAlign = TextAlign.Center)
            } else {
                Text("Drift", style = MaterialTheme.typography.displayMedium, color = c.primary, fontWeight = FontWeight.Medium)
            }
            Spacer(Modifier.height(28.dp))
        }
        item {
            Surface(onClick = onSearch, shape = CircleShape, color = c.surfaceContainerHigh, modifier = Modifier.fillMaxWidth().height(56.dp)) {
                Row(Modifier.padding(horizontal = 18.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Filled.Search, null, tint = c.onSurfaceVariant)
                    Spacer(Modifier.width(12.dp))
                    Text(stringResource(R.string.search_with_engine, Url.search.name), color = c.onSurfaceVariant, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
                    if (tab != null) EngineBadge(tab.engineKind)
                }
            }
            Spacer(Modifier.height(28.dp))
        }
        if (top.isNotEmpty()) {
            item { Tiles(top.map { Triple(it.url, it.title, null) }, model) }
        }
        if (marks.isNotEmpty()) {
            item {
                Row(Modifier.fillMaxWidth().padding(top = 20.dp, bottom = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(stringResource(R.string.bookmarks), style = MaterialTheme.typography.titleSmall, modifier = Modifier.weight(1f))
                    TextButton(onClick = { onOpenLibrary(Screen.BOOKMARKS) }) { Text(stringResource(R.string.see_all)) }
                }
            }
            item { Tiles(marks.map { Triple(it.url, it.title, null) }, model) }
        }
    }
}

@Composable
private fun Tiles(items: List<Triple<String, String, Any?>>, model: BrowserModel) {
    val c = MaterialTheme.colorScheme
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        items.chunked(4).forEach { row ->
            Row(Modifier.fillMaxWidth()) {
                row.forEach { (url, title, _) ->
                    Column(
                        Modifier.weight(1f).clip(MaterialTheme.shapes.medium).clickable { model.navigate(url) }.padding(vertical = 10.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Box(Modifier.size(52.dp).clip(MaterialTheme.shapes.large).background(c.secondaryContainer), contentAlignment = Alignment.Center) {
                            Text(Url.host(url).firstOrNull()?.uppercaseChar()?.toString() ?: "?", style = MaterialTheme.typography.titleLarge, color = c.onSecondaryContainer)
                        }
                        Spacer(Modifier.height(6.dp))
                        Text(title.ifBlank { Url.host(url) }, style = MaterialTheme.typography.labelMedium, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(horizontal = 4.dp))
                    }
                }
                repeat(4 - row.size) { Spacer(Modifier.weight(1f)) }
            }
        }
    }
}

// ---------------------------------------------------------------- address entry

@Composable
fun Omnibox(model: BrowserModel, onClose: () -> Unit) {
    val c = MaterialTheme.colorScheme
    val current = model.activeTab?.url?.takeIf { !Url.isHome(it) } ?: ""
    var text by remember { mutableStateOf(TextFieldValue(current, TextRange(0, current.length))) }
    val focus = remember { FocusRequester() }
    LaunchedEffect(Unit) { focus.requestFocus() }
    val q = text.text.trim()
    val tabMatches = model.tabs.filter { q.isNotEmpty() && it.id != model.activeTabId && (it.title.contains(q, true) || it.url.contains(q, true)) }.take(4)
    val libMatches = if (model.activeTab?.private == true) emptyList() else model.library.suggest(q, 6).filter { v -> tabMatches.none { it.url == v.url } }
    val go = { input: String ->
        if (input.isNotBlank()) model.navigate(input)
        onClose()
    }
    Surface(color = c.surfaceContainer, modifier = Modifier.fillMaxSize()) {
        Column(Modifier.fillMaxSize().systemBarsPadding().imePadding().padding(12.dp)) {
            // Suggestions sit just above the field, within thumb reach.
            LazyColumn(Modifier.weight(1f), reverseLayout = true, verticalArrangement = Arrangement.spacedBy(2.dp)) {
                if (q.isNotEmpty()) {
                    item {
                        val url = Url.looksLikeUrl(q)
                        Suggestion(if (url) Icons.Outlined.Public else Icons.Filled.Search, q, if (url) stringResource(R.string.open) else stringResource(R.string.search_with_engine, Url.search.name)) { go(q) }
                    }
                }
                items(tabMatches) { t ->
                    Suggestion(Icons.Filled.Tab, t.title, stringResource(R.string.switch_to_tab)) {
                        model.activate(t)
                        onClose()
                    }
                }
                items(libMatches) { v ->
                    Suggestion(if (model.library.isBookmarked(v.url)) Icons.Filled.Star else Icons.Outlined.History, v.title.ifBlank { v.url }, Url.display(v.url)) { go(v.url) }
                }
            }
            Spacer(Modifier.height(8.dp))
            TextField(
                value = text,
                onValueChange = { text = it },
                singleLine = true,
                placeholder = { Text(stringResource(R.string.address_hint)) },
                leadingIcon = { IconButton(onClick = onClose) { Icon(Icons.AutoMirrored.Filled.ArrowBack, stringResource(R.string.back)) } },
                trailingIcon = if (text.text.isNotEmpty()) ({ IconButton(onClick = { text = TextFieldValue("") }) { Icon(Icons.Filled.Close, null) } }) else null,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri, imeAction = ImeAction.Go),
                keyboardActions = KeyboardActions(onGo = { go(text.text) }),
                shape = CircleShape,
                textStyle = MaterialTheme.typography.bodyLarge,
                colors = TextFieldDefaults.colors(
                    focusedContainerColor = c.surfaceContainerHighest,
                    unfocusedContainerColor = c.surfaceContainerHighest,
                    focusedIndicatorColor = Color.Transparent,
                    unfocusedIndicatorColor = Color.Transparent,
                ),
                modifier = Modifier.fillMaxWidth().height(56.dp).focusRequester(focus),
            )
        }
    }
}

@Composable
private fun Suggestion(icon: ImageVector, label: String, hint: String, onClick: () -> Unit) {
    val c = MaterialTheme.colorScheme
    ListItem(
        headlineContent = { Text(label, maxLines = 1, overflow = TextOverflow.Ellipsis) },
        supportingContent = { Text(hint, maxLines = 1, overflow = TextOverflow.Ellipsis) },
        leadingContent = {
            Box(Modifier.size(40.dp).clip(CircleShape).background(c.secondaryContainer), contentAlignment = Alignment.Center) {
                Icon(icon, null, tint = c.onSecondaryContainer, modifier = Modifier.size(20.dp))
            }
        },
        colors = ListItemDefaults.colors(containerColor = Color.Transparent),
        modifier = Modifier.clip(MaterialTheme.shapes.large).clickable(onClick = onClick),
    )
}

// ---------------------------------------------------------------- find in page

@Composable
fun FindBar(model: BrowserModel, tab: Tab, onClose: () -> Unit) {
    val c = MaterialTheme.colorScheme
    var text by remember { mutableStateOf("") }
    val focus = remember { FocusRequester() }
    LaunchedEffect(Unit) { focus.requestFocus() }
    Surface(shape = CircleShape, color = c.surfaceContainerHighest, modifier = Modifier.fillMaxWidth().padding(start = 8.dp, end = 8.dp, top = 8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            TextField(
                value = text,
                onValueChange = { text = it; tab.engine?.find(it) },
                singleLine = true,
                placeholder = { Text(stringResource(R.string.find_in_page)) },
                leadingIcon = { Icon(Icons.Filled.Search, null) },
                colors = TextFieldDefaults.colors(focusedContainerColor = Color.Transparent, unfocusedContainerColor = Color.Transparent, focusedIndicatorColor = Color.Transparent, unfocusedIndicatorColor = Color.Transparent),
                modifier = Modifier.weight(1f).focusRequester(focus),
            )
            if (text.isNotEmpty()) Text(stringResource(R.string.find_count, model.findActive, model.findMatches), style = MaterialTheme.typography.labelMedium, color = c.onSurfaceVariant, modifier = Modifier.padding(horizontal = 4.dp))
            IconButton(onClick = { tab.engine?.findNext(false) }) { Icon(Icons.Filled.KeyboardArrowUp, null) }
            IconButton(onClick = { tab.engine?.findNext(true) }) { Icon(Icons.Filled.KeyboardArrowDown, null) }
            IconButton(onClick = { tab.engine?.clearFind(); onClose() }) { Icon(Icons.Filled.Close, null) }
        }
    }
}

// ---------------------------------------------------------------- tabs

@Composable
fun TabsSheet(model: BrowserModel, onDone: () -> Unit) {
    val c = MaterialTheme.colorScheme
    val newSpaceName = stringResource(R.string.space_default, model.spaces.size + 1)
    val private = model.showPrivate
    val list = if (private) model.privateTabs else model.tabsIn(model.activeSpaceId)
    Box(Modifier.fillMaxWidth().navigationBarsPadding()) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
            // Normal and private tabs, like Chrome's and Firefox's tab switchers.
            SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                SegmentedButton(selected = !private, onClick = { model.showPrivate = false }, shape = SegmentedButtonDefaults.itemShape(0, 2), icon = { Icon(Icons.Filled.Tab, null, Modifier.size(18.dp)) }) {
                    Text(stringResource(R.string.tabs_count, model.tabs.count { !it.private }))
                }
                SegmentedButton(selected = private, onClick = { model.showPrivate = true }, shape = SegmentedButtonDefaults.itemShape(1, 2), icon = { Icon(Icons.Outlined.VisibilityOff, null, Modifier.size(18.dp)) }) {
                    Text(stringResource(R.string.private_count, model.privateTabs.size))
                }
            }
            Spacer(Modifier.height(12.dp))
            if (!private) {
                // Spaces, like Zen and Arc, as Material filter chips.
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    items(model.spaces) { s ->
                        FilterChip(
                            selected = s.id == model.activeSpaceId,
                            onClick = { model.switchSpace(s) },
                            label = { Text(s.name) },
                            leadingIcon = { Box(Modifier.size(12.dp).clip(CircleShape).background(Color(s.color))) },
                            shape = CircleShape,
                        )
                    }
                    item {
                        FilledTonalIconButton(onClick = { model.newSpace(newSpaceName) }, modifier = Modifier.size(36.dp)) { Icon(Icons.Filled.Add, stringResource(R.string.new_space), Modifier.size(18.dp)) }
                    }
                }
                Spacer(Modifier.height(4.dp))
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Spacer(Modifier.weight(1f))
                if (list.isNotEmpty()) {
                    TextButton(onClick = { if (private) model.closePrivate() else model.closeAllIn(model.activeSpaceId) }) {
                        Text(stringResource(if (private) R.string.close_private else R.string.close_all))
                    }
                }
            }
            if (private && list.isEmpty()) {
                Column(Modifier.fillMaxWidth().height(300.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                    Icon(Icons.Outlined.VisibilityOff, null, tint = c.onSurfaceVariant, modifier = Modifier.size(48.dp))
                    Spacer(Modifier.height(12.dp))
                    Text(stringResource(R.string.private_explain), color = c.onSurfaceVariant, textAlign = TextAlign.Center, modifier = Modifier.padding(horizontal = 24.dp))
                }
            } else {
                LazyVerticalGrid(
                    columns = GridCells.Fixed(2),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    contentPadding = PaddingValues(bottom = 88.dp),
                    modifier = Modifier.height(440.dp),
                ) {
                    items(list, key = { it.id }) { t ->
                        TabCard(t, selected = t.id == model.activeTabId, onOpen = { model.activate(t); onDone() }, onClose = { model.close(t) })
                    }
                }
            }
        }
        ExtendedFloatingActionButton(
            onClick = { model.newTab(private = private); onDone() },
            icon = { Icon(if (private) Icons.Outlined.VisibilityOff else Icons.Filled.Add, null) },
            text = { Text(stringResource(if (private) R.string.new_private_tab else R.string.new_tab)) },
            containerColor = c.primaryContainer,
            contentColor = c.onPrimaryContainer,
            modifier = Modifier.align(Alignment.BottomEnd).padding(16.dp),
        )
    }
}

@Composable
private fun TabCard(t: Tab, selected: Boolean, onOpen: () -> Unit, onClose: () -> Unit) {
    val c = MaterialTheme.colorScheme
    Card(
        onClick = onOpen,
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.cardColors(containerColor = if (selected) c.secondaryContainer else c.surfaceContainerHighest, contentColor = if (selected) c.onSecondaryContainer else c.onSurface),
        border = if (selected) BorderStroke(2.dp, c.primary) else null,
    ) {
        Column(Modifier.padding(start = 14.dp, top = 6.dp, end = 4.dp, bottom = 14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                SiteIcon(t.icon, t.url)
                Spacer(Modifier.width(6.dp))
                EngineBadge(t.engineKind)
                if (t.pinned) {
                    Spacer(Modifier.width(6.dp))
                    Icon(Icons.Filled.PushPin, stringResource(R.string.pinned), tint = c.primary, modifier = Modifier.size(14.dp))
                }
                Spacer(Modifier.weight(1f))
                IconButton(onClick = onClose, modifier = Modifier.size(40.dp)) { Icon(Icons.Filled.Close, stringResource(R.string.close_tab), Modifier.size(18.dp)) }
            }
            Spacer(Modifier.height(4.dp))
            Text(t.title.ifBlank { stringResource(R.string.new_tab) }, style = MaterialTheme.typography.titleSmall, maxLines = 2, overflow = TextOverflow.Ellipsis, modifier = Modifier.height(40.dp).padding(end = 10.dp))
            Text(Url.host(t.url).ifEmpty { "Drift" }, style = MaterialTheme.typography.bodySmall, color = c.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}

// ---------------------------------------------------------------- long-press menu

@Composable
fun ContextSheet(model: BrowserModel, target: ContextTarget, onDone: () -> Unit) {
    val tab = model.activeTab
    val c = MaterialTheme.colorScheme
    Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp).padding(bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(target.link ?: target.image ?: "", style = MaterialTheme.typography.bodyMedium, color = c.onSurfaceVariant, maxLines = 2, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(horizontal = 8.dp))
        target.link?.let { link ->
            ListGroup {
                MenuRow(Icons.AutoMirrored.Outlined.OpenInNew, stringResource(R.string.open_new_tab)) { model.newTab(link, private = tab?.private == true, activate = false); onDone() }
                MenuRow(Icons.Outlined.VisibilityOff, stringResource(R.string.open_private_tab)) { model.newTab(link, private = true); onDone() }
                MenuRow(Icons.Outlined.ContentCopy, stringResource(R.string.copy_link)) { model.copy(link); onDone() }
                MenuRow(Icons.Outlined.Share, stringResource(R.string.share_link)) { model.share(link); onDone() }
                MenuRow(Icons.Outlined.Download, stringResource(R.string.download_link)) { model.download(link); onDone() }
            }
        }
        target.image?.let { img ->
            ListGroup {
                MenuRow(Icons.Outlined.Image, stringResource(R.string.open_image)) { model.newTab(img, private = tab?.private == true); onDone() }
                MenuRow(Icons.Outlined.Download, stringResource(R.string.download_image)) { model.download(img); onDone() }
                MenuRow(Icons.Outlined.ContentCopy, stringResource(R.string.copy_image_link)) { model.copy(img); onDone() }
            }
        }
    }
}

