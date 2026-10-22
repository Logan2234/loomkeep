import type { CapacitorConfig } from "@capacitor/cli";
import { version } from "./package.json";

// The shell loads the instance's own /app instead of bundling the web build:
// web and API stay deployed together, and the session cookies stay
// first-party (docs/mobile-app-plan.md, "Choix d'architecture").
// LOOMKEEP_APP_URL points a dev build elsewhere, e.g. the emulator's view of
// the local dev server: http://10.0.2.2:5173/app
const appUrl = process.env.LOOMKEEP_APP_URL ?? "https://loomkeep.app/app";

const config: CapacitorConfig = {
  appId: "app.loomkeep",
  appName: "Loomkeep",
  // Holds only the local error page: server.url replaces it otherwise.
  webDir: "www",
  // Lets the API, GlitchTip and Umami tell the app from a browser.
  appendUserAgent: `LoomkeepApp/${version}`,
  // Séance's dark background, shown until the remote page paints.
  backgroundColor: "#0c0d10",
  android: {
    // Vite's default build target; an older WebView gets the error page
    // (which points to the WebView update) instead of a broken app.
    minWebViewVersion: 111,
  },
  server: {
    url: appUrl,
    cleartext: appUrl.startsWith("http://"),
    // The local page has no other way to know where "retry" should go.
    errorPath: `error.html?retry=${encodeURIComponent(appUrl)}`,
  },
};

export default config;
