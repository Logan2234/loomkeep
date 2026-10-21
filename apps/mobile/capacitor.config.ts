import type { CapacitorConfig } from "@capacitor/cli";

// The shell loads the instance's own /app instead of bundling the web build:
// web and API stay deployed together, and the session cookies stay
// first-party (docs/mobile-app-plan.md, "Choix d'architecture").
// LOOMKEEP_APP_URL points a dev build elsewhere, e.g. the emulator's view of
// the local dev server: http://10.0.2.2:5173/app
const appUrl = process.env.LOOMKEEP_APP_URL ?? "https://loomkeep.app/app";

const config: CapacitorConfig = {
  appId: "app.loomkeep",
  appName: "Loomkeep",
  // Required by the CLI even though server.url replaces it at runtime.
  webDir: "www",
  server: {
    url: appUrl,
    cleartext: appUrl.startsWith("http://"),
  },
};

export default config;
