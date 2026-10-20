import { typedRequest } from "./generated/typed-request";

/** The Loomkeep page behind a TMDB/IMDb/Steam/… link, or `match: null`. */
export const resolveLink = (url: string) =>
  typedRequest("/links/resolve", { query: { url } });
