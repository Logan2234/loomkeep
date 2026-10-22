// Reads what the web sees inside the app's WebView, through the DevTools
// socket a debug build exposes (forwarded to :9222 by smoke-test.sh), and
// fails unless the remote page has the Capacitor bridge and every plugin.
// Usage: node smoke-check.mjs <text the page's URL must contain>

const expectedInUrl = process.argv[2] ?? "/";
const PLUGINS = [
  "App",
  "Browser",
  "Filesystem",
  "Share",
  "BarcodeScanner",
  "SystemBars",
  // Only in a build made with Firebase's config (capacitor.config.ts).
  ...(process.env.PUSH_EXPECTED === "true" ? ["PushNotifications"] : []),
];
const deadline = Date.now() + 90_000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const PROBE = `(() => {
  const capacitor = window.Capacitor;
  return {
    href: location.href,
    userAgent: navigator.userAgent,
    ready: document.readyState === "complete",
    native: capacitor?.isNativePlatform?.() ?? false,
    plugins: Object.fromEntries(
      ${JSON.stringify(PLUGINS)}.map((name) => [
        name,
        capacitor?.isPluginAvailable?.(name) ?? false,
      ]),
    ),
  };
})()`;

async function appPage() {
  const pages = await (await fetch("http://127.0.0.1:9222/json")).json();
  return pages.find(
    (page) => page.type === "page" && page.url.startsWith("https://"),
  );
}

function evaluate(webSocketUrl, expression) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(webSocketUrl);
    socket.onopen = () =>
      socket.send(
        JSON.stringify({
          id: 1,
          method: "Runtime.evaluate",
          params: { expression, returnByValue: true },
        }),
      );

    socket.onmessage = ({ data }) => {
      const message = JSON.parse(data);
      if (message.id !== 1) return;
      socket.close();
      resolve(message.result?.result?.value);
    };

    socket.onerror = () => reject(new Error("DevTools socket error"));
  });
}

let last;

while (Date.now() < deadline) {
  try {
    const page = await appPage();

    if (page) {
      last = await evaluate(page.webSocketDebuggerUrl, PROBE);
      if (last?.ready && last.href.includes(expectedInUrl)) break;
    }
  } catch {
    // The WebView isn't up yet, or is between two pages.
  }

  await sleep(2000);
}

console.log(JSON.stringify(last, null, 2));
const missing = PLUGINS.filter((name) => !last?.plugins?.[name]);

if (!last?.ready || !last.href.includes(expectedInUrl)) {
  throw new Error(
    `The app never showed a page whose URL has "${expectedInUrl}"`,
  );
}

if (!last.native) throw new Error("The page has no native Capacitor bridge");

if (missing.length > 0) {
  throw new Error(`Plugins missing from the app: ${missing.join(", ")}`);
}
