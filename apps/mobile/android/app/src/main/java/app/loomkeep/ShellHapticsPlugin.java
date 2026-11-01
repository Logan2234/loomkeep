package app.loomkeep;

import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Vibrations at the motor's default strength: both the low-amplitude waveforms
 * of @capacitor/haptics and View.performHapticFeedback stay imperceptible on
 * some phones (a Poco X5 Pro under HyperOS, for one).
 */
@CapacitorPlugin(name = "ShellHaptics")
public class ShellHapticsPlugin extends Plugin {

    private static final long[] TAP = { 0, 40 };
    private static final long[] SUCCESS = { 0, 40, 70, 70 };

    @PluginMethod
    public void tap(PluginCall call) {
        play(call, TAP);
    }

    @PluginMethod
    public void success(PluginCall call) {
        play(call, SUCCESS);
    }

    @SuppressWarnings("deprecation")
    private void play(PluginCall call, long[] pattern) {
        Vibrator vibrator = getContext().getSystemService(Vibrator.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1));
        } else {
            vibrator.vibrate(pattern, -1);
        }
        call.resolve();
    }
}
