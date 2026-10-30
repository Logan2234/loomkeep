package app.loomkeep.widgets

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.Locale
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.withContext
import org.json.JSONObject

/** What a widget draws. */
sealed interface WidgetData {
    /** No token: the app hasn't connected the widgets, or its session ended. */
    data object SignedOut : WidgetData

    /** Never reached the instance yet, so nothing cached either. */
    data object Offline : WidgetData

    data class Ready(val feed: WidgetFeed) : WidgetData
}

/** A poster, and the shade of its band in the « Affiches » style. */
data class Poster(val bitmap: Bitmap, val band: Int)

/** Everything the widgets draw, posters included. */
data class WidgetSnapshot(
    val data: WidgetData,
    val posters: Map<String, Poster>,
    /** The show whose ✓ was just pressed, drawn as checked until the API answers. */
    val checking: String? = null,
)

/**
 * The widgets' side of `/api/home-screen-widgets` (MOB-20). The feed is
 * cached: every widget redraw reads it, and only a stale one goes back to the
 * instance.
 *
 * Widgets draw [snapshot], collected inside their composition: Glance runs
 * provideGlance once per session and recomposes it on update(), so data read
 * there would stay what it was when the session started.
 */
object WidgetRepository {
    private const val FRESH_MS = 10 * 60 * 1000L
    private const val TIMEOUT_MS = 10_000

    private val state = MutableStateFlow<WidgetSnapshot?>(null)
    val snapshot: StateFlow<WidgetSnapshot?> = state.asStateFlow()

    /** Something to draw, fetched again once stale: what provideGlance waits for. */
    suspend fun ensure(context: Context) {
        val stale = WidgetStore.token(context) != null && !fresh(context, HomeScreenWidgets.parts(context))
        if (state.value == null || stale) refresh(context)
    }

    private fun fresh(context: Context, parts: Set<String>) =
        WidgetStore.feedAge(context) < FRESH_MS && WidgetStore.feedParts(context).containsAll(parts)

    suspend fun refresh(context: Context, force: Boolean = false) {
        publish(context, load(context, force))
    }

    /** The ✓ on « À suivre »: checked at once, then redrawn from the API's answer. */
    suspend fun watchNext(context: Context, entryId: String, episodeId: String) {
        state.update { it?.copy(checking = entryId) }
        val parts = HomeScreenWidgets.parts(context)
        val body = JSONObject().put("entryId", entryId).put("episodeId", episodeId)
        val data = withContext(Dispatchers.IO) {
            settle(context, request(context, "POST", "watch-next", body, parts), WidgetStore.feed(context), parts)
        }
        publish(context, data)
    }

    /**
     * A step of the session timer. Refused (a timer started elsewhere in the
     * meantime, one already stopped), the widget was out of date: it reads the
     * feed again rather than staying on what it drew.
     */
    suspend fun timerStep(context: Context, step: String, body: JSONObject?) {
        val parts = HomeScreenWidgets.parts(context)
        val data = withContext(Dispatchers.IO) {
            val response = request(context, "POST", "timer/$step", body ?: JSONObject(), parts)
            val settled = if (response == Response.Failed) request(context, "GET", "feed", null, parts) else response
            settle(context, settled, WidgetStore.feed(context), parts)
        }
        publish(context, data)
    }

    private suspend fun publish(context: Context, data: WidgetData) {
        val posters = if (data is WidgetData.Ready) {
            val feed = data.feed
            WidgetPosters.load(
                context,
                feed.toWatch.map(WidgetShow::posterUrl) +
                    feed.releases.map(WidgetRelease::posterUrl) +
                    feed.timer?.posterUrl +
                    feed.sessions.map(WidgetSession::posterUrl) +
                    feed.added.map(WidgetAdded::posterUrl),
            )
        } else {
            emptyMap()
        }
        state.value = WidgetSnapshot(data, posters)
    }

    private sealed interface Response {
        data class Ok(val body: String) : Response
        data object SignedOut : Response
        data object Failed : Response
    }

    private suspend fun load(context: Context, force: Boolean): WidgetData = withContext(Dispatchers.IO) {
        if (WidgetStore.token(context) == null) return@withContext WidgetData.SignedOut
        val cached = WidgetStore.feed(context)
        val parts = HomeScreenWidgets.parts(context)

        if (!force && cached != null && fresh(context, parts)) {
            return@withContext WidgetData.Ready(cached)
        }

        settle(context, request(context, "GET", "feed", null, parts), cached, parts)
    }

    private fun settle(context: Context, response: Response, cached: WidgetFeed?, parts: Set<String>): WidgetData =
        when (response) {
            is Response.Ok -> {
                WidgetStore.saveFeed(context, response.body, parts)
                WidgetData.Ready(WidgetFeed.parse(response.body))
            }
            Response.SignedOut -> {
                WidgetStore.disconnect(context)
                WidgetData.SignedOut
            }
            Response.Failed -> cached?.let { WidgetData.Ready(it) } ?: WidgetData.Offline
        }

    private fun request(context: Context, method: String, route: String, body: JSONObject?, parts: Set<String>): Response {
        val token = WidgetStore.token(context) ?: return Response.SignedOut
        val origin = WidgetStore.origin(context) ?: return Response.SignedOut
        val locale = Locale.getDefault()
        val include = parts.joinToString(",")
        val url = URL("$origin/api/home-screen-widgets/$route?lang=${locale.language}&include=$include")
        val connection = url.openConnection() as HttpURLConnection

        return try {
            connection.requestMethod = method
            connection.connectTimeout = TIMEOUT_MS
            connection.readTimeout = TIMEOUT_MS
            connection.setRequestProperty("X-Widget-Token", token)
            connection.setRequestProperty("Accept-Language", locale.toLanguageTag())
            if (body != null) {
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json")
                connection.outputStream.use { it.write(body.toString().toByteArray()) }
            }
            when (connection.responseCode) {
                HttpURLConnection.HTTP_OK -> Response.Ok(connection.inputStream.bufferedReader().use { it.readText() })
                HttpURLConnection.HTTP_UNAUTHORIZED -> Response.SignedOut
                else -> Response.Failed
            }
        } catch (_: IOException) {
            Response.Failed
        } finally {
            connection.disconnect()
        }
    }
}

/**
 * Posters, downloaded once into the cache and scaled down: a widget's
 * bitmaps all travel to the launcher, which caps their total size.
 */
object WidgetPosters {
    private const val WIDTH_PX = 240

    suspend fun load(context: Context, urls: List<String?>): Map<String, Poster> = withContext(Dispatchers.IO) {
        urls.filterNotNull().distinct().mapNotNull { url ->
            poster(context, url)?.let { url to Poster(it, bandOf(it)) }
        }.toMap()
    }

    /** The poster's average colour, darkened enough to carry white text. */
    private fun bandOf(bitmap: Bitmap): Int {
        val average = Bitmap.createScaledBitmap(bitmap, 1, 1, true).getPixel(0, 0)
        return darken(average)
    }

    private fun poster(context: Context, url: String): Bitmap? {
        val dir = File(context.cacheDir, "widget-posters").apply { mkdirs() }
        val file = File(dir, sha1(url))

        if (!file.exists()) {
            try {
                val connection = URL(url).openConnection() as HttpURLConnection
                connection.connectTimeout = 10_000
                connection.readTimeout = 10_000
                try {
                    if (connection.responseCode != HttpURLConnection.HTTP_OK) return null
                    connection.inputStream.use { input -> file.outputStream().use { input.copyTo(it) } }
                } finally {
                    connection.disconnect()
                }
            } catch (_: IOException) {
                file.delete()
                return null
            }
        }

        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(file.path, bounds)
        var sample = 1
        while (bounds.outWidth / (sample * 2) >= WIDTH_PX) sample *= 2
        val bitmap = BitmapFactory.decodeFile(file.path, BitmapFactory.Options().apply { inSampleSize = sample })
            ?: return null.also { file.delete() }
        return Bitmap.createScaledBitmap(bitmap, WIDTH_PX, WIDTH_PX * bitmap.height / bitmap.width, true)
    }

    private fun sha1(text: String): String =
        MessageDigest.getInstance("SHA-1").digest(text.toByteArray()).joinToString("") { "%02x".format(it) }
}

/** 45 % towards black: white text stays readable on any poster's shade. */
fun darken(color: Int): Int {
    val keep = 0.55f
    return android.graphics.Color.rgb(
        (android.graphics.Color.red(color) * keep).toInt(),
        (android.graphics.Color.green(color) * keep).toInt(),
        (android.graphics.Color.blue(color) * keep).toInt(),
    )
}
