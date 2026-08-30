import { getLocale, isLocale } from "$lib/paraglide/runtime.js";
import { createManifest } from "$lib/pwa-manifest";
import type { RequestHandler } from "@sveltejs/kit";

export const GET: RequestHandler = ({ url }) => {
  const requested = url.searchParams.get("lang");
  const locale = isLocale(requested) ? requested : getLocale();
  return new Response(JSON.stringify(createManifest(locale)), {
    headers: {
      "Content-Type": "application/manifest+json",
      "Content-Language": locale,
      "Cache-Control": "private, no-cache",
      Vary: "Accept-Language, Cookie",
    },
  });
};
