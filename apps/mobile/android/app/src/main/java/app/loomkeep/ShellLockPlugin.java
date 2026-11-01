package app.loomkeep;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** The app lock's setting (MOB-25). Changing it takes the same check as unlocking. */
@CapacitorPlugin(name = "ShellLock")
public class ShellLockPlugin extends Plugin {

    @PluginMethod
    public void status(PluginCall call) {
        call.resolve(status());
    }

    @PluginMethod
    public void setEnabled(PluginCall call) {
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        MainActivity activity = (MainActivity) getActivity();
        activity.runOnUiThread(() ->
            AppLock.authenticate(activity, authenticated -> {
                if (authenticated) activity.appLock().setEnabled(enabled);
                call.resolve(status());
            })
        );
    }

    private JSObject status() {
        JSObject status = new JSObject();
        status.put("available", AppLock.isAvailable(getContext()));
        status.put("enabled", AppLock.isEnabled(getContext()));
        return status;
    }
}
