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

/**
 * The widgets' side of `/api/home-screen-widgets` (MOB-20). The feed is
 * cached: every widget redraw reads it, and only a stale one goes back to the
 * instance.
 */
object WidgetRepository {
    private const val FRESH_MS = 10 * 60 * 1000L
    private const val TIMEOUT_MS = 10_000

    private sealed interface Response {
        data class Ok(val body: String) : Response
        data object SignedOut : Response
        data object Failed : Response
    }

    suspend fun load(context: Context, force: Boolean = false): WidgetData = withContext(Dispatchers.IO) {
        if (WidgetStore.token(context) == null) return@withContext WidgetData.SignedOut
        val cached = WidgetStore.feed(context)

        if (!force && cached != null && WidgetStore.feedAge(context) < FRESH_MS) {
            return@withContext WidgetData.Ready(cached)
        }

        settle(context, request(context, "GET", "feed", null), cached)
    }

    /** The ✓ on « À suivre »; the API answers with the feed as it now stands. */
    suspend fun watchNext(context: Context, entryId: String, episodeId: String): WidgetData =
        withContext(Dispatchers.IO) {
            val body = JSONObject().put("entryId", entryId).put("episodeId", episodeId)
            settle(context, request(context, "POST", "watch-next", body), WidgetStore.feed(context))
        }

    private fun settle(context: Context, response: Response, cached: WidgetFeed?): WidgetData =
        when (response) {
            is Response.Ok -> {
                WidgetStore.saveFeed(context, response.body)
                WidgetData.Ready(WidgetFeed.parse(response.body))
            }
            Response.SignedOut -> {
                WidgetStore.disconnect(context)
                WidgetData.SignedOut
            }
            Response.Failed -> cached?.let { WidgetData.Ready(it) } ?: WidgetData.Offline
        }

    private fun request(context: Context, method: String, route: String, body: JSONObject?): Response {
        val token = WidgetStore.token(context) ?: return Response.SignedOut
        val origin = WidgetStore.origin(context) ?: return Response.SignedOut
        val locale = Locale.getDefault()
        val url = URL("$origin/api/home-screen-widgets/$route?lang=${locale.language}")
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

    suspend fun load(context: Context, urls: List<String?>): Map<String, Bitmap> = withContext(Dispatchers.IO) {
        urls.filterNotNull().distinct().mapNotNull { url -> poster(context, url)?.let { url to it } }.toMap()
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
