package app.loomkeep;

import android.graphics.Color;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Paints the window behind the status and navigation bars in the web's
 * theme colour. It shows wherever the WebView doesn't draw under the bars
 * (WebView before 140, where Capacitor pads it instead), and Android would
 * otherwise colour it after the system theme rather than the app's.
 */
@CapacitorPlugin(name = "ShellTheme")
public class ShellThemePlugin extends Plugin {

    @PluginMethod
    public void setBackground(PluginCall call) {
        int color;
        try {
            color = Color.parseColor(call.getString("color", ""));
        } catch (IllegalArgumentException e) {
            call.reject("color must be a #RRGGBB colour");
            return;
        }

        getActivity()
            .runOnUiThread(() -> {
                getActivity().getWindow().getDecorView().setBackgroundColor(color);
                call.resolve();
            });
    }
}
