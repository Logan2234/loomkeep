// Every page web-audit's Pa11y job visits, read from apps/web/src/routes so a
// new screen is audited without anyone listing it. A new route with a
// parameter fails here until it gets a value or an exclusion below.
import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROUTES = new URL("../../apps/web/src/routes", import.meta.url).pathname
  // file:///C:/… on Windows
  .replace(/^\/([A-Za-z]:)/, "$1");

// Values the ephemeral stack can serve. The book and album are real Open
// Library and MusicBrainz ids: their pages are fetched live, and those two
// catalogs need no key. LIST_ID is the seed's list, looked up by the job.
const PARAMS = {
  "/app/books/[id]": "/app/books/OL893414W",
  "/app/music/[id]": "/app/music/6e335887-60ba-38f0-95af-fae7774336bf",
  "/app/lists/[id]": () => `/app/lists/${requireEnv("LIST_ID")}`,
  "/app/u/[username]": "/app/u/alice",
};

const EXCLUDED = {
  // TMDB and IGDB need API keys the ephemeral stack doesn't have.
  "/app/media/[type]/[id]": "TMDB key",
  "/app/games/[id]": "IGDB key",
  "/app/messages/[id]": "the seed has no conversation",
  "/app/settings/import/simkl/callback": "OAuth redirect target",
};

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

function* pageFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* pageFiles(path);
    else if (entry.name === "+page.svelte") yield path;
  }
}

function routeOf(file) {
  const segments = relative(ROUTES, file)
    .split(sep)
    .slice(0, -1)
    .filter((segment) => !/^\(.*\)$/.test(segment));
  return "/" + segments.join("/");
}

/** Signed-out pages first, then the signed-in ones, as paths. */
export function auditedPages() {
  const publicPages = [];
  const appPages = [];

  for (const route of [...pageFiles(ROUTES)].map(routeOf).sort()) {
    if (route in EXCLUDED) continue;
    let path = route;

    if (route.includes("[")) {
      const value = PARAMS[route];

      if (!value) {
        throw new Error(
          `${route} needs a value in PARAMS or a reason in EXCLUDED (.github/web-audit/pages.mjs)`,
        );
      }

      path = typeof value === "function" ? value() : value;
    }

    (route === "/app" || route.startsWith("/app/")
      ? appPages
      : publicPages
    ).push(path);
  }

  return { publicPages, appPages };
}
