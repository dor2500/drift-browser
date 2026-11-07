package app.drift.browser

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp

/** 0 follows the system, 1 light, 2 dark. */
const val THEME_SYSTEM = 0
const val THEME_LIGHT = 1
const val THEME_DARK = 2

val dynamicColorSupported: Boolean get() = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S

@Composable
fun isDark(mode: Int): Boolean = when (mode) {
    THEME_LIGHT -> false
    THEME_DARK -> true
    else -> isSystemInDarkTheme()
}

/**
 * Material You: on Android 12+ the colours come from the wallpaper.
 * Otherwise (or with dynamic colour off) a tonal scheme is built from the space's colour.
 */
@Composable
fun DriftTheme(mode: Int, dynamic: Boolean, seed: Color, content: @Composable () -> Unit) {
    val dark = isDark(mode)
    val ctx = LocalContext.current
    val scheme = when {
        dynamic && dynamicColorSupported -> if (dark) dynamicDarkColorScheme(ctx) else dynamicLightColorScheme(ctx)
        else -> seededScheme(seed, dark)
    }
    MaterialTheme(colorScheme = scheme, shapes = DriftShapes, content = content)
}

/** Material 3's rounder, "expressive" corners. */
private val DriftShapes = Shapes(
    extraSmall = RoundedCornerShape(8.dp),
    small = RoundedCornerShape(12.dp),
    medium = RoundedCornerShape(16.dp),
    large = RoundedCornerShape(24.dp),
    extraLarge = RoundedCornerShape(32.dp),
)

/** Tone t (0 = black … 100 = white) in the seed's hue; its saturation is scaled by [chroma]. */
private fun tone(seed: Color, t: Int, chroma: Float = 1f): Color {
    val hsl = FloatArray(3)
    androidx.core.graphics.ColorUtils.colorToHSL(android.graphics.Color.argb(255, (seed.red * 255).toInt(), (seed.green * 255).toInt(), (seed.blue * 255).toInt()), hsl)
    hsl[1] = (hsl[1] * chroma).coerceIn(0f, 1f)
    hsl[2] = t / 100f
    return Color(androidx.core.graphics.ColorUtils.HSLToColor(hsl))
}

private fun seededScheme(seed: Color, dark: Boolean): ColorScheme {
    // Primary keeps the seed's colour; neutrals carry a faint tint of it, as Material You does.
    fun p(t: Int) = tone(seed, t, if (t in 21..89) 0.75f else 1f)
    fun pc(t: Int) = tone(seed, t, 0.5f)
    fun s(t: Int) = tone(seed, t, 0.45f)
    fun n(t: Int) = tone(seed, t, 0.08f)
    fun nv(t: Int) = tone(seed, t, 0.16f)
    val tertiarySeed = Color(android.graphics.Color.HSVToColor(FloatArray(3).also {
        android.graphics.Color.colorToHSV(android.graphics.Color.argb(255, (seed.red * 255).toInt(), (seed.green * 255).toInt(), (seed.blue * 255).toInt()), it)
        it[0] = (it[0] + 60f) % 360f
    }))
    fun t(t: Int) = tone(tertiarySeed, t, 0.7f)
    return if (dark) darkColorScheme(
        primary = p(80), onPrimary = p(20), primaryContainer = pc(30), onPrimaryContainer = pc(90),
        secondary = s(80), onSecondary = s(20), secondaryContainer = s(30), onSecondaryContainer = s(90),
        tertiary = t(80), onTertiary = t(20), tertiaryContainer = t(30), onTertiaryContainer = t(90),
        background = n(6), onBackground = n(90), surface = n(6), onSurface = n(90),
        surfaceVariant = nv(30), onSurfaceVariant = nv(80), outline = nv(60), outlineVariant = nv(30),
        surfaceContainerLowest = n(4), surfaceContainerLow = n(10), surfaceContainer = n(12),
        surfaceContainerHigh = n(17), surfaceContainerHighest = n(22), surfaceBright = n(24), surfaceDim = n(6),
        inverseSurface = n(90), inverseOnSurface = n(20), inversePrimary = p(40),
    ) else lightColorScheme(
        primary = p(40), onPrimary = Color.White, primaryContainer = pc(90), onPrimaryContainer = pc(10),
        secondary = s(40), onSecondary = Color.White, secondaryContainer = s(90), onSecondaryContainer = s(10),
        tertiary = t(40), onTertiary = Color.White, tertiaryContainer = t(90), onTertiaryContainer = t(10),
        background = n(98), onBackground = n(10), surface = n(98), onSurface = n(10),
        surfaceVariant = nv(90), onSurfaceVariant = nv(30), outline = nv(50), outlineVariant = nv(80),
        surfaceContainerLowest = Color.White, surfaceContainerLow = n(96), surfaceContainer = n(94),
        surfaceContainerHigh = n(92), surfaceContainerHighest = n(90), surfaceBright = n(98), surfaceDim = n(87),
        inverseSurface = n(20), inverseOnSurface = n(95), inversePrimary = p(80),
    )
}
