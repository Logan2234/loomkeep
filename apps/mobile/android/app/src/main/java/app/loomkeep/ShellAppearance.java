package app.loomkeep;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.res.Configuration;
import androidx.appcompat.app.AppCompatDelegate;

/**
 * The web's theme, remembered for the next launch: it lives in the WebView's
 * localStorage, out of reach until the page has loaded, and the launch must
 * already be in the right colours. An account that follows the system keeps
 * following it, or the WebView's prefers-color-scheme would stop changing.
 */
final class ShellAppearance {

    private static final String PREFERENCES = "appearance";
    private static final String DARK_KEY = "dark";
    private static final String FOLLOWS_SYSTEM_KEY = "followsSystem";

    private ShellAppearance() {}

    static void remember(Context context, boolean dark, boolean followsSystem) {
        preferences(context).edit().putBoolean(DARK_KEY, dark).putBoolean(FOLLOWS_SYSTEM_KEY, followsSystem).apply();
    }

    static boolean followsSystem(Context context) {
        return preferences(context).getBoolean(FOLLOWS_SYSTEM_KEY, true);
    }

    static boolean isDark(Context context) {
        if (followsSystem(context)) {
            int night = context.getApplicationContext().getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK;
            return night == Configuration.UI_MODE_NIGHT_YES;
        }
        return preferences(context).getBoolean(DARK_KEY, true);
    }

    /** Native windows the WebView opens (date picker, select lists) follow the app's theme, not the system's. */
    static void applyNightMode(Context context) {
        AppCompatDelegate.setDefaultNightMode(
            followsSystem(context)
                ? AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM
                : isDark(context) ? AppCompatDelegate.MODE_NIGHT_YES : AppCompatDelegate.MODE_NIGHT_NO
        );
    }

    static int backgroundColor(Context context) {
        return context.getColor(isDark(context) ? R.color.seance_dark : R.color.seance_paper);
    }

    private static SharedPreferences preferences(Context context) {
        return context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE);
    }
}
