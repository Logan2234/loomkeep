import favicon from "$lib/assets/favicon.ico?inline";
import type { RequestHandler } from "./$types";

// sirv (adapter-node's static file server) resolves content types via
// mrmime, which has no `.ico` entry — a plain static/favicon.ico is served
// with an empty Content-Type (see the ZAP "Content-Type header missing"
// finding). Routing it through a +server.ts instead lets us set it
// explicitly. `?inline` forces Vite to always emit a base64 data: URI for
// this import, regardless of its size vs the default inlining threshold.
const bytes = Buffer.from(favicon.slice(favicon.indexOf(",") + 1), "base64");

export const GET: RequestHandler = () =>
  new Response(bytes, {
    headers: {
      "Content-Type": "image/vnd.microsoft.icon",
      "Cache-Control": "public, max-age=86400",
    },
  });
