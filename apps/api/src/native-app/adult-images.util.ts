const IMAGE_FIELDS = new Set([
  "posterUrl",
  "backdropUrl",
  "coverUrl",
  "imageUrl",
  "stillUrl",
  "trailerVideoId",
]);
const IMAGE_LIST_FIELDS = new Set(["screenshots", "videos"]);

// TMDB (`/t/p/w500/x.jpg`) and IGDB (`/t_cover_big/x.jpg`) put the size in
// the path, and a response may ask for another size than the one stored.
const SIZE_SEGMENT = /\/(?:t\/p\/[a-z0-9]+|t_[a-z0-9_]+)\//;

// Files, streams, dates and decimals pass through as they are.
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}

/** An image's identity, whatever size it is requested at. */
export function imageKey(url: string): string {
  return url.replace(SIZE_SEGMENT, "/");
}

/**
 * A copy of `value` without the images of 18+ works: every image of an
 * object flagged `isAdult`, and anywhere else an image whose key is in
 * `adultKeys` (most responses carry a work's image without its flag).
 */
export function stripAdultImages(
  value: unknown,
  adultKeys: ReadonlySet<string>,
  insideAdult = false,
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stripAdultImages(item, adultKeys, insideAdult));
  }

  if (!isPlainObject(value)) return value;

  const adult = insideAdult || value.isAdult === true;
  const copy: Record<string, unknown> = {};

  for (const [key, field] of Object.entries(value)) {
    if (adult && IMAGE_FIELDS.has(key)) {
      copy[key] = null;
    } else if (adult && IMAGE_LIST_FIELDS.has(key) && Array.isArray(field)) {
      copy[key] = [];
    } else if (
      IMAGE_FIELDS.has(key) &&
      typeof field === "string" &&
      adultKeys.has(imageKey(field))
    ) {
      copy[key] = null;
    } else {
      copy[key] = stripAdultImages(field, adultKeys, adult);
    }
  }

  return copy;
}
