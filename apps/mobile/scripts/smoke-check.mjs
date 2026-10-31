// Fails unless the app shows a page whose URL has the given text, with the
// Capacitor bridge and every plugin.
// Usage: node smoke-check.mjs <text the page's URL must contain>
import { onPage } from "./devtools.mjs";

const expectedInUrl = process.argv[2] ?? "/";
const PLUGINS = [
  "App",
  "Browser",
  "Filesystem",
  "Share",
  "BarcodeScanner",
  "SystemBars",
  "ShellTheme",
  "ShellHaptics",
  "ShellInstance",
  "NotificationActions",
  // Only in a build made with Firebase's config (capacitor.config.ts).
  ...(process.env.PUSH_EXPECTED === "true" ? ["PushNotifications"] : []),
];

const PROBE = `(() => {
  const capacitor = window.Capacitor;
  return {
    href: location.href,
    userAgent: navigator.userAgent,
    native: capacitor?.isNativePlatform?.() ?? false,
    plugins: Object.fromEntries(
      ${JSON.stringify(PLUGINS)}.map((name) => [
        name,
        capacitor?.isPluginAvailable?.(name) ?? false,
      ]),
    ),
  };
})()`;

const result = await onPage(expectedInUrl, PROBE);
console.log(JSON.stringify(result, null, 2));

if (!result?.native) throw new Error("The page has no native Capacitor bridge");

const missing = PLUGINS.filter((name) => !result.plugins?.[name]);

if (missing.length > 0) {
  throw new Error(`Plugins missing from the app: ${missing.join(", ")}`);
}
