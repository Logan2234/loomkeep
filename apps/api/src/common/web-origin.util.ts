/**
 * The origin links should point at. WEB_ORIGIN may list several,
 * comma-separated, for CORS (see main.ts); links always use the first.
 */
export function primaryWebOrigin(raw: string | undefined): string {
  return (
    raw?.split(",")[0]?.trim().replace(/\/$/, "") || "http://localhost:5173"
  );
}

export function webOrigins(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/**
 * The origins a passkey ceremony run inside the Android app reports: Credential
 * Manager signs them as the APK, `android:apk-key-hash:` + its signing key's
 * SHA-256 in base64url, not as the page's https origin. Read from
 * ANDROID_APP_LINKS, the `package=fingerprint` pairs assetlinks.json serves.
 */
export function androidAppOrigins(appLinks: string | undefined): string[] {
  return (appLinks ?? "")
    .split(",")
    .map((pair) => pair.split("=")[1]?.trim().replace(/:/g, ""))
    .filter((hex): hex is string => !!hex)
    .map(
      (hex) =>
        `android:apk-key-hash:${Buffer.from(hex, "hex").toString("base64url")}`,
    );
}
