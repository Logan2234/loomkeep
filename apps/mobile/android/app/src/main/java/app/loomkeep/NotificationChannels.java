package app.loomkeep;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;

/**
 * One channel per ALERTS group, the ids the API sends (AlertGroup in
 * packages/shared), ready before any push: a push arriving before the web's
 * first start would otherwise land on a stray channel that stays in Android's
 * settings. The web renames them to the account's language at each start.
 */
final class NotificationChannels {

    private record Group(String id, int name, int description, int importance) {}

    private static final Group[] GROUPS = {
        new Group("activity", R.string.channel_activity, R.string.channel_activity_description, NotificationManager.IMPORTANCE_HIGH),
        new Group("releases", R.string.channel_releases, R.string.channel_releases_description, NotificationManager.IMPORTANCE_DEFAULT),
        new Group("account", R.string.channel_account, R.string.channel_account_description, NotificationManager.IMPORTANCE_DEFAULT),
        new Group("security", R.string.channel_security, R.string.channel_security_description, NotificationManager.IMPORTANCE_HIGH),
        new Group("admin", R.string.channel_admin, R.string.channel_admin_description, NotificationManager.IMPORTANCE_DEFAULT),
        new Group("announcements", R.string.channel_announcements, R.string.channel_announcements_description, NotificationManager.IMPORTANCE_DEFAULT),
    };

    private NotificationChannels() {}

    /** Recreating a channel only updates its texts, never what the user set on it. */
    static void ensure(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        for (Group group : GROUPS) {
            NotificationChannel channel = new NotificationChannel(group.id(), context.getString(group.name()), group.importance());
            channel.setDescription(context.getString(group.description()));
            manager.createNotificationChannel(channel);
        }
    }
}
