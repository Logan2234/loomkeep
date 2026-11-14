/**
 * Query parameters that carry a bearer secret: the calendar (.ics), release
 * (Atom/RSS) and activity feeds, and the newsletter's one-click unsubscribe,
 * all authenticate with `?token=` because a calendar app or a mail client
 * can't send a header. Logged as-is, the access log hands out a long-lived
 * key to every feed it saw.
 */
const SECRET_QUERY_PARAMS = ["token"];

const REDACTED = "[redacted]";

const SECRET_PARAM = new RegExp(
  `([?&](?:${SECRET_QUERY_PARAMS.join("|")})=)[^&#]*`,
  "gi",
);

/** `url` with the value of every secret query parameter replaced. */
export function redactUrl(url: string): string;
export function redactUrl(url: string | undefined): string | undefined;

export function redactUrl(url: string | undefined): string | undefined {
  return url?.replace(SECRET_PARAM, `$1${REDACTED}`);
}

/** A parsed query object, with the same parameters replaced. */
export function redactQuery(query: unknown): unknown {
  if (!query || typeof query !== "object") return query;

  return Object.fromEntries(
    Object.entries(query).map(([key, value]) => [
      key,
      SECRET_QUERY_PARAMS.includes(key.toLowerCase()) ? REDACTED : value,
    ]),
  );
}
