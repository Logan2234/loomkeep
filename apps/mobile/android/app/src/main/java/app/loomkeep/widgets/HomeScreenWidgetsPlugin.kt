package app.loomkeep.widgets

import android.content.Context
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.glance.appwidget.updateAll
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

object HomeScreenWidgets {
    /** Whether any widget sits on the home screen: none, no reason to ask the instance. */
    suspend fun placed(context: Context): Boolean {
        val manager = GlanceAppWidgetManager(context)
        return manager.getGlanceIds(ToWatchWidget::class.java).isNotEmpty() ||
            manager.getGlanceIds(ReleasesWidget::class.java).isNotEmpty()
    }

    suspend fun updateAll(context: Context) {
        ToWatchWidget().updateAll(context)
        ReleasesWidget().updateAll(context)
    }
}

/**
 * How the web hands the widgets their token (src/lib/native/home-screen-widgets.ts):
 * its presence also tells the web this APK has the widgets.
 */
@CapacitorPlugin(name = "HomeScreenWidgets")
class HomeScreenWidgetsPlugin : Plugin() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    override fun load() {
        val context = context.applicationContext
        scope.launch { WidgetPreviews.publish(context) }
    }

    @PluginMethod
    fun connect(call: PluginCall) {
        val token = call.getString("token") ?: return call.reject("token is required")
        WidgetStore.connect(context, token, bridge.serverUrl)
        redraw(refetch = true)
        call.resolve()
    }

    @PluginMethod
    fun disconnect(call: PluginCall) {
        WidgetStore.disconnect(context)
        redraw(refetch = false)
        call.resolve()
    }

    @PluginMethod
    fun refresh(call: PluginCall) {
        redraw(refetch = true)
        call.resolve()
    }

    private fun redraw(refetch: Boolean) {
        val context = context.applicationContext
        scope.launch {
            if (!HomeScreenWidgets.placed(context)) return@launch
            WidgetRepository.refresh(context, force = refetch)
            // Starts a session for a widget that has none; a running one
            // already redraws from WidgetRepository.snapshot.
            HomeScreenWidgets.updateAll(context)
        }
    }

    override fun handleOnDestroy() {
        scope.cancel()
    }
}
