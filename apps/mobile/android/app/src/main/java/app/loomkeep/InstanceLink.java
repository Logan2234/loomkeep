package app.loomkeep;

import android.content.Intent;
import android.net.Uri;
import android.widget.Toast;
import androidx.appcompat.app.AlertDialog;

/**
 * A loomkeep://open?instance=<origin>&path=<page> link (MOB-24): App Links
 * only cover the hosts in the manifest, so a self-hosted instance's web offers
 * this link to Android browsers. Any website can send one, so a link to
 * another instance than the current one always asks first, and the page stays
 * within what the manifest's App Links accept.
 */
final class InstanceLink {

    private static final String SCHEME = "loomkeep";
    // Mirrors the manifest's App Links and OPEN_IN_APP_PAGES (open-in-app.ts).
    private static final String[] EXACT_PAGES = { "/app" };
    private static final String[] PAGE_PREFIXES = {
        "/app/",
        "/verify-email",
        "/reset-password",
        "/forgot-password",
        "/login",
        "/register",
        "/account/",
        "/unsubscribe",
    };

    private InstanceLink() {}

    /** What the bridge should see for this intent; anything but a loomkeep:// link passes through. */
    static Intent resolve(MainActivity activity, Intent intent, String serverUrl) {
        if (intent == null || serverUrl == null || intent.getData() == null || !SCHEME.equals(intent.getData().getScheme())) {
            return intent;
        }
        Intent start = new Intent(activity, MainActivity.class);
        // load() replays the activity's intent, on a recreate too.
        activity.setIntent(start);

        Uri link = intent.getData();
        String instance = link.getQueryParameter("instance");
        String path = link.getQueryParameter("path");
        String origin = instance == null ? null : ShellInstancePlugin.originOf(instance);
        if (origin == null || !isAppPage(path)) return start;

        Intent page = new Intent(Intent.ACTION_VIEW, Uri.parse(origin + path));
        Uri current = Uri.parse(serverUrl);
        if (origin.equals(current.getScheme() + "://" + current.getEncodedAuthority())) return page;

        new AlertDialog.Builder(activity)
            .setTitle(R.string.instance_link_title)
            .setMessage(activity.getString(R.string.instance_link_message, Uri.parse(origin).getEncodedAuthority()))
            .setPositiveButton(R.string.instance_link_confirm, (dialog, which) -> switchTo(activity, origin, page))
            .setNegativeButton(android.R.string.cancel, null)
            .show();
        return start;
    }

    private static void switchTo(MainActivity activity, String origin, Intent page) {
        new Thread(() -> {
            String error = ShellInstancePlugin.probe(origin);
            activity.runOnUiThread(() -> {
                if (error != null) {
                    Toast.makeText(activity, R.string.instance_link_failed, Toast.LENGTH_LONG).show();
                    return;
                }
                InstanceConfig.save(activity, origin + "/app");
                activity.setIntent(page);
                activity.recreate();
            });
        })
            .start();
    }

    private static boolean isAppPage(String path) {
        // "@host/app/" would change the host once appended to the origin.
        if (path == null || !path.startsWith("/") || path.startsWith("//") || path.contains("\\") || path.contains("..")) return false;
        String page = Uri.parse("https://instance" + path).getPath();
        if (page == null) return false;
        for (String exact : EXACT_PAGES) {
            if (page.equals(exact)) return true;
        }
        for (String prefix : PAGE_PREFIXES) {
            if (page.startsWith(prefix)) return true;
        }
        return false;
    }
}
