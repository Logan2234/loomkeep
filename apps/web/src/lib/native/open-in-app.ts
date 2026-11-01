/** Mirrors the manifest's App Links and InstanceLink.java. */
export const OPEN_IN_APP_PAGES = [
  "/app/",
  "/verify-email",
  "/reset-password",
  "/forgot-password",
  "/login",
  "/register",
  "/account/",
  "/unsubscribe",
];

const HOSTED_INSTANCE = "loomkeep.app";

/**
 * Whether to offer the Android app on this page (MOB-24): App Links already
 * open it on the hosted instance, and only cover the hosts in its manifest.
 */
export function canOfferApp(url: URL, userAgent: string): boolean {
  return (
    url.protocol === "https:" &&
    url.hostname !== HOSTED_INSTANCE &&
    /\bAndroid\b/.test(userAgent) &&
    (url.pathname === "/app" ||
      OPEN_IN_APP_PAGES.some((page) => url.pathname.startsWith(page)))
  );
}

/**
 * The page in the app, from a browser: emails can't carry this themselves, as
 * mail clients such as Gmail strip links with a custom scheme. An intent: URL
 * rather than loomkeep:// so that, without the app, the browser stays on the page.
 */
export function openInAppUrl(url: URL): string {
  const link = new URLSearchParams({
    instance: url.origin,
    path: url.pathname + url.search + url.hash,
  });
  const fallback = encodeURIComponent(url.href);
  return `intent://open?${link}#Intent;scheme=loomkeep;S.browser_fallback_url=${fallback};end`;
}
