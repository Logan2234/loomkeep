package app.loomkeep;

import com.getcapacitor.Plugin;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * No methods: its presence tells the web this APK draws its notifications
 * itself, with buttons (MOB-17), so the web asks the API for data-only
 * pushes. An older APK, without it, keeps the ones Android draws.
 */
@CapacitorPlugin(name = "NotificationActions")
public class NotificationActionsPlugin extends Plugin {}
