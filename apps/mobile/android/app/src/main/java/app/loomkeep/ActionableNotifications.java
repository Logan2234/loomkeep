package app.loomkeep;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import androidx.core.app.NotificationCompat;
import androidx.core.app.RemoteInput;
import androidx.core.content.ContextCompat;
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

    private ActionableNotifications() {}

    static void show(Context context, Map<String, String> data, String messageId) {
        NotificationCompat.Builder builder = base(context, data, messageId, data.get("body"));
        addActions(context, builder, data, messageId);
        notify(context, data, messageId, builder);
    }

    /** The button's work is done: the notification goes. */
    static void dismiss(Context context, Intent actionIntent) {
        Map<String, String> data = dataOf(actionIntent);
        String messageId = actionIntent.getStringExtra(EXTRA_MESSAGE_ID);
        context.getSystemService(NotificationManager.class).cancel(data.get("tag"), notificationId(data, messageId));
    }

    /** The action failed: the notification stays, says so, and still opens the app. */
    static void showFailure(Context context, Intent actionIntent) {
        Map<String, String> data = dataOf(actionIntent);
        String messageId = actionIntent.getStringExtra(EXTRA_MESSAGE_ID);
        notify(context, data, messageId, base(context, data, messageId, context.getString(R.string.notification_action_failed)));
    }

    private static NotificationCompat.Builder base(Context context, Map<String, String> data, String messageId, String text) {
        return new NotificationCompat.Builder(context, channel(context, data.get("channel")))
            .setSmallIcon(R.drawable.ic_stat_notify)
            .setColor(ContextCompat.getColor(context, R.color.notification_accent))
            .setContentTitle(data.get("title"))
            .setContentText(text)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(text))
            .setAutoCancel(true)
            .setContentIntent(tapIntent(context, data, messageId));
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
     * The web creates one channel per alert group, in the user's language,
     * at each start; a push arriving first goes to a plain one rather than
     * being dropped, as Android does for a channel that doesn't exist.
     */
    private static String channel(Context context, String requested) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return requested;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (requested != null && manager.getNotificationChannel(requested) != null) return requested;

        String fallback = "loomkeep";
        if (manager.getNotificationChannel(fallback) == null) {
            manager.createNotificationChannel(
                new NotificationChannel(fallback, context.getString(R.string.app_name), NotificationManager.IMPORTANCE_DEFAULT)
            );
        }
        return fallback;
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
