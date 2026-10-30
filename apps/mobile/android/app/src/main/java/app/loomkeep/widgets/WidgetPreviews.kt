package app.loomkeep.widgets

import android.content.Context
import android.os.Build
import androidx.glance.appwidget.GlanceAppWidgetManager
import java.util.Calendar
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
        )
        if (results.all { it == GlanceAppWidgetManager.SET_WIDGET_PREVIEWS_RESULT_SUCCESS }) {
            prefs.edit().putLong(VERSION, version).apply()
        }
    }
}
