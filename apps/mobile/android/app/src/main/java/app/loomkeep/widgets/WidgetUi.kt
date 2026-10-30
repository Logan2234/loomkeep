package app.loomkeep.widgets

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.annotation.StringRes
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
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

/** Each widget's look, chosen in WidgetStyleActivity: « Affiches » unless « Liste » was picked. */
val STYLE_KEY = stringPreferencesKey("style")
const val STYLE_POSTERS = "posters"
const val STYLE_LIST = "list"

/**
 * The widget's size in home-screen cells, guessed from its size in dp (a
 * phone cell is about 74 × 96 dp). Widgets draw with SizeMode.Exact, so the
 * layout follows any size from 2 × 2 to 5 × 5.
 */
data class Cells(val cols: Int, val rows: Int) {
    val single get() = cols <= 2 && rows <= 2
}

@Composable
fun currentCells(): Cells {
    val size = LocalSize.current
    val cols = when {
        size.width < 185.dp -> 2
        size.width < 260.dp -> 3
        size.width < 340.dp -> 4
        else -> 5
    }
    val rows = when {
        size.height < 250.dp -> 2
        size.height < 400.dp -> 3
        size.height < 520.dp -> 4
        else -> 5
    }
    return Cells(cols, rows)
}

/** « Affiches »: columns and rows of posters — one, a row of two or three, then up to 3 × 3. */
fun posterGrid(cells: Cells): Pair<Int, Int> = when {
    cells.single -> 1 to 1
    cells.rows == 2 -> (if (cells.cols <= 3) 2 else 3) to 1
    else -> when (cells.cols) {
        2 -> 1
        3 -> 2
        else -> 3
    } to (if (cells.rows >= 5) 3 else 2)
}

/** « Liste »: as many tickets as the height holds under the header. */
@Composable
fun ticketCount(stripHeight: Dp): Int {
    val available = LocalSize.current.height - 12.dp - 30.dp
    return ((available + 4.dp) / (stripHeight + 4.dp)).toInt().coerceIn(1, 9)
}

/** Séance's palette, light or dark with the system (res/values-night/widget_colors.xml). */
object WidgetColors {
    val bg = ColorProvider(R.color.widget_bg)
    val fg = ColorProvider(R.color.widget_fg)
    val dim = ColorProvider(R.color.widget_dim)
    val accent = ColorProvider(R.color.widget_accent)
    val onSuccess = ColorProvider(R.color.widget_on_success)
    val rollInk = ColorProvider(R.color.widget_roll_ink)
    val rollDim = ColorProvider(R.color.widget_roll_dim)
    val ticket = ColorProvider(R.color.widget_ticket)
    val ticketInk = ColorProvider(R.color.widget_ticket_ink)
    val ticketDim = ColorProvider(R.color.widget_ticket_dim)
    val white = ColorProvider(Color.White)
    val whiteDim = ColorProvider(Color(0xD1FFFFFF))
    val marquee = ColorProvider(Color(0xFFF5B841))
}

/** Android's own condensed Roboto: a widget can't load Séance's fonts. */
private val CONDENSED = FontFamily("sans-serif-condensed")

fun mono(size: TextUnit, color: ColorProvider, weight: FontWeight = FontWeight.Bold) =
    TextStyle(color = color, fontSize = size, fontWeight = weight, fontFamily = FontFamily.Monospace)

fun sans(size: TextUnit, color: ColorProvider, weight: FontWeight = FontWeight.Medium) =
    TextStyle(color = color, fontSize = size, fontWeight = weight)

fun condensed(size: TextUnit, color: ColorProvider) =
    TextStyle(color = color, fontSize = size, fontWeight = FontWeight.Bold, fontFamily = CONDENSED)

/** A stand-in colour for a work without a poster, the same one each time. */
fun fallbackColor(title: String): Int {
    val shades = intArrayOf(
        0xFF2E7189.toInt(), 0xFF7C9668.toInt(), 0xFFB5452F.toInt(), 0xFF6B5843.toInt(),
        0xFF5E6577.toInt(), 0xFF7A4A8C.toInt(), 0xFFA9803F.toInt(),
    )
    return shades[Math.floorMod(title.hashCode(), shades.size)]
}

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

/**
 * The widget's ground: white or night for « Affiches », the tickets' amber
 * roll for « Liste ». A tap between the items opens the app; the items'
 * own taps take precedence.
 */
@Composable
fun WidgetFrame(style: String, edgeToEdge: Boolean, content: @Composable () -> Unit) {
    val ground = if (style == STYLE_LIST) R.color.widget_roll else R.color.widget_bg
    Box(
        modifier = GlanceModifier
            .fillMaxSize()
            .cornerRadius(22.dp)
            .background(ColorProvider(ground))
            .clickable(openApp(LocalContext.current, "/app"))
            .padding(if (edgeToEdge) 0.dp else 6.dp),
    ) {
        content()
    }
}

/** Signed out, offline or nothing to show: one line, which opens the app. */
@Composable
fun WidgetMessage(@StringRes text: Int, style: String) {
    val context = LocalContext.current
    Column(
        modifier = GlanceModifier.fillMaxSize().padding(12.dp).clickable(openApp(context, "/app")),
        verticalAlignment = Alignment.CenterVertically,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Image(ImageProvider(R.drawable.ic_widget_logo), contentDescription = null, modifier = GlanceModifier.size(28.dp))
        Spacer(GlanceModifier.height(8.dp))
        Text(
            context.getString(text),
            style = TextStyle(
                color = if (style == STYLE_LIST) WidgetColors.rollDim else WidgetColors.dim,
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium,
                textAlign = TextAlign.Center,
            ),
        )
    }
}

@Composable
fun WidgetHeader(title: String, meta: String?, style: String) {
    val list = style == STYLE_LIST
    Row(
        modifier = GlanceModifier.fillMaxWidth().height(26.dp).padding(horizontal = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Image(ImageProvider(R.drawable.ic_widget_logo), contentDescription = null, modifier = GlanceModifier.size(16.dp))
        Spacer(GlanceModifier.width(7.dp))
        Text(
            title,
            style = if (list) condensed(15.sp, WidgetColors.rollInk) else sans(15.sp, WidgetColors.fg, FontWeight.Bold),
            maxLines = 1,
            modifier = GlanceModifier.defaultWeight(),
        )
        if (meta != null) {
            Text(meta, style = sans(12.sp, if (list) WidgetColors.rollDim else WidgetColors.dim), maxLines = 1)
        }
    }
}

/**
 * « Affiches »: the poster, and under it a band in the poster's own shade
 * carrying the title — no scrim over the artwork.
 */
@Composable
fun BandTile(
    modifier: GlanceModifier,
    poster: Poster?,
    title: String,
    meta: String,
    metaLive: Boolean,
    open: Action,
    action: Action?,
    actionLabel: String?,
    checked: Boolean,
    big: Boolean,
) {
    val base = fallbackColor(title)
    val band = poster?.band ?: darken(base)
    Box(modifier = modifier.cornerRadius(if (big) 0.dp else 14.dp).background(ColorProvider(Color(band)))) {
        Column(modifier = GlanceModifier.fillMaxSize().clickable(open)) {
            Box(modifier = GlanceModifier.fillMaxWidth().defaultWeight().background(ColorProvider(Color(base)))) {
                if (poster != null) {
                    Image(
                        ImageProvider(poster.bitmap),
                        contentDescription = null,
                        modifier = GlanceModifier.fillMaxSize(),
                        contentScale = ContentScale.Crop,
                    )
                }
            }
            Column(
                modifier = GlanceModifier
                    .fillMaxWidth()
                    .padding(start = if (big) 12.dp else 8.dp, end = if (big) 56.dp else 8.dp, top = 6.dp, bottom = 7.dp),
            ) {
                Text(title, style = sans(if (big) 16.sp else 13.sp, WidgetColors.white, FontWeight.Bold), maxLines = 1)
                Text(
                    meta,
                    style = mono(if (big) 12.sp else 11.sp, if (metaLive) WidgetColors.marquee else WidgetColors.whiteDim, FontWeight.Medium),
                    maxLines = 1,
                )
            }
        }
        if (action != null) {
            Box(
                modifier = GlanceModifier.fillMaxSize().padding(if (big) 10.dp else 6.dp),
                contentAlignment = if (big) Alignment.BottomEnd else Alignment.TopEnd,
            ) {
                CheckButton(action, actionLabel, if (big) 40.dp else 34.dp, checked, onBand = band)
            }
        }
    }
}

/** A grid of band tiles; a short last row keeps its tiles the size of the others. */
@Composable
fun <T> BandGrid(items: List<T>, cols: Int, tile: @Composable (T, GlanceModifier) -> Unit) {
    Column(modifier = GlanceModifier.fillMaxSize()) {
        items.chunked(cols).forEachIndexed { index, row ->
            if (index > 0) Spacer(GlanceModifier.height(6.dp))
            Row(modifier = GlanceModifier.fillMaxWidth().defaultWeight()) {
                row.forEachIndexed { column, item ->
                    if (column > 0) Spacer(GlanceModifier.width(6.dp))
                    tile(item, GlanceModifier.defaultWeight().fillMaxHeight())
                }
                repeat(cols - row.size) {
                    Spacer(GlanceModifier.width(6.dp))
                    Spacer(GlanceModifier.defaultWeight())
                }
            }
        }
    }
}

/** « Liste »: a ticket — its stub (the code, the date, the time), the perforation, then its body. */
@Composable
fun TicketStrip(
    height: Dp,
    stubWidth: Dp,
    stubTop: String,
    stubBottom: String,
    stubLive: Boolean,
    poster: Poster?,
    title: String,
    sub: String,
    open: Action,
    action: Action?,
    actionLabel: String?,
    checked: Boolean,
) {
    val compact = height < 46.dp
    Row(modifier = GlanceModifier.fillMaxWidth().height(height)) {
        Column(
            modifier = GlanceModifier
                .width(stubWidth)
                .fillMaxHeight()
                .background(ImageProvider(R.drawable.widget_stub_bg))
                .clickable(open)
                .padding(horizontal = 9.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                stubTop,
                style = mono(if (stubTop.length > 7) 12.sp else 14.sp, if (stubLive) WidgetColors.accent else WidgetColors.ticketInk),
                maxLines = 1,
            )
            if (stubBottom.isNotEmpty()) {
                Text(stubBottom, style = mono(10.5.sp, WidgetColors.ticketDim, FontWeight.Medium), maxLines = 1)
            }
        }
        Perforation(vertical = true)
        Row(
            modifier = GlanceModifier
                .defaultWeight()
                .fillMaxHeight()
                .background(ImageProvider(R.drawable.widget_ticket_bg))
                .padding(start = 10.dp, end = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Row(modifier = GlanceModifier.defaultWeight().clickable(open), verticalAlignment = Alignment.CenterVertically) {
                Thumb(poster, title, if (compact) 22.dp else 26.dp, if (compact) 32.dp else 38.dp)
                Spacer(GlanceModifier.width(9.dp))
                Column {
                    Text(title, style = condensed(15.sp, WidgetColors.ticketInk), maxLines = 1)
                    Text(sub, style = sans(12.sp, WidgetColors.ticketDim), maxLines = 1)
                }
            }
            if (action != null) {
                Spacer(GlanceModifier.width(6.dp))
                CheckButton(action, actionLabel, if (compact) 32.dp else 36.dp, checked, onBand = null)
            }
        }
    }
}

/** 2 × 2 « Liste »: one ticket standing up, its stub at the bottom. */
@Composable
fun SingleTicket(
    poster: Poster?,
    title: String,
    sub: String,
    stubBig: String,
    stubSmall: String,
    open: Action,
    action: Action?,
    actionLabel: String?,
    checked: Boolean,
) {
    Column(modifier = GlanceModifier.fillMaxSize()) {
        Row(
            modifier = GlanceModifier
                .fillMaxWidth()
                .defaultWeight()
                .background(ImageProvider(R.drawable.widget_ticket_top_bg))
                .clickable(open)
                .padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Thumb(poster, title, 42.dp, 60.dp)
            Spacer(GlanceModifier.width(10.dp))
            Column {
                Text(title, style = condensed(16.sp, WidgetColors.ticketInk), maxLines = 2)
                Text(sub, style = sans(12.sp, WidgetColors.ticketDim), maxLines = 2)
            }
        }
        Perforation(vertical = false)
        Row(
            modifier = GlanceModifier
                .fillMaxWidth()
                .height(60.dp)
                .background(ImageProvider(R.drawable.widget_stub_bottom_bg))
                .padding(start = 12.dp, end = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = GlanceModifier.defaultWeight()) {
                Text(stubBig, style = mono(19.sp, WidgetColors.accent), maxLines = 1)
                Text(stubSmall, style = mono(11.sp, WidgetColors.ticketDim, FontWeight.Medium), maxLines = 1)
            }
            if (action != null) CheckButton(action, actionLabel, 40.dp, checked, onBand = null)
        }
    }
}

/** Dashes in the roll's colour, across the ticket's paper. */
@Composable
private fun Perforation(vertical: Boolean) {
    val size = if (vertical) GlanceModifier.width(2.dp).fillMaxHeight() else GlanceModifier.fillMaxWidth().height(2.dp)
    Box(modifier = size.background(WidgetColors.ticket)) {
        Image(
            ImageProvider(if (vertical) R.drawable.widget_perforation_v else R.drawable.widget_perforation_h),
            contentDescription = null,
            modifier = GlanceModifier.fillMaxSize(),
            contentScale = ContentScale.FillBounds,
        )
    }
}

@Composable
private fun Thumb(poster: Poster?, title: String, width: Dp, height: Dp) {
    Box(
        modifier = GlanceModifier
            .size(width, height)
            .cornerRadius(4.dp)
            .background(ColorProvider(Color(fallbackColor(title)))),
    ) {
        if (poster != null) {
            Image(ImageProvider(poster.bitmap), contentDescription = null, modifier = GlanceModifier.fillMaxSize(), contentScale = ContentScale.Crop)
        }
    }
}

/**
 * The ✓: a ring on a ticket, a white disc on a poster's band, green once
 * pressed until the API answers.
 */
@Composable
fun CheckButton(action: Action, label: String?, size: Dp, checked: Boolean, onBand: Int?) {
    val background = when {
        checked -> R.drawable.widget_check_done
        onBand != null -> R.drawable.widget_check_on_band
        else -> R.drawable.widget_check_ring
    }
    val base = GlanceModifier.size(size).background(ImageProvider(background))
    Box(modifier = if (checked) base else base.clickable(action), contentAlignment = Alignment.Center) {
        Image(
            ImageProvider(R.drawable.ic_widget_check),
            contentDescription = label,
            modifier = GlanceModifier.size(size * 0.48f),
            colorFilter = ColorFilter.tint(
                when {
                    checked -> WidgetColors.onSuccess
                    onBand != null -> ColorProvider(Color(onBand))
                    else -> WidgetColors.ticketInk
                },
            ),
        )
    }
}
