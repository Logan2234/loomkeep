import * as env from "$app/env/public";
import type { RequestHandler } from "./$types";

/**
 * Off by default (`PUBLIC_SEARCH_INDEXING`, "true" on loomkeep.app): a
 * self-hosted instance would otherwise put its copy of the landing page and
 * its address in search results. The pages also carry a noindex meta
 * (routes/+layout.svelte), which keeps out a crawler that ignores this file.
 *
 * Only the public surface is worth crawling: the landing page and the legal
 * documents (server-rendered, so a crawler gets real HTML). Everything else is
 * behind auth or a pure client-side SPA shell — a crawler would index an empty
 * <body> and burn crawl budget on it.
 *
 * This is a hint, not enforcement: blocking abusive or AI scrapers is
 * Cloudflare's job at the edge, not this file's. Served from a route rather
 * than `static/` so the `Sitemap:` line can carry an absolute URL on whatever
 * origin this instance is reached at (see sitemap.xml/+server.ts).
 */
const DISALLOWED = [
  "/app/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/api/",
];

export const GET: RequestHandler = ({ url, setHeaders }) => {
  const body =
    env.PUBLIC_SEARCH_INDEXING === "true"
      ? [
          "User-agent: *",
          ...DISALLOWED.map((path) => `Disallow: ${path}`),
          "",
          `Sitemap: ${url.origin}/sitemap.xml`,
          "",
        ].join("\n")
      : "User-agent: *\nDisallow: /\n";

  setHeaders({
    "content-type": "text/plain",
    "cache-control": "public, max-age=3600",
  });

  return new Response(body);
};
