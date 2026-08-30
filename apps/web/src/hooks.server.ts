import { paraglideMiddleware } from "$lib/paraglide/server.js";
import type { Handle } from "@sveltejs/kit";

export const handle: Handle = ({ event, resolve }) =>
  paraglideMiddleware(event.request, async ({ request, locale }) => {
    event.request = request;
    const response = await resolve(event, {
      transformPageChunk: ({ html }) =>
        html.replaceAll("%paraglide.lang%", locale),
    });
    response.headers.append("Vary", "Accept-Language, Cookie");
    return response;
  });
