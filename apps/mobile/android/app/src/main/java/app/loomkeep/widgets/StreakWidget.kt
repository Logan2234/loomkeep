package app.loomkeep.widgets

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.graphics.Color
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
private val CARD_INK = ColorProvider(Color(0xFF1A1406))
private val CARD_TRACK = ColorProvider(Color(0x2E1A1406))

/** « Série et niveau » (MOB-20): the streak, the level, the week and the latest XP. */
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
            val cells = currentCells()

            WidgetFrame(style, edgeToEdge = style == STYLE_POSTERS && cells.single && progression != null) {
                when {
                    data == WidgetData.SignedOut -> WidgetMessage(R.string.widget_signed_out, style)
                    data == WidgetData.Offline -> WidgetMessage(R.string.widget_offline, style)
                    progression == null -> WidgetMessage(R.string.widget_streak_off, style)
                    style == STYLE_LIST -> StreakTickets(progression, cells)
                    else -> StreakCards(progression, cells)
                }
            }
        }
    }

    override suspend fun providePreview(context: Context, widgetCategory: Int) {
        provideContent {
            WidgetFrame(STYLE_POSTERS, edgeToEdge = false) {
                StreakCards(WidgetSamples.progression(), currentCells())
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

private fun WidgetGain.label(context: Context) = title ?: context.getString(R.string.widget_gain_other)

/** « Affiches »: the amber card, the only one of the widgets without artwork to show. */
@Composable
private fun StreakCard(progression: WidgetProgression, modifier: GlanceModifier) {
    val context = LocalContext.current
    Column(
        modifier = modifier
            .background(ImageProvider(R.drawable.widget_streak_card))
            .clickable(openApp(context, PROGRESS_PATH))
            .padding(14.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                progression.streakDays.toString(),
                style = TextStyle(color = CARD_INK, fontSize = 40.sp, fontWeight = FontWeight.Bold),
            )
            Spacer(GlanceModifier.width(8.dp))
            Column {
                Text(context.getString(R.string.widget_streak_days), style = sans(14.sp, CARD_INK, FontWeight.Bold), maxLines = 2)
                if (!progression.streakSecuredToday && progression.streakDays > 0) {
                    Text(context.getString(R.string.widget_streak_keep), style = sans(12.sp, CARD_INK), maxLines = 1)
                }
            }
        }
        Spacer(GlanceModifier.defaultWeight())
        Row(modifier = GlanceModifier.fillMaxWidth()) {
            Text(progression.levelLabel(context), style = sans(13.sp, CARD_INK, FontWeight.Bold), modifier = GlanceModifier.defaultWeight(), maxLines = 1)
            Text(progression.xpLabel(context), style = mono(11.sp, CARD_INK, FontWeight.Medium), maxLines = 1)
        }
        Spacer(GlanceModifier.height(5.dp))
        LinearProgressIndicator(
            progress = progression.levelShare(),
            modifier = GlanceModifier.fillMaxWidth().height(6.dp),
            color = CARD_INK,
            backgroundColor = CARD_TRACK,
        )
    }
}

@Composable
private fun WeekRow(progression: WidgetProgression, offBackground: Int, offText: ColorProvider) {
    Row(modifier = GlanceModifier.fillMaxWidth().height(44.dp)) {
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
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        textAlign = TextAlign.Center,
                    ),
                )
            }
        }
    }
}

@Composable
private fun StreakCards(progression: WidgetProgression, cells: Cells) {
    val context = LocalContext.current

    if (cells.single) {
        StreakCard(progression, GlanceModifier.fillMaxSize())
        return
    }

    Column(modifier = GlanceModifier.fillMaxSize()) {
        WidgetHeader(context.getString(R.string.widget_streak_name), null, STYLE_POSTERS)
        Spacer(GlanceModifier.height(4.dp))
        if (cells.rows == 2) {
            StreakCard(progression, GlanceModifier.fillMaxWidth().defaultWeight())
            return@Column
        }
        StreakCard(progression, GlanceModifier.fillMaxWidth().height(104.dp))
        Spacer(GlanceModifier.height(6.dp))
        WeekRow(progression, R.drawable.widget_day_off, WidgetColors.dim)

        val used = 12.dp + 30.dp + 104.dp + 6.dp + 44.dp
        val rows = ((LocalSize.current.height - used) / 34.dp).toInt().coerceIn(0, progression.gains.size)
        progression.gains.take(rows).forEach { gain ->
            Row(
                modifier = GlanceModifier.fillMaxWidth().height(34.dp).padding(horizontal = 6.dp).clickable(openApp(context, PROGRESS_PATH)),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("+${gain.amount}", style = mono(13.sp, WidgetColors.accent), modifier = GlanceModifier.width(44.dp), maxLines = 1)
                Text(gain.label(context), style = sans(13.sp, WidgetColors.fg), maxLines = 1)
            }
        }
    }
}

@Composable
private fun StreakTickets(progression: WidgetProgression, cells: Cells) {
    val context = LocalContext.current
    val open = openApp(context, PROGRESS_PATH)

    if (cells.single) {
        SingleTicket(
            poster = null,
            title = context.getString(R.string.widget_streak_days),
            sub = progression.levelLabel(context),
            stubBig = "${progression.xpInLevel} XP",
            stubSmall = "/ ${progression.xpInLevel + progression.xpToNext}",
            open = open,
            action = null,
            actionLabel = null,
            checked = false,
            leading = {
                Text(
                    progression.streakDays.toString(),
                    style = TextStyle(color = WidgetColors.accent, fontSize = 40.sp, fontWeight = FontWeight.Bold),
                )
            },
        )
        return
    }

    Column(modifier = GlanceModifier.fillMaxSize()) {
        WidgetHeader(context.getString(R.string.widget_streak_name), null, STYLE_LIST)
        Spacer(GlanceModifier.height(4.dp))
        TicketStrip(
            height = 58.dp,
            stubWidth = 78.dp,
            stubTop = progression.streakDays.toString(),
            stubBottom = context.getString(R.string.widget_streak_days),
            stubLive = true,
            poster = null,
            title = progression.levelLabel(context),
            sub = progression.xpLabel(context),
            open = open,
            action = null,
            actionLabel = null,
            checked = false,
            showThumb = false,
        )
        if (cells.rows == 2) return@Column

        Spacer(GlanceModifier.height(4.dp))
        WeekRow(progression, R.drawable.widget_day_off_ticket, WidgetColors.ticketDim)
        val stripHeight = 50.dp
        val used = 12.dp + 30.dp + 58.dp + 4.dp + 44.dp
        val rows = ((LocalSize.current.height - used) / (stripHeight + 4.dp)).toInt().coerceIn(0, progression.gains.size)
        progression.gains.take(rows).forEach { gain ->
            Spacer(GlanceModifier.height(4.dp))
            TicketStrip(
                height = stripHeight,
                stubWidth = if (cells.cols >= 4) 78.dp else 66.dp,
                stubTop = "+${gain.amount}",
                stubBottom = "XP",
                stubLive = true,
                poster = null,
                title = gain.label(context),
                sub = SimpleDateFormat("EEE d", Locale.getDefault()).format(gain.at),
                open = open,
                action = null,
                actionLabel = null,
                checked = false,
                showThumb = false,
            )
        }
    }
}
