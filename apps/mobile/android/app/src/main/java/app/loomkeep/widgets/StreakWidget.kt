package app.loomkeep.widgets

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.ImageProvider
import androidx.glance.LocalContext
import androidx.glance.LocalSize
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.LinearProgressIndicator
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
import androidx.glance.layout.width
import androidx.glance.state.GlanceStateDefinition
import androidx.glance.state.PreferencesGlanceStateDefinition
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextAlign
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import app.loomkeep.R
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

private const val PROGRESS_PATH = "/app/achievements"
private val CARD_INK = ColorProvider(R.color.widget_on_accent)
private val CARD_TRACK = ColorProvider(R.color.widget_on_accent_track)

/** « Série et niveau » (MOB-20): the streak, the level and, given a second row, the week. */
class StreakWidget : GlanceAppWidget() {
    override val sizeMode = SizeMode.Exact
    override val stateDefinition: GlanceStateDefinition<*> = PreferencesGlanceStateDefinition

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        WidgetRepository.ensure(context)

        provideContent {
            val snapshot by WidgetRepository.snapshot.collectAsState()
            val style = currentState(STYLE_KEY) ?: STYLE_POSTERS
            val data = snapshot?.data ?: WidgetData.SignedOut
            val progression = (data as? WidgetData.Ready)?.feed?.progression

            WidgetFrame(style, edgeToEdge = false) {
                when {
                    data == WidgetData.SignedOut -> WidgetMessage(R.string.widget_signed_out, style)
                    data == WidgetData.Offline -> WidgetMessage(R.string.widget_offline, style)
                    progression == null -> WidgetMessage(R.string.widget_streak_off, style)
                    else -> StreakContent(progression, style)
                }
            }
        }
    }

    override suspend fun providePreview(context: Context, widgetCategory: Int) {
        provideContent {
            WidgetFrame(STYLE_POSTERS, edgeToEdge = false) {
                StreakContent(WidgetSamples.progression(), STYLE_POSTERS)
            }
        }
    }
}

class StreakWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = StreakWidget()
}

private fun WidgetProgression.levelShare(): Float {
    val span = xpInLevel + xpToNext
    return if (span > 0) xpInLevel.toFloat() / span else 0f
}

private fun WidgetProgression.xpLabel(context: Context) =
    context.getString(R.string.widget_xp_of, xpInLevel, xpInLevel + xpToNext)

private fun WidgetProgression.levelLabel(context: Context) = context.getString(R.string.widget_level, level)

/** The seven days ending today, as their one-letter name and whether they count. */
private fun WidgetProgression.week(): List<Pair<String, Boolean>> {
    val parse = SimpleDateFormat("yyyy-MM-dd", Locale.ROOT)
    val letter = SimpleDateFormat("EEEEE", Locale.getDefault())
    val end = parse.parse(today) ?: return emptyList()
    return (6 downTo 0).map { back ->
        val day = Calendar.getInstance().apply {
            time = end
            add(Calendar.DAY_OF_MONTH, -back)
        }.time
        letter.format(day) to (parse.format(day) in activeDays)
    }
}

/** Below this, the week doesn't fit: a single row on the home screen. */
private val WEEK_FITS = 140.dp
private val WEEK_HEIGHT = 36.dp

@Composable
private fun StreakContent(progression: WidgetProgression, style: String) {
    val height = LocalSize.current.height
    val week = height >= WEEK_FITS
    val list = style == STYLE_LIST

    Column(modifier = GlanceModifier.fillMaxSize()) {
        if (list) {
            StreakTicket(progression, if (week) height - 12.dp - WEEK_HEIGHT - 4.dp else height - 12.dp)
        } else {
            StreakCard(progression, GlanceModifier.fillMaxWidth().defaultWeight(), roomy = week)
        }
        if (week) {
            Spacer(GlanceModifier.height(4.dp))
            WeekRow(
                progression,
                if (list) R.drawable.widget_day_off_ticket else R.drawable.widget_day_off,
                if (list) WidgetColors.ticketDim else WidgetColors.dim,
            )
        }
    }
}

/** « Affiches »: a card in Séance's accent, the one widget with no artwork to show. */
@Composable
private fun StreakCard(progression: WidgetProgression, modifier: GlanceModifier, roomy: Boolean) {
    val context = LocalContext.current
    Row(
        modifier = modifier
            .background(ImageProvider(R.drawable.widget_streak_card))
            .clickable(openApp(context, PROGRESS_PATH))
            .padding(horizontal = 12.dp, vertical = if (roomy) 10.dp else 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            progression.streakDays.toString(),
            style = TextStyle(color = CARD_INK, fontSize = if (roomy) 40.sp else 28.sp, fontWeight = FontWeight.Bold),
        )
        Spacer(GlanceModifier.width(10.dp))
        Column(modifier = GlanceModifier.defaultWeight()) {
            Text(
                context.getString(
                    if (progression.streakSecuredToday || progression.streakDays == 0) R.string.widget_streak_days else R.string.widget_streak_keep,
                ),
                style = sans(12.sp, CARD_INK, FontWeight.Bold),
                maxLines = 1,
            )
            Row(modifier = GlanceModifier.fillMaxWidth()) {
                Text(progression.levelLabel(context), style = sans(12.sp, CARD_INK, FontWeight.Bold), modifier = GlanceModifier.defaultWeight(), maxLines = 1)
                Text(progression.xpLabel(context), style = mono(10.sp, CARD_INK, FontWeight.Medium), maxLines = 1)
            }
            Spacer(GlanceModifier.height(3.dp))
            LinearProgressIndicator(
                progress = progression.levelShare(),
                modifier = GlanceModifier.fillMaxWidth().height(5.dp),
                color = CARD_INK,
                backgroundColor = CARD_TRACK,
            )
        }
    }
}

/** « Liste »: the streak on the stub, the level on the ticket. */
@Composable
private fun StreakTicket(progression: WidgetProgression, height: Dp) {
    val context = LocalContext.current
    TicketStrip(
        height = height,
        stubWidth = 72.dp,
        stubTop = progression.streakDays.toString(),
        stubBottom = context.getString(R.string.widget_streak_days_short),
        stubLive = true,
        poster = null,
        title = progression.levelLabel(context),
        sub = progression.xpLabel(context),
        open = openApp(context, PROGRESS_PATH),
        action = null,
        actionLabel = null,
        checked = false,
        showThumb = false,
    )
}

@Composable
private fun WeekRow(progression: WidgetProgression, offBackground: Int, offText: ColorProvider) {
    Row(modifier = GlanceModifier.fillMaxWidth().height(WEEK_HEIGHT)) {
        progression.week().forEachIndexed { index, (letter, active) ->
            if (index > 0) Spacer(GlanceModifier.width(4.dp))
            Box(
                modifier = GlanceModifier
                    .defaultWeight()
                    .fillMaxHeight()
                    .background(ImageProvider(if (active) R.drawable.widget_day_on else offBackground)),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    letter,
                    style = TextStyle(
                        color = if (active) ColorProvider(R.color.widget_on_accent) else offText,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        textAlign = TextAlign.Center,
                    ),
                )
            }
        }
    }
}
