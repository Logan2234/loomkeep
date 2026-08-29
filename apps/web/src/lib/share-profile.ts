/** Absolute link to a profile — what both the native share sheet and the QR code point at. */
export const profileUrl = (username: string): string =>
  `${window.location.origin}/app/u/${username}`;

/**
 * Tries the native OS share sheet (mobile browsers, and increasingly desktop
 * Chrome/Edge/Safari). Returns false when unsupported or the user backed out
 * without picking a target — either way the caller should fall back to the
 * link+QR modal. A real share (or the user cancelling the sheet, which is not
 * a failure) both count as "handled".
 */
export async function shareProfile(
  username: string,
  displayName: string,
): Promise<boolean> {
  if (!navigator.share) return false;

  try {
    await navigator.share({ title: displayName, url: profileUrl(username) });
    return true;
  } catch (err) {
    // AbortError: the user closed the sheet without choosing anything —
    // still "handled", don't fall back to the modal on top of it.
    return err instanceof Error && err.name === "AbortError";
  }
}
