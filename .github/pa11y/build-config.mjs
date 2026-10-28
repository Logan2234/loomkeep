// Writes the pa11y-ci config for one variant of web-audit's Pa11y job:
//   node .github/pa11y/build-config.mjs <light|dark> <width> > config.json
// Every page from .github/web-audit/pages.mjs, signed out then signed in as
// the seed's alice (an admin there, so /app/admin is covered too).
import { auditedPages } from "../web-audit/pages.mjs";

const BASE = "http://localhost:18080";
const [theme, width] = process.argv.slice(2);

if (!["light", "dark"].includes(theme) || !Number(width)) {
  throw new Error("usage: build-config.mjs <light|dark> <width>");
}

const { publicPages, appPages } = auditedPages();

// One browser context for the whole run (useIncognitoBrowserContext off), so
// the session this entry opens carries over to every page after it. Its own
// URL differs from the signed-out /login's, which pa11y-ci keys results by.
const signIn = {
  url: `${BASE}/login#sign-in`,
  actions: [
    "set field input[name=identifier] to alice@example.com",
    "set field input[name=password] to Password123!",
    "click element button[type=submit]",
    "wait for path to be /app",
  ],
};

const config = {
  defaults: {
    timeout: 30000,
    standard: "WCAG2AA",
    viewport: { width: Number(width), height: Number(width) < 768 ? 812 : 800 },
    runners: ["axe", "htmlcs"],
    chromeLaunchConfig: {
      executablePath: "/usr/bin/google-chrome",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        // The landing's entrance animations otherwise get measured halfway
        // through, as contrast failures.
        "--force-prefers-reduced-motion",
        // The app follows prefers-color-scheme until a theme is picked.
        ...(theme === "dark" ? ["--force-dark-mode"] : []),
      ],
    },
    reporters: ["cli", "./.github/pa11y/sarif-reporter.js"],
  },
  urls: [
    ...publicPages.map((path) => BASE + path),
    signIn,
    ...appPages.filter((path) => path !== "/app").map((path) => BASE + path),
  ],
  concurrency: 1,
  useIncognitoBrowserContext: false,
};

process.stdout.write(JSON.stringify(config, null, 2));
