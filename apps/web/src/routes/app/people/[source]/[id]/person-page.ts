import type {
  CreatorCreditKind,
  CreatorGroupDto,
  CreatorWorkDto,
} from "@loomkeep/shared";

export type WorkTypeFilter = "ALL" | "MOVIE" | "SERIES";
export type WorkOrder = "newest" | "oldest";

export interface WorkFilters {
  type: WorkTypeFilter;
  /** Only the works in the viewer's library. */
  inLibrary: boolean;
  order: WorkOrder;
}

/**
 * A group's works as the grid shows them. The API sends them oldest first,
 * undated announcements last: newest first is that order reversed, the
 * announcements leading.
 */
export function visibleWorks(
  works: CreatorWorkDto[],
  filters: WorkFilters,
): CreatorWorkDto[] {
  const kept = works.filter(
    (work) =>
      (filters.type === "ALL" || work.type === filters.type) &&
      (!filters.inLibrary || work.status !== null),
  );
  return filters.order === "newest" ? kept.reverse() : kept;
}

/** Whether the type filter has anything to choose between. */
export const mixesTypes = (works: CreatorWorkDto[]) =>
  new Set(works.map((work) => work.type)).size > 1;

const MENTION_KINDS: ReadonlySet<CreatorCreditKind> = new Set([
  "TV_APPEARANCE",
  "DOCUMENTARY",
  "CAMEO",
  "THANKS",
]);

/**
 * The role tabs keep the person's works. Appearances and mentions go to one
 * list under them, each title once, newest first: a talk show credited under
 * Acting and thanked under Crew is a single line.
 */
export function splitCredits(groups: CreatorGroupDto[]): {
  tabs: CreatorGroupDto[];
  mentions: CreatorWorkDto[];
} {
  const tabs = groups
    .map((group) => ({
      key: group.key,
      works: group.works.filter((work) => !MENTION_KINDS.has(work.kind)),
    }))
    .filter((group) => group.works.length > 0);

  const seen = new Set<string>();
  const mentions = groups
    .flatMap((group) => group.works)
    .filter((work) => {
      const id = `${work.type}:${work.sourceId}`;
      if (!MENTION_KINDS.has(work.kind) || seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .sort(newestFirst);

  return { tabs, mentions };
}

/** Undated first: TMDB leaves the date off what isn't out yet. */
function newestFirst(a: CreatorWorkDto, b: CreatorWorkDto): number {
  if (a.releaseDate === b.releaseDate) return 0;
  if (!a.releaseDate) return -1;
  if (!b.releaseDate) return 1;
  return a.releaseDate < b.releaseDate ? 1 : -1;
}

/** "1967", or "1929 – 2018": the years a person lived. */
export function lifeYears(
  birthday: string | null,
  deathday: string | null,
): string | null {
  const born = birthday?.slice(0, 4);
  const died = deathday?.slice(0, 4);
  if (!born) return died ? `† ${died}` : null;
  return died ? `${born} – ${died}` : born;
}
