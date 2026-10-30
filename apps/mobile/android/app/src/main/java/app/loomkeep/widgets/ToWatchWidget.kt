package app.loomkeep.widgets

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.unit.dp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.LocalContext
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
import java.util.Locale

/** « À suivre » (MOB-20): the shows in progress, and a ✓ to check off the next episode. */
class ToWatchWidget : GlanceAppWidget() {
    override val sizeMode = SizeMode.Exact
    override val stateDefinition: GlanceStateDefinition<*> = PreferencesGlanceStateDefinition

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        WidgetRepository.ensure(context)

        provideContent {
            val snapshot by WidgetRepository.snapshot.collectAsState()
            val style = currentState(STYLE_KEY) ?: STYLE_POSTERS
            val data = snapshot?.data ?: WidgetData.SignedOut
            val shows = (data as? WidgetData.Ready)?.feed?.toWatch.orEmpty()
            val cells = currentCells()

            WidgetFrame(style, edgeToEdge = style == STYLE_POSTERS && cells.single && shows.isNotEmpty()) {
                when {
                    data == WidgetData.SignedOut -> WidgetMessage(R.string.widget_signed_out, style)
                    data == WidgetData.Offline -> WidgetMessage(R.string.widget_offline, style)
                    shows.isEmpty() -> WidgetMessage(R.string.widget_to_watch_empty, style)
                    style == STYLE_LIST -> ShowTickets(shows, snapshot?.posters.orEmpty(), snapshot?.checking, cells)
                    else -> ShowBands(shows, snapshot?.posters.orEmpty(), snapshot?.checking, cells)
                }
            }
        }
    }

    override suspend fun providePreview(context: Context, widgetCategory: Int) {
        provideContent {
            WidgetFrame(STYLE_POSTERS, edgeToEdge = false) {
                ShowBands(WidgetSamples.shows, emptyMap(), null, currentCells())
            }
        }
    }
}

class ToWatchWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = ToWatchWidget()
}

/** The ✓: marks the episode the widget showed, then redraws both widgets from the API's answer. */
class WatchNextAction : ActionCallback {
    override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) {
        val entryId = parameters[ENTRY_ID] ?: return
        val episodeId = parameters[EPISODE_ID] ?: return
        widgetTick(context)
        WidgetRepository.watchNext(context, entryId, episodeId)
    }

    companion object {
        val ENTRY_ID = ActionParameters.Key<String>("entryId")
        val EPISODE_ID = ActionParameters.Key<String>("episodeId")
    }
}

private fun WidgetShow.code() = "S%02dE%02d".format(Locale.ROOT, seasonNumber, episodeNumber)

private fun WidgetShow.watchNext() = actionRunCallback<WatchNextAction>(
    actionParametersOf(WatchNextAction.ENTRY_ID to entryId, WatchNextAction.EPISODE_ID to episodeId),
)

private fun WidgetShow.checkLabel(context: Context) = context.getString(R.string.widget_mark_watched, code(), title)

private fun WidgetShow.left(context: Context): String {
    val left = totalEpisodes - watchedEpisodes
    return if (left <= 1) context.getString(R.string.widget_last_episode) else context.getString(R.string.widget_episodes_left, left)
}

private fun Map<String, Poster>.of(show: WidgetShow) = show.posterUrl?.let { this[it] }

@Composable
private fun ShowBands(shows: List<WidgetShow>, posters: Map<String, Poster>, checking: String?, cells: Cells) {
    val context = LocalContext.current
    val (cols, rows) = posterGrid(cells)

    if (cells.single) {
        val show = shows.first()
        BandTile(
            modifier = GlanceModifier.fillMaxSize(),
            poster = posters.of(show),
            title = show.title,
            meta = "${show.code()}, ${show.left(context)}",
            metaLive = false,
            open = openApp(context, show.path),
            action = show.watchNext(),
            actionLabel = show.checkLabel(context),
            checked = show.entryId == checking,
            big = true,
        )
        return
    }

    Column(modifier = GlanceModifier.fillMaxSize()) {
        WidgetHeader(context.getString(R.string.widget_to_watch_name), context.getString(R.string.widget_in_progress, shows.size), STYLE_POSTERS)
        Spacer(GlanceModifier.height(4.dp))
        Box(modifier = GlanceModifier.fillMaxWidth().defaultWeight()) {
            BandGrid(shows.take(cols * rows), cols) { show, modifier ->
                BandTile(
                    modifier = modifier,
                    poster = posters.of(show),
                    title = show.title,
                    meta = show.code(),
                    metaLive = false,
                    open = openApp(context, show.path),
                    action = show.watchNext(),
                    actionLabel = show.checkLabel(context),
                    checked = show.entryId == checking,
                    big = false,
                )
            }
        }
    }
}

@Composable
private fun ShowTickets(shows: List<WidgetShow>, posters: Map<String, Poster>, checking: String?, cells: Cells) {
    val context = LocalContext.current

    if (cells.single) {
        val show = shows.first()
        SingleTicket(
            poster = posters.of(show),
            title = show.title,
            sub = show.left(context),
            stubBig = show.code(),
            stubSmall = context.getString(R.string.widget_next_episode),
            open = openApp(context, show.path),
            action = show.watchNext(),
            actionLabel = show.checkLabel(context),
            checked = show.entryId == checking,
        )
        return
    }

    val stripHeight = if (cells.rows == 2) 42.dp else 50.dp
    Column(modifier = GlanceModifier.fillMaxSize()) {
        WidgetHeader(context.getString(R.string.widget_to_watch_name), context.getString(R.string.widget_in_progress, shows.size), STYLE_LIST)
        shows.take(ticketCount(stripHeight)).forEach { show ->
            Spacer(GlanceModifier.height(4.dp))
            TicketStrip(
                height = stripHeight,
                stubWidth = if (cells.cols >= 4) 78.dp else 66.dp,
                stubTop = show.code(),
                stubBottom = show.left(context),
                stubLive = false,
                poster = posters.of(show),
                title = show.title,
                sub = context.getString(R.string.widget_watched_of, show.watchedEpisodes, show.totalEpisodes),
                open = openApp(context, show.path),
                action = show.watchNext(),
                actionLabel = show.checkLabel(context),
                checked = show.entryId == checking,
            )
        }
    }
}
