import type { RequestHandler } from "./$types";

/**
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
];

export const GET: RequestHandler = ({ url, setHeaders }) => {
  const body = [
    "User-agent: *",
    ...DISALLOWED.map((path) => `Disallow: ${path}`),
    "",
    `Sitemap: ${url.origin}/sitemap.xml`,
    "",
  ].join("\n");

  setHeaders({
    "content-type": "text/plain",
    "cache-control": "public, max-age=3600",
  });

  return new Response(body);
};
