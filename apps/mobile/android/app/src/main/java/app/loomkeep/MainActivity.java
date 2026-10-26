package app.loomkeep;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Local plugins register before the bridge starts in super.onCreate.
        registerPlugin(ShellThemePlugin.class);
        registerPlugin(ShellInstancePlugin.class);
        config = InstanceConfig.load(this);
        super.onCreate(savedInstanceState);
        getBridge().setWebViewClient(new ShellWebViewClient(getBridge()));
        AppShortcuts.publish(this, getBridge().getServerUrl());
    }

    // Also runs on the launch intent, once the bridge exists (BridgeActivity.load).
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(SharedText.asAppLink(intent, getBridge() == null ? null : getBridge().getServerUrl()));
    }
}
