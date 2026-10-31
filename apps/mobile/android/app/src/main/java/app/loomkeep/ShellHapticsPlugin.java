package app.loomkeep;

import android.os.Build;
import android.view.HapticFeedbackConstants;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Haptic feedback played by Android itself: each maker tunes these effects to
 * its motor, and they follow the system's touch feedback setting. The raw
 * waveforms of @capacitor/haptics stay imperceptible on some phones (a Poco
 * X5 Pro, for one).
 */
@CapacitorPlugin(name = "ShellHaptics")
public class ShellHapticsPlugin extends Plugin {

    @PluginMethod
    public void tap(PluginCall call) {
        play(call, HapticFeedbackConstants.VIRTUAL_KEY);
    }

    @PluginMethod
    public void success(PluginCall call) {
        play(call, Build.VERSION.SDK_INT >= Build.VERSION_CODES.R ? HapticFeedbackConstants.CONFIRM : HapticFeedbackConstants.LONG_PRESS);
    }

    private void play(PluginCall call, int effect) {
        getActivity()
            .runOnUiThread(() -> {
                getBridge().getWebView().performHapticFeedback(effect);
                call.resolve();
            });
    }
}
