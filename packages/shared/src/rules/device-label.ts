/**
 * Best-effort, dependency-free label from a raw User-Agent string. Shared
 * between the web app's "Appareils connectés" list and the API's new-device
 * login alert, which also uses it as the device identity key (see
 * AuthService.deviceKeyFor) — normalized browser+OS rather than the raw UA,
 * so a browser version bump doesn't look like a new device.
 */
export function deviceLabel(
  userAgent: string | null | undefined,
): string | null {
  if (!userAgent) return null;

  const os = /iPhone/.test(userAgent)
    ? "iPhone"
    : /iPad/.test(userAgent)
      ? "iPad"
      : /Android/.test(userAgent)
        ? "Android"
        : /Windows/.test(userAgent)
          ? "Windows"
          : /Mac OS X|Macintosh/.test(userAgent)
            ? "macOS"
            : /Linux/.test(userAgent)
              ? "Linux"
              : null;

  // Order matters: Edge/Chrome UAs also contain "Safari"/"Chrome".
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /Firefox\//.test(userAgent)
      ? "Firefox"
      : /Chrome\//.test(userAgent)
        ? "Chrome"
        : /Safari\//.test(userAgent)
          ? "Safari"
          : null;

  return [browser, os].filter(Boolean).join(" · ") || null;
}
