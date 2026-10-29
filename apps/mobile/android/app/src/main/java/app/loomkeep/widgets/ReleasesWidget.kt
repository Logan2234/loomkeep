package app.loomkeep.widgets

import android.content.Context
import android.graphics.Bitmap
import android.text.format.DateFormat
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.LocalContext
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.provideContent
import androidx.glance.currentState
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.width
import androidx.glance.state.GlanceStateDefinition
import androidx.glance.state.PreferencesGlanceStateDefinition
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import app.loomkeep.R
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/** « Sorties » (MOB-20): today's releases among what's followed, else the next ones. */
class ReleasesWidget : GlanceAppWidget() {
    override val sizeMode = SizeMode.Responsive(WIDGET_SIZES)
    override val stateDefinition: GlanceStateDefinition<*> = PreferencesGlanceStateDefinition

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val data = WidgetRepository.load(context)
        val posters = (data as? WidgetData.Ready)
            ?.let { WidgetPosters.load(context, it.feed.releases.map(WidgetRelease::posterUrl)) }
            .orEmpty()

        provideContent {
            val style = currentState(STYLE_KEY) ?: STYLE_POSTERS
            WidgetFrame {
                when (data) {
                    WidgetData.SignedOut -> WidgetMessage(R.string.widget_signed_out)
                    WidgetData.Offline -> WidgetMessage(R.string.widget_offline)
                    is WidgetData.Ready -> when {
                        data.feed.releases.isEmpty() -> WidgetMessage(R.string.widget_releases_empty)
                        style == STYLE_LIST -> ReleaseList(data.feed.releases, posters)
                        else -> ReleasePosters(data.feed.releases, posters)
                    }
                }
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

private fun WidgetRelease.chip(context: Context): String =
    listOfNotNull(dayLabel(context), if (isToday()) time(context) else null).joinToString(" ")

private fun Map<String, Bitmap>.of(release: WidgetRelease) = release.posterUrl?.let { this[it] }

@Composable
private fun ReleasePosters(releases: List<WidgetRelease>, posters: Map<String, Bitmap>) {
    val context = LocalContext.current
    val layout = currentLayout()

    Column(modifier = GlanceModifier.fillMaxSize()) {
        if (layout == WidgetLayout.LARGE) {
            ReleasesHeader(releases)
            Spacer(GlanceModifier.height(6.dp))
        }
        Box(modifier = GlanceModifier.fillMaxWidth().defaultWeight()) {
            PosterGrid(releases.take(layout.items), layout) { release, modifier ->
                PosterTile(
                    modifier = modifier,
                    poster = posters.of(release),
                    chip = release.chip(context),
                    chipOnMarquee = release.isToday(),
                    title = release.title,
                    subtitle = release.what(context),
                    open = openApp(context, release.path),
                    check = null,
                    checkLabel = null,
                    progress = null,
                    titleSize = if (layout == WidgetLayout.SMALL) 17.sp else 14.sp,
                )
            }
        }
    }
}

@Composable
private fun ReleasesHeader(releases: List<WidgetRelease>) {
    val context = LocalContext.current
    val today = releases.count { it.isToday() }
    WidgetHeader(
        context.getString(if (today > 0) R.string.widget_releases_today else R.string.widget_releases_next),
        if (today > 0) "%02d".format(Locale.ROOT, today) else null,
        WidgetColors.accent,
        logo = false,
    )
}

@Composable
private fun ReleaseList(releases: List<WidgetRelease>, posters: Map<String, Bitmap>) {
    val context = LocalContext.current
    val layout = currentLayout()
    val large = layout == WidgetLayout.LARGE
    // The 2 × 2 fits two short rows rather than one.
    val count = if (layout == WidgetLayout.SMALL) 2 else layout.items

    Column(modifier = GlanceModifier.fillMaxSize()) {
        ReleasesHeader(releases)
        releases.take(count).forEachIndexed { index, release ->
            if (index > 0) Divider()
            Row(
                modifier = GlanceModifier
                    .fillMaxWidth()
                    .defaultWeight()
                    .padding(horizontal = 6.dp)
                    .clickable(openApp(context, release.path)),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                PosterThumb(posters.of(release), if (large) 32.dp else 26.dp, if (large) 46.dp else 38.dp)
                Spacer(GlanceModifier.width(10.dp))
                Column(modifier = GlanceModifier.defaultWeight()) {
                    Text(release.title, style = sans(14.sp, WidgetColors.fg, FontWeight.Bold), maxLines = 1)
                    Text(
                        "${release.dayLabel(context)} · ${release.what(context)}",
                        style = mono(12.sp, WidgetColors.dim),
                        maxLines = 1,
                    )
                }
                val time = if (release.isToday()) release.time(context) else null
                if (time != null && layout != WidgetLayout.SMALL) {
                    Spacer(GlanceModifier.width(8.dp))
                    Text(time, style = mono(12.sp, WidgetColors.accent), maxLines = 1)
                }
            }
        }
    }
}
