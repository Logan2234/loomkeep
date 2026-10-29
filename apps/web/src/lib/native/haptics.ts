import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

// The plugin's web side runs navigator.vibrate (Android's browser and PWA) and
// rejects where there's none (desktop, iOS Safari): a missing vibration is
// never worth surfacing. An APK from before the plugin reports it unavailable.
function feel(play: () => Promise<void>): void {
  if (!Capacitor.isPluginAvailable("Haptics")) return;
  play().catch(() => {});
}

/** A light tap for a repeated action: marking something seen, picking an item. */
export const tapFeedback = (): void =>
  feel(() => Haptics.impact({ style: ImpactStyle.Light }));

/** A fuller pattern for a reward: an achievement unlocked, a level crossed. */
export const successFeedback = (): void =>
  feel(() => Haptics.notification({ type: NotificationType.Success }));
