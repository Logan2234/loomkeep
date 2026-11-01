package app.loomkeep;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.Settings;
import android.view.View;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** What Admin › Diagnostics reads and tries on a phone, where no debugger can be attached. */
@CapacitorPlugin(name = "ShellDiagnostics")
public class ShellDiagnosticsPlugin extends Plugin {

    private static final long VIBRATION_MS = 150;

    @PluginMethod
    public void info(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            JSObject info = new JSObject();
            vibrator(info);
            window(info);
            call.resolve(info);
        });
    }

    private void vibrator(JSObject info) {
        Context context = getContext();
        Vibrator vibrator = context.getSystemService(Vibrator.class);
        info.put("device", Build.MANUFACTURER + " " + Build.MODEL + ", SDK " + Build.VERSION.SDK_INT);
        info.put("hasVibrator", vibrator.hasVibrator());
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) info.put("hasAmplitudeControl", vibrator.hasAmplitudeControl());
        info.put("ringerMode", context.getSystemService(AudioManager.class).getRingerMode());
        info.put("hapticSetting", Settings.System.getInt(context.getContentResolver(), Settings.System.HAPTIC_FEEDBACK_ENABLED, -1));
    }

    private void window(JSObject info) {
        View decor = getActivity().getWindow().getDecorView();
        View webView = getBridge().getWebView();
        View parent = (View) webView.getParent();
        info.put("decorHeight", decor.getHeight());
        info.put("webViewHeight", webView.getHeight());
        info.put("webViewPaddingBottom", webView.getPaddingBottom());
        info.put("parentHeight", parent.getHeight());
        info.put("parentPaddingBottom", parent.getPaddingBottom());
        info.put("density", getContext().getResources().getDisplayMetrics().density);

        WindowInsetsCompat insets = ViewCompat.getRootWindowInsets(decor);
        if (insets == null) return;
        Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
        Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
        info.put("imeBottom", ime.bottom);
        info.put("barsTop", bars.top);
        info.put("barsBottom", bars.bottom);
    }

    /** `usage`: "none", or the kind of vibration declared to Android, which a system may filter on. */
    @PluginMethod
    @SuppressWarnings("deprecation")
    public void vibrate(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            call.reject("Needs Android 8");
            return;
        }
        try {
            Vibrator vibrator = getContext().getSystemService(Vibrator.class);
            VibrationEffect effect = VibrationEffect.createOneShot(VIBRATION_MS, VibrationEffect.DEFAULT_AMPLITUDE);
            String usage = call.getString("usage", "none");
            if ("none".equals(usage)) {
                vibrator.vibrate(effect);
            } else {
                int kind = "alarm".equals(usage) ? AudioAttributes.USAGE_ALARM : AudioAttributes.USAGE_ASSISTANCE_SONIFICATION;
                vibrator.vibrate(effect, new AudioAttributes.Builder().setUsage(kind).build());
            }
            call.resolve();
        } catch (RuntimeException e) {
            call.reject(e.toString());
        }
    }
}
