import { Capacitor, registerPlugin } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

// The plugin's web side runs navigator.vibrate (Android's browser and PWA) and
// rejects where there's none (desktop, iOS Safari): a missing vibration is
// never worth surfacing. An APK from before the plugin reports it unavailable.
function feel(play: () => Promise<void>): void {
  play().catch(() => {});
}

/** apps/mobile's own plugin (ShellHapticsPlugin.java): effects played by Android itself. */
const ShellHaptics = registerPlugin<{
  tap(): Promise<void>;
  success(): Promise<void>;
}>("ShellHaptics");

const inShell = (): boolean => Capacitor.isPluginAvailable("ShellHaptics");
const inPlugin = (): boolean => Capacitor.isPluginAvailable("Haptics");

/** A light tap for a repeated action: marking something seen, picking an item. */
export const tapFeedback = (): void => {
  if (inShell()) feel(() => ShellHaptics.tap());
  else if (inPlugin()) feel(() => Haptics.impact({ style: ImpactStyle.Light }));
};

/** A fuller pattern for a reward: an achievement unlocked, a level crossed. */
export const successFeedback = (): void => {
  if (inShell()) feel(() => ShellHaptics.success());
  else if (inPlugin())
    feel(() => Haptics.notification({ type: NotificationType.Success }));
};
