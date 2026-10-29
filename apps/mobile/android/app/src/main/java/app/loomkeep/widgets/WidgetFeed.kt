package app.loomkeep.widgets

import android.content.Context
import android.net.Uri
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone
import org.json.JSONArray
import org.json.JSONObject

/** A show in progress, as `GET /api/home-screen-widgets/feed` sends it. */
data class WidgetShow(
    val entryId: String,
    val title: String,
    val posterUrl: String?,
    val path: String,
    val episodeId: String,
    val seasonNumber: Int,
    val episodeNumber: Int,
    val watchedEpisodes: Int,
    val totalEpisodes: Int,
)

data class WidgetRelease(
    val kind: String,
    val title: String,
    val posterUrl: String?,
    val path: String,
    val seasonNumber: Int?,
    val episodeNumber: Int?,
    /** Epoch millis. */
    val airDate: Long,
    /** A game dated to a month only. */
    val monthOnly: Boolean,
)

data class WidgetFeed(val toWatch: List<WidgetShow>, val releases: List<WidgetRelease>) {
    companion object {
        fun parse(json: String): WidgetFeed {
            val root = JSONObject(json)
            return WidgetFeed(
                toWatch = root.getJSONArray("toWatch").objects().map { show ->
                    val next = show.getJSONObject("next")
                    WidgetShow(
                        entryId = show.getString("entryId"),
                        title = show.getString("title"),
                        posterUrl = show.optStringOrNull("posterUrl"),
                        path = show.getString("path"),
                        episodeId = next.getString("episodeId"),
                        seasonNumber = next.getInt("seasonNumber"),
                        episodeNumber = next.getInt("episodeNumber"),
                        watchedEpisodes = show.getInt("watchedEpisodes"),
                        totalEpisodes = show.getInt("totalEpisodes"),
                    )
                },
                releases = root.getJSONArray("releases").objects().map { release ->
                    WidgetRelease(
                        kind = release.getString("kind"),
                        title = release.getString("title"),
                        posterUrl = release.optStringOrNull("posterUrl"),
                        path = release.getString("path"),
                        seasonNumber = release.optIntOrNull("seasonNumber"),
                        episodeNumber = release.optIntOrNull("episodeNumber"),
                        airDate = parseIsoDate(release.getString("airDate")),
                        monthOnly = release.optString("releasePrecision") == "MONTH",
                    )
                },
            )
        }
    }
}

// java.time only exists from Android 8; the app runs from 7.
private fun parseIsoDate(iso: String): Long {
    val format = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSX", Locale.ROOT)
    format.timeZone = TimeZone.getTimeZone("UTC")
    return format.parse(iso)!!.time
}

private fun JSONArray.objects(): List<JSONObject> = (0 until length()).map { getJSONObject(it) }

private fun JSONObject.optStringOrNull(key: String): String? =
    if (isNull(key)) null else optString(key).ifEmpty { null }

private fun JSONObject.optIntOrNull(key: String): Int? = if (isNull(key)) null else optInt(key)

/**
 * What the widgets keep on the device: the token and instance the app handed
 * them (HomeScreenWidgetsPlugin), and the last feed, drawn while offline.
 */
object WidgetStore {
    private const val PREFS = "home_screen_widgets"
    private const val TOKEN = "token"
    private const val ORIGIN = "origin"
    private const val FEED = "feed"
    private const val FEED_AT = "feed_at"

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun connect(context: Context, token: String, serverUrl: String) {
        val server = Uri.parse(serverUrl)
        prefs(context).edit()
            .putString(TOKEN, token)
            .putString(ORIGIN, "${server.scheme}://${server.encodedAuthority}")
            .apply()
    }

    /** Signed out, in the app or because the session ended: the cached feed goes too. */
    fun disconnect(context: Context) {
        prefs(context).edit().clear().apply()
    }

    fun token(context: Context): String? = prefs(context).getString(TOKEN, null)

    fun origin(context: Context): String? = prefs(context).getString(ORIGIN, null)

    fun saveFeed(context: Context, json: String) {
        prefs(context).edit()
            .putString(FEED, json)
            .putLong(FEED_AT, System.currentTimeMillis())
            .apply()
    }

    fun feed(context: Context): WidgetFeed? =
        prefs(context).getString(FEED, null)?.let { runCatching { WidgetFeed.parse(it) }.getOrNull() }

    fun feedAge(context: Context): Long =
        System.currentTimeMillis() - prefs(context).getLong(FEED_AT, 0)
}
