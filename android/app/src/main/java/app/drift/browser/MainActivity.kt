package app.drift.browser

import android.app.UiModeManager
import android.content.ComponentCallbacks2
import android.content.Context
import android.content.Intent
import android.graphics.Color as AndroidColor
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.MimeTypeMap
import android.webkit.WebView
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

class MainActivity : ComponentActivity() {
    private lateinit var model: BrowserModel
    private var pendingFiles: ((Array<Uri>?) -> Unit)? = null
    private val pickOne = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri -> deliverFiles(uri?.let { arrayOf(it) }) }
    private val pickMany = registerForActivityResult(ActivityResultContracts.OpenMultipleDocuments()) { uris -> deliverFiles(uris.takeIf { it.isNotEmpty() }?.toTypedArray()) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        model = BrowserModel(this)
        model.filePicker = { types, multiple, result ->
            pendingFiles?.invoke(null)
            pendingFiles = result
            val mimes = types.map { t -> if (t.startsWith(".")) MimeTypeMap.getSingleton().getMimeTypeFromExtension(t.drop(1)) ?: "*/*" else t }.ifEmpty { listOf("*/*") }.toTypedArray()
            if (multiple) pickMany.launch(mimes) else pickOne.launch(mimes)
        }
        applyNightMode(this, model.themeMode)
        handle(intent)
        model.checkForUpdate()
        setContent { DriftApp(model) }
    }

    private fun deliverFiles(uris: Array<Uri>?) {
        pendingFiles?.invoke(uris)
        pendingFiles = null
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handle(intent)
    }

    private fun handle(intent: Intent?) {
        when (intent?.action) {
            Intent.ACTION_VIEW -> intent.dataString?.let { if (Url.safeExternal(it)) model.openIncoming(it) }
            Intent.ACTION_WEB_SEARCH -> intent.getStringExtra("query")?.let { model.newTab(Url.normalize(it)) }
            Intent.ACTION_SEND -> intent.getStringExtra(Intent.EXTRA_TEXT)?.let { model.newTab(Url.normalize(it)) }
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

/** Which full-screen page is on top of the browser. */
enum class Screen { NONE, SETTINGS, HISTORY, BOOKMARKS }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DriftApp(model: BrowserModel) {
    val space = model.spaces.firstOrNull { it.id == model.activeSpaceId }
    val seed = Color(space?.color ?: SPACE_COLORS[0])
    val dark = isDark(model.themeMode)
    val activity = LocalContext.current as ComponentActivity
    val tab = model.activeTab
    val private = tab?.private == true

    LaunchedEffect(dark, private) {
        val style = SystemBarStyle.auto(AndroidColor.TRANSPARENT, AndroidColor.TRANSPARENT) { dark || private }
        activity.enableEdgeToEdge(statusBarStyle = style, navigationBarStyle = style)
    }
    // Like Chrome's Incognito: no screenshots or app-switcher previews of private tabs.
    LaunchedEffect(private) {
        if (private) activity.window.addFlags(WindowManager.LayoutParams.FLAG_SECURE) else activity.window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
    }
    // Video full screen hides the system bars.
    DisposableEffect(model.fullscreen) {
        val ctl = WindowCompat.getInsetsController(activity.window, activity.window.decorView)
        if (model.fullscreen) {
            ctl.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            ctl.hide(WindowInsetsCompat.Type.systemBars())
        } else ctl.show(WindowInsetsCompat.Type.systemBars())
        onDispose { }
    }

    // Private tabs get a dark, neutral look whatever the theme, as in Chrome and Firefox.
    DriftTheme(if (private) THEME_DARK else model.themeMode, model.dynamicColor && !private, if (private) Color(0xFF9E9EB0) else seed) {
        val c = MaterialTheme.colorScheme
        var omnibox by remember { mutableStateOf(false) }
        var tabsOpen by remember { mutableStateOf(false) }
        var menuOpen by remember { mutableStateOf(false) }
        var findOpen by remember { mutableStateOf(false) }
        var screen by remember { mutableStateOf(Screen.NONE) }

        BackHandler(enabled = model.fullscreen || model.reader != null || omnibox || findOpen || screen != Screen.NONE || tab?.canGoBack == true) {
            when {
                model.fullscreen -> tab?.engine?.exitFullscreen()
                model.reader != null -> model.reader = null
                screen != Screen.NONE -> screen = Screen.NONE
                omnibox -> omnibox = false
                findOpen -> { tab?.engine?.clearFind(); findOpen = false }
                else -> tab?.engine?.goBack()
            }
        }

        Surface(color = if (model.fullscreen) Color.Black else c.surfaceContainer, modifier = Modifier.fillMaxSize()) {
            Box(Modifier.fillMaxSize()) {
                Column(Modifier.fillMaxSize().then(if (model.fullscreen) Modifier else Modifier.systemBarsPadding().imePadding())) {
                    val pageShape = if (model.fullscreen) androidx.compose.ui.graphics.RectangleShape else MaterialTheme.shapes.large
                    Box(
                        Modifier.weight(1f).fillMaxWidth()
                            .then(if (model.fullscreen) Modifier else Modifier.padding(start = 8.dp, end = 8.dp, top = 4.dp))
                            .clip(pageShape).background(c.surface),
                    ) {
                        when {
                            tab == null -> StartPage(model, onSearch = { omnibox = true }, onOpenLibrary = { screen = it })
                            Url.isHome(tab.url) && tab.engine == null -> StartPage(model, onSearch = { omnibox = true }, onOpenLibrary = { screen = it })
                            else -> key(tab.id, tab.generation) {
                                AndroidView(
                                    factory = { model.engineFor(tab).view.also { (it.parent as? ViewGroup)?.removeView(it) } },
                                    modifier = Modifier.fillMaxSize(),
                                )
                            }
                        }
                        if (tab != null && tab.progress < 100 && !Url.isHome(tab.url)) {
                            LinearProgressIndicator(progress = { tab.progress / 100f }, modifier = Modifier.fillMaxWidth().height(3.dp), color = c.primary, trackColor = c.primaryContainer)
                        }
                        // WebView's video full screen hands over its own view.
                        model.fullscreenView?.let { v ->
                            AndroidView(factory = { (v.parent as? ViewGroup)?.removeView(v); v }, modifier = Modifier.fillMaxSize().background(Color.Black))
                        }
                    }
                    if (!model.fullscreen) {
                        AnimatedVisibility(findOpen && tab != null, enter = slideInVertically { it } + fadeIn(), exit = slideOutVertically { it } + fadeOut()) {
                            if (tab != null) FindBar(model, tab) { findOpen = false }
                        }
                        BottomBar(model, onAddress = { omnibox = true }, onTabs = { tabsOpen = true }, onMenu = { menuOpen = true })
                    }
                }
                AnimatedVisibility(omnibox, enter = fadeIn(), exit = fadeOut()) { Omnibox(model) { omnibox = false } }
                AnimatedVisibility(screen != Screen.NONE, enter = slideInVertically { it / 6 } + fadeIn(), exit = slideOutVertically { it / 6 } + fadeOut()) {
                    when (screen) {
                        Screen.SETTINGS -> SettingsScreen(model) { screen = Screen.NONE }
                        Screen.HISTORY -> HistoryScreen(model) { screen = Screen.NONE }
                        Screen.BOOKMARKS -> BookmarksScreen(model) { screen = Screen.NONE }
                        Screen.NONE -> Unit
                    }
                }
                AnimatedVisibility(model.reader != null, enter = slideInVertically { it / 6 } + fadeIn(), exit = fadeOut()) {
                    model.reader?.let { ReaderScreen(model, it) { model.reader = null } }
                }
            }
        }

        if (tabsOpen) {
            ModalBottomSheet(onDismissRequest = { tabsOpen = false }, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true), containerColor = c.surfaceContainerLow) {
                TabsSheet(model) { tabsOpen = false }
            }
        }
        if (menuOpen) {
            ModalBottomSheet(onDismissRequest = { menuOpen = false }, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true), containerColor = c.surfaceContainerLow) {
                MenuSheet(model, onDismiss = { menuOpen = false }, onFind = { findOpen = true }, onScreen = { screen = it })
            }
        }
        model.contextTarget?.let { target ->
            ModalBottomSheet(onDismissRequest = { model.contextTarget = null }, containerColor = c.surfaceContainerLow) {
                ContextSheet(model, target) { model.contextTarget = null }
            }
        }
        model.prompt?.let { PromptDialog(it) { model.prompt = null } }
    }
}

/** A small engine badge: "C" for Chromium, a fox-orange "G" for Gecko. */
@Composable
fun EngineBadge(kind: EngineKind, modifier: Modifier = Modifier) {
    val gecko = kind == EngineKind.GECKO
    Box(
        modifier.size(18.dp).clip(CircleShape).background(if (gecko) Color(0xFFFF7139) else Color(0xFF4C8BF5)),
        contentAlignment = Alignment.Center,
    ) {
        Text(if (gecko) "G" else "C", color = Color.White, style = MaterialTheme.typography.labelSmall)
    }
}
