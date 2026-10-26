package app.loomkeep;

import android.content.Context;
import com.getcapacitor.CapConfig;
import com.getcapacitor.Logger;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

/**
 * The Capacitor config with server.url pointing at the instance the user
 * picked, if any. Capacitor derives the origins it injects its bridge into
 * from server.url when the Bridge is created, so the config has to name the
 * instance before MainActivity's super.onCreate.
 */
final class InstanceConfig {

    static final String PREFERENCES = "instance";
    static final String URL_KEY = "url";

    private InstanceConfig() {}

    /** Null when no instance was picked: Capacitor then loads the bundled config. */
    static CapConfig load(Context context) {
        String url = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE).getString(URL_KEY, null);
        if (url == null) return null;

        try (InputStream bundled = context.getAssets().open("capacitor.config.json")) {
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            byte[] buffer = new byte[8192];
            for (int read; (read = bundled.read(buffer)) != -1; ) {
                bytes.write(buffer, 0, read);
            }
            JSONObject json = new JSONObject(bytes.toString("UTF-8"));
            json.getJSONObject("server").put("url", url);

            File dir = new File(context.getFilesDir(), "instance");
            dir.mkdirs();
            try (FileOutputStream out = new FileOutputStream(new File(dir, "capacitor.config.json"))) {
                out.write(json.toString().getBytes(StandardCharsets.UTF_8));
            }
            // loadFromFile rather than the JSON constructor: it reads the
            // debuggable flag from the context, which turns on WebView debugging.
            return CapConfig.loadFromFile(context, dir.getAbsolutePath());
        } catch (Exception e) {
            Logger.error("Couldn't point the app at " + url + ", falling back to the bundled instance", e);
            return null;
        }
    }
}
