import { getLocale } from "../paraglide/runtime.js";
import { typedRequest } from "./generated/typed-request";

/**
 * Works across every enabled domain, best match first. `local`: only what
 * the instance already knows, answered at once while the catalogues are
 * asked.
 */
export const searchWorks = (query: string, scope: "local" | "all") =>
  typedRequest("/search/works", {
    query: { q: query, scope, lang: getLocale() },
  });
