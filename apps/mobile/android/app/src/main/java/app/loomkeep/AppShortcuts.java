package app.loomkeep;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import androidx.core.content.pm.ShortcutInfoCompat;
import androidx.core.content.pm.ShortcutManagerCompat;
import androidx.core.graphics.drawable.IconCompat;
import java.util.ArrayList;
import java.util.List;

/**
 * The long-press menu on the app icon (MOB-19), the same five entries as the
 * PWA manifest's shortcuts. Each one opens the app on its page as an App Link
 * would: the web routes it (appUrlOpen, src/lib/native/app-shell.ts).
 */
final class AppShortcuts {

    private record Entry(String id, String path, int label, int icon) {}

    private static final Entry[] ENTRIES = {
        new Entry("search", "/app/search", R.string.shortcut_search, R.drawable.ic_shortcut_search),
        new Entry("calendar", "/app/calendar", R.string.shortcut_calendar, R.drawable.ic_shortcut_calendar),
        new Entry("stats", "/app/stats", R.string.shortcut_stats, R.drawable.ic_shortcut_stats),
        new Entry("profile", "/app/profile", R.string.shortcut_profile, R.drawable.ic_shortcut_profile),
        new Entry("settings", "/app/settings", R.string.shortcut_settings, R.drawable.ic_shortcut_settings),
    };

    private AppShortcuts() {}

    /**
     * Republished on every launch, so the labels follow the app's language.
     * Links point at the instance the shell loads (server.url), which the web
     * checks before routing them.
     */
    static void publish(Context context, String serverUrl) {
        // The icons are adaptive icons, which Android 7.1 (the only release
        // before 8 with shortcuts) can't draw.
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || serverUrl == null) return;

        Uri instance = Uri.parse(serverUrl);
        int max = ShortcutManagerCompat.getMaxShortcutCountPerActivity(context);
        List<ShortcutInfoCompat> shortcuts = new ArrayList<>();

        for (Entry entry : ENTRIES) {
            if (shortcuts.size() == max) break;
            Uri page = instance.buildUpon().encodedPath(entry.path()).clearQuery().fragment(null).build();
            Intent intent = new Intent(Intent.ACTION_VIEW, page, context, MainActivity.class);
            shortcuts.add(
                new ShortcutInfoCompat.Builder(context, entry.id())
                    .setShortLabel(context.getString(entry.label()))
                    .setIcon(IconCompat.createWithResource(context, entry.icon()))
                    .setIntent(intent)
                    .build()
            );
        }

        ShortcutManagerCompat.setDynamicShortcuts(context, shortcuts);
    }
}
