import { Capacitor, registerPlugin } from "@capacitor/core";

/** apps/mobile's own plugin (ShellInstancePlugin.java). */
const ShellInstance = registerPlugin<{ open(): Promise<void> }>(
  "ShellInstance",
);

/** Whether the installed Android app can switch to another instance (an older APK can't). */
export const isInstancePickerAvailable = (): boolean =>
  Capacitor.isPluginAvailable("ShellInstance");

/** Opens the app's own instance picker, a local page that works offline too. */
export const openInstancePicker = (): Promise<void> => ShellInstance.open();
