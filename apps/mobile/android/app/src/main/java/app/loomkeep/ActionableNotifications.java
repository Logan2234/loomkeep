package app.loomkeep;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.service.notification.StatusBarNotification;
import androidx.core.app.NotificationCompat;
import androidx.core.app.Person;
import androidx.core.app.RemoteInput;
import androidx.core.content.ContextCompat;
import androidx.core.content.pm.ShortcutInfoCompat;
import androidx.core.content.pm.ShortcutManagerCompat;
import androidx.core.graphics.drawable.IconCompat;
import java.util.HashMap;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Draws a push the API sent as data (MOB-17): Android can't put buttons on
 * the notifications it draws from FCM's own messages. The fields mirror
 * PushService's appBuiltMessage(); tapping opens the app the way those
 * do, so the push plugin hands the same data to the web.
 */
final class ActionableNotifications {

    static final String REPLY_KEY = "reply";
    static final String EXTRA_TOKEN = "app.loomkeep.action.token";
    static final String EXTRA_DATA = "app.loomkeep.action.data";
    static final String EXTRA_MESSAGE_ID = "app.loomkeep.action.messageId";
    private static final String SUMMARY_TAG = "summary:";
    private static final String FALLBACK_CHANNEL = "loomkeep";

    private ActionableNotifications() {}

    static void show(Context context, Map<String, String> data, String messageId) {
        NotificationCompat.Builder builder = base(context, data, messageId, data.get("body"));
        Bitmap image = NotificationImages.load(context, data);
        if (image != null) builder.setLargeIcon(image);
        asConversation(context, builder, data, image);
        addActions(context, builder, data, messageId);
        notify(context, data, messageId, builder);
        showSummary(context, data);
    }

    /**
     * What folds an alert group's notifications together. It stays silent,
     * the notification itself having just alerted, and Android lists the
     * group's notifications when it is unfolded.
     */
    private static void showSummary(Context context, Map<String, String> data) {
        String group = group(data);
        Notification summary = new NotificationCompat.Builder(context, channel(context, data.get("channel")))
            .setSmallIcon(R.drawable.ic_stat_notify)
            .setColor(ContextCompat.getColor(context, R.color.notification_accent))
            .setContentTitle(context.getString(R.string.app_name))
            .setGroup(group)
            .setGroupSummary(true)
            .setGroupAlertBehavior(NotificationCompat.GROUP_ALERT_CHILDREN)
            .setAutoCancel(true)
            .setContentIntent(summaryIntent(context, group))
            .build();
        context.getSystemService(NotificationManager.class).notify(SUMMARY_TAG, group.hashCode(), summary);
    }

    /** Android doesn't always clear a summary when an app cancels the group's last notification. */
    private static void clearEmptySummary(Context context, Map<String, String> data) {
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        String group = group(data);
        for (StatusBarNotification active : manager.getActiveNotifications()) {
            Notification notification = active.getNotification();
            boolean summary = (notification.flags & Notification.FLAG_GROUP_SUMMARY) != 0;
            if (!summary && group.equals(notification.getGroup())) return;
        }
        manager.cancel(SUMMARY_TAG, group.hashCode());
    }

    private static String group(Map<String, String> data) {
        String channel = data.get("channel");
        return channel != null ? channel : FALLBACK_CHANNEL;
    }

    private static PendingIntent summaryIntent(Context context, String group) {
        Intent intent = new Intent(context, MainActivity.class)
            .putExtra("google.message_id", SUMMARY_TAG + group)
            .putExtra("url", "/app/notifications");
        return PendingIntent.getActivity(
            context,
            group.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    /** The button's work is done: the notification goes. */
    static void dismiss(Context context, Intent actionIntent) {
        Map<String, String> data = dataOf(actionIntent);
        String messageId = actionIntent.getStringExtra(EXTRA_MESSAGE_ID);
        context.getSystemService(NotificationManager.class).cancel(data.get("tag"), notificationId(data, messageId));
        clearEmptySummary(context, data);
    }

    /** The action failed: the notification stays, says so, and still opens the app. */
    static void showFailure(Context context, Intent actionIntent) {
        Map<String, String> data = dataOf(actionIntent);
        String messageId = actionIntent.getStringExtra(EXTRA_MESSAGE_ID);
        notify(
            context,
            data,
            messageId,
            base(context, data, messageId, context.getString(R.string.notification_action_failed)).setOnlyAlertOnce(true)
        );
    }

    private static NotificationCompat.Builder base(Context context, Map<String, String> data, String messageId, String text) {
        return new NotificationCompat.Builder(context, channel(context, data.get("channel")))
            .setSmallIcon(R.drawable.ic_stat_notify)
            .setColor(ContextCompat.getColor(context, R.color.notification_accent))
            .setContentTitle(data.get("title"))
            .setContentText(text)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(text))
            .setAutoCancel(true)
            .setGroup(group(data))
            .setCategory(category(data))
            .setContentIntent(tapIntent(context, data, messageId));
    }

    private static String category(Map<String, String> data) {
        if (data.get("conversationId") != null) return NotificationCompat.CATEGORY_MESSAGE;
        String channel = data.get("channel");
        if ("activity".equals(channel)) return NotificationCompat.CATEGORY_SOCIAL;
        if ("releases".equals(channel)) return NotificationCompat.CATEGORY_EVENT;
        return NotificationCompat.CATEGORY_STATUS;
    }

    /**
     * A chat message goes in Android's Conversations section: that takes the
     * messaging style, the sender as a person, and a long-lived shortcut for
     * the conversation. The push carries no message text, so there's no thread
     * to rebuild: the latest notice replaces the last.
     */
    private static void asConversation(Context context, NotificationCompat.Builder builder, Map<String, String> data, Bitmap avatar) {
        String conversationId = data.get("conversationId");
        if (conversationId == null) return;

        Person.Builder sender = new Person.Builder().setName(data.get("title")).setKey(conversationId);
        if (avatar != null) sender.setIcon(IconCompat.createWithBitmap(avatar));
        Person person = sender.build();

        String shortcutId = "conversation:" + conversationId;
        Uri page = Uri.parse(NotificationActionReceiver.instanceOrigin(context) + "/app?messages=" + conversationId);
        ShortcutManagerCompat.pushDynamicShortcut(
            context,
            new ShortcutInfoCompat.Builder(context, shortcutId)
                .setShortLabel(data.get("title"))
                .setIcon(avatar != null ? IconCompat.createWithBitmap(avatar) : IconCompat.createWithResource(context, R.mipmap.ic_launcher))
                .setIntent(new Intent(Intent.ACTION_VIEW, page, context, MainActivity.class))
                .setLongLived(true)
                .setPerson(person)
                .build()
        );

        Person me = new Person.Builder().setName(context.getString(R.string.notification_you)).build();
        builder
            .setShortcutId(shortcutId)
            .setStyle(new NotificationCompat.MessagingStyle(me).addMessage(data.get("body"), System.currentTimeMillis(), person));
    }

    private static void addActions(Context context, NotificationCompat.Builder builder, Map<String, String> data, String messageId) {
        String json = data.get("actions");
        if (json == null) return;

        try {
            JSONArray actions = new JSONArray(json);
            for (int i = 0; i < actions.length(); i++) {
                JSONObject action = actions.getJSONObject(i);
                String replyHint = action.optString("replyHint", "");

                Intent intent = new Intent(context, NotificationActionReceiver.class)
                    .putExtra(EXTRA_TOKEN, action.getString("token"))
                    .putExtra(EXTRA_DATA, bundleOf(data))
                    .putExtra(EXTRA_MESSAGE_ID, messageId);
                // A direct reply's PendingIntent must be mutable: Android adds the text to it.
                int flags = PendingIntent.FLAG_UPDATE_CURRENT | (replyHint.isEmpty() ? PendingIntent.FLAG_IMMUTABLE : PendingIntent.FLAG_MUTABLE);
                PendingIntent pending = PendingIntent.getBroadcast(context, (messageId + i).hashCode(), intent, flags);

                NotificationCompat.Action.Builder button = new NotificationCompat.Action.Builder(0, action.getString("label"), pending);
                if (!replyHint.isEmpty()) {
                    button.addRemoteInput(new RemoteInput.Builder(REPLY_KEY).setLabel(replyHint).build());
                    button.setAllowGeneratedReplies(false);
                }
                builder.addAction(button.build());
            }
        } catch (JSONException e) {
            // Malformed buttons: the notification still shows and opens the app.
        }
    }

    /** Opens the app with the extras FCM's own notifications carry, which the push plugin reads. */
    private static PendingIntent tapIntent(Context context, Map<String, String> data, String messageId) {
        Intent intent = new Intent(context, MainActivity.class).putExtra("google.message_id", messageId);
        for (String key : new String[] { "url", "notificationId" }) {
            if (data.get(key) != null) intent.putExtra(key, data.get(key));
        }
        return PendingIntent.getActivity(
            context,
            messageId.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private static void notify(Context context, Map<String, String> data, String messageId, NotificationCompat.Builder builder) {
        context.getSystemService(NotificationManager.class).notify(data.get("tag"), notificationId(data, messageId), builder.build());
    }

    // A tag (one per conversation) makes a newer push replace the last one.
    private static int notificationId(Map<String, String> data, String messageId) {
        return data.get("tag") != null ? 0 : messageId.hashCode();
    }

    /**
     * A channel the API names that this APK doesn't know yet goes to a plain
     * one rather than being dropped, as Android does for one that doesn't exist.
     */
    private static String channel(Context context, String requested) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return requested;
        NotificationChannels.ensure(context);
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (requested != null && manager.getNotificationChannel(requested) != null) return requested;

        if (manager.getNotificationChannel(FALLBACK_CHANNEL) == null) {
            manager.createNotificationChannel(
                new NotificationChannel(FALLBACK_CHANNEL, context.getString(R.string.app_name), NotificationManager.IMPORTANCE_DEFAULT)
            );
        }
        return FALLBACK_CHANNEL;
    }

    private static Bundle bundleOf(Map<String, String> data) {
        Bundle bundle = new Bundle();
        for (Map.Entry<String, String> entry : data.entrySet()) {
            bundle.putString(entry.getKey(), entry.getValue());
        }
        return bundle;
    }

    private static Map<String, String> dataOf(Intent actionIntent) {
        Map<String, String> data = new HashMap<>();
        Bundle bundle = actionIntent.getBundleExtra(EXTRA_DATA);
        if (bundle == null) return data;
        for (String key : bundle.keySet()) {
            data.put(key, bundle.getString(key));
        }
        return data;
    }
}
