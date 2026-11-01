import { Capacitor, registerPlugin } from "@capacitor/core";

export type AppLockStatus = { available: boolean; enabled: boolean };

/** apps/mobile's own plugin (ShellLockPlugin.java). */
const ShellLock = registerPlugin<{
  status(): Promise<AppLockStatus>;
  setEnabled(options: { enabled: boolean }): Promise<AppLockStatus>;
}>("ShellLock");

/** Whether the installed Android app has the lock at all (an older APK doesn't). */
export const isAppLockSupported = (): boolean =>
  Capacitor.isPluginAvailable("ShellLock");

export const appLockStatus = (): Promise<AppLockStatus> => ShellLock.status();

/** Asks for the fingerprint, face or PIN first; the status says how it went. */
export const setAppLock = (enabled: boolean): Promise<AppLockStatus> =>
  ShellLock.setEnabled({ enabled });
