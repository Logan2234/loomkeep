import { paraglideMiddleware } from "$lib/paraglide/server.js";
import type { Handle } from "@sveltejs/kit";

// Caddy (docker/Caddyfile) sets these same headers at the edge for the
// hosted VPS, but a self-host install running this container directly
// (no reverse proxy, or one without equivalent headers) would otherwise
// ship with neither - set them here too so the app is protected either way.
// CSP stays out of scope here (see docker/Caddyfile's Report-Only comment).
const SECURITY_HEADERS = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  // No camera/mic/geolocation/payment/USB feature is used anywhere in the
  // app — denying them outright means an injected or compromised script
  // can't invoke one via an embedded/child context either.
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  // Isolates this app's window from cross-origin windows it opens or is
  // opened by (no popup/postMessage flow anywhere in the app relies on
  // sharing a browsing context group), closing off a class of cross-origin
  // window-reference attacks.
  "Cross-Origin-Opener-Policy": "same-origin",
};

export const handle: Handle = ({ event, resolve }) =>
  paraglideMiddleware(event.request, async ({ request, locale }) => {
    event.request = request;
    const response = await resolve(event, {
      transformPageChunk: ({ html }) =>
        html.replaceAll("%paraglide.lang%", locale),
    });
    response.headers.append("Vary", "Accept-Language, Cookie");

    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      response.headers.set(name, value);
    }

    return response;
  });
