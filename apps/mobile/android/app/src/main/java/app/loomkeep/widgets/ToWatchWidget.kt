package app.loomkeep.widgets

import android.content.Context
import android.graphics.Bitmap
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.ColorFilter
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.LocalContext
import androidx.glance.action.ActionParameters
import androidx.glance.action.actionParametersOf
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.LinearProgressIndicator
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.action.ActionCallback
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.appwidget.provideContent
import androidx.glance.background
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
import androidx.glance.layout.size
import androidx.glance.layout.width
import androidx.glance.state.GlanceStateDefinition
import androidx.glance.state.PreferencesGlanceStateDefinition
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.unit.ColorProvider
import app.loomkeep.R
import java.util.Locale

/** « À suivre » (MOB-20): the shows in progress, and a ✓ to check off the next episode. */
class ToWatchWidget : GlanceAppWidget() {
    override val sizeMode = SizeMode.Responsive(WIDGET_SIZES)
    override val stateDefinition: GlanceStateDefinition<*> = PreferencesGlanceStateDefinition

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val data = WidgetRepository.load(context)
        val posters = (data as? WidgetData.Ready)
            ?.let { WidgetPosters.load(context, it.feed.toWatch.map(WidgetShow::posterUrl)) }
            .orEmpty()

        provideContent {
            val style = currentState(STYLE_KEY) ?: STYLE_POSTERS
            WidgetFrame {
                when (data) {
                    WidgetData.SignedOut -> WidgetMessage(R.string.widget_signed_out)
                    WidgetData.Offline -> WidgetMessage(R.string.widget_offline)
                    is WidgetData.Ready -> when {
                        data.feed.toWatch.isEmpty() -> WidgetMessage(R.string.widget_to_watch_empty)
                        style == STYLE_LIST -> ShowList(data.feed.toWatch, posters)
                        else -> ShowPosters(data.feed.toWatch, posters)
                    }
                }
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
        tick(context)
        WidgetRepository.watchNext(context, entryId, episodeId)
        HomeScreenWidgets.updateAll(context)
    }

    // A launcher gives a widget's buttons no feedback of their own.
    private fun tick(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return
        val vibrator = context.getSystemService(Vibrator::class.java) ?: return
        vibrator.vibrate(VibrationEffect.createPredefined(VibrationEffect.EFFECT_TICK))
    }

    companion object {
        val ENTRY_ID = ActionParameters.Key<String>("entryId")
        val EPISODE_ID = ActionParameters.Key<String>("episodeId")
    }
}

private fun WidgetShow.code() = "S%02dE%02d".format(Locale.ROOT, seasonNumber, episodeNumber)

private fun WidgetShow.progress() = if (totalEpisodes > 0) watchedEpisodes.toFloat() / totalEpisodes else 0f

private fun WidgetShow.watchNext() = actionRunCallback<WatchNextAction>(
    actionParametersOf(WatchNextAction.ENTRY_ID to entryId, WatchNextAction.EPISODE_ID to episodeId),
)

private fun WidgetShow.checkLabel(context: Context) = context.getString(R.string.widget_mark_watched, code(), title)

private fun WidgetShow.left(context: Context): String {
    val left = totalEpisodes - watchedEpisodes
    return if (left <= 1) context.getString(R.string.widget_last_episode) else context.getString(R.string.widget_episodes_left, left)
}

private fun Map<String, Bitmap>.of(show: WidgetShow) = show.posterUrl?.let { this[it] }

@Composable
private fun ShowPosters(shows: List<WidgetShow>, posters: Map<String, Bitmap>) {
    val context = LocalContext.current
    val layout = currentLayout()

    Column(modifier = GlanceModifier.fillMaxSize()) {
        if (layout == WidgetLayout.LARGE) {
            WidgetHeader(context.getString(R.string.widget_to_watch_name), null, WidgetColors.dim, logo = true)
            Spacer(GlanceModifier.height(6.dp))
        }
        Box(modifier = GlanceModifier.fillMaxWidth().defaultWeight()) {
            PosterGrid(shows.take(layout.items), layout) { show, modifier ->
                PosterTile(
                    modifier = modifier,
                    poster = posters.of(show),
                    chip = show.code(),
                    chipOnMarquee = true,
                    title = show.title,
                    subtitle = null,
                    open = openApp(context, show.path),
                    check = show.watchNext(),
                    checkLabel = show.checkLabel(context),
                    progress = show.progress(),
                    titleSize = if (layout == WidgetLayout.SMALL) 19.sp else 14.sp,
                )
            }
        }
    }
}

@Composable
private fun ShowList(shows: List<WidgetShow>, posters: Map<String, Bitmap>) {
    val context = LocalContext.current
    val layout = currentLayout()

    if (layout == WidgetLayout.SMALL) {
        SingleShow(shows.first(), posters.of(shows.first()))
        return
    }

    Column(modifier = GlanceModifier.fillMaxSize()) {
        WidgetHeader(
            context.getString(R.string.widget_to_watch_name),
            context.getString(R.string.widget_in_progress, shows.size),
            WidgetColors.dim,
            logo = true,
        )
        shows.take(layout.items).forEachIndexed { index, show ->
            if (index > 0) Divider()
            val large = layout == WidgetLayout.LARGE
            Row(
                modifier = GlanceModifier.fillMaxWidth().defaultWeight().padding(horizontal = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Row(
                    modifier = GlanceModifier.defaultWeight().clickable(openApp(context, show.path)),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    PosterThumb(posters.of(show), if (large) 32.dp else 26.dp, if (large) 46.dp else 38.dp)
                    Spacer(GlanceModifier.width(10.dp))
                    Column(modifier = GlanceModifier.defaultWeight()) {
                        Text(show.title, style = sans(14.sp, WidgetColors.fg, FontWeight.Bold), maxLines = 1)
                        Row {
                            Text(show.code(), style = mono(12.sp, WidgetColors.accent), maxLines = 1)
                            Text(" · ${show.left(context)}", style = mono(12.sp, WidgetColors.dim), maxLines = 1)
                        }
                        if (large) {
                            Spacer(GlanceModifier.height(4.dp))
                            LinearProgressIndicator(
                                progress = show.progress(),
                                modifier = GlanceModifier.fillMaxWidth().height(3.dp),
                                color = WidgetColors.accent,
                                backgroundColor = WidgetColors.divider,
                            )
                        }
                    }
                }
                Spacer(GlanceModifier.width(8.dp))
                CheckButton(show.watchNext(), show.checkLabel(context), if (large) 40.dp else 36.dp, onPoster = false)
            }
        }
    }
}

/** 2 × 2 in the list style: the latest show, and a wide « Vu ». */
@Composable
private fun SingleShow(show: WidgetShow, poster: Bitmap?) {
    val context = LocalContext.current

    Column(modifier = GlanceModifier.fillMaxSize().padding(4.dp)) {
        WidgetHeader(context.getString(R.string.widget_to_watch_name), null, WidgetColors.dim, logo = true)
        Row(
            modifier = GlanceModifier.fillMaxWidth().defaultWeight().clickable(openApp(context, show.path)),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PosterThumb(poster, 44.dp, 64.dp)
            Spacer(GlanceModifier.width(10.dp))
            Column(modifier = GlanceModifier.defaultWeight()) {
                Text(show.title, style = sans(14.sp, WidgetColors.fg, FontWeight.Bold), maxLines = 2)
                Text(show.code(), style = mono(12.sp, WidgetColors.accent), maxLines = 1)
            }
        }
        Spacer(GlanceModifier.height(6.dp))
        Row(
            modifier = GlanceModifier
                .fillMaxWidth()
                .height(36.dp)
                .background(ImageProvider(R.drawable.widget_pill_accent))
                .clickable(show.watchNext()),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Image(
                ImageProvider(R.drawable.ic_widget_check),
                contentDescription = null,
                modifier = GlanceModifier.size(16.dp),
                colorFilter = ColorFilter.tint(ColorProvider(R.color.widget_on_accent)),
            )
            Spacer(GlanceModifier.width(6.dp))
            Text(
                context.getString(R.string.widget_watched),
                style = sans(13.sp, ColorProvider(R.color.widget_on_accent), FontWeight.Bold),
            )
        }
    }
}
