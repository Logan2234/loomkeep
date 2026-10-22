package app.loomkeep;

import android.content.Intent;
import android.net.Uri;

/**
 * Text another app shares with Loomkeep (MOB-18) — an IMDb or Letterboxd
 * link, usually inside a sentence — becomes the web's own share target,
 * /app/share (the PWA manifest's share_target), opened like an App Link so
 * the web routes to it (appUrlOpen).
 */
final class SharedText {

    private SharedText() {}

    static Intent asAppLink(Intent intent, String serverUrl) {
        if (intent == null || serverUrl == null || !Intent.ACTION_SEND.equals(intent.getAction())) {
            return intent;
        }
        String text = intent.getStringExtra(Intent.EXTRA_TEXT);
        if (text == null) return intent;

        Uri.Builder page = Uri.parse(serverUrl).buildUpon().encodedPath("/app/share").clearQuery().fragment(null);
        page.appendQueryParameter("text", text);
        String subject = intent.getStringExtra(Intent.EXTRA_SUBJECT);
        if (subject != null) page.appendQueryParameter("title", subject);

        return new Intent(Intent.ACTION_VIEW, page.build());
    }
}
