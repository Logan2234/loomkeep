package app.loomkeep.widgets

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import androidx.annotation.StringRes
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.glance.ColorFilter
import androidx.glance.GlanceModifier
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.LocalContext
import androidx.glance.LocalSize
import androidx.glance.action.Action
import androidx.glance.action.clickable
import androidx.glance.appwidget.LinearProgressIndicator
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.cornerRadius
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.ContentScale
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxHeight
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.size
import androidx.glance.layout.width
import androidx.glance.text.FontFamily
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextAlign
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import app.loomkeep.MainActivity
import app.loomkeep.R

/** Each widget's look, chosen in WidgetStyleActivity: posters unless the list was picked. */
val STYLE_KEY = stringPreferencesKey("style")
const val STYLE_POSTERS = "posters"
const val STYLE_LIST = "list"

/** From 2 × 2: narrow, then three columns wide, then three rows tall too. */
val WIDGET_SIZES = setOf(DpSize(110.dp, 180.dp), DpSize(200.dp, 180.dp), DpSize(200.dp, 330.dp))

/** What fits: one item, then a row of three, then two rows. */
enum class WidgetLayout(val items: Int) {
    SMALL(1),
    WIDE(3),
    LARGE(6),
}

@Composable
fun currentLayout(): WidgetLayout {
    val size = LocalSize.current
    return when {
        size.height >= 330.dp && size.width >= 200.dp -> WidgetLayout.LARGE
        size.width >= 200.dp -> WidgetLayout.WIDE
        else -> WidgetLayout.SMALL
    }
}

/** Séance's palette, light or dark with the system (res/values-night/widget_colors.xml). */
object WidgetColors {
    val bg = ColorProvider(R.color.widget_bg)
    val fg = ColorProvider(R.color.widget_fg)
    val dim = ColorProvider(R.color.widget_dim)
    val accent = ColorProvider(R.color.widget_accent)
    val divider = ColorProvider(R.color.widget_divider)
    val posterFallback = ColorProvider(R.color.widget_poster_fallback)
    val white = ColorProvider(Color.White)
    val whiteDim = ColorProvider(Color(0xD1FFFFFF))
    val marquee = ColorProvider(Color(0xFFF5B841))
    val onMarquee = ColorProvider(Color(0xFF1A1406))
    val transparent = ColorProvider(Color.Transparent)
}

fun mono(size: TextUnit, color: ColorProvider) =
    TextStyle(color = color, fontSize = size, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)

fun sans(size: TextUnit, color: ColorProvider, weight: FontWeight = FontWeight.Medium) =
    TextStyle(color = color, fontSize = size, fontWeight = weight)

/** Opens the app on `path`, routed by the web like an App Link (appUrlOpen). */
fun openApp(context: Context, path: String?): Action {
    val origin = WidgetStore.origin(context)
    val intent = if (origin != null && path != null) {
        Intent(Intent.ACTION_VIEW, Uri.parse(origin + path), context, MainActivity::class.java)
    } else {
        Intent(context, MainActivity::class.java)
    }
    return actionStartActivity(intent)
}

@Composable
fun WidgetFrame(content: @Composable () -> Unit) {
    // A tap between the items opens the app; the items' own taps take precedence.
    Box(
        modifier = GlanceModifier
            .fillMaxSize()
            .cornerRadius(24.dp)
            .background(WidgetColors.bg)
            .clickable(openApp(LocalContext.current, "/app"))
            .padding(8.dp),
    ) {
        content()
    }
}

/** Signed out, offline or nothing to show: one line, which opens the app. */
@Composable
fun WidgetMessage(@StringRes text: Int) {
    val context = LocalContext.current
    Column(
        modifier = GlanceModifier.fillMaxSize().clickable(openApp(context, "/app")),
        verticalAlignment = Alignment.CenterVertically,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Image(ImageProvider(R.drawable.ic_widget_logo), contentDescription = null, modifier = GlanceModifier.size(28.dp))
        Spacer(GlanceModifier.height(8.dp))
        Text(
            context.getString(text),
            style = TextStyle(color = WidgetColors.dim, fontSize = 13.sp, fontWeight = FontWeight.Medium, textAlign = TextAlign.Center),
        )
    }
}

@Composable
fun WidgetHeader(title: String, trailing: String?, trailingColor: ColorProvider, logo: Boolean) {
    Row(
        modifier = GlanceModifier.fillMaxWidth().height(28.dp).padding(horizontal = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (logo) {
            Image(ImageProvider(R.drawable.ic_widget_logo), contentDescription = null, modifier = GlanceModifier.size(18.dp))
            Spacer(GlanceModifier.width(8.dp))
        }
        Text(title, style = sans(15.sp, WidgetColors.fg, FontWeight.Bold), maxLines = 1, modifier = GlanceModifier.defaultWeight())
        if (trailing != null) Text(trailing, style = mono(12.sp, trailingColor), maxLines = 1)
    }
}

@Composable
fun Divider() {
    Box(modifier = GlanceModifier.fillMaxWidth().height(1.dp).background(WidgetColors.divider)) {}
}

/** An affiche: the poster, a chip at the top, the title over a scrim at the bottom. */
@Composable
fun PosterTile(
    modifier: GlanceModifier,
    poster: Bitmap?,
    chip: String,
    chipOnMarquee: Boolean,
    title: String,
    subtitle: String?,
    open: Action,
    check: Action?,
    checkLabel: String?,
    progress: Float?,
    titleSize: TextUnit = 14.sp,
    checked: Boolean = false,
) {
    Box(modifier = modifier.cornerRadius(16.dp).background(WidgetColors.posterFallback).clickable(open)) {
        if (poster != null) {
            Image(ImageProvider(poster), contentDescription = null, modifier = GlanceModifier.fillMaxSize(), contentScale = ContentScale.Crop)
        }
        Image(
            ImageProvider(R.drawable.widget_poster_scrim),
            contentDescription = null,
            modifier = GlanceModifier.fillMaxSize(),
            contentScale = ContentScale.FillBounds,
        )
        Column(modifier = GlanceModifier.fillMaxSize().padding(8.dp)) {
            Row(modifier = GlanceModifier.fillMaxWidth()) {
                Text(
                    chip,
                    style = mono(11.sp, if (chipOnMarquee) WidgetColors.onMarquee else WidgetColors.white),
                    maxLines = 1,
                    modifier = GlanceModifier
                        .background(ImageProvider(if (chipOnMarquee) R.drawable.widget_chip_accent else R.drawable.widget_chip_dark))
                        .padding(horizontal = 6.dp, vertical = 2.dp),
                )
                Spacer(GlanceModifier.defaultWeight())
                if (check != null) CheckButton(check, checkLabel, 36.dp, onPoster = true, checked = checked)
            }
            Spacer(GlanceModifier.defaultWeight())
            Text(title, style = sans(titleSize, WidgetColors.white, FontWeight.Bold), maxLines = 2)
            if (subtitle != null) Text(subtitle, style = mono(11.sp, WidgetColors.whiteDim), maxLines = 1)
        }
        if (progress != null) {
            Column(modifier = GlanceModifier.fillMaxSize(), verticalAlignment = Alignment.Bottom) {
                LinearProgressIndicator(
                    progress = progress,
                    modifier = GlanceModifier.fillMaxWidth().height(3.dp),
                    color = WidgetColors.marquee,
                    backgroundColor = WidgetColors.transparent,
                )
            }
        }
    }
}

/** The ✓ that marks the next episode watched, on a poster or in a list row. */
@Composable
fun CheckButton(action: Action, label: String?, size: Dp, onPoster: Boolean, checked: Boolean = false) {
    val background = when {
        checked -> R.drawable.widget_check_done
        onPoster -> R.drawable.widget_check_on_poster
        else -> R.drawable.widget_check_outline
    }
    val base = GlanceModifier.size(size).background(ImageProvider(background))
    Box(
        modifier = if (checked) base else base.clickable(action),
        contentAlignment = Alignment.Center,
    ) {
        Image(
            ImageProvider(R.drawable.ic_widget_check),
            contentDescription = label,
            modifier = GlanceModifier.size(size * 0.5f),
            colorFilter = when {
                checked -> ColorFilter.tint(ColorProvider(R.color.widget_on_success))
                onPoster -> null
                else -> ColorFilter.tint(WidgetColors.fg)
            },
        )
    }
}

/** A thumbnail for the list style. */
@Composable
fun PosterThumb(poster: Bitmap?, width: Dp, height: Dp) {
    Box(modifier = GlanceModifier.size(width, height).cornerRadius(5.dp).background(WidgetColors.posterFallback)) {
        if (poster != null) {
            Image(ImageProvider(poster), contentDescription = null, modifier = GlanceModifier.fillMaxSize(), contentScale = ContentScale.Crop)
        }
    }
}

/** A grid of posters: one, a row of three, or two rows of three under a header. */
@Composable
fun <T> PosterGrid(items: List<T>, layout: WidgetLayout, tile: @Composable (T, GlanceModifier) -> Unit) {
    val rows = items.chunked(3)
    Column(modifier = GlanceModifier.fillMaxSize()) {
        rows.forEachIndexed { index, row ->
            if (index > 0) Spacer(GlanceModifier.height(8.dp))
            Row(modifier = GlanceModifier.fillMaxWidth().defaultWeight()) {
                row.forEachIndexed { column, item ->
                    if (column > 0) Spacer(GlanceModifier.width(8.dp))
                    tile(item, GlanceModifier.defaultWeight().fillMaxHeight())
                }
                // A short last row keeps its tiles the width of the full ones.
                repeat(if (layout == WidgetLayout.SMALL) 0 else 3 - row.size) {
                    Spacer(GlanceModifier.width(8.dp))
                    Spacer(GlanceModifier.defaultWeight())
                }
            }
        }
    }
}
