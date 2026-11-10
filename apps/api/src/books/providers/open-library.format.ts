import { stripTags } from "../../common/text.util";

const COVERS_URL = "https://covers.openlibrary.org/b/id";

/**
 * Built directly, not verified — same approach as the other providers' image
 * URLs. The `-L` variant is ~500px wide, enough for the detail page's hero
 * and downscaled by the browser in poster grids.
 */
export function coverUrl(coverId: number | undefined): string | null {
  return coverId ? `${COVERS_URL}/${coverId}-L.jpg` : null;
}

// Some edition records carry a placeholder id (e.g. -1) instead of omitting
// `covers` — covers.openlibrary.org returns a 503 for those, so skip past
// them to the first genuine one rather than emitting a broken image URL.
export function firstPositiveCover(
  covers: number[] | undefined,
): number | undefined {
  return covers?.find((id) => id > 0);
}

/** A work's description, as either a bare string or a `{ value }` text object. */
export function description(
  raw: string | { value?: string } | undefined,
): string | null {
  const text = typeof raw === "string" ? raw : raw?.value;
  if (!text) return null;

  let cleaned = stripTags(text);
  // Editors often append cross-reference notes ("This work has also been
  // published in multiple volumes. See: ...") after a "---" divider — keep
  // only the synopsis that precedes it.
  const dividerIndex = cleaned.search(/\n\s*-{3,}\s*\n/);
  if (dividerIndex !== -1) cleaned = cleaned.slice(0, dividerIndex);
  // Markdown links ([text](url)) → just the link text; the raw url reads as
  // clutter in a plain-text synopsis.
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").trim();

  return cleaned.length > 0 ? cleaned : null;
}
