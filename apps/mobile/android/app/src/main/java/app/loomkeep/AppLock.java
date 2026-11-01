package app.loomkeep;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.Context;
import android.hardware.biometrics.BiometricManager;
import android.hardware.biometrics.BiometricPrompt;
import android.os.Build;
import android.os.CancellationSignal;
import android.os.SystemClock;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

/**
 * The optional lock on opening the app (MOB-25): fingerprint or face, with the
 * screen lock's PIN as the way out, so a failed sensor never locks anyone out.
 * It guards what the app shows: widgets and notification actions stay on the
 * home screen, under the phone's own lock.
 *
 * Android's own BiometricPrompt, which needs Android 10 for the PIN fallback,
 * rather than adding androidx.biometric for older releases.
 */
final class AppLock {

    private static final String PREFERENCES = "app_lock";
    private static final String ENABLED_KEY = "enabled";
    /** A trip to the share sheet, the camera or a browser tab doesn't lock. */
    private static final long GRACE_MS = 60_000;
    private static final long NEVER = -1;

    // Static: outlives a recreate (switching instance), not the process.
    private static long leftAt = NEVER;

    private final MainActivity activity;
    private View overlay;
    private boolean prompting;
    private boolean returnedWhileLocked;

    AppLock(MainActivity activity) {
        this.activity = activity;
    }

    interface Result {
        void done(boolean authenticated);
    }

    static boolean isAvailable(Context context) {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && context.getSystemService(KeyguardManager.class).isDeviceSecure();
    }

    static boolean isEnabled(Context context) {
        return context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE).getBoolean(ENABLED_KEY, false);
    }

    void setEnabled(boolean enabled) {
        activity.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE).edit().putBoolean(ENABLED_KEY, enabled).apply();
        leftAt = SystemClock.elapsedRealtime();
        hideFromRecents();
    }

    /** No thumbnail of the app's content in the recent apps, where Android allows it. */
    void hideFromRecents() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            activity.setRecentsScreenshotEnabled(!isEnabled(activity));
        }
    }

    void onResume() {
        if (!isEnabled(activity) || !isAvailable(activity)) {
            hideOverlay();
            return;
        }
        if (overlay != null) {
            if (returnedWhileLocked && !prompting) prompt();
            returnedWhileLocked = false;
        } else if (!prompting && (leftAt == NEVER || SystemClock.elapsedRealtime() - leftAt >= GRACE_MS)) {
            showOverlay();
            prompt();
        }
    }

    void onStop() {
        if (overlay == null) leftAt = SystemClock.elapsedRealtime();
        else if (!prompting) returnedWhileLocked = true;
    }

    private void prompt() {
        prompting = true;
        authenticate(activity, authenticated -> {
            prompting = false;
            if (!authenticated) return;
            leftAt = SystemClock.elapsedRealtime();
            hideOverlay();
        });
    }

    // setDeviceCredentialAllowed: the only way to offer the PIN on Android 10.
    @SuppressWarnings("deprecation")
    static void authenticate(Activity activity, Result result) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            result.done(false);
            return;
        }
        BiometricPrompt.Builder builder = new BiometricPrompt.Builder(activity).setTitle(activity.getString(R.string.app_lock_prompt));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            builder.setAllowedAuthenticators(
                BiometricManager.Authenticators.BIOMETRIC_WEAK | BiometricManager.Authenticators.DEVICE_CREDENTIAL
            );
        } else {
            builder.setDeviceCredentialAllowed(true);
        }
        builder
            .build()
            .authenticate(
                new CancellationSignal(),
                activity.getMainExecutor(),
                new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult authentication) {
                        result.done(true);
                    }

                    // A rejected finger only asks again (onAuthenticationFailed);
                    // this is the prompt closing: cancelled, or too many tries.
                    @Override
                    public void onAuthenticationError(int code, CharSequence message) {
                        result.done(false);
                    }
                }
            );
    }

    private void showOverlay() {
        LinearLayout screen = new LinearLayout(activity);
        screen.setOrientation(LinearLayout.VERTICAL);
        screen.setGravity(Gravity.CENTER);
        screen.setBackgroundColor(ShellAppearance.backgroundColor(activity));
        screen.setClickable(true);

        TextView title = new TextView(activity);
        title.setText(R.string.app_lock_title);
        title.setTextColor(activity.getColor(R.color.widget_fg));
        title.setTextSize(18);
        title.setGravity(Gravity.CENTER);
        title.setPadding(0, 0, 0, 32);
        screen.addView(title);

        Button unlock = new Button(activity);
        unlock.setText(R.string.app_lock_unlock);
        unlock.setOnClickListener(view -> {
            if (!prompting) prompt();
        });
        screen.addView(unlock);

        activity.addContentView(screen, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        overlay = screen;
        // Out of reach of a screen reader too, not just out of sight.
        activity.getBridge().getWebView().setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS);
    }

    private void hideOverlay() {
        if (overlay == null) return;
        ((ViewGroup) overlay.getParent()).removeView(overlay);
        overlay = null;
        activity.getBridge().getWebView().setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_AUTO);
    }
}
