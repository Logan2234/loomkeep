export const DEFAULT_SUPPORT_ADDRESS = "contact@loomkeep.app";
export const QUACKBACK_ORIGIN = "https://feedback.loomkeep.app";

/** True for the hosted instance (loomkeep.app), never for a self-host. */
export function isHostedOrigin(webOrigin: string): boolean {
  try {
    const host = new URL(webOrigin).hostname;
    return host === "loomkeep.app" || host.endsWith(".loomkeep.app");
  } catch {
    return false;
  }
}

/**
 * The instance's own support mailbox: `MAIL_SUPPORT_ADDRESS`, else
 * contact@loomkeep.app on the hosted instance only. A self-host that sets
 * none gets `undefined`, so its members' replies and contact links never
 * reach Loomkeep's mailbox by default.
 */
export function configuredSupportAddress(
  raw: string | undefined,
  webOrigin: string,
): string | undefined {
  return (
    raw?.trim() ||
    (isHostedOrigin(webOrigin) ? DEFAULT_SUPPORT_ADDRESS : undefined)
  );
}
