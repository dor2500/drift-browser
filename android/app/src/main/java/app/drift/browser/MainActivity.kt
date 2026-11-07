package app.drift.browser

import android.content.ComponentCallbacks2
import android.content.Intent
import android.os.Bundle
import android.view.ViewGroup
import android.webkit.WebView
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
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
import androidx.compose.material.icons.outlined.Public
import androidx.compose.material3.Checkbox
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.material3.darkColorScheme
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView

private val Bg = Color(0xFF0D0E15)
private val Surface1 = Color(0xFF171A26)
private val Surface2 = Color(0xFF22263A)
private val TextMain = Color(0xFFE8E8EE)
private val TextDim = Color(0xFF9EA2B5)

class MainActivity : ComponentActivity() {
    private lateinit var model: BrowserModel

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        model = BrowserModel(this)
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DriftApp(model: BrowserModel) {
    val space = model.spaces.firstOrNull { it.id == model.activeSpaceId }
    val accent = Color(space?.color ?: SPACE_COLORS[0])
    MaterialTheme(colorScheme = darkColorScheme(primary = accent, background = Bg, surface = Surface1, onSurface = TextMain, surfaceVariant = Surface2)) {
        var omnibox by remember { mutableStateOf(false) }
        var tabsOpen by remember { mutableStateOf(false) }
        var findOpen by remember { mutableStateOf(false) }
        val tab = model.activeTab

        BackHandler(enabled = omnibox || findOpen || tab?.canGoBack == true) {
            when {
                omnibox -> omnibox = false
                findOpen -> { tab?.webView?.clearMatches(); findOpen = false }
                else -> tab?.webView?.goBack()
            }
        }

        // Zen-style: the space colour glows behind a floating, rounded page.
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(accent.copy(alpha = 0.28f), Bg, Bg)))) {
            Column(Modifier.fillMaxSize().systemBarsPadding().imePadding()) {
                Box(Modifier.weight(1f).fillMaxWidth().padding(start = 6.dp, end = 6.dp, top = 6.dp).clip(RoundedCornerShape(16.dp)).background(Color.White)) {
                    if (tab != null) {
                        key(tab.id) {
                            AndroidView(
                                factory = { model.webViewFor(tab).also { (it.parent as? ViewGroup)?.removeView(it) } },
                                modifier = Modifier.fillMaxSize(),
                            )
                        }
                        if (tab.progress < 100) {
                            LinearProgressIndicator(progress = { tab.progress / 100f }, modifier = Modifier.fillMaxWidth().height(2.dp), color = accent, trackColor = Color.Transparent)
                        }
                    }
                }
                if (findOpen && tab != null) FindBar(model, tab) { findOpen = false }
                BottomBar(model, accent, onAddress = { omnibox = true }, onTabs = { tabsOpen = true }, onFind = { findOpen = true })
            }
            if (omnibox) Omnibox(model, accent) { omnibox = false }
        }

        if (tabsOpen) {
            val sheet = rememberModalBottomSheetState(skipPartiallyExpanded = true)
            ModalBottomSheet(onDismissRequest = { tabsOpen = false }, sheetState = sheet, containerColor = Surface1) {
                TabsSheet(model, accent) { tabsOpen = false }
            }
        }
    }
}

@Composable
private fun BottomBar(model: BrowserModel, accent: Color, onAddress: () -> Unit, onTabs: () -> Unit, onFind: () -> Unit) {
    val tab = model.activeTab
    var menu by remember { mutableStateOf(false) }
    Row(Modifier.fillMaxWidth().height(60.dp).padding(horizontal = 6.dp), verticalAlignment = Alignment.CenterVertically) {
        IconButton(onClick = { tab?.webView?.goBack() }, enabled = tab?.canGoBack == true) {
            Icon(Icons.AutoMirrored.Filled.ArrowBack, stringResource(R.string.back), tint = if (tab?.canGoBack == true) TextMain else TextDim.copy(alpha = 0.4f))
        }
        Surface(onClick = onAddress, shape = RoundedCornerShape(20.dp), color = Surface2, modifier = Modifier.weight(1f).height(42.dp)) {
            Row(Modifier.padding(horizontal = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                val secure = tab?.url?.startsWith("https://") == true
                Icon(if (secure) Icons.Filled.Lock else Icons.Outlined.Public, null, tint = TextDim, modifier = Modifier.size(15.dp))
                Spacer(Modifier.width(8.dp))
                Text(tab?.let { Url.display(it.url) } ?: stringResource(R.string.address_hint), color = TextMain, fontSize = 14.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                if (model.adblockOn) {
                    Icon(Icons.Filled.Shield, stringResource(R.string.adblock), tint = accent, modifier = Modifier.size(15.dp))
                    if ((tab?.blocked ?: 0) > 0) Text(" ${tab!!.blocked}", color = accent, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }
        // Tab count in a rounded square, like Chrome and Arc on phones.
        Box(Modifier.size(48.dp).clickable(onClick = onTabs), contentAlignment = Alignment.Center) {
            Box(Modifier.size(24.dp).border(1.6.dp, TextMain, RoundedCornerShape(6.dp)), contentAlignment = Alignment.Center) {
                Text(model.tabsIn(model.activeSpaceId).size.coerceAtMost(99).toString(), color = TextMain, fontSize = 11.sp, fontWeight = FontWeight.Bold)
            }
        }
        Box {
            IconButton(onClick = { menu = true }) { Icon(Icons.Filled.MoreVert, stringResource(R.string.menu), tint = TextMain) }
            DriftMenu(model, menu, onDismiss = { menu = false }, onFind = onFind)
        }
    }
}

@Composable
private fun DriftMenu(model: BrowserModel, open: Boolean, onDismiss: () -> Unit, onFind: () -> Unit) {
    val tab = model.activeTab
    val ctx = androidx.compose.ui.platform.LocalContext.current
    DropdownMenu(expanded = open, onDismissRequest = onDismiss, containerColor = Surface2) {
        model.updateVersion?.let { v ->
            DropdownMenuItem(text = { Text(stringResource(R.string.update_available, v), color = MaterialTheme.colorScheme.primary) }, onClick = {
                model.updateUrl?.let { model.newTab(it) }
                onDismiss()
            })
            HorizontalDivider()
        }
        DropdownMenuItem(text = { Text(stringResource(R.string.new_tab)) }, leadingIcon = { Icon(Icons.Filled.Add, null) }, onClick = { model.newTab(); onDismiss() })
        DropdownMenuItem(text = { Text(stringResource(R.string.forward)) }, leadingIcon = { Icon(Icons.AutoMirrored.Filled.ArrowForward, null) }, enabled = tab?.canGoForward == true, onClick = { tab?.webView?.goForward(); onDismiss() })
        DropdownMenuItem(text = { Text(stringResource(R.string.reload)) }, onClick = { tab?.webView?.reload(); onDismiss() })
        DropdownMenuItem(text = { Text(stringResource(R.string.find_in_page)) }, leadingIcon = { Icon(Icons.Filled.Search, null) }, onClick = { onFind(); onDismiss() })
        DropdownMenuItem(text = { Text(stringResource(R.string.share)) }, onClick = {
            tab?.let { ctx.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, it.url), null)) }
            onDismiss()
        })
        if (tab != null) {
            DropdownMenuItem(text = { Text(stringResource(if (tab.pinned) R.string.unpin else R.string.pin)) }, leadingIcon = { Icon(Icons.Filled.PushPin, null) }, onClick = { tab.pinned = !tab.pinned; model.save(); onDismiss() })
            DropdownMenuItem(
                text = { Text(stringResource(R.string.desktop_site)) },
                trailingIcon = { Checkbox(checked = tab.desktop, onCheckedChange = null) },
                onClick = { model.setDesktop(tab, !tab.desktop); onDismiss() },
            )
        }
        DropdownMenuItem(
            text = { Text(stringResource(R.string.adblock)) },
            trailingIcon = { Checkbox(checked = model.adblockOn, onCheckedChange = null) },
            onClick = { model.adblockOn = !model.adblockOn; model.save(); tab?.webView?.reload(); onDismiss() },
        )
        if (tab != null && model.adblockOn) {
            DropdownMenuItem(text = { Text(stringResource(R.string.blocked_count, tab.blocked), color = TextDim, fontSize = 12.sp) }, enabled = false, onClick = {})
        }
        DropdownMenuItem(text = { Text(stringResource(R.string.sign_in_google)) }, onClick = { model.newTab("https://accounts.google.com/"); onDismiss() })
        HorizontalDivider()
        val chromium = WebView.getCurrentWebViewPackage()?.versionName ?: "?"
        DropdownMenuItem(text = { Text(stringResource(R.string.about, BuildConfig.VERSION_NAME, chromium), color = TextDim, fontSize = 12.sp) }, enabled = false, onClick = {})
    }
}

@Composable
private fun Omnibox(model: BrowserModel, accent: Color, onClose: () -> Unit) {
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
    Surface(color = Bg.copy(alpha = 0.97f), modifier = Modifier.fillMaxSize()) {
        Column(Modifier.fillMaxSize().systemBarsPadding().imePadding().padding(10.dp)) {
            LazyColumn(Modifier.weight(1f), reverseLayout = true, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                if (q.isNotEmpty()) {
                    item {
                        Suggestion(if (Url.looksLikeUrl(q)) Icons.Outlined.Public else Icons.Filled.Search, q, stringResource(if (Url.looksLikeUrl(q)) R.string.open else R.string.search_with)) { go(q) }
                    }
                }
                items(matches) { t ->
                    Suggestion(Icons.Filled.Tab, t.title, stringResource(R.string.switch_to_tab)) {
                        model.activate(t)
                        onClose()
                    }
                }
            }
            TextField(
                value = text,
                onValueChange = { text = it },
                singleLine = true,
                placeholder = { Text(stringResource(R.string.address_hint)) },
                leadingIcon = { Icon(Icons.Filled.Search, null, tint = accent) },
                trailingIcon = { IconButton(onClick = onClose) { Icon(Icons.Filled.Close, null) } },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri, imeAction = ImeAction.Go),
                keyboardActions = KeyboardActions(onGo = { go(text.text) }),
                shape = RoundedCornerShape(22.dp),
                colors = TextFieldDefaults.colors(
                    focusedContainerColor = Surface2,
                    unfocusedContainerColor = Surface2,
                    focusedIndicatorColor = Color.Transparent,
                    unfocusedIndicatorColor = Color.Transparent,
                    cursorColor = accent,
                ),
                modifier = Modifier.fillMaxWidth().focusRequester(focus),
            )
        }
    }
}

@Composable
private fun Suggestion(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, hint: String, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).clickable(onClick = onClick).background(Surface1).padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, null, tint = TextDim, modifier = Modifier.size(18.dp))
        Spacer(Modifier.width(12.dp))
        Text(label, color = TextMain, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
        Text(hint, color = TextDim, fontSize = 12.sp)
    }
}

@Composable
private fun FindBar(model: BrowserModel, tab: Tab, onClose: () -> Unit) {
    var text by remember { mutableStateOf("") }
    val focus = remember { FocusRequester() }
    LaunchedEffect(Unit) { focus.requestFocus() }
    Row(Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        TextField(
            value = text,
            onValueChange = { text = it; tab.webView?.findAllAsync(it) },
            singleLine = true,
            placeholder = { Text(stringResource(R.string.find_in_page)) },
            colors = TextFieldDefaults.colors(focusedContainerColor = Surface2, unfocusedContainerColor = Surface2, focusedIndicatorColor = Color.Transparent, unfocusedIndicatorColor = Color.Transparent),
            shape = RoundedCornerShape(18.dp),
            modifier = Modifier.weight(1f).focusRequester(focus),
        )
        if (text.isNotEmpty()) Text(stringResource(R.string.find_count, model.findActive, model.findMatches), color = TextDim, fontSize = 12.sp, modifier = Modifier.padding(horizontal = 8.dp))
        IconButton(onClick = { tab.webView?.findNext(false) }) { Icon(Icons.Filled.KeyboardArrowUp, null, tint = TextMain) }
        IconButton(onClick = { tab.webView?.findNext(true) }) { Icon(Icons.Filled.KeyboardArrowDown, null, tint = TextMain) }
        IconButton(onClick = { tab.webView?.clearMatches(); onClose() }) { Icon(Icons.Filled.Close, null, tint = TextMain) }
    }
}

@Composable
private fun TabsSheet(model: BrowserModel, accent: Color, onDone: () -> Unit) {
    val newSpaceName = stringResource(R.string.space_default, model.spaces.size + 1)
    Column(Modifier.fillMaxWidth().padding(horizontal = 12.dp).padding(bottom = 12.dp)) {
        // Spaces, like Zen and Arc.
        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            items(model.spaces) { s ->
                FilterChip(
                    selected = s.id == model.activeSpaceId,
                    onClick = { model.switchSpace(s) },
                    label = { Text(s.name) },
                    leadingIcon = { Box(Modifier.size(10.dp).clip(CircleShape).background(Color(s.color))) },
                )
            }
            item {
                IconButton(onClick = { model.newSpace(newSpaceName) }) { Icon(Icons.Filled.Add, stringResource(R.string.new_space), tint = TextMain) }
            }
        }
        Spacer(Modifier.height(8.dp))
        val list = model.tabsIn(model.activeSpaceId)
        LazyVerticalGrid(columns = GridCells.Fixed(2), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.weight(1f, fill = false).height(420.dp)) {
            items(list, key = { it.id }) { t ->
                TabCard(t, selected = t.id == model.activeTabId, accent = accent, onOpen = { model.activate(t); onDone() }, onClose = { model.close(t) })
            }
        }
        Row(Modifier.fillMaxWidth().padding(top = 10.dp), horizontalArrangement = Arrangement.SpaceBetween) {
            TextButton(onClick = { model.closeAllIn(model.activeSpaceId) }) { Text(stringResource(R.string.close_all), color = TextDim) }
            TextButton(onClick = { model.newTab(); onDone() }) {
                Icon(Icons.Filled.Add, null)
                Spacer(Modifier.width(4.dp))
                Text(stringResource(R.string.new_tab))
            }
        }
    }
}

@Composable
private fun TabCard(t: Tab, selected: Boolean, accent: Color, onOpen: () -> Unit, onClose: () -> Unit) {
    Column(
        Modifier.clip(RoundedCornerShape(14.dp)).background(Surface2).then(if (selected) Modifier.border(2.dp, accent, RoundedCornerShape(14.dp)) else Modifier).clickable(onClick = onOpen).padding(10.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            t.icon?.let { Image(it.asImageBitmap(), null, Modifier.size(16.dp).clip(RoundedCornerShape(3.dp))) }
                ?: Box(Modifier.size(16.dp).clip(RoundedCornerShape(3.dp)).background(accent.copy(alpha = 0.5f)))
            Spacer(Modifier.width(6.dp))
            if (t.pinned) Icon(Icons.Filled.PushPin, null, tint = accent, modifier = Modifier.size(12.dp))
            Spacer(Modifier.weight(1f))
            Icon(Icons.Filled.Close, stringResource(R.string.close_tab), tint = TextDim, modifier = Modifier.size(18.dp).clickable(onClick = onClose))
        }
        Spacer(Modifier.height(8.dp))
        Text(t.title, color = TextMain, fontSize = 13.sp, maxLines = 2, overflow = TextOverflow.Ellipsis, modifier = Modifier.height(36.dp))
        Text(Url.host(t.url), color = TextDim, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}
