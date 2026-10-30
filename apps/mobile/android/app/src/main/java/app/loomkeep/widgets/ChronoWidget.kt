package app.loomkeep.widgets

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.unit.dp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.LocalContext
import androidx.glance.action.Action
import androidx.glance.action.ActionParameters
import androidx.glance.action.actionParametersOf
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.action.ActionCallback
import androidx.glance.appwidget.action.actionRunCallback
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
import java.util.Locale
import org.json.JSONObject

/** « Chrono » (MOB-20): the session timer, and the games and books to start it on. */
class ChronoWidget : GlanceAppWidget() {
    override val sizeMode = SizeMode.Exact
    override val stateDefinition: GlanceStateDefinition<*> = PreferencesGlanceStateDefinition

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        WidgetRepository.ensure(context)

        provideContent {
            val snapshot by WidgetRepository.snapshot.collectAsState()
            val style = currentState(STYLE_KEY) ?: STYLE_POSTERS
            val data = snapshot?.data ?: WidgetData.SignedOut
            val feed = (data as? WidgetData.Ready)?.feed
            val items = chronoItems(feed)
            val cells = currentCells()
            val posters = snapshot?.posters.orEmpty()

            WidgetFrame(style, edgeToEdge = style == STYLE_POSTERS && cells.single && items.isNotEmpty()) {
                when {
                    data == WidgetData.SignedOut -> WidgetMessage(R.string.widget_signed_out, style)
                    data == WidgetData.Offline -> WidgetMessage(R.string.widget_offline, style)
                    items.isEmpty() -> WidgetMessage(R.string.widget_chrono_empty, style)
                    style == STYLE_LIST -> ChronoTickets(items, feed?.weekMinutes ?: 0, posters, cells)
                    else -> ChronoBands(items, feed?.weekMinutes ?: 0, posters, cells)
                }
            }
        }
    }

    override suspend fun providePreview(context: Context, widgetCategory: Int) {
        provideContent {
            WidgetFrame(STYLE_POSTERS, edgeToEdge = false) {
                ChronoBands(chronoItems(WidgetSamples.chrono()), 400, emptyMap(), currentCells())
            }
        }
    }
}

class ChronoWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = ChronoWidget()
}

/** A step of the session timer, from a widget's button. */
class TimerAction : ActionCallback {
    override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) {
        val step = parameters[STEP] ?: return
        val body = parameters[ENTRY_ID]?.let { entryId ->
            JSONObject().put("domain", parameters[DOMAIN]).put("entryId", entryId)
        }
        widgetTick(context)
        WidgetRepository.timerStep(context, step, body)
    }

    companion object {
        val STEP = ActionParameters.Key<String>("step")
        val DOMAIN = ActionParameters.Key<String>("domain")
        val ENTRY_ID = ActionParameters.Key<String>("entryId")
    }
}

/** The running timer, or a game or book it can start on. */
private sealed interface ChronoItem {
    val title: String
    val posterUrl: String?
    val path: String

    data class Live(val timer: WidgetTimer) : ChronoItem {
        override val title get() = timer.title
        override val posterUrl get() = timer.posterUrl
        override val path get() = timer.path
    }

    data class Past(val session: WidgetSession, val canStart: Boolean) : ChronoItem {
        override val title get() = session.title
        override val posterUrl get() = session.posterUrl
        override val path get() = session.path
    }
}

// Only one timer runs at a time: others can't start while it does.
private fun chronoItems(feed: WidgetFeed?): List<ChronoItem> {
    if (feed == null) return emptyList()
    val timer = feed.timer
    return listOfNotNull(timer?.let { ChronoItem.Live(it) }) +
        feed.sessions.map { ChronoItem.Past(it, canStart = timer == null) }
}

private fun step(step: String) =
    actionRunCallback<TimerAction>(actionParametersOf(TimerAction.STEP to step))

private fun WidgetSession.start() = actionRunCallback<TimerAction>(
    actionParametersOf(TimerAction.STEP to "start", TimerAction.DOMAIN to domain, TimerAction.ENTRY_ID to entryId),
)

/** Stopping a book asks for the pages read: its page in the app, which opens the form. */
private fun WidgetTimer.stop(context: Context): Action =
    if (domain == "BOOKS") openApp(context, "$path?finishSession=1") else step("finish")

private fun WidgetTimer.pauseButton(context: Context) = if (paused) {
    TileButton(step("resume"), context.getString(R.string.widget_timer_resume), R.drawable.ic_widget_play)
} else {
    TileButton(step("pause"), context.getString(R.string.widget_timer_pause), R.drawable.ic_widget_pause)
}

/** What the clock shows: what the feed counted, plus the time since it was read. */
private fun WidgetTimer.elapsedMillis(context: Context): Long =
    elapsedSeconds * 1000 + if (paused) 0 else WidgetStore.feedAge(context).coerceAtLeast(0)

private fun WidgetTimer.stateLabel(context: Context) =
    context.getString(if (paused) R.string.widget_timer_paused else R.string.widget_timer_running)

private fun kindLabel(context: Context, domain: String) =
    context.getString(if (domain == "BOOKS") R.string.widget_book else R.string.widget_game)

internal fun durationLabel(minutes: Int): String =
    if (minutes < 60) "$minutes min" else "%d h %02d".format(Locale.ROOT, minutes / 60, minutes % 60)

private fun WidgetSession.dayLabel(context: Context): String {
    val day = Calendar.getInstance().apply { timeInMillis = occurredAt }
    return when (daysFromToday(day)) {
        0 -> context.getString(R.string.widget_today_short)
        -1 -> context.getString(R.string.widget_yesterday)
        else -> SimpleDateFormat("EEE d", Locale.getDefault()).format(day.time)
    }
}

private fun Map<String, Poster>.of(item: ChronoItem) = item.posterUrl?.let { this[it] }

@Composable
private fun ChronoBand(item: ChronoItem, posters: Map<String, Poster>, modifier: GlanceModifier, big: Boolean) {
    val context = LocalContext.current
    when (item) {
        is ChronoItem.Live -> BandTile(
            modifier = modifier,
            poster = posters.of(item),
            title = item.title,
            meta = "",
            metaLive = true,
            open = openApp(context, item.path),
            action = item.timer.stop(context),
            actionLabel = context.getString(R.string.widget_timer_stop),
            checked = false,
            big = big,
            actionIcon = R.drawable.ic_widget_stop,
            secondary = item.timer.pauseButton(context),
            metaContent = {
                LiveClock(item.timer.elapsedMillis(context), !item.timer.paused, onBand = true, sizeSp = if (big) 14f else 12f)
            },
        )
        is ChronoItem.Past -> BandTile(
            modifier = modifier,
            poster = posters.of(item),
            title = item.title,
            meta = "${item.session.dayLabel(context)}, ${durationLabel(item.session.durationMinutes)}",
            metaLive = false,
            open = openApp(context, item.path),
            action = if (item.canStart) item.session.start() else null,
            actionLabel = context.getString(R.string.widget_timer_start, item.title),
            checked = false,
            big = big,
            actionIcon = R.drawable.ic_widget_play,
        )
    }
}

@Composable
private fun ChronoBands(items: List<ChronoItem>, weekMinutes: Int, posters: Map<String, Poster>, cells: Cells) {
    val context = LocalContext.current
    val (cols, rows) = posterGrid(cells)

    if (cells.single) {
        ChronoBand(items.first(), posters, GlanceModifier.fillMaxSize(), big = true)
        return
    }

    Column(modifier = GlanceModifier.fillMaxSize()) {
        WidgetHeader(
            context.getString(R.string.widget_chrono_name),
            context.getString(R.string.widget_week_total, durationLabel(weekMinutes)),
            STYLE_POSTERS,
        )
        Spacer(GlanceModifier.height(4.dp))
        Box(modifier = GlanceModifier.fillMaxWidth().defaultWeight()) {
            BandGrid(items.take(cols * rows), cols) { item, modifier ->
                ChronoBand(item, posters, modifier, big = false)
            }
        }
    }
}

@Composable
private fun ChronoTickets(items: List<ChronoItem>, weekMinutes: Int, posters: Map<String, Poster>, cells: Cells) {
    val context = LocalContext.current

    if (cells.single) {
        when (val item = items.first()) {
            is ChronoItem.Live -> SingleTicket(
                poster = posters.of(item),
                title = item.title,
                sub = kindLabel(context, item.timer.domain),
                stubBig = "",
                stubSmall = item.timer.stateLabel(context),
                open = openApp(context, item.path),
                action = item.timer.stop(context),
                actionLabel = context.getString(R.string.widget_timer_stop),
                checked = false,
                actionIcon = R.drawable.ic_widget_stop,
                stubContent = { LiveClock(item.timer.elapsedMillis(context), !item.timer.paused, onBand = false, sizeSp = 17f) },
            )
            is ChronoItem.Past -> SingleTicket(
                poster = posters.of(item),
                title = item.title,
                sub = kindLabel(context, item.session.domain),
                stubBig = durationLabel(item.session.durationMinutes),
                stubSmall = item.session.dayLabel(context),
                open = openApp(context, item.path),
                action = if (item.canStart) item.session.start() else null,
                actionLabel = context.getString(R.string.widget_timer_start, item.title),
                checked = false,
                actionIcon = R.drawable.ic_widget_play,
            )
        }
        return
    }

    val stripHeight = if (cells.rows == 2) 42.dp else 50.dp
    val stubWidth = if (cells.cols >= 4) 78.dp else 66.dp
    Column(modifier = GlanceModifier.fillMaxSize()) {
        WidgetHeader(
            context.getString(R.string.widget_chrono_name),
            context.getString(R.string.widget_week_total, durationLabel(weekMinutes)),
            STYLE_LIST,
        )
        items.take(ticketCount(stripHeight)).forEach { item ->
            Spacer(GlanceModifier.height(4.dp))
            when (item) {
                is ChronoItem.Live -> TicketStrip(
                    height = stripHeight,
                    stubWidth = stubWidth,
                    stubTop = "",
                    stubBottom = item.timer.stateLabel(context),
                    stubLive = true,
                    poster = posters.of(item),
                    title = item.title,
                    sub = kindLabel(context, item.timer.domain),
                    open = openApp(context, item.path),
                    action = item.timer.stop(context),
                    actionLabel = context.getString(R.string.widget_timer_stop),
                    checked = false,
                    actionIcon = R.drawable.ic_widget_stop,
                    secondary = item.timer.pauseButton(context),
                    stubContent = { LiveClock(item.timer.elapsedMillis(context), !item.timer.paused, onBand = false, sizeSp = 12f) },
                )
                is ChronoItem.Past -> TicketStrip(
                    height = stripHeight,
                    stubWidth = stubWidth,
                    stubTop = durationLabel(item.session.durationMinutes),
                    stubBottom = item.session.dayLabel(context),
                    stubLive = false,
                    poster = posters.of(item),
                    title = item.title,
                    sub = kindLabel(context, item.session.domain),
                    open = openApp(context, item.path),
                    action = if (item.canStart) item.session.start() else null,
                    actionLabel = context.getString(R.string.widget_timer_start, item.title),
                    checked = false,
                    actionIcon = R.drawable.ic_widget_play,
                )
            }
        }
    }
}
