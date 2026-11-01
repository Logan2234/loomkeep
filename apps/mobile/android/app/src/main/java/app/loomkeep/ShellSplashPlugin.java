package app.loomkeep;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** The web saying it can draw the app: MainActivity lets its launch screen go. */
@CapacitorPlugin(name = "ShellSplash")
public class ShellSplashPlugin extends Plugin {

    @PluginMethod
    public void ready(PluginCall call) {
        ((MainActivity) getActivity()).releaseSplash();
        call.resolve();
    }
}
