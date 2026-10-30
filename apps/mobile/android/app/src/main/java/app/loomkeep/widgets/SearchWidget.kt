package app.loomkeep.widgets

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.ColorFilter
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.LocalContext
import androidx.glance.LocalSize
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.currentState
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxHeight
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.size
import androidx.glance.layout.width
import androidx.glance.state.GlanceStateDefinition
import androidx.glance.state.PreferencesGlanceStateDefinition
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextAlign
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import app.loomkeep.R

private const val SEARCH_PATH = "/app/search"
private const val SCAN_PATH = "/app/search?type=BOOKS&scan=1"
private val ScanOnAmber = ColorProvider(Color(0xFF1A1406))

private val CATEGORIES = listOf(
    "MEDIA" to R.string.widget_search_media,
    "GAMES" to R.string.widget_search_games,
    "BOOKS" to R.string.widget_search_books,
    "MUSIC" to R.string.widget_search_music,
)

/**
 * « Recherche » (MOB-20): search, the scanner and the categories, then the
 * latest additions. It opens the app whatever the session: only the
 * additions need one.
 */
class SearchWidget : GlanceAppWidget() {
    override val sizeMode = SizeMode.Exact
    override val stateDefinition: GlanceStateDefinition<*> = PreferencesGlanceStateDefinition

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        WidgetRepository.ensure(context)

        provideContent {
            val snapshot by WidgetRepository.snapshot.collectAsState()
            val style = currentState(STYLE_KEY) ?: STYLE_POSTERS
            val added = (snapshot?.data as? WidgetData.Ready)?.feed?.added.orEmpty()
            val posters = snapshot?.posters.orEmpty()

            WidgetFrame(style, edgeToEdge = false) {
                if (style == STYLE_LIST) SearchTickets(added, posters, currentCells()) else SearchBands(added, posters, currentCells())
            }
        }
    }

    override suspend fun providePreview(context: Context, widgetCategory: Int) {
        provideContent {
            WidgetFrame(STYLE_POSTERS, edgeToEdge = false) {
                SearchBands(emptyList(), emptyMap(), currentCells())
            }
        }
    }
}

class SearchWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = SearchWidget()
}

private fun WidgetAdded.kindLabel(context: Context) = context.getString(
    when (kind) {
        "SERIES" -> R.string.widget_series
        "ANIME" -> R.string.widget_anime
        "MOVIE" -> R.string.widget_movie
        "GAME" -> R.string.widget_game
        "BOOK" -> R.string.widget_book
        else -> R.string.widget_album
    },
)

private fun Map<String, Poster>.of(added: WidgetAdded) = added.posterUrl?.let { this[it] }

/** The categories, two by two until the widget is wide enough for all four on a line. */
@Composable
private fun CategoryChips(cells: Cells, background: Int, ink: ColorProvider) {
    val context = LocalContext.current
    Column(modifier = GlanceModifier.fillMaxWidth()) {
        CATEGORIES.chunked(if (cells.cols >= 5) 4 else 2).forEachIndexed { index, row ->
            if (index > 0) Spacer(GlanceModifier.height(4.dp))
            Row(modifier = GlanceModifier.fillMaxWidth().height(30.dp)) {
                row.forEachIndexed { column, (domain, label) ->
                    if (column > 0) Spacer(GlanceModifier.width(4.dp))
                    Box(
                        modifier = GlanceModifier
                            .defaultWeight()
                            .fillMaxHeight()
                            .background(ImageProvider(background))
                            .clickable(openApp(context, "$SEARCH_PATH?type=$domain")),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            context.getString(label),
                            style = TextStyle(color = ink, fontSize = 12.sp, fontWeight = FontWeight.Medium, textAlign = TextAlign.Center),
                            maxLines = 1,
                        )
                    }
                }
            }
        }
    }
}

private val BAR_HEIGHT = 46.dp

@Composable
private fun SearchBands(added: List<WidgetAdded>, posters: Map<String, Poster>, cells: Cells) {
    val context = LocalContext.current

    if (cells.single) {
        Column(modifier = GlanceModifier.fillMaxSize()) {
            Column(
                modifier = GlanceModifier
                    .fillMaxWidth()
                    .defaultWeight()
                    .background(ImageProvider(R.drawable.widget_panel_field_bg))
                    .clickable(openApp(context, SEARCH_PATH))
                    .padding(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Image(
                    ImageProvider(R.drawable.ic_widget_search),
                    contentDescription = null,
                    modifier = GlanceModifier.size(28.dp),
                    colorFilter = ColorFilter.tint(WidgetColors.fg),
                )
                Spacer(GlanceModifier.height(6.dp))
                Text(context.getString(R.string.widget_search_title), style = sans(16.sp, WidgetColors.fg, FontWeight.Bold), maxLines = 1)
                Text(context.getString(R.string.widget_search_hint), style = sans(12.sp, WidgetColors.dim), maxLines = 2)
            }
            Spacer(GlanceModifier.height(6.dp))
            Row(
                modifier = GlanceModifier
                    .fillMaxWidth()
                    .height(BAR_HEIGHT)
                    .background(ImageProvider(R.drawable.widget_scan_bg))
                    .clickable(openApp(context, SCAN_PATH)),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Image(
                    ImageProvider(R.drawable.ic_widget_scan),
                    contentDescription = null,
                    modifier = GlanceModifier.size(18.dp),
                    colorFilter = ColorFilter.tint(ScanOnAmber),
                )
                Spacer(GlanceModifier.width(6.dp))
                Text(context.getString(R.string.widget_scan), style = sans(13.sp, ScanOnAmber, FontWeight.Bold), maxLines = 1)
            }
        }
        return
    }

    Column(modifier = GlanceModifier.fillMaxSize()) {
        WidgetHeader(context.getString(R.string.widget_search_name), null, STYLE_POSTERS)
        Spacer(GlanceModifier.height(4.dp))
        Row(modifier = GlanceModifier.fillMaxWidth().height(BAR_HEIGHT)) {
            Row(
                modifier = GlanceModifier
                    .defaultWeight()
                    .fillMaxHeight()
                    .background(ImageProvider(R.drawable.widget_field_bg))
                    .clickable(openApp(context, SEARCH_PATH))
                    .padding(horizontal = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Image(
                    ImageProvider(R.drawable.ic_widget_search),
                    contentDescription = null,
                    modifier = GlanceModifier.size(18.dp),
                    colorFilter = ColorFilter.tint(WidgetColors.dim),
                )
                Spacer(GlanceModifier.width(10.dp))
                Text(context.getString(R.string.widget_search_hint), style = sans(14.sp, WidgetColors.dim), maxLines = 1)
            }
            Spacer(GlanceModifier.width(6.dp))
            Box(
                modifier = GlanceModifier
                    .size(BAR_HEIGHT)
                    .background(ImageProvider(R.drawable.widget_scan_bg))
                    .clickable(openApp(context, SCAN_PATH)),
                contentAlignment = Alignment.Center,
            ) {
                Image(
                    ImageProvider(R.drawable.ic_widget_scan),
                    contentDescription = context.getString(R.string.widget_scan_label),
                    modifier = GlanceModifier.size(20.dp),
                    colorFilter = ColorFilter.tint(ScanOnAmber),
                )
            }
        }
        Spacer(GlanceModifier.height(6.dp))
        CategoryChips(cells, R.drawable.widget_chip_bg, WidgetColors.fg)

        if (cells.rows >= 3 && added.isNotEmpty()) {
            val (cols, rows) = posterGrid(cells)
            Spacer(GlanceModifier.height(6.dp))
            Box(modifier = GlanceModifier.fillMaxWidth().defaultWeight()) {
                BandGrid(added.take(cols * (rows - 1).coerceAtLeast(1)), cols) { item, modifier ->
                    BandTile(
                        modifier = modifier,
                        poster = posters.of(item),
                        title = item.title,
                        meta = item.kindLabel(context),
                        metaLive = false,
                        open = openApp(context, item.path),
                        action = null,
                        actionLabel = null,
                        checked = false,
                        big = false,
                    )
                }
            }
        }
    }
}

@Composable
private fun SearchTickets(added: List<WidgetAdded>, posters: Map<String, Poster>, cells: Cells) {
    val context = LocalContext.current

    if (cells.single) {
        SingleTicket(
            poster = null,
            title = context.getString(R.string.widget_search_title),
            sub = context.getString(R.string.widget_search_hint),
            stubBig = context.getString(R.string.widget_scan),
            stubSmall = context.getString(R.string.widget_scan_hint),
            open = openApp(context, SEARCH_PATH),
            action = openApp(context, SCAN_PATH),
            actionLabel = context.getString(R.string.widget_scan_label),
            checked = false,
            actionIcon = R.drawable.ic_widget_scan,
            leading = {
                Image(
                    ImageProvider(R.drawable.ic_widget_search),
                    contentDescription = null,
                    modifier = GlanceModifier.size(30.dp),
                    colorFilter = ColorFilter.tint(WidgetColors.accent),
                )
            },
        )
        return
    }

    Column(modifier = GlanceModifier.fillMaxSize()) {
        WidgetHeader(context.getString(R.string.widget_search_name), null, STYLE_LIST)
        Spacer(GlanceModifier.height(4.dp))
        Row(modifier = GlanceModifier.fillMaxWidth().height(44.dp)) {
            Row(
                modifier = GlanceModifier
                    .defaultWeight()
                    .fillMaxHeight()
                    .background(ImageProvider(R.drawable.widget_stub_bg))
                    .clickable(openApp(context, SEARCH_PATH))
                    .padding(horizontal = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Image(
                    ImageProvider(R.drawable.ic_widget_search),
                    contentDescription = null,
                    modifier = GlanceModifier.size(18.dp),
                    colorFilter = ColorFilter.tint(WidgetColors.ticketDim),
                )
                Spacer(GlanceModifier.width(8.dp))
                Text(context.getString(R.string.widget_search_hint), style = sans(14.sp, WidgetColors.ticketDim), maxLines = 1)
            }
            Spacer(GlanceModifier.width(2.dp))
            Box(
                modifier = GlanceModifier
                    .width(48.dp)
                    .fillMaxHeight()
                    .background(ImageProvider(R.drawable.widget_ticket_bg))
                    .clickable(openApp(context, SCAN_PATH)),
                contentAlignment = Alignment.Center,
            ) {
                Image(
                    ImageProvider(R.drawable.ic_widget_scan),
                    contentDescription = context.getString(R.string.widget_scan_label),
                    modifier = GlanceModifier.size(20.dp),
                    colorFilter = ColorFilter.tint(WidgetColors.ticketInk),
                )
            }
        }
        Spacer(GlanceModifier.height(4.dp))
        CategoryChips(cells, R.drawable.widget_chip_ticket_bg, WidgetColors.ticketInk)

        if (cells.rows >= 3) {
            val stripHeight = 50.dp
            val chipRows = if (cells.cols >= 5) 1 else 2
            val used = 12.dp + 30.dp + 48.dp + (34.dp * chipRows)
            val rows = ((LocalSize.current.height - used) / (stripHeight + 4.dp)).toInt().coerceIn(0, added.size)
            added.take(rows).forEach { item ->
                Spacer(GlanceModifier.height(4.dp))
                TicketStrip(
                    height = stripHeight,
                    stubWidth = if (cells.cols >= 4) 78.dp else 66.dp,
                    stubTop = item.kindLabel(context),
                    stubBottom = "",
                    stubLive = false,
                    poster = posters.of(item),
                    title = item.title,
                    sub = context.getString(R.string.widget_added_name),
                    open = openApp(context, item.path),
                    action = null,
                    actionLabel = null,
                    checked = false,
                )
            }
        }
    }
}
