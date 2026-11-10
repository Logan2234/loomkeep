import type {
  CreatorCreditKind,
  CreatorGroupDto,
  CreatorWorkDto,
} from "@loomkeep/shared";

export type WorkTypeFilter = "ALL" | "MOVIE" | "SERIES";
/** "known": most published first, for books, whose dates Open Library often gets wrong. */
export type WorkOrder = "known" | "newest" | "oldest";

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

  if (filters.order === "known") {
    return kept.sort((a, b) => (b.editionCount ?? 0) - (a.editionCount ?? 0));
  }

  return filters.order === "newest" ? kept.reverse() : kept;
}

export interface SeriesBlock {
  key: string;
  name: string;
  /** In series order. */
  works: CreatorWorkDto[];
}

/**
 * An author's series, each as a block in reading order, and the books
 * outside them in the order given. A "series" of one book stays with the
 * others.
 */
export function bySeries(works: CreatorWorkDto[]): {
  series: SeriesBlock[];
  others: CreatorWorkDto[];
} {
  const blocks = new Map<string, SeriesBlock>();

  for (const work of works) {
    if (!work.series) continue;
    const block = blocks.get(work.series.key) ?? {
      key: work.series.key,
      name: work.series.name,
      works: [],
    };
    block.works.push(work);
    blocks.set(work.series.key, block);
  }

  const series = [...blocks.values()]
    .filter((block) => block.works.length > 1)
    .map((block) => ({
      ...block,
      works: [...block.works].sort(
        (a, b) => (a.series?.position ?? 0) - (b.series?.position ?? 0),
      ),
    }));
  const inSeries = new Set(series.map((block) => block.key));

  return {
    series,
    others: works.filter(
      (work) => !work.series || !inSeries.has(work.series.key),
    ),
  };
}

/** Whether the type filter has anything to choose between. */
export const mixesTypes = (works: CreatorWorkDto[]) =>
  new Set(works.map((work) => work.type)).size > 1;

const MENTION_KINDS: ReadonlySet<CreatorCreditKind> = new Set([
  "TV_APPEARANCE",
  "DOCUMENTARY",
  "CAMEO",
  "THANKS",
  "ANTHOLOGY",
  "OMNIBUS",
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
