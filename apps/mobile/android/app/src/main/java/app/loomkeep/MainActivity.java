package app.loomkeep;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Local plugins register before the bridge starts in super.onCreate.
        registerPlugin(ShellThemePlugin.class);
        super.onCreate(savedInstanceState);
        AppShortcuts.publish(this, getBridge().getServerUrl());
    }
}
