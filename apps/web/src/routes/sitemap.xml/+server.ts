import type { RequestHandler } from "./$types";

/**
 * The public surface, and only that — four pages. Served from a route rather
 * than `static/` because a sitemap has to spell out absolute URLs, and the
 * origin differs per deployment (loomkeep.app, a self-hoster's NAS, localhost).
 * `url.origin` gives us the one the crawler actually reached us on.
 */
const PUBLIC_PATHS = [
  { path: "/", priority: "1.0" },
  { path: "/legal/terms-of-service", priority: "0.3" },
  { path: "/legal/privacy-policy", priority: "0.3" },
  { path: "/legal/legal-notice", priority: "0.3" },
];

export const GET: RequestHandler = ({ url, setHeaders }) => {
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${PUBLIC_PATHS.map(
  ({ path, priority }) =>
    `  <url><loc>${url.origin}${path}</loc><priority>${priority}</priority></url>`,
).join("\n")}
</urlset>
`;

  setHeaders({
    "content-type": "application/xml",
    "cache-control": "public, max-age=3600",
  });

  return new Response(body);
};
