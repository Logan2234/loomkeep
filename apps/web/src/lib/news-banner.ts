/**
 * The site-wide news banner, driven by the `NEWS_BANNER` Unleash flag: the
 * flag switches it on and off (a kill switch, like every other live flag), and
 * the JSON payload of its variant says what to show, where and when. The
 * operator guide is in docker/README.md ("News banner").
 *
 * `key` picks one of the translated templates below, whose `data` only fills
 * in its values, so the banner stays in the reader's language. The one
 * exception is `custom`: there `data` holds the text itself, one entry per
 * language — see `customText`.
 */

export const NEWS_BANNER_FLAG = "NEWS_BANNER";

/**
 * Each template and the `data` fields it requires. Adding one means adding
 * its message in apps/web/messages and a case in NewsBanner.svelte.
 */
const TEMPLATE_FIELDS = {
  /** `start`/`end`: ISO datetimes, shown in the reader's time zone. */
  maintenance_scheduled: ["start", "end"],
  degraded_service: [],
  /** `data` is the text, keyed by language: `{ "fr": "…", "en": "…" }`. */
  custom: [],
} as const;

type NewsBannerKey = keyof typeof TEMPLATE_FIELDS;

export interface NewsBanner {
  /**
   * Dismissing a banner remembers this id. Optional in the payload: without
   * one it is derived from the content, so editing the text brings a closed
   * banner back.
   */
  id: string;
  key: NewsBannerKey;
  severity: "info" | "warning";
  dismissible: boolean;
  /** `app` is everything under /app; `public` the rest of the site. */
  placement: "public" | "app" | "all";
  startsAt: Date | null;
  endsAt: Date | null;
  data: Record<string, string>;
  /** Where the banner's button leads; no button without one. */
  href: string | null;
}

const SEVERITIES = ["info", "warning"] as const;
const PLACEMENTS = ["public", "app", "all"] as const;

function optionalDate(value: unknown): Date | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/**
 * Reads the variant's JSON payload. Anything malformed — bad JSON, an unknown
 * template, a missing field — shows nothing rather than a broken banner, and
 * says why in the console for whoever is editing the flag.
 */
export function parseNewsBanner(raw: string | undefined): NewsBanner | null {
  if (!raw) return null;

  const invalid = (reason: string) => {
    console.warn(`[${NEWS_BANNER_FLAG}] ignored: ${reason}`);
    return null;
  };

  let json: unknown;

  try {
    json = JSON.parse(raw);
  } catch {
    return invalid("payload is not valid JSON");
  }

  if (!json || typeof json !== "object")
    return invalid("payload is not an object");
  const p = json as Record<string, unknown>;

  if (typeof p.key !== "string" || !Object.hasOwn(TEMPLATE_FIELDS, p.key))
    return invalid(`unknown key ${String(p.key)}`);
  const key = p.key as NewsBannerKey;

  const severity = p.severity ?? "info";
  if (!SEVERITIES.includes(severity as NewsBanner["severity"]))
    return invalid(`unknown severity ${String(severity)}`);

  const placement = p.placement ?? "all";
  if (!PLACEMENTS.includes(placement as NewsBanner["placement"]))
    return invalid(`unknown placement ${String(placement)}`);

  const startsAt = optionalDate(p.startsAt);
  const endsAt = optionalDate(p.endsAt);
  if (startsAt === undefined || endsAt === undefined)
    return invalid("startsAt/endsAt must be ISO dates");

  const data: Record<string, string> = {};

  if (p.data !== undefined) {
    if (!p.data || typeof p.data !== "object")
      return invalid("data must be an object");

    for (const [field, value] of Object.entries(p.data)) {
      if (typeof value === "string") data[field] = value;
    }
  }

  for (const field of TEMPLATE_FIELDS[key]) {
    if (!data[field]) return invalid(`${key} needs data.${field}`);
  }

  if (key === "custom" && Object.keys(data).length === 0)
    return invalid("custom needs its text in data, one entry per language");

  let href: string | null = null;

  if (p.href !== undefined) {
    if (typeof p.href !== "string" || !isSafeHref(p.href))
      return invalid("href must be a path (/app/…) or an http(s) URL");
    href = p.href;
  }

  const id =
    typeof p.id === "string" && p.id
      ? p.id
      : `auto-${hashString(JSON.stringify([key, data, href]))}`;

  return {
    id,
    key,
    severity: severity as NewsBanner["severity"],
    dismissible: p.dismissible !== false,
    placement: placement as NewsBanner["placement"],
    startsAt,
    endsAt,
    data,
    href,
  };
}

/** A short, stable fingerprint (djb2) — not for anything security-related. */
function hashString(text: string): string {
  let hash = 5381;

  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  }

  return (hash >>> 0).toString(36);
}

/**
 * A site path or an http(s) URL — never `javascript:` or a protocol-relative
 * `//host`, which would turn the banner's button into a script or an open
 * redirect for whoever can edit the flag.
 */
function isSafeHref(href: string): boolean {
  if (href.startsWith("/")) return !href.startsWith("//");

  try {
    const { protocol } = new URL(href);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

/** Whether `href` leaves the site (and so opens in a new tab). */
export function isExternalHref(href: string): boolean {
  return !href.startsWith("/");
}

/**
 * A `custom` banner's text for `locale`: that language if it's there, else
 * English, else whichever language comes first.
 */
export function customText(
  data: Record<string, string>,
  locale: string,
): string {
  return data[locale] ?? data.en ?? Object.values(data)[0] ?? "";
}

/** Whether `now` falls inside the banner's optional display window. */
export function isNewsBannerLive(banner: NewsBanner, now: Date): boolean {
  if (banner.startsAt && now < banner.startsAt) return false;
  if (banner.endsAt && now >= banner.endsAt) return false;
  return true;
}

/** Whether the banner is meant for the page at `pathname`. */
export function newsBannerFitsPage(
  banner: NewsBanner,
  pathname: string,
): boolean {
  if (banner.placement === "all") return true;
  const inApp = pathname === "/app" || pathname.startsWith("/app/");
  return banner.placement === "app" ? inApp : !inApp;
}
