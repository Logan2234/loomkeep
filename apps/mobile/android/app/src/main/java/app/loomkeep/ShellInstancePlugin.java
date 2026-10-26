package app.loomkeep;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * The instance picker (MOB-15): www/instance.html, a local page so it still
 * shows when the instance is unreachable. Local pages get no Capacitor
 * bridge, so the picker talks back by navigating to /_instance, which this
 * plugin intercepts: ?use=<address> checks the address and switches to it,
 * no parameter goes back to the bundled instance.
 */
@CapacitorPlugin(name = "ShellInstance")
public class ShellInstancePlugin extends Plugin {

    private static final String PICKER_PATH = "/instance.html";
    private static final String ACTION_PATH = "/_instance";

    @PluginMethod
    public void open(PluginCall call) {
        getActivity().runOnUiThread(() -> showPicker(null, null));
        call.resolve();
    }

    @Override
    public Boolean shouldOverrideLoad(Uri url) {
        boolean local = getBridge().getScheme().equals(url.getScheme()) && getBridge().getHost().equals(url.getHost());
        if (!local) return null;
        // Capacitor would hand any other host than the instance's to the browser.
        if (!ACTION_PATH.equals(url.getPath())) return false;

        String address = url.getQueryParameter("use");
        if (address == null) {
            InstanceConfig.clear(getContext());
            restart();
        } else {
            switchTo(address);
        }
        return true;
    }

    private void switchTo(String address) {
        String origin = originOf(address);
        if (origin == null) {
            showPicker(address, "invalid");
            return;
        }

        new Thread(() -> {
            String error = probe(origin);
            getActivity()
                .runOnUiThread(() -> {
                    if (error != null) {
                        showPicker(address, error);
                        return;
                    }
                    InstanceConfig.save(getContext(), origin + "/app");
                    restart();
                });
        })
            .start();
    }

    private void showPicker(String address, String error) {
        Uri.Builder picker = Uri.parse(getBridge().getLocalUrl() + PICKER_PATH)
            .buildUpon()
            .appendQueryParameter("current", getBridge().getServerUrl());
        if (address != null) picker.appendQueryParameter("address", address);
        if (error != null) picker.appendQueryParameter("error", error);
        getBridge().getWebView().loadUrl(picker.build().toString());
    }

    /** A new Bridge, built from the config that now names the instance. */
    private void restart() {
        Activity activity = getActivity();
        // load() replays the activity's intent: a shared link or an App Link
        // the app was opened with would otherwise open again on the new instance.
        activity.setIntent(new Intent(activity, MainActivity.class));
        activity.recreate();
    }

    /** https://host[:port] for what the user typed, or null when it can't be one. */
    private static String originOf(String address) {
        String trimmed = address.trim();
        Uri uri = Uri.parse(trimmed.contains("://") ? trimmed : "https://" + trimmed);
        String host = uri.getHost();
        if (!"https".equals(uri.getScheme()) || host == null || host.isEmpty() || uri.getUserInfo() != null) {
            return null;
        }
        return "https://" + host + (uri.getPort() == -1 ? "" : ":" + uri.getPort());
    }

    /** Null when the origin answers /api/config like a Loomkeep instance, else the picker's error code. */
    private static String probe(String origin) {
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(origin + "/api/config").openConnection();
            connection.setConnectTimeout(8000);
            connection.setReadTimeout(8000);
            if (connection.getResponseCode() != HttpURLConnection.HTTP_OK) return "not-loomkeep";

            try (InputStream body = connection.getInputStream()) {
                JSONObject config = new JSONObject(InstanceConfig.readAll(body));
                return config.has("version") && config.has("registrationEnabled") ? null : "not-loomkeep";
            }
        } catch (JSONException e) {
            return "not-loomkeep";
        } catch (IOException e) {
            return "unreachable";
        } finally {
            if (connection != null) connection.disconnect();
        }
    }
}
