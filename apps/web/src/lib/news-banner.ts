/**
 * The site-wide news banner, driven by the `NEWS_BANNER` Unleash flag: the
 * flag switches it on and off (a kill switch, like every other live flag), and
 * the JSON payload of its variant says what to show, where and when. The
 * operator guide is in docker/README.md ("News banner").
 *
 * The text itself never comes from Unleash: `key` picks one of the translated
 * templates below, and `data` only fills in its values, so the banner stays
 * in the reader's language.
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
} as const;

export type NewsBannerKey = keyof typeof TEMPLATE_FIELDS;

export interface NewsBanner {
  /** Unique per announcement: dismissing one remembers this id. */
  id: string;
  key: NewsBannerKey;
  severity: "info" | "warning";
  dismissible: boolean;
  /** `app` is everything under /app; `public` the rest of the site. */
  placement: "public" | "app" | "all";
  startsAt: Date | null;
  endsAt: Date | null;
  data: Record<string, string>;
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

  if (typeof p.id !== "string" || !p.id) return invalid("missing id");

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

  return {
    id: p.id,
    key,
    severity: severity as NewsBanner["severity"],
    dismissible: p.dismissible !== false,
    placement: placement as NewsBanner["placement"],
    startsAt,
    endsAt,
    data,
  };
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
