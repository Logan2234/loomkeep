package app.loomkeep.widgets

import android.content.Context
import android.text.format.DateFormat
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.unit.dp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.LocalContext
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.provideContent
import androidx.glance.currentState
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.state.GlanceStateDefinition
import androidx.glance.state.PreferencesGlanceStateDefinition
import app.loomkeep.R
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/** « Sorties » (MOB-20): today's releases among what's followed, else the next ones. */
class ReleasesWidget : GlanceAppWidget() {
    override val sizeMode = SizeMode.Exact
    override val stateDefinition: GlanceStateDefinition<*> = PreferencesGlanceStateDefinition

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        WidgetRepository.ensure(context)

        provideContent {
            val snapshot by WidgetRepository.snapshot.collectAsState()
            val style = currentState(STYLE_KEY) ?: STYLE_POSTERS
            val data = snapshot?.data ?: WidgetData.SignedOut
            val releases = (data as? WidgetData.Ready)?.feed?.releases.orEmpty()
            val cells = currentCells()

            WidgetFrame(style, edgeToEdge = style == STYLE_POSTERS && cells.single && releases.isNotEmpty()) {
                when {
                    data == WidgetData.SignedOut -> WidgetMessage(R.string.widget_signed_out, style)
                    data == WidgetData.Offline -> WidgetMessage(R.string.widget_offline, style)
                    releases.isEmpty() -> WidgetMessage(R.string.widget_releases_empty, style)
                    style == STYLE_LIST -> ReleaseTickets(releases, snapshot?.posters.orEmpty(), cells)
                    else -> ReleaseBands(releases, snapshot?.posters.orEmpty(), cells)
                }
            }
        }
    }

    override suspend fun providePreview(context: Context, widgetCategory: Int) {
        provideContent {
            WidgetFrame(STYLE_POSTERS, edgeToEdge = false) {
                ReleaseBands(WidgetSamples.releases(), emptyMap(), currentCells())
            }
        }
    }
}

class ReleasesWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = ReleasesWidget()
}

// A release dated without a time (TMDB) comes as midnight UTC: a calendar
// day, not an instant, which would land on the day before west of Greenwich.
private fun WidgetRelease.datedOnly(): Boolean {
    val utc = Calendar.getInstance(TimeZone.getTimeZone("UTC")).apply { timeInMillis = airDate }
    return utc.get(Calendar.HOUR_OF_DAY) == 0 && utc.get(Calendar.MINUTE) == 0
}

/** The release's day on this device's calendar. */
private fun WidgetRelease.localDay(): Calendar {
    if (!datedOnly()) return Calendar.getInstance().apply { timeInMillis = airDate }
    val utc = Calendar.getInstance(TimeZone.getTimeZone("UTC")).apply { timeInMillis = airDate }
    return Calendar.getInstance().apply {
        clear()
        set(utc.get(Calendar.YEAR), utc.get(Calendar.MONTH), utc.get(Calendar.DAY_OF_MONTH))
    }
}

private fun daysFromToday(day: Calendar): Int {
    val today = Calendar.getInstance()
    val start = Calendar.getInstance().apply {
        clear()
        set(today.get(Calendar.YEAR), today.get(Calendar.MONTH), today.get(Calendar.DAY_OF_MONTH))
    }
    val target = Calendar.getInstance().apply {
        clear()
        set(day.get(Calendar.YEAR), day.get(Calendar.MONTH), day.get(Calendar.DAY_OF_MONTH))
    }
    return Math.round((target.timeInMillis - start.timeInMillis) / 86_400_000.0).toInt()
}

private fun WidgetRelease.isToday() = daysFromToday(localDay()) <= 0

private fun WidgetRelease.dayLabel(context: Context): String {
    val locale = Locale.getDefault()
    val day = localDay()
    val label = when {
        isToday() -> return context.getString(R.string.widget_today_short)
        daysFromToday(day) == 1 -> context.getString(R.string.widget_tomorrow)
        monthOnly -> SimpleDateFormat("MMM yyyy", locale).format(day.time)
        else -> SimpleDateFormat("EEE d", locale).format(day.time)
    }
    return label.uppercase(locale)
}

/** Its local time, when the source gave one (AniList broadcasts). */
private fun WidgetRelease.time(context: Context): String? =
    if (datedOnly()) null else DateFormat.getTimeFormat(context).format(Date(airDate))

private fun WidgetRelease.what(context: Context): String = when (kind) {
    "MOVIE" -> context.getString(R.string.widget_movie)
    "GAME" -> context.getString(R.string.widget_game)
    else -> "S%02dE%02d".format(Locale.ROOT, seasonNumber ?: 0, episodeNumber ?: 0)
}

private fun Map<String, Poster>.of(release: WidgetRelease) = release.posterUrl?.let { this[it] }

/** « Sorties du jour » with today's count, else « Prochaines sorties ». */
@Composable
private fun ReleasesHeader(releases: List<WidgetRelease>, style: String) {
    val context = LocalContext.current
    val today = releases.count { it.isToday() }
    WidgetHeader(
        context.getString(if (today > 0) R.string.widget_releases_today else R.string.widget_releases_next),
        if (today > 0) context.getString(R.string.widget_today_count, today) else null,
        style,
    )
}

@Composable
private fun ReleaseBands(releases: List<WidgetRelease>, posters: Map<String, Poster>, cells: Cells) {
    val context = LocalContext.current
    val (cols, rows) = posterGrid(cells)
    val meta = { release: WidgetRelease ->
        listOfNotNull(release.dayLabel(context), if (release.isToday()) release.time(context) else null, release.what(context))
            .joinToString(" ")
    }

    if (cells.single) {
        val release = releases.first()
        BandTile(
            modifier = GlanceModifier.fillMaxSize(),
            poster = posters.of(release),
            title = release.title,
            meta = meta(release),
            metaLive = release.isToday(),
            open = openApp(context, release.path),
            action = null,
            actionLabel = null,
            checked = false,
            big = true,
        )
        return
    }

    Column(modifier = GlanceModifier.fillMaxSize()) {
        ReleasesHeader(releases, STYLE_POSTERS)
        Spacer(GlanceModifier.height(4.dp))
        Box(modifier = GlanceModifier.fillMaxWidth().defaultWeight()) {
            BandGrid(releases.take(cols * rows), cols) { release, modifier ->
                BandTile(
                    modifier = modifier,
                    poster = posters.of(release),
                    title = release.title,
                    meta = meta(release),
                    metaLive = release.isToday(),
                    open = openApp(context, release.path),
                    action = null,
                    actionLabel = null,
                    checked = false,
                    big = false,
                )
            }
        }
    }
}

@Composable
private fun ReleaseTickets(releases: List<WidgetRelease>, posters: Map<String, Poster>, cells: Cells) {
    val context = LocalContext.current

    if (cells.single) {
        val release = releases.first()
        SingleTicket(
            poster = posters.of(release),
            title = release.title,
            sub = release.what(context),
            stubBig = listOfNotNull(release.dayLabel(context), if (release.isToday()) release.time(context) else null).joinToString(" "),
            stubSmall = releases.count { it.isToday() }.takeIf { it > 0 }
                ?.let { context.getString(R.string.widget_today_count, it) }
                .orEmpty(),
            open = openApp(context, release.path),
            action = null,
            actionLabel = null,
            checked = false,
        )
        return
    }

    val stripHeight = if (cells.rows == 2) 42.dp else 50.dp
    Column(modifier = GlanceModifier.fillMaxSize()) {
        ReleasesHeader(releases, STYLE_LIST)
        releases.take(ticketCount(stripHeight)).forEach { release ->
            Spacer(GlanceModifier.height(4.dp))
            TicketStrip(
                height = stripHeight,
                stubWidth = if (cells.cols >= 4) 78.dp else 66.dp,
                stubTop = release.dayLabel(context),
                stubBottom = release.time(context).orEmpty(),
                stubLive = release.isToday(),
                poster = posters.of(release),
                title = release.title,
                sub = release.what(context),
                open = openApp(context, release.path),
                action = null,
                actionLabel = null,
                checked = false,
            )
        }
    }
}
