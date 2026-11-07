package app.drift.browser

import android.app.UiModeManager
import android.content.ComponentCallbacks2
import android.content.Context
import android.content.Intent
import android.graphics.Color as AndroidColor
import android.os.Build
import android.os.Bundle
import android.view.ViewGroup
import android.webkit.WebView
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
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
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.PushPin
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.Tab
import androidx.compose.material.icons.outlined.AccountCircle
import androidx.compose.material.icons.outlined.Computer
import androidx.compose.material.icons.outlined.DarkMode
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.LightMode
import androidx.compose.material.icons.outlined.Palette
import androidx.compose.material.icons.outlined.PhoneAndroid
import androidx.compose.material.icons.outlined.Public
import androidx.compose.material.icons.outlined.PushPin
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material.icons.outlined.Shield
import androidx.compose.material.icons.outlined.SystemUpdate
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.FilledTonalIconButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LargeTopAppBar
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
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
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView

class MainActivity : ComponentActivity() {
    private lateinit var model: BrowserModel

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        model = BrowserModel(this)
        applyNightMode(this, model.themeMode)
        handle(intent)
        model.checkForUpdate()
        setContent { DriftApp(model) }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handle(intent)
    }

    private fun handle(intent: Intent?) {
        when (intent?.action) {
            Intent.ACTION_VIEW -> intent.dataString?.let { model.openIncoming(it) }
            Intent.ACTION_WEB_SEARCH -> intent.getStringExtra("query")?.let { model.newTab(Url.normalize(it)) }
        }
    }

    override fun onPause() {
        super.onPause()
        model.save()
    }

    @Suppress("DEPRECATION")
    override fun onTrimMemory(level: Int) {
        super.onTrimMemory(level)
        if (level >= ComponentCallbacks2.TRIM_MEMORY_RUNNING_LOW) model.trimMemory()
    }
}

/** Tells Android (and so the web pages' prefers-color-scheme) which mode Drift uses. */
fun applyNightMode(ctx: Context, mode: Int) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return
    val ui = ctx.getSystemService(UiModeManager::class.java) ?: return
    ui.setApplicationNightMode(
        when (mode) {
            THEME_LIGHT -> UiModeManager.MODE_NIGHT_NO
            THEME_DARK -> UiModeManager.MODE_NIGHT_YES
            else -> UiModeManager.MODE_NIGHT_AUTO
        },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DriftApp(model: BrowserModel) {
    val space = model.spaces.firstOrNull { it.id == model.activeSpaceId }
    val seed = Color(space?.color ?: SPACE_COLORS[0])
    val dark = isDark(model.themeMode)
    val activity = LocalContext.current as ComponentActivity
    LaunchedEffect(dark) {
        val style = SystemBarStyle.auto(AndroidColor.TRANSPARENT, AndroidColor.TRANSPARENT) { dark }
        activity.enableEdgeToEdge(statusBarStyle = style, navigationBarStyle = style)
    }

    DriftTheme(model.themeMode, model.dynamicColor, seed) {
        val c = MaterialTheme.colorScheme
        var omnibox by remember { mutableStateOf(false) }
        var tabsOpen by remember { mutableStateOf(false) }
        var menuOpen by remember { mutableStateOf(false) }
        var findOpen by remember { mutableStateOf(false) }
        var settingsOpen by remember { mutableStateOf(false) }
        val tab = model.activeTab

        BackHandler(enabled = omnibox || findOpen || settingsOpen || tab?.canGoBack == true) {
            when {
                settingsOpen -> settingsOpen = false
                omnibox -> omnibox = false
                findOpen -> { tab?.webView?.clearMatches(); findOpen = false }
                else -> tab?.webView?.goBack()
            }
        }

        // A Surface (not a plain Box) so icons and text get the theme's content colour.
        Surface(color = c.surfaceContainer, modifier = Modifier.fillMaxSize()) { Box(Modifier.fillMaxSize()) {
            Column(Modifier.fillMaxSize().systemBarsPadding().imePadding()) {
                // The page floats on the surface with Material's large rounded corners.
                Box(Modifier.weight(1f).fillMaxWidth().padding(start = 8.dp, end = 8.dp, top = 4.dp).clip(MaterialTheme.shapes.large).background(c.surface)) {
                    if (tab != null) {
                        key(tab.id) {
                            AndroidView(
                                factory = { model.webViewFor(tab).also { (it.parent as? ViewGroup)?.removeView(it) } },
                                modifier = Modifier.fillMaxSize(),
                            )
                        }
                        if (tab.progress < 100) {
                            LinearProgressIndicator(progress = { tab.progress / 100f }, modifier = Modifier.fillMaxWidth().height(3.dp), color = c.primary, trackColor = c.primaryContainer)
                        }
                    }
                }
                AnimatedVisibility(findOpen && tab != null, enter = slideInVertically { it } + fadeIn(), exit = slideOutVertically { it } + fadeOut()) {
                    if (tab != null) FindBar(model, tab) { findOpen = false }
                }
                BottomBar(model, onAddress = { omnibox = true }, onTabs = { tabsOpen = true }, onMenu = { menuOpen = true })
            }
            AnimatedVisibility(omnibox, enter = fadeIn(), exit = fadeOut()) { Omnibox(model) { omnibox = false } }
            AnimatedVisibility(settingsOpen, enter = slideInVertically { it / 6 } + fadeIn(), exit = slideOutVertically { it / 6 } + fadeOut()) {
                SettingsScreen(model) { settingsOpen = false }
            }
        } }

        if (tabsOpen) {
            ModalBottomSheet(onDismissRequest = { tabsOpen = false }, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true), containerColor = c.surfaceContainerLow) {
                TabsSheet(model) { tabsOpen = false }
            }
        }
        if (menuOpen) {
            ModalBottomSheet(onDismissRequest = { menuOpen = false }, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true), containerColor = c.surfaceContainerLow) {
                MenuSheet(model, onDismiss = { menuOpen = false }, onFind = { findOpen = true }, onSettings = { settingsOpen = true })
            }
        }
    }
}

// ---------------------------------------------------------------- bottom bar

@Composable
private fun BottomBar(model: BrowserModel, onAddress: () -> Unit, onTabs: () -> Unit, onMenu: () -> Unit) {
    val tab = model.activeTab
    val c = MaterialTheme.colorScheme
    Row(Modifier.fillMaxWidth().height(72.dp).padding(horizontal = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        // Address field: a full-pill search bar, as in Material 3.
        Surface(onClick = onAddress, shape = CircleShape, color = c.surfaceContainerHighest, modifier = Modifier.weight(1f).height(52.dp)) {
            Row(Modifier.padding(start = 6.dp, end = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                val secure = tab?.url?.startsWith("https://") == true
                Box(Modifier.size(40.dp).clip(CircleShape), contentAlignment = Alignment.Center) {
                    Icon(if (secure) Icons.Filled.Lock else Icons.Outlined.Public, null, tint = c.onSurfaceVariant, modifier = Modifier.size(18.dp))
                }
                Text(
                    tab?.let { Url.display(it.url) } ?: stringResource(R.string.address_hint),
                    style = MaterialTheme.typography.bodyLarge, color = c.onSurface,
                    maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f),
                )
                if (model.adblockOn) {
                    Surface(shape = CircleShape, color = c.primaryContainer, contentColor = c.onPrimaryContainer) {
                        Row(Modifier.padding(horizontal = 10.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Filled.Shield, stringResource(R.string.adblock), modifier = Modifier.size(16.dp))
                            val blocked = tab?.blocked ?: 0
                            if (blocked > 0) {
                                Spacer(Modifier.width(4.dp))
                                Text(blocked.coerceAtMost(999).toString(), style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }
        Spacer(Modifier.width(6.dp))
        // Tab count in a rounded square, the way Android browsers show it.
        FilledTonalIconButton(onClick = onTabs, modifier = Modifier.size(48.dp)) {
            Box(Modifier.size(22.dp).border(2.dp, c.onSecondaryContainer, RoundedCornerShape(7.dp)), contentAlignment = Alignment.Center) {
                Text(model.tabsIn(model.activeSpaceId).size.coerceAtMost(99).toString(), style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
            }
        }
        IconButton(onClick = onMenu, modifier = Modifier.size(48.dp)) { Icon(Icons.Filled.MoreVert, stringResource(R.string.menu)) }
    }
}

// ---------------------------------------------------------------- menu sheet

@Composable
private fun MenuSheet(model: BrowserModel, onDismiss: () -> Unit, onFind: () -> Unit, onSettings: () -> Unit) {
    val tab = model.activeTab
    val ctx = LocalContext.current
    val c = MaterialTheme.colorScheme
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
            QuickAction(Icons.AutoMirrored.Filled.ArrowBack, stringResource(R.string.back), tab?.canGoBack == true) { tab?.webView?.goBack(); onDismiss() }
            QuickAction(Icons.AutoMirrored.Filled.ArrowForward, stringResource(R.string.forward), tab?.canGoForward == true) { tab?.webView?.goForward(); onDismiss() }
            QuickAction(Icons.Outlined.Refresh, stringResource(R.string.reload), tab != null) { tab?.webView?.reload(); onDismiss() }
            QuickAction(Icons.Outlined.Share, stringResource(R.string.share), tab != null) {
                tab?.let { ctx.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, it.url), null)) }
                onDismiss()
            }
        }
        ListGroup {
            MenuRow(Icons.Filled.Add, stringResource(R.string.new_tab)) { model.newTab(); onDismiss() }
            MenuRow(Icons.Filled.Search, stringResource(R.string.find_in_page)) { onFind(); onDismiss() }
            if (tab != null) {
                MenuRow(if (tab.pinned) Icons.Filled.PushPin else Icons.Outlined.PushPin, stringResource(if (tab.pinned) R.string.unpin else R.string.pin)) { tab.pinned = !tab.pinned; model.save(); onDismiss() }
            }
        }
        ListGroup {
            if (tab != null) {
                SwitchRow(Icons.Outlined.Computer, stringResource(R.string.desktop_site), null, tab.desktop) { model.setDesktop(tab, it) }
            }
            SwitchRow(
                Icons.Outlined.Shield, stringResource(R.string.adblock),
                if (tab != null && model.adblockOn) stringResource(R.string.blocked_count, tab.blocked) else null,
                model.adblockOn,
            ) { model.adblockOn = it; model.save(); tab?.webView?.reload() }
        }
        ListGroup {
            MenuRow(Icons.Outlined.AccountCircle, stringResource(R.string.sign_in_google)) { model.newTab("https://accounts.google.com/"); onDismiss() }
            MenuRow(Icons.Outlined.Settings, stringResource(R.string.settings)) { onSettings(); onDismiss() }
        }
    }
}

@Composable
private fun QuickAction(icon: ImageVector, label: String, enabled: Boolean, onClick: () -> Unit) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.width(76.dp)) {
        FilledTonalIconButton(onClick = onClick, enabled = enabled, modifier = Modifier.size(56.dp), shape = MaterialTheme.shapes.large) {
            Icon(icon, label)
        }
        Spacer(Modifier.height(6.dp))
        Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

/** Material 3 grouped list: one rounded container, thin gaps between rows. */
@Composable
private fun ListGroup(content: @Composable () -> Unit) {
    Surface(shape = MaterialTheme.shapes.large, color = MaterialTheme.colorScheme.surfaceContainerHigh, modifier = Modifier.fillMaxWidth()) {
        Column { content() }
    }
}

private val rowColors @Composable get() = ListItemDefaults.colors(containerColor = Color.Transparent)

@Composable
private fun MenuRow(icon: ImageVector, label: String, onClick: () -> Unit) {
    ListItem(
        headlineContent = { Text(label) },
        leadingContent = { Icon(icon, null, tint = MaterialTheme.colorScheme.onSurfaceVariant) },
        colors = rowColors,
        modifier = Modifier.clickable(onClick = onClick),
    )
}

@Composable
private fun SwitchRow(icon: ImageVector?, label: String, supporting: String?, checked: Boolean, enabled: Boolean = true, onChange: (Boolean) -> Unit) {
    ListItem(
        headlineContent = { Text(label) },
        supportingContent = supporting?.let { { Text(it) } },
        leadingContent = icon?.let { { Icon(it, null, tint = MaterialTheme.colorScheme.onSurfaceVariant) } },
        trailingContent = { Switch(checked = checked, onCheckedChange = null, enabled = enabled) },
        colors = rowColors,
        modifier = Modifier.clickable(enabled = enabled) { onChange(!checked) },
    )
}

// ---------------------------------------------------------------- settings

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SettingsScreen(model: BrowserModel, onClose: () -> Unit) {
    val ctx = LocalContext.current
    val scroll = TopAppBarDefaults.exitUntilCollapsedScrollBehavior()
    Scaffold(
        modifier = Modifier.fillMaxSize().nestedScroll(scroll.nestedScrollConnection),
        containerColor = MaterialTheme.colorScheme.surfaceContainer,
        topBar = {
            LargeTopAppBar(
                title = { Text(stringResource(R.string.settings)) },
                navigationIcon = { IconButton(onClick = onClose) { Icon(Icons.AutoMirrored.Filled.ArrowBack, stringResource(R.string.back)) } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surfaceContainer, scrolledContainerColor = MaterialTheme.colorScheme.surfaceContainer),
                scrollBehavior = scroll,
            )
        },
    ) { pad ->
        LazyColumn(contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = pad.calculateTopPadding(), bottom = pad.calculateBottomPadding() + 24.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
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
                                    onClick = { model.themeMode = mode; model.save(); applyNightMode(ctx, mode) },
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
                }
            }
            item { SectionLabel(stringResource(R.string.privacy)) }
            item {
                ListGroup {
                    SwitchRow(Icons.Outlined.Shield, stringResource(R.string.adblock), stringResource(R.string.adblock_desc), model.adblockOn) {
                        model.adblockOn = it; model.save(); model.activeTab?.webView?.reload()
                    }
                }
            }
            item { SectionLabel(stringResource(R.string.about_section)) }
            item {
                ListGroup {
                    val chromium = WebView.getCurrentWebViewPackage()?.versionName ?: "?"
                    ListItem(
                        headlineContent = { Text("Drift ${BuildConfig.VERSION_NAME}") },
                        supportingContent = { Text(stringResource(R.string.chromium_version, chromium)) },
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
}

@Composable
private fun SectionLabel(text: String) {
    Text(text, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(start = 16.dp, top = 16.dp, bottom = 4.dp))
}

// ---------------------------------------------------------------- address entry

@Composable
private fun Omnibox(model: BrowserModel, onClose: () -> Unit) {
    val c = MaterialTheme.colorScheme
    val current = model.activeTab?.url ?: ""
    var text by remember { mutableStateOf(TextFieldValue(current, TextRange(0, current.length))) }
    val focus = remember { FocusRequester() }
    LaunchedEffect(Unit) { focus.requestFocus() }
    val q = text.text.trim()
    val matches = model.tabs.filter { q.isNotEmpty() && it.id != model.activeTabId && (it.title.contains(q, true) || it.url.contains(q, true)) }.take(6)
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
                        Suggestion(if (url) Icons.Outlined.Public else Icons.Filled.Search, q, stringResource(if (url) R.string.open else R.string.search_with)) { go(q) }
                    }
                }
                items(matches) { t ->
                    Suggestion(Icons.Filled.Tab, t.title, stringResource(R.string.switch_to_tab)) {
                        model.activate(t)
                        onClose()
                    }
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
        supportingContent = { Text(hint) },
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
private fun FindBar(model: BrowserModel, tab: Tab, onClose: () -> Unit) {
    val c = MaterialTheme.colorScheme
    var text by remember { mutableStateOf("") }
    val focus = remember { FocusRequester() }
    LaunchedEffect(Unit) { focus.requestFocus() }
    Surface(shape = CircleShape, color = c.surfaceContainerHighest, modifier = Modifier.fillMaxWidth().padding(start = 8.dp, end = 8.dp, top = 8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            TextField(
                value = text,
                onValueChange = { text = it; tab.webView?.findAllAsync(it) },
                singleLine = true,
                placeholder = { Text(stringResource(R.string.find_in_page)) },
                leadingIcon = { Icon(Icons.Filled.Search, null) },
                colors = TextFieldDefaults.colors(focusedContainerColor = Color.Transparent, unfocusedContainerColor = Color.Transparent, focusedIndicatorColor = Color.Transparent, unfocusedIndicatorColor = Color.Transparent),
                modifier = Modifier.weight(1f).focusRequester(focus),
            )
            if (text.isNotEmpty()) Text(stringResource(R.string.find_count, model.findActive, model.findMatches), style = MaterialTheme.typography.labelMedium, color = c.onSurfaceVariant, modifier = Modifier.padding(horizontal = 4.dp))
            IconButton(onClick = { tab.webView?.findNext(false) }) { Icon(Icons.Filled.KeyboardArrowUp, null) }
            IconButton(onClick = { tab.webView?.findNext(true) }) { Icon(Icons.Filled.KeyboardArrowDown, null) }
            IconButton(onClick = { tab.webView?.clearMatches(); onClose() }) { Icon(Icons.Filled.Close, null) }
        }
    }
}

// ---------------------------------------------------------------- tabs

@Composable
private fun TabsSheet(model: BrowserModel, onDone: () -> Unit) {
    val c = MaterialTheme.colorScheme
    val newSpaceName = stringResource(R.string.space_default, model.spaces.size + 1)
    val list = model.tabsIn(model.activeSpaceId)
    Box(Modifier.fillMaxWidth().navigationBarsPadding()) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(stringResource(R.string.tabs), style = MaterialTheme.typography.headlineSmall, modifier = Modifier.weight(1f))
                TextButton(onClick = { model.closeAllIn(model.activeSpaceId) }) { Text(stringResource(R.string.close_all)) }
            }
            Spacer(Modifier.height(8.dp))
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
            Spacer(Modifier.height(12.dp))
            LazyVerticalGrid(
                columns = GridCells.Fixed(2),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
                contentPadding = PaddingValues(bottom = 88.dp),
                modifier = Modifier.height(460.dp),
            ) {
                items(list, key = { it.id }) { t ->
                    TabCard(t, selected = t.id == model.activeTabId, onOpen = { model.activate(t); onDone() }, onClose = { model.close(t) })
                }
            }
        }
        ExtendedFloatingActionButton(
            onClick = { model.newTab(); onDone() },
            icon = { Icon(Icons.Filled.Add, null) },
            text = { Text(stringResource(R.string.new_tab)) },
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
                Box(Modifier.size(28.dp).clip(CircleShape).background(c.surfaceContainerLowest), contentAlignment = Alignment.Center) {
                    t.icon?.let { Image(it.asImageBitmap(), null, Modifier.size(16.dp)) }
                        ?: Icon(Icons.Outlined.Public, null, tint = c.onSurfaceVariant, modifier = Modifier.size(16.dp))
                }
                if (t.pinned) {
                    Spacer(Modifier.width(6.dp))
                    Icon(Icons.Filled.PushPin, stringResource(R.string.pinned), tint = c.primary, modifier = Modifier.size(14.dp))
                }
                Spacer(Modifier.weight(1f))
                IconButton(onClick = onClose, modifier = Modifier.size(40.dp)) { Icon(Icons.Filled.Close, stringResource(R.string.close_tab), Modifier.size(18.dp)) }
            }
            Spacer(Modifier.height(4.dp))
            Text(t.title, style = MaterialTheme.typography.titleSmall, maxLines = 2, overflow = TextOverflow.Ellipsis, modifier = Modifier.height(40.dp).padding(end = 10.dp))
            Text(Url.host(t.url), style = MaterialTheme.typography.bodySmall, color = c.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}
