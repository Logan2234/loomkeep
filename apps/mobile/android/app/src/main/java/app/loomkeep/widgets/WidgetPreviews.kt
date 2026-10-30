package app.loomkeep.widgets

import android.content.Context
import android.os.Build
import androidx.glance.appwidget.GlanceAppWidgetManager
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import java.util.TimeZone

/** What the widget picker shows before a widget is placed: sample works, no account needed. */
object WidgetSamples {
    val shows = listOf(
        WidgetShow("sample-1", "Severance", null, "/app", "", 2, 7, 6, 10),
        WidgetShow("sample-2", "Frieren", null, "/app", "", 1, 19, 18, 28),
        WidgetShow("sample-3", "The Bear", null, "/app", "", 3, 4, 3, 10),
        WidgetShow("sample-4", "Shōgun", null, "/app", "", 1, 6, 5, 10),
        WidgetShow("sample-5", "Slow Horses", null, "/app", "", 4, 2, 1, 6),
        WidgetShow("sample-6", "Andor", null, "/app", "", 2, 9, 8, 12),
    )

    fun chrono(): WidgetFeed {
        val hoursAgo = { hours: Int -> System.currentTimeMillis() - hours * 3_600_000L }
        return WidgetFeed(
            toWatch = emptyList(),
            releases = emptyList(),
            timer = WidgetTimer("GAMES", "sample-1", "Hollow Knight: Silksong", null, "/app", 5047, false),
            sessions = listOf(
                WidgetSession("BOOKS", "sample-2", "La Horde du Contrevent", null, "/app", 45, hoursAgo(24)),
                WidgetSession("GAMES", "sample-3", "Hades II", null, "/app", 100, hoursAgo(48)),
                WidgetSession("GAMES", "sample-4", "Balatro", null, "/app", 50, hoursAgo(72)),
                WidgetSession("BOOKS", "sample-5", "Dune", null, "/app", 35, hoursAgo(96)),
                WidgetSession("GAMES", "sample-6", "Elden Ring", null, "/app", 65, hoursAgo(120)),
            ),
            weekMinutes = 400,
        )
    }

    fun progression(): WidgetProgression {
        val format = SimpleDateFormat("yyyy-MM-dd", Locale.ROOT)
        val day = { back: Int ->
            format.format(Calendar.getInstance().apply { add(Calendar.DAY_OF_MONTH, -back) }.time)
        }
        return WidgetProgression(
            level = 14,
            xpInLevel = 340,
            xpToNext = 160,
            streakDays = 12,
            streakSecuredToday = true,
            today = day(0),
            activeDays = setOf(0, 1, 2, 4, 5, 6).map(day).toSet(),
            gains = listOf(
                WidgetGain(20, "Severance", System.currentTimeMillis()),
                WidgetGain(50, "The Bear", System.currentTimeMillis()),
                WidgetGain(20, "Frieren", System.currentTimeMillis()),
                WidgetGain(10, "Dune", System.currentTimeMillis()),
            ),
        )
    }

    fun releases(): List<WidgetRelease> {
        val day = { offset: Int ->
            Calendar.getInstance(TimeZone.getTimeZone("UTC")).apply {
                set(Calendar.HOUR_OF_DAY, 0)
                set(Calendar.MINUTE, 0)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
                add(Calendar.DAY_OF_MONTH, offset)
            }.timeInMillis
        }
        return listOf(
            WidgetRelease("EPISODE", "The Last of Us", null, "/app", 2, 4, day(0), false),
            WidgetRelease("MOVIE", "Mickey 17", null, "/app", null, null, day(0), false),
            WidgetRelease("GAME", "Hollow Knight: Silksong", null, "/app", null, null, day(0), false),
            WidgetRelease("EPISODE", "Andor", null, "/app", 2, 10, day(1), false),
            WidgetRelease("EPISODE", "Frieren", null, "/app", 1, 20, day(1), false),
            WidgetRelease("EPISODE", "Dune: Prophecy", null, "/app", 1, 5, day(2), false),
        )
    }
}

/**
 * Hands Android 15+ the widgets' previews, drawn from WidgetSamples (older
 * releases use res/layout/widget_preview_*.xml). Android rate-limits the
 * call, so it's made once per installed version.
 */
object WidgetPreviews {
    private const val PREFS = "home_screen_widget_previews"
    private const val VERSION = "version"

    suspend fun publish(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.VANILLA_ICE_CREAM) return
        val version = context.packageManager.getPackageInfo(context.packageName, 0).longVersionCode
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (prefs.getLong(VERSION, -1) == version) return

        val manager = GlanceAppWidgetManager(context)
        val results = listOf(
            manager.setWidgetPreviews(ToWatchWidgetReceiver::class),
            manager.setWidgetPreviews(ReleasesWidgetReceiver::class),
            manager.setWidgetPreviews(ChronoWidgetReceiver::class),
            manager.setWidgetPreviews(StreakWidgetReceiver::class),
            manager.setWidgetPreviews(SearchWidgetReceiver::class),
        )
        if (results.all { it == GlanceAppWidgetManager.SET_WIDGET_PREVIEWS_RESULT_SUCCESS }) {
            prefs.edit().putLong(VERSION, version).apply()
        }
    }
}
