import type { RequestHandler } from "./$types";

/**
 * The public surface, and only that. Served from a route rather than
 * `static/` because a sitemap has to spell out absolute URLs, and the origin
 * differs per deployment (loomkeep.app, a self-hoster's NAS, localhost).
 * `url.origin` gives us the one the crawler actually reached us on.
 *
 * `lastmod` is the day the page's content last changed in a way a visitor
 * would notice: bump it by hand with the page. A date that moves on every
 * deploy teaches crawlers to ignore the field. A new public page (a landing
 * for one search intent, say) gets one line here.
 */
export const _PUBLIC_PATHS = [
  { path: "/", priority: "1.0", lastmod: "2026-11-23" },
  { path: "/legal/terms-of-service", priority: "0.3", lastmod: "2026-11-23" },
  { path: "/legal/privacy-policy", priority: "0.3", lastmod: "2026-11-23" },
  { path: "/legal/legal-notice", priority: "0.3", lastmod: "2026-11-23" },
  { path: "/legal/accessibility", priority: "0.3", lastmod: "2026-11-26" },
];

export const GET: RequestHandler = ({ url, setHeaders }) => {
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${_PUBLIC_PATHS
  .map(
    ({ path, priority, lastmod }) =>
      `  <url><loc>${url.origin}${path}</loc><lastmod>${lastmod}</lastmod><priority>${priority}</priority></url>`,
  )
  .join("\n")}
</urlset>
`;

  setHeaders({
    "content-type": "application/xml",
    "cache-control": "public, max-age=3600",
  });

  return new Response(body);
};
