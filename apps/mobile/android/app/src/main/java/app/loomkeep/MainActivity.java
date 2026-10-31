package app.loomkeep;

import android.content.Intent;
import android.os.Bundle;
import androidx.webkit.WebSettingsCompat;
import androidx.webkit.WebViewFeature;
import app.loomkeep.widgets.HomeScreenWidgetsPlugin;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Local plugins register before the bridge starts in super.onCreate.
        registerPlugin(ShellThemePlugin.class);
        registerPlugin(ShellHapticsPlugin.class);
        registerPlugin(ShellInstancePlugin.class);
        registerPlugin(NotificationActionsPlugin.class);
        registerPlugin(HomeScreenWidgetsPlugin.class);
        config = InstanceConfig.load(this);
        super.onCreate(savedInstanceState);
        getBridge().setWebViewClient(new ShellWebViewClient(getBridge()));
        // A WebView refuses WebAuthn unless its app opts in; passkeys then go
        // through Credential Manager, for sites whose assetlinks.json grants
        // this app get_login_creds. An older WebView goes without them.
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_AUTHENTICATION)) {
            WebSettingsCompat.setWebAuthenticationSupport(
                getBridge().getWebView().getSettings(),
                WebSettingsCompat.WEB_AUTHENTICATION_SUPPORT_FOR_APP
            );
        }
        AppShortcuts.publish(this, getBridge().getServerUrl());
    }

    // Also runs on the launch intent, once the bridge exists (BridgeActivity.load).
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(SharedText.asAppLink(intent, getBridge() == null ? null : getBridge().getServerUrl()));
    }
}
