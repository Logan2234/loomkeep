import type {
  CreatorRefDto,
  CreatorSource,
  CreatorWorkDto,
} from "@loomkeep/shared";

// The sources whose people have a page so far: AniList staff stay plain
// names until theirs ship.
const SOURCES_WITH_PERSON_PAGE: ReadonlySet<CreatorSource> = new Set([
  "tmdb",
  "openlibrary",
]);

/** The only place a person page's URL is built; null when there's no page. */
export function creatorHref(
  ref: Pick<CreatorRefDto, "source" | "id">,
): string | null {
  return SOURCES_WITH_PERSON_PAGE.has(ref.source)
    ? `/app/people/${ref.source}/${encodeURIComponent(ref.id)}`
    : null;
}

/** The page of a work listed on a creator's page: a book's, or a film's or series'. */
export const workHref = (work: CreatorWorkDto) =>
  work.domain === "BOOKS"
    ? `/app/books/${work.sourceId}`
    : `/app/media/${work.type?.toLowerCase()}/${work.sourceId}`;
