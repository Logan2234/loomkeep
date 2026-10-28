package app.loomkeep;

import androidx.annotation.NonNull;
import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;

/**
 * Takes the push plugin's place for FCM (the manifest removes its service):
 * the plugin still tells the web about every push and new token, and the
 * data-only ones, which Android doesn't draw, get drawn here with their
 * buttons (MOB-17).
 */
public class ShellMessagingService extends MessagingService {

    @Override
    public void onMessageReceived(@NonNull RemoteMessage message) {
        super.onMessageReceived(message);
        if (message.getNotification() == null && message.getData().containsKey("title")) {
            String messageId = message.getMessageId() != null ? message.getMessageId() : String.valueOf(System.currentTimeMillis());
            ActionableNotifications.show(this, message.getData(), messageId);
        }
    }
}
