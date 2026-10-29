package app.loomkeep;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import androidx.core.app.RemoteInput;
import com.getcapacitor.CapConfig;
import com.getcapacitor.Logger;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

/**
 * A notification's button (MOB-17): sends its token, and a direct reply's
 * text, to the instance's POST /api/notifications/actions, without opening
 * the app or needing its session.
 */
public class NotificationActionReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        String token = intent.getStringExtra(ActionableNotifications.EXTRA_TOKEN);
        Bundle replies = RemoteInput.getResultsFromIntent(intent);
        CharSequence reply = replies == null ? null : replies.getCharSequence(ActionableNotifications.REPLY_KEY);

        // The request can't run on the main thread; goAsync keeps the
        // receiver alive until it's answered.
        PendingResult pending = goAsync();
        new Thread(() -> {
            try {
                if (send(context, token, reply)) {
                    ActionableNotifications.dismiss(context, intent);
                } else {
                    ActionableNotifications.showFailure(context, intent);
                }
            } finally {
                pending.finish();
            }
        })
            .start();
    }

    private static boolean send(Context context, String token, CharSequence reply) {
        HttpURLConnection connection = null;
        try {
            JSONObject body = new JSONObject().put("token", token);
            if (reply != null) body.put("text", reply.toString());

            connection = (HttpURLConnection) new URL(instanceOrigin(context) + "/api/notifications/actions").openConnection();
            connection.setRequestMethod("POST");
            connection.setRequestProperty("Content-Type", "application/json");
            connection.setConnectTimeout(10000);
            connection.setReadTimeout(10000);
            connection.setDoOutput(true);
            try (OutputStream out = connection.getOutputStream()) {
                out.write(body.toString().getBytes(StandardCharsets.UTF_8));
            }
            int status = connection.getResponseCode();
            return status >= 200 && status < 300;
        } catch (Exception e) {
            Logger.error("Notification action failed", e);
            return false;
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    /** The instance the app runs on (MOB-15), which sent the push and minted its tokens. */
    private static String instanceOrigin(Context context) {
        CapConfig config = InstanceConfig.load(context);
        if (config == null) config = CapConfig.loadDefault(context);
        Uri url = Uri.parse(config.getServerUrl());
        return url.getScheme() + "://" + url.getEncodedAuthority();
    }
}
