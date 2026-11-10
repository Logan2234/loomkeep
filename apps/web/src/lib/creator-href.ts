import type { CreatorRefDto, CreatorSource } from "@loomkeep/shared";

// The sources whose people have a page so far: AniList staff and Open
// Library authors stay plain names until theirs ship.
const SOURCES_WITH_PERSON_PAGE: ReadonlySet<CreatorSource> = new Set(["tmdb"]);

/** The only place a person page's URL is built; null when there's no page. */
export function creatorHref(
  ref: Pick<CreatorRefDto, "source" | "id">,
): string | null {
  return SOURCES_WITH_PERSON_PAGE.has(ref.source)
    ? `/app/people/${ref.source}/${encodeURIComponent(ref.id)}`
    : null;
}
