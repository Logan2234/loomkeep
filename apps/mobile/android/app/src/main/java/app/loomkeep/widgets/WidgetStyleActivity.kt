package app.loomkeep.widgets

import android.appwidget.AppWidgetManager
import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.glance.appwidget.state.getAppWidgetState
import androidx.glance.appwidget.state.updateAppWidgetState
import androidx.glance.state.PreferencesGlanceStateDefinition
import app.loomkeep.R
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/**
 * A widget's settings (long press › settings, Android 12+): posters or list.
 * Before Android 12 it also opens when the widget is placed, since those
 * releases can't skip it.
 */
class WidgetStyleActivity : AppCompatActivity() {
    private val scope = MainScope()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setResult(RESULT_CANCELED)

        val appWidgetId = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
        if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) return finish()

        val styles = arrayOf(STYLE_POSTERS, STYLE_LIST)
        scope.launch {
            val glanceId = GlanceAppWidgetManager(this@WidgetStyleActivity).getGlanceIdBy(appWidgetId)
            val current = getAppWidgetState(this@WidgetStyleActivity, PreferencesGlanceStateDefinition, glanceId)[STYLE_KEY]

            AlertDialog.Builder(this@WidgetStyleActivity)
                .setTitle(R.string.widget_style_title)
                .setSingleChoiceItems(
                    arrayOf(getString(R.string.widget_style_posters), getString(R.string.widget_style_list)),
                    styles.indexOf(current ?: STYLE_POSTERS),
                ) { dialog, which ->
                    dialog.dismiss()
                    choose(appWidgetId, styles[which])
                }
                .setOnCancelListener { finish() }
                .show()
        }
    }

    private fun choose(appWidgetId: Int, style: String) = scope.launch {
        val glanceId = GlanceAppWidgetManager(this@WidgetStyleActivity).getGlanceIdBy(appWidgetId)
        updateAppWidgetState(this@WidgetStyleActivity, glanceId) { it[STYLE_KEY] = style }
        val provider = AppWidgetManager.getInstance(this@WidgetStyleActivity).getAppWidgetInfo(appWidgetId)?.provider
        HomeScreenWidgets.forReceiver(provider?.className.orEmpty()).update(this@WidgetStyleActivity, glanceId)
        setResult(RESULT_OK, Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId))
        finish()
    }

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }
}
