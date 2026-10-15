type BadgingNavigator = Navigator & {
  setAppBadge?: (count?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

/**
 * The installed app's icon badge (Badging API). Absent from browsers without
 * it, and refused where the app isn't installed: either way, nothing to do.
 */
export function showAppBadge(
  count: number,
  nav: BadgingNavigator = navigator,
): void {
  const done = count > 0 ? nav.setAppBadge?.(count) : nav.clearAppBadge?.();
  done?.catch(() => {});
}
