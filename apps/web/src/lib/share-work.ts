/** Absolute link to a work's page — what the share sheet, the copy and the QR code carry. */
export const workUrl = (href: string): string =>
  `${window.location.origin}${href}`;

/** Whether this browser has a system share sheet to hand the link to. */
export const canShareNatively = (): boolean =>
  typeof navigator !== "undefined" && !!navigator.share;

/** Hands the work's link to the system share sheet; closing it isn't a failure. */
export async function shareWorkNatively(
  title: string,
  href: string,
): Promise<void> {
  try {
    await navigator.share({ title, url: workUrl(href) });
  } catch (err) {
    if (!(err instanceof Error && err.name === "AbortError")) throw err;
  }
}
