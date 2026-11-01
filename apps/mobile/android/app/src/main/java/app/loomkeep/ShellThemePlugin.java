package app.loomkeep;

import android.content.res.Resources;
import android.graphics.Color;
import android.os.Build;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Paints the window behind the status and navigation bars in the web's
 * theme colour. It shows wherever the WebView doesn't draw under the bars
 * (WebView before 140, where Capacitor pads it instead), and Android would
 * otherwise colour it after the system theme rather than the app's. Also
 * remembers the theme for the next launch (ShellAppearance).
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

        String mode = call.getString("mode");
        boolean followsSystem = Boolean.TRUE.equals(call.getBoolean("followsSystem", true));

        getActivity()
            .runOnUiThread(() -> {
                getActivity().getWindow().getDecorView().setBackgroundColor(color);
                if (mode != null) remember("dark".equals(mode), followsSystem);
                call.resolve();
            });
    }

    private void remember(boolean dark, boolean followsSystem) {
        ShellAppearance.remember(getContext(), dark, followsSystem);
        ShellAppearance.applyNightMode(getContext());
        // The system draws the launch screen before any code of ours runs:
        // only this tells it. Before Android 13, it follows the system's theme.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getActivity()
                .getSplashScreen()
                .setSplashScreenTheme(
                    followsSystem
                        ? Resources.ID_NULL
                        : dark ? R.style.AppTheme_NoActionBarLaunch_Dark : R.style.AppTheme_NoActionBarLaunch_Light
                );
        }
    }
}
