package app.loomkeep;

import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.res.Configuration;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import androidx.annotation.NonNull;
import androidx.core.graphics.Insets;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.webkit.WebSettingsCompat;
import androidx.webkit.WebViewFeature;
import app.loomkeep.widgets.HomeScreenWidgetsPlugin;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    // The most an instance can hold the launch screen: one running an older
    // web never calls ShellSplash, and a slow one shows its own loading screen.
    private static final long SPLASH_MAX_MS = 3000;
    private static final long SPLASH_EXIT_MS = 200;
    private static final int TABLET_MIN_WIDTH_DP = 600;

    private volatile boolean splashReleased = false;
    private final AppLock appLock = new AppLock(this);

    /** The launch screen stays until the web can draw, so no empty window shows in between. */
    void releaseSplash() {
        splashReleased = true;
    }

    AppLock appLock() {
        return appLock;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        ShellAppearance.applyNightMode(this);
        SplashScreen splash = SplashScreen.installSplashScreen(this);
        splash.setKeepOnScreenCondition(() -> !splashReleased);
        splash.setOnExitAnimationListener(provider ->
            provider.getView().animate().alpha(0f).setDuration(SPLASH_EXIT_MS).withEndAction(provider::remove).start()
        );
        new Handler(Looper.getMainLooper()).postDelayed(this::releaseSplash, SPLASH_MAX_MS);

        // Local plugins register before the bridge starts in super.onCreate.
        registerPlugin(ShellThemePlugin.class);
        registerPlugin(ShellHapticsPlugin.class);
        registerPlugin(ShellSplashPlugin.class);
        registerPlugin(ShellInstancePlugin.class);
        registerPlugin(ShellLockPlugin.class);
        registerPlugin(NotificationActionsPlugin.class);
        registerPlugin(HomeScreenWidgetsPlugin.class);
        config = InstanceConfig.load(this);
        super.onCreate(savedInstanceState);
        getBridge().setWebViewClient(new ShellWebViewClient(getBridge(), this::releaseSplash));
        int background = ShellAppearance.backgroundColor(this);
        getBridge().getWebView().setBackgroundColor(background);
        // The stretch at the page's ends pulled the fixed bars under the system's.
        getBridge().getWebView().setOverScrollMode(View.OVER_SCROLL_NEVER);
        getWindow().getDecorView().setBackgroundColor(background);
        // The web paints its own surface down to the screen's edge: the veil
        // Android would add behind three-button navigation only greys it.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            getWindow().setNavigationBarContrastEnforced(false);
        }
        // A WebView refuses WebAuthn unless its app opts in; passkeys then go
        // through Credential Manager, for sites whose assetlinks.json grants
        // this app get_login_creds. An older WebView goes without them.
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_AUTHENTICATION)) {
            WebSettingsCompat.setWebAuthenticationSupport(
                getBridge().getWebView().getSettings(),
                WebSettingsCompat.WEB_AUTHENTICATION_SUPPORT_FOR_APP
            );
        }
        fitWindowToBarsAndKeyboard();
        lockPhoneToPortrait(getResources().getConfiguration());
        NotificationChannels.ensure(this);
        AppShortcuts.publish(this, getBridge().getServerUrl());
        appLock.hideFromRecents();
    }

    /**
     * Replaces SystemBars' listener, which left the navigation bar's height
     * above the keyboard (a black band on a Poco X5 Pro). The keyboard covers
     * that bar: the bottom is whichever is taller, and the page sees no insets
     * left to apply a second time.
     */
    private void fitWindowToBarsAndKeyboard() {
        int edges = WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout();
        ViewCompat.setOnApplyWindowInsetsListener(getWindow().getDecorView(), (decor, insets) -> {
            Insets bars = insets.getInsets(edges);
            Insets keyboard = insets.getInsets(WindowInsetsCompat.Type.ime());
            decor.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, keyboard.bottom));
            return new WindowInsetsCompat.Builder(insets)
                .setInsets(edges, Insets.NONE)
                .setInsets(WindowInsetsCompat.Type.ime(), Insets.NONE)
                .setVisible(WindowInsetsCompat.Type.ime(), false)
                .build();
        });
    }

    @Override
    public void onResume() {
        super.onResume();
        appLock.onResume();
    }

    @Override
    public void onStop() {
        appLock.onStop();
        super.onStop();
    }

    // SystemBars repaints the window in the theme's windowBackground on every
    // configuration change, a theme change included.
    @Override
    public void onConfigurationChanged(@NonNull Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        getWindow().getDecorView().setBackgroundColor(ShellAppearance.backgroundColor(this));
        lockPhoneToPortrait(newConfig);
    }

    // Read at run time rather than in the manifest: tablets rotate freely, and
    // a foldable changes category as it opens.
    private void lockPhoneToPortrait(Configuration configuration) {
        setRequestedOrientation(
            configuration.smallestScreenWidthDp < TABLET_MIN_WIDTH_DP
                ? ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
                : ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
        );
    }

    // Also runs on the launch intent, once the bridge exists (BridgeActivity.load).
    @Override
    protected void onNewIntent(Intent intent) {
        String serverUrl = getBridge() == null ? null : getBridge().getServerUrl();
        super.onNewIntent(InstanceLink.resolve(this, SharedText.asAppLink(intent, serverUrl), serverUrl));
    }
}
