package app.loomkeep;

import android.animation.ObjectAnimator;
import android.animation.PropertyValuesHolder;
import android.animation.StateListAnimator;
import android.app.Activity;
import android.app.KeyguardManager;
import android.content.Context;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.hardware.biometrics.BiometricManager;
import android.hardware.biometrics.BiometricPrompt;
import android.os.Build;
import android.os.CancellationSignal;
import android.os.SystemClock;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.animation.DecelerateInterpolator;
import android.widget.FrameLayout;
import android.widget.ImageView;
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
        int fg = activity.getColor(R.color.widget_fg);
        int accent = activity.getColor(R.color.widget_accent);

        LinearLayout screen = new LinearLayout(activity);
        screen.setOrientation(LinearLayout.VERTICAL);
        screen.setGravity(Gravity.CENTER_HORIZONTAL);
        screen.setBackgroundColor(ShellAppearance.backgroundColor(activity));
        screen.setClickable(true);
        screen.setPadding(dp(32), dp(72), dp(32), dp(64));

        LinearLayout brand = new LinearLayout(activity);
        brand.setGravity(Gravity.CENTER_VERTICAL);
        ImageView logo = new ImageView(activity);
        logo.setImageResource(R.drawable.ic_widget_logo);
        brand.addView(logo, new LinearLayout.LayoutParams(dp(28), dp(28)));
        TextView name = text(R.string.app_name, 20, fg, Typeface.BOLD);
        name.setPadding(dp(10), 0, 0, 0);
        brand.addView(name);
        screen.addView(brand);

        LinearLayout center = new LinearLayout(activity);
        center.setOrientation(LinearLayout.VERTICAL);
        center.setGravity(Gravity.CENTER);
        screen.addView(center, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));

        TextView title = text(R.string.app_lock_title, 22, fg, Typeface.BOLD);
        title.setPadding(0, 0, 0, dp(40));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) title.setAccessibilityHeading(true);
        center.addView(title);

        FrameLayout target = new FrameLayout(activity);
        // The halo grows past the target's bounds.
        target.setClipChildren(false);
        center.setClipChildren(false);
        View halo = new View(activity);
        halo.setBackground(ring(accent, Color.TRANSPARENT));
        target.addView(halo, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        FrameLayout unlock = new FrameLayout(activity);
        // The accent at 10 %: a glow behind the fingerprint, not a filled disc.
        unlock.setBackground(ring(accent, (accent & 0x00FFFFFF) | 0x1A000000));
        unlock.setContentDescription(activity.getString(R.string.app_lock_unlock));
        unlock.setFocusable(true);
        unlock.setStateListAnimator(pressScale(unlock));
        unlock.setOnClickListener(view -> {
            if (!prompting) prompt();
        });
        ImageView fingerprint = new ImageView(activity);
        fingerprint.setImageResource(R.drawable.ic_lock_fingerprint);
        fingerprint.setImageTintList(ColorStateList.valueOf(accent));
        unlock.addView(fingerprint, new FrameLayout.LayoutParams(dp(56), dp(56), Gravity.CENTER));
        target.addView(unlock, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        center.addView(target, new LinearLayout.LayoutParams(dp(136), dp(136)));

        TextView hint = text(R.string.app_lock_touch, 16, fg, Typeface.NORMAL);
        hint.setPadding(0, dp(28), 0, 0);
        center.addView(hint);
        TextView methods = text(R.string.app_lock_methods, 14, activity.getColor(R.color.widget_dim), Typeface.NORMAL);
        methods.setPadding(0, dp(6), 0, 0);
        center.addView(methods);

        // Arrives like the web's pages (DESIGN.md › Motion); the halo calls the
        // eye to the target once, then stays still. Android's own animation
        // scale turns both off for reduced motion.
        for (View part : new View[] { brand, center }) {
            part.setAlpha(0);
            part.setTranslationY(dp(8));
            part.animate().alpha(1).translationY(0).setDuration(240).setInterpolator(new DecelerateInterpolator());
        }
        halo.setAlpha(0.55f);
        halo.animate().alpha(0).scaleX(1.35f).scaleY(1.35f).setStartDelay(260).setDuration(900).setInterpolator(new DecelerateInterpolator());

        activity.addContentView(screen, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        overlay = screen;
        // Out of reach of a screen reader too, not just out of sight.
        activity.getBridge().getWebView().setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS);
    }

    private int dp(int value) {
        return Math.round(value * activity.getResources().getDisplayMetrics().density);
    }

    private TextView text(int string, int sp, int color, int style) {
        TextView view = new TextView(activity);
        view.setText(string);
        view.setTextSize(sp);
        view.setTextColor(color);
        view.setTypeface(Typeface.create(Typeface.DEFAULT, style));
        view.setGravity(Gravity.CENTER);
        return view;
    }

    private GradientDrawable ring(int stroke, int fill) {
        GradientDrawable ring = new GradientDrawable();
        ring.setShape(GradientDrawable.OVAL);
        ring.setColor(fill);
        ring.setStroke(dp(2), stroke);
        return ring;
    }

    private static StateListAnimator pressScale(View view) {
        StateListAnimator press = new StateListAnimator();
        press.addState(new int[] { android.R.attr.state_pressed }, scaleTo(view, 0.96f));
        press.addState(new int[] {}, scaleTo(view, 1f));
        return press;
    }

    private static ObjectAnimator scaleTo(View view, float scale) {
        return ObjectAnimator.ofPropertyValuesHolder(
            view,
            PropertyValuesHolder.ofFloat(View.SCALE_X, scale),
            PropertyValuesHolder.ofFloat(View.SCALE_Y, scale)
        ).setDuration(150);
    }

    private void hideOverlay() {
        if (overlay == null) return;
        ((ViewGroup) overlay.getParent()).removeView(overlay);
        overlay = null;
        activity.getBridge().getWebView().setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_AUTO);
    }
}
